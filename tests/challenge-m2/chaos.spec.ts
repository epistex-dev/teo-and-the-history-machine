import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectClean, setHidden, state, watch, waitReady } from '../challenge/helpers.ts';
import { advanceStory, isTouch, realInput, solveMinigame, stateOf, tap, typeName, walkToChapterEnd, type AppState } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

function check(s: AppState, label: string): void {
  expect(s.shell.phase, label).toBe('ready');
  expect(['story', 'minigame'], label + ' mode').toContain(s.shell.mode);
  if (s.shell.mode === 'story') {
    expect(s.story, label + ' story state').not.toBeNull();
    expect(s.game, label + ' no game in story mode').toBeNull();
  }
  if (s.shell.mode === 'minigame') expect(s.game, label + ' game state').not.toBeNull();
  expect(JSON.stringify(s.shell.save)).toMatch(/"schemaVersion":1/);
}

async function chaos(page: Page, info: TestInfo, seed: number, steps: number): Promise<void> {
  const rnd = rng(seed);
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const vp = page.viewportSize()!;
  let lastIndex = -1;
  for (let i = 0; i < steps; i += 1) {
    const s = await stateOf(page);
    const label = 'seed ' + seed + ' step ' + i;
    check(s, label);
    if (s.story && s.shell.mode === 'story' && !s.story.asking) {
      const at = s.story.lineIndex ?? -1;
      expect(at, label + ' line index went backwards').toBeGreaterThanOrEqual(lastIndex);
      lastIndex = at;
    }
    const action = pick(['tap', 'tap', 'key', 'key', 'name', 'rotate', 'hide', 'mash', 'scrub', 'help', 'wait', 'reload', 'tab', 'resizeTiny']);
    switch (action) {
      case 'tap': {
        const box = await page.locator(s.shell.mode === 'minigame' ? '#stage' : '#story').boundingBox();
        if (box) await tap(page, info, box.x + rnd() * box.width, box.y + rnd() * box.height);
        break;
      }
      case 'key':
        await page.keyboard.press(pick(['Enter', 'Space', 'ArrowRight', 'ArrowLeft', 'Escape', 'a']));
        break;
      case 'name':
        if (s.story?.asking) await page.locator('#name').fill(pick(['Lan', '', '<b>x</b>', '🎅🎅', 'Te\u0300o', '$&', ' '.repeat(30)]));
        break;
      case 'rotate':
        await page.setViewportSize(rnd() < 0.5 ? { width: vp.height, height: vp.width } : vp);
        break;
      case 'resizeTiny':
        await page.setViewportSize(pick([{ width: 240, height: 320 }, { width: 1024, height: 200 }, vp]));
        break;
      case 'hide':
        await setHidden(page, true);
        await page.waitForTimeout(100);
        await setHidden(page, false);
        break;
      case 'mash': {
        const c = (await page.locator('canvas, .pz').count()) > 0 ? await page.locator('canvas, .pz').boundingBox() : null;
        if (c) for (let k = 0; k < 20; k += 1) await page.mouse.click(c.x + rnd() * c.width, c.y + rnd() * c.height);
        break;
      }
      case 'scrub': {
        const c = (await page.locator('canvas, .pz').count()) > 0 ? await page.locator('canvas, .pz').boundingBox() : null;
        if (c && !isTouch(info)) {
          await page.mouse.move(c.x + rnd() * c.width, c.y + rnd() * c.height);
          await page.mouse.down();
          await page.mouse.move(c.x + rnd() * c.width, c.y + rnd() * c.height, { steps: 5 });
          await page.mouse.up();
        }
        break;
      }
      case 'help':
        for (const id of ['#mg-help', '#pz-hint']) if (await page.locator(id).isVisible()) await page.locator(id).click({ force: true, timeout: 1000 }).catch(() => undefined);
        break;
      case 'tab':
        await page.keyboard.press(pick(['Tab', 'Shift+Tab']));
        break;
      case 'reload':
        if (rnd() < 0.4) {
          await page.reload();
          await waitReady(page);
          lastIndex = -1;
        }
        break;
      default:
        await page.waitForTimeout(150);
    }
  }
}

test.describe('chaos on chapter 1', () => {
  test.setTimeout(180_000);
  for (const seed of [11, 4242]) {
    test('seed ' + seed + ': 70 random actions keep the state valid, then the chapter can still be finished; no console error, no foreign host', async ({ page }, info) => {
      const w = watch(page);
      await page.goto('/');
      await waitReady(page);
      const vp = page.viewportSize()!;
      await chaos(page, info, seed, 70);
      await page.setViewportSize(vp);
      await page.reload();
      await waitReady(page);
      await walkToChapterEnd(page, info);
      const end = await state(page);
      expect(end.shell.mode).toBe('story');
      expect(end.story?.chapter).toBe('saturnalia');
      expect(end.shell.save).toMatchObject({ chapter: 'saturnalia', furthest: 'saturnalia' });
      expect(end.shell.save.name.length).toBeGreaterThan(0);
      expectClean(w);
    });
  }
});

test.describe('requests and console', () => {
  test.setTimeout(90_000);
  test('a full play-through: one origin, every chunk fetched once, no 4xx/5xx, no console error, no websocket, worker or service worker', async ({ page, context }, info) => {
    const w = watch(page);
    await page.goto('/');
    await waitReady(page);
    await walkToChapterEnd(page, info);
    const counts = new Map<string, number>();
    for (const u of w.requests.filter((x) => /\/assets\//.test(x))) counts.set(u, (counts.get(u) ?? 0) + 1);
    const dup = [...counts].filter(([, n]) => n > 1);
    expect(dup, 'assets requested more than once in one page load').toEqual([]);
    expect(await context.serviceWorkers().length).toBe(0);
    expect(w.requests.some((r) => /^(ws|wss):/.test(r))).toBe(false);
    expectClean(w);
  });

  test('every request of a play-through is same origin, including images, fonts, audio and beacons (checked by URL and by resource timing)', async ({ page, baseURL }, info) => {
    const w = watch(page);
    await page.goto('/');
    await waitReady(page);
    await walkToChapterEnd(page, info);
    const external = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => new URL(n).origin !== location.origin));
    expect(external).toEqual([]);
    const origin = new URL(baseURL!).origin;
    expect(w.requests.filter((r) => !r.startsWith(origin) && !/^(data|blob):/.test(r))).toEqual([]);
    const html = await page.content();
    expect(html, 'external URL in the rendered DOM').not.toMatch(/(?:src|href)=["']https?:\/\/(?!(?:127\.0\.0\.1|localhost)[:/])/);
  });

  test('reload at every scene of the chapter: no console error, the same scene comes back', async ({ page }, info) => {
    const w = watch(page);
    await page.goto('/');
    await waitReady(page);
    const seen = new Set<string>();
    for (let i = 0; i < 40 && (await state(page)).story?.chapter !== 'saturnalia'; i += 1) {
      const s = await state(page);
      if (s.story?.scene && !seen.has(s.story.scene) && !s.story.asking && s.shell.mode === 'story') {
        seen.add(s.story.scene);
        const scene = s.story.scene;
        await page.reload();
        await waitReady(page);
        const r = await state(page);
        expect(r.story?.scene, 'resumed scene').toBe(scene);
      }
      const now = await state(page);
      if (now.game) await solveMinigame(page, realInput(info));
      else if (now.story?.asking) await typeName(page, 'Lan');
      else if (now.shell.mode === 'story') await advanceStory(page, info);
      else await page.waitForTimeout(50);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
    expectClean(w);
  });
});

