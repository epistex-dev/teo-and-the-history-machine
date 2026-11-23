import { indexOf } from './order.ts';
import { metaOf } from './meta.ts';
import { renderStamp } from './stamp.ts';

export interface Source {
  label: string;
  url: string;
}

export interface Point {
  text: string;
  sources: Source[];
}

export const SECTIONS = [
  ['fact', 'Sự thật'],
  ['legend', 'Truyền thuyết (người ta kể rằng)'],
  ['tradition', 'Theo Kinh Thánh hoặc theo truyền thống'],
  ['dispute', 'Còn tranh cãi (cả hai phía)'],
] as const;

export type SectionKey = (typeof SECTIONS)[number][0];

export interface NotebookEntry {
  id: string;
  status: 'verified' | 'placeholder';
  stamp: string | null;
  card: string[];
  full: Partial<Record<SectionKey, Point[]>>;
}

const files = import.meta.glob<NotebookEntry>('../story/notebook/*.json', { import: 'default' });

const placeholder = (id: string): NotebookEntry => ({ id, status: 'placeholder', stamp: metaOf(id)?.stamp ?? null, card: ['[Chưa viết] Chương này viết xong mới có thẻ Sổ nguồn.'], full: {} });

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function sanitize(id: string, data: unknown): NotebookEntry {
  if (typeof data !== 'object' || data === null) return placeholder(id);
  const raw = data as Record<string, unknown>;
  const card = Array.isArray(raw.card) ? raw.card.filter(isText) : [];
  if (card.length === 0) return placeholder(id);
  const full: NotebookEntry['full'] = {};
  const rawFull = (typeof raw.full === 'object' && raw.full !== null ? raw.full : {}) as Record<string, unknown>;
  for (const [key] of SECTIONS) {
    const list = rawFull[key];
    if (!Array.isArray(list)) continue;
    const points = list.flatMap((p: unknown): Point[] => {
      if (typeof p !== 'object' || p === null || !isText((p as Record<string, unknown>).text)) return [];
      const sources = Array.isArray((p as Record<string, unknown>).sources) ? ((p as { sources: unknown[] }).sources as unknown[]) : [];
      return [{ text: (p as { text: string }).text, sources: sources.flatMap((s): Source[] => (typeof s === 'object' && s !== null && isText((s as Source).label) && isText((s as Source).url) ? [{ label: (s as Source).label, url: (s as Source).url }] : [])) }];
    });
    if (points.length) full[key] = points;
  }
  return { id, status: raw.status === 'verified' ? 'verified' : 'placeholder', stamp: typeof raw.stamp === 'string' ? raw.stamp : null, card, full };
}

/** A chapter without a data file, or with a broken one, shows the flagged placeholder, never made-up text. */
export async function loadEntry(id: string): Promise<NotebookEntry> {
  const load = files[`../story/notebook/${id}.json`];
  if (!load) return placeholder(id);
  return sanitize(id, await load());
}

const safeUrl = (url: string): boolean => {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const RANGES = /\d+–\d+/gu;

/** Number ranges such as '13–15' read as one number, so they never break across lines. */
function withRangeSpans(text: string): (string | HTMLElement)[] {
  const parts: (string | HTMLElement)[] = [];
  let at = 0;
  for (const m of text.matchAll(RANGES)) {
    if (m.index > at) parts.push(text.slice(at, m.index));
    parts.push(el('span', 'num-range', m[0]));
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

/** Builds a card with textContent only; every source link opens a new tab with rel=noopener. */
export function renderCard(entry: NotebookEntry, headingLevel: 'h2' | 'h3' = 'h3'): HTMLElement {
  const meta = metaOf(entry.id);
  const card = el('article', 'card');
  card.dataset.chapter = entry.id;
  card.dataset.status = entry.status;
  const head = el('header', 'card-head');
  head.append(el(headingLevel, 'card-title', `Chương ${indexOf(entry.id) + 1} · ${meta?.title ?? entry.id}`));
  if (entry.status === 'verified' && entry.stamp) {
    head.append(renderStamp(entry.stamp));
  } else {
    head.append(el('p', 'flag', 'Chưa viết'));
  }
  card.append(head);
  for (const line of entry.card) {
    const p = el('p', 'card-line');
    for (const part of withRangeSpans(line)) p.append(part);
    card.append(p);
  }
  const sections = SECTIONS.filter(([key]) => (entry.full[key]?.length ?? 0) > 0);
  if (sections.length) {
    const details = el('details', 'card-full');
    details.append(el('summary', undefined, 'Xem đủ'));
    for (const [key, title] of sections) {
      const section = el('section', 'card-section');
      section.dataset.section = key;
      section.append(el('h4', undefined, title));
      const list = el('ul');
      for (const point of entry.full[key] ?? []) {
        const item = el('li');
        for (const part of withRangeSpans(point.text)) item.append(part);
        const sources = point.sources.filter((s) => safeUrl(s.url));
        for (const [n, source] of sources.entries()) {
          item.append(' ');
          const a = el('a', undefined, sources.filter((s) => s.label === source.label).length > 1 ? `${source.label} (${n + 1})` : source.label);
          a.href = source.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.append(el('span', 'sr-only', ' (mở trong tab mới)'));
          item.append(a);
        }
        list.append(item);
      }
      section.append(list);
      details.append(section);
    }
    card.append(details);
  }
  return card;
}
