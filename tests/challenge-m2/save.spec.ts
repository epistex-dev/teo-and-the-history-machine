import { expect, test, type Page } from '@playwright/test';
import { advanceStory, expectClean, freshContext, GAME_SAVE, open, openStory, state, step, setHidden, watch, waitReady } from '../challenge/helpers.ts';
import { AFTER, fillBoard, helpPuzzle, puzzleFile, toBoard, wrongFill } from '../support/puzzle.ts';
import { openAtMinigame, reachMinigame, SAVE_KEY, seedSave, storedSave, typeName, walkToChapterEnd, walkUntilScene } from '../support/play.ts';

test.describe.configure({ timeout: 90_000 });

const base = { schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten' };
const valid = (extra: Record<string, unknown> = {}): string => JSON.stringify({ ...base, ...extra });
const IDS = ['intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas', 'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night', 'yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms', 'ending'];

async function loadWith(page: Page, raw: string): Promise<void> {
  await seedSave(page, raw);
  await page.goto('/');
  await waitReady(page);
}

test.describe('save: hostile and odd inputs', () => {
  const rows: [string, string][] = [
    ['schemaVersion 1e999 (Infinity)', '{"schemaVersion":1e999,"name":"Lan","furthest":"intro","chapter":"intro","scene":"hoi-ten"}'],
    ['schemaVersion null', valid({ schemaVersion: null })],
    ['schemaVersion true', valid({ schemaVersion: true })],
    ['schemaVersion beyond 2^53', '{"schemaVersion":9007199254740993,"name":"Lan","furthest":"intro","chapter":"intro","scene":"hoi-ten"}'],
    ['name is an object', valid({ name: { toString: 'x' } })],
    ['name is an array', valid({ name: ['Lan'] })],
    ['chapter "constructor"', valid({ chapter: 'constructor', furthest: 'constructor' })],
    ['chapter "__proto__"', valid({ chapter: '__proto__', furthest: '__proto__' })],
    ['chapter "toString", furthest "intro"', valid({ chapter: 'toString' })],
    ['furthest "hasOwnProperty"', valid({ furthest: 'hasOwnProperty' })],
    ['scene "constructor"', valid({ scene: 'constructor' })],
    ['scene "__proto__"', valid({ scene: '__proto__' })],
    ['chapter ahead of furthest, chapter has no script', valid({ chapter: 'saturnalia', furthest: 'intro', scene: '' })],
    ['chapter is an array', valid({ chapter: ['intro'] })],
    ['furthest is a number', valid({ furthest: 1 })],
    ['10k combining marks in the name', valid({ name: 'a' + '\u0301'.repeat(10_000) })],
    ['name with C0 control characters', valid({ name: 'La\u0000n\u0007\n' })],
    ['name with NFD Vietnamese', valid({ name: 'Te\u0300o' })],
    ['name is only whitespace', valid({ name: '   \u00a0 ' })],
    ['name with surrounding spaces', valid({ name: '  Lan  ' })],
    ['v0 without a name', JSON.stringify({ schemaVersion: 0, chapter: 'intro', scene: 'cuc-cu' })],
    ['v0 with name null', JSON.stringify({ schemaVersion: 0, name: null, chapter: 'intro', scene: 'cuc-cu' })],
    ['v0 with extra fields', JSON.stringify({ schemaVersion: 0, name: 'Lan', chapter: 'intro', scene: 'cuc-cu', junk: { a: 1 } })],
    ['v1 without furthest', JSON.stringify({ schemaVersion: 1, name: 'Lan', chapter: 'intro', scene: 'hoi-ten' })],
    ['v1 with furthest ahead of an unscripted chapter id', valid({ furthest: 'ending' })],
  ];
  for (const [label, raw] of rows) {
    test('load: ' + label + ' never crashes and leaves a valid state', async ({ page }) => {
      const w = watch(page);
      await loadWith(page, raw);
      const s = await state(page);
      expect(s.shell.phase).toBe('ready');
      expect(['story']).toContain(s.shell.mode);
      expect(IDS, 'furthest is a real chapter id').toContain(s.shell.save.furthest);
      expect(IDS, 'chapter is a real chapter id').toContain(s.shell.save.chapter);
      expect(IDS.indexOf(s.shell.save.furthest), 'furthest never behind the current chapter').toBeGreaterThanOrEqual(IDS.indexOf(s.shell.save.chapter));
      expect(typeof s.shell.save.name).toBe('string');
      expect([...s.shell.save.name].length).toBeLessThanOrEqual(24);
      expect(s.shell.save.name, 'no control characters in a name').not.toMatch(/\p{Cc}/u);
      expect(s.shell.save.name, 'name is NFC').toBe(s.shell.save.name.normalize('NFC'));
      expect(s.shell.save.name, 'name is trimmed').toBe(s.shell.save.name.trim());
      expect(s.shell.storage.warning, 'bad data is not a storage failure').toBe(false);
      expectClean(w);
    });
  }

  test('load: names from a save are NFC, trimmed and shown as typed (control chars dropped)', async ({ page }) => {
    await loadWith(page, valid({ name: ' Te\u0300o ' }));
    expect((await state(page)).shell.save.name).toBe('Tèo');
  });

  test('a save that is valid but ahead (furthest later than chapter) keeps furthest after the player moves on', async ({ page }, info) => {
    await loadWith(page, valid({ furthest: 'saturnalia' }));
    expect((await state(page)).story?.scene).toBe('hoi-ten');
    for (let i = 0; i < 6; i += 1) {
      if ((await state(page)).story?.asking) await typeName(page, 'Lan');
      else await advanceStory(page, info);
    }
    const stored = JSON.parse((await storedSave(page)) ?? 'null');
    expect(stored.furthest, 'furthest must only move forward').toBe('saturnalia');
    expect((await state(page)).shell.save.furthest).toBe('saturnalia');
  });

  test('a written save has exactly the five documented keys and schemaVersion 1', async ({ page }, info) => {
    await openStory(page);
    await walkUntilScene(page, info, 'cuc-cu');
    const stored = JSON.parse((await storedSave(page)) ?? 'null');
    expect(Object.keys(stored).sort()).toEqual(['chapter', 'furthest', 'name', 'scene', 'schemaVersion']);
    expect(stored.schemaVersion).toBe(1);
  });

  test('a save from a future schemaVersion is not destroyed by this older build', async ({ page }, info) => {
    const future = valid({ schemaVersion: 2, name: 'Lan', extra: 'new-format-field' });
    await loadWith(page, future);
    for (let i = 0; i < 4; i += 1) await advanceStory(page, info);
    const all = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k) ?? ''));
    expect(all.some((v) => v.includes('new-format-field')), 'the newer save is overwritten, a newer deploy loses the progress when the player returns to it').toBe(true);
  });
});

