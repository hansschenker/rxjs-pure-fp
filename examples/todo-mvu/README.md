# todo-mvu

A CRUDL todo app in MVU (Elm-architecture) style, built on `rxjs-pure-fp`
straight from `../../src`.

```bash
node examples/todo-mvu/main.ts --demo   # deterministic scripted run
node examples/todo-mvu/main.ts          # interactive CLI (help, quit)
npx tsc -p examples/todo-mvu            # typecheck the example
```

## Layers

- `model.ts` — immutable `Model`, the `Msg` union (CRUDL intents), the `Cmd`
  effect ADT. Plain data only.
- `update.ts` — pure `(Model, Msg) -> [Model, Cmd]`. No-ops return the same
  model reference.
- `view.ts` — pure `Model -> string`.
- `app.ts` — the runtime, wired entirely from the library:

```text
messages Subject ──► scan(update, [init, none]) ──► startWith(init) ──► steps Subject
                                                                    (manual share)
steps ──► map(model) ──► distinctUntilChanged ──► map(view) ──► render
steps ──► map(cmd) ──► filter(≠none) ──► mergeMap(executeCmd) ──► messages
                                                        (Subject subscribed as observer)
```

## What it exercises

- `Subject` as message hub and as multicast point (manual `share` until M11);
- one pure `scan` fold as the whole state machine, with reentrant dispatch
  from effects flowing through the committed-state runner;
- `distinctUntilChanged` skipping frames for reference-equal models (repeat
  `ls open` renders nothing);
- `mergeMap` interpreting the `Cmd` ADT into follow-up messages (`persist`
  writes `todo-store.json`, git-ignored);
- `startWith` derived on the spot as `concat(of(value), source)` — operator
  algebra over the public surface;
- a Subject subscribed *as an observer* to close the effect feedback loop.
