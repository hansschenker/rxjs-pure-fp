const subscriptionMarker = Symbol('rxjs-pure-fp.subscription');
const hasParentSymbol = Symbol('rxjs-pure-fp.subscription.hasParent');
const addParentSymbol = Symbol('rxjs-pure-fp.subscription.addParent');
const removeParentSymbol = Symbol('rxjs-pure-fp.subscription.removeParent');
const unsubscriptionErrorMarker = Symbol('rxjs-pure-fp.unsubscription-error');

export type Unsubscribable = {
  unsubscribe(): void;
};

export type Subscription = Unsubscribable & {
  readonly closed: boolean;
  add(teardown: TeardownLogic): void;
  remove(teardown: Exclude<TeardownLogic, void>): void;
};

export type TeardownLogic = Subscription | Unsubscribable | (() => void) | void;

export type UnsubscriptionError = Error & {
  readonly errors: unknown[];
};

type Finalizer = Exclude<TeardownLogic, void>;

type InternalSubscription = Subscription & {
  readonly [subscriptionMarker]: true;
  [hasParentSymbol](parent: InternalSubscription): boolean;
  [addParentSymbol](parent: InternalSubscription): void;
  [removeParentSymbol](parent: InternalSubscription): void;
};

type InternalUnsubscriptionError = UnsubscriptionError & {
  readonly [unsubscriptionErrorMarker]: true;
};

/**
 * Creates an RxJS-compatible subscription lifecycle using closure-owned state.
 *
 * No constructor, prototype, inheritance chain, or project-defined `new` is
 * involved. The returned record is only the operations that can affect the
 * lifecycle plus a live `closed` view over the closure state.
 */
export const createSubscription = (initialTeardown?: () => void): Subscription => {
  let closed = false;
  let parentage: InternalSubscription | InternalSubscription[] | null = null;
  let finalizers: Finalizer[] | null = null;
  let subscription!: InternalSubscription;

  const unsubscribe = (): void => {
    if (closed) {
      return;
    }

    closed = true;
    let errors: unknown[] | undefined;

    const parents = parentage;
    if (parents) {
      parentage = null;
      if (Array.isArray(parents)) {
        for (const parent of parents) {
          parent.remove(subscription);
        }
      } else {
        parents.remove(subscription);
      }
    }

    if (isFunction(initialTeardown)) {
      try {
        initialTeardown();
      } catch (error) {
        errors = isInternalUnsubscriptionError(error) ? [...error.errors] : [error];
      }
    }

    const currentFinalizers = finalizers;
    if (currentFinalizers) {
      finalizers = null;
      for (const finalizer of currentFinalizers) {
        try {
          execFinalizer(finalizer);
        } catch (error) {
          errors ??= [];
          if (isInternalUnsubscriptionError(error)) {
            errors.push(...error.errors);
          } else {
            errors.push(error);
          }
        }
      }
    }

    if (errors) {
      throw createUnsubscriptionError(errors);
    }
  };

  const add = (teardown: TeardownLogic): void => {
    if (!teardown || teardown === subscription) {
      return;
    }

    if (closed) {
      execFinalizer(teardown);
      return;
    }

    if (isInternalSubscription(teardown)) {
      if (teardown.closed || teardown[hasParentSymbol](subscription)) {
        return;
      }
      teardown[addParentSymbol](subscription);
    }

    (finalizers ??= []).push(teardown);
  };

  const remove = (teardown: Finalizer): void => {
    if (finalizers) {
      removeFirst(finalizers, teardown);
    }

    if (isInternalSubscription(teardown)) {
      teardown[removeParentSymbol](subscription);
    }
  };

  subscription = {
    get closed() {
      return closed;
    },
    unsubscribe,
    add,
    remove,
    [subscriptionMarker]: true,
    [hasParentSymbol](parent) {
      return parentage === parent || (Array.isArray(parentage) && parentage.includes(parent));
    },
    [addParentSymbol](parent) {
      parentage = Array.isArray(parentage)
        ? (parentage.push(parent), parentage)
        : parentage
          ? [parentage, parent]
          : parent;
    },
    [removeParentSymbol](parent) {
      if (parentage === parent) {
        parentage = null;
      } else if (Array.isArray(parentage)) {
        removeFirst(parentage, parent);
      }
    },
  };

  return subscription;
};

/**
 * Root-export parity name for RxJS 7.8.2. It is intentionally a function, not
 * a constructible class. Prefer `createSubscription` in the functional API.
 */
export const Subscription = (initialTeardown?: () => void): Subscription => createSubscription(initialTeardown);

export const EMPTY_SUBSCRIPTION: Subscription = (() => {
  const empty = createSubscription();
  empty.unsubscribe();
  return empty;
})();

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
        .map((error, index) => `${index + 1}) ${(error as { toString(): string }).toString()}`)
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

/**
 * Root-export parity name for RxJS 7.8.2. Like `Subscription`, this is a
 * functional factory rather than a constructible error class.
 */
export const UnsubscriptionError = (errors: unknown[]): UnsubscriptionError => createUnsubscriptionError(errors);

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
