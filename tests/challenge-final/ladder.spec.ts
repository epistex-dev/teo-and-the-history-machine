import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { answerOf, bankBoards, LIMITS, states } from '../../scripts/puzzles.mjs';
import { openPreview, PREVIEW, press, probeBoards, PUZZLES, puzzleFile, puzzleOf, reply, runBoards, skew, stateOf, toBoard, waitGame, waitPhase } from './helpers.ts';

const reload = async (page: Page, id: string): Promise<void> => {
  await page.reload();
  await waitGame(page, id);
};

const wrongBoard = (id: string): ReturnType<typeof probeBoards>[number]['cells'] => {
  const file = puzzleFile(id);
  const probes = probeBoards(id);
  const found = probes.find((p) => p.kind === 'any rules board' && (reply(file, p.cells, new Set()) as { type: string }).type === 'wrong');
  if (!found) throw new Error('no wrong board for ' + id);
  return found.cells;
};

const wrong = async (page: Page, id: string, times: number): Promise<void> => {
  const board = wrongBoard(id);
  for (let i = 0; i < times; i += 1) await runBoards(page, id, [board], PREVIEW(id));
};

for (const id of PUZZLES) {
  test(id + ': the hint ladder and the nudge hold across a reload at every step: no tier opens by itself, the nudge comes after the third wrong check, only the last tier moves a piece', async ({ page }, info: TestInfo) => {
    const file = puzzleFile(id);
    const tiers = file.hints;
    await openPreview(page, id);
    await toBoard(page, info);
    await reload(page, id);
    let g = await puzzleOf(page);
    expect([g.phase, g.hints, g.wrong, g.nudge, g.pointed]).toEqual(['board', 0, 0, false, []]);
    await wrong(page, id, 1);
    await reload(page, id);
    g = await puzzleOf(page);
    expect([g.wrong, g.nudge, g.hints]).toEqual([1, false, 0]);
    await wrong(page, id, 1);
    await reload(page, id);
    g = await puzzleOf(page);
    expect([g.wrong, g.nudge, g.hints]).toEqual([2, false, 0]);
    await wrong(page, id, 1);
    g = await puzzleOf(page);
    expect([g.wrong, g.nudge, g.hints, g.verdict]).toEqual([3, true, 0, 'Chưa khớp với các thẻ. Đã 3 lần liền: bấm Gợi ý để mở bậc kế tiếp.']);
    await reload(page, id);
    await page.waitForTimeout(1500);
    g = await puzzleOf(page);
    expect([g.wrong, g.nudge, g.hints, g.hint, g.pointed], 'after the nudge and a reload nothing opens by itself').toEqual([3, true, 0, '', []]);
    const solution = file.solutions[0];
    for (let k = 1; k <= tiers.length; k += 1) {
      const tier = tiers[k - 1] as (typeof tiers)[number];
      const before = (await puzzleOf(page)).board;
      await skew(page);
      await press(page, info, '#pz-hint');
      if (tier.solves) {
        await waitPhase(page, 'reveal');
        expect(k, 'the solving tier is the last').toBe(tiers.length);
        break;
      }
      g = await puzzleOf(page);
      expect([g.hints, g.hint, g.pointed, g.wrong, g.nudge, g.phase], 'tier ' + k).toEqual([k, 'Gợi ý ' + k + '/' + tiers.length + ': ' + tier.text, tier.card ? [tier.card] : [], 0, false, 'board']);
      expect(g.board, 'tier ' + k + ' moves no piece').toEqual(before);
      await reload(page, id);
      g = await puzzleOf(page);
      expect([g.hints, g.hint, g.pointed, g.wrong, g.nudge], 'tier ' + k + ' after a reload').toEqual([k, 'Gợi ý ' + k + '/' + tiers.length + ': ' + tier.text, tier.card ? [tier.card] : [], 0, false]);
      const label = (await page.locator('#pz-hint').textContent()) ?? '';
      expect(label, 'the button names the next tier').toBe(tiers[k]?.solves ? 'Nhờ Cúc Cu soi tỏ' : 'Gợi ý ' + (k + 1) + '/' + tiers.length);
      await wrong(page, id, 3);
      g = await puzzleOf(page);
      expect([g.wrong, g.nudge], 'three wrong checks after tier ' + k).toEqual([3, true]);
      await reload(page, id);
      g = await puzzleOf(page);
      expect([g.hints, g.wrong, g.nudge], 'nudge after tier ' + k + ' and a reload').toEqual([k, 3, true]);
    }
    g = await puzzleOf(page);
    expect(g.phase).toBe('reveal');
    expect(g.hints).toBe(tiers.length);
    await reload(page, id);
    expect((await puzzleOf(page)).phase, 'reload at the reveal').toBe('reveal');
    expect(solution, 'the file has a solution').toBeTruthy();
  });
}

