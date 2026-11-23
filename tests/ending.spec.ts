import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { LETTER_FILE } from '../src/letter.ts';
import { advanceUntil } from './support/ending.ts';
import { LETTER_BANK, LETTER_BODY, LETTER_CONCLUSION, LETTER_LEAD, LETTER_PARTS, LETTER_SIGNATURE, LETTER_SOURCES, letterText, letterTitle } from './support/letter.ts';
import { SAVE_KEY, stateOf, waitReady } from './support/play.ts';
import { chapterOf } from './support/script.ts';

const ending = (scene: string, name = 'Lan') => ({ schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene });

/** Bible §7, "Nhãn" column, in year order; † marks a disputed ancient origin. */
const TIMELINE: [string, string][] = [
  ['saturnalia', 'Cổ'], ['bethlehem', 'KT'], ['dec25', 'KT'], ['nicholas', 'KT'], ['yule', 'KT †'], ['carol', 'KT'], ['krampus', 'DG †'],
  ['tree', 'DG'], ['ban1647', 'DG'], ['mistletoe', 'DG †'], ['silent-night', 'DG'], ['santa-ny', 'DG'], ['dickens', 'DG'],
  ['yule-lads', 'DG'], ['yule-cat', 'DG †'], ['caga-tio', 'DG †'],
];

async function toScreen(page: Page, scene: string, mode: string, name?: string): Promise<void> {
  await page.addInitScript(([k, v]) => localStorage.setItem(k as string, v as string), [SAVE_KEY, JSON.stringify(ending(scene, name))]);
  await page.goto('/');
  await waitReady(page);
  await advanceUntil(page, mode);
  await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { kind?: string } | null }).screen?.kind).toBe(mode);
}

test.describe('ending timeline (R9)', () => {
  test('16 dated nodes in year order with the bible labels, frame chapters without a label', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    const nodes = page.locator('#timeline li[data-node]');
    await expect(nodes).toHaveCount(16);
    const rows = await nodes.evaluateAll((els) => els.map((e) => ({ id: (e as HTMLElement).dataset.node, year: Number((e as HTMLElement).dataset.year), label: e.querySelector('.label')?.textContent ?? '', yearText: e.querySelector('.year')?.textContent ?? '' })));
    expect(rows.map((r) => [r.id, r.label])).toEqual(TIMELINE);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.year, `${rows[i]!.id} after ${rows[i - 1]!.id}`).toBeGreaterThanOrEqual(rows[i - 1]!.year);
    for (const r of rows) expect(r.yearText.length, r.id).toBeGreaterThan(0);
    expect(rows.find((r) => r.id === 'dec25')?.yearText).toBe('354');
    expect(rows.find((r) => r.id === 'tree')?.yearText).toBe('1605');
    expect(rows.find((r) => r.id === 'caga-tio')?.yearText).toBe('1886');
  });

  test('the "Chưa rõ năm" block holds befana and brooms, and neither is among the dated nodes', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    await expect(page.locator('#timeline-unknown h3')).toHaveText('Chưa rõ năm');
    expect(await page.locator('#timeline-unknown li').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.unknown))).toEqual(['befana', 'brooms']);
    await expect(page.locator('#timeline li[data-node="befana"], #timeline li[data-node="brooms"]')).toHaveCount(0);
  });

  test('the frame chapters intro and ending stand at the two ends without a label or a year', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    const frames = page.locator('#timeline li[data-frame]');
    expect(await frames.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.frame))).toEqual(['intro', 'ending']);
    for (let i = 0; i < 2; i += 1) {
      await expect(frames.nth(i).locator('.label, .year, .moc')).toHaveCount(0);
      await expect(frames.nth(i)).not.toHaveAttribute('data-node', /.*/);
    }
    expect(await page.locator('#timeline > li').first().getAttribute('data-frame')).toBe('intro');
    expect(await page.locator('#timeline > li').last().getAttribute('data-frame')).toBe('ending');
  });

  test('Lật trang leaves the timeline for the next scene', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    await page.locator('#timeline-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expect((await stateOf(page)).story?.scene).toBe('the-ten');
  });
});

type Card = { kind: string; ready: boolean; name: string; title: string; fontPx: number; width: number; height: number; bytes: number; shareable: boolean };
const cardOf = async (page: Page): Promise<Card> => ((await stateOf(page)).story as unknown as { screen: Card }).screen;

