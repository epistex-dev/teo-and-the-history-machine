import { chunkOrFail } from './preload-error.ts';
import type { MinigameDef } from './minigame.ts';
import type { PuzzleData } from './puzzle/types.ts';
import type { ChapterScript } from './story/types.ts';

export { indexOf, ORDER } from './order.ts';

const byId = <T>(glob: Record<string, () => Promise<T>>, pattern: RegExp): Map<string, () => Promise<T>> =>
  new Map(
    Object.entries(glob).flatMap(([path, load]) => {
      const id = pattern.exec(path)?.[1];
      return id ? [[id, load] as const] : [];
    }),
  );

const scripts = byId(
  import.meta.glob<ChapterScript>('../story/chapters/*.md', { query: '?chapter', import: 'default' }),
  /\/([^/]+)\.md/,
);
const puzzles = byId(import.meta.glob<PuzzleData>('../story/puzzles/*.json', { import: 'default' }), /\/([^/]+)\.json$/);

export const loadScript = (id: string): Promise<ChapterScript | undefined> | null => scripts.get(id)?.() ?? null;
/** The DOM puzzle player for a chapter that has a puzzle file: every chapter's mini game. */
export const loadPuzzle = (id: string): Promise<MinigameDef | undefined> | null => {
  const puzzle = puzzles.get(id);
  return puzzle ? Promise.all([chunkOrFail(puzzle()), chunkOrFail(import('./puzzle/player.ts'))]).then(([data, player]) => player.createPuzzleMinigame(data)) : null;
};
