import { expect, test, type Page } from '@playwright/test';
import { encodeCode } from '../../src/code.ts';
import { expectClean, monitor } from '../support/helpers.ts';
import { advanceStory, reachMinigame, stateOf, typeName } from '../support/play.ts';
import { fillBoard, helpPuzzle, toBoard } from '../support/puzzle.ts';
import { openPreview, PUZZLES, puzzleFile, PREVIEW, REAL, SAVE, seedStorage, waitReady, type Cell, type PuzzleState } from './helpers.ts';

test.describe.configure({ timeout: 90_000 });

const save = (o: Record<string, unknown> = {}): string => JSON.stringify({ schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: 'hoi-ten', ...o });
const inProgress = (id: string, extra: Record<string, unknown> = {}): string => JSON.stringify({ phase: 'board', predicted: 0, opened: 2, wrongRun: 1, wrongTotal: 4, checks: 4, found: [], cWrong: 0, board: null, fills: null, pointed: [], nudge: false, ...extra, id });

/** localStorage.setItem throws QuotaExceededError while window.__full is true. */
const quota = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if ((window as unknown as { __full?: boolean }).__full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      set.call(this, k, v);
    };
  });
};
const full = (page: Page, on: boolean): Promise<void> => page.evaluate((v) => void ((window as unknown as { __full: boolean }).__full = v), on);
const allKeys = (page: Page): Promise<Record<string, string>> => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) as string])));

/** Plays the story forward (the name prompt answered) until the predicate on the shell state holds. */
async function walkUntil(page: Page, info: Parameters<typeof advanceStory>[1], done: (s: Awaited<ReturnType<typeof stateOf>>) => boolean, what: string): Promise<void> {
  for (let i = 0; i < 60; i += 1) {
    const s = await stateOf(page);
    if (done(s)) return;
    if (s.story?.asking) await typeName(page, 'Lan');
    else if (s.shell.mode === 'story') await advanceStory(page, info);
    else await page.waitForTimeout(60);
  }
  throw new Error('never reached: ' + what);
}

async function newGame(page: Page): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-new').click();
  await page.locator('#confirm-new-yes').click();
}

async function useCode(page: Page, code: string): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await page.locator('#code-input').fill(code);
  await page.locator('#code-use').click();
}

test.describe('storage that fails and comes back', () => {
  for (const how of ['Chơi mới', 'a code for the first chapter'] as const)
  test(how + ' while writes fail, then the storage works again: the puzzle progress of earlier sessions does not come back into the new game', async ({ page }, info) => {
    await quota(page);
    await seedStorage(page, { [SAVE]: save(), [REAL('dec25')]: inProgress('dec25'), [REAL('yule')]: inProgress('yule'), [REAL('intro')]: inProgress('intro'), unrelated: 'keep' });
    await page.goto('/');
    await waitReady(page);
    await full(page, true);
    await walkUntil(page, info, (s) => !s.shell.storage.persistent, 'a failing write');
    if (how === 'Chơi mới') await newGame(page);
    else await useCode(page, encodeCode(0, 0, 'Lan'));
    await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('intro');
    await full(page, false);
    await walkUntil(page, info, (s) => s.shell.storage.persistent, 'the storage working again');
    const keys = await allKeys(page);
    expect(Object.keys(keys).filter((k) => k.startsWith('teo:v1:puzzle:')), 'the new game starts with no saved puzzle progress').toEqual([]);
    expect(keys.unrelated, 'a key of nobody\'s concern stays').toBe('keep');
    await page.reload();
    await waitReady(page);
    expect((await stateOf(page)).story?.chapter).toBe('intro');
  });

  test('two tabs: a tab whose writes failed and then work again does not write its older progress over what the other tab saved meanwhile', async ({ page, context }, info) => {
    await quota(page);
    await seedStorage(page, { [SAVE]: save() });
    await page.goto('/');
    await waitReady(page);
    const other = await context.newPage();
    await other.goto('/');
    await waitReady(other);
    await full(page, true);
    await walkUntil(page, info, (s) => !s.shell.storage.persistent, 'a failing write');
    await other.evaluate((raw) => localStorage.setItem('teo:v1:save', raw), save({ name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }));
    await full(page, false);
    await walkUntil(page, info, (s) => s.shell.storage.persistent, 'the storage working again');
    const stored = JSON.parse((await other.evaluate(() => localStorage.getItem('teo:v1:save'))) as string) as { furthest: string; chapter: string };
    expect(stored.furthest, 'the farthest chapter another tab saved is kept: ' + JSON.stringify(stored)).toBe('yule');
  });

  test('writes fail in the middle of a puzzle and work again: the board and the hints reach storage and a reload brings them back', async ({ page }, info) => {
    await quota(page);
    await seedStorage(page, {});
    await page.goto('/?preview=puzzle:dec25');
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe('dec25');
    await page.locator('.pz-option').last().click();
    await full(page, true);
    await page.waitForTimeout(300);
    await page.locator('#pz-hint').click();
    await expect(page.locator('#storage-warning')).toBeVisible();
    await full(page, false);
    await page.waitForTimeout(300);
    await page.locator('#pz-hint').click();
    await expect.poll(async () => (JSON.parse((await allKeys(page))[PREVIEW('dec25')] ?? 'null') as { opened?: number } | null)?.opened, 'after the storage is back the latest tier is stored').toBe(2);
    await page.reload();
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe('dec25');
    const g = (await stateOf(page)).game as unknown as { hints: number; phase: string };
    expect([g.phase, g.hints]).toEqual(['board', 2]);
  });
});

