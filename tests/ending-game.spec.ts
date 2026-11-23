import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from '@playwright/test';
import { makeCode } from '../src/code.ts';
import { ORDER } from '../src/order.ts';
import { expectClean, monitor } from './support/helpers.ts';
import { openAtGame } from './challenge-ch25/helpers.ts';
import { advanceStory, openAtMinigame, stateOf, storyOf, typeName, waitReady } from './support/play.ts';
import { answerPredict, check, fillBoard, press, puzzleFile, skipDemo, solvePuzzle, waitPuzzlePhase, type Cell } from './support/puzzle.ts';
import { chapterOf } from './support/script.ts';

const script = chapterOf('ending');
const END_CODE = makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' });

test.describe('chapter 20 from a continue code to the end screen', () => {
  const lines = script.scenes.flatMap((s) => s.beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text.replaceAll('{ten}', 'Lan')] : [])));

  test('the code opens the chapter; the game, timeline, name card, code and end screen follow, with every line once and no "đang được viết"', async ({ page, baseURL }, info) => {
    test.setTimeout(180_000);
    const m = monitor(page);
    await page.goto('/');
    await waitReady(page);
    await page.locator('#menu-open').click();
    await page.locator('#menu-code').click();
    await page.locator('#code-input').fill(END_CODE);
    await page.locator('#code-use').click();
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('ending');
    await expect.poll(async () => (await storyOf(page)).scene, 'the chapter starts at its first scene').toBe(script.scenes[0]?.id);
    const seen: string[] = [];
    const modes: string[] = [];
    let key = '';
    let codeShown = '';
    for (let i = 0; i < 220; i += 1) {
      const s = await stateOf(page);
      if (modes.at(-1) !== s.shell.mode) modes.push(s.shell.mode);
      if (s.shell.mode === 'end') break;
      if (s.game) {
        await solvePuzzle(page, info);
        continue;
      }
      if (s.shell.mode === 'minigame') await page.waitForTimeout(50);
      else if (s.shell.mode === 'timeline') await page.locator('#timeline-next').click();
      else if (s.shell.mode === 'namecard') {
        await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
        await page.locator('#namecard-next').click();
      } else if (s.shell.mode === 'code') {
        codeShown = await page.locator('#code-screen-text').inputValue();
        await expect(page.locator('#code-screen-text')).toBeVisible();
        await page.locator('#code-screen-next').click();
      } else if (s.story?.asking) await typeName(page, 'Lan');
      else {
        const at = s.story?.scene + ':' + s.story?.lineIndex;
        if (s.story?.line && at !== key) {
          key = at;
          seen.push(s.story.line.text);
        }
        await advanceStory(page, info);
      }
    }
    expect(seen, 'every line of chapter 20 once, in order').toEqual(lines);
    expect(modes.filter((x) => x !== 'story')).toEqual(['minigame', 'timeline', 'namecard', 'code', 'end']);
    expect(codeShown, '@code shows the finished code, which returns to the end screen').toBe(makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true }));
    const end = await stateOf(page);
    expect(end.shell.mode).toBe('end');
    expect((end.story as unknown as { screen: { kind: string } }).screen.kind).toBe('end');
    await expect(page.locator('#end-screen')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('đang được viết');
    await expect(page.locator('#end-text')).toContainText('Lan');
    for (const name of ['Sổ nguồn', 'Xem lại thư trả lời', 'Chơi mới']) await expect(page.locator('#end-screen').getByRole('button', { name })).toBeVisible();
    expect(end.shell.save).toMatchObject({ name: 'Lan', chapter: 'ending', furthest: 'ending' });
    expectClean(m, baseURL!);

    await page.locator('#end-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await expect(page.locator('#notebook-list .card')).toHaveCount(ORDER.length - 2);
    await page.keyboard.press('Escape');
    await expect(page.locator('#notebook-dialog')).toBeHidden();

    await page.locator('#end-card').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('namecard');
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean; name?: string } }).screen.ready, { timeout: 15_000 }).toBe(true);
    expect(((await stateOf(page)).story as unknown as { screen: { name: string } }).screen.name).toBe('Lan');
    await page.locator('#namecard-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('end');

    await page.locator('#end-new').click();
    await expect(page.locator('#confirm-new')).toBeVisible();
    await page.locator('#confirm-new-no').click();
    expect((await stateOf(page)).shell.mode, 'Giữ tiến độ stays on the end screen').toBe('end');
    await page.locator('#end-new').click();
    await page.locator('#confirm-new-yes').click();
    await expect.poll(async () => (await storyOf(page)).chapter).toBe('intro');
    expect((await stateOf(page)).shell.save).toMatchObject({ name: '', chapter: 'intro', furthest: 'intro' });
  });
});

