import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { cleanName } from '../../src/save.ts';
import { expectClean, monitor } from '../support/helpers.ts';
import { stateOf, waitReady } from '../support/play.ts';
import { SAVE } from './helpers.ts';

test.describe.configure({ timeout: 120_000 });

const ENDING = readFileSync('story/chapters/ending.md', 'utf8').split('\n');
const CONCLUSION = (JSON.parse(readFileSync('story/puzzles/ending.json', 'utf8')) as { conclusion: { bank: { status: string; url: string | string[] }[]; thesis: { url: string | string[] } } }).conclusion;
const FALLBACK = 'người đã hỏi';

/** The paragraphs of the letter as the script says them: Tèo's lines after the heading line up to @name-card. */
const BODY = ((): string[] => {
  const from = ENDING.findIndex((l) => l.startsWith('Tèo [normal]: Thư trả lời gửi {ten}.'));
  const to = ENDING.findIndex((l, i) => i > from && l.startsWith('@name-card'));
  return ENDING.slice(from + 1, to).filter((l) => l.startsWith('Tèo [normal]: ')).map((l) => l.slice('Tèo [normal]: '.length));
})();

const urls = (u: string | string[]): string[] => ([] as string[]).concat(u);
const host = (u: string): string => new URL(u).hostname.replace(/^www\./u, '');
/** The links a paragraph answers with, by the status its label names: one link per host, in bank order. */
const sourcesOf = (paragraph: string): { host: string; url: string }[] => {
  const status = paragraph.startsWith('Chắc:') ? 'fact' : paragraph.startsWith('Còn tranh cãi:') ? 'disputed' : paragraph.startsWith('Người ta kể rằng') ? 'legend' : null;
  const list = status ? CONCLUSION.bank.filter((p) => p.status === status).flatMap((p) => urls(p.url)) : urls(CONCLUSION.thesis.url);
  const seen = new Map<string, string>();
  for (const u of list) if (!seen.has(host(u))) seen.set(host(u), u);
  return [...seen].map(([h, url]) => ({ host: h, url }));
};

const AT_END = (name: string): string => JSON.stringify({ schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene: 'end' });

async function openLetter(page: Page, name: string): Promise<void> {
  await page.evaluate(([key, raw]) => localStorage.setItem(key as string, raw as string), [SAVE, AT_END(name)]);
  await page.reload();
  await waitReady(page);
  await page.locator('#end-card').click();
  await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen?: { ready?: boolean } } | null)?.screen?.ready, { timeout: 15_000 }).toBe(true);
}

test('the script has the three labelled claims and an opening line: the test reads the same letter as the player', () => {
  expect(BODY.length).toBe(4);
  expect(BODY.map((l) => l.split(' ').slice(0, 2).join(' '))).toEqual(['Giáng Sinh', 'Chắc: cuốn', 'Còn tranh', 'Người ta']);
});

test('the letter screen: every paragraph is followed by its source line, made of exactly the links of the pieces its label names, and the image says the same words', async ({ page, baseURL }) => {
  const m = monitor(page);
  await page.goto('/');
  await waitReady(page);
  await openLetter(page, 'Lan');
  const dom = await page.evaluate(() =>
    [...document.querySelectorAll('#namecard-letter > p')].map((p) => ({
      text: p.textContent ?? '',
      hint: p.classList.contains('hint'),
      links: [...p.querySelectorAll('a')].map((a) => ({ href: a.href, text: a.textContent, target: a.target, rel: a.rel })),
    })),
  );
  const want: { text: string; hint: boolean }[] = [];
  for (const p of BODY) {
    want.push({ text: p, hint: false });
    want.push({ text: 'Nguồn: ' + sourcesOf(p).map((s) => s.host).join(', '), hint: true });
  }
  want.push({ text: 'Tèo', hint: false });
  expect(dom.map((d) => ({ text: d.text, hint: d.hint })), 'paragraph, source line, paragraph, source line, ..., signature').toEqual(want);
  BODY.forEach((p, i) => {
    const line = dom[i * 2 + 1] as (typeof dom)[number];
    const expected = sourcesOf(p);
    expect(expected.length, 'the paragraph "' + p.slice(0, 20) + '" has a source').toBeGreaterThan(0);
    expect(line.links.map((l) => l.href), p.slice(0, 20)).toEqual(expected.map((s) => new URL(s.url).href));
    for (const l of line.links) {
      expect(l.href.startsWith('https://'), l.href).toBe(true);
      expect(l.target).toBe('_blank');
      expect(l.rel).toContain('noopener');
    }
  });
  const alt = await page.locator('#namecard-img').getAttribute('alt');
  expect(alt).toBe(['Thư trả lời gửi Lan.', ...BODY.flatMap((p) => [p, 'Nguồn: ' + sourcesOf(p).map((s) => s.host).join(', ')]), 'Tèo'].join(' '));
  expectClean(m, baseURL as string);
});

