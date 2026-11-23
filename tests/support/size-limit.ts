import { existsSync } from 'node:fs';
import { ORDER } from '../../src/order.ts';

export const globRegex = (g: string): RegExp => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, (c) => '\\' + c).replace(/\*/g, '[^/]*') + '$');

/** A glob that may match no file: the chunk of a chapter script or puzzle that is not written yet, whose entry waits in .size-limit.json. */
export function awaitsSource(glob: string): boolean {
  const m = /^dist\/assets\/(chapter|pz)-([a-z0-9-]+)-\*\.js$/.exec(glob);
  if (!m || !(ORDER as readonly string[]).includes(m[2] as string)) return false;
  return !existsSync(m[1] === 'pz' ? `story/puzzles/${m[2]}.json` : `story/chapters/${m[2]}.md`);
}