/** Downloads the letter through its save link (the real PNG bytes) and measures ink (dark pixels) between the double rules in the bands of the name, the body and the signature line. */
async function inspect(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#namecard-save').click()]);
  const bytes = readFileSync((await download.path()) as string);
  const px = await page.evaluate(async () => {
    const img = document.getElementById('namecard-img') as HTMLImageElement;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    const dark = (data: Uint8ClampedArray, i: number) => data[i]! < 70 && data[i + 1]! < 70 && data[i + 2]! < 90;
    const inkIn = (top: number, height: number, left = 70) => {
      const right = canvas.width - 70;
      const data = ctx.getImageData(left, top, right - left, height).data;
      let count = 0;
      let minX = canvas.width;
      let maxX = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < right - left; x += 1) {
          if (dark(data, (y * (right - left) + x) * 4)) {
            count += 1;
            minX = Math.min(minX, x + left);
            maxX = Math.max(maxX, x + left);
          }
        }
      }
      return { count, minX, maxX };
    };
    const name = inkIn(320, 220);
    return { ink: name.count, minX: name.minX, maxX: name.maxX, body: inkIn(660, 440).count, signature: inkIn(1130, 90, 540).count, alt: img.alt, domImgs: document.querySelectorAll('#namecard-screen img').length };
  });
  return { ...px, sig: [...bytes.subarray(0, 8)], width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), size: bytes.length, hash: createHash('sha256').update(bytes).digest('hex') };
}

test.describe('final letter PNG (R9)', () => {
  const names: [string, string][] = [
    ['short name', 'Lan'],
    ['24 characters, the longest the game keeps', 'Nguyễn Thị Phương Anh Thư Ng'],
    ['HTML characters', '<img src=x onerror=alert(1)>&amp;'],
    ['IME name: Vietnamese typed with combining marks, then CJK', 'Te\u0300o 日本語 한국어'],
  ];

  for (const [label, name] of names) {
    test(`a 1080 x 1350 PNG with the letter and the name, drawn after fonts are ready, fits the sheet: ${label}`, async ({ page }) => {
      let alerted = false;
      page.on('dialog', async (d) => {
        alerted = true;
        await d.dismiss();
      });
      await toScreen(page, 'the-ten', 'namecard', name);
      await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
      const info = await cardOf(page);
      const saved = (await stateOf(page)).shell.save.name;
      expect(info.name).toBe(saved || 'người đã hỏi');
      expect(info).toMatchObject({ width: 1080, height: 1350 });
      expect(info.bytes).toBeGreaterThan(20_000);
      const png = await inspect(page);
      expect(png.sig).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(png).toMatchObject({ width: 1080, height: 1350 });
      expect(info.title).toBe(letterTitle(info.name));
      await expect(page.locator('#namecard-heading')).toHaveText(info.title);
      expect(png.alt).toBe(letterText(info.name));
      expect(png.body, 'the body is printed').toBeGreaterThan(5000);
      expect(png.signature, 'the signature line is printed').toBeGreaterThan(300);
      expect(png.ink, 'the name is printed').toBeGreaterThan(400);
      expect(png.minX, 'left margin stays clear').toBeGreaterThanOrEqual(130);
      expect(png.maxX, 'right margin stays clear').toBeLessThanOrEqual(1080 - 130);
      expect(png.domImgs, 'the name is never parsed as HTML').toBe(1);
      expect(alerted).toBe(false);
      await expect(page.locator('#namecard-heading *'), 'the heading holds the name as text, with no element in it').toHaveCount(0);
    });
  }

  test('a long name is printed smaller than a short one, and the same name gives the same PNG', async ({ page }) => {
    const fonts: number[] = [];
    const hashes: string[] = [];
    for (const name of ['Lan', 'Nguyễn Thị Phương Anh Thư Ng', 'Lan']) {
      await page.goto('about:blank');
      await toScreen(page, 'the-ten', 'namecard', name);
      await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
      fonts.push((await cardOf(page)).fontPx);
      hashes.push((await inspect(page)).hash);
    }
    expect(fonts[1]!).toBeLessThan(fonts[0]!);
    expect(fonts[0]!).toBe(fonts[2]!);
    expect(hashes[0]).toBe(hashes[2]);
  });

  test('the letter waits for document.fonts.ready', async ({ page }) => {
    await page.addInitScript(() => {
      let release = (): void => undefined;
      const ready = new Promise<FontFaceSet>((resolve) => {
        release = () => resolve(document.fonts);
      });
      (window as unknown as { releaseFonts: () => void }).releaseFonts = release;
      Object.defineProperty(FontFaceSet.prototype, 'ready', { get: () => ready, configurable: true });
    });
    await toScreen(page, 'the-ten', 'namecard');
    await page.waitForTimeout(500);
    expect((await cardOf(page)).ready).toBe(false);
    await page.evaluate(() => (window as unknown as { releaseFonts: () => void }).releaseFonts());
    await expect.poll(async () => (await cardOf(page)).ready, { timeout: 8000 }).toBe(true);
  });

  test('Web Share is called with the PNG file when the browser can share files', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: { type: string; name: string; size: number; title: string }[] = [];
      (window as unknown as { shared: typeof calls }).shared = calls;
      navigator.canShare = (data?: ShareData) => Boolean(data?.files?.length);
      navigator.share = async (data?: ShareData) => {
        const f = data?.files?.[0];
        calls.push({ type: f?.type ?? '', name: f?.name ?? '', size: f?.size ?? 0, title: data?.title ?? '' });
      };
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
    await expect(page.locator('#namecard-share')).toBeVisible();
    await page.locator('#namecard-share').click();
    const calls = await page.evaluate(() => (window as unknown as { shared: { type: string; name: string; size: number }[] }).shared);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ type: 'image/png', name: LETTER_FILE });
    expect(calls[0]!.size).toBeGreaterThan(20_000);
  });

  test('without file sharing the image is shown with a long-press hint and a download link', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
    await expect(page.locator('#namecard-share')).toBeHidden();
    await expect(page.locator('#namecard-img')).toBeVisible();
    await expect(page.locator('#namecard-hint')).toContainText('Nhấn giữ ảnh');
    await expect(page.locator('#namecard-save')).toHaveAttribute('download', LETTER_FILE);
  });

  test('a share that fails falls back to the long-press hint', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = () => Promise.reject(new DOMException('no', 'NotAllowedError'));
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
    await page.locator('#namecard-share').click();
    await expect(page.locator('#namecard-hint')).toContainText('Nhấn giữ ảnh');
  });
});

