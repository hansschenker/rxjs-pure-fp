const subscriptionMarker = Symbol('rxjs-pure-fp.subscription');
const hasParentSymbol = Symbol('rxjs-pure-fp.subscription.hasParent');
const addParentSymbol = Symbol('rxjs-pure-fp.subscription.addParent');
const removeParentSymbol = Symbol('rxjs-pure-fp.subscription.removeParent');
const unsubscriptionErrorMarker = Symbol('rxjs-pure-fp.unsubscription-error');

export type Unsubscribable = {
  readonly unsubscribe: () => void;
};

export type Subscription = Unsubscribable & {
  readonly closed: boolean;
  readonly add: (teardown: TeardownLogic) => void;
  readonly remove: (teardown: Exclude<TeardownLogic, void>) => void;
};

export type TeardownLogic = Subscription | Unsubscribable | (() => void) | void;

export type UnsubscriptionError = Error & {
  readonly errors: unknown[];
};

/**
 * F5 (docs/FP-ROADMAP.md): teardown as an error-aggregating monoid. A
 * `Teardown` runs its effect and returns the flattened unsubscription errors
 * instead of throwing — errors-as-values is what makes `emptyTeardown` a
 * lawful two-sided identity and `combineTeardown` associative. The single
 * `UnsubscriptionError` throw happens once, at the unsubscribe boundary.
 */
export type Teardown = () => unknown[];

export const emptyTeardown: Teardown = () => [];

/** Canonicalizes one `TeardownLogic` case into the monoid. */
export const toTeardown = (teardown: Exclude<TeardownLogic, void>): Teardown => () => {
  try {
    execFinalizer(teardown);
    return [];
  } catch (error) {
    return isInternalUnsubscriptionError(error) ? [...error.errors] : [error];
  }
};

export const combineTeardown = (first: Teardown, second: Teardown): Teardown =>
  () => [...first(), ...second()];

type Finalizer = Exclude<TeardownLogic, void>;

type InternalSubscription = Subscription & {
  readonly [subscriptionMarker]: true;
  readonly [hasParentSymbol]: (parent: InternalSubscription) => boolean;
  readonly [addParentSymbol]: (parent: InternalSubscription) => void;
  readonly [removeParentSymbol]: (parent: InternalSubscription) => void;
};

type InternalUnsubscriptionError = UnsubscriptionError & {
  readonly [unsubscriptionErrorMarker]: true;
};

/**
 * F4 kernel-internal composition point for records that are subscriptions.
 * The caller assembles its own frozen record around these closure-owned
 * operations, spreads `protocol` into it (the internal subscription protocol,
 * opaque outside this module), and registers the finished record via
 * `setSelf` as the identity used for parentage bookkeeping.
 */
export type LifecycleState = {
  readonly isClosed: () => boolean;
  readonly unsubscribe: () => void;
  readonly add: (teardown: TeardownLogic) => void;
  readonly remove: (teardown: Exclude<TeardownLogic, void>) => void;
  readonly protocol: object;
  readonly setSelf: (record: Subscription) => void;
};

