import { expect, type Page, type TestInfo } from '@playwright/test';
import { answerOf, bankBoards, compileDo, model, OPS, pieceIds, reply, solutions, states } from '../../scripts/puzzles.mjs';
import { isTouch, reachMinigame, seedSave, stateOf, storyOf, waitReady } from '../support/play.ts';
import { puzzleFile, puzzleOf, type Cell, type PuzzleFile, type PuzzleState } from '../support/puzzle.ts';
import { chapterOf } from '../support/script.ts';

export { puzzleFile, puzzleOf, reply };
export type { Cell, PuzzleFile, PuzzleState };

export const PUZZLES = ['intro', 'dec25', 'ending', 'saturnalia', 'yule'] as const;
export const SAVE = 'teo:v1:save';
export const REAL = (id: string): string => 'teo:v1:puzzle:' + id;
export const PREVIEW = (id: string): string => 'preview:' + REAL(id);

export const asList = (c: Cell | undefined): string[] => (c === null || c === undefined ? [] : ([] as string[]).concat(c));

/** Deterministic pseudo-random numbers for the sampling. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Lets a test skip the 250 ms control cooldown without waiting: the page's performance.now() runs ahead by window.__skew. */
export async function installSkew(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const real = performance.now.bind(performance);
    (window as unknown as { __skew: number }).__skew = 0;
    performance.now = () => real() + (window as unknown as { __skew: number }).__skew;
  });
}
export const skew = (page: Page, ms = 400): Promise<void> => page.evaluate((v) => void ((window as unknown as { __skew: number }).__skew += v), ms);

/** Writes localStorage once per tab, before the app's first script; wipe clears the rest first. */
export async function seedStorage(page: Page, entries: Record<string, string>, wipe = true): Promise<void> {
  const token = '__seeded' + Math.random().toString(36).slice(2);
  await page.addInitScript(([e, t, w]) => {
    if (sessionStorage.getItem(t as string)) return;
    sessionStorage.setItem(t as string, '1');
    if (w) localStorage.clear();
    for (const [k, v] of Object.entries(e as Record<string, string>)) localStorage.setItem(k, v);
  }, [entries, token, wipe] as const);
}

export const waitGame = (page: Page, id: string): Promise<void> => expect.poll(async () => (await stateOf(page).catch(() => null))?.game?.id, { timeout: 30_000 }).toBe(id);

/** The review route, with the cooldown skew installed; stays at the first screen of the puzzle (or its saved phase). */
export async function openPreview(page: Page, id: string, entries: Record<string, string> = {}): Promise<void> {
  await installSkew(page);
  await seedStorage(page, entries);
  await page.goto('/?preview=puzzle:' + id);
  await waitGame(page, id);
}

export async function press(page: Page, info: TestInfo, selector: string): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  if (isTouch(info)) await loc.tap();
  else await loc.click();
}

export const waitPhase = (page: Page, phase: PuzzleState['phase']): Promise<void> => expect.poll(async () => (await puzzleOf(page)).phase, { timeout: 8000 }).toBe(phase);

/** Real taps through predict and the example, with the skew instead of waiting: ends on the board. */
export async function toBoard(page: Page, info: TestInfo): Promise<void> {
  if ((await puzzleOf(page)).phase === 'predict') {
    await skew(page);
    await press(page, info, '.pz-option >> nth=-1');
    await expect.poll(async () => (await puzzleOf(page)).phase).not.toBe('predict');
  }
  if ((await puzzleOf(page)).phase === 'demo') {
    await skew(page);
    await press(page, info, '#pz-skip');
  }
  await waitPhase(page, 'board');
}

export const tokensOf = (id: string): string[] => puzzleFile(id).tokens.map((t) => t.id);

export interface Obs {
  game: PuzzleState;
  played: number;
  scroll: string;
  msgs: string;
  nudgeAttr: string | undefined;
  stored: Record<string, unknown> | null;
}

