import { cmdNone, cmdPersist, type Model, type Msg, type Step } from './model.ts';

/**
 * MVU Update layer: a pure function (Model, Msg) -> [Model, Cmd]. No I/O, no
 * observables — this is exactly the shape the library's `scan` folds over.
 * Requests that change nothing return the incoming model reference, so the
 * render stream's `distinctUntilChanged` skips the frame.
 */
export const update = (model: Model, msg: Msg): Step => {
  switch (msg.kind) {
    case 'add': {
      const title = msg.title.trim();
      if (title === '') {
        return [{ ...model, status: 'cannot add an empty todo' }, cmdNone];
      }
      const todos = [...model.todos, { id: model.nextId, title, done: false }];
      return [
        { ...model, todos, nextId: model.nextId + 1, status: `added #${model.nextId}` },
        cmdPersist(todos),
      ];
    }

    case 'retitle': {
      const existing = model.todos.find((todo) => todo.id === msg.id);
      if (!existing || msg.title.trim() === '') {
        return [{ ...model, status: `cannot edit #${msg.id}` }, cmdNone];
      }
      const todos = model.todos.map((todo) =>
        todo.id === msg.id ? { ...todo, title: msg.title.trim() } : todo
      );
      return [{ ...model, todos, status: `edited #${msg.id}` }, cmdPersist(todos)];
    }

    case 'toggle': {
      const existing = model.todos.find((todo) => todo.id === msg.id);
      if (!existing) {
        return [{ ...model, status: `no todo #${msg.id}` }, cmdNone];
      }
      const todos = model.todos.map((todo) =>
        todo.id === msg.id ? { ...todo, done: !todo.done } : todo
      );
      return [
        { ...model, todos, status: `${existing.done ? 'reopened' : 'completed'} #${msg.id}` },
        cmdPersist(todos),
      ];
    }

    case 'remove': {
      const todos = model.todos.filter((todo) => todo.id !== msg.id);
      if (todos.length === model.todos.length) {
        return [{ ...model, status: `no todo #${msg.id}` }, cmdNone];
      }
      return [{ ...model, todos, status: `removed #${msg.id}` }, cmdPersist(todos)];
    }

    case 'clearDone': {
      const todos = model.todos.filter((todo) => !todo.done);
      if (todos.length === model.todos.length) {
        return [{ ...model, status: 'nothing to clear' }, cmdNone];
      }
      return [{ ...model, todos, status: 'cleared completed todos' }, cmdPersist(todos)];
    }

    case 'setFilter':
      return msg.filter === model.filter
        ? [model, cmdNone] // same reference: no re-render, no effect
        : [{ ...model, filter: msg.filter, status: `showing ${msg.filter}` }, cmdNone];

    case 'saved':
      return [{ ...model, status: `${model.status} · saved ${msg.count} todo(s)` }, cmdNone];

    case 'help':
      return [
        { ...model, status: 'add <title> | edit <id> <title> | toggle <id> | rm <id> | ls [all|open|done] | clear | quit' },
        cmdNone,
      ];

    case 'unknown':
      return [{ ...model, status: `unknown command: "${msg.input}"` }, cmdNone];
  }
};
