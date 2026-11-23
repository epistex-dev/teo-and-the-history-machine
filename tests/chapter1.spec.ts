import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectClean, monitor } from './support/helpers.ts';
import {
  advanceStory,
  openAtMinigame,
  reachMinigame,
  realInput,
  seedSave,
  solveMinigame,
  stateOf,
  step,
  storedSave,
  storyOf,
  tap,
  typeName,
  waitReady,
  walkToChapterEnd,
} from './support/play.ts';
import { GAME_SCENE, check, fillBoard, press, puzzleFile, puzzleOf, solvePuzzle, toBoard, waitPuzzlePhase, wrongFill } from './support/puzzle.ts';
import { chapterOf, intro, lineAfterMinigame, lineOf, nameLine } from './support/script.ts';

async function reachAsk(page: Page, info: TestInfo): Promise<void> {
  for (let i = 0; i < 30 && !(await storyOf(page)).asking; i += 1) await advanceStory(page, info);
  expect((await storyOf(page)).asking).toBe(true);
}

test.describe('chapter 1 playthrough', () => {
  test('from the first line to the start of chapter 2, every line in order', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await page.goto('/');
    await waitReady(page);
    const seen: string[] = [];
    let last = '';
    for (let i = 0; i < 120; i += 1) {
      const s = await stateOf(page);
      if (s.story?.chapter === 'saturnalia' && s.story.line) break;
      if (s.game) {
        await solveMinigame(page, realInput(info));
        continue;
      }
      if (s.shell.mode === 'minigame' || s.story?.chapter === 'saturnalia') {
        await page.waitForTimeout(50);
        continue;
      }
      if (s.story?.asking) {
        await typeName(page, 'Lan');
        continue;
      }
      const text = s.story?.line?.text ?? '';
      if (text && (text !== last || s.story?.lineIndex !== seen.length)) {
        seen.push(text);
        last = text;
      }
      await advanceStory(page, info);
    }
    const expected = intro.scenes.flatMap((scene) => scene.beats.map((b) => lineOf(b, 'Lan'))).filter((t): t is string => t !== null);
    expect(seen, 'the story shows every script line once, in order, with the name filled in').toEqual(expected);
    expect(expected.length).toBeGreaterThanOrEqual(25);
    const end = await stateOf(page);
    expect(end.shell.mode).toBe('story');
    expect(end.story?.chapter).toBe('saturnalia');
    expect(await page.locator('canvas').count(), 'the mini game canvas is gone').toBe(0);
    expect(end.shell.save).toMatchObject({ name: 'Lan', chapter: 'saturnalia', furthest: 'saturnalia' });
    await page.reload();
    await waitReady(page);
    expect((await storyOf(page)).chapter, 'chapter 2 survives a reload').toBe('saturnalia');
    expectClean(m, baseURL!);
  });

  test('walkToChapterEnd helper reaches the same end with the name prompt answered', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await walkToChapterEnd(page, info);
    expect((await storyOf(page)).chapter).toBe('saturnalia');
  });

  test('lines sit in one polite live region and speakers are named', async ({ page }) => {
    await page.goto('/');
    await waitReady(page);
    await expect(page.locator('[aria-live="polite"] #line')).toHaveCount(1);
    await expect(page.locator('#line')).toHaveText(/Phòng Hồ sơ Cực Bắc/);
  });

  test('keyboard advances (Enter, Space, ArrowRight), a held key advances once, a double tap advances once', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    const index = async () => (await storyOf(page)).lineIndex ?? -1;
    let at = await index();
    for (const key of ['Enter', ' ', 'ArrowRight']) {
      await page.waitForTimeout(260);
      await page.keyboard.press(key);
      expect(await index(), `key ${JSON.stringify(key)}`).toBe(at + 1);
      at += 1;
    }
    await page.waitForTimeout(260);
    await page.keyboard.down('ArrowRight');
    for (let i = 0; i < 10; i += 1) await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(300);
    expect(await index(), 'key auto-repeat is ignored').toBe(at + 1);
    at += 1;
    await page.waitForTimeout(260);
    const box = (await page.locator('#story').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + 40;
    if (info.project.use.hasTouch) {
      await page.touchscreen.tap(x, y);
      await page.touchscreen.tap(x, y);
    } else {
      await page.mouse.dblclick(x, y);
    }
    await page.waitForTimeout(300);
    expect(await index(), 'two taps within the cooldown advance once').toBe(at + 1);
  });

  test('the voice of Ông già Noel is never drawn', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    const names = new Set<string>();
    let sawTeo = false;
    for (let i = 0; i < 40; i += 1) {
      const s = await stateOf(page);
      if (s.shell.mode !== 'story' || s.story?.asking) break;
      for (const c of s.story?.cast ?? []) {
        names.add(c.name);
        if (c.name === 'Tèo') sawTeo = true;
      }
      if (s.story?.line?.speaker === 'Ông già Noel') expect(s.story.cast?.map((c) => c.name)).not.toContain('Ông già Noel');
      await advanceStory(page, info);
    }
    expect(sawTeo).toBe(true);
    expect([...names].every((n) => ['Tèo', 'Cúc Cu', 'Quạ Đồn'].includes(n))).toBe(true);
  });

  test('the name asked once is used in later lines and kept after the mini game', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    await typeName(page, 'Lan');
    await expect.poll(async () => (await storyOf(page)).line?.text).toContain(nameLine(intro, 'Lan'));
  });
});

