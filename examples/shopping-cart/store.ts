import {
  addLine,
  emptyCart,
  findProduct,
  formatMoney,
  promoCodes,
  removeLine,
  setLineQuantity,
  type Cart,
  type CartLine,
  type Cents,
  type Region,
  type Sku,
} from './domain.ts';

/**
 * Store layer: the immutable application state, the intent union, and one
 * pure reducer. Business rules that concern *state transitions* live here
 * (a cart is locked while its checkout is in flight, an empty cart cannot be
 * checked out, a successful order clears the cart but keeps the region).
 */

export type CheckoutPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'inProgress'; readonly step: string }
  | { readonly kind: 'succeeded'; readonly orderId: string; readonly total: Cents }
  | { readonly kind: 'failed'; readonly reason: string };

export type Order = {
  readonly id: string;
  readonly lines: ReadonlyArray<CartLine>;
  readonly total: Cents;
  readonly authorizationId: string;
};

export type State = {
  readonly cart: Cart;
  readonly checkout: CheckoutPhase;
  readonly orders: ReadonlyArray<Order>;
  readonly activity: ReadonlyArray<string>;
  readonly notice: string;
};

export type Intent =
  | { readonly kind: 'addItem'; readonly sku: Sku; readonly quantity: number }
  | { readonly kind: 'setQuantity'; readonly sku: Sku; readonly quantity: number }
  | { readonly kind: 'removeItem'; readonly sku: Sku }
  | { readonly kind: 'applyPromo'; readonly code: string }
  | { readonly kind: 'clearPromo' }
  | { readonly kind: 'setRegion'; readonly region: Region }
  | { readonly kind: 'checkout' }
  | { readonly kind: 'checkoutProgress'; readonly step: string }
  | { readonly kind: 'checkoutSucceeded'; readonly order: Order }
  | { readonly kind: 'checkoutFailed'; readonly reason: string }
  | { readonly kind: 'activity'; readonly message: string };

export const initialState: State = {
  cart: emptyCart,
  checkout: { kind: 'idle' },
  orders: [],
  activity: [],
  notice: 'ready',
};

const ACTIVITY_WINDOW = 8;

const isLocked = (state: State): boolean => state.checkout.kind === 'inProgress';

/** Cart edits share one rule: refused while a checkout is in flight. */
const editCart = (state: State, edit: (cart: Cart) => Cart, notice: string): State =>
  isLocked(state)
    ? { ...state, notice: 'cart is locked while checkout is in progress' }
    : { ...state, cart: edit(state.cart), notice };

const withProduct = (state: State, sku: Sku, apply: (name: string) => State): State => {
  const product = findProduct(sku);
  return product ? apply(product.name) : { ...state, notice: `unknown sku "${sku}"` };
};

export const reduce = (state: State, intent: Intent): State => {
  switch (intent.kind) {
    case 'addItem':
      return withProduct(state, intent.sku, (name) =>
        editCart(state, (cart) => addLine(cart, intent.sku, intent.quantity), `added ${intent.quantity} × ${name}`)
      );
    case 'setQuantity':
      return withProduct(state, intent.sku, (name) =>
        editCart(
          state,
          (cart) => setLineQuantity(cart, intent.sku, intent.quantity),
          intent.quantity > 0 ? `${name}: quantity ${intent.quantity}` : `removed ${name}`
        )
      );
    case 'removeItem':
      return withProduct(state, intent.sku, (name) =>
        editCart(state, (cart) => removeLine(cart, intent.sku), `removed ${name}`)
      );
    case 'applyPromo': {
      const promo = promoCodes[intent.code.toUpperCase()];
      return promo
        ? editCart(state, (cart) => ({ ...cart, promo }), `promo ${promo.code} applied`)
        : { ...state, notice: `unknown promo code "${intent.code}"` };
    }
    case 'clearPromo':
      return editCart(state, (cart) => ({ ...cart, promo: null }), 'promo removed');
    case 'setRegion':
      return editCart(state, (cart) => ({ ...cart, region: intent.region }), `shipping to ${intent.region}`);
    case 'checkout':
      if (isLocked(state)) {
        return { ...state, notice: 'checkout already in progress' };
      }
      if (state.cart.lines.length === 0) {
        return { ...state, notice: 'cart is empty' };
      }
      return { ...state, checkout: { kind: 'inProgress', step: 'requested' }, notice: 'checkout started' };
    case 'checkoutProgress':
      return isLocked(state) ? { ...state, checkout: { kind: 'inProgress', step: intent.step } } : state;
    case 'checkoutSucceeded':
      return {
        ...state,
        cart: { ...emptyCart, region: state.cart.region },
        orders: [...state.orders, intent.order],
        checkout: { kind: 'succeeded', orderId: intent.order.id, total: intent.order.total },
        notice: `order ${intent.order.id} placed — ${formatMoney(intent.order.total)}`,
      };
    case 'checkoutFailed':
      return {
        ...state,
        checkout: { kind: 'failed', reason: intent.reason },
        notice: `checkout failed: ${intent.reason}`,
      };
    case 'activity':
      return { ...state, activity: [...state.activity, intent.message].slice(-ACTIVITY_WINDOW) };
  }
};
