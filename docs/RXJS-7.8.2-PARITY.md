# RxJS 7.8.2 Parity

## Current milestone: M00 — Foundation

No RxJS runtime feature is implemented yet. This is intentional.

| Dimension | M00 status |
| --- | --- |
| Behavioral oracle pinned | `rxjs@7.8.2` |
| ES3 runtime reference | curated immutable M00 slice committed |
| Architecture gate | established |
| Differential trace harness | established and self-tested against oracle |
| Export snapshot tooling | established |
| Runtime exports implemented | 0 |
| Feature parity | 0% — implementation starts in M01 |

`reference/exports.json` is generated from the installed `rxjs@7.8.2` package. `npm run parity:exports` reports implemented and missing root exports without failing merely because a planned milestone has not implemented them yet. Strict full-export parity becomes an M19/M20 gate.

## Intentional architectural deviations

The final project does not promise OO invocation compatibility such as `new Observable()`, inheritance, or prototype methods as its canonical API. It targets observable behavior and feature capability through a functional API.
