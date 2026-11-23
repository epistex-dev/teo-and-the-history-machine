import { expect, test, type Page } from '@playwright/test';
import { makeCode, parseCode } from '../src/code.ts';
import { lastBackdrop } from '../src/scene-state.ts';
import { freshSave, mergeSave, readSave } from '../src/save.ts';
import { createSafeStorage } from '../src/storage.ts';
import type { ChapterScript } from '../src/story/types.ts';
import { openAtCode, openAtEnd, screenOf } from './challenge-ch25/helpers.ts';
import { advanceStory, openAtMinigame, reachMinigame, seedSave, START_OF_MINIGAME, stateOf, storyOf, typeName, waitReady } from './support/play.ts';
import { fillBoard, puzzleFile, puzzleOf, toBoard } from './support/puzzle.ts';
import { intro } from './support/script.ts';

const PUZZLE = 'teo:v1:puzzle:';

function backend(data = new Map<string, string>()): Storage {
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  } as unknown as Storage;
}

const modeOf = async (page: Page): Promise<string> => (await stateOf(page)).shell.mode;

async function newGame(page: Page): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-new').click();
  await page.locator('#confirm-new-yes').click();
}

async function enterCode(page: Page, code: string): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await page.locator('#code-input').fill(code);
  await page.locator('#code-use').click();
}

const keysOf = (page: Page): Promise<string[]> => page.evaluate((prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)).sort(), PUZZLE);

test.describe('safe storage with a healthy backend', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('a key another handle removed stays removed: RAM never brings it back', () => {
    const data = new Map<string, string>();
    const a = createSafeStorage(() => backend(data));
    const b = createSafeStorage(() => backend(data));
    a.setItem('k', 'old');
    b.removeItem('k');
    expect(a.getItem('k')).toBeNull();
    expect(data.has('k')).toBe(false);
  });

  test('a key the player cleared through the same handle stays cleared after a read', () => {
    const store = createSafeStorage(() => backend());
    store.setItem(PUZZLE + 'intro', '{}');
    store.removeItem(PUZZLE + 'intro');
    expect(store.getItem(PUZZLE + 'intro')).toBeNull();
    expect(store.keys(PUZZLE)).toEqual([]);
  });

  test('keys lists the stored keys under a prefix, and the RAM ones once the backend degraded', () => {
    const store = createSafeStorage(() => backend());
    store.setItem(PUZZLE + 'intro', '1');
    store.setItem(PUZZLE + 'yule', '1');
    store.setItem('teo:v1:save', '1');
    expect(store.keys(PUZZLE).sort()).toEqual([PUZZLE + 'intro', PUZZLE + 'yule']);
    let failing = false;
    const flaky = createSafeStorage(() => ({ ...backend(), setItem: () => { if (failing) throw new DOMException('full', 'QuotaExceededError'); } }) as Storage);
    failing = true;
    flaky.setItem(PUZZLE + 'saturnalia', '1');
    expect(flaky.persistent).toBe(false);
    expect(flaky.keys(PUZZLE)).toEqual([PUZZLE + 'saturnalia']);
    flaky.removeItem(PUZZLE + 'saturnalia');
    expect(flaky.keys(PUZZLE)).toEqual([]);
  });
});

test.describe('continue code', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  const data = { name: 'Lan', chapter: 'yule', furthest: 'tree' };

  for (const [label, mark] of [['zero width space', '\u200b'], ['word joiner', '\u2060'], ['byte order mark', '\ufeff'], ['soft hyphen', '\u00ad'], ['left-to-right mark', '\u200e']] as const) {
    test(`a pasted code with a ${label} inside still parses`, () => {
      const code = makeCode(data);
      const mid = Math.floor(code.length / 2);
      expect(parseCode(code.slice(0, mid) + mark + code.slice(mid) + mark)).toEqual({ ok: true, data });
      expect(parseCode(mark + code)).toEqual({ ok: true, data });
    });
  }

  test('the code of the finished game marks "finished" and goes back to the ending, an older code of the ending does not', () => {
    const finished = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true });
    expect(parseCode(finished)).toEqual({ ok: true, data: { name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true } });
    const legacy = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
    expect(legacy).not.toBe(finished);
    expect(parseCode(legacy)).toEqual({ ok: true, data: { name: 'Lan', chapter: 'ending', furthest: 'ending' } });
  });

  test('a code of a chapter before the ending never carries the finished mark', () => {
    const code = makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule', finished: true });
    expect(parseCode(code)).toMatchObject({ ok: true, data: { chapter: 'yule' } });
    expect((parseCode(code) as { data: { finished?: boolean } }).data.finished).toBeUndefined();
  });
});

