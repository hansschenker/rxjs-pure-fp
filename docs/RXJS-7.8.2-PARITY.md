# RxJS 7.8.2 Parity

## Current milestone: M01 — Functional Subscription

M01 implements the first runtime responsibility: the RxJS subscription lifecycle, re-expressed as closure-owned state and structural functions.

| Dimension | M01 status |
| --- | --- |
| Behavioral oracle pinned | `rxjs@7.8.2` |
| ES3 runtime reference | exact `Subscription.js` reference committed |
| Architecture gate | passes with no class, `extends`, `super`, prototype mutation, or project-defined `new` |
| Unit lifecycle tests | 11 total project unit tests after M01 |
| Differential lifecycle traces | 7 M01 traces match RxJS 7.8.2 |
| RxJS root exports implemented | `Subscription`, `UnsubscriptionError` |
| Functional root extensions | `createSubscription` |
| Root export parity | 2 / 175 = 1.1% |
| Distribution architecture | class-free ESM and CommonJS output verified |

## M01 semantic parity scope

The functional subscription matches RxJS 7.8.2 for:

- open → closed lifecycle transition;
- idempotent `unsubscribe()`;
- initial teardown running before registered finalizers;
- function finalizers;
- structural `{ unsubscribe() }` finalizers;
- immediate execution when a finalizer is added after closure;
- duplicate function finalizers and one-at-a-time `remove()` behavior;
- child ownership and cascading teardown;
- explicit child removal without cancelling the child;
- child self-detachment from multiple parents;
- continued finalization after teardown errors;
- flattening nested unsubscription errors into one aggregate error;
- RxJS-compatible `UnsubscriptionError` name, message, and `errors` payload.

## Functional API versus parity names

`createSubscription(initialTeardown?)` is the canonical M01 API.

The root names `Subscription` and `UnsubscriptionError` are also implemented because they are public RxJS 7.8.2 exports, but in `rxjs-pure-fp` they are ordinary non-constructible functions. `new Subscription()` and `new UnsubscriptionError()` are intentional OO-invocation deviations.

`reference/functional-exports.json` records functional additions that do not exist in the RxJS root export list. The parity reporter therefore distinguishes three groups: implemented RxJS exports, declared functional extensions, and accidental unexpected exports.

## Intentional architectural deviations

The final project does not promise OO invocation compatibility such as `new Observable()`, inheritance, or prototype methods as its canonical API. It targets observable behavior and feature capability through a functional API.
