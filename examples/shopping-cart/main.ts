import { createInterface } from 'node:readline';
import { filter, firstValueFrom, pipeValue, subscribe, timer } from '../../src/index.ts';
import { createCartApp } from './app.ts';
import { catalog, formatMoney, type Region } from './domain.ts';
import { createBackend } from './services.ts';
import type { Intent } from './store.ts';

type Command = Intent | 'help' | 'catalog' | 'quit' | { readonly unknown: string };

const HELP = `commands:
  add <sku> [qty]      add a product (see "catalog")
  qty <sku> <n>        set a line's quantity (0 removes it)
  rm <sku>             remove a line
  promo <code>|off     apply WELCOME10 / SHIPFREE, or remove the promo
  region CH|DE|US      set the shipping region (VAT rate)
  checkout             reserve inventory and authorize payment
  catalog  help  quit`;

const parse = (line: string): Command => {
  const [word = '', ...rest] = line.trim().split(/\s+/);
  const sku = rest[0] ?? '';
  const amount = Number(rest[1]);
  switch (word) {
    case 'add':
      return { kind: 'addItem', sku, quantity: Number.isFinite(amount) && amount > 0 ? amount : 1 };
    case 'qty':
      return { kind: 'setQuantity', sku, quantity: Number.isFinite(amount) ? amount : 0 };
    case 'rm':
      return { kind: 'removeItem', sku };
    case 'promo':
      return sku.toLowerCase() === 'off' ? { kind: 'clearPromo' } : { kind: 'applyPromo', code: sku };
    case 'region':
      return ['CH', 'DE', 'US'].includes(sku.toUpperCase())
        ? { kind: 'setRegion', region: sku.toUpperCase() as Region }
        : { unknown: line };
    case 'checkout':
      return { kind: 'checkout' };
    case 'catalog':
    case 'help':
    case 'quit':
      return word;
    default:
      return { unknown: line };
  }
};

const catalogText = (): string =>
  catalog.map((product) => `  ${product.sku.padEnd(10)} ${product.name.padEnd(28)} ${formatMoney(product.unitPrice)}`).join('\n');

// A demo backend: 40ms latency, the first payment attempt fails transiently,
// and two products are nearly sold out so stock alerts and reservation
// failures have something to show.
const backend = createBackend({
  latency: 40,
  transientPaymentFailures: 1,
  inventory: { 'yirg-250': 12, 'brazil-1k': 1, 'v60-02': 3, filters: 1, grinder: 2, atlas: 1 },
});

const app = createCartApp(backend, { stockDebounce: 120, retryBackoff: 60 });

subscribe({ next: (frame) => process.stdout.write(`${frame}\n\n`) })(app.frames);

const feed = (line: string): boolean => {
  const command = parse(line);
  if (command === 'quit') {
    app.complete();
    return false;
  }
  if (command === 'help') {
    process.stdout.write(`${HELP}\n\n`);
  } else if (command === 'catalog') {
    process.stdout.write(`${catalogText()}\n\n`);
  } else if ('unknown' in command) {
    process.stdout.write(`unknown command: ${command.unknown}\n\n`);
  } else {
    app.dispatch(command);
  }
  return true;
};

/** Resolves once no checkout is in flight (immediately if none was accepted). */
const settled = (): Promise<unknown> =>
  firstValueFrom(pipeValue(app.state, filter((state) => state.checkout.kind !== 'inProgress')));

const pause = (ms: number): Promise<unknown> => firstValueFrom(timer(ms));

const say = (line: string): void => {
  process.stdout.write(`> ${line}\n`);
  feed(line);
};

const demo = async (): Promise<void> => {
  say('add yirg-250 2');
  say('add filters 3'); // only 1 in stock: a stock alert appears after the debounce
  await pause(250);
  say('qty filters 1'); // the alert clears
  await pause(250);
  say('promo WELCOME10');
  say('region DE'); // 19% VAT
  say('region CH');
  say('add grinder 1'); // crosses the free-shipping threshold
  await pause(250);
  say('checkout');
  say('checkout'); // refused: the cart is locked while the first checkout runs
  await settled(); // first payment attempt fails transiently, the retry succeeds
  say('add brazil-1k 2'); // only 1 in stock
  await pause(250);
  say('checkout'); // the reservation fails: the order is refused, the cart survives
  await settled();
  say('qty brazil-1k 1');
  await pause(250);
  say('checkout');
  await settled();
  say('quit');
};

if (process.argv.includes('--demo')) {
  await demo();
} else {
  process.stdout.write(`shopping-cart — type "help" for commands, "quit" to exit\n\n${catalogText()}\n\n`);
  const terminal = createInterface({ input: process.stdin });
  terminal.on('line', (line) => {
    if (!feed(line)) {
      terminal.close();
    }
  });
  terminal.on('close', () => app.complete());
}
