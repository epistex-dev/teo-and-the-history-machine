import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { watch, expectClean } from '../challenge/helpers.ts';
import { seedSave, stateOf, waitReady } from '../support/play.ts';
import { LETTER_LEAD, letterText } from '../support/letter.ts';
import { advanceUntil, linesBefore } from '../support/ending.ts';

test.describe.configure({ timeout: 90_000 });

/** Bible §7 rows: id, label cell, "Mốc" cell. */
const BIBLE: Record<string, { label: string; moc: string }> = {};
for (const line of readFileSync('story/bible.md', 'utf8').split('\n')) {
  const m = /^\| \d+ \| `([a-z0-9-]+)` \| ([^|]*)\| ([^|]*)\| ([^|]*)\|/.exec(line);
  if (m && /^(Cổ|KT|DG|khung)/.test(m[2]!.trim())) BIBLE[m[1]!] = { label: m[2]!.trim(), moc: m[3]!.trim() };
}

const ending = (scene: string, name = 'Lan') => ({ schemaVersion: 1, name, furthest: 'ending', chapter: 'ending', scene });

async function toScreen(page: Page, scene: string, mode: string, name?: string): Promise<void> {
  await seedSave(page, ending(scene, name));
  await page.goto('/');
  await waitReady(page);
  await advanceUntil(page, mode);
  await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { kind?: string } | null }).screen?.kind).toBe(mode);
}

type Card = { kind: string; ready: boolean; name: string; fontPx: number; width: number; height: number; bytes: number; shareable: boolean };
const cardOf = async (page: Page): Promise<Card> => ((await stateOf(page)).story as unknown as { screen: Card }).screen;

async function cardReady(page: Page, name?: string): Promise<void> {
  await toScreen(page, 'the-ten', 'namecard', name);
  await expect.poll(async () => (await cardOf(page)).ready).toBe(true);
}

async function pngOf(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#namecard-save').click()]);
  return readFileSync((await download.path()) as string);
}

test.describe('ending timeline against bible §7', () => {
  test('bible §7 parsed: 20 chapters', async () => {
    expect(Object.keys(BIBLE)).toHaveLength(20);
  });

  test('every node carries the label and † of bible §7 and the "Mốc" text of its row, and the nodes are exactly the dated chapters', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    const rows = await page.locator('#timeline li[data-node]').evaluateAll((els) => els.map((e) => ({ id: (e as HTMLElement).dataset.node ?? '', label: (e.querySelector('.label')?.textContent ?? '').trim(), moc: (e.querySelector('.moc')?.textContent ?? '').trim() })));
    const dated = Object.entries(BIBLE).filter(([id, v]) => v.label !== 'khung' && !/^chưa rõ/.test(v.moc) && id).map(([id]) => id);
    expect(rows.map((r) => r.id).sort()).toEqual([...dated].sort());
    for (const r of rows) {
      expect(r.label, r.id).toBe(BIBLE[r.id]!.label);
      expect(r.moc, r.id + ' "Mốc"').toBe(BIBLE[r.id]!.moc);
    }
  });

  test('the "Chưa rõ năm" block lists befana and brooms with their bible reason, not a made-up year', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    const items = await page.locator('#timeline-unknown li').evaluateAll((els) => els.map((e) => ({ id: (e as HTMLElement).dataset.unknown ?? '', text: e.textContent ?? '' })));
    expect(items.map((i) => i.id)).toEqual(['befana', 'brooms']);
    for (const i of items) {
      expect(i.text, i.id).not.toMatch(/\b(1[0-9]{3}|20[0-9]{2})\b/);
      expect(i.text, i.id).toContain(BIBLE[i.id]!.label.replace(' †', '').trim());
    }
  });

  test('the player can read what Cổ, KT, DG and † mean: the full names and the dagger note are visible text, not hover tooltips', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    const text = await page.locator('#timeline-screen').innerText();
    for (const name of ['Lễ mùa đông cổ', 'Kitô giáo', 'Dân gian và hiện đại']) expect(text, name + ' is only in a tooltip').toContain(name);
    expect(text, 'the † note is only in a tooltip').toContain('gốc cổ chưa chứng minh');
  });

  test('the list has the 18 items (16 dated and 2 frames) as an ordered list, and the dated ones never go backwards in time', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    await expect(page.locator('ol#timeline > li')).toHaveCount(18);
    const years = await page.locator('#timeline li[data-node]').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.year)));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  test('"Lật trang" tapped twice at once leaves the timeline once and does not skip the first line of the next scene', async ({ page }) => {
    await toScreen(page, 'dong-thoi-gian', 'timeline');
    await page.locator('#timeline-next').dblclick();
    await expect.poll(async () => (await stateOf(page)).shell.mode).not.toBe('timeline');
    await page.waitForTimeout(400);
    const s = (await stateOf(page)).story as unknown as { scene: string; lineIndex: number };
    const mode = (await stateOf(page)).shell.mode;
    expect(mode, 'a second tap skipped the line of the name-card scene').toBe('story');
    expect(s.scene).toBe('the-ten');
    expect(s.lineIndex).toBe(1);
  });

  test('"Xong" tapped twice at once on the name card does not skip the closing line', async ({ page }) => {
    await cardReady(page);
    await page.locator('#namecard-next').dblclick();
    await page.waitForTimeout(400);
    const st = (await stateOf(page)).story as unknown as { lineIndex: number; scene: string };
    expect(st.scene).toBe('the-ten');
    expect((await stateOf(page)).shell.mode).toBe('story');
    expect(st.lineIndex, 'the closing line was never on screen').toBe(linesBefore('the-ten', 'name-card') + 1);
  });
});

