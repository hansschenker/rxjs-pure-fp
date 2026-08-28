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

M00 commits the core files most useful for studying Subscription, Subscriber, Observable, Subject, representative operators, and scheduler inheritance. Additional immutable reference files may be copied from the same verified artifact when a later milestone reaches that subsystem.

Do not import these files into the implementation. Their purpose is to expose responsibilities and state transitions after TypeScript class syntax has been erased.
