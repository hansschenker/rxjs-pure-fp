import assert from 'node:assert/strict';
import test from 'node:test';

import { distinctUntilChanged, map, pipeValue, subscribe } from '../../src/index.ts';
import { TestScheduler } from '../../src/testing/index.ts';
import { createCartApp } from './app.ts';
import { addLine, emptyCart, priceCart, setLineQuantity } from './domain.ts';
import { createBackend } from './services.ts';
import { initialState, reduce } from './store.ts';

// --- Pure domain rules ------------------------------------------------------

test('pricing: volume discount, promo, shipping threshold, and regional VAT', () => {
  const twoBags = addLine(emptyCart, 'yirg-250', 2);
  assert.deepEqual(
    (({ subtotal, promoDiscount, shipping, tax, total }) => ({ subtotal, promoDiscount, shipping, tax, total }))(
      priceCart(twoBags)
    ),
    { subtotal: 2500, promoDiscount: 0, shipping: 700, tax: 203, total: 3403 }
  );

  const threeBags = setLineQuantity(twoBags, 'yirg-250', 3);
  assert.equal(priceCart(threeBags).lines[0].volumeDiscount, 375, '10% off a line of three');

  const promo = { ...threeBags, promo: { code: 'WELCOME10', kind: 'percent', percent: 10 } };
  assert.equal(priceCart(promo).promoDiscount, 338, '10% of the discounted subtotal 3375');

  const bigOrder = addLine(twoBags, 'grinder', 1);
  assert.equal(priceCart(bigOrder).shipping, 0, 'free shipping above CHF 50');
  assert.deepEqual(priceCart(bigOrder).notes, []);
  assert.equal(priceCart(twoBags).notes[0], 'add CHF 25.00 more for free shipping');

  assert.equal(priceCart({ ...twoBags, region: 'DE' }).tax, 475, '19% VAT');
  assert.equal(priceCart({ ...twoBags, region: 'US' }).tax, 0);
  assert.equal(priceCart(emptyCart).total, 0, 'an empty cart costs nothing, not even shipping');
});

test('reducer: cart lock during checkout, empty-cart refusal, order booking', () => {
  const withItem = reduce(initialState, { kind: 'addItem', sku: 'atlas', quantity: 1 });
  assert.equal(withItem.notice, 'added 1 × The World Atlas of Coffee');
  assert.equal(reduce(initialState, { kind: 'checkout' }).notice, 'cart is empty');
  assert.equal(reduce(initialState, { kind: 'addItem', sku: 'nope', quantity: 1 }).notice, 'unknown sku "nope"');

  const requested = reduce(withItem, { kind: 'checkout' });
  assert.deepEqual(requested.checkout, { kind: 'inProgress', step: 'requested' });
  const locked = reduce(requested, { kind: 'addItem', sku: 'filters', quantity: 1 });
  assert.equal(locked.cart, requested.cart, 'no cart edits while a checkout is in flight');
  assert.equal(locked.notice, 'cart is locked while checkout is in progress');
  assert.equal(reduce(requested, { kind: 'checkout' }).notice, 'checkout already in progress');

  const order = { id: 'ORD-R1', lines: requested.cart.lines, total: 3459, authorizationId: 'AUTH2' };
  const done = reduce({ ...requested, cart: { ...requested.cart, region: 'DE' } }, { kind: 'checkoutSucceeded', order });
  assert.deepEqual(done.cart, { ...emptyCart, region: 'DE' }, 'the cart empties but keeps the region');
  assert.deepEqual(done.orders, [order]);
  assert.deepEqual(done.checkout, { kind: 'succeeded', orderId: 'ORD-R1', total: 3459 });
});

// --- Reactive flows, in virtual time -------------------------------------------
//
// The backend answers through `timer`, the app debounces through
// `debounceTime`, retries back off through `timer`: inside `run` every one of
// those is virtual, so these tests are exact to the millisecond and finish
// instantly.

const marbles = () => TestScheduler((actual, expected) => assert.deepEqual(actual, expected));

test('stock alerts: edits are debounced and an in-flight check is cancelled by a newer edit', () => {
  const stockChecks = [];
  marbles().run(({ cold, expectObservable }) => {
    const backend = createBackend({ latency: 50, inventory: { filters: 1 } });
    subscribe((message) => {
      if (message.startsWith('→ stock check')) stockChecks.push(message);
    })(backend.activity);
    const app = createCartApp(backend, { stockDebounce: 100 });

    expectObservable(app.stockAlerts).toBe('e 179ms a 199ms e', {
      e: [],
      a: [{ sku: 'filters', name: 'Filter papers (100)', requested: 2, available: 1 }],
    });

    // Three edits: the second lands inside the debounce window and restarts
    // it; the third arrives after the first check answered.
    subscribe((intent) => app.dispatch(intent))(
      cold('a 29ms b 199ms c|', {
        a: { kind: 'addItem', sku: 'filters', quantity: 3 },
        b: { kind: 'setQuantity', sku: 'filters', quantity: 2 },
        c: { kind: 'setQuantity', sku: 'filters', quantity: 1 },
      })
    );
  });
  assert.equal(stockChecks.length, 2, 'the first edit never reached the backend');
});

