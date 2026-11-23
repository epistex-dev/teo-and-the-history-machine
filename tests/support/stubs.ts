import { existsSync } from 'node:fs';
import { ORDER } from '../../src/order.ts';

/** The chapters whose puzzle is not written yet, in story order: no story/puzzles/<id>.json, only a stub. */
export const stubIds = (): string[] => (ORDER as readonly string[]).filter((id) => !existsSync(`story/puzzles/${id}.json`));
