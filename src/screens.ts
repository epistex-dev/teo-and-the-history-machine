import './letter.css';
import { fitFont } from './chapter-meta.ts';
import { DAGGER_NOTE, isFrame, LABEL_NAMES, META, timeline } from './meta.ts';
import { loadEntry, renderCard } from './notebook.ts';
import { copyText, showCode } from './clipboard.ts';
import { makeCode } from './code.ts';
import { loadScript } from './chapters.ts';
import { LETTER_FILE, letterOf, letterParts, letterText, letterTitle, SOURCE_LEAD, sourceLine, type Letter, type LetterPart, type LetterSources } from './letter.ts';
import type { Screens } from './flow.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const CARD = { width: 1080, height: 1350 } as const;
const FAMILY = 'EB Garamond';
const CANVAS_FAMILY = `'${FAMILY}', serif`;
const CAP_START = 'Cỗ máy khởi động';
const CAP_END = 'Hôm nay';

/** VISUAL_DESIGN.md palette, the canvas cannot read the CSS variables. */
const SHEET = { page: '#ece2c8', ink: '#1b1712', oxblood: '#661b16' } as const;
const MARGIN = 130;
const NAME_TOP = 320;
const DIVIDER_Y = 560;
const BODY_TOP = 625;
const BODY_BOTTOM = 1105;
const MIN_BODY_PX = 22;
/** A source line is set smaller than the claim above it. */
const SOURCE_SCALE = 0.8;

export interface NameCardInfo {
  name: string;
  title: string;
  fontPx: number;
  width: number;
  height: number;
  bytes: number;
  shareable: boolean;
  family: string;
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

/** Thin double rule: heavy outer line, hairline inner line, 11 px apart. */
function doubleRule(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number): void {
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y + 11);
  ctx.lineTo(x2, y + 11);
  ctx.stroke();
}

/** Capitals with letter-spacing drawn one glyph at a time: ctx.letterSpacing is missing in older WebKit. */
function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number): void {
  const glyphs = Array.from(text);
  const widths = glyphs.map((g) => ctx.measureText(g).width);
  let x = cx - (widths.reduce((sum, v) => sum + v, 0) + gap * (glyphs.length - 1)) / 2;
  ctx.textAlign = 'left';
  glyphs.forEach((g, i) => {
    ctx.fillText(g, x, y);
    x += widths[i]! + gap;
  });
  ctx.textAlign = 'center';
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return line ? [...lines, line] : lines;
}

/** An engraved book-page sheet: double rules, spaced capitals, the name, a diamond divider, the body and Tèo's signature line. */
function drawLetter(ctx: CanvasRenderingContext2D, name: string, letter: Letter, parts: LetterPart[]): number {
  const { width: w, height: h } = CARD;
  ctx.fillStyle = SHEET.page;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = SHEET.ink;
  ctx.fillStyle = SHEET.ink;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.lineWidth = 1.8;
  ctx.strokeRect(59, 59, w - 118, h - 118);
  for (const [x, y] of [[48, 48], [w - 48, 48], [48, h - 48], [w - 48, h - 48]] as const) diamond(ctx, x, y, 12);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = SHEET.oxblood;
  ctx.font = `600 40px ${CANVAS_FAMILY}`;
  spaced(ctx, letter.lead.toLocaleUpperCase('vi'), w / 2, 250, 7);
  const room = w - MARGIN * 2 - 60;
  const fontPx = fitFont(
    (px) => {
      ctx.font = `600 ${px}px ${CANVAS_FAMILY}`;
      return ctx.measureText(name).width;
    },
    room,
    140,
    12,
  );
  ctx.font = `600 ${fontPx}px ${CANVAS_FAMILY}`;
  ctx.fillStyle = SHEET.ink;
  ctx.fillText(name, w / 2, NAME_TOP + fontPx, room);
  ctx.strokeStyle = SHEET.ink;
  doubleRule(ctx, MARGIN, w / 2 - 30, DIVIDER_Y);
  doubleRule(ctx, w / 2 + 30, w - MARGIN, DIVIDER_Y);
  diamond(ctx, w / 2, DIVIDER_Y + 5.5, 11);
  ctx.textAlign = 'left';
  const place = (px: number) => {
    const sourcePx = Math.round(px * SOURCE_SCALE);
    const rows: { text: string; y: number; source: boolean; px: number }[] = [];
    let y = BODY_TOP;
    for (const part of parts) {
      ctx.font = `400 ${px}px ${CANVAS_FAMILY}`;
      for (const text of wrap(ctx, part.text, w - MARGIN * 2)) {
        rows.push({ text, y, source: false, px });
        y += px * 1.5;
      }
      const source = sourceLine(part);
      if (source) {
        y -= px * 0.25;
        ctx.font = `italic 400 ${sourcePx}px ${CANVAS_FAMILY}`;
        for (const text of wrap(ctx, source, w - MARGIN * 2)) {
          rows.push({ text, y, source: true, px: sourcePx });
          y += sourcePx * 1.5;
        }
      }
      y += px * 0.3;
    }
    return rows;
  };
  let bodyPx = 44;
  let rows = place(bodyPx);
  for (; bodyPx > MIN_BODY_PX && (rows.at(-1)?.y ?? 0) > BODY_BOTTOM; bodyPx -= 2) rows = place(bodyPx - 2);
  for (const row of rows) {
    ctx.fillStyle = row.source ? SHEET.oxblood : SHEET.ink;
    ctx.font = `${row.source ? 'italic ' : ''}400 ${row.px}px ${CANVAS_FAMILY}`;
    ctx.fillText(row.text, MARGIN, row.y);
  }
  ctx.fillStyle = SHEET.ink;
  ctx.textAlign = 'center';
  ctx.font = `400 60px ${CANVAS_FAMILY}`;
  ctx.fillText(letter.signature, w - MARGIN - 190, 1190);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w - MARGIN - 380, 1206);
  ctx.lineTo(w - MARGIN, 1206);
  ctx.stroke();
  return fontPx;
}
function legendItem(code: string, text: string): HTMLElement {
  const li = document.createElement('li');
  const key = document.createElement('b');
  key.textContent = code;
  li.append(key, ` ${text}`);
  return li;
}

