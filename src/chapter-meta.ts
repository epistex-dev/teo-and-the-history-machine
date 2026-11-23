export type LabelCode = 'Cổ' | 'KT' | 'DG';

export interface ChapterMeta {
  id: string;
  title: string;
  act: number;
  label: LabelCode | null;
  dagger: boolean;
  year: number | null;
  yearText: string | null;
  moc: string | null;
  unknown: string | null;
  stamp: string | null;
}

/** Dated chapters in year order (ties keep chapter order) and the chapters with no known year. */
export function timelineOf(list: readonly ChapterMeta[]): { nodes: ChapterMeta[]; unknown: ChapterMeta[] } {
  const nodes = list.filter((c) => c.year !== null).sort((a, b) => (a.year as number) - (b.year as number) || list.indexOf(a) - list.indexOf(b));
  return { nodes, unknown: list.filter((c) => c.unknown !== null) };
}

/** Largest font size (shrinking from max) at which the text fits the width. */
export function fitFont(measure: (px: number) => number, maxWidth: number, max = 150, min = 40): number {
  let px = max;
  while (px > min && measure(px) > maxWidth) px -= 2;
  return px;
}
