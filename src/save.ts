import { indexOf } from './order.ts';

export const SAVE_KEY = 'teo:v1:save';
export const SCHEMA_VERSION = 1;
export const NAME_MAX = 24;
export const NAME_MAX_UNITS = 64;
export const NAME_MAX_MARKS = 2;
const MAX_RAW = 4096;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;
const SCENE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface Save {
  schemaVersion: typeof SCHEMA_VERSION;
  name: string;
  furthest: string;
  chapter: string;
  scene: string;
  /** Chapter ids whose puzzle the player solved: the @minigame beat of those chapters is skipped. */
  puzzles?: string[];
}

export const freshSave = (): Save => ({ schemaVersion: SCHEMA_VERSION, name: '', furthest: 'intro', chapter: 'intro', scene: '' });

/** Progress the player would lose: boot itself stores a nameless save at the first intro scene, which is no progress. */
export const hasProgress = (save: Save, sceneIndex: number): boolean =>
  save.name !== '' || save.chapter !== 'intro' || save.furthest !== 'intro' || (save.puzzles?.length ?? 0) > 0 || sceneIndex > 0;

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null;

const MARK_RUN = new RegExp(`(\\p{M}{${NAME_MAX_MARKS}})\\p{M}+`, 'gu');

export function cleanName(input: string): string {
  const text = input.replace(LONE_SURROGATE, '\ufffd').replace(/[\p{Cc}\p{Cf}]/gu, '').normalize('NFC').replace(MARK_RUN, '$1').replace(/\s+/g, ' ').trim();
  const parts = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
  let name = '';
  for (const part of parts.slice(0, NAME_MAX)) {
    if (name.length + part.length > NAME_MAX_UNITS) break;
    name += part;
  }
  return name.trim();
}

type Plain = Record<string, unknown>;

function parsePlain(raw: string | null): Plain | null {
  try {
    const data: unknown = JSON.parse(raw ?? '');
    return typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Plain) : null;
  } catch {
    return null;
  }
}

/** A save written by a newer build: this build must leave it exactly as it is. */
export const isNewerSave = (raw: string | null): boolean => {
  const declared = parsePlain(raw)?.schemaVersion;
  return Number.isInteger(declared) && (declared as number) > SCHEMA_VERSION;
};

const MIGRATIONS: Record<number, (old: Plain) => Plain> = {
  0: (old) => ({ schemaVersion: 1, name: old.name, furthest: old.chapter, chapter: old.chapter, scene: old.scene }),
};

export function readSave(raw: string | null): Save | null {
  let plain = raw && raw.length <= MAX_RAW ? parsePlain(raw) : null;
  if (!plain) return null;
  const declared = plain.schemaVersion;
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 0 || declared > SCHEMA_VERSION) return null;
  let version: number = declared;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return null;
    plain = step(plain);
    version = plain.schemaVersion as number;
  }
  const { name, furthest, chapter, scene } = plain;
  if (typeof name !== 'string' || typeof furthest !== 'string' || typeof chapter !== 'string' || typeof scene !== 'string') return null;
  if (indexOf(chapter) < 0 || indexOf(furthest) < indexOf(chapter)) return null;
  if (scene !== '' && (scene.length > 64 || !SCENE_ID.test(scene))) return null;
  const puzzles = Array.isArray(plain.puzzles) ? [...new Set(plain.puzzles.filter((p): p is string => typeof p === 'string' && indexOf(p) >= 0))] : undefined;
  return { schemaVersion: SCHEMA_VERSION, name: cleanName(name), furthest, chapter, scene, ...(puzzles?.length ? { puzzles } : {}) };
}

export type SceneOrder = (chapter: string, scene: string) => number;

export function mergeSave(stored: Save | null, mine: Save, sceneOrder: SceneOrder, opts: { nameFromMe?: boolean; backward?: boolean } = {}): Save {
  if (!stored) return mine;
  const furthest = indexOf(stored.furthest) > indexOf(mine.furthest) ? stored.furthest : mine.furthest;
  const mineIsLater =
    indexOf(mine.chapter) !== indexOf(stored.chapter)
      ? indexOf(mine.chapter) > indexOf(stored.chapter)
      : sceneOrder(mine.chapter, mine.scene) >= sceneOrder(stored.chapter, stored.scene);
  const at = opts.backward || mineIsLater ? mine : stored;
  const name = opts.nameFromMe || !stored.name ? mine.name : stored.name;
  const puzzles = [...new Set([...(stored.puzzles ?? []), ...(mine.puzzles ?? [])])];
  return { schemaVersion: SCHEMA_VERSION, name, furthest, chapter: at.chapter, scene: at.scene, ...(puzzles.length ? { puzzles } : {}) };
}
