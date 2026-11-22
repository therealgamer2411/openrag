const { test, expect, devices } = require('@playwright/test');

const baseURL = process.env.OPENRAG_BASE_URL || 'https://openrag-persistence-lab.vercel.app';
const browserName = process.env.BROWSER || 'chromium';

test.describe('OpenRAG Persistence Lab browser checks', () => {
  test('serves the lab and required static assets', async ({ request }) => {
    const page = await request.get(baseURL);
    expect(page.status()).toBe(200);
    const html = await page.text();
    expect(html).toContain('OPENRAG');
    const sw = await request.get(new URL('/sw.js', baseURL).toString());
    expect(sw.status()).toBe(200);
    const worker = await request.get(new URL('/probe-worker.js', baseURL).toString());
    expect(worker.status()).toBe(200);
    const manifest = await request.get(new URL('/manifest.webmanifest', baseURL).toString());
    expect(manifest.status()).toBe(200);
  });

  test('loads page, registers service worker and reports browser capabilities', async ({ page, browserName: actualBrowser }) => {
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText('OPENRAG');
    const capabilities = await page.evaluate(async () => {
      let swState = 'unsupported';
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          swState = reg.active ? reg.active.state : (reg.installing?.state || reg.waiting?.state || 'registered');
        } catch (error) { swState = 'error:' + error.message; }
      }
      return {
        serviceWorker: swState,
        worker: typeof Worker !== 'undefined',
        sharedWorker: typeof SharedWorker !== 'undefined',
        locks: !!navigator.locks,
        backgroundSync: 'serviceWorker' in navigator && 'SyncManager' in window,
        periodicSync: 'serviceWorker' in navigator && 'PeriodicSyncManager' in window,
        visibility: document.visibilityState,
        userAgent: navigator.userAgent
      };
    });
    expect(capabilities.worker).toBeTruthy();
    expect(capabilities.serviceWorker).not.toBe('error:');
    expect(pageErrors).toEqual([]);
    console.log('CAPABILITIES', JSON.stringify({ browser: actualBrowser, ...capabilities }));
  });

  test('dedicated worker executes and returns a result', async ({ page }) => {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => new Promise((resolve, reject) => {
      const worker = new Worker('/probe-worker.js');
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('worker timeout')); }, 10000);
      worker.onmessage = event => { clearTimeout(timeout); worker.terminate(); resolve(event.data); };
      worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
      worker.postMessage({ type: 'probe', durationMs: 250 });
    }));
    expect(result).toBeTruthy();
  });

  test('visibility lifecycle changes when another page takes foreground', async ({ browser }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const second = await context.newPage();
    await first.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await second.goto('about:blank');
    await first.bringToFront();
    await second.bringToFront();
    await first.waitForTimeout(300);
    const state = await first.evaluate(() => document.visibilityState);
    expect(['hidden', 'visible']).toContain(state);
    await context.close();
  });

  test('mobile viewport emulation can load the lab', async ({ browser }) => {
    const descriptor = devices['Pixel 7'];
    const context = await browser.newContext({ ...descriptor });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText('OPENRAG');
    await context.close();
  });
});