/** Puts each board on the page with in-page clicks (no actionability waits), taps Kiểm tra after a cooldown skip and reports what changed. Boards are lists of piece ids per slot. */
export function runBoards(page: Page, id: string, boards: Cell[][], key: string): Promise<{ before: Obs; after: Obs }[]> {
  const file = puzzleFile(id);
  return page.evaluate(
    ({ boards: all, slots, key: k, dom }) => {
      const w = window as unknown as { __skew: number; render_game_to_text: () => string };
      const click = (sel: string): void => {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) throw new Error('missing ' + sel);
        el.click();
      };
      const lift = (): void => {
        for (let i = 0; i < 40; i += 1) {
          const chip = document.querySelector<HTMLElement>('.pz-chip');
          if (!chip) break;
          chip.click();
          document.querySelector('.pz-board')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
      };
      const look = (): Obs => {
        const s = JSON.parse(w.render_game_to_text()) as { game: PuzzleState; shell: { audio: { played: number } } };
        const raw = localStorage.getItem(k);
        return {
          game: s.game,
          played: s.shell.audio.played,
          scroll: document.querySelector('.pz-scroll')?.outerHTML ?? '',
          msgs: document.querySelector('.pz-msgs')?.textContent ?? '',
          nudgeAttr: document.querySelector<HTMLElement>('#pz-hint')?.dataset.nudge,
          stored: raw ? (JSON.parse(raw) as Record<string, unknown>) : null,
        };
      };
      const out: { before: Obs; after: Obs }[] = [];
      for (const cells of all) {
        lift();
        cells.forEach((cell, i) => {
          for (const piece of ([] as string[]).concat(cell ?? [])) {
            click('.pz-bank .pz-piece[data-piece="' + (dom[piece] as string) + '"]');
            click('.pz-slot[data-slot="' + (slots[i] as string) + '"] .pz-slot-btn');
          }
        });
        w.__skew += 400;
        const before = look();
        click('.pz-check');
        out.push({ before, after: look() });
      }
      return out;
    },
    { boards, slots: file.slots.map((s) => s.id), key, dom: pieceIds(file) as Record<string, string> },
  );
}

/** The boards a player can build that are not solutions, by the checker's own words: empty, every single piece, pairs, a solution short of one piece, a sample of every board the rules allow, the wrong-frame boards and the near solutions of each card. */
export function probeBoards(id: string): { cells: Cell[]; kind: string }[] {
  const file = puzzleFile(id) as unknown as PuzzleFile & { cards: { id: string }[]; wrongFrame?: { trap?: Record<string, string | string[]>; exact?: boolean; do?: unknown } };
  const M = model(file);
  const rand = rng(id.length * 7919 + 11);
  const sols = new Set(solutions(file).map((v) => v.join(',')));
  const all = states(file);
  const boards: { cells: Cell[]; kind: string }[] = [];
  const push = (v: number[], kind: string): void => {
    if (!sols.has(v.join(','))) boards.push({ cells: answerOf(file, v) as Cell[], kind });
  };
  boards.push({ cells: file.slots.map(() => []), kind: 'empty' });
  for (let t = 0; t < M.T; t += 1)
    for (let s = 1; s <= M.n; s += 1) {
      const v = new Array<number>(M.T).fill(0);
      v[t] = s;
      push(v, 'single');
    }
  for (let a = 0; a < M.T; a += 1)
    for (let b = a + 1; b < M.T; b += 1)
      for (let k = 0; k < 2; k += 1) {
        const v = new Array<number>(M.T).fill(0);
        v[a] = 1 + Math.floor(rand() * M.n);
        v[b] = 1 + Math.floor(rand() * M.n);
        push(v, 'pair');
      }
  const sol = solutions(file)[0] as number[];
  for (let t = 0; t < M.T; t += 1) if (sol[t]) push(sol.map((s, i) => (i === t ? 0 : s)), 'solution minus one');
  const pick = (list: number[][], n: number, kind: string): void => {
    const chosen = list.filter((v) => !sols.has(v.join(',')) && v.some(Boolean));
    for (let i = 0; i < Math.min(n, chosen.length); i += 1) push(chosen[Math.floor((i * chosen.length) / n)] as number[], kind);
  };
  pick(all, 24, 'any rules board');
  const wf = file.wrongFrame;
  if (wf?.trap) {
    const entries = Object.entries(wf.trap).map(([s, ts]) => [M.six[s] as number, ([] as string[]).concat(ts).map((t) => M.tix[t] as number)] as const);
    pick(all.filter((v) => entries.every(([s, ts]) => ts.every((t) => v[t] === s))), 10, 'wrong frame (trap)');
  }
  if (wf?.do) {
    const cs = compileDo(file, wf.do);
    pick(all.filter((v) => cs.every((c) => (OPS[c.op] as (vals: number[], c: unknown) => boolean)(c.ti.map((i) => v[i] as number), c))), 10, 'wrong frame (do)');
  }
  for (const card of file.cards) pick(solutions(file, new Set(file.cards.map((c) => c.id).filter((c) => c !== card.id)), all), 3, 'near solution without ' + card.id);
  for (const [name, v] of bankBoards(file)) push(v, 'bank order: ' + name);
  return boards;
}

export { chapterOf, reachMinigame, seedSave, stateOf, storyOf, waitReady };