test.describe('what Chơi mới and a code clear, and what they leave', () => {
  const odd: Record<string, string> = {
    [REAL('intro')]: inProgress('intro'),
    [REAL('yule')]: inProgress('yule'),
    [REAL('dec25')]: inProgress('dec25'),
    [REAL('ending')]: inProgress('ending'),
    'teo:v1:puzzle:zzz': '{}',
    'teo:v1:puzzle:': '{}',
    'teo:v1:puzzle': '{}',
    'teo:v1:puzzles:dec25': '{}',
    'teo:v1:settings': JSON.stringify({ version: 1, textSpeed: 'fast' }),
    [PREVIEW('dec25')]: inProgress('dec25'),
    'preview:teo:v1:save': 'x',
    other: 'x',
  };
  const left = (all: Record<string, string>): string[] => Object.keys(all).filter((k) => !/^__seeded/u.test(k)).sort();

  test('Chơi mới removes every teo:v1:puzzle:<anything> key and keeps every other key, the review keys and the settings included', async ({ page }) => {
    await seedStorage(page, { [SAVE]: save({ chapter: 'dec25', furthest: 'dec25', scene: '' }), ...odd });
    await page.goto('/');
    await waitReady(page);
    await newGame(page);
    await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('intro');
    const keys = left(await allKeys(page));
    expect(keys.filter((k) => k.startsWith('teo:v1:puzzle:'))).toEqual([]);
    for (const keep of ['teo:v1:puzzle', 'teo:v1:puzzles:dec25', 'teo:v1:settings', PREVIEW('dec25'), 'preview:teo:v1:save', 'other']) expect(keys, keep).toContain(keep);
    const kept = await allKeys(page);
    expect(kept[PREVIEW('dec25')]).toBe(odd[PREVIEW('dec25')]);
    await expect.poll(async () => JSON.parse(((await allKeys(page))[SAVE] as string | undefined) ?? 'null')).toMatchObject({ chapter: 'intro', furthest: 'intro', name: '' });
  });

  for (const [chapter, gone, kept] of [
    [0, ['intro', 'yule', 'dec25', 'ending'], []],
    [2, ['yule', 'dec25', 'ending'], ['intro']],
    [5, ['dec25', 'ending'], ['intro', 'yule']],
    [19, ['ending'], ['intro', 'yule', 'dec25']],
  ] as const) {
    test('a code for chapter index ' + chapter + ' clears the puzzle progress from that chapter on and nothing else', async ({ page }) => {
      await seedStorage(page, { [SAVE]: save({ chapter: 'ending', furthest: 'ending', scene: '' }), ...odd });
      await page.goto('/');
      await waitReady(page);
      await useCode(page, encodeCode(chapter, 19, 'Lan'));
      await expect.poll(async () => (await stateOf(page)).shell.save.chapter).not.toBe('');
      await page.waitForTimeout(400);
      const keys = left(await allKeys(page));
      for (const id of gone) expect(keys, 'cleared ' + id).not.toContain(REAL(id));
      for (const id of kept) expect(keys, 'kept ' + id).toContain(REAL(id));
      for (const keep of ['teo:v1:puzzle', 'teo:v1:puzzles:dec25', 'teo:v1:settings', PREVIEW('dec25'), 'other']) expect(keys, keep).toContain(keep);
      for (const unknown of ['teo:v1:puzzle:zzz', 'teo:v1:puzzle:']) expect(keys.includes(unknown), 'an id the story does not know: ' + unknown + (chapter === 0 ? ' goes with a fresh start' : ' stays')).toBe(chapter !== 0);
    });
  }
});