test('ending: the conclusion keeps its own ladder of three across reloads and its wrong run starts from zero', async ({ page }, info) => {
  const id = 'ending';
  const file = puzzleFile(id);
  const rungs = (file.conclusion as unknown as { hints: { text: string; solves?: boolean }[] }).hints;
  await openPreview(page, id);
  await toBoard(page, info);
  await wrong(page, id, 2);
  for (let i = 0; i < 5; i += 1) {
    await skew(page);
    await press(page, info, '#pz-hint');
    if ((await puzzleOf(page)).phase === 'reveal') break;
  }
  await waitPhase(page, 'reveal');
  await skew(page);
  await press(page, info, '.pz-next');
  await waitPhase(page, 'conclusion');
  let g = await puzzleOf(page);
  expect([g.hints, g.wrong, g.nudge, g.hint], 'the board run and its tiers do not carry in').toEqual([0, 0, false, '']);
  await reload(page, id);
  g = await puzzleOf(page);
  expect([g.phase, g.hints, g.wrong]).toEqual(['conclusion', 0, 0]);
  for (const n of [1, 2]) {
    await skew(page);
    await press(page, info, '.pz-conclusion .pz-piece >> nth=0');
    await press(page, info, '.pz-blank[data-blank="0"]');
    await skew(page);
    await press(page, info, '#pz-hint');
    await reload(page, id);
    g = await puzzleOf(page);
    expect([g.hints, g.hint, g.wrong], 'conclusion rung ' + n).toEqual([n, 'Gợi ý ' + n + '/' + rungs.length + ': ' + (rungs[n - 1] as { text: string }).text, 0]);
  }
  await skew(page);
  await press(page, info, '#pz-hint');
  await waitPhase(page, 'verdict');
  await reload(page, id);
  g = await puzzleOf(page);
  expect([g.phase, g.conclusion?.empty, g.hints], 'a reload at the verdict returns to the finished sentence, the answer is not thrown away').toEqual(['conclusion', 0, 3]);
});

test('predict and the example: a reload keeps the step, no hint opens, no wrong check counts', async ({ page }, info) => {
  await openPreview(page, 'intro');
  await reload(page, 'intro');
  expect((await puzzleOf(page)).phase).toBe('predict');
  await skew(page);
  await press(page, info, '.pz-option >> nth=0');
  await waitPhase(page, 'demo');
  for (let i = 0; i < 4; i += 1) {
    await skew(page);
    await press(page, info, '#pz-check');
    await skew(page);
    await press(page, info, '#pz-hint');
  }
  await reload(page, 'intro');
  const g = await puzzleOf(page);
  expect([g.phase, g.hints, g.wrong, g.wrongTotal, g.checks, g.nudge, g.pointed]).toEqual(['demo', 0, 0, 0, 0, false, []]);
  await skew(page);
  await press(page, info, '#pz-skip');
  await waitPhase(page, 'board');
  const b = await puzzleOf(page);
  expect([b.hints, b.wrong, b.nudge, b.hint, b.pointed]).toEqual([0, 0, false, '', []]);
});

test('no empty board is ever a check, however often it is sent, before and after reloads, in every puzzle', async ({ page }, info) => {
  for (const id of PUZZLES) {
    await openPreview(page, id);
    await toBoard(page, info);
    for (let round = 0; round < 2; round += 1) {
      for (let i = 0; i < 5; i += 1) {
        await skew(page);
        await press(page, info, '#pz-check');
      }
      const g = await puzzleOf(page);
      expect([id, g.checks, g.wrong, g.wrongTotal, g.nudge, g.hints, g.verdict.startsWith('Chưa đủ')]).toEqual([id, 0, 0, 0, false, 0, true]);
      await reload(page, id);
    }
    expect((await stateOf(page)).game).not.toBeNull();
  }
});

test('the space is wide enough that no guess within the check budget is likely to hit, and a bank-order fill never solves', () => {
  for (const id of PUZZLES) {
    const file = puzzleFile(id);
    const space = states(file).length;
    expect(LIMITS.checks / space, id + ': ' + LIMITS.checks + ' blind checks of ' + space + ' boards').toBeLessThanOrEqual(LIMITS.botP + 1e-9);
    const boards = bankBoards(file);
    expect(boards.length, id + ' has bank-order boards').toBeGreaterThanOrEqual(8);
    const solved = boards.filter(([, v]) => (reply(file, answerOf(file, v), new Set()) as { type: string }).type === 'solved');
    expect(solved.map(([name]) => name), id).toEqual([]);
  }
});