test('the exported image carries a source line (the letter\'s oxblood italic) under each of the four paragraphs, all above the signature', async ({ page }) => {
  await page.goto('/');
  await waitReady(page);
  await openLetter(page, 'Lan');
  const rows = await page.evaluate(async () => {
    const img = document.getElementById('namecard-img') as HTMLImageElement;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const red: number[] = [];
    const dark: number[] = [];
    for (let y = 600; y < 1200; y += 1) {
      let r = 0;
      let d = 0;
      for (let x = 130; x < 950; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const [R, G, B] = [data[i] as number, data[i + 1] as number, data[i + 2] as number];
        if (R > 80 && R < 130 && G < 60 && B < 60) r += 1;
        else if (R < 70 && G < 70 && B < 70) d += 1;
      }
      red.push(r);
      dark.push(d);
    }
    return { red, dark };
  });
  const runs = (xs: number[], min: number): [number, number][] => {
    const out: [number, number][] = [];
    let from = -1;
    xs.forEach((v, i) => {
      if (v >= min && from < 0) from = i;
      if (v < min && from >= 0) {
        out.push([from + 600, i + 600]);
        from = -1;
      }
    });
    return out;
  };
  const sources = runs(rows.red, 3);
  const text = runs(rows.dark, 3);
  expect(sources.length, 'rows of source text: ' + JSON.stringify(sources)).toBeGreaterThanOrEqual(4);
  expect(text.length, 'rows of letter text').toBeGreaterThanOrEqual(8);
  expect(Math.max(...sources.map((s) => s[1])), 'the last source line ends above the signature').toBeLessThan(1125);
});

const HOSTILE: [string, string][] = [
  ['markup', '<img src=x onerror="window.__pwn=1">'],
  ['script', '<script>window.__pwn=1</script>'],
  ['entity', '&lt;b&gt;&amp;'],
  ['template', '{ten} $& $1 $\' ${x}'],
  ['24 wide letters', 'W'.repeat(24)],
  ['24 stacked marks', 'Ặ̣̂'.repeat(24)],
  ['24 emoji', '😀'.repeat(24)],
  ['family emoji', '👨‍👩‍👧‍👦'.repeat(8)],
  ['right to left', 'مرحبا بالعالم'],
  ['bidi override', 'Lan\u202Enal\u2066x\u2069'],
  ['zero width', '\u200bL\u200da\u200cn\u2060\ufeff'],
  ['controls', 'Lan\u0000\u0007\u001b[31m'],
  ['only blanks', ' \t\n\u00a0 '],
  ['one long word without breaks', 'Nguyễn'.repeat(3) + 'Đặng'.repeat(2)],
];

for (const [label, raw] of HOSTILE) {
  test('hostile name (' + label + '): the letter screen shows it as plain cleaned text and the image keeps every mark of the page inside its margins', async ({ page, baseURL }) => {
    const m = monitor(page);
    await page.goto('/');
    await waitReady(page);
    const shown = cleanName(raw) || FALLBACK;
    await openLetter(page, raw);
    const dom = await page.evaluate(() => {
      const heading = document.getElementById('namecard-heading') as HTMLElement;
      const box = heading.getBoundingClientRect();
      return {
        heading: heading.textContent,
        children: heading.children.length,
        injected: document.querySelectorAll('#namecard-screen img:not(#namecard-img), #namecard-screen script, #namecard-screen b, [onerror]').length,
        pwn: (window as unknown as { __pwn?: number }).__pwn ?? null,
        overflow: document.documentElement.scrollWidth - innerWidth,
        right: box.right - innerWidth,
        left: box.left,
        alt: (document.getElementById('namecard-img') as HTMLImageElement).alt,
      };
    });
    expect(dom.heading).toBe('Thư trả lời gửi ' + shown);
    expect([dom.children, dom.injected, dom.pwn]).toEqual([0, 0, null]);
    expect(dom.alt.startsWith('Thư trả lời gửi ' + shown + '. ')).toBe(true);
    expect(dom.overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
    expect(dom.right, 'the heading ends inside the screen').toBeLessThanOrEqual(1);
    expect(dom.left, 'the heading starts inside the screen').toBeGreaterThanOrEqual(-1);
    const pic = await page.evaluate(async () => {
      const img = document.getElementById('namecard-img') as HTMLImageElement;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const ink = (x0: number, y0: number, x1: number, y1: number): number => {
        let n = 0;
        for (let y = y0; y < y1; y += 1)
          for (let x = x0; x < x1; x += 1) {
            const i = (y * canvas.width + x) * 4;
            if (Math.abs((data[i] as number) - 236) + Math.abs((data[i + 1] as number) - 226) + Math.abs((data[i + 2] as number) - 200) > 60) n += 1;
          }
        return n;
      };
      return {
        w: canvas.width,
        h: canvas.height,
        leftMargin: ink(62, 140, 125, 1290),
        rightMargin: ink(955, 140, 1018, 1290),
        name: ink(180, 300, 900, 470),
        gapBeforeSignature: ink(130, 1122, 950, 1140),
        body: ink(130, 640, 950, 1100),
        signature: ink(540, 1130, 950, 1215),
      };
    });
    expect([pic.w, pic.h]).toEqual([1080, 1350]);
    expect(pic.name, 'the name is drawn').toBeGreaterThan(200);
    expect(pic.body, 'the body is drawn').toBeGreaterThan(5000);
    expect(pic.signature, 'the signature is drawn').toBeGreaterThan(200);
    expect([pic.leftMargin, pic.rightMargin, pic.gapBeforeSignature], 'ink in the side margins or between the body and the signature').toEqual([0, 0, 0]);
    expectClean(m, baseURL as string);
  });
}
