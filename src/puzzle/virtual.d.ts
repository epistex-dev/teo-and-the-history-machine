declare module 'virtual:puzzle-core' {
  import type { BoardModel, Cell, Conclusion, PuzzleData, Reply, Token } from './types.ts';
  type Puzzle = Pick<PuzzleData, 'id' | 'slots' | 'tokens' | 'cards' | 'solutions'> & Partial<PuzzleData>;
  export const KIND: Record<string, string>;
  export const SHOWN: Record<string, string>;
  export function bankOrder(p: Puzzle): Token[];
  export function pieceIds(p: Puzzle): Record<string, string>;
  export function model(p: Puzzle): BoardModel;
  export function reply(p: Puzzle, input: Cell[], found?: Set<string>): Reply;
  export function helpAnswer(p: Puzzle, found?: Set<string>): Cell[];
  export function answerOf(p: Puzzle, v: number[]): Cell[];
  export function toState(p: Puzzle, ans: Cell[]): number[];
  export function conclusionCorrect(c: Conclusion, fills: (number | null)[]): boolean;
}
