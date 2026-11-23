import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { expectClean, freshContext, open, openStory, state, watch, waitReady } from './helpers.ts';
import { reachMinigame, seedSave } from '../support/play.ts';
import { puzzleOf } from '../support/puzzle.ts';

test.describe.configure({ timeout: 150_000 });

const CHUNK = '**/assets/chapter-intro-*.js';
const MINIGAME_CHUNK = '**/assets/pz-intro-*.js';
const MESSAGE = 'Kiểm tra mạng rồi thử lại';

function failChunk(target: Page | BrowserContext, failures: number, how: 'status' | 'html' | 'abort' = 'status', pattern = CHUNK) {
  const counter = { hits: 0 };
  void target.route(pattern, (route) => {
    counter.hits += 1;
    if (counter.hits > failures) return route.continue();
    if (how === 'abort') return route.abort('connectionreset');
    if (how === 'html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
  });
  return counter;
}

async function trackVisibility(page: Page): Promise<() => Promise<boolean>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __everVisible?: boolean };
    new MutationObserver(() => {
      const n = document.getElementById('net-error');
      if (n && !n.hidden) w.__everVisible = true;
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  });
  return () => page.evaluate(() => Boolean((window as unknown as { __everVisible?: boolean }).__everVisible));
}

/** The mini game chunk is fetched on the first tap, so a test that wants it to fail presses Enter (as often as the reloads need) until the condition holds. */
const tapUntil = (page: Page, done: () => Promise<boolean>, timeout = 15_000) =>
  expect
    .poll(
      async () => {
        if (await done().catch(() => false)) return true;
        await page.keyboard.press('Enter').catch(() => undefined);
        return false;
      },
      { timeout, intervals: [300] },
    )
    .toBe(true);

const IGNORE = /Failed to load resource|MIME type|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

