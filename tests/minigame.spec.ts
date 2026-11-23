import { expect, test, type Page } from '@playwright/test';
import { expectClean, monitor } from './support/helpers.ts';
import { AFTER, GAME_SCENE, check, fillBoard, press, puzzleFile, puzzleOf, solvePuzzle, toBoard, waitPuzzlePhase, wrongFill, type Cell } from './support/puzzle.ts';
import {
  dismissTitleQuietly,
  openAtMinigame,
  waitPhase,
  realInput,
  finishMinigame,
  seedSave,
  solveMinigame,
  stateOf,
  step,
  storyOf,
  tap,
  storyPoint,
  reachMinigame,
  storedSave,
  waitReady,
  walkUntilScene,
} from './support/play.ts';

const sizeOf = (page: Page) => page.evaluate(() => { const r = document.querySelector('.pz')!.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; });

test.describe('chapter 1 puzzle', () => {
  test('loads clean, starts from the story, and opens the puzzle player', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await page.goto('/');
    await waitPhase(page, 'ready');
    await dismissTitleQuietly(page);
    const first = await stateOf(page);
    expect(first.shell.audio.state).toBe('none');
    expect(first.story?.scene).toBe('phong-ho-so');
    expect(first.game).toBeNull();
    await openAtMinigame(page, info);
    const state = await stateOf(page);
    expect(state.game?.id).toBe('intro');
    expect((await puzzleOf(page)).kind).toBe('puzzle');
    await expect(page.locator('.pz')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await page.waitForTimeout(500);
    expectClean(m, baseURL!);
  });

  test('first tap runs the AudioContext', async ({ page }, info) => {
    await page.goto('/');
    await waitPhase(page, 'ready');
    await dismissTitleQuietly(page);
    expect((await stateOf(page)).shell.audio.state).toBe('none');
    const p = await storyPoint(page);
    await tap(page, info, p.x, p.y);
    await expect.poll(async () => (await stateOf(page)).shell.audio.state).toBe('running');
    await expect.poll(async () => (await stateOf(page)).shell.audio.played).toBeGreaterThan(0);
    const t1 = (await stateOf(page)).shell.audio.currentTime;
    await page.waitForTimeout(400);
    expect((await stateOf(page)).shell.audio.currentTime, 'audio clock advances').toBeGreaterThan(t1);
  });

  test('a real solve completes, rotation keeps the board inside the window and the answer standing, progress at completion survives a reload', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openAtMinigame(page, info);
    await toBoard(page, info);
    const file = puzzleFile('intro');
    const size = page.viewportSize()!;
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    const placed = (await puzzleOf(page)).board;
    await page.setViewportSize({ width: size.height, height: size.width });
    await expect.poll(async () => Math.round((await sizeOf(page)).width)).not.toBe(Math.round(size.width));
    const after = await sizeOf(page);
    expect(after.left).toBeGreaterThanOrEqual(-1);
    expect(after.right).toBeLessThanOrEqual(size.height + 1);
    expect((await puzzleOf(page)).board, 'rotation keeps the placements').toEqual(placed);
    await page.setViewportSize(size);
    await expect.poll(async () => Math.round((await sizeOf(page)).width)).toBe(Math.round(size.width));
    expect((await puzzleOf(page)).board).toEqual(placed);

    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(280);
    await press(page.locator('.pz-next'), info);
    await finishMinigame(page);
    await walkUntilScene(page, info, AFTER.scene);
    expect((await stateOf(page)).shell.save).toMatchObject({ chapter: 'intro', scene: AFTER.scene, name: 'Lan' });
    expect(JSON.parse((await storedSave(page)) ?? 'null'), 'the next scene after the puzzle is in storage').toMatchObject({ chapter: 'intro', scene: AFTER.scene, name: 'Lan' });
    await page.reload();
    await waitReady(page);
    expect((await storyOf(page)).scene, 'reload resumes after the puzzle, not before it').toBe(AFTER.scene);
    expect((await stateOf(page)).game).toBeNull();
    expect((await stateOf(page)).shell.save.name).toBe('Lan');
    expectClean(m, baseURL!);
  });

  test('a wrong fill does not complete the puzzle and does not reach storage', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await toBoard(page, info);
    const before = await storedSave(page);
    await fillBoard(page, info, wrongFill(puzzleFile('intro')));
    await check(page, info);
    await page.waitForTimeout(500);
    const g = await puzzleOf(page);
    expect(g.completed).toBe(false);
    expect(g.phase).toBe('board');
    expect(g.wrong).toBe(1);
    expect(await storedSave(page)).toBe(before);
  });

  test('hidden tab suspends the audio and the puzzle stays as it was', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.audio.state).toBe('running');
    const before = await puzzleOf(page);

    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);

    await setHidden(true);
    await expect.poll(async () => (await stateOf(page)).shell.audio.state).toBe('suspended');
    await page.waitForTimeout(500);
    expect((await puzzleOf(page)).phase).toBe(before.phase);
    await setHidden(false);
    const p = await storyPoint(page).catch(() => ({ x: 195, y: 400 }));
    await tap(page, info, p.x, p.y);
    await expect.poll(async () => (await stateOf(page)).shell.audio.state).toBe('running');
    expect((await puzzleOf(page)).completed).toBe(false);
  });

  test('manual mode: advanceTime never moves the puzzle on, the hooks play it through', async ({ page }, info) => {
    await openAtMinigame(page, info, '?manual=1');
    const idle = await puzzleOf(page);
    await step(page, 60_000);
    const later = await puzzleOf(page);
    expect(later.phase).toBe(idle.phase);
    expect(later.completed).toBe(false);
    expect(later.hints).toBe(0);
    await solvePuzzle(page, info);
    await finishMinigame(page, { manual: true });
    expect((await stateOf(page)).shell.mode).toBe('story');
  });

  test('no frame over 50 ms after the story is up (boot is the scene transition)', async ({ page, browserName }, info) => {
    test.skip(browserName !== 'chromium', 'long-animation-frame is Chromium only');
    await page.goto('/');
    await waitReady(page);
    expect(
      await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')),
      'long-animation-frame must be supported, otherwise this test proves nothing',
    ).toBe(true);
    await page.waitForTimeout(1500);
    await openAtMinigame(page, info);
    await page.waitForTimeout(500);
    await solveMinigame(page, realInput(info));
    await page.waitForTimeout(1500);
    const { boot, play } = (await stateOf(page)).shell.longFrames;
    info.annotations.push({ type: 'long-frames-boot-ms', description: JSON.stringify(boot) });
    expect(play, 'long animation frames (ms) after ready').toEqual([]);
  });
});

