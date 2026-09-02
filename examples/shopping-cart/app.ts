import {
  asapScheduler,
  catchError,
  concat,
  createSubject,
  debounceTime,
  defer,
  distinctUntilChanged,
  exhaustMap,
  filter,
  forkJoin,
  ignoreElements,
  map,
  merge,
  mergeMap,
  observeOn,
  of,
  pipeValue,
  retry,
  scan,
  shareReplay,
  startWith,
  subscribe,
  switchMap,
  throwError,
  timeout,
  timer,
  withLatestFrom,
} from '../../src/index.ts';
import type { ObservableLike as Observable } from '../../src/index.ts';
import { findProduct, priceCart, sameLines, type Cart, type CartLine, type Quote, type Sku } from './domain.ts';
import { isTransient, type Backend } from './services.ts';
import { initialState, reduce, type Intent, type State } from './store.ts';
import { view } from './view.ts';

/**
 * Application layer: the reactive wiring. Everything below is built from
 * the library's public surface; there is no framework and no runtime class.
 *
 *   intents ──► scan(reduce) ──► state ──┬──► quote (memoized pricing)
 *                 ▲                       ├──► stock alerts (debounced, cancellable checks)
 *                 │                       ├──► checkout requests ──► exhaustMap(runCheckout) ──┐
 *                 │                       └──► frames (glitch-free view model)                  │
 *                 └──────────── progress / success / failure / backend activity ◄───────────────┘
 */

export type StockAlert = {
  readonly sku: Sku;
  readonly name: string;
  readonly requested: number;
  /** `null` when the stock service could not answer even after retries. */
  readonly available: number | null;
};

export type CartAppOptions = {
  /** Quiet period after a cart edit before stock is checked (ms). */
  readonly stockDebounce?: number;
  /** Retries for a transiently failing payment authorization. */
  readonly paymentRetries?: number;
  /** Base back-off between retries (ms); attempt n waits n × backoff. */
  readonly retryBackoff?: number;
  /** Deadline for the whole authorization, retries included (ms). */
  readonly paymentDeadline?: number;
};

export type CartApp = {
  readonly dispatch: (intent: Intent) => void;
  readonly complete: () => void;
  readonly state: Observable<State>;
  readonly quote: Observable<Quote>;
  readonly stockAlerts: Observable<ReadonlyArray<StockAlert>>;
  readonly frames: Observable<string>;
};

const progress = (step: string): Intent => ({ kind: 'checkoutProgress', step });

const failed = (error: unknown): Intent => ({
  kind: 'checkoutFailed',
  reason:
    error instanceof Error
      ? error.name === 'TimeoutError'
        ? 'payment gateway did not answer in time'
        : error.message
      : String(error),
});