test.describe('vite:preloadError handling', () => {
  test('persistent failure: exactly one reload, message shown, no loop, nothing in storage or cookies', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    const chunk = failChunk(page, 999);
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible();
    await expect(page.locator('#net-error')).toContainText(MESSAGE);
    await page.waitForTimeout(2500);
    expect(w.loads(), 'document loads: the original and one reload').toBe(2);
    expect(chunk.hits, 'chunk requests: one per load, no retry storm').toBe(2);
    expect((await state(page)).shell.phase).toBe('network-error');
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify([localStorage.length, sessionStorage.length, document.cookie]))).toBe('[0,0,""]');
    expect(w.errors).toEqual([]);
  });

  for (const how of ['status', 'html', 'abort'] as const) {
    test(`intermittent (${how}): first load fails, the reload recovers, no error flash, URL cleaned`, async ({ page }, info) => {
      const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
      const everVisible = await trackVisibility(page);
      failChunk(page, 1, how);
      await page.goto('/?manual=1#frag');
      await waitReady(page);
      expect(w.loads()).toBe(2);
      expect(await everVisible(), 'the network message never flashed').toBe(false);
      expect(new URL(page.url()).search).toBe('?manual=1');
      expect(new URL(page.url()).hash).toBe('#frag');
      await reachMinigame(page, info);
      expect((await puzzleOf(page)).manual).toBe(true);
      expect(w.errors).toEqual([]);
    });
  }

  test('failure on the reload too, then the user taps Thử lại with the network back: recovers', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    failChunk(page, 2);
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible();
    await page.locator('#net-retry').click();
    await waitReady(page);
    await expect(page.locator('#net-error')).toBeHidden();
    expect(w.loads()).toBe(3);
  });

  test('retry keeps failing: each tap reloads once and the message stays', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    failChunk(page, 999);
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      const before = w.loads();
      await page.locator('#net-retry').click();
      await expect(page.locator('#net-error')).toBeVisible();
      await page.waitForTimeout(700);
      expect(w.loads() - before, `reloads after retry tap ${i + 1}`).toBe(1);
    }
  });

  test('crafted link ?_r=1 with a healthy network: loads once, param stripped, other params kept', async ({ page }) => {
    const w = watch(page);
    await page.goto('/?_r=1&manual=1#x');
    await waitReady(page);
    expect(w.loads()).toBe(1);
    expect(new URL(page.url()).search).toBe('?manual=1');
    expect(new URL(page.url()).hash).toBe('#x');
    expectClean(w);
  });

  test('crafted link ?_r=1 with a persistent failure: no reload at all, message shown', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    failChunk(page, 999);
    await page.goto('/?_r=1');
    await expect(page.locator('#net-error')).toBeVisible();
    await page.waitForTimeout(1000);
    expect(w.loads()).toBe(1);
  });

  test('crafted history.state flag with a persistent failure: no reload, message shown', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    await openStory(page);
    await page.evaluate(() => history.replaceState({ chunkReloaded: 1 }, ''));
    failChunk(page, 999);
    await page.reload();
    await expect(page.locator('#net-error')).toBeVisible();
    await page.waitForTimeout(800);
    expect(w.loads(), 'initial load plus the manual reload only').toBe(2);
  });

  test('burst of three vite:preloadError events: one reload, the new page is healthy', async ({ page }) => {
    const w = watch(page);
    await openStory(page);
    await page.evaluate(() => {
      for (let i = 0; i < 3; i += 1) window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    });
    await page.waitForTimeout(500);
    await waitReady(page);
    expect(w.loads()).toBe(2);
    await expect(page.locator('#net-error')).toBeHidden();
  });

  test('slow chunk (3 s) is not mistaken for a failure', async ({ page }) => {
    const w = watch(page);
    const everVisible = await trackVisibility(page);
    await page.route(CHUNK, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.goto('/');
    await waitReady(page);
    expect(w.loads()).toBe(1);
    expect(await everVisible()).toBe(false);
    expectClean(w);
  });

  test('shell and both hooks survive a failed chunk', async ({ page }) => {
    watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    failChunk(page, 999);
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible();
    const s = await state(page);
    expect(s.game).toBeNull();
    expect(s.shell.phase).toBe('network-error');
    expect(await page.evaluate(() => { window.advanceTime(500); return 'ok'; })).toBe('ok');
  });

  test('two tabs, both with a dead chunk: each reloads once on its own and shows the message', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const counter = failChunk(context, 999);
      const a = await context.newPage();
      const b = await context.newPage();
      const wa = watch(a, { allowStatuses: [404], ignoreErrors: IGNORE });
      const wb = watch(b, { allowStatuses: [404], ignoreErrors: IGNORE });
      await Promise.all([a.goto('/'), b.goto('/')]);
      await expect(a.locator('#net-error')).toBeVisible();
      await expect(b.locator('#net-error')).toBeVisible();
      await a.waitForTimeout(1500);
      expect([wa.loads(), wb.loads()]).toEqual([2, 2]);
      expect(counter.hits).toBe(4);
    } finally {
      await context.close();
    }
  });

  test('two tabs: a dead tab does not break a healthy one', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const dead = await context.newPage();
      watch(dead, { allowStatuses: [404], ignoreErrors: IGNORE });
      await dead.route(CHUNK, (r) => r.fulfill({ status: 404, body: 'gone' }));
      const live = await context.newPage();
      const w = watch(live);
      await Promise.all([dead.goto('/'), live.goto('/')]);
      await waitReady(live);
      await expect(dead.locator('#net-error')).toBeVisible();
      expectClean(w);
    } finally {
      await context.close();
    }
  });

  test('offline when the chunk fails: the player sees the message, the page is not replaced by a browser error page', async ({ page, context }) => {
    const w = watch(page, { ignoreErrors: /.*/ });
    await openStory(page);
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError', { cancelable: true })));
    await page.waitForTimeout(1500);
    expect(w.navigations(), 'a reload while offline lands on the browser error page').toBe(1);
    await expect(page.locator('#net-error')).toBeVisible();
    await context.setOffline(false);
  });

  test('the mini game chunk is dead: one reload, then the message with the retry button, no loop', async ({ page }) => {
    const w = watch(page, { allowStatuses: [404], ignoreErrors: IGNORE });
    const chunk = failChunk(page, 999, 'status', MINIGAME_CHUNK);
    await seedSave(page);
    await page.goto('/');
    await tapUntil(page, () => page.locator('#net-error').isVisible());
    await page.waitForTimeout(1500);
    expect(w.loads(), 'document loads: the original and one reload').toBe(2);
    expect(chunk.hits, 'one request per load').toBe(2);
    await expect(page.locator('#net-error')).toContainText(MESSAGE);
    expect((await state(page)).shell.phase).toBe('network-error');
  });

  test('leaving the page while chunks are still loading does not trigger a reload of the page that was opened next', async ({ page }) => {
    await page.route(CHUNK, async (route) => {
      await new Promise((done) => setTimeout(done, 1500));
      await route.continue().catch(() => undefined);
    });
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForTimeout(400);
    await page.goto('/?again=1');
    await waitReady(page);
    await page.waitForTimeout(1000);
    expect(page.url(), 'no _r reload parameter: the abort of the old document was not a chunk failure').not.toContain('_r=');
    await expect(page.locator('#net-error')).toBeHidden();
  });
});
