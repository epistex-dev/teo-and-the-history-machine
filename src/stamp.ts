import rig from './stamps/marks.json';

const marks = import.meta.glob<string>('../art/baked/stamp-*.webp', { query: '?url', import: 'default', eager: true });

type Box = [number, number, number, number];
const [WIDTH, HEIGHT] = rig.size as [number, number];
const FONT = (px: number): string => `600 ${px}px 'EB Garamond', serif`;
const LINE = 1.4;
const SPACING = 0.13;
/** Height of a line of capitals with stacked Vietnamese marks (Ế, Ậ), in em: the ink, not the line box. */
const INK = 1.2;
const ROOM = 0.92;

const byLabel = new Map(Object.entries(rig.marks).map(([id, mark]) => [mark.label, { url: marks[`../art/baked/stamp-${id}.webp`] ?? '', text: mark.text as Box }]));

let ctx: CanvasRenderingContext2D | null | undefined;

/** Greedy word wrap, the way the browser wraps the same text. */
function wrap(words: string[], width: (s: string) => number, max: number): string[] {
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && width(`${last} ${word}`) <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Largest font size, in stamp units, at which the label wraps by word into at most 2 lines inside the box. */
export function fitStamp(width: (s: string, px: number) => number, label: string, box: Box): number {
  const [, , w, h] = box;
  const words = label.split(/\s+/).filter(Boolean);
  for (let px = Math.floor(h / LINE); px > 4; px -= 0.5) {
    const lines = wrap(words, (s) => width(s, px), w * ROOM);
    if (lines.length <= 2 && px * (LINE * (lines.length - 1) + INK) <= h * ROOM && words.every((x) => width(x, px) <= w * ROOM)) return px;
  }
  return 4;
}

function measure(s: string, px: number): number {
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return s.length * px;
  ctx.font = FONT(px);
  return ctx.measureText(s).width + s.length * px * SPACING;
}

/** Cúc Cu's stamp: the baked plate mark with the label in ink, wrapped to 2 lines and shrunk to the mark's own text box. */
export function renderStamp(label: string): HTMLElement {
  const mark = byLabel.get(label);
  const stamp = document.createElement('p');
  stamp.className = 'stamp';
  stamp.dataset.stamp = label;
  stamp.setAttribute('aria-label', `Dấu của Cúc Cu: ${label}`);
  const text = document.createElement('span');
  text.className = 'stamp-text';
  text.textContent = label;
  if (!mark) {
    stamp.classList.add('plain');
    stamp.append(text);
    return stamp;
  }
  stamp.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
  const img = document.createElement('img');
  img.alt = '';
  img.draggable = false;
  img.src = mark.url;
  const [x, y, w, h] = mark.text;
  const s = text.style;
  s.left = `${(x / WIDTH) * 100}%`;
  s.top = `${(y / HEIGHT) * 100}%`;
  s.width = `${(w / WIDTH) * 100}%`;
  s.height = `${(h / HEIGHT) * 100}%`;
  const fit = (): void => {
    s.fontSize = `${(fitStamp(measure, label, mark.text) / WIDTH) * 100}cqw`;
  };
  fit();
  stamp.append(img, text);
  void document.fonts?.load(FONT(16), label).then(fit, () => undefined);
  return stamp;
}
