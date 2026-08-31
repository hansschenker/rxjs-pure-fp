# Feature Parity List

Root export parity of `rxjs-pure-fp` against the pinned behavioral oracle
`rxjs@7.8.2`, generated from `reference/exports.json` and the built
`dist/esm/index.js` after **M14 — Temporal Operators**.

**Implemented: 101 / 175 root exports (57.7%)** — 0 unexpected exports.

An implemented name means the export exists with differentially certified
behavior for its claimed scope (see `docs/RXJS-7.8.2-PARITY.md` for
per-milestone certified scope and recorded deferrals).

| Implemented (rxjs-pure-fp) | Original (rxjs@7.8.2) |
| --- | --- |
| — | `__esModule` |
| — | `animationFrame` |
| — | `animationFrames` |
| — | `animationFrameScheduler` |
| `ArgumentOutOfRangeError` ✅ | `ArgumentOutOfRangeError` |
| `asap` ✅ | `asap` |
| `asapScheduler` ✅ | `asapScheduler` |
| `async` ✅ | `async` |
| `asyncScheduler` ✅ | `asyncScheduler` |
| `AsyncSubject` ✅ | `AsyncSubject` |
| `audit` ✅ | `audit` |
| `auditTime` ✅ | `auditTime` |
| `BehaviorSubject` ✅ | `BehaviorSubject` |
| — | `bindCallback` |
| — | `bindNodeCallback` |
| — | `buffer` |
| — | `bufferCount` |
| — | `bufferTime` |
| — | `bufferToggle` |
| — | `bufferWhen` |
| `catchError` ✅ | `catchError` |
| — | `combineAll` |
| `combineLatest` ✅ | `combineLatest` |
| — | `combineLatestAll` |
| `combineLatestWith` ✅ | `combineLatestWith` |
| `concat` ✅ | `concat` |
| `concatAll` ✅ | `concatAll` |
| `concatMap` ✅ | `concatMap` |
| `concatMapTo` ✅ | `concatMapTo` |
| `concatWith` ✅ | `concatWith` |
| `config` ✅ | `config` |
| `connect` ✅ | `connect` |
| `connectable` ✅ | `connectable` |
| — | `ConnectableObservable` |
| — | `count` |
| `debounce` ✅ | `debounce` |
| `debounceTime` ✅ | `debounceTime` |
| — | `default` |
| `defaultIfEmpty` ✅ | `defaultIfEmpty` |
| — | `defer` |
| `delay` ✅ | `delay` |
| `delayWhen` ✅ | `delayWhen` |
| — | `dematerialize` |
| `distinct` ✅ | `distinct` |
| `distinctUntilChanged` ✅ | `distinctUntilChanged` |
| `distinctUntilKeyChanged` ✅ | `distinctUntilKeyChanged` |
| `elementAt` ✅ | `elementAt` |
| — | `empty` |
| `EMPTY` ✅ | `EMPTY` |
| `EmptyError` ✅ | `EmptyError` |
| — | `endWith` |
| — | `every` |
| — | `exhaust` |
| `exhaustAll` ✅ | `exhaustAll` |
| `exhaustMap` ✅ | `exhaustMap` |
| `expand` ✅ | `expand` |
| `filter` ✅ | `filter` |
| `finalize` ✅ | `finalize` |
| — | `find` |
| — | `findIndex` |
| `first` ✅ | `first` |
| — | `firstValueFrom` |
| `flatMap` ✅ | `flatMap` |
| `forkJoin` ✅ | `forkJoin` |
| — | `from` |
| — | `fromEvent` |
| — | `fromEventPattern` |
| — | `generate` |
| — | `groupBy` |
| `identity` ✅ | `identity` |
| — | `ignoreElements` |
| — | `iif` |
| `interval` ✅ | `interval` |
| — | `isEmpty` |
| — | `isObservable` |
| `last` ✅ | `last` |
| — | `lastValueFrom` |
| `map` ✅ | `map` |
| — | `mapTo` |
| — | `materialize` |
| — | `max` |
| `merge` ✅ | `merge` |
| `mergeAll` ✅ | `mergeAll` |
| `mergeMap` ✅ | `mergeMap` |
| `mergeMapTo` ✅ | `mergeMapTo` |
| `mergeScan` ✅ | `mergeScan` |
| `mergeWith` ✅ | `mergeWith` |
| — | `min` |
| — | `multicast` |
| — | `never` |
| — | `NEVER` |
| `noop` ✅ | `noop` |
| `NotFoundError` ✅ | `NotFoundError` |
| — | `Notification` |
| — | `NotificationKind` |
| `ObjectUnsubscribedError` ✅ | `ObjectUnsubscribedError` |
| — | `observable` |
| `Observable` ✅ | `Observable` |
| `observeOn` ✅ | `observeOn` |
| `of` ✅ | `of` |
| — | `onErrorResumeNext` |
| — | `onErrorResumeNextWith` |
| — | `pairs` |
| `pairwise` ✅ | `pairwise` |
| — | `partition` |
| `pipe` ✅ | `pipe` |
| — | `pluck` |
| — | `publish` |
| — | `publishBehavior` |
| — | `publishLast` |
| — | `publishReplay` |
| `queue` ✅ | `queue` |
| `queueScheduler` ✅ | `queueScheduler` |
| `race` ✅ | `race` |
| `raceWith` ✅ | `raceWith` |
| — | `range` |
| `reduce` ✅ | `reduce` |
| — | `refCount` |
| `repeat` ✅ | `repeat` |
| — | `repeatWhen` |
| `ReplaySubject` ✅ | `ReplaySubject` |
| `retry` ✅ | `retry` |
| — | `retryWhen` |
| `sample` ✅ | `sample` |
| `sampleTime` ✅ | `sampleTime` |
| `scan` ✅ | `scan` |
| — | `scheduled` |
| — | `Scheduler` |
| — | `sequenceEqual` |
| `SequenceError` ✅ | `SequenceError` |
| `share` ✅ | `share` |
| `shareReplay` ✅ | `shareReplay` |
| `single` ✅ | `single` |
| `skip` ✅ | `skip` |
| `skipLast` ✅ | `skipLast` |
| `skipUntil` ✅ | `skipUntil` |
| `skipWhile` ✅ | `skipWhile` |
| — | `startWith` |
| `Subject` ✅ | `Subject` |
| `subscribeOn` ✅ | `subscribeOn` |
| `Subscriber` ✅ | `Subscriber` |
| `Subscription` ✅ | `Subscription` |
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
| — | `timeInterval` |
| `timeout` ✅ | `timeout` |
| `TimeoutError` ✅ | `TimeoutError` |
| `timeoutWith` ✅ | `timeoutWith` |
| `timer` ✅ | `timer` |
| — | `timestamp` |
| — | `toArray` |
| `UnsubscriptionError` ✅ | `UnsubscriptionError` |
| — | `using` |
| — | `VirtualAction` |
| — | `VirtualTimeScheduler` |
| — | `window` |
| — | `windowCount` |
| — | `windowTime` |
| — | `windowToggle` |
| — | `windowWhen` |
| `withLatestFrom` ✅ | `withLatestFrom` |
| `zip` ✅ | `zip` |
| — | `zipAll` |
| `zipWith` ✅ | `zipWith` |

## Deliberate functional extensions (not counted as parity)

| Extension export |
| --- |
| `createAsyncSubject` |
| `createBehaviorSubject` |
| `createObservable` |
| `createReplaySubject` |
| `createSubject` |
| `createSubscriber` |
| `createSubscription` |
| `emitNone` |
| `emitOne` |
| `filterSink` |
| `fuseSinkTransformers` |
| `liftSinkTransformer` |
| `mapSink` |
| `pipeValue` |
| `statefulOperator` |
| `subscribe` |