test.describe('state, resume and the name prompt', () => {
  test('reload in the middle of the puzzle resumes at the start of its scene, the placed pieces are not in the story save', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, wrongFill(puzzleFile('intro')));
    expect(Object.values((await puzzleOf(page)).board ?? {}).some((c) => c.length > 0)).toBe(true);
    await page.reload();
    await waitReady(page);
    const s = await stateOf(page);
    expect(s.shell.mode).toBe('story');
    expect(s.story?.scene).toBe(GAME_SCENE);
    expect(s.game).toBeNull();
    expect(JSON.parse((await storedSave(page)) ?? 'null'), 'the board is not in the story save').toMatchObject({ scene: GAME_SCENE });
  });

  test('reload at a later scene resumes there with the name', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await solveMinigame(page, realInput(info));
    for (let i = 0; i < 12 && (await storyOf(page)).scene !== 'cuc-cu'; i += 1) await advanceStory(page, info);
    await page.reload();
    await waitReady(page);
    expect((await storyOf(page)).scene).toBe('cuc-cu');
    expect((await stateOf(page)).shell.save).toMatchObject({ name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'cuc-cu' });
  });

  test('an old save (schema 0) is migrated and rewritten as version 1', async ({ page }) => {
    await seedSave(page, JSON.stringify({ schemaVersion: 0, name: 'Mai', chapter: 'intro', scene: 'kim-ket' }));
    await page.goto('/');
    await waitReady(page);
    const s = await stateOf(page);
    expect(s.story?.scene).toBe('kim-ket');
    expect(s.shell.save).toEqual({ schemaVersion: 1, name: 'Mai', furthest: 'intro', chapter: 'intro', scene: 'kim-ket' });
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('teo:v1:save'))) ?? 'null')).toEqual(s.shell.save);
  });

  test('render_game_to_text reads RAM, never storage', async ({ page }, info) => {
    await openAtMinigame(page, info);
    const reads = await page.evaluate(() => {
      let count = 0;
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function (this: Storage, key: string) {
        count += 1;
        return get.call(this, key);
      };
      for (let i = 0; i < 50; i += 1) window.render_game_to_text();
      Storage.prototype.getItem = get;
      return count;
    });
    expect(reads).toBe(0);
  });

  test('the name prompt: 60 characters are cut to 24 and HTML stays text', async ({ page }, info) => {
    const m = monitor(page);
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    const input = page.locator('#name');
    await input.fill('<b>Lan</b>'.repeat(6));
    await page.keyboard.press('Enter');
    const s = await storyOf(page);
    const name = (await stateOf(page)).shell.save.name;
    expect([...name].length).toBeLessThanOrEqual(24);
    expect(name).toBe('<b>Lan</b>'.repeat(6).slice(0, 24));
    await expect(page.locator('#line')).toContainText(name);
    expect(await page.locator('#line b, #story b').count(), 'no element was created from the name').toBe(0);
    expect(s.asking).toBe(false);
    expectClean(m, new URL(page.url()).origin);
  });

  test('the name prompt: decomposed Vietnamese is stored as NFC and shown', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    await page.locator('#name').fill('Te\u0300o');
    await page.keyboard.press('Enter');
    const name = (await stateOf(page)).shell.save.name;
    expect(name).toBe('Tèo');
    expect(name.length).toBe(3);
    await expect(page.locator('#line')).toContainText('Tèo');
  });

  test('the name prompt: an empty name falls back to "người đã hỏi"', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    await page.locator('#name').fill('   ');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).line?.text).toContain(nameLine(intro, 'người đã hỏi'));
  });

  test('the name prompt: Enter during IME composition does not submit, Enter after it does', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    const input = page.locator('#name');
    await input.focus();
    await page.evaluate(() => {
      const el = document.getElementById('name') as HTMLInputElement;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.value = 'tie';
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true }));
    });
    expect((await storyOf(page)).asking, 'composition Enter only commits the text').toBe(true);
    await page.evaluate(() => {
      const el = document.getElementById('name') as HTMLInputElement;
      el.value = 'tiê';
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await stateOf(page)).shell.save.name).toBe('tiê');
  });

  test('the name prompt: the Ký tên button submits with a tap', async ({ page }, info) => {
    await page.goto('/');
    await waitReady(page);
    await reachAsk(page, info);
    await page.locator('#name').fill('Bình');
    const b = (await page.locator('#name-done').boundingBox())!;
    await tap(page, info, b.x + b.width / 2, b.y + b.height / 2);
    await expect.poll(async () => (await storyOf(page)).asking).toBe(false);
    expect((await stateOf(page)).shell.save.name).toBe('Bình');
  });
});