test.describe('scene state', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  const script = {
    id: 'x',
    title: 'x',
    scenes: [
      { id: 'a', beats: [{ t: 'bg', id: 'one' }, { t: 'narr', text: 'a' }] },
      { id: 'b', beats: [{ t: 'narr', text: 'b' }, { t: 'bg', id: 'two' }, { t: 'narr', text: 'c' }] },
      { id: 'c', beats: [{ t: 'narr', text: 'd' }] },
    ],
  } as unknown as ChapterScript;

  test('entering a scene takes the backdrop of the beats before it, not one that comes later in the same scene', () => {
    expect(lastBackdrop(script, 0)).toBeNull();
    expect(lastBackdrop(script, 1)).toBe('one');
    expect(lastBackdrop(script, 2)).toBe('two');
  });
});

test.describe('puzzle progress and the new game', () => {
  test('Chơi mới after a piece was placed: the puzzle comes back at the predict step with an empty board', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openAtMinigame(page, info);
    await toBoard(page, info);
    const file = puzzleFile('intro');
    await fillBoard(page, info, [[file.tokens[0]!.id]]);
    await expect.poll(() => keysOf(page)).toEqual([PUZZLE + 'intro']);
    await newGame(page);
    await expect.poll(() => keysOf(page), 'Chơi mới clears the puzzle progress').toEqual([]);
    await expect.poll(async () => (await storyOf(page)).scene).toBe(intro.scenes[0]?.id);
    await reachMinigame(page, info);
    const game = await puzzleOf(page);
    expect(game.phase).toBe('predict');
    expect(Object.values(game.board ?? {}).flat()).toEqual([]);
  });

  test('Chơi mới clears every teo:v1:puzzle:* key and nothing else', async ({ page }) => {
    await seedSave(page, { ...START_OF_MINIGAME, name: 'Lan' });
    await page.goto('/');
    await waitReady(page);
    await page.evaluate((prefix) => {
      for (const id of ['intro', 'yule', 'ending', 'not-a-chapter']) localStorage.setItem(prefix + id, '{}');
      localStorage.setItem('teo:v1:other', 'keep');
    }, PUZZLE);
    await newGame(page);
    await expect.poll(() => keysOf(page)).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('teo:v1:other'))).toBe('keep');
  });

  test('a code clears the puzzle progress of its chapter and the chapters after it, and keeps the earlier ones', async ({ page }) => {
    await seedSave(page, { ...START_OF_MINIGAME, name: 'Lan' });
    await page.goto('/');
    await waitReady(page);
    await page.evaluate((prefix) => {
      for (const id of ['intro', 'saturnalia', 'yule', 'ending']) localStorage.setItem(prefix + id, '{}');
    }, PUZZLE);
    await enterCode(page, makeCode({ name: 'Lan', chapter: 'saturnalia', furthest: 'yule' }));
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('saturnalia');
    expect(await keysOf(page)).toEqual([PUZZLE + 'intro']);
  });
});

