import { expect, type Page, type TestInfo } from '@playwright/test';
import { pieceIds } from '../../scripts/puzzles.mjs';
import { isTouch, reachMinigame, seedSave, stateOf, storyOf, waitReady } from '../support/play.ts';
import { domPiece, openPuzzle, puzzleFile, puzzleOf, type Cell, type PuzzleFile } from '../support/puzzle.ts';
import { chapterOf, lineAfterMinigame } from '../support/script.ts';

export { domPiece, openPuzzle, puzzleFile, puzzleOf };
export type { Cell, PuzzleFile };

export const PREVIEW = process.env.PZ_PREVIEW_PREFIX ?? 'preview:';
export const REAL_KEY = (id: string): string => 'teo:v1:puzzle:' + id;
export const KEY = (id: string): string => PREVIEW + REAL_KEY(id);

const BANK = (puzzleFile('ending').conclusion as NonNullable<PuzzleFile['conclusion']>).bank;

/** The ending's conclusion pieces are told apart in the DOM by opaque ids; the authoring index j is found by its text. */
export const pickPiece = (page: Page, j: number): Promise<boolean> =>
  page.evaluate((text) => {
    const el = [...document.querySelectorAll<HTMLElement>('.pz-conclusion .pz-piece')].find((e) => e.textContent === text);
    el?.click();
    return Boolean(el);
  }, (BANK[j] as { text: string }).text);

export const pieceSel = async (page: Page, j: number): Promise<string> => {
  const id = await page.evaluate((text) => [...document.querySelectorAll<HTMLElement>('.pz-conclusion .pz-piece')].find((e) => e.textContent === text)?.dataset.piece ?? null, (BANK[j] as { text: string }).text);
  return '.pz-conclusion .pz-piece[data-piece="' + id + '"]';
};
export const SETTINGS_KEY = 'teo:v1:settings';
export const PUZZLES = ['intro', 'dec25', 'ending', 'saturnalia', 'yule'] as const;
export const LANDSCAPE = { width: 844, height: 390 };
export const SMALL = { width: 320, height: 568 };

/** Pause that outlasts the 250 ms cooldown of the check and hint controls. */
export const cool = (page: Page): Promise<void> => page.waitForTimeout(290);

export const asList = (c: Cell | undefined): string[] => (c === null || c === undefined ? [] : ([] as string[]).concat(c));

/** Writes localStorage before the app's first script, once per tab (a reload keeps what the app wrote since). */
export async function seedStorage(page: Page, entries: Record<string, string>, clear = false): Promise<void> {
  const token = '__seeded' + Math.random().toString(36).slice(2);
  await page.addInitScript(([e, t, wipe]) => {
    if (sessionStorage.getItem(t as string)) return;
    sessionStorage.setItem(t as string, '1');
    if (wipe) localStorage.clear();
    for (const [k, v] of Object.entries(e as Record<string, string>)) localStorage.setItem(k, v);
  }, [entries, token, clear] as const);
}

export async function openSeeded(page: Page, id: string, saved: object | string | null, settings?: object): Promise<void> {
  const entries: Record<string, string> = {};
  if (saved !== null) entries[KEY(id)] = typeof saved === 'string' ? saved : JSON.stringify(saved);
  if (settings) entries[SETTINGS_KEY] = JSON.stringify({ version: 1, ...settings });
  await seedStorage(page, entries, true);
  await openPuzzle(page, id);
}

export const waitGame = async (page: Page, id: string): Promise<void> => {
  await expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe(id);
};

export const stored = (page: Page, id: string): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), KEY(id));
export const storedReal = (page: Page, id: string): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), REAL_KEY(id));