test('checkout: reservation, a transient payment failure, back-off, and the booked order', () => {
  const activity = [];
  let orders = [];
  marbles().run(({ cold, expectObservable }) => {
    const backend = createBackend({ latency: 50, transientPaymentFailures: 1 });
    subscribe((message) => activity.push(message))(backend.activity);
    const app = createCartApp(backend, { paymentRetries: 2, retryBackoff: 100, stockDebounce: 1000 });

    const phases = pipeValue(
      app.state,
      map((state) => (state.checkout.kind === 'inProgress' ? state.checkout.step : state.checkout.kind)),
      distinctUntilChanged()
    );
    expectObservable(phases).toBe('(abc) 45ms d 199ms e', {
      a: 'idle',
      b: 'requested',
      c: 'reserving inventory',
      d: 'authorizing payment',
      e: 'succeeded',
    });
    subscribe((state) => {
      orders = state.orders;
    })(app.state);

    // Intents ride a cold marble so they land at frame 0 *after* the
    // expectation above has subscribed and seen the initial state.
    subscribe((intent) => app.dispatch(intent))(
      cold('(ab|)', { a: { kind: 'addItem', sku: 'yirg-250', quantity: 2 }, b: { kind: 'checkout' } })
    );
  });
  assert.deepEqual(
    activity.filter((line) => line.startsWith('→ authorize')),
    ['→ authorize CHF 34.03', '→ authorize CHF 34.03'],
    'one retry after the transient failure'
  );
  assert.equal(orders.length, 1);
  assert.equal(orders[0].total, 3403);
});

test('checkout: an insufficient reservation refuses the order and leaves the cart intact', () => {
  let last;
  marbles().run(({ cold, expectObservable }) => {
    const backend = createBackend({ latency: 50, inventory: { 'brazil-1k': 1 } });
    const app = createCartApp(backend, { stockDebounce: 1000 });
    const phases = pipeValue(
      app.state,
      map((state) => state.checkout.kind),
      distinctUntilChanged()
    );
    expectObservable(phases).toBe('(ab) 46ms c', { a: 'idle', b: 'inProgress', c: 'failed' });
    subscribe((state) => {
      last = state;
    })(app.state);
    subscribe((intent) => app.dispatch(intent))(
      cold('(ab|)', { a: { kind: 'addItem', sku: 'brazil-1k', quantity: 2 }, b: { kind: 'checkout' } })
    );
  });
  assert.equal(last.checkout.reason, 'insufficient stock for brazil-1k (1 available)');
  assert.deepEqual(last.cart.lines, [{ sku: 'brazil-1k', quantity: 2 }]);
  assert.deepEqual(last.orders, []);
});

test('checkout: a payment that never authorizes in time releases the reservation', () => {
  const activity = [];
  marbles().run(({ cold, expectObservable }) => {
    const backend = createBackend({ latency: 50, transientPaymentFailures: 5 });
    subscribe((message) => activity.push(message))(backend.activity);
    const app = createCartApp(backend, {
      paymentRetries: 5,
      retryBackoff: 100,
      paymentDeadline: 400,
      stockDebounce: 1000,
    });
    const outcome = pipeValue(
      app.state,
      map((state) => (state.checkout.kind === 'failed' ? state.checkout.reason : state.checkout.kind)),
      distinctUntilChanged()
    );
    // reserve 0-50, attempt 1 at 50-100 fails, back-off 100, attempt 2 at 200-250 fails,
    // back-off 200 → the 400ms deadline (from 50) fires at 450, the release answers at 500.
    expectObservable(outcome).toBe('(ab) 496ms c', {
      a: 'idle',
      b: 'inProgress',
      c: 'payment gateway did not answer in time',
    });
    subscribe((intent) => app.dispatch(intent))(
      cold('(ab|)', { a: { kind: 'addItem', sku: 'atlas', quantity: 1 }, b: { kind: 'checkout' } })
    );
  });
  assert.deepEqual(activity.slice(-2), ['→ release R1', '✓ released R1'], 'compensation ran after the deadline');
});