test.describe('save: mini game is never saved mid-game', () => {
  const spy = async (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as { __w: unknown[][] };
      w.__w = [];
      for (const m of ['setItem', 'removeItem', 'clear'] as const) {
        const orig = Storage.prototype[m] as (...a: unknown[]) => unknown;
        (Storage.prototype as unknown as Record<string, unknown>)[m] = function (this: Storage, ...a: unknown[]) {
          w.__w.push([m, a[0], a[1]]);
          return orig.apply(this, a);
        };
      }
    });
  const writes = (page: Page) => page.evaluate(() => (window as unknown as { __w: unknown[][] }).__w);

  test('placing pieces, idling, hiding, pagehide: no write to the story save and the stored save is untouched; reload returns to the scene start', async ({ page }, info) => {
    await spy(page);
    await open(page, '?manual=1');
    await page.evaluate(() => ((window as unknown as { __w: unknown[][] }).__w = []));
    const before = await storedSave(page);
    expect(JSON.parse(before ?? 'null')).toMatchObject({ scene: GAME_SAVE.scene, chapter: 'intro' });
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(puzzleFile('intro')));
    await step(page, 8000);
    await setHidden(page, true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    await setHidden(page, false);
    await step(page, 22_000);
    expect((await writes(page)).filter((w) => w[1] === SAVE_KEY), 'no story-save write while the puzzle runs').toEqual([]);
    expect(await storedSave(page)).toBe(before);
    await page.reload();
    await waitReady(page);
    const s = await state(page);
    expect(s.shell.mode).toBe('story');
    expect(s.story?.scene).toBe(GAME_SAVE.scene);
    expect(s.game).toBeNull();
    const after = JSON.parse((await storedSave(page)) ?? 'null');
    expect(Object.keys(after).sort()).toEqual(['chapter', 'furthest', 'name', 'scene', 'schemaVersion']);
    expect(after).toMatchObject({ scene: GAME_SAVE.scene, chapter: 'intro', furthest: 'intro' });
  });

  test('completing the puzzle with the last hint writes the next scene once, not per step', async ({ page }, info) => {
    await spy(page);
    await open(page, '?manual=1');
    await page.evaluate(() => ((window as unknown as { __w: unknown[][] }).__w = []));
    await helpPuzzle(page, info);
    await step(page, 4000);
    const w = (await writes(page)).filter((x) => x[1] === SAVE_KEY);
    expect(w.length, 'at most one write per scene change').toBeLessThanOrEqual(2);
  });
});

