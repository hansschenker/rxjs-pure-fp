/**
 * Domain layer: catalog, cart, and pricing rules. Plain data and pure
 * functions — nothing in this file knows that Observables exist, which is
 * exactly why every rule here is trivially unit-testable.
 */

export type Cents = number;
export type Sku = string;
export type Region = 'CH' | 'DE' | 'US';
export type Category = 'coffee' | 'gear' | 'books';

export type Product = {
  readonly sku: Sku;
  readonly name: string;
  readonly unitPrice: Cents;
  readonly category: Category;
};

export type CartLine = {
  readonly sku: Sku;
  readonly quantity: number;
};

export type Promo =
  | { readonly code: string; readonly kind: 'percent'; readonly percent: number }
  | { readonly code: string; readonly kind: 'freeShipping' };

export type Cart = {
  readonly lines: ReadonlyArray<CartLine>;
  readonly promo: Promo | null;
  readonly region: Region;
};

export const catalog: ReadonlyArray<Product> = [
  { sku: 'yirg-250', name: 'Ethiopian Yirgacheffe 250g', unitPrice: 1250, category: 'coffee' },
  { sku: 'brazil-1k', name: 'Brazil Cerrado 1kg', unitPrice: 2890, category: 'coffee' },
  { sku: 'v60-02', name: 'Hario V60 dripper', unitPrice: 2400, category: 'gear' },
  { sku: 'filters', name: 'Filter papers (100)', unitPrice: 400, category: 'gear' },
  { sku: 'grinder', name: 'Hand grinder', unitPrice: 8900, category: 'gear' },
  { sku: 'atlas', name: 'The World Atlas of Coffee', unitPrice: 3200, category: 'books' },
];

export const findProduct = (sku: Sku): Product | undefined => catalog.find((product) => product.sku === sku);

export const promoCodes: Readonly<Record<string, Promo>> = {
  WELCOME10: { code: 'WELCOME10', kind: 'percent', percent: 10 },
  SHIPFREE: { code: 'SHIPFREE', kind: 'freeShipping' },
};

export const emptyCart: Cart = { lines: [], promo: null, region: 'CH' };

// --- Cart operations (all return a new cart) --------------------------------

export const removeLine = (cart: Cart, sku: Sku): Cart => ({
  ...cart,
  lines: cart.lines.filter((line) => line.sku !== sku),
});

export const setLineQuantity = (cart: Cart, sku: Sku, quantity: number): Cart =>
  quantity <= 0
    ? removeLine(cart, sku)
    : { ...cart, lines: cart.lines.map((line) => (line.sku === sku ? { sku, quantity } : line)) };

export const addLine = (cart: Cart, sku: Sku, quantity: number): Cart => {
  const existing = cart.lines.find((line) => line.sku === sku);
  return existing
    ? setLineQuantity(cart, sku, existing.quantity + quantity)
    : { ...cart, lines: [...cart.lines, { sku, quantity }] };
};

/** Structural equality of cart lines — the key `distinctUntilChanged` uses to skip redundant stock checks. */
export const sameLines = (a: ReadonlyArray<CartLine>, b: ReadonlyArray<CartLine>): boolean =>
  a.length === b.length &&
  a.every((line, index) => line.sku === b[index]?.sku && line.quantity === b[index]?.quantity);

// --- Pricing rules ------------------------------------------------------------

export const VOLUME_THRESHOLD = 3;
export const VOLUME_DISCOUNT_PERCENT = 10;
export const SHIPPING_FLAT: Cents = 700;
export const FREE_SHIPPING_FROM: Cents = 5000;

export const taxRates: Readonly<Record<Region, number>> = { CH: 0.081, DE: 0.19, US: 0 };

export type QuoteLine = {
  readonly sku: Sku;
  readonly name: string;
  readonly quantity: number;
  readonly unitPrice: Cents;
  readonly gross: Cents;
  readonly volumeDiscount: Cents;
  readonly net: Cents;
};

export type Quote = {
  readonly lines: ReadonlyArray<QuoteLine>;
  readonly subtotal: Cents;
  readonly promoDiscount: Cents;
  readonly shipping: Cents;
  readonly taxRate: number;
  readonly tax: Cents;
  readonly total: Cents;
  readonly notes: ReadonlyArray<string>;
};

const percentOf = (amount: Cents, percent: number): Cents => Math.round((amount * percent) / 100);

/**
 * The pricing pipeline, in business order: per-line volume discounts, then
 * the promo on the subtotal, then shipping (free above a threshold or with
 * the right promo), then VAT on the goods for the customer's region.
 */
export const priceCart = (cart: Cart): Quote => {
  const lines = cart.lines.flatMap((line): QuoteLine[] => {
    const product = findProduct(line.sku);
    if (!product) {
      return [];
    }
    const gross = product.unitPrice * line.quantity;
    const volumeDiscount = line.quantity >= VOLUME_THRESHOLD ? percentOf(gross, VOLUME_DISCOUNT_PERCENT) : 0;
    return [
      {
        sku: product.sku,
        name: product.name,
        quantity: line.quantity,
        unitPrice: product.unitPrice,
        gross,
        volumeDiscount,
        net: gross - volumeDiscount,
      },
    ];
  });

  const subtotal = lines.reduce((sum, line) => sum + line.net, 0);
  const promoDiscount = cart.promo?.kind === 'percent' ? percentOf(subtotal, cart.promo.percent) : 0;
  const goods = subtotal - promoDiscount;
  const freeShipping = lines.length === 0 || cart.promo?.kind === 'freeShipping' || goods >= FREE_SHIPPING_FROM;
  const shipping = freeShipping ? 0 : SHIPPING_FLAT;
  const taxRate = taxRates[cart.region];
  const tax = Math.round(goods * taxRate);

  const notes: string[] = [];
  if (!freeShipping) {
    notes.push(`add ${formatMoney(FREE_SHIPPING_FROM - goods)} more for free shipping`);
  }

  return { lines, subtotal, promoDiscount, shipping, taxRate, tax, total: goods + shipping + tax, notes };
};

export const formatMoney = (cents: Cents): string => `CHF ${(cents / 100).toFixed(2)}`;