interface LetterSource {
  letter: Letter;
  conclusion: LetterSources;
}

/** The letter is the ending's script; the source of each line comes from the conclusion of the ending puzzle. */
let letterOnce: Promise<LetterSource> | null = null;
function letterSource(): Promise<LetterSource> {
  letterOnce ??= Promise.all([loadScript('ending'), import('../story/puzzles/ending.json')]).then(([script, puzzle]) => {
    if (!script) throw new Error('no ending script');
    return { letter: letterOf(script), conclusion: puzzle.default.conclusion };
  });
  letterOnce.catch(() => (letterOnce = null));
  return letterOnce;
}

function renderLetter(box: HTMLElement, letter: Letter, parts: LetterPart[]): void {
  const signature = document.createElement('p');
  signature.textContent = letter.signature;
  box.replaceChildren(
    ...parts.flatMap((part) => {
      const text = document.createElement('p');
      text.textContent = part.text;
      if (!part.sources.length) return [text];
      const source = document.createElement('p');
      source.className = 'hint';
      source.append(`${SOURCE_LEAD} `);
      part.sources.forEach((s, i) => {
        const link = document.createElement('a');
        link.href = s.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = s.host;
        source.append(...(i ? [', ', link] : [link]));
      });
      return [text, source];
    }),
    signature,
  );
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export function createScreens(): Screens {
  const card = $('card-screen');
  const timelineScreen = $('timeline-screen');
  const nameScreen = $('namecard-screen');
  const codeScreen = $('code-screen');
  const endScreen = $('end-screen');
  let current: Record<string, unknown> = {};
  let blobUrl: string | null = null;
  /** Bumped by every screen that opens: a name card still being drawn then knows it is no longer the one on screen. */
  let epoch = 0;

  const focusHeading = (id: string) => $(id).focus({ preventScroll: true });

  return {
    root: { card, timeline: timelineScreen, namecard: nameScreen, code: codeScreen, end: endScreen },
    describe: () => current,

    async card(chapter, codeData, done) {
      epoch += 1;
      const code = codeData && makeCode(codeData);
      const entry = await loadEntry(chapter);
      $('card-slot').replaceChildren(renderCard(entry, 'h3'));
      card.scrollTop = 0;
      const box = $('card-code');
      box.hidden = code === null;
      showCode($<HTMLTextAreaElement>('card-code-text'), code ?? '');
      $('card-code-note').textContent = '';
      $('card-code-copy').onclick = () => void copyText(code ?? '', $<HTMLTextAreaElement>('card-code-text'), $('card-code-note'));
      current = { kind: 'card', chapter, status: entry.status, stamp: entry.stamp, code };
      $('card-next').onclick = () => done();
      focusHeading('card-heading');
    },

    async code(data, done) {
      epoch += 1;
      const code = makeCode(data);
      showCode($<HTMLTextAreaElement>('code-screen-text'), code);
      $('code-screen-note').textContent = '';
      $('code-screen-copy').onclick = () => void copyText(code, $<HTMLTextAreaElement>('code-screen-text'), $('code-screen-note'));
      current = { kind: 'code', code };
      $('code-screen-next').onclick = () => done();
      focusHeading('code-screen-heading');
    },

    async end(name) {
      epoch += 1;
      $('end-text').textContent = `Thư trả lời gửi ${name} lên đường lúc nửa đêm, do Tèo viết và ký. Sổ nguồn còn giữ từng lớp lịch sử.`;
      current = { kind: 'end', name };
      focusHeading('end-heading');
    },

    timeline(done) {
      epoch += 1;
      const { nodes, unknown } = timeline();
      const list = $('timeline');
      const frameItem = (id: string, cap: string): HTMLElement => {
        const li = document.createElement('li');
        li.className = 'frame';
        li.dataset.frame = id;
        li.textContent = cap;
        return li;
      };
      $('timeline-legend').replaceChildren(
        ...Object.entries(LABEL_NAMES).map(([code, name]) => legendItem(code, name)),
        legendItem('†', DAGGER_NOTE),
      );
      const first = META.find((c) => isFrame(c.id));
      const last = [...META].reverse().find((c) => isFrame(c.id));
      list.replaceChildren(
        ...(first ? [frameItem(first.id, CAP_START)] : []),
        ...nodes.map((c) => {
          const li = document.createElement('li');
          li.dataset.node = c.id;
          li.dataset.year = String(c.year);
          const year = document.createElement('span');
          year.className = 'year';
          year.textContent = c.yearText ?? '';
          const label = document.createElement('span');
          label.className = 'label';
          label.dataset.label = c.label ?? '';
          label.textContent = `${c.label}${c.dagger ? ' †' : ''}`;
          const title = document.createElement('span');
          title.className = 'title';
          title.textContent = c.title;
          const moc = document.createElement('span');
          moc.className = 'moc';
          moc.textContent = c.moc ?? '';
          li.append(year, label, title, moc);
          return li;
        }),
        ...(last && last !== first ? [frameItem(last.id, CAP_END)] : []),
      );
      $('timeline-unknown-list').replaceChildren(
        ...unknown.map((c) => {
          const li = document.createElement('li');
          li.dataset.unknown = c.id;
          const label = document.createElement('span');
          label.className = 'label';
          label.dataset.label = c.label ?? '';
          label.textContent = `${c.label}${c.dagger ? ' †' : ''}`;
          li.append(`${c.title} `, label, `: ${c.unknown ?? ''}`);
          return li;
        }),
      );
      current = { kind: 'timeline', nodes: nodes.map((c) => c.id), unknown: unknown.map((c) => c.id) };
      $('timeline-next').onclick = () => done();
      focusHeading('timeline-heading');
    },

    async nameCard(name, done) {
      const img = $<HTMLImageElement>('namecard-img');
      const hint = $('namecard-hint');
      const share = $<HTMLButtonElement>('namecard-share');
      const save = $<HTMLAnchorElement>('namecard-save');
      const mine = (epoch += 1);
      const stale = (): boolean => mine !== epoch || nameScreen.hidden !== false;
      $('namecard-next').onclick = () => {
        epoch += 1;
        done();
      };
      let loaded: LetterSource;
      try {
        loaded = await letterSource();
      } catch {
        hint.textContent = 'Không đọc được lá thư.';
        return;
      }
      if (stale()) return;
      const { letter, conclusion } = loaded;
      const parts = letterParts(letter, conclusion);
      const title = letterTitle(letter, name);
      $('namecard-heading').textContent = title;
      renderLetter($('namecard-letter'), letter, parts);
      current = { kind: 'namecard', name, title, ready: false };
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = null;
      img.removeAttribute('src');
      img.alt = '';
      await Promise.all([
        document.fonts.load(`600 40px '${FAMILY}'`, letter.lead.toLocaleUpperCase('vi') + name),
        document.fonts.load(`400 44px '${FAMILY}'`, parts.map((p) => p.text).join(' ') + letter.signature),
        document.fonts.load(`italic 400 30px '${FAMILY}'`, parts.map((p) => sourceLine(p) ?? '').join(' ')),
      ]).catch(() => undefined);
      await document.fonts.ready;
      if (stale()) return;
      const canvas = document.createElement('canvas');
      canvas.width = CARD.width;
      canvas.height = CARD.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        hint.textContent = 'Máy này không vẽ được lá thư.';
        return;
      }
      let fontPx = 0;
      try {
        fontPx = drawLetter(ctx, name, letter, parts);
      } catch {
        hint.textContent = 'Máy này không vẽ được lá thư.';
        return;
      }
      const blob = await toBlob(canvas);
      if (stale()) return;
      if (!blob) {
        hint.textContent = 'Không tạo được ảnh lá thư.';
        return;
      }
      blobUrl = URL.createObjectURL(blob);
      img.src = blobUrl;
      img.alt = letterText(letter, conclusion, name);
      save.href = blobUrl;
      save.hidden = false;
      const file = new File([blob], LETTER_FILE, { type: 'image/png' });
      let shareable = false;
      try {
        shareable = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      } catch {
        shareable = false;
      }
      share.hidden = !shareable;
      hint.textContent = shareable ? 'Bấm Chia sẻ, hoặc nhấn giữ ảnh để lưu.' : 'Nhấn giữ ảnh để lưu về máy.';
      share.onclick = async () => {
        try {
          await navigator.share({ files: [file], title });
        } catch (error) {
          if ((error as DOMException).name !== 'AbortError') hint.textContent = 'Không chia sẻ được. Nhấn giữ ảnh để lưu về máy.';
        }
      };
      const info: NameCardInfo = { name, title, fontPx, width: CARD.width, height: CARD.height, bytes: blob.size, shareable, family: FAMILY };
      current = { kind: 'namecard', ready: true, ...info };
      focusHeading('namecard-heading');
    },
  };
}
