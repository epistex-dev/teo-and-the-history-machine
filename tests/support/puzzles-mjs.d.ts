declare module '*/scripts/puzzles.mjs' {
  export function pieceIds(puzzle: unknown): Record<string, string>;
  export function chapterProblems(id: string, source: string): string[];
  export function reply(puzzle: unknown, board: unknown, found: Set<string>): { type: string };
}