test.describe('R7 gag budget and size', () => {
  const sentences = (text: string): string[] => text.split(/(?<=[.!?…])\s+/).map((s) => s.trim());

  test('"Nguồn đâu?" as a sentence of its own is said at most once per chapter, never in chapter 5, by Cúc Cu in chapters 1 to 13 and by Quạ Đồn in chapter 20 (bible §8)', () => {
    const askers = ORDER.map((id) => {
      if (!existsSync('story/chapters/' + id + '.md')) return [];
      return chapterOf(id).scenes.flatMap((s) => s.beats.flatMap((b) => ((b.t === 'say' || b.t === 'narr') && sentences(b.text).some((x) => x.replace(/[.!…]+$/, '') === 'Nguồn đâu?') ? [b.t === 'say' ? b.who : 'narration'] : [])));
    });
    for (const [i, who] of askers.entries()) expect(who.length, 'chapter ' + (i + 1) + ' says it at most once').toBeLessThanOrEqual(1);
    expect(askers[4], 'chapter 5 never says it').toEqual([]);
    for (const who of askers.slice(0, 13)) expect(who.every((w) => w === 'Cúc Cu')).toBe(true);
    expect(askers[19], 'the ending keeps its one, from Quạ Đồn').toEqual(['Quạ Đồn']);
  });

  test('size-limit counts the ending mini game with its script and both built chunks are under 150 kB gzip', () => {
    const cfg = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as { path: string | string[]; limit: string }[];
    const entry = cfg.find((e) => [e.path].flat().some((p) => p.includes('dist/assets/pz-ending-')));
    expect(entry, 'an entry for dist/assets/pz-ending-*.js').toBeDefined();
    expect([entry?.path].flat()).toContain('dist/assets/chapter-ending-*.js');
    expect(entry?.limit).toBe('150 kB');
    const files = readdirSync('dist/assets').filter((f) => /^(chapter-|pz-)ending-.*\.js$/.test(f));
    expect(files.length).toBe(2);
    const total = files.reduce((n, f) => n + gzipSync(readFileSync('dist/assets/' + f)).length, 0);
    expect(total).toBeLessThanOrEqual(150_000);
  });
});

test.describe('Sổ nguồn while the gears are on the board', () => {
  const GEARS = /bánh răng/;

  test('the Menu keeps the Sổ nguồn shut with one line while the ending board is up, and opens it again from the conclusion on', async ({ page }, info) => {
    test.setTimeout(150_000);
    await openAtGame(page, info);
    const file = puzzleFile('ending');
    const shut = async (): Promise<void> => {
      await page.locator('#menu-open').click();
      await page.locator('#menu-notebook').click();
      await expect(page.locator('#notebook-dialog')).toBeHidden();
      await expect(page.locator('#menu')).toBeVisible();
      await expect(page.locator('#menu-note')).toBeVisible();
      await expect(page.locator('#menu-note')).toHaveText(GEARS);
      expect(((await page.locator('#menu-note').textContent()) ?? '').includes('\n')).toBe(false);
      await page.locator('#menu-continue').click();
      await expect(page.locator('#menu')).toBeHidden();
    };
    await waitPuzzlePhase(page, 'predict');
    await shut();
    await answerPredict(page, info);
    await skipDemo(page, info);
    await waitPuzzlePhase(page, 'board');
    await shut();
    await fillBoard(page, info, file.solutions[0] as Cell[]);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await press(page.locator('.pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    await page.locator('#menu-open').click();
    await expect(page.locator('#menu-note')).toBeHidden();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await expect(page.locator('#notebook-list .card')).toHaveCount(ORDER.length - 2);
  });

  test('the same Menu entry opens the Sổ nguồn during the board of any other chapter', async ({ page }, info) => {
    test.setTimeout(120_000);
    await openAtMinigame(page, info);
    await expect.poll(async () => ((await stateOf(page)).game as unknown as { phase: string }).phase).toBe('predict');
    await page.locator('#menu-open').click();
    await page.locator('#menu-notebook').click();
    await expect(page.locator('#notebook-dialog')).toBeVisible();
    await expect(page.locator('#menu-note')).toBeHidden();
  });
});
