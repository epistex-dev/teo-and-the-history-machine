import { intro, lineAfterMinigame } from './script.ts';
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { pieceIds, reply } from '../../scripts/puzzles.mjs';
import { isTouch, stateOf } from './play.ts';

export const GAME_SCENE = intro.scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
export const AFTER = lineAfterMinigame(intro, 'Lan');

export type Cell = string | string[] | null;

export interface PuzzleState {
  id: string;
  kind: 'puzzle';
  manual: boolean;
  phase: 'predict' | 'demo' | 'board' | 'reveal' | 'conclusion' | 'verdict';
  completed: boolean;
  predicted: number | null;
  selected: string | null;
  board: Record<string, string[]> | null;
  bank: string[] | null;
  order: string[];
  checks: number;
  wrong: number;
  wrongTotal: number;
  hints: number;
  hint: string;
  verdict: string;
  nudge: boolean;
  pointed: string[];
  found: number;
  of: number;
  conclusion: { filled: (string | null)[]; selected: number | null; empty: number; wrong: number } | null;
  cards: number;
}

export interface PuzzleFile {
  id: string;
  slots: { id: string; cap?: number | string }[];
  tokens: { id: string; text: string }[];
  solutions: Cell[][];
  hints: { text: string; card?: string; solves?: boolean }[];
  predict?: { options: string[] };
  demo?: unknown;
  conclusion?: { blanks: { label: string }[]; bank: { text: string; label: string }[] };
  cards: { id: string }[];
}

export const puzzleFile = (id: string): PuzzleFile => JSON.parse(readFileSync(new URL('../../story/puzzles/' + id + '.json', import.meta.url), 'utf8')) as PuzzleFile;

/** The id a page shows for a piece of a puzzle: opaque, not the file's. */
export const domPiece = (puzzleId: string, tokenId: string): string => (pieceIds(puzzleFile(puzzleId)) as Record<string, string>)[tokenId] as string;

export const puzzleOf = async (page: Page): Promise<PuzzleState> => {
  const { game } = await stateOf(page);
  if (!game || (game as unknown as PuzzleState).kind !== 'puzzle') throw new Error('no puzzle is running');
  return game as unknown as PuzzleState;
};

/** One real tap on touch projects, a real click elsewhere. */
export const press = async (loc: Locator, info: TestInfo): Promise<void> => {
  await loc.scrollIntoViewIfNeeded();
  if (isTouch(info)) await loc.tap();
  else await loc.click();
};

export const waitPuzzlePhase = (page: Page, phase: PuzzleState['phase']): Promise<void> =>
  expect.poll(async () => (await puzzleOf(page)).phase, { timeout: 8000 }).toBe(phase);

/** Opens a puzzle straight from its file: the review route, no story walk. */
export async function openPuzzle(page: Page, id: string): Promise<void> {
  await page.goto('/?preview=puzzle:' + id);
  await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe(id);
}

const cooldown = (page: Page): Promise<void> => page.waitForTimeout(280);

export async function answerPredict(page: Page, info: TestInfo, option = -1): Promise<void> {
  const p = await puzzleOf(page);
  if (p.phase !== 'predict') return;
  const options = page.locator('.pz-option');
  await press(option < 0 ? options.last() : options.nth(option), info);
  await expect.poll(async () => (await puzzleOf(page)).phase).not.toBe('predict');
}

export async function skipDemo(page: Page, info: TestInfo): Promise<void> {
  if ((await puzzleOf(page)).phase !== 'demo') return;
  await cooldown(page);
  await press(page.locator('#pz-skip'), info);
  await waitPuzzlePhase(page, 'board');
}

/** Past the predict step and the example, on the board. */
export async function toBoard(page: Page, info: TestInfo): Promise<void> {
  await answerPredict(page, info);
  await skipDemo(page, info);
  await waitPuzzlePhase(page, 'board');
  await cooldown(page);
}

const asList = (c: Cell | undefined): string[] => (c === null || c === undefined ? [] : ([] as string[]).concat(c));

