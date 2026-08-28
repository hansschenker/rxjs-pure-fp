# RxJS 7.8.2 ES3 Reference Slice

This directory is an immutable, curated slice of the verified downlevel artifact used as a runtime anatomy reference for early milestones.

Original artifact properties:

- Source: RxJS 7.8.2
- Compiler: TypeScript 4.2.4
- Target: ES3
- Module: CommonJS
- Verified emitted library files: 250
- Modern class/arrow/let/const syntax check: passed
- Runtime smoke test: passed
- Artifact SHA-256: `b274b8fb3d87c47b96623965abd67cf218a2bd5ec4e0ae856a0455641a5799c9`

M00 commits only the execution-core files needed for M01-M04:

- `internal/Subscription.js`
- `internal/Subscriber.js`
- `internal/Observable.js`
- `internal/operators/OperatorSubscriber.js`
- `internal/operators/map.js`

The files are copied byte-for-byte from the verified ES3 artifact. Later milestones may copy additional immutable reference files from that same artifact when they reach Subjects, sharing, schedulers, higher-order execution, or another subsystem.

Do not import these files into the implementation. Their purpose is to expose responsibilities and state transitions after TypeScript class syntax has been erased, not to provide the target architecture.
