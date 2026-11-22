const { test, expect, devices } = require('@playwright/test');

const baseURL = process.env.OPENRAG_BASE_URL || 'https://openrag-persistence-lab.vercel.app';

test('production assets respond successfully', async ({ request }) => {
  for (const path of ['/', '/sw.js', '/probe-worker.js', '/manifest.webmanifest']) {
    const response = await request.get(new URL(path, baseURL).toString());
    expect(response.status(), path).toBe(200);
  }
});

test('page loads, registers service worker and reports capabilities', async ({ page, browserName }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText('OPENRAG');
  const caps = await page.evaluate(async () => {
    let sw = 'unsupported';
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        sw = registration.active?.state || registration.installing?.state || registration.waiting?.state || 'registered';
      } catch (error) { sw = 'error:' + error.message; }
    }
    return {
      serviceWorker: sw,
      worker: typeof Worker !== 'undefined',
      sharedWorker: typeof SharedWorker !== 'undefined',
      webLocks: !!navigator.locks,
      backgroundSync: 'SyncManager' in window,
      periodicSync: 'PeriodicSyncManager' in window,
      visibility: document.visibilityState,
      userAgent: navigator.userAgent
    };
  });
  expect(caps.worker).toBeTruthy();
  expect(caps.serviceWorker.startsWith('error:')).toBeFalsy();
  expect(pageErrors).toEqual([]);
  console.log('BROWSER_CAPABILITIES', browserName, JSON.stringify(caps));
});

test('dedicated worker starts, emits pulse and stops', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  const message = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('/probe-worker.js');
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('worker pulse timeout')); }, 8000);
    worker.onmessage = event => {
      if (event.data?.type === 'pulse') {
        clearTimeout(timeout);
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        resolve(event.data);
      }
    };
    worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage({ type: 'start', intervalMs: 250 });
  }));
  expect(message.type).toBe('pulse');
  expect(message.tick).toBeGreaterThan(0);
});

test('two-page foreground transition does not crash the page', async ({ browser }) => {
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await second.goto('about:blank');
  await first.bringToFront();
  await second.bringToFront();
  await first.waitForTimeout(250);
  const state = await first.evaluate(() => document.visibilityState);
  expect(['hidden', 'visible']).toContain(state);
  await context.close();
});

test('mobile viewport can load the production lab', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toContainText('OPENRAG');
  await context.close();
});