test.describe('storage failures', () => {
  test('localStorage getter throws: RAM fallback, warning, game still works', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await waitReady(page);
    await expect(page.locator('#storage-warning')).toBeVisible();
    await expect(page.locator('#status')).not.toContainText('Đã lưu');
    await openAtMinigame(page, info);
    await solveMinigame(page, realInput(info));
    const s = await stateOf(page);
    expect(s.shell.storage.persistent).toBe(false);
    expect(s.shell.save, 'value kept in RAM').toMatchObject({ chapter: 'intro', scene: GAME_SCENE, name: 'Lan' });
    expectClean(m, baseURL!);
  });

  for (const method of ['setItem', 'getItem'] as const) {
    test(`${method} starts throwing after a healthy first save: RAM fallback and a warning at that moment`, async ({ page, baseURL }, info) => {
      const m = monitor(page);
      await page.addInitScript((name) => {
        const real = Storage.prototype[name];
        Storage.prototype[name] = function (this: Storage, key: string, value: string) {
          if (key.startsWith('teo:') && (window as unknown as { armed?: boolean }).armed) {
            throw new DOMException('full', 'QuotaExceededError');
          }
          return (real as (k: string, v: string) => unknown).call(this, key, value);
        } as never;
      }, method);
      await page.goto('/');
      await waitReady(page);
      await expect(page.locator('#storage-warning'), 'first save passed, no warning yet').toBeHidden();
      await expect(page.locator('#status')).toContainText('Đã lưu');
      expect((await stateOf(page)).shell.storage.persistent).toBe(true);
      await page.evaluate(() => ((window as unknown as { armed: boolean }).armed = true));
      await walkUntilScene(page, info, 'hoi-ten');
      await expect(page.locator('#storage-warning')).toBeVisible();
      await reachMinigame(page, info);
      const s = await stateOf(page);
      expect(s.shell.storage.persistent).toBe(false);
      expect(s.shell.save).toMatchObject({ scene: GAME_SCENE, name: 'Lan' });
      expectClean(m, baseURL!);
    });
  }

  test('corrupt save is ignored', async ({ page, baseURL }) => {
    const m = monitor(page);
    await seedSave(page, '{"schemaVersion":99,"solves":"x"');
    await page.goto('/');
    await waitReady(page);
    expect((await storyOf(page)).scene).toBe('phong-ho-so');
    expect((await stateOf(page)).shell.save.name).toBe('');
    expectClean(m, baseURL!);
  });
});

test.describe('chunk load failures (vite:preloadError)', () => {
  const CHUNK = /\/assets\/chapter-intro-[^/]+\.js$/;

  test('persistent 404: one reload, then the network message, no loop', async ({ page }) => {
    const m = monitor(page);
    let chunkRequests = 0;
    await page.route(CHUNK, (route) => {
      chunkRequests += 1;
      return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
    });
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#net-error')).toContainText('Kiểm tra mạng rồi thử lại');
    await page.waitForTimeout(2000);
    expect(m.loads(), 'page loads: first load plus exactly one reload').toBe(2);
    expect(chunkRequests, 'chunk requested once per load').toBe(2);
    expect((await stateOf(page)).shell.phase).toBe('network-error');
  });

  test('stale chunk once (tab from before a deploy): one reload recovers', async ({ page, baseURL }) => {
    const m = monitor(page);
    let chunkRequests = 0;
    await page.route(CHUNK, (route) => {
      chunkRequests += 1;
      if (chunkRequests === 1) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' });
      return route.continue();
    });
    await page.goto('/');
    await waitReady(page);
    expect(m.loads()).toBe(2);
    expect(chunkRequests).toBe(2);
    await expect(page.locator('#net-error')).toBeHidden();
    expect(new URL(page.url()).searchParams.has('_r'), 'reload marker is removed after success').toBe(false);
    expect(m.hosts.size).toBe(1);
    expect([...m.hosts][0]).toBe(new URL(baseURL!).host);
  });

  test('retry button reloads when the user asks', async ({ page }) => {
    await page.route(CHUNK, (route) => route.fulfill({ status: 404, body: 'gone' }));
    const m = monitor(page);
    await page.goto('/');
    await expect(page.locator('#net-error')).toBeVisible({ timeout: 15_000 });
    const before = m.loads();
    await page.locator('#net-retry').click();
    await expect.poll(() => m.loads()).toBeGreaterThan(before);
  });
});
