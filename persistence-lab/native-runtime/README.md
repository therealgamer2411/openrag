# OpenRAG Native Runtime Adapter

This adapter is the native execution path for experiments that must continue after the browser/WebView is no longer active.

## Libraries

- `@capacitor/background-runner`: standalone headless JavaScript execution scheduled through native OS background facilities.
- Existing web path: Workbox Background Sync in `../sw.js` for deferred request replay; it is not a continuous CPU worker.
- Optional Flutter-only alternative: `workmanager_web` is experimental and requires a Flutter/Dart callback dispatcher. It is not a drop-in package for this vanilla JavaScript lab.

## Install into a Capacitor host

1. Copy this folder into a Capacitor application that contains the OpenRAG web build in `www/`.
2. Install dependencies: `npm install`.
3. Install the matching Capacitor CLI and run `npx cap sync`.
4. Configure Android and iOS background task capabilities as described by the plugin documentation.
5. Build and install the native application. A normal website/PWA cannot load this native plugin.

## Important platform limits

- This is event-driven scheduled work, not an always-running process.
- Android periodic work is subject to OS scheduling and battery restrictions; the plugin documents a minimum 15-minute repeat interval.
- iOS scheduling is discretionary and each invocation is short (about 30 seconds); it is not guaranteed to run at the requested time.
- Neither platform promises an uninterrupted WebRTC peer connection or permanent CPU/GPU contribution after the app is backgrounded or terminated.
- The runner has no DOM and only a limited JavaScript API surface. Do not reuse browser-only code inside it.
- User consent, OS permissions, visible disclosures, checkpoints, idempotency, and task verification are required.

## Source references

- https://github.com/ionic-team/capacitor-background-runner
- https://github.com/GoogleChrome/workbox
- https://github.com/fluttercommunity/flutter_workmanager/tree/main/workmanager_web

## Integration status

This is a native-host adapter scaffold committed separately from the deployed browser lab. It does not change the current Vercel website and cannot be exercised until an Android/iOS Capacitor host is built and installed.
