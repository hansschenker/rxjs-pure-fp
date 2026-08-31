import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY,
  concat,
  createObservable,
  createSubject,
  distinctUntilChanged,
  filter,
  map,
  mergeMap,
  of,
  pipeValue,
  scan,
  share,
  subscribe,
} from '../../src/index.ts';
import type { ObservableLike as Observable } from '../../src/index.ts';
import { cmdNone, initialModel, type Cmd, type Model, type Msg, type Step } from './model.ts';
import { update } from './update.ts';
import { view } from './view.ts';

export type Dispatch = (msg: Msg) => void;

export type App = {
  readonly dispatch: Dispatch;
  readonly complete: () => void;
};

/** `startWith`, derived as operator algebra (M11's `share` era hasn't landed). */
const startWith = <T>(value: T) => (source: Observable<T>): Observable<T> =>
  concat(of(value), source);

const storePath = join(import.meta.dirname, 'todo-store.json');

/** Interprets a Cmd as an Observable of follow-up messages (the Elm loop). */
const executeCmd = (cmd: Cmd): Observable<Msg> =>
  cmd.kind === 'persist'
    ? createObservable((subscriber) => {
        writeFileSync(storePath, `${JSON.stringify(cmd.todos, null, 2)}\n`);
        subscriber.next({ kind: 'saved', count: cmd.todos.length });
        subscriber.complete();
      })
    : EMPTY;

/**
 * The MVU runtime: messages flow through one pure `scan` of `update`; the
 * resulting steps are multicast through a Subject (manual `share`); the model
 * side renders reference-distinct frames, and the command side interprets
 * effects whose messages feed back into the loop — the Subject subscribed as
 * an observer.
 */
export const runApp = (render: (frame: string) => void): App => {
  const messages = createSubject<Msg>();

  // Msg → Step: one pure fold, seeded with an initial frame and multicast
  // with a real share() (M11) — one scan, many consumers.
  const steps = pipeValue(
    messages,
    scan((step: Step, msg: Msg) => update(step[0], msg), [initialModel, cmdNone] as Step),
    startWith([initialModel, cmdNone] as Step),
    share<Step>()
  );

  // Model → View: only frames whose model actually changed.
  subscribe({ next: render })(
    pipeValue(
      steps,
      map((step: Step) => step[0]),
      distinctUntilChanged<Model>(),
      map(view)
    )
  );

  // Cmd → Msg feedback: effects re-enter the loop through the message hub.
  subscribe(messages)(
    pipeValue(
      steps,
      map((step: Step) => step[1]),
      filter((cmd: Cmd): cmd is Cmd & { readonly kind: 'persist' } => cmd.kind !== 'none'),
      mergeMap(executeCmd)
    )
  );

  return {
    dispatch: (msg) => messages.next(msg),
    complete: () => messages.complete(),
  };
};
