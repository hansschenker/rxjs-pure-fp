/**
 * MVU Model layer: immutable state, the message union (CRUDL intents), and
 * the command ADT for effects. Everything here is plain data.
 */

export type Todo = {
  readonly id: number;
  readonly title: string;
  readonly done: boolean;
};

export type Filter = 'all' | 'open' | 'done';

export type Model = {
  readonly todos: ReadonlyArray<Todo>;
  readonly nextId: number;
  readonly filter: Filter;
  readonly status: string;
};

export const initialModel: Model = {
  todos: [],
  nextId: 1,
  filter: 'all',
  status: 'ready — type "help" for commands',
};

/** CRUDL intents plus effect feedback. */
export type Msg =
  | { readonly kind: 'add'; readonly title: string }
  | { readonly kind: 'retitle'; readonly id: number; readonly title: string }
  | { readonly kind: 'toggle'; readonly id: number }
  | { readonly kind: 'remove'; readonly id: number }
  | { readonly kind: 'clearDone' }
  | { readonly kind: 'setFilter'; readonly filter: Filter }
  | { readonly kind: 'saved'; readonly count: number }
  | { readonly kind: 'help' }
  | { readonly kind: 'unknown'; readonly input: string };

export type Cmd =
  | { readonly kind: 'none' }
  | { readonly kind: 'persist'; readonly todos: ReadonlyArray<Todo> };

export const cmdNone: Cmd = { kind: 'none' };

export const cmdPersist = (todos: ReadonlyArray<Todo>): Cmd => ({ kind: 'persist', todos });

/** One turn of the MVU loop: the next model plus the effect it requests. */
export type Step = readonly [Model, Cmd];
