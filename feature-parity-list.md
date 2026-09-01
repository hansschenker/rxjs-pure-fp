# Feature Parity List

Root export parity of `rxjs-pure-fp` against the pinned behavioral oracle
`rxjs@7.8.2`, generated from `reference/exports.json` and the built
`dist/esm/index.js` after **M16 — Creation & Interop**.

**Implemented: 137 / 175 root exports (78.3%)** — 0 unexpected exports.

An implemented name means the export exists with differentially certified
behavior for its claimed scope (see `docs/RXJS-7.8.2-PARITY.md` for
per-milestone certified scope and recorded deferrals).

| Implemented (rxjs-pure-fp) | Original (rxjs@7.8.2) |
| --- | --- |
| `ArgumentOutOfRangeError` ✅ | `ArgumentOutOfRangeError` |
| `AsyncSubject` ✅ | `AsyncSubject` |
| `BehaviorSubject` ✅ | `BehaviorSubject` |
| — | `ConnectableObservable` |
| `EMPTY` ✅ | `EMPTY` |
| `EmptyError` ✅ | `EmptyError` |
| `NEVER` ✅ | `NEVER` |
| `NotFoundError` ✅ | `NotFoundError` |
| — | `Notification` |
| — | `NotificationKind` |
| `ObjectUnsubscribedError` ✅ | `ObjectUnsubscribedError` |
| `Observable` ✅ | `Observable` |
| `ReplaySubject` ✅ | `ReplaySubject` |
| — | `Scheduler` |
| `SequenceError` ✅ | `SequenceError` |
| `Subject` ✅ | `Subject` |
| `Subscriber` ✅ | `Subscriber` |
| `Subscription` ✅ | `Subscription` |
| `TimeoutError` ✅ | `TimeoutError` |
| `UnsubscriptionError` ✅ | `UnsubscriptionError` |
| — | `VirtualAction` |
| — | `VirtualTimeScheduler` |
| — | `__esModule` |
| — | `animationFrame` |
| — | `animationFrameScheduler` |
| — | `animationFrames` |
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
| `count` ✅ | `count` |
| `debounce` ✅ | `debounce` |
| `debounceTime` ✅ | `debounceTime` |
| — | `default` |
| `defaultIfEmpty` ✅ | `defaultIfEmpty` |
| `defer` ✅ | `defer` |
| `delay` ✅ | `delay` |
| `delayWhen` ✅ | `delayWhen` |
| — | `dematerialize` |
| `distinct` ✅ | `distinct` |
| `distinctUntilChanged` ✅ | `distinctUntilChanged` |
| `distinctUntilKeyChanged` ✅ | `distinctUntilKeyChanged` |
| `elementAt` ✅ | `elementAt` |
| `empty` ✅ | `empty` |
| — | `endWith` |
| `every` ✅ | `every` |
| — | `exhaust` |
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
| — | `ignoreElements` |
| `iif` ✅ | `iif` |
| `interval` ✅ | `interval` |
| — | `isEmpty` |
| `isObservable` ✅ | `isObservable` |
| `last` ✅ | `last` |
| `lastValueFrom` ✅ | `lastValueFrom` |
| `map` ✅ | `map` |
| — | `mapTo` |
| — | `materialize` |
| `max` ✅ | `max` |
| `merge` ✅ | `merge` |
| `mergeAll` ✅ | `mergeAll` |
| `mergeMap` ✅ | `mergeMap` |
| `mergeMapTo` ✅ | `mergeMapTo` |
| `mergeScan` ✅ | `mergeScan` |
| `mergeWith` ✅ | `mergeWith` |
| `min` ✅ | `min` |
| — | `multicast` |
| `never` ✅ | `never` |
| `noop` ✅ | `noop` |
| `observable` ✅ | `observable` |
| `observeOn` ✅ | `observeOn` |
| `of` ✅ | `of` |
| — | `onErrorResumeNext` |
| — | `onErrorResumeNextWith` |
| `pairs` ✅ | `pairs` |
| `pairwise` ✅ | `pairwise` |
| `partition` ✅ | `partition` |
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
| `range` ✅ | `range` |
| `reduce` ✅ | `reduce` |
| — | `refCount` |
| `repeat` ✅ | `repeat` |
| — | `repeatWhen` |
| `retry` ✅ | `retry` |
| — | `retryWhen` |
| `sample` ✅ | `sample` |
| `sampleTime` ✅ | `sampleTime` |
| `scan` ✅ | `scan` |
| — | `scheduled` |
| — | `sequenceEqual` |
| `share` ✅ | `share` |
| `shareReplay` ✅ | `shareReplay` |
| `single` ✅ | `single` |
| `skip` ✅ | `skip` |
| `skipLast` ✅ | `skipLast` |
| `skipUntil` ✅ | `skipUntil` |
| `skipWhile` ✅ | `skipWhile` |
| — | `startWith` |
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
| — | `timeInterval` |
| `timeout` ✅ | `timeout` |
| `timeoutWith` ✅ | `timeoutWith` |
| `timer` ✅ | `timer` |
| — | `timestamp` |
| — | `toArray` |
| `using` ✅ | `using` |
| `window` ✅ | `window` |
| `windowCount` ✅ | `windowCount` |
| `windowTime` ✅ | `windowTime` |
| `windowToggle` ✅ | `windowToggle` |
| `windowWhen` ✅ | `windowWhen` |
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
| `innerFrom` |
| `liftSinkTransformer` |
| `mapSink` |
| `pipeValue` |
| `statefulOperator` |
| `subscribe` |
