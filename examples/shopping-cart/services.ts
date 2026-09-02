import { createSubject, defer, map, pipeValue, timer } from '../../src/index.ts';
import type { ObservableLike as Observable } from '../../src/index.ts';
import { formatMoney, type CartLine, type Cents, type Sku } from './domain.ts';

/**
 * Services layer: a simulated inventory and payment backend. Every call is an
 * Observable that answers after a latency, so the application code treats it
 * exactly like a remote service — including transient failures, which are
 * scripted so demos and tests are deterministic. An activity stream narrates
 * what the backend sees, for the UI's activity panel.
 */

export type StockLevel = { readonly sku: Sku; readonly available: number };

export type Reservation = { readonly id: string; readonly lines: ReadonlyArray<CartLine> };

export type PaymentAuthorization = { readonly authorizationId: string; readonly amount: Cents };

export type Backend = {
  readonly activity: Observable<string>;
  readonly checkStock: (sku: Sku) => Observable<StockLevel>;
  readonly reserve: (lines: ReadonlyArray<CartLine>) => Observable<Reservation>;
  readonly release: (reservation: Reservation) => Observable<void>;
  readonly authorizePayment: (amount: Cents) => Observable<PaymentAuthorization>;
};

export type BackendOptions = {
  /** Milliseconds every call takes to answer. */
  readonly latency?: number;
  /** How many stock checks fail with a transient error before the service recovers. */
  readonly transientStockFailures?: number;
  /** How many payment authorizations fail with a transient error before the gateway recovers. */
  readonly transientPaymentFailures?: number;
  readonly inventory?: Readonly<Record<Sku, number>>;
};

export const defaultInventory: Readonly<Record<Sku, number>> = {
  'yirg-250': 12,
  'brazil-1k': 5,
  'v60-02': 3,
  filters: 40,
  grinder: 2,
  atlas: 1,
};

/** Transient errors are worth retrying; anything else is a business refusal. */
export const isTransient = (error: unknown): boolean =>
  error instanceof Error && (error as { readonly transient?: boolean }).transient === true;

const transientError = (message: string): Error => Object.assign(new Error(message), { transient: true });

export const createBackend = (options: BackendOptions = {}): Backend => {
  const latency = options.latency ?? 40;
  const inventory = new Map<Sku, number>(Object.entries(options.inventory ?? defaultInventory));
  let stockFailuresLeft = options.transientStockFailures ?? 0;
  let paymentFailuresLeft = options.transientPaymentFailures ?? 0;
  let sequence = 0;

  const activity = createSubject<string>();
  const log = (message: string): void => activity.next(message);

  /** One backend call: narrated on subscription, answered (or thrown) after the latency. */
  const respond = <T>(describe: string, produce: () => T): Observable<T> =>
    defer(() => {
      log(`→ ${describe}`);
      return pipeValue(
        timer(latency),
        map(() => produce())
      );
    });

  return {
    activity,

    checkStock: (sku) =>
      respond(`stock check ${sku}`, () => {
        if (stockFailuresLeft > 0) {
          stockFailuresLeft -= 1;
          log('✗ stock service: connection reset');
          throw transientError('stock service unavailable');
        }
        const available = inventory.get(sku) ?? 0;
        log(`✓ ${sku}: ${available} available`);
        return { sku, available };
      }),

    reserve: (lines) =>
      respond('reserve inventory', () => {
        for (const line of lines) {
          const available = inventory.get(line.sku) ?? 0;
          if (available < line.quantity) {
            log(`✗ ${line.sku}: ${line.quantity} requested, ${available} available`);
            throw new Error(`insufficient stock for ${line.sku} (${available} available)`);
          }
        }
        for (const line of lines) {
          inventory.set(line.sku, (inventory.get(line.sku) ?? 0) - line.quantity);
        }
        sequence += 1;
        const reservation = { id: `R${sequence}`, lines };
        log(`✓ reserved ${reservation.id}`);
        return reservation;
      }),

    release: (reservation) =>
      respond(`release ${reservation.id}`, () => {
        for (const line of reservation.lines) {
          inventory.set(line.sku, (inventory.get(line.sku) ?? 0) + line.quantity);
        }
        log(`✓ released ${reservation.id}`);
      }),

    authorizePayment: (amount) =>
      respond(`authorize ${formatMoney(amount)}`, () => {
        if (paymentFailuresLeft > 0) {
          paymentFailuresLeft -= 1;
          log('✗ payment gateway: timeout');
          throw transientError('payment gateway timeout');
        }
        sequence += 1;
        log(`✓ payment authorized (AUTH${sequence})`);
        return { authorizationId: `AUTH${sequence}`, amount };
      }),
  };
};