test('a save from a newer build and the puzzle keys beside it stay byte for byte through play, Chơi mới and a code', async ({ page }, info) => {
  const newer = save({ schemaVersion: 2, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: 'x', future: { a: [1, 2] } });
  const puzzleKeys = { [REAL('dec25')]: inProgress('dec25'), [REAL('ending')]: inProgress('ending') };
  await seedStorage(page, { [SAVE]: newer, ...puzzleKeys });
  await page.goto('/');
  await waitReady(page);
  await expect(page.locator('#save-newer')).toBeVisible();
  await walkUntil(page, info, (s) => (s.story?.lineIndex ?? 0) >= 3, 'three lines read');
  const same = async (when: string): Promise<void> => {
    const keys = await allKeys(page);
    expect(keys[SAVE], when + ': the newer save').toBe(newer);
    for (const [k, v] of Object.entries(puzzleKeys)) expect(keys[k], when + ': ' + k).toBe(v);
  };
  await same('after play');
  await newGame(page);
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('intro');
  await same('after Chơi mới');
  await useCode(page, encodeCode(5, 5, 'Mai'));
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('dec25');
  await same('after a code');
  await page.reload();
  await waitReady(page);
  await same('after a reload');
});

for (const id of PUZZLES) {
  test(id + ': the review route reads and writes only its own preview: keys, and neither the real puzzle key nor the save change', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    const real = { [REAL(id)]: inProgress(id, { phase: 'reveal', opened: 5 }), [SAVE]: save({ furthest: 'yule', chapter: 'yule', scene: '' }), 'teo:v1:settings': JSON.stringify({ version: 1 }) };
    await openPreview(page, id, real);
    const g = (await stateOf(page)).game as unknown as { phase: string; hints: number };
    expect([g.phase, g.hints], 'the review opens fresh, not at the real key').toEqual(['predict', 0]);
    await helpPuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    const keys = await allKeys(page);
    for (const [k, v] of Object.entries(real)) if (k !== SAVE) expect(JSON.stringify(JSON.parse(keys[k] as string)), k).toBe(JSON.stringify(JSON.parse(v)));
    expect(JSON.parse(keys[SAVE] as string)).toMatchObject({ chapter: 'yule', furthest: 'yule' });
    expect(Object.keys(keys).filter((k) => k.startsWith('teo:v1:puzzle:')), 'no other real puzzle key appears').toEqual([REAL(id)]);
    expect(keys[PREVIEW(id)], 'the finished preview leaves nothing').toBeUndefined();
    expectClean(m, baseURL as string);
  });
}

