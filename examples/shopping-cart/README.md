# shopping-cart

A business-level sample on `rxjs-pure-fp`, straight from `../../src`: a
shopping cart with pricing rules, stock advisories, and a checkout that
reserves inventory and authorizes payment against a (simulated) remote
backend with latency, transient failures, retries, a deadline, and
compensation. No framework, no classes — the whole application is pure
functions over data plus the library's operators.

```bash
node examples/shopping-cart/main.ts --demo        # deterministic scripted run
node examples/shopping-cart/main.ts               # interactive CLI (help, catalog, quit)
node --test examples/shopping-cart/cart.test.mjs  # domain tests + marble tests in virtual time
npx tsc -p examples/shopping-cart                 # typecheck the example
```

## Layers

- `domain.ts` — catalog, cart operations, and the pricing pipeline
  (per-line volume discount → promo code → shipping threshold → regional
  VAT). Pure functions over plain data.
- `store.ts` — immutable `State`, the `Intent` union, and the reducer. The
  transition rules live here: a cart is locked while its checkout is in
  flight, an empty cart cannot be checked out, a successful order clears the
  cart but keeps the region, backend activity is kept as a rolling window.
- `services.ts` — the backend as Observables: `checkStock`, `reserve`,
  `release`, `authorizePayment`, each answering after a latency via `timer`,
  with scripted transient failures so demos and tests are deterministic, and
  an `activity` stream narrating what the backend sees.
- `view.ts` — pure `(state, quote, alerts) -> string`.
- `app.ts` — the reactive wiring (below).
- `main.ts` — scripted demo and interactive CLI.
- `cart.test.mjs` — unit tests for the rules, and `TestScheduler` marble
  tests for the async flows.

## The wiring

```text
intents ──► scan(reduce) ──► startWith ──► shareReplay(1) ──► state
                ▲
                │   state ──► map(cart) ──► distinctUntilChanged ──► map(priceCart) ──► shareReplay(1) ──► quote
                │
                │   state ──► map(lines) ──► distinctUntilChanged(sameLines) ──► debounceTime
                │         ──► switchMap(forkJoin(checkStock ∘ retry ∘ catchError)) ──► startWith([]) ──► stockAlerts
                │
                │   state ──► distinctUntilChanged(by checkout) ──► filter(requested)
                │         ──► withLatestFrom(quote) ──► exhaustMap(runCheckout) ──┐
                │                                                                  │
                └──── observeOn(asap) ◄── progress / succeeded / failed intents ◄───┘
                └──── observeOn(asap) ◄── backend.activity ──► map(activity intent)

merge(state, stockAlerts) ──► withLatestFrom(state, quote, stockAlerts) ──► map(view) ──► distinctUntilChanged ──► frames
```

`runCheckout` is one Observable of intents:

```text
progress('reserving inventory')
reserve(lines)
  ├─ error ──────────────────────────────► failed(reason)            (cart survives)
  └─ reservation ─► progress('authorizing payment')
                    defer(authorizePayment)
                      ─► retry({ count, delay: n × backoff for transient errors })
                      ─► timeout({ first: deadline })
                      ├─ authorization ──► succeeded(order)
                      └─ error ──► release(reservation) ──► failed(reason)   (compensation)
```

## What it exercises

- **One pure fold as the state machine** (`scan`), with effects reporting
  back through the same intent hub — a Subject subscribed as an observer —
  including reentrant dispatch from synchronous effects.
- **Memoized derived state**: `quote` recomputes only when the cart changes
  (`distinctUntilChanged` on the cart reference) and replays to late
  subscribers (`shareReplay(1)`).
- **Debounce + cancel**: stock checks wait for the customer to stop editing
  (`debounceTime`), run in parallel (`forkJoin`), retry transient service
  failures with a delay (`retry` with a notifier), degrade to "stock unknown"
  instead of breaking the stream (`catchError`), and a newer edit cancels the
  in-flight check (`switchMap`) — the test proves the cancelled check never
  reached the backend.
- **State-triggered effects**: the checkout starts from a state *transition*
  (the reducer accepted it), not from the raw intent, so the rule "no
  checkout on an empty or locked cart" has exactly one home. `exhaustMap`
  additionally makes a double submit structurally impossible, and
  `withLatestFrom(quote)` charges exactly what the customer saw.
- **Retries, deadlines, compensation**: `retry` with linear back-off on
  transient errors only, `timeout` over the whole retried sequence, and
  `release` of the reservation before reporting a failure.
- **Glitch-free rendering**: instead of `combineLatest` (which would emit a
  frame with a stale quote between the state update and the quote update),
  frames *sample* the derived streams with `withLatestFrom`. The library's
  documented semantics — companions are subscribed before the source, a
  shared source broadcasts in subscription order — make this deterministic.
  The view also shows a stock advisory only while it still describes the
  current cart line, so an edit never leaves a stale warning behind.
- **Effects report on the next microtask** (`observeOn(asapScheduler)` on
  both feedback loops). A synchronous effect that dispatched straight back
  into the hub would re-enter it in the middle of a broadcast, and a frame
  could render an older state after a newer one. Inside `TestScheduler.run`
  the asap scheduler is virtual — an immediate at the same frame — so the
  marble tests stay exact and the ordering rule is tested, not hoped for.
- **Naming intermediate streams** (`cartLines`, `stockReports`,
  `checkoutRequests`) instead of one long pipe: `pipeValue` types up to four
  operators, which turns out to be a healthy limit for readable pipelines.
- **Marble tests of business flows**: the backend's latency, the debounce,
  and the retry back-off all ride the library's schedulers, so inside
  `TestScheduler.run` the whole checkout — reservation, a failed attempt, a
  100ms back-off, the second attempt, the booked order — is asserted to the
  millisecond and runs instantly. The deadline test shows compensation
  firing at exactly the predicted frame.
