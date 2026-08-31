import { createInterface } from 'node:readline';
import { runApp } from './app.ts';
import type { Filter, Msg } from './model.ts';

const parse = (line: string): Msg | 'quit' => {
  const input = line.trim();
  const [word = '', ...rest] = input.split(/\s+/);
  const restText = rest.join(' ');
  const id = Number(rest[0]);

  switch (word) {
    case 'add':
      return { kind: 'add', title: restText };
    case 'edit':
      return { kind: 'retitle', id, title: rest.slice(1).join(' ') };
    case 'toggle':
      return { kind: 'toggle', id };
    case 'rm':
      return { kind: 'remove', id };
    case 'clear':
      return { kind: 'clearDone' };
    case 'ls': {
      const filter = (rest[0] ?? 'all') as Filter;
      return ['all', 'open', 'done'].includes(filter)
        ? { kind: 'setFilter', filter }
        : { kind: 'unknown', input };
    }
    case 'help':
      return { kind: 'help' };
    case 'quit':
      return 'quit';
    default:
      return { kind: 'unknown', input };
  }
};

const app = runApp((frame) => {
  process.stdout.write(`${frame}\n\n`);
});

const feed = (line: string): boolean => {
  const msg = parse(line);
  if (msg === 'quit') {
    app.complete();
    return false;
  }
  app.dispatch(msg);
  return true;
};

if (process.argv.includes('--demo')) {
  const script = [
    'add Buy oat milk',
    'add Write an MVU app on rxjs-pure-fp',
    'add Ship Session 3',
    'toggle 2',
    'edit 1 Buy oat milk (barista edition)',
    'ls open',
    'ls open', // same filter: same model reference, render skipped
    'ls done',
    'rm 3',
    'ls all',
    'clear',
    'nonsense',
    'quit',
  ];
  for (const line of script) {
    process.stdout.write(`> ${line}\n`);
    if (!feed(line)) break;
  }
} else {
  process.stdout.write('todo-mvu — type "help" for commands, "quit" to exit\n\n');
  const terminal = createInterface({ input: process.stdin });
  terminal.on('line', (line) => {
    if (!feed(line)) {
      terminal.close();
    }
  });
  terminal.on('close', () => app.complete());
}