export const createLifecycleState = (initialTeardown?: () => void): LifecycleState => {
  let closed = false;
  let parentage: InternalSubscription | InternalSubscription[] | null = null;
  let finalizers: Finalizer[] | null = null;
  let self!: InternalSubscription;

  const unsubscribe = (): void => {
    if (closed) {
      return;
    }

    closed = true;

    const parents = parentage;
    if (parents) {
      parentage = null;
      if (Array.isArray(parents)) {
        for (const parent of parents) {
          parent.remove(self);
        }
      } else {
        parents.remove(self);
      }
    }

    const currentFinalizers: Finalizer[] = finalizers ?? [];
    finalizers = null;
    const teardown = currentFinalizers.reduce<Teardown>(
      (combined, finalizer) => combineTeardown(combined, toTeardown(finalizer)),
      isFunction(initialTeardown) ? toTeardown(initialTeardown) : emptyTeardown
    );

    const errors = teardown();
    if (errors.length) {
      throw createUnsubscriptionError(errors);
    }
  };

  const add = (teardown: TeardownLogic): void => {
    if (!teardown || teardown === self) {
      return;
    }

    if (closed) {
      execFinalizer(teardown);
      return;
    }

    if (isInternalSubscription(teardown)) {
      if (teardown.closed || teardown[hasParentSymbol](self)) {
        return;
      }
      teardown[addParentSymbol](self);
    }

    (finalizers ??= []).push(teardown);
  };

  const remove = (teardown: Finalizer): void => {
    if (finalizers) {
      removeFirst(finalizers, teardown);
    }

    if (isInternalSubscription(teardown)) {
      teardown[removeParentSymbol](self);
    }
  };

  const protocol = {
    [subscriptionMarker]: true,
    [hasParentSymbol](parent: InternalSubscription) {
      return parentage === parent || (Array.isArray(parentage) && parentage.includes(parent));
    },
    [addParentSymbol](parent: InternalSubscription) {
      parentage = Array.isArray(parentage)
        ? (parentage.push(parent), parentage)
        : parentage
          ? [parentage, parent]
          : parent;
    },
    [removeParentSymbol](parent: InternalSubscription) {
      if (parentage === parent) {
        parentage = null;
      } else if (Array.isArray(parentage)) {
        removeFirst(parentage, parent);
      }
    },
  };

  return {
    isClosed: () => closed,
    unsubscribe,
    add,
    remove,
    protocol,
    setSelf: (record) => {
      self = record as InternalSubscription;
    },
  };
};

/**
 * Creates an RxJS-compatible subscription lifecycle using closure-owned state.
 *
 * No constructor, prototype, inheritance chain, or project-defined `new` is
 * involved. The returned record is a frozen composition (F4) of the lifecycle
 * operations plus a live `closed` view over the closure state.
 */
export const createSubscription = (initialTeardown?: () => void): Subscription => {
  const lifecycle = createLifecycleState(initialTeardown);
  const subscription: Subscription = Object.freeze({
    get closed() {
      return lifecycle.isClosed();
    },
    unsubscribe: lifecycle.unsubscribe,
    add: lifecycle.add,
    remove: lifecycle.remove,
    ...lifecycle.protocol,
  });
  lifecycle.setSelf(subscription);
  return subscription;
};

export const isSubscription = (value: unknown): value is Subscription => {
  if (isInternalSubscription(value)) {
    return true;
  }

  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  const candidate = value as Partial<Subscription>;
  return (
    'closed' in candidate &&
    isFunction(candidate.remove) &&
    isFunction(candidate.add) &&
    isFunction(candidate.unsubscribe)
  );
};

export const createUnsubscriptionError = (errors: unknown[]): UnsubscriptionError => {
  const message = errors
    ? `${errors.length} errors occurred during unsubscription:\n${errors
        .map((error, index) => `${index + 1}) ${(error as { toString: () => string }).toString()}`)
        .join('\n  ')}`
    : '';

  const error = new Error(message) as Error & {
    name: string;
    errors: unknown[];
    [unsubscriptionErrorMarker]: true;
  };

  error.name = 'UnsubscriptionError';
  error.errors = errors;
  error[unsubscriptionErrorMarker] = true;
  return error;
};

const isInternalSubscription = (value: unknown): value is InternalSubscription =>
  typeof value === 'object' && value !== null && (value as Partial<InternalSubscription>)[subscriptionMarker] === true;

const isInternalUnsubscriptionError = (value: unknown): value is InternalUnsubscriptionError =>
  value instanceof Error &&
  (value as Partial<InternalUnsubscriptionError>)[unsubscriptionErrorMarker] === true &&
  Array.isArray((value as Partial<UnsubscriptionError>).errors);

const execFinalizer = (finalizer: Finalizer): void => {
  if (isFunction(finalizer)) {
    finalizer();
  } else {
    finalizer.unsubscribe();
  }
};

const removeFirst = <T>(values: T[], value: T): void => {
  const index = values.indexOf(value);
  if (index >= 0) {
    values.splice(index, 1);
  }
};

const isFunction = (value: unknown): value is (...args: never[]) => unknown => typeof value === 'function';

export const EMPTY_SUBSCRIPTION: Subscription = (() => {
  const empty = createSubscription();
  empty.unsubscribe();
  return empty;
})();
