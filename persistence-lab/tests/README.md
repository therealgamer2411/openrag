# Automated Persistence Checks

The GitHub Actions workflow runs Playwright smoke tests against the production lab in Chromium, Firefox, and WebKit, plus a Pixel 7 viewport/device emulation.

Checks include:
- HTTP availability of the app, service worker, probe worker, and manifest.
- Service Worker registration and browser capability reporting.
- Dedicated Worker message round-trip.
- Basic visibility lifecycle behavior with two pages.
- Mobile viewport loading.

## Important limits

These are automated browser tests, not proof of background persistence after OS-level app termination. CI cannot reliably simulate:
- A real Android/iOS app being force-stopped or a phone screen locked under vendor battery policies.
- A real Windows browser process being fully terminated while a separately installed Windows service runs.
- Physical device CPU scheduling, battery saver, Doze, or iOS discretionary background task scheduling.

Those require physical devices and native builds. CI output records API availability; unsupported APIs are reported, not treated as test failures.
