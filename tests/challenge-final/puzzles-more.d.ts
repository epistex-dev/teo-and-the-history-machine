declare module '*/scripts/puzzles.mjs' {
  type Board = (string | string[] | null)[];
  export const LIMITS: { checks: number; botP: number };
  export function states(puzzle: unknown): number[][];
  export function answerOf(puzzle: unknown, state: number[]): Board;
  export function toState(puzzle: unknown, answer: Board): number[];
  export function solutions(puzzle: unknown, active?: Set<string>, states?: number[][]): number[][];
  export function model(puzzle: unknown): { T: number; n: number; tid: string[]; tix: Record<string, number>; six: Record<string, number>; cap: number[] };
  export function compileDo(puzzle: unknown, list: unknown): { op: string; ti: number[] }[];
  export const OPS: Record<string, (vals: number[], c: unknown) => boolean>;
  export function bankBoards(puzzle: unknown): [string, number[]][];
  export function bankOrder(puzzle: unknown): { id: string }[];
}
