# AGENTS.md — rxjs-pure-fp

## Mission

Reimplement the behavior and feature set of RxJS 7.8.2 with a modern functional TypeScript runtime. RxJS 7.8.2 defines behavior; this repository defines a different implementation architecture.

## Non-negotiable architecture

1. `rxjs@7.8.2` is the behavioral oracle.
2. `reference/rxjs-7.8.2-es3/` is read-only reference material.
3. Never introduce project-defined classes or inheritance.
4. Never reproduce prototype inheritance from the ES3 reference.
5. Prefer standalone functions, closures, structural records, discriminated unions, and higher-order functions.
6. Operators are `Observable<A> -> Observable<B>` transformations.
7. Observable construction is lazy; execution starts only on subscription.
8. Each ordinary subscription owns independent execution state.
9. Shared state requires an explicit sharing topology such as Subject, connectable, share, or shareReplay.
10. Preserve the `next` / `error` / `complete` protocol exactly.
11. Preserve synchronous behavior where RxJS 7.8.2 is synchronous.
12. Preserve teardown and cancellation timing.
13. Preserve inner-subscription concurrency and cancellation semantics.
14. Do not replace Observable semantics with Promise semantics.
15. Mutable execution state belongs inside closures unless a documented shared topology requires otherwise.
16. Use differential tests before claiming semantic parity.
17. Update `docs/RXJS-7.8.2-PARITY.md` with each milestone.
18. Do not edit unrelated subsystems while implementing a milestone.
19. Run all verification commands before declaring a milestone complete.
20. A convenient OO facade may be considered only after full kernel parity; the functional kernel must never depend on it.

## Forbidden source architecture

The AST architecture gate rejects:

- class declarations and class expressions;
- `extends` and `super`;
- direct `.prototype` manipulation;
- `new` for project-defined constructor architecture.

Platform constructors such as `Error`, `Map`, `Set`, `Date`, `URL`, and `AbortController` are allowed where appropriate.

## Milestone discipline

Read `README.md`, `docs/ARCHITECTURE.md`, `docs/SEMANTICS.md`, and `docs/EXECUTION-PLAN.md` before modifying runtime code. Implement one milestone at a time. Keep `README.md` as the canonical public project-page source and milestone summary.

## Required verification

```bash
npm run typecheck
npm run lint
npm run architecture:check
npm run test
npm run test:differential
npm run build
npm run parity:exports
npm run dist:check
```

`npm run verify` runs the complete gate.