test.describe('a chunk that arrives late, a chapter that loads', () => {
  test('Chơi mới while the puzzle chunk is still loading: the late chunk does not open the old puzzle over the new game', async ({ page }, info) => {
    test.setTimeout(120_000);
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/assets/pz-intro-*.js', async (route) => {
      await gate;
      await route.continue();
    });
    await seedSave(page, { ...START_OF_MINIGAME, name: 'Lan' });
    await page.goto('/');
    await waitReady(page);
    for (let i = 0; i < 60; i += 1) {
      if ((await storyOf(page)).asking) await typeName(page, 'Lan');
      else
        try {
          await advanceStory(page, info);
        } catch {
          break;
        }
    }
    const beats = intro.scenes.find((sc) => sc.beats.some((b) => b.t === 'minigame'))?.beats ?? [];
    const last = beats.slice(0, beats.findIndex((b) => b.t === 'minigame')).filter((b) => b.t === 'say' || b.t === 'narr').at(-1) as { text: string };
    expect((await storyOf(page)).line?.text, 'the story waits on the last line before the puzzle').toBe(last.text);
    expect((await stateOf(page)).game, 'the chunk is held back').toBeNull();
    await newGame(page);
    await expect.poll(async () => (await storyOf(page)).scene).toBe(intro.scenes[0]?.id);
    release();
    await page.waitForTimeout(1200);
    const s = await stateOf(page);
    expect(s.shell.mode, 'the new game stays on its story').toBe('story');
    expect(s.game).toBeNull();
    expect(s.story?.scene).toBe(intro.scenes[0]?.id);
    await expect(page.locator('#stage')).toBeHidden();
    await expect(page.locator('.pz')).toHaveCount(0);
  });

  test('a code for a chapter whose script is still loading shows the loading mode, not the old screen', async ({ page }, info) => {
    test.setTimeout(120_000);
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/assets/chapter-saturnalia-*.js', async (route) => {
      await gate;
      await route.continue();
    });
    await openAtMinigame(page, info);
    expect(await modeOf(page)).toBe('minigame');
    await enterCode(page, makeCode({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' }));
    await expect.poll(() => modeOf(page)).toBe('loading');
    await expect(page.locator('#stage')).toBeHidden();
    await expect(page.locator('#story')).toBeHidden();
    release();
    await expect.poll(() => modeOf(page)).toBe('story');
    expect((await storyOf(page)).chapter).toBe('saturnalia');
  });
});

test.describe('the code of the finished game', () => {
  test('the code screen of the ending shows the finished code; entering it on a fresh device returns to the end screen', async ({ page, browser }, info) => {
    test.setTimeout(120_000);
    await openAtCode(page, info);
    const shown = await page.locator('#code-screen-text').inputValue();
    expect(parseCode(shown)).toEqual({ ok: true, data: { name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true } });
    const other = await (await browser.newContext({ ...info.project.use })).newPage();
    try {
      await other.goto('/');
      await waitReady(other);
      await enterCode(other, shown);
      await expect.poll(() => modeOf(other)).toBe('end');
      await expect(other.locator('#end-screen')).toBeVisible();
      await expect(other.locator('#end-text')).toContainText('Lan');
      expect((await stateOf(other)).shell.save).toMatchObject({ chapter: 'ending', furthest: 'ending', scene: 'end', name: 'Lan' });
      await other.reload();
      await waitReady(other);
      expect(await modeOf(other)).toBe('end');
    } finally {
      await other.context().close();
    }
  });

  test('"Nhập mã" on the end screen shows the finished code', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openAtEnd(page, info);
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    expect(parseCode(await page.locator('#code-mine').inputValue())).toMatchObject({ ok: true, data: { chapter: 'ending', finished: true } });
    expect(await screenOf(page)).toMatchObject({ kind: 'end' });
  });
});

test.describe('the save marks solved puzzles', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  const read = (json: string) => readSave(json) as unknown as { puzzles?: string[] } | null;

  test('readSave keeps the chapter ids of solved puzzles and drops junk, duplicates and unknown ids', () => {
    const save = read(JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'tree', chapter: 'tree', scene: '', puzzles: ['tree', 'tree', 'ghost', 7, null, '__proto__'] }));
    expect(save?.puzzles).toEqual(['tree']);
  });

  test('readSave drops the mark when it is not an array of ids, and a save without one stays clean', () => {
    expect(read(JSON.stringify({ schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: '', puzzles: 'tree' }))?.puzzles).toBeUndefined();
    expect(read(JSON.stringify({ schemaVersion: 1, name: '', furthest: 'intro', chapter: 'intro', scene: '' }))?.puzzles).toBeUndefined();
  });

  test('mergeSave unions the marks of both sides', () => {
    const order = () => 0;
    const merged = (a: unknown, b: unknown) => mergeSave(a as never, b as never, () => 0) as unknown as { puzzles?: string[] } | null;
    expect(merged({ ...freshSave(), puzzles: ['intro'] }, { ...freshSave(), puzzles: ['intro', 'tree'] })?.puzzles).toEqual(['intro', 'tree']);
    expect(merged({ ...freshSave(), puzzles: ['intro'] }, freshSave())?.puzzles).toEqual(['intro']);
    expect(merged(freshSave(), freshSave())?.puzzles).toBeUndefined();
  });
});
