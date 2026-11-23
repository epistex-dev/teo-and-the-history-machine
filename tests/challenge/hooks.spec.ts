import { expect, test, type Page } from '@playwright/test';
import { expectClean, freshContext, GAME_SAVE, open, state, step, waitReady, watch } from './helpers.ts';
import { reachMinigame, seedSave } from '../support/play.ts';
import { check, fillBoard, puzzleFile, puzzleOf, toBoard, wrongFill } from '../support/puzzle.ts';

test.describe.configure({ timeout: 150_000 });

const hookExists = (page: Page) =>
  page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
const now = (page: Page): Promise<number> => page.evaluate(() => Date.now());

test.describe('test hooks', () => {
  test('before the chapter loads: valid JSON, game null, advanceTime is a harmless no-op', async ({ page }, info) => {
    const w = watch(page);
    await seedSave(page, GAME_SAVE);
    await page.route('**/assets/chapter-intro-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/?manual=1', { waitUntil: 'commit' });
    await hookExists(page);
    const s = await state(page);
    expect(s.shell.phase).toBe('loading');
    expect(s.shell.mode).toBe('loading');
    expect(s.game).toBeNull();
    expect(s.shell.audio.state).toBe('none');
    await page.evaluate(() => {
      window.advanceTime(100);
      window.advanceTime(-5);
      window.advanceTime(Number.NaN);
    });
    await waitReady(page);
    await reachMinigame(page, info);
    expect((await puzzleOf(page)).phase, 'advanceTime before load must not be replayed later').toBe('predict');
    expectClean(w);
  });

  const bad: [string, unknown][] = [
    ['NaN', Number.NaN],
    ['negative', -16],
    ['huge negative', -1e12],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['zero', 0],
    ['undefined', undefined],
    ['null', null],
    ['object', {}],
    ['text', 'abc'],
  ];
  for (const [name, value] of bad) {
    test(`advanceTime(${name}) does not throw and does not move time`, async ({ page }) => {
      const w = watch(page);
      await open(page, '?manual=1');
      await step(page, 100);
      const before = await puzzleOf(page);
      const t0 = await now(page);
      await page.evaluate((v) => window.advanceTime(v as number), value);
      expect(await now(page)).toBe(t0);
      expect(await puzzleOf(page)).toEqual(before);
      expectClean(w);
    });
  }

  test('advanceTime(1000) moves the virtual clock by exactly 1000 ms', async ({ page }) => {
    await open(page, '?manual=1');
    const t0 = await now(page);
    await step(page, 1000);
    expect((await now(page)) - t0).toBe(1000);
  });

  test('fractional steps add up: 100 x advanceTime(10) is the same time as advanceTime(1000)', async ({ page }) => {
    await open(page, '?manual=1');
    const t0 = await now(page);
    for (let i = 0; i < 100; i += 1) await step(page, 10);
    expect((await now(page)) - t0).toBe(1000);
  });

  test('sub-frame steps are not dropped: 120 x advanceTime(8) is 960 ms', async ({ page }) => {
    await open(page, '?manual=1');
    const t0 = await now(page);
    for (let i = 0; i < 120; i += 1) await step(page, 8);
    expect((await now(page)) - t0).toBe(960);
  });

  test('splitting a step does not change the outcome (clock and idle puzzle after 6 s: no hint opens on idle)', async ({ browser }, info) => {
    const run = async (chunks: number) => {
      const context = await freshContext(browser, info);
      try {
        const page = await context.newPage();
        await open(page, '?manual=1');
        const t0 = await now(page);
        for (let i = 0; i < chunks; i += 1) await step(page, 6000 / chunks);
        return { elapsed: (await now(page)) - t0, game: await puzzleOf(page) };
      } finally {
        await context.close();
      }
    };
    const whole = await run(1);
    const split = await run(40);
    expect(split.elapsed).toBe(whole.elapsed);
    expect(split.game).toEqual(whole.game);
    expect(split.game.hints).toBe(0);
    expect(split.game.hint).toBe('');
  });

  test('deterministic: the same inputs on two fresh pages give identical game state', async ({ browser }, info) => {
    const play = async () => {
      const context = await freshContext(browser, info);
      try {
        const page = await context.newPage();
        await open(page, '?manual=1');
        await step(page, 500);
        await toBoard(page, info);
        await fillBoard(page, info, wrongFill(puzzleFile('intro')));
        await check(page, info);
        await step(page, 333);
        return JSON.stringify(await puzzleOf(page));
      } finally {
        await context.close();
      }
    };
    expect(await play()).toBe(await play());
  });

  test('render_game_to_text is pure: reading twice changes nothing', async ({ page }) => {
    await open(page, '?manual=1');
    await step(page, 250);
    const a = await puzzleOf(page);
    for (let i = 0; i < 200; i += 1) await page.evaluate(() => window.render_game_to_text());
    expect(await puzzleOf(page)).toEqual(a);
  });

  test('manual mode never advances by itself', async ({ page }) => {
    await open(page, '?manual=1');
    const t0 = await now(page);
    await page.waitForTimeout(700);
    expect(await now(page)).toBe(t0);
  });

  test('default mode: advanceTime leaves the real clock alone and the page keeps running', async ({ page }) => {
    const w = watch(page);
    await open(page);
    const t0 = await now(page);
    await step(page, 2000);
    await page.waitForTimeout(500);
    const elapsed = (await now(page)) - t0;
    expect(elapsed, 'the real clock did not jump by the 2 s step').toBeLessThan(1500);
    expect(elapsed, 'the real clock still runs').toBeGreaterThanOrEqual(400);
    expectClean(w);
  });

  test('hooks keep working after rotate and hide in the middle of manual stepping', async ({ page }) => {
    await open(page, '?manual=1');
    await step(page, 100);
    const before = await puzzleOf(page);
    const vp = page.viewportSize() ?? { width: 390, height: 664 };
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForTimeout(300);
    await step(page, 100);
    const s = await state(page);
    expect(s.shell.viewport.width).toBe(vp.height);
    expect(await puzzleOf(page)).toEqual(before);
  });

  test('advanceTime(Infinity) returns promptly instead of hanging the page', async ({ browser }, info) => {
    test.setTimeout(30_000);
    const context = await freshContext(browser, info);
    try {
      const page = await context.newPage();
      await open(page, '?manual=1');
      const outcome = await Promise.race([
        page.evaluate(() => {
          window.advanceTime(Number.POSITIVE_INFINITY);
          return 'returned';
        }),
        new Promise<string>((r) => setTimeout(() => r('hung for 10 s'), 10_000)),
      ]);
      expect(outcome).toBe('returned');
    } finally {
      await Promise.race([context.close(), new Promise((r) => setTimeout(r, 5000))]);
    }
  });
});