test('a puzzle finished while writes fail: when the storage works again its old progress does not come back, and the puzzle starts clean after a reload', async ({ page }, info) => {
  await quota(page);
  await seedStorage(page, { [SAVE]: save() });
  await page.goto('/');
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
  await toBoard(page, info);
  const solution = puzzleFile('intro').solutions[0] as Cell[];
  await fillBoard(page, info, solution.map((c, i) => (i === 0 ? c : null)));
  await expect.poll(async () => (await allKeys(page))[REAL('intro')], 'the first piece reached storage').toBeTruthy();
  await full(page, true);
  await fillBoard(page, info, solution.map((c, i) => (i === 1 ? c : null)));
  await expect(page.locator('#storage-warning')).toBeVisible();
  await helpPuzzle(page, info);
  await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
  await full(page, false);
  await walkUntil(page, info, (s) => s.shell.storage.persistent, 'the storage working again');
  expect((await allKeys(page))[REAL('intro')], 'the finished puzzle leaves no progress behind').toBeUndefined();
  await page.reload();
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
  const g = (await stateOf(page)).game as unknown as PuzzleState;
  expect([g.phase, Object.values(g.board ?? {}).flat().length, g.hints]).toEqual(['predict', 0, 0]);
});

const HOSTILE_PUZZLE: [string, string][] = [
  ['not json', '{board:'],
  ['an array', '[1,2,3]'],
  ['null', 'null'],
  ['a board of numbers', JSON.stringify({ phase: 'board', board: [1, 2, 3, { a: 1 }, [[]], null] })],
  ['unknown pieces and one piece twice', JSON.stringify({ phase: 'board', board: [['zz', 'zz'], ['__proto__'], ['constructor', 'toString']] })],
  ['every piece in the first slot', JSON.stringify({ phase: 'board', board: [Array.from({ length: 40 }, (_, i) => 'p' + i)] })],
  ['counters out of range', JSON.stringify({ phase: 'board', opened: 99, wrongRun: -5, wrongTotal: 1e12, checks: 'x', nudge: 'yes', cWrong: [], found: 'all' })],
  ['a nudge without a wrong run', JSON.stringify({ phase: 'board', wrongRun: 0, opened: 0, nudge: true })],
  ['a phase from another puzzle', JSON.stringify({ phase: 'conclusion', fills: [9, -1, 'x', null, 1.5] })],
  ['a phase that does not exist', JSON.stringify({ phase: 'verdict' })],
  ['a prototype key', '{"__proto__":{"phase":"reveal"},"phase":"board"}'],
  ['a huge value', JSON.stringify({ phase: 'board', pad: 'x'.repeat(300_000) })],
];

for (const id of PUZZLES) {
  test(id + ': a damaged or foreign progress value opens a sane puzzle (no error, every piece in one place, no tier beyond the ladder) that Cúc Cu can still finish', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    const file = puzzleFile(id);
    await page.goto('/');
    await waitReady(page);
    for (const [label, raw] of HOSTILE_PUZZLE) {
      await page.evaluate(([k, v]) => localStorage.setItem(k as string, v as string), [PREVIEW(id), raw]);
      await page.goto('/?preview=puzzle:' + id);
      await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe(id);
      const g = (await stateOf(page)).game as unknown as PuzzleState;
      expect(['predict', 'demo', 'board', 'reveal', 'conclusion'], label).toContain(g.phase);
      expect(g.hints, label + ': hints within the ladder').toBeLessThanOrEqual(file.hints.length);
      expect(g.wrong, label).toBeGreaterThanOrEqual(0);
      if (g.board && g.bank) {
        const all = [...Object.values(g.board).flat(), ...g.bank].sort();
        expect(all, label + ': a partition of the pieces').toEqual(file.tokens.map((x) => x.id).sort());
        for (const s of file.slots) {
          const cap = s.cap === 'any' ? Infinity : typeof s.cap === 'number' ? s.cap : 1;
          expect((g.board[s.id] ?? []).length, label + ': slot ' + s.id + ' over its cap').toBeLessThanOrEqual(cap);
        }
      }
    }
    await page.evaluate((k) => localStorage.removeItem(k), PREVIEW(id));
    await page.goto('/?preview=puzzle:' + id);
    await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe(id);
    await helpPuzzle(page, info);
    expectClean(m, baseURL as string);
  });
}

