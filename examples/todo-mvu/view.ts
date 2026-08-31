import type { Model, Todo } from './model.ts';

/**
 * MVU View layer: a pure function Model -> string. Rendering the string is
 * the runtime's job (a `tap`-like subscriber), never the view's.
 */
export const view = (model: Model): string => {
  const visible = model.todos.filter(matches(model.filter));
  const open = model.todos.filter((todo) => !todo.done).length;

  const lines = visible.length === 0
    ? [`  (no ${model.filter === 'all' ? '' : `${model.filter} `}todos)`]
    : visible.map((todo) => `  ${todo.done ? '[x]' : '[ ]'} #${todo.id} ${todo.title}`);

  return [
    `── todos (${model.filter}) ── ${open} open / ${model.todos.length} total`,
    ...lines,
    `   ${model.status}`,
  ].join('\n');
};

const matches = (filter: Model['filter']) => (todo: Todo): boolean =>
  filter === 'all' ? true : filter === 'done' ? todo.done : !todo.done;
