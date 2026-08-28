# ES3 Reference to Pure FP Mapping

The ES3 reference removes modern class syntax but still contains constructor/prototype architecture. It is therefore a runtime anatomy reference, not a template to copy.

| ES3 mechanism | Functional replacement direction |
| --- | --- |
| Observable constructor function | lazy execution function/description |
| `Observable.prototype.*` | standalone functions and operators |
| Subscriber constructor inheritance | sink composition and lifecycle guards |
| Subscription prototype state | closure-owned teardown state |
| OperatorSubscriber | configured sink wrapper |
| `lift` | direct Observable transformation |
| Subject constructor inheritance | multicast closure composition |
| Behavior/Replay/Async subject inheritance | multicast hub + state/replay/completion policy |
| Scheduler/Action hierarchy | scheduler kernel + execution policies |

## Reading rule

For every reference function ask:

1. What state does this mechanism own?
2. What is the lifetime of that state?
3. What notifications or lifecycle transitions can it produce?
4. Which behavior is externally observable?
5. Can the responsibility be represented by a closure or a higher-order function without changing those observations?

Never ask only: "How do we turn this constructor into a function?"