test.describe('final letter copy (R9, bible §3)', () => {
  const beats = chapterOf('ending').scenes.find((sc) => sc.id === 'the-ten')?.beats ?? [];
  const before = beats.slice(0, beats.findIndex((b) => b.t === 'name-card'));
  const said = before.filter((b) => b.t === 'say' && b.who === 'Tèo').map((b) => (b as { text: string }).text);
  const claims: [string, RegExp, string][] = [
    ['Chắc', /^Chắc: /, 'fact'],
    ['Còn tranh cãi', /^Còn tranh cãi: /, 'disputed'],
    ['Người ta kể rằng', /^Người ta kể rằng /, 'legend'],
  ];

  test('the letter is what Tèo reads aloud in the script: the title line, then every line up to the letter is drawn, and the signature is the last line before it', () => {
    const at = said.indexOf(`${LETTER_LEAD} {ten}.`);
    expect(at, 'the title line').toBeGreaterThanOrEqual(0);
    expect(LETTER_BODY.length).toBeGreaterThan(0);
    expect(said.slice(at + 1), 'the body is every line of Tèo after the title').toEqual(LETTER_BODY);
    const last = before.at(-1) as { t: string; text?: string };
    expect(last.t === 'narr' && last.text?.includes(LETTER_SIGNATURE), 'the signature is the last line before the letter').toBe(true);
  });

  test('the body holds one claim line each for Chắc, Còn tranh cãi and Người ta kể rằng', () => {
    for (const [label, pattern] of claims) expect(LETTER_BODY.filter((line) => pattern.test(line)), label).toHaveLength(1);
  });

  test('the letter is signed Tèo, and the body has no second person', () => {
    expect(LETTER_SIGNATURE).toBe('Tèo');
    expect(LETTER_BODY.join(' ')).not.toMatch(/\bbạn\b/i);
    expect(LETTER_SOURCES.join(' ')).not.toMatch(/\bbạn\b/i);
  });

  test('every paragraph of the letter body has a source line, the opening thesis included', () => {
    expect(LETTER_BODY.length).toBeGreaterThan(0);
    for (const [i, line] of LETTER_BODY.entries()) expect(LETTER_SOURCES[i], line).toMatch(/^Nguồn: \S/);
  });

  const hostsOf = (pieces: { url?: string | string[] }[]): string[] => [...new Set(pieces.flatMap((p) => [p.url ?? []].flat()).map((u) => new URL(u).hostname.replace(/^www\./, '')))];

  test('each claim has a short source line made from the links of the conclusion pieces of its status, and the line without a label from the links of the thesis', () => {
    for (const [i, line] of LETTER_BODY.entries()) {
      const claim = claims.find(([, pattern]) => pattern.test(line));
      const hosts = hostsOf(claim ? LETTER_BANK.filter((p) => p.status === claim[2]) : [LETTER_CONCLUSION.thesis]);
      expect(hosts.length, (claim?.[0] ?? 'thesis') + ' has links').toBeGreaterThan(0);
      expect(LETTER_SOURCES[i], claim?.[0] ?? 'thesis').toBe(`Nguồn: ${hosts.join(', ')}`);
      expect((LETTER_SOURCES[i] ?? '').length, 'a short line').toBeLessThanOrEqual(90);
    }
    expect(LETTER_PARTS.filter((p) => p.sources.length)).toHaveLength(LETTER_BODY.length);
  });

  test('the opening thesis is the one line without a label, it comes first, and its source is quoted in research/', () => {
    const open = LETTER_BODY.filter((line) => !claims.some(([, pattern]) => pattern.test(line)));
    expect(open, 'one line without a label').toEqual([LETTER_BODY[0]]);
    const { source, url, evidence } = LETTER_CONCLUSION.thesis;
    const flat = (s: string): string => s.replace(/\s+/g, ' ');
    const text = flat(readFileSync(source, 'utf8'));
    expect(source).toMatch(/^research\//);
    for (const quote of evidence) expect(text, quote).toContain(flat(quote));
    for (const link of [url ?? []].flat()) expect(text, link).toContain(link);
  });

  test('the source line of a claim comes from the pieces whose label is the claim label, so the status grouping cannot drift from the labels', () => {
    const labels: Record<string, string> = { fact: 'SỰ THẬT', disputed: 'TRANH CÃI', legend: 'TRUYỀN THUYẾT' };
    for (const [i, line] of LETTER_BODY.entries()) {
      const claim = claims.find(([, pattern]) => pattern.test(line));
      if (!claim) continue;
      const byStatus = LETTER_BANK.filter((p) => p.status === claim[2]);
      const byLabel = LETTER_BANK.filter((p) => p.label === labels[claim[2]]);
      expect(byStatus.map((p) => p.label), claim[0] + ': every piece of this status carries this label').toEqual(byStatus.map(() => labels[claim[2]]));
      expect(LETTER_SOURCES[i], claim[0]).toBe(`Nguồn: ${hostsOf(byLabel).join(', ')}`);
    }
  });
});

test.describe('final letter on screen', () => {
  test('the letter screen shows the letter as DOM text, the source under each claim as links, then the signature', async ({ page }) => {
    await toScreen(page, 'the-ten', 'namecard', 'Lan');
    await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
    const box = page.locator('#namecard-letter');
    await expect(box).toBeVisible();
    const paragraphs = await box.locator('p').allTextContents();
    expect(paragraphs).toEqual(LETTER_PARTS.flatMap((part, i) => (LETTER_SOURCES[i] ? [part.text, LETTER_SOURCES[i] as string] : [part.text])).concat(LETTER_SIGNATURE));
    expect(await box.locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), 'readable size').toBeGreaterThanOrEqual(14);
    const links = await box.locator('a').evaluateAll((els) => els.map((el) => ({ text: el.textContent, href: (el as HTMLAnchorElement).href, rel: (el as HTMLAnchorElement).rel, target: (el as HTMLAnchorElement).target })));
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      expect(new URL(link.href).hostname.replace(/^www\./, '')).toBe(link.text);
      expect(link.rel).toContain('noopener');
      expect(link.target).toBe('_blank');
    }
    await expect(page.locator('#namecard-heading')).toHaveText(letterTitle('Lan'));
    await expect(page.locator('#namecard-letter')).not.toContainText(/\bbạn\b/i);
  });

  test('the exported image draws every claim, its source line and the signature inside the sheet', async ({ page }) => {
    await page.addInitScript(() => {
      const drawn: { text: string; font: string; y: number }[] = [];
      (window as unknown as { drawn: typeof drawn }).drawn = drawn;
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text: string, x: number, y: number, max?: number) {
        drawn.push({ text, font: this.font, y });
        return original.call(this, text, x, y, max as number);
      };
    });
    await toScreen(page, 'the-ten', 'namecard', 'Lan');
    await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
    const drawn = await page.evaluate(() => (window as unknown as { drawn: { text: string; font: string; y: number }[] }).drawn);
    const text = drawn.map((d) => d.text).join(' ');
    for (const part of LETTER_PARTS) expect(text, part.text).toContain(part.text);
    for (const source of LETTER_SOURCES.filter((s): s is string => s !== null)) expect(text, source).toContain(source);
    const rows = drawn.filter((d) => d.y >= 600 && d.y < 1150);
    expect(Math.max(...rows.map((r) => r.y)), 'the last line of the body stays above the signature').toBeLessThanOrEqual(1110);
    const sizes = rows.map((r) => parseFloat(/(\d+(?:\.\d+)?)px/.exec(r.font)?.[1] ?? '0'));
    expect(Math.min(...sizes), 'no line smaller than 16 px on the 1080 px sheet').toBeGreaterThanOrEqual(16);
    const sig = drawn.find((d) => d.text === LETTER_SIGNATURE);
    expect(sig?.y).toBe(1190);
  });
});