const FOREIGN_SAVES: [string, string, string][] = [
  ['null', 'null', 'intro'],
  ['an array', '[]', 'intro'],
  ['a string', '"yule"', 'intro'],
  ['an empty object', '{}', 'intro'],
  ['no schema version', JSON.stringify({ name: 'A', furthest: 'yule', chapter: 'yule', scene: '' }), 'intro'],
  ['a schema version as text', save({ schemaVersion: '1', chapter: 'yule', furthest: 'yule', scene: '' }), 'intro'],
  ['a fractional schema version', save({ schemaVersion: 1.5 }), 'intro'],
  ['a negative schema version', save({ schemaVersion: -1 }), 'intro'],
  ['a chapter that does not exist', save({ chapter: 'nope', furthest: 'nope' }), 'intro'],
  ['a chapter after the farthest', save({ chapter: 'yule', furthest: 'intro', scene: '' }), 'intro'],
  ['a scene with capitals', save({ chapter: 'yule', furthest: 'yule', scene: 'SANH-DAI' }), 'intro'],
  ['a scene of 65 characters', save({ chapter: 'yule', furthest: 'yule', scene: 'a'.repeat(65) }), 'intro'],
  ['a name that is a number', save({ name: 42, chapter: 'yule', furthest: 'yule', scene: '' }), 'intro'],
  ['text longer than 4096 bytes', save({ name: 'Lan', chapter: 'yule', furthest: 'yule', scene: '', pad: 'x'.repeat(5000) }), 'intro'],
  ['the version before migration', JSON.stringify({ schemaVersion: 0, name: 'Lan', chapter: 'yule', scene: '' }), 'yule'],
  ['an unknown scene of a real chapter', save({ chapter: 'yule', furthest: 'yule', scene: 'khong-co' }), 'yule'],
  ['the end scene of a chapter that is not the last', save({ chapter: 'yule', furthest: 'yule', scene: 'end' }), 'yule'],
];

for (const [label, raw, chapter] of FOREIGN_SAVES) {
  test('save value (' + label + '): the story opens at ' + chapter + ' without an error and the next write is a valid save', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await seedStorage(page, { [SAVE]: raw });
    await page.goto('/');
    await waitReady(page);
    expect((await stateOf(page)).story?.chapter).toBe(chapter);
    await walkUntil(page, info, (s) => (s.story?.lineIndex ?? 0) >= 2 || s.story?.chapter !== chapter, 'two lines');
    await page.reload();
    await waitReady(page);
    expect((await stateOf(page)).story?.chapter, 'after a write and a reload').toBe(chapter);
    const stored = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE)) as string) as Record<string, unknown>;
    expect(Object.keys(stored).sort(), 'five documented keys').toEqual(['chapter', 'furthest', 'name', 'scene', 'schemaVersion']);
    expectClean(m, baseURL as string);
  });
}

test('Chơi mới from the letter screen while the letter is still loading: the late letter does not take the screen back and the new game plays on', async ({ page }) => {
  await page.route(/\/assets\/pz-ending-[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await route.continue();
  });
  await seedStorage(page, { [SAVE]: JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'end' }) });
  await page.goto('/');
  await waitReady(page);
  await page.locator('#end-card').click();
  await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('namecard');
  await newGame(page);
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('intro');
  await page.waitForTimeout(4200);
  const s = await stateOf(page);
  expect([s.shell.mode, s.story?.chapter]).toEqual(['story', 'intro']);
  expect(await page.locator('#namecard-screen').isHidden(), 'the letter screen stays hidden').toBe(true);
  expect(await page.locator('#namecard-img').getAttribute('src'), 'no letter image was attached').toBeNull();
});