/** A real tap or click at page coordinates. */
export async function tapAt(page: Page, info: TestInfo, x: number, y: number): Promise<void> {
  if (isTouch(info)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box for ' + selector);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Clicks from inside the page, no actionability wait: for loops and races. */
export const domClick = (page: Page, selector: string, nth = 0): Promise<boolean> =>
  page.evaluate(([s, n]) => {
    const el = document.querySelectorAll<HTMLElement>(s as string)[n as number];
    if (!el) return false;
    el.click();
    return true;
  }, [selector, nth] as const);

/** Taps a piece of the board, or of the example while the example is up (it has its own tokens and its own opaque ids), into a slot. */
export const placeDom = async (page: Page, id: string, slot: string): Promise<void> => {
  const game = await puzzleOf(page);
  const file = puzzleFile(game.id) as unknown as { demo?: object };
  const source = game.phase === 'demo' && file.demo ? { ...file.demo, id: game.id + '-demo' } : file;
  await domClick(page, '.pz-board [data-piece="' + (pieceIds(source) as Record<string, string>)[id] + '"]');
  await domClick(page, '.pz-slot[data-slot="' + slot + '"] .pz-slot-btn');
};

export async function placeAll(page: Page, file: PuzzleFile, cells: Cell[]): Promise<void> {
  for (const [i, slot] of file.slots.entries()) for (const id of asList(cells[i])) await placeDom(page, id, slot.id);
}

/** Lifts every placed piece back to the bank with taps. */
export async function clearBoard(page: Page): Promise<void> {
  for (let i = 0; i < 30 && (await page.locator('.pz-chip').count()) > 0; i += 1) {
    await domClick(page, '.pz-chip');
    await page.evaluate(() => document.querySelector('.pz-board')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  }
}

/** Lifts every filled conclusion blank back to the bank with taps, putting each piece down with Escape. */
export async function clearBlanks(page: Page): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    const lifted = await domClick(page, '.pz-blank[data-filled="true"]');
    if (!lifted) break;
    await page.evaluate(() => document.querySelector('.pz-conclusion')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  }
}

/** Every token is in exactly one place, no slot is over its cap, nothing is left hanging. Returns what is wrong. */
export async function invariants(page: Page, file: PuzzleFile): Promise<string[]> {
  const p = await puzzleOf(page);
  const out: string[] = [];
  if (p.board && p.bank) {
    const all = [...Object.values(p.board).flat(), ...p.bank].sort();
    const ids = file.tokens.map((t) => t.id).sort();
    if (JSON.stringify(all) !== JSON.stringify(ids)) out.push('tokens not a partition: ' + JSON.stringify(all));
    for (const s of file.slots) {
      const cap = s.cap === 'any' ? Infinity : typeof s.cap === 'number' ? s.cap : 1;
      const n = (p.board[s.id] ?? []).length;
      if (n > cap) out.push('slot ' + s.id + ' holds ' + n + ' over cap ' + cap);
    }
    if (p.selected && !p.bank.includes(p.selected)) out.push('selected piece ' + p.selected + ' is not in the bank');
    const dom = await page.evaluate(() => ({ chips: document.querySelectorAll('.pz-chip').length, bank: document.querySelectorAll('.pz-bank .pz-piece').length }));
    if (dom.chips + dom.bank !== file.tokens.length) out.push('DOM shows ' + (dom.chips + dom.bank) + ' pieces for ' + file.tokens.length + ' tokens');
  }
  if ((await page.locator('.pz-ghost').count()) > 0) out.push('a drag ghost is left in the page');
  return out;
}

/** Plays the story with real input up to the puzzle of chapter 1 or 25. */
export async function openInStory(page: Page, info: TestInfo, id: 'intro' | 'ending', query = ''): Promise<void> {
  if (id === 'intro') await seedSave(page);
  else {
    const scene = chapterOf('ending').scenes.find((s) => s.beats.some((b) => b.t === 'minigame'))?.id ?? '';
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene });
  }
  await page.goto('/' + query);
  await waitReady(page);
  await reachMinigame(page, info, 'Lan');
  await waitGame(page, id);
}

export const lineAfter = (id: 'intro' | 'ending'): string => lineAfterMinigame(chapterOf(id), 'Lan').text;

export const storyLine = async (page: Page): Promise<string | null> => (await storyOf(page)).line?.text ?? null;

export async function expectStoryAt(page: Page, text: string): Promise<void> {
  await expect.poll(async () => (await stateOf(page)).shell.mode, { timeout: 8000 }).toBe('story');
  await expect.poll(() => storyLine(page), { timeout: 5000 }).toBe(text);
}

/** Deterministic pseudo-random numbers for fuzz loops. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const emptyOf = (r: { type: string }): number => (r as unknown as { empty: number }).empty;
