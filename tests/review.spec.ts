import { expect, test } from '@playwright/test';
import { monitor } from './support/helpers.ts';
import {
  advanceStory,
  openAtMinigame,
  reachMinigame,
  realInput,
  solveMinigame,
  stateOf,
  step,
  storyOf,
  waitReady,
  walkUntilScene,
} from './support/play.ts';
import { GAME_SCENE, check, fillBoard, puzzleFile, toBoard, waitPuzzlePhase, type Cell } from './support/puzzle.ts';
import { intro, lineAfterMinigame } from './support/script.ts';

test.describe('review round 1 regressions', () => {
  test('a second tap on "Lật trang" while the page turns does not finish twice, and the story continues from the right line', async ({ page }, info) => {
    await openAtMinigame(page, info, '?manual=1');
    const file = puzzleFile('intro');
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(300);
    const next = page.locator('.pz-next');
    await next.evaluate((el) => {
      (el as HTMLElement).click();
      (el as HTMLElement).click();
    });
    await page.mouse.click(195, 740);
    await step(page, 2000);
    const s = await stateOf(page);
    expect(s.shell.mode).toBe('story');
    const expected = lineAfterMinigame(intro, 'Lan');
    expect(s.story?.scene).toBe(expected.scene);
    expect(s.story?.line?.text, 'the first line after the puzzle, shown once and not skipped').toBe(expected.text);
    await step(page, 2000);
    expect((await storyOf(page)).line?.text, 'no late completion advanced the story').toBe(expected.text);
    await advanceStory(page, info);
    expect((await storyOf(page)).line?.text, 'the story is advanceable afterwards').not.toBe(expected.text);
  });

  test('status line says saved when the save reached storage', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await solveMinigame(page, realInput(info));
    await expect(page.locator('#status')).toContainText('Đã lưu');
    await expect(page.locator('#storage-warning')).toBeHidden();
  });

  test('status line does not claim a save that failed', async ({ page }, info) => {
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key.startsWith('teo:') && (window as unknown as { armed?: boolean }).armed) throw new DOMException('full', 'QuotaExceededError');
        set.call(this, key, value);
      };
    });
    await page.goto('/');
    await waitReady(page);
    await expect(page.locator('#storage-warning')).toBeHidden();
    await page.evaluate(() => ((window as unknown as { armed: boolean }).armed = true));
    await walkUntilScene(page, info, 'hoi-ten');
    await reachMinigame(page, info);
    await solveMinigame(page, realInput(info));
    await expect(page.locator('#storage-warning')).toBeVisible();
    await expect(page.locator('#status')).not.toContainText('Đã lưu');
    expect((await stateOf(page)).shell.save).toMatchObject({ scene: GAME_SCENE, name: 'Lan' });
  });
});

test.describe('touch target', () => {
  test('the story buttons and the name prompt controls are at least 48 css px', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const advance = await box('#advance');
    expect(Math.min(advance.width, advance.height)).toBeGreaterThanOrEqual(48);
    await page.evaluate(() => ((document.getElementById('ask') as HTMLElement).hidden = false));
    for (const selector of ['#name', '#name-done']) {
      const b = await box(selector);
      expect(b.height, selector).toBeGreaterThanOrEqual(48);
    }
  });

  test('every control of the puzzle player is at least 44 css px in portrait and in landscape and stays inside the window', async ({ page }, info) => {
    await openAtMinigame(page, info, '?manual=1');
    await toBoard(page, info);
    const size = page.viewportSize()!;
    for (const vp of [size, { width: size.height, height: size.width }]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      for (const sel of ['#pz-hint', '#pz-check']) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(Math.min(b.width, b.height), `${sel} ${vp.width}x${vp.height}`).toBeGreaterThanOrEqual(44);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
        expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 1);
      }
    }
  });
});

test.describe('shared dependency chunk of the puzzle player fails to load', () => {
  const DEP = '**/assets/puzzle-*.js';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('documents', String(Number(sessionStorage.getItem('documents') ?? 0) + 1));
      new MutationObserver(() => {
        const el = document.getElementById('net-error');
        if (el && !el.hidden && !sessionStorage.getItem('shownIn')) sessionStorage.setItem('shownIn', sessionStorage.getItem('documents') ?? '');
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
    });
  });

  test('several preload errors from one failed load: one reload and the message never shows while it is pending', async ({ page }) => {
    const m = monitor(page);
    await page.goto('/');
    await waitReady(page);
    await page.evaluate(() => {
      for (let i = 0; i < 3; i += 1) window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    });
    await expect.poll(() => m.loads()).toBe(2);
    await waitReady(page);
    await page.waitForTimeout(500);
    expect(m.loads()).toBe(2);
    expect(await page.evaluate(() => sessionStorage.getItem('shownIn')), 'the second event counted as a failed reload').toBeNull();
    await expect(page.locator('#net-error')).toBeHidden();
  });

  test('fails once: the page recovers with exactly one reload, the puzzle still plays, the network message never shows', async ({ page }, info) => {
    const m = monitor(page);
    let hits = 0;
    await page.route(DEP, (route) => {
      hits += 1;
      if (hits === 1) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
      return route.continue();
    });
    await page.goto('/');
    await expect
      .poll(
        async () => {
          if (hits >= 2) return hits;
          await page.keyboard.press('Enter').catch(() => undefined);
          return hits;
        },
        { timeout: 15_000, intervals: [300] },
      )
      .toBeGreaterThanOrEqual(2);
    await waitReady(page);
    await page.waitForTimeout(500);
    expect(m.loads(), 'the original document and exactly one reload').toBe(2);
    await reachMinigame(page, info);
    await solveMinigame(page, realInput(info));
    expect(await page.evaluate(() => sessionStorage.getItem('shownIn'))).toBeNull();
    await expect(page.locator('#net-error')).toBeHidden();
  });

  test('fails every time: the message waits for the one reload, then shows with the retry button', async ({ page }) => {
    const m = monitor(page);
    await page.route(DEP, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }));
    await page.goto('/');
    await expect
      .poll(
        async () => {
          const text = await page.locator('#net-error').textContent({ timeout: 500 }).catch(() => '');
          if ((await page.locator('#net-error').isVisible().catch(() => false)) && text?.includes('Kiểm tra mạng rồi thử lại')) return true;
          await page.keyboard.press('Enter').catch(() => undefined);
          return false;
        },
        { timeout: 15_000, intervals: [300] },
      )
      .toBe(true);
    await page.waitForTimeout(1500);
    expect(m.loads()).toBe(2);
    expect(await page.evaluate(() => sessionStorage.getItem('shownIn')), 'message first shown in the reloaded document, not while the reload is pending').toBe('2');
    await expect(page.locator('#net-retry')).toBeVisible();
  });
});