export const createCartApp = (backend: Backend, options: CartAppOptions = {}): CartApp => {
  const { stockDebounce = 150, paymentRetries = 2, retryBackoff = 80, paymentDeadline = 2000 } = options;

  const intents = createSubject<Intent>();

  // State: one pure fold over every intent, shared and replayed so late
  // subscribers (and `withLatestFrom`) see the current state immediately.
  const state: Observable<State> = pipeValue(
    intents,
    scan(reduce, initialState),
    startWith(initialState),
    shareReplay<State>(1)
  );

  // Quote: derived from the cart only, recomputed only when the cart changes.
  const quote: Observable<Quote> = pipeValue(
    state,
    map((snapshot) => snapshot.cart),
    distinctUntilChanged<Cart>(),
    map(priceCart),
    shareReplay<Quote>(1)
  );

  // Stock advisories: wait for the customer to stop editing, then check every
  // line in parallel; a newer edit cancels an in-flight check (switchMap), a
  // transient service failure is retried, a persistent one degrades to
  // "stock unknown" rather than breaking the stream.
  const checkLine = (line: CartLine): Observable<StockAlert> => {
    const name = findProduct(line.sku)?.name ?? line.sku;
    const unknownStock: StockAlert = { sku: line.sku, name, requested: line.quantity, available: null };
    const level = pipeValue(
      backend.checkStock(line.sku),
      retry({ count: 2, delay: (error) => (isTransient(error) ? timer(retryBackoff) : throwError(() => error)) })
    );
    return pipeValue(
      level,
      map((stock): StockAlert => ({ sku: line.sku, name, requested: line.quantity, available: stock.available })),
      catchError(() => of(unknownStock))
    );
  };

  const cartLines = pipeValue(
    state,
    map((snapshot) => snapshot.cart.lines),
    distinctUntilChanged(sameLines)
  );

  const stockReports = pipeValue(
    cartLines,
    debounceTime(stockDebounce),
    switchMap((lines) => (lines.length === 0 ? of([] as StockAlert[]) : forkJoin(lines.map(checkLine)))),
    map((reports) => reports.filter((report) => report.available === null || report.available < report.requested))
  );

  const stockAlerts: Observable<ReadonlyArray<StockAlert>> = pipeValue(
    stockReports,
    startWith<StockAlert[], StockAlert[]>([]),
    shareReplay<StockAlert[]>(1)
  );

  // Checkout: reserve inventory, then authorize payment with back-off retries
  // under a deadline; a payment failure releases the reservation
  // (compensation) before reporting. Every step reports back as an intent.
  const runCheckout = (cart: Cart, currentQuote: Quote): Observable<Intent> => {
    const authorize = (reservationId: string): Observable<Intent> => {
      const authorization = pipeValue(
        defer(() => backend.authorizePayment(currentQuote.total)),
        retry({
          count: paymentRetries,
          delay: (error, retryCount) =>
            isTransient(error) ? timer(retryCount * retryBackoff) : throwError(() => error),
        }),
        timeout({ first: paymentDeadline })
      );
      return pipeValue(
        authorization,
        map(
          (auth): Intent => ({
            kind: 'checkoutSucceeded',
            order: {
              id: `ORD-${reservationId}`,
              lines: cart.lines,
              total: currentQuote.total,
              authorizationId: auth.authorizationId,
            },
          })
        )
      );
    };

    const reserved = pipeValue(
      backend.reserve(cart.lines),
      mergeMap((reservation) =>
        concat(
          of(progress('authorizing payment')),
          pipeValue(
            authorize(reservation.id),
            catchError((error) =>
              concat(pipeValue(backend.release(reservation), ignoreElements()), of(failed(error)))
            )
          )
        )
      ),
      catchError((error) => of(failed(error)))
    );

    return concat(of(progress('reserving inventory')), reserved);
  };

  // The trigger is a state transition, not the raw intent: a checkout runs
  // only when the reducer accepted it. `exhaustMap` makes double submits
  // structurally impossible even if the reducer rule were relaxed, and
  // `withLatestFrom(quote)` charges exactly the quote the customer saw.
  const checkoutRequests = pipeValue(
    state,
    distinctUntilChanged<State>((previous, current) => previous.checkout === current.checkout),
    filter((snapshot) => snapshot.checkout.kind === 'inProgress' && snapshot.checkout.step === 'requested')
  );

  const checkouts: Observable<Intent> = pipeValue(
    checkoutRequests,
    withLatestFrom(quote),
    exhaustMap(([snapshot, currentQuote]) => runCheckout(snapshot.cart, currentQuote as Quote))
  );

  // Feedback loops: the intent hub subscribed as an observer. Effects report
  // on the next microtask (`observeOn(asapScheduler)`), so a synchronous
  // effect never re-enters the hub in the middle of a broadcast and frames
  // are never rendered out of order. Inside `TestScheduler.run` asap is
  // virtual, so this costs the marble tests nothing.
  subscribe(intents)(pipeValue(checkouts, observeOn(asapScheduler)));
  subscribe(intents)(
    pipeValue(
      backend.activity,
      map((message): Intent => ({ kind: 'activity', message })),
      observeOn(asapScheduler)
    )
  );

  // Frames: sample every derived stream whenever state or alerts change.
  // `quote` derives synchronously from `state` and is subscribed as a
  // companion before the trigger, so a frame never shows a stale quote.
  const frames: Observable<string> = pipeValue(
    merge<unknown>(state, stockAlerts),
    withLatestFrom<unknown, State | Quote | ReadonlyArray<StockAlert>>(state, quote, stockAlerts),
    map(([, snapshot, currentQuote, alerts]) =>
      view(snapshot as State, currentQuote as Quote, alerts as ReadonlyArray<StockAlert>)
    ),
    distinctUntilChanged<string>()
  );

  return {
    dispatch: (intent) => intents.next(intent),
    complete: () => intents.complete(),
    state,
    quote,
    stockAlerts,
    frames,
  };
};
