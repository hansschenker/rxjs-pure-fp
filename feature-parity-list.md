# Feature Parity List

Root export parity of `rxjs-pure-fp` against the pinned behavioral oracle
`rxjs@7.8.2`, generated from `reference/exports.json` and Node's view of the
built package by `tools/certification-matrix.mjs` after **M20 — Differential
Certification**.

**Implemented: 175 / 175 root exports (100.0%)** — 0 unexpected exports.
The `rxjs/operators` subpath is provided as well: 115 / 115 names.

An implemented name means the export exists with differentially certified
behavior for its claimed scope (see `docs/RXJS-7.8.2-PARITY.md` for
per-milestone certified scope and recorded deviations, and
`docs/CERTIFICATION-MATRIX.md` for the per-name certification evidence).

| Implemented (rxjs-pure-fp) | Original (rxjs@7.8.2) |
| --- | --- |
| `ArgumentOutOfRangeError` ✅ | `ArgumentOutOfRangeError` |
| `AsyncSubject` ✅ | `AsyncSubject` |
| `BehaviorSubject` ✅ | `BehaviorSubject` |
| `ConnectableObservable` ✅ | `ConnectableObservable` |
| `EMPTY` ✅ | `EMPTY` |
| `EmptyError` ✅ | `EmptyError` |
| `NEVER` ✅ | `NEVER` |
| `NotFoundError` ✅ | `NotFoundError` |
| `Notification` ✅ | `Notification` |
| `NotificationKind` ✅ | `NotificationKind` |
| `ObjectUnsubscribedError` ✅ | `ObjectUnsubscribedError` |
| `Observable` ✅ | `Observable` |
| `ReplaySubject` ✅ | `ReplaySubject` |
| `Scheduler` ✅ | `Scheduler` |
| `SequenceError` ✅ | `SequenceError` |
| `Subject` ✅ | `Subject` |
| `Subscriber` ✅ | `Subscriber` |
| `Subscription` ✅ | `Subscription` |
| `TimeoutError` ✅ | `TimeoutError` |
| `UnsubscriptionError` ✅ | `UnsubscriptionError` |
| `VirtualAction` ✅ | `VirtualAction` |
| `VirtualTimeScheduler` ✅ | `VirtualTimeScheduler` |
| `__esModule` ✅ | `__esModule` |
| `animationFrame` ✅ | `animationFrame` |
| `animationFrameScheduler` ✅ | `animationFrameScheduler` |
| `animationFrames` ✅ | `animationFrames` |
| `asap` ✅ | `asap` |
| `asapScheduler` ✅ | `asapScheduler` |
| `async` ✅ | `async` |
| `asyncScheduler` ✅ | `asyncScheduler` |
| `audit` ✅ | `audit` |
| `auditTime` ✅ | `auditTime` |
| `bindCallback` ✅ | `bindCallback` |
| `bindNodeCallback` ✅ | `bindNodeCallback` |
| `buffer` ✅ | `buffer` |
| `bufferCount` ✅ | `bufferCount` |
| `bufferTime` ✅ | `bufferTime` |
| `bufferToggle` ✅ | `bufferToggle` |
| `bufferWhen` ✅ | `bufferWhen` |
| `catchError` ✅ | `catchError` |
| `combineAll` ✅ | `combineAll` |
| `combineLatest` ✅ | `combineLatest` |
| `combineLatestAll` ✅ | `combineLatestAll` |
| `combineLatestWith` ✅ | `combineLatestWith` |
| `concat` ✅ | `concat` |
| `concatAll` ✅ | `concatAll` |
| `concatMap` ✅ | `concatMap` |
| `concatMapTo` ✅ | `concatMapTo` |
| `concatWith` ✅ | `concatWith` |
| `config` ✅ | `config` |
| `connect` ✅ | `connect` |
| `connectable` ✅ | `connectable` |
| `count` ✅ | `count` |
| `debounce` ✅ | `debounce` |
| `debounceTime` ✅ | `debounceTime` |
| `default` ✅ | `default` |
| `defaultIfEmpty` ✅ | `defaultIfEmpty` |
| `defer` ✅ | `defer` |
| `delay` ✅ | `delay` |
| `delayWhen` ✅ | `delayWhen` |
| `dematerialize` ✅ | `dematerialize` |
| `distinct` ✅ | `distinct` |
| `distinctUntilChanged` ✅ | `distinctUntilChanged` |
| `distinctUntilKeyChanged` ✅ | `distinctUntilKeyChanged` |
| `elementAt` ✅ | `elementAt` |
| `empty` ✅ | `empty` |
| `endWith` ✅ | `endWith` |
| `every` ✅ | `every` |
| `exhaust` ✅ | `exhaust` |
| `exhaustAll` ✅ | `exhaustAll` |
| `exhaustMap` ✅ | `exhaustMap` |
| `expand` ✅ | `expand` |
| `filter` ✅ | `filter` |
| `finalize` ✅ | `finalize` |
| `find` ✅ | `find` |
| `findIndex` ✅ | `findIndex` |
| `first` ✅ | `first` |
| `firstValueFrom` ✅ | `firstValueFrom` |
| `flatMap` ✅ | `flatMap` |
| `forkJoin` ✅ | `forkJoin` |
| `from` ✅ | `from` |
| `fromEvent` ✅ | `fromEvent` |
| `fromEventPattern` ✅ | `fromEventPattern` |
| `generate` ✅ | `generate` |
| `groupBy` ✅ | `groupBy` |
| `identity` ✅ | `identity` |
| `ignoreElements` ✅ | `ignoreElements` |
| `iif` ✅ | `iif` |
| `interval` ✅ | `interval` |
| `isEmpty` ✅ | `isEmpty` |
| `isObservable` ✅ | `isObservable` |
| `last` ✅ | `last` |
| `lastValueFrom` ✅ | `lastValueFrom` |
| `map` ✅ | `map` |
| `mapTo` ✅ | `mapTo` |
| `materialize` ✅ | `materialize` |
| `max` ✅ | `max` |
| `merge` ✅ | `merge` |
| `mergeAll` ✅ | `mergeAll` |
| `mergeMap` ✅ | `mergeMap` |
| `mergeMapTo` ✅ | `mergeMapTo` |
| `mergeScan` ✅ | `mergeScan` |
| `mergeWith` ✅ | `mergeWith` |
| `min` ✅ | `min` |
| `multicast` ✅ | `multicast` |
| `never` ✅ | `never` |
| `noop` ✅ | `noop` |
| `observable` ✅ | `observable` |
| `observeOn` ✅ | `observeOn` |
| `of` ✅ | `of` |
| `onErrorResumeNext` ✅ | `onErrorResumeNext` |
| `onErrorResumeNextWith` ✅ | `onErrorResumeNextWith` |
| `pairs` ✅ | `pairs` |
| `pairwise` ✅ | `pairwise` |
| `partition` ✅ | `partition` |
| `pipe` ✅ | `pipe` |
| `pluck` ✅ | `pluck` |
| `publish` ✅ | `publish` |
| `publishBehavior` ✅ | `publishBehavior` |
| `publishLast` ✅ | `publishLast` |
| `publishReplay` ✅ | `publishReplay` |
| `queue` ✅ | `queue` |
| `queueScheduler` ✅ | `queueScheduler` |
| `race` ✅ | `race` |
| `raceWith` ✅ | `raceWith` |
| `range` ✅ | `range` |
| `reduce` ✅ | `reduce` |
| `refCount` ✅ | `refCount` |
| `repeat` ✅ | `repeat` |
| `repeatWhen` ✅ | `repeatWhen` |
| `retry` ✅ | `retry` |
| `retryWhen` ✅ | `retryWhen` |
| `sample` ✅ | `sample` |
| `sampleTime` ✅ | `sampleTime` |
| `scan` ✅ | `scan` |
| `scheduled` ✅ | `scheduled` |
| `sequenceEqual` ✅ | `sequenceEqual` |
| `share` ✅ | `share` |
| `shareReplay` ✅ | `shareReplay` |
| `single` ✅ | `single` |
| `skip` ✅ | `skip` |
| `skipLast` ✅ | `skipLast` |
| `skipUntil` ✅ | `skipUntil` |
| `skipWhile` ✅ | `skipWhile` |
| `startWith` ✅ | `startWith` |
| `subscribeOn` ✅ | `subscribeOn` |
| `switchAll` ✅ | `switchAll` |
| `switchMap` ✅ | `switchMap` |
| `switchMapTo` ✅ | `switchMapTo` |
| `switchScan` ✅ | `switchScan` |
| `take` ✅ | `take` |
| `takeLast` ✅ | `takeLast` |
| `takeUntil` ✅ | `takeUntil` |
| `takeWhile` ✅ | `takeWhile` |
| `tap` ✅ | `tap` |
| `throttle` ✅ | `throttle` |
| `throttleTime` ✅ | `throttleTime` |
| `throwError` ✅ | `throwError` |
| `throwIfEmpty` ✅ | `throwIfEmpty` |
| `timeInterval` ✅ | `timeInterval` |
| `timeout` ✅ | `timeout` |
| `timeoutWith` ✅ | `timeoutWith` |
| `timer` ✅ | `timer` |
| `timestamp` ✅ | `timestamp` |
| `toArray` ✅ | `toArray` |
| `using` ✅ | `using` |
| `window` ✅ | `window` |
| `windowCount` ✅ | `windowCount` |
| `windowTime` ✅ | `windowTime` |
| `windowToggle` ✅ | `windowToggle` |
| `windowWhen` ✅ | `windowWhen` |
| `withLatestFrom` ✅ | `withLatestFrom` |
| `zip` ✅ | `zip` |
| `zipAll` ✅ | `zipAll` |
| `zipWith` ✅ | `zipWith` |

## Deliberate functional extensions (not counted as parity)

| Extension export |
| --- |
| `createAsyncSubject` |
| `createBehaviorSubject` |
| `createConnectableObservable` |
| `createObservable` |
| `createReplaySubject` |
| `createScheduler` |
| `createSubject` |
| `createSubscriber` |
| `createSubscription` |
| `createVirtualTimeScheduler` |
| `emitNone` |
| `emitOne` |
| `filterSink` |
| `fuseSinkTransformers` |
| `innerFrom` |
| `liftSinkTransformer` |
| `mapSink` |
| `pipeValue` |
| `statefulOperator` |
| `subscribe` |
