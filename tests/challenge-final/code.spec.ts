import { expect, test, type Page } from '@playwright/test';
import { encodeCode, makeCode, parseCode } from '../../src/code.ts';
import { ORDER } from '../../src/order.ts';
import { cleanName } from '../../src/save.ts';
import { advanceStory, seedSave, stateOf, typeName, waitReady } from '../support/play.ts';
import { rng, SAVE, seedStorage } from './helpers.ts';

test.describe.configure({ timeout: 120_000 });

const LAST = ORDER.length - 1;

test.describe('the code as a value', () => {
  test('every older code (a chapter at or before its farthest chapter, any of the 20) still parses to its chapters, with no finished mark', () => {
    let n = 0;
    for (let chapter = 0; chapter <= LAST; chapter += 1)
      for (let furthest = chapter; furthest <= LAST; furthest += 1) {
        const r = parseCode(encodeCode(chapter, furthest, 'Lan'));
        expect(r.ok, chapter + '/' + furthest).toBe(true);
        if (r.ok) expect(r.data).toEqual({ name: 'Lan', chapter: ORDER[chapter], furthest: ORDER[furthest] });
        n += 1;
      }
    expect(n).toBe(210);
  });

  test('the finished code is chapter 20 with the last chapter as farthest; any other use of that number, and anything past it, is refused', () => {
    const done = parseCode(encodeCode(20, LAST, 'Lan'));
    expect(done.ok && done.data).toEqual({ name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true });
    expect(parseCode(makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending', finished: true }))).toEqual(done);
    expect(parseCode(makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' })).ok && (parseCode(makeCode({ name: 'Lan', chapter: 'ending', furthest: 'ending' })) as { data: { finished?: boolean } }).data.finished, 'the ending chapter alone is not the finished game').toBeUndefined();
    for (const [c, f] of [[20, 18], [20, 0], [20, 20], [21, 19], [99, 19], [19, 20]] as const) expect(parseCode(encodeCode(c, f, 'Lan')).ok, c + '/' + f).toBe(false);
    expect(parseCode(makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule', finished: true })).ok && (parseCode(makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule', finished: true })) as { data: { finished?: boolean } }).data.finished, 'a finished mark on a chapter that is not the last is dropped').toBeUndefined();
  });

  test('3000 hostile names: cleaning twice changes nothing, and the code of a cleaned name reads back as the same name', () => {
    const rand = rng(20240607);
    const pool = ['a', 'Z', ' ', '  ', 'Đ', 'ặ', 'ế', 'e\u0301', 'o\u031B\u0323', '\u0301', '\u0323', '\u0302', '€', '中', '한', '😀', '👨\u200d👩\u200d👧', '🇻🇳', '🏳️\u200d🌈', '\u200b', '\u202e', '\u0000', '\ud83d', '\ude00', '\ufeff', '\u00ad', '\t', '\n', '\u2028', '\u00a0', 'ﬃ', 'ǆ', '\u1100\u1161\u11a8', '\u0e01\u0e33', '\u0627\u0644', '<b>', '&amp;', '{ten}', "'", '"', '\\', '%', '$&'];
    const bad: string[] = [];
    for (let i = 0; i < 3000; i += 1) {
      let raw = '';
      for (let k = Math.floor(rand() * 40) + 1; k > 0; k -= 1) raw += pool[Math.floor(rand() * pool.length)] as string;
      const once = cleanName(raw);
      const twice = cleanName(once);
      if (once !== twice) bad.push('not idempotent ' + JSON.stringify(raw) + ' -> ' + JSON.stringify(once) + ' -> ' + JSON.stringify(twice));
      const r = parseCode(makeCode({ name: once, chapter: 'saturnalia', furthest: 'yule' }));
      if (!r.ok) bad.push('code of ' + JSON.stringify(once) + ' refused: ' + r.reason);
      else if (r.data.name !== once) bad.push('name changed ' + JSON.stringify(once) + ' -> ' + JSON.stringify(r.data.name));
    }
    expect(bad.slice(0, 5), bad.length + ' of 3000').toEqual([]);
  });

  const spread = (code: string, ch: string): string[] => [ch + code, code + ch, code.slice(0, 7) + ch + code.slice(7), code.split('').join(ch), code.replace(/\./gu, ch + '.' + ch)];
  const code = encodeCode(5, 7, 'Lan Anh');

  test('a pasted code with any format character or space of the Unicode spaces loads, wherever it sits', () => {
    const chars = ['\u200b', '\u200c', '\u200d', '\u200e', '\u200f', '\u202a', '\u202c', '\u202d', '\u202e', '\u2060', '\u2061', '\u2063', '\u2066', '\u2069', '\ufeff', '\u00ad', '\u061c', '\u180e', '\u{e0020}', ' ', '\t', '\n', '\r\n', '\u00a0', '\u2028', '\u2029', '\u202f', '\u3000', '\u2003'];
    const bad = chars.flatMap((ch) => spread(code, ch).filter((c) => !parseCode(c).ok).map(() => 'U+' + (ch.codePointAt(0) as number).toString(16)));
    expect([...new Set(bad)]).toEqual([]);
  });

  test('a pasted code with an invisible character that is not a format character (grapheme joiner, Hangul filler, variation selector, next line) loads like the one without it', () => {
    const chars = ['\u0085', '\u034f', '\u115f', '\u1160', '\u17b4', '\u17b5', '\u180b', '\u180c', '\u180d', '\u180f', '\u3164', '\ufe00', '\ufe0f', '\uffa0', '\u{e0100}'];
    const bad = chars.filter((ch) => spread(code, ch).some((c) => !parseCode(c).ok)).map((ch) => 'U+' + (ch.codePointAt(0) as number).toString(16));
    expect(bad, 'these characters have no width on screen, so a copied code that carries one looks right and is refused').toEqual([]);
  });
});

const forget = async (page: Page): Promise<void> => {
  await page.locator('#menu-open').click();
};

async function useCode(page: Page, text: string): Promise<void> {
  await forget(page);
  await page.locator('#menu-code').click();
  await page.locator('#code-input').fill(text);
  await page.locator('#code-use').click();
}

const saved = async (page: Page): Promise<{ chapter: string; furthest: string; scene: string; name: string }> => JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE)) as string);

