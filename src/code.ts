import { indexOf, ORDER } from './order.ts';
import { cleanName, NAME_MAX_UNITS } from './save.ts';

export const CODE_PREFIX = 'TEO1';
const PREFIX_LENGTH = 'TEO1.00.00.n'.length + '.'.length + 6;
/** The longest name cleanName keeps is NAME_MAX_UNITS UTF-16 units, at most 3 UTF-8 bytes each, 4 base64url characters per 3 bytes. */
const MAX_LENGTH = PREFIX_LENGTH + Math.ceil((NAME_MAX_UNITS * 3 * 4) / 3);
const MIN_LENGTH = 16;

export interface CodeData {
  name: string;
  chapter: string;
  furthest: string;
  /** The player has seen the whole game: the code returns to the end screen, not to the start of the last chapter. */
  finished?: boolean;
}

export type CodeResult = { ok: true; data: CodeData } | { ok: false; reason: 'empty' | 'length' | 'schema' | 'format' | 'checksum' | 'chapter' | 'beyond' | 'name'; message: string };

const fail = (reason: Extract<CodeResult, { ok: false }>['reason'], message: string): CodeResult => ({ ok: false, reason, message });

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return (h % 2176782336).toString(36).toUpperCase().padStart(6, '0');
}

const toBase64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const padded = text.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** A finished game writes the chapter field as ORDER.length (one past the last chapter) and the furthest field as the last chapter; every older code keeps its meaning. */
const FINISHED_AT = ORDER.length;

/** Builds a code without validating the indexes; tests use it to forge bad codes. */
export function encodeCode(chapterIndex: number, furthestIndex: number, name: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const body = `${CODE_PREFIX}.${pad(chapterIndex)}.${pad(furthestIndex)}.n${toBase64Url(new TextEncoder().encode(name))}`;
  return `${body}.${checksum(body)}`;
}

export const makeCode = (save: CodeData): string =>
  save.finished && indexOf(save.chapter) === ORDER.length - 1 ? encodeCode(FINISHED_AT, ORDER.length - 1, save.name) : encodeCode(indexOf(save.chapter), indexOf(save.furthest), save.name);

export function parseCode(input: string): CodeResult {
  const text = input.replace(/[\s\u0085\p{Cf}\p{Default_Ignorable_Code_Point}]+/gu, '');
  if (!text) return fail('empty', 'Ô mã còn trống: dán mã tiếp tục vào.');
  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) return fail('length', 'Mã có độ dài không hợp lệ.');
  const parts = text.split('.');
  const version = parts[0] ?? '';
  if (version !== CODE_PREFIX) return fail('schema', /^TEO\d+$/.test(version) ? 'Mã này thuộc một phiên bản khác của truyện.' : 'Đây không phải mã tiếp tục của truyện này.');
  const [, chapterRaw = '', furthestRaw = '', nameRaw = '', sum = ''] = parts;
  if (parts.length !== 5 || !/^\d{2}$/.test(chapterRaw) || !/^\d{2}$/.test(furthestRaw) || !/^n/.test(nameRaw) || !/^[0-9A-Z]{6}$/.test(sum)) return fail('format', 'Mã không đúng dạng.');
  if (checksum(parts.slice(0, 4).join('.')) !== sum) return fail('checksum', 'Mã sai ký tự. Kiểm tra lại từng ký tự.');
  const chapter = Number(chapterRaw);
  const furthest = Number(furthestRaw);
  if (furthest >= ORDER.length || chapter > FINISHED_AT) return fail('chapter', 'Mã nhắc đến một chương không có trong truyện.');
  const finished = chapter === FINISHED_AT;
  if (finished && furthest !== ORDER.length - 1) return fail('chapter', 'Mã nhắc đến một chương không có trong truyện.');
  if (chapter > furthest && !finished) return fail('beyond', 'Mã vượt quá chương xa nhất đã chơi.');
  const bytes = fromBase64Url(nameRaw.slice(1));
  let name = '';
  if (bytes === null) return fail('name', 'Tên trong mã không đọc được.');
  try {
    name = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail('name', 'Tên trong mã không đọc được.');
  }
  if (name !== cleanName(name)) return fail('name', 'Tên trong mã không hợp lệ.');
  const data = { name, chapter: ORDER[finished ? furthest : chapter] as string, furthest: ORDER[furthest] as string };
  return { ok: true, data: finished ? { ...data, finished } : data };
}
