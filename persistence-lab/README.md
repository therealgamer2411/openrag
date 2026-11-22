# OpenRAG Persistence Lab v0.3.0

Independent research surface for testing whether browser-based OpenRAG nodes remain executable when hidden, backgrounded, frozen, discarded, tab-closed, or browser-closed.

## Research adapters
- Native Page Lifecycle events: visibilitychange, pagehide/pageshow, freeze/resume, document.wasDiscarded.
- Workbox 7 Background Sync Queue: retries failed witness telemetry when the browser later dispatches a Service Worker sync event. It does **not** provide persistent CPU execution.
- Native Service Worker Background Sync and Periodic Background Sync capability probes.
- Dedicated Worker pulse + bounded CPU sample.
- PeerJS 1.5.4 as an external P2P witness channel.

PageLifecycle.js from GoogleChromeLabs was evaluated as a useful cross-browser lifecycle wrapper, but its repository was archived in June 2024. This lab uses native lifecycle events so it can explicitly show which events the tested browser exposes.

## Truth boundaries
- A Service Worker can be terminated while idle and restarted for eligible events. It is not a permanently running worker.
- A frozen/discarded page cannot run JavaScript callbacks while frozen/discarded.
- Periodic Background Sync is limited and browser-controlled; it is not a fixed-frequency compute scheduler.
- Workbox Background Sync retries failed network requests; it does not keep arbitrary computation alive.
- The Vercel witness endpoint emits bounded events to runtime logs only. It does not store a durable event database.
- The WebRTC peer witness is useful while at least one side can execute JS and keep its session alive; it cannot keep a closed browser process alive.

## Test sequence
A: foreground baseline -> B: hidden tab -> C: lock mobile screen -> D: close tab -> E: close browser process -> F: reopen and export IndexedDB records.
Repeat on desktop and mobile separately, recording browser/OS versions and power state.

## Open-source licenses
Workbox is MIT. PeerJS is MIT. PageLifecycle.js is Apache-2.0 and archived; it is not bundled in this lab.