test.describe('save: storage failing in the middle of the chapter', () => {
  const full = (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as { __full: boolean };
      w.__full = false;
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
        if (w.__full && k.startsWith('teo:')) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        set.call(this, k, v);
      };
    });
  const setFull = (page: Page, v: boolean) => page.evaluate((x) => ((window as unknown as { __full: boolean }).__full = x), v);

  test('quota hits after cuc-cu: chapter end still works in RAM, warning shows, reload resumes at the last persisted scene', async ({ page }, info) => {
    await full(page);
    const w = watch(page);
    await openStory(page);
    await walkUntilScene(page, info, 'cuc-cu');
    await expect(page.locator('#storage-warning')).toBeHidden();
    await setFull(page, true);
    await walkToChapterEnd(page, info);
    const s = await state(page);
    expect(s.shell.mode).toBe('story');
    expect(s.shell.storage.warning).toBe(true);
    await expect(page.locator('#storage-warning')).toBeVisible();
    expect(s.shell.save).toMatchObject({ chapter: 'saturnalia', furthest: 'saturnalia', name: 'Lan' });
    expect(JSON.parse((await storedSave(page)) ?? 'null')).toMatchObject({ chapter: 'intro', scene: 'cuc-cu' });
    await page.reload();
    await waitReady(page);
    const r = await state(page);
    expect(r.story?.scene, 'the last write that worked').toBe('cuc-cu');
    expect(r.shell.save.name).toBe('Lan');
    expectClean(w);
  });

  test('quota during the mini game, then storage works again: the next scene change is persisted', async ({ page }, info) => {
    await full(page);
    await openAtMinigame(page, info, '?manual=1');
    await setFull(page, true);
    await helpPuzzle(page, info);
    await setFull(page, false);
    await walkUntilScene(page, info, 'kim-ket');
    const stored = JSON.parse((await storedSave(page)) ?? 'null');
    expect(stored, 'the app retries storage after a transient failure instead of staying in RAM for ever').toMatchObject({ scene: 'kim-ket', name: 'Lan' });
  });

  test('quota on the very first write: name survives the puzzle in RAM', async ({ page }, info) => {
    await full(page);
    await page.addInitScript(() => ((window as unknown as { __full: boolean }).__full = true));
    await openAtMinigame(page, info, '?manual=1');
    await helpPuzzle(page, info);
    expect((await state(page)).shell.mode).toBe('story');
    expect((await state(page)).shell.save.name, 'the name is kept in RAM while storage is full').toBe('Lan');
    expect((await state(page)).story?.line?.text).toContain(AFTER.text);
  });
});

test.describe('save: several tabs', () => {
  test('two tabs finish the chapter in the same moment: one valid save, furthest saturnalia, both reload into chapter 2', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const a = await context.newPage();
      await openStory(a);
      await walkUntilScene(a, info, 'kim-ket');
      const b = await context.newPage();
      await b.goto('/');
      await waitReady(b);
      expect((await state(b)).story?.scene).toBe('kim-ket');
      const finish = async (p: Page) => {
        for (let i = 0; i < 25 && (await state(p)).story?.chapter !== 'saturnalia'; i += 1) await advanceStory(p, info);
      };
      await Promise.all([finish(a), finish(b)]);
      const raw = await storedSave(a);
      const stored = JSON.parse(raw ?? 'null');
      expect(stored).toMatchObject({ schemaVersion: 1, chapter: 'saturnalia', furthest: 'saturnalia', name: 'Lan' });
      for (const p of [a, b]) {
        await p.reload();
        await waitReady(p);
        expect((await state(p)).story?.chapter).toBe('saturnalia');
      }
    } finally {
      await context.close();
    }
  });

  test('a stale tab left in chapter 1 cannot pull a finished save back to chapter 1', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const stale = await context.newPage();
      await openStory(stale);
      const a = await context.newPage();
      await a.goto('/');
      await waitReady(a);
      await walkToChapterEnd(a, info);
      expect(JSON.parse((await storedSave(a)) ?? 'null')).toMatchObject({ chapter: 'saturnalia', furthest: 'saturnalia' });
      for (let i = 0; i < 4; i += 1) await advanceStory(stale, info);
      expect(JSON.parse((await storedSave(a)) ?? 'null'), 'stale tab wrote over the finished save').toMatchObject({ chapter: 'saturnalia', furthest: 'saturnalia', name: 'Lan' });
      await stale.reload();
      await waitReady(stale);
      expect((await state(stale)).story?.chapter).toBe('saturnalia');
    } finally {
      await context.close();
    }
  });

  test('a stale tab inside the mini game finishes it after another tab finished the chapter: furthest does not drop', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const stale = await context.newPage();
      await stale.goto('/?manual=1');
      await waitReady(stale);
      await reachMinigame(stale, info);
      const a = await context.newPage();
      await a.goto('/');
      await waitReady(a);
      await walkToChapterEnd(a, info);
      await helpPuzzle(stale, info);
      for (let i = 0; i < 4; i += 1) await advanceStory(stale, info);
      const stored = JSON.parse((await storedSave(a)) ?? 'null');
      expect(stored.furthest).toBe('saturnalia');
      expect(stored.chapter, 'the finished chapter is not reopened by a stale tab').toBe('saturnalia');
    } finally {
      await context.close();
    }
  });

  test('storage event from another tab does not crash a tab that is inside the mini game', async ({ browser }, info) => {
    const context = await freshContext(browser, info);
    try {
      const p = await context.newPage();
      const w = watch(p);
      await open(p, '?manual=1');
      const other = await context.newPage();
      await other.goto('/');
      await other.evaluate((k) => localStorage.setItem(k, '{"schemaVersion":1,"name":"X","furthest":"saturnalia","chapter":"saturnalia","scene":""}'), SAVE_KEY);
      await step(p, 500);
      const s = await state(p);
      expect(s.shell.phase).toBe('ready');
      expect(s.game, 'the running mini game is not torn down by another tab').not.toBeNull();
      expectClean(w);
    } finally {
      await context.close();
    }
  });
});
