import type { Observable } from '../kernel/observable.ts';
import type { TimestampProvider } from '../kernel/scheduler.ts';
import type { PartialObserver } from '../kernel/sink.ts';
import {
  createAnonymousSubject,
  createAsyncSubject,
  createBehaviorSubject,
  createReplaySubject,
  createSubject,
  type BehaviorSubject as BehaviorSubjectRecord,
  type Subject as SubjectRecord,
} from '../kernel/subject.ts';

/**
 * Root-export parity names for RxJS 7.8.2. Like the other parity names, these
 * are callable functional factories rather than constructible classes. The
 * deprecated static `Subject.create` is retained as a function property.
 */

type SubjectFactory = {
  <T>(): SubjectRecord<T>;
  readonly create: <T>(
    destination?: PartialObserver<T>,
    source?: Observable<T>
  ) => SubjectRecord<T>;
};

const subjectFactory = <T>(): SubjectRecord<T> => createSubject<T>();

export const Subject = Object.assign(subjectFactory, {
  create: <T>(destination?: PartialObserver<T>, source?: Observable<T>): SubjectRecord<T> =>
    createAnonymousSubject(destination, source),
}) as SubjectFactory;

export const BehaviorSubject = <T>(initialValue: T): BehaviorSubjectRecord<T> =>
  createBehaviorSubject(initialValue);

/** Size window, time window, and the window's clock — the RxJS constructor's three arguments. */
export const ReplaySubject = <T>(
  bufferSize?: number,
  windowTime?: number,
  timestampProvider?: TimestampProvider
): SubjectRecord<T> => createReplaySubject<T>(bufferSize, windowTime, timestampProvider);

export const AsyncSubject = <T>(): SubjectRecord<T> => createAsyncSubject<T>();