test.describe('name card: names that stress the layout', () => {
  async function bounds(page: Page, png: Buffer) {
    const img = PNG.sync.read(png);
    const paper = [236, 226, 200];
    const differs = (x: number, y: number) => {
      const i = (img.width * y + x) * 4;
      return Math.abs(img.data[i]! - paper[0]!) + Math.abs(img.data[i + 1]! - paper[1]!) + Math.abs(img.data[i + 2]! - paper[2]!) > 40;
    };
    let left = 0;
    let right = 0;
    for (let y = 330; y < 540; y += 1) {
      for (let x = 100; x < 130; x += 1) if (differs(x, y)) left += 1;
      for (let x = 951; x < 981; x += 1) if (differs(x, y)) right += 1;
    }
    let ink = 0;
    for (let y = 330; y < 540; y += 1) for (let x = 100; x < 980; x += 1) if (differs(x, y)) ink += 1;
    void page;
    return { left, right, ink, width: img.width, height: img.height };
  }

  const names: [string, string][] = [
    ['24 capital W', 'W'.repeat(24)],
    ['24 capital M', 'M'.repeat(24)],
    ['12 CJK ideographs (24 characters of width)', '漢字漢字漢字漢字漢字漢字漢字漢字漢字漢字漢字漢字'],
    ['24 fullwidth letters', 'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸ'],
    ['24 emoji', '🎄🎅🦌🎁⛄🔔🕯🍪🎄🎅🦌🎁⛄🔔🕯🍪🎄🎅🦌🎁⛄🔔🕯🍪'],
    ['24 Vietnamese letters with stacked marks', 'ỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆỆ'],
    ['Arabic (right to left)', 'مرحبا بالعالم مرحبا بالعالم'],
    ['Hebrew followed by Latin', 'שלום עולם Lan'],
    ['one letter', 'A'],
  ];
  for (const [label, name] of names) {
    test('a name of ' + label + ' is printed inside the margins of the sheet', async ({ page }) => {
      const w = watch(page);
      await cardReady(page, name);
      const png = await pngOf(page);
      const b = await bounds(page, png);
      expect(b).toMatchObject({ width: 1080, height: 1350 });
      expect(b.ink, 'something is printed').toBeGreaterThan(200);
      expect(b.left, 'ink in the left margin of the sheet').toBe(0);
      expect(b.right, 'ink in the right margin of the sheet').toBe(0);
      expectClean(w);
    });
  }

  test('an empty name prints "người đã hỏi" and says so in the picture description', async ({ page }) => {
    await cardReady(page, '');
    const info = await cardOf(page);
    expect(info.name).toBe('người đã hỏi');
    await expect(page.locator('#namecard-img')).toHaveAttribute('alt', letterText('người đã hỏi'));
    await expect(page.locator('#namecard-heading')).toHaveText(`${LETTER_LEAD} người đã hỏi`);
  });

  test('the name really is printed on the picture: reading the PNG back finds the heading, the name, the body and the signature', async ({ page }, info) => {
    let tesseract = true;
    try {
      execFileSync('tesseract', ['--version'], { stdio: 'ignore' });
    } catch {
      tesseract = false;
    }
    test.skip(!tesseract, 'tesseract is not installed');
    await cardReady(page, 'Hoàng Minh Khôi');
    const png = await pngOf(page);
    const dir = join(process.env.TMPDIR ?? '/var/tmp', 'Game', 'ch-m2b-ocr-' + info.project.name);
    mkdirSync(dir, { recursive: true });
    try {
      const file = join(dir, 'card.png');
      writeFileSync(file, png);
      const out = execFileSync('tesseract', [file, 'stdout', '-l', 'vie', '--psm', '6'], { encoding: 'utf8' });
      const plain = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
      expect(plain, 'heading in: ' + out).toContain('thu tra loi gui');
      expect(plain, 'name in: ' + out).toContain('hoang minh khoi');
      expect(plain, 'body in: ' + out).toContain('giang sinh la su pha tron nhieu lop');
      expect(plain, 'signature in: ' + out).toMatch(/\bteo\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe('name card: sharing and failures', () => {
  test('a canShare that throws (some browsers do for files) still gives the picture and the download link', async ({ page }) => {
    const w = watch(page);
    await page.addInitScript(() => {
      navigator.canShare = () => {
        throw new TypeError('files are not supported');
      };
    });
    await cardReady(page);
    await expect(page.locator('#namecard-img')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#namecard-save')).toBeVisible();
    await expect(page.locator('#namecard-share')).toBeHidden();
    expectClean(w);
  });

  test('canShare says yes but share does not exist: no Chia sẻ button that would do nothing', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await cardReady(page);
    await expect(page.locator('#namecard-share'), 'a share button without a share function').toBeHidden();
  });

  test('a share that throws at once (not a rejected promise) is handled: no page error, and the long-press hint appears', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = () => {
        throw new DOMException('Share must follow a user gesture', 'NotAllowedError');
      };
    });
    await cardReady(page);
    await page.locator('#namecard-share').click();
    await expect(page.locator('#namecard-hint')).toContainText('Nhấn giữ ảnh');
    expect(errors).toEqual([]);
  });

  test('a share that the player cancels (AbortError) leaves the screen as it was', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.canShare = () => true;
      navigator.share = () => Promise.reject(new DOMException('cancelled', 'AbortError'));
    });
    await cardReady(page);
    const hint = await page.locator('#namecard-hint').textContent();
    await page.locator('#namecard-share').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#namecard-hint'), 'cancelling the share sheet is not a failure').toHaveText(hint ?? '');
    await expect(page.locator('#namecard-share')).toBeVisible();
  });

  test('a canvas that gives no PNG leaves a message, no broken picture, and "Xong" still leaves the screen', async ({ page }) => {
    const w = watch(page);
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback) {
        callback(null);
      };
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect(page.locator('#namecard-hint')).toContainText('Không tạo được ảnh lá thư');
    await expect(page.locator('#namecard-save')).toBeHidden();
    await expect(page.locator('#namecard-img')).not.toHaveAttribute('src', /.+/);
    await page.locator('#namecard-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expectClean(w);
  });

  test('no 2D canvas at all leaves a message and "Xong" still leaves the screen', async ({ page }) => {
    const w = watch(page);
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, options?: unknown) => unknown;
      (HTMLCanvasElement.prototype as unknown as { getContext: typeof original }).getContext = function (id, options) {
        return this.width === 1080 && this.height === 1350 ? null : original.call(this, id, options);
      };
    });
    await toScreen(page, 'the-ten', 'namecard');
    await expect(page.locator('#namecard-hint')).toContainText('không vẽ được');
    await page.locator('#namecard-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    expectClean(w);
  });
});