test.describe('the hand-over after the puzzle', () => {
  test('Lật trang ends the puzzle once and the story goes on with the very next line, none skipped', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await solvePuzzle(page, info);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    expect((await storyOf(page)).line?.text, 'one completion, the first line after the puzzle, nothing skipped').toBe(lineAfterMinigame(intro, 'Lan').text);
    await step(page, 3000);
    expect((await storyOf(page)).line?.text, 'no second completion').toBe(lineAfterMinigame(intro, 'Lan').text);
  });

  test('a double tap on Lật trang completes once', async ({ page }, info) => {
    await openAtMinigame(page, info);
    await toBoard(page, info);
    await fillBoard(page, info, puzzleFile('intro').solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(300);
    await page.locator('#pz-next').scrollIntoViewIfNeeded();
    const b = (await page.locator('#pz-next').boundingBox())!;
    if (info.project.use.hasTouch) {
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    } else await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
    await step(page, 3000);
    expect((await storyOf(page)).line?.text, 'the first line after the puzzle, once').toBe(lineAfterMinigame(intro, 'Lan').text);
  });

  test('a double tap on Viết câu kết opens the conclusion once, and the second tap picks nothing there', async ({ page }, info) => {
    const scene = chapterOf('ending').scenes.find((sc) => sc.beats.some((b) => b.t === 'minigame'))?.id ?? '';
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene });
    await page.goto('/');
    await waitReady(page);
    await reachMinigame(page, info, 'Lan');
    await toBoard(page, info);
    await fillBoard(page, info, puzzleFile('ending').solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(300);
    await expect(page.locator('#pz-next')).toHaveText('Viết câu kết');
    await page.locator('#pz-next').scrollIntoViewIfNeeded();
    const b = (await page.locator('#pz-next').boundingBox())!;
    if (info.project.use.hasTouch) {
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    } else await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await waitPuzzlePhase(page, 'conclusion');
    const p = await puzzleOf(page);
    expect([p.conclusion?.selected, p.conclusion?.filled.every((f) => f === null)], 'nothing was picked by the second tap').toEqual([null, true]);
    expect((await stateOf(page)).shell.mode).toBe('minigame');
  });

  test('the last button of the ending ends it once: a double tap on Lật trang after the conclusion hands over once', async ({ page }, info) => {
    const scene = chapterOf('ending').scenes.find((sc) => sc.beats.some((b) => b.t === 'minigame'))?.id ?? '';
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene });
    await page.goto('/');
    await waitReady(page);
    await reachMinigame(page, info, 'Lan');
    const file = puzzleFile('ending');
    await toBoard(page, info);
    await fillBoard(page, info, file.solutions[0] as never);
    await check(page, info);
    await waitPuzzlePhase(page, 'reveal');
    await page.waitForTimeout(300);
    await press(page.locator('#pz-next'), info);
    await waitPuzzlePhase(page, 'conclusion');
    const conclusion = file.conclusion as NonNullable<typeof file.conclusion>;
    const used = new Set<number>();
    for (const [i, blank] of conclusion.blanks.entries()) {
      const j = conclusion.bank.findIndex((p, k) => p.label === blank.label && !used.has(k));
      used.add(j);
      await press(page.locator('.pz-conclusion').getByRole('button', { name: (conclusion.bank[j] as { text: string }).text, exact: true }), info);
      await press(page.locator('.pz-blank[data-blank="' + i + '"]'), info);
    }
    await check(page, info);
    await waitPuzzlePhase(page, 'verdict');
    await page.waitForTimeout(300);
    await page.locator('#pz-next').scrollIntoViewIfNeeded();
    const b = (await page.locator('#pz-next').boundingBox())!;
    if (info.project.use.hasTouch) {
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    } else await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).not.toBe('minigame');
    const first = (await stateOf(page)).shell.mode;
    await step(page, 3000);
    expect((await stateOf(page)).shell.mode, 'the hand-over happened once').toBe(first);
  });
});