/** Taps every piece of the cells into its slot. */
export async function fillBoard(page: Page, info: TestInfo, cells: Cell[], given?: PuzzleFile): Promise<void> {
  const file = given ?? puzzleFile((await puzzleOf(page)).id);
  for (const [i, slot] of file.slots.entries()) {
    for (const id of asList(cells[i])) {
      const dom = (pieceIds(file) as Record<string, string>)[id];
      await press(page.locator('.pz-bank .pz-piece[data-piece="' + dom + '"], .pz-slot .pz-piece[data-piece="' + dom + '"]').first(), info);
      await press(page.locator('.pz-slot[data-slot="' + slot.id + '"] .pz-slot-btn'), info);
    }
  }
}

export async function check(page: Page, info: TestInfo): Promise<void> {
  await cooldown(page);
  await press(page.locator('.pz-check'), info);
}

/** A fill that the checker does not accept: the first solution with its first two non-empty cells swapped, or every piece in the first slot. */
export function wrongFill(file: PuzzleFile): Cell[] {
  const base = file.solutions[0] as Cell[];
  const tries: Cell[][] = [];
  const at = base.map((c, i) => (asList(c).length ? i : -1)).filter((i) => i >= 0);
  if (at.length >= 2) {
    const swapped = base.map((c) => (Array.isArray(c) ? [...c] : c));
    swapped[at[0] as number] = base[at[1] as number] as Cell;
    swapped[at[1] as number] = base[at[0] as number] as Cell;
    tries.push(swapped);
  }
  tries.push(base.map((_, i) => (i === 0 ? file.tokens.map((t) => t.id).slice(0, 1) : null)));
  const bad = tries.find((cells) => reply(file, cells, new Set()).type !== 'solved' && reply(file, cells, new Set()).type !== 'found');
  if (!bad) throw new Error('no wrong fill for ' + file.id);
  return bad;
}

/** Plays the whole puzzle with real taps: predict, example, board, reveal, and the conclusion when the file has one. */
export async function solvePuzzle(page: Page, info: TestInfo): Promise<void> {
  const g = await puzzleOf(page);
  if (g.phase !== 'predict' && g.phase !== 'demo' && Object.values(g.board ?? {}).some((c) => c.length > 0)) return helpPuzzle(page, info);
  const file = puzzleFile((await puzzleOf(page)).id);
  await toBoard(page, info);
  await fillBoard(page, info, file.solutions[0] as Cell[]);
  await check(page, info);
  await waitPuzzlePhase(page, 'reveal');
  await cooldown(page);
  await press(page.locator('.pz-next'), info);
  if (file.conclusion) {
    await waitPuzzlePhase(page, 'conclusion');
    const used = new Set<number>();
    for (const [i, blank] of file.conclusion.blanks.entries()) {
      const j = file.conclusion.bank.findIndex((p, k) => p.label === blank.label && !used.has(k));
      used.add(j);
      await press(page.locator('.pz-conclusion').getByRole('button', { name: (file.conclusion.bank[j] as { text: string }).text, exact: true }), info);
      await press(page.locator('.pz-blank[data-blank="' + i + '"]'), info);
    }
    await check(page, info);
    await waitPuzzlePhase(page, 'verdict');
    await cooldown(page);
    await press(page.locator('.pz-next'), info);
  }
}

/** Asks Cúc Cu through the whole puzzle: every press of the hint button opens one tier and the last one solves; the reveal and the verdict are turned with their own button. */
export async function helpPuzzle(page: Page, info: TestInfo): Promise<void> {
  for (let i = 0; i < 120; i += 1) {
    const s = await stateOf(page);
    if (s.shell.mode !== 'minigame') return;
    const g = s.game as unknown as PuzzleState | null;
    if (!g) {
      await page.waitForTimeout(50);
      continue;
    }
    await cooldown(page);
    if (g.phase === 'predict') await press(page.locator('.pz-option').last(), info);
    else if (g.phase === 'demo') await press(page.locator('#pz-skip'), info);
    else if (g.phase === 'reveal' || g.phase === 'verdict') await press(page.locator('#pz-next'), info);
    else await press(page.locator('#pz-hint'), info);
  }
  throw new Error('the puzzle did not end by hints');
}