test('codes in turn: the finished code, an older code, the finished code again: each lands on its own screen, the farthest chapter never drops, and a reload stays where it landed', async ({ page }) => {
  await seedStorage(page, { [SAVE]: JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }) });
  await page.goto('/');
  await waitReady(page);
  await useCode(page, encodeCode(20, LAST, 'Mai'));
  await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('end');
  expect(await saved(page)).toMatchObject({ chapter: 'ending', furthest: 'ending', scene: 'end', name: 'Mai' });
  await page.reload();
  await waitReady(page);
  expect((await stateOf(page)).shell.mode, 'a reload on the end screen').toBe('end');
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await expect(page.locator('#code-mine')).toHaveValue(makeCode({ name: 'Mai', chapter: 'ending', furthest: 'ending', finished: true }));
  await page.locator('#code-input').fill(encodeCode(2, 2, 'Mai'));
  await page.locator('#code-use').click();
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('yule');
  await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
  expect(await saved(page)).toMatchObject({ chapter: 'yule', furthest: 'ending', scene: expect.not.stringMatching(/^end$/u) });
  await page.reload();
  await waitReady(page);
  expect([(await stateOf(page)).shell.mode, (await stateOf(page)).story?.chapter], 'a reload after the older code').toEqual(['story', 'yule']);
  await useCode(page, encodeCode(19, LAST, 'Mai'));
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('ending');
  await expect.poll(async () => (await stateOf(page)).story?.scene, 'the unfinished code of the ending starts the chapter, not the end screen').toBe('thao-may');
  expect((await saved(page)).scene).not.toBe('end');
});

test('a code entered while the first chapter is still loading wins: the late chapter does not replace it and the shell becomes ready', async ({ page }) => {
  await page.route(/\/assets\/chapter-yule-(?!cat-|lads-)[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await route.continue();
  });
  await seedStorage(page, { [SAVE]: JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }) });
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(async () => (await stateOf(page).catch(() => null))?.shell.mode).toBe('loading');
  await useCode(page, encodeCode(1, 2, 'Lan'));
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('saturnalia');
  await page.waitForTimeout(4500);
  const s = await stateOf(page);
  expect([s.shell.mode, s.story?.chapter, s.shell.phase], 'after the late chunk').toEqual(['story', 'saturnalia', 'ready']);
  expect(await saved(page)).toMatchObject({ chapter: 'saturnalia', furthest: 'yule' });
});

test('Chơi mới while the first chapter is still loading wins the same way', async ({ page }) => {
  await page.route(/\/assets\/chapter-yule-(?!cat-|lads-)[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3500));
    await route.continue();
  });
  await seedStorage(page, { [SAVE]: JSON.stringify({ schemaVersion: 1, name: 'Lan', furthest: 'yule', chapter: 'yule', scene: '' }) });
  await page.goto('/', { waitUntil: 'commit' });
  await expect.poll(async () => (await stateOf(page).catch(() => null))?.shell.mode).toBe('loading');
  await page.locator('#menu-open').click();
  await page.locator('#menu-new').click();
  await page.locator('#confirm-new-yes').click();
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('intro');
  await page.waitForTimeout(4500);
  const s = await stateOf(page);
  expect([s.shell.mode, s.story?.chapter, s.shell.phase], 'after the late chunk').toEqual(['story', 'intro', 'ready']);
  expect(await saved(page)).toMatchObject({ chapter: 'intro', furthest: 'intro' });
});

test('a code entered while the puzzle chunk is still loading: the late puzzle does not open over the new chapter and the story can be advanced', async ({ page }, info) => {
  await page.route(/\/assets\/pz-intro-[^/]+\.js$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 9000));
    await route.continue();
  });
  await seedSave(page);
  await page.goto('/');
  await waitReady(page);
  let still = 0;
  for (let i = 0; i < 40 && still < 3; i += 1) {
    const s = await stateOf(page);
    const sig = `${s.story?.scene}|${s.story?.beat}|${s.story?.asking}`;
    if (s.story?.asking) await typeName(page, 'Lan');
    else if (s.shell.mode === 'story') await page.locator('#advance').click({ timeout: 1500 });
    else break;
    await page.waitForTimeout(300);
    const u = await stateOf(page);
    still = `${u.story?.scene}|${u.story?.beat}|${u.story?.asking}` === sig ? still + 1 : 0;
  }
  expect((await stateOf(page)).game, 'the puzzle is still loading').toBeNull();
  await useCode(page, encodeCode(1, 1, 'Lan'));
  await expect.poll(async () => (await stateOf(page)).story?.chapter).toBe('saturnalia');
  await page.waitForTimeout(9500);
  const s = await stateOf(page);
  expect([s.shell.mode, s.game, s.story?.chapter]).toEqual(['story', null, 'saturnalia']);
  const before = s.story?.lineIndex;
  await advanceStory(page, info);
  expect((await stateOf(page)).story?.lineIndex, 'the story moves on').not.toBe(before);
});
