import raw from '../story/meta.json';
import { timelineOf, type ChapterMeta, type LabelCode } from './chapter-meta.ts';

export type { ChapterMeta, LabelCode };

export const LABEL_NAMES: Record<LabelCode, string> = { 'Cổ': 'Lễ mùa đông cổ', KT: 'Kitô giáo', DG: 'Dân gian và hiện đại' };
export const DAGGER_NOTE = 'gốc cổ chưa chứng minh';

export const META = raw.chapters as ChapterMeta[];
export const ACTS = raw.acts as { n: number; title: string }[];

export const metaOf = (id: string): ChapterMeta | undefined => META.find((c) => c.id === id);
export const isFrame = (id: string): boolean => metaOf(id)?.label === null;

export function actEndedBy(id: string): number | null {
  const m = metaOf(id);
  if (!m) return null;
  return META.filter((c) => c.act === m.act).at(-1)?.id === id ? m.act : null;
}

export const timeline = (): { nodes: ChapterMeta[]; unknown: ChapterMeta[] } => timelineOf(META);
