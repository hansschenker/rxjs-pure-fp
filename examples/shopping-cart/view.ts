import { VOLUME_DISCOUNT_PERCENT, formatMoney, type Cents, type Quote } from './domain.ts';
import type { StockAlert } from './app.ts';
import type { State } from './store.ts';

/** View layer: a pure `(state, quote, alerts) -> string` render. */

const WIDTH = 60;

const money = (cents: Cents, width = 11): string => formatMoney(cents).padStart(width);

const row = (label: string, amount: Cents, negative = false): string =>
  `  ${label.padEnd(WIDTH - 12)}${negative ? `−${money(amount, 10)}` : money(amount)}`;

const percent = (rate: number): string => `${(rate * 100).toFixed(1)}%`;

const checkoutLine = (state: State): string | null => {
  switch (state.checkout.kind) {
    case 'idle':
      return null;
    case 'inProgress':
      return `  ⏳ checkout: ${state.checkout.step}`;
    case 'succeeded':
      return `  ✔ order ${state.checkout.orderId} placed (${formatMoney(state.checkout.total)})`;
    case 'failed':
      return `  ✖ checkout failed: ${state.checkout.reason}`;
  }
};

export const view = (state: State, quote: Quote, alerts: ReadonlyArray<StockAlert>): string => {
  const lines: string[] = [];
  const title = ` cart · ${state.cart.region} · VAT ${percent(quote.taxRate)} `;
  lines.push(`──${title}${'─'.repeat(Math.max(0, WIDTH - title.length))}`);

  if (quote.lines.length === 0) {
    lines.push('  (cart is empty)');
  }
  for (const line of quote.lines) {
    const label = `${line.quantity} × ${line.name}`.padEnd(WIDTH - 24);
    const volume = line.volumeDiscount > 0 ? `  −${VOLUME_DISCOUNT_PERCENT}% volume` : '';
    lines.push(`  ${label}${money(line.unitPrice, 10)} ${money(line.net)}${volume}`);
  }

  lines.push(`  ${'─'.repeat(WIDTH)}`);
  lines.push(row('Subtotal', quote.subtotal));
  if (state.cart.promo) {
    lines.push(
      state.cart.promo.kind === 'percent'
        ? row(`Promo ${state.cart.promo.code} (−${state.cart.promo.percent}%)`, quote.promoDiscount, true)
        : `  Promo ${state.cart.promo.code} (free shipping)`
    );
  }
  lines.push(row(quote.shipping === 0 ? 'Shipping (free)' : 'Shipping', quote.shipping));
  lines.push(row(`VAT ${percent(quote.taxRate)}`, quote.tax));
  lines.push(row('Total', quote.total));

  for (const note of quote.notes) {
    lines.push(`  ℹ ${note}`);
  }
  // An advisory is shown only while it still describes the current cart line;
  // after an edit the next check is pending and a stale one would mislead.
  const current = alerts.filter((alert) =>
    state.cart.lines.some((line) => line.sku === alert.sku && line.quantity === alert.requested)
  );
  for (const alert of current) {
    const availability = alert.available === null ? 'stock unknown' : `${alert.available} available`;
    lines.push(`  ⚠ ${alert.name}: ${alert.requested} requested, ${availability}`);
  }

  const checkout = checkoutLine(state);
  if (checkout) {
    lines.push(checkout);
  }
  if (state.orders.length > 0) {
    lines.push(`  orders: ${state.orders.map((order) => `${order.id} ${formatMoney(order.total)}`).join(', ')}`);
  }
  lines.push(`  » ${state.notice}`);
  if (state.activity.length > 0) {
    lines.push('  activity:');
    for (const entry of state.activity) {
      lines.push(`    ${entry}`);
    }
  }
  return lines.join('\n');
};
