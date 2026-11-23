import { expect, test, type Page } from '@playwright/test';
import { watch, expectClean } from '../challenge/helpers.ts';
import { advanceUntil } from '../support/ending.ts';
import { SAVE_KEY, seedSave, stateOf, storedSave, storyOf, waitReady } from '../support/play.ts';
import { chapterOf } from '../support/script.ts';

test.describe.configure({ timeout: 90_000 });

/** Contract (src/CORE.md): TEO1.<chapter 2 digits>.<furthest 2 digits>.n<name base64url>.<6 chars A-Z0-9 FNV checksum>. */
const IDS = ['intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas', 'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night', 'yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms', 'ending'];

function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return (h % 2176782336).toString(36).toUpperCase().padStart(6, '0');
}
const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const pad = (n: number | string): string => String(n).padStart(2, '0');

/** Forges a code with a valid checksum around any chapter text and any name bytes. */
function forge(chapter: number | string, furthest: number | string, name: string | Uint8Array): string {
  const bytes = typeof name === 'string' ? new TextEncoder().encode(name) : name;
  const body = ['TEO1', typeof chapter === 'number' ? pad(chapter) : chapter, typeof furthest === 'number' ? pad(furthest) : furthest, 'n' + b64url(bytes)].join('.');
  return body + '.' + checksum(body);
}

const save = (extra: Record<string, unknown> = {}) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene: 'phong-ho-so', ...extra });

async function open(page: Page, seed: object | null = save(), query = ''): Promise<void> {
  if (seed) await seedSave(page, seed);
  await page.goto('/' + query);
  await waitReady(page);
}

async function openCode(page: Page): Promise<void> {
  await page.locator('#menu-open').click();
  await page.locator('#menu-code').click();
  await expect(page.locator('#code-dialog')).toBeVisible();
}

async function submit(page: Page, text: string): Promise<void> {
  await page.locator('#code-input').fill(text);
  await page.locator('#code-use').click();
}

/** The code is refused: a message, the dialog stays, the save and the screen do not change. */
async function expectRefused(page: Page, why: string): Promise<void> {
  const before = await storedSave(page);
  const mode = (await stateOf(page)).shell.mode;
  const story = (await stateOf(page)).story;
  await expect(page.locator('#code-error'), why).not.toHaveText('');
  await expect(page.locator('#code-dialog'), why).toBeVisible();
  expect(await storedSave(page), why).toBe(before);
  const after = await stateOf(page);
  expect(after.shell.mode, why).toBe(mode);
  expect(after.story?.scene, why).toBe(story?.scene);
}

async function expectLoaded(page: Page, want: { name: string; chapter: string; furthest: string }): Promise<void> {
  await expect(page.locator('#code-dialog')).toBeHidden();
  await expect.poll(async () => (await stateOf(page)).shell.save.chapter).toBe(want.chapter);
  expect((await stateOf(page)).shell.save).toMatchObject(want);
}

test.describe('continue code: tampering is always refused', () => {
  test('changing or deleting any single character of a valid code is refused with a message and changes nothing', async ({ page }) => {
    const w = watch(page);
    await open(page);
    await openCode(page);
    const good = forge(5, 9, 'Mai Anh');
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    for (let i = 0; i < good.length; i += 1) {
      const swap = alphabet[(alphabet.indexOf(good[i]!) + 1 + (i % 7)) % alphabet.length]!;
      await submit(page, good.slice(0, i) + (swap === good[i] ? '!' : swap) + good.slice(i + 1));
      await expectRefused(page, 'char ' + i + ' of ' + good + ' replaced by ' + swap);
      await submit(page, good.slice(0, i) + good.slice(i + 1));
      await expectRefused(page, 'char ' + i + ' of ' + good + ' deleted');
    }
    expectClean(w);
  });

  test('a truncated code and a code with extra text appended are refused', async ({ page }) => {
    await open(page);
    await openCode(page);
    const good = forge(2, 2, 'Lan');
    for (const bad of [good.slice(0, -1), good.slice(0, 20), good + '.', good + '.00', good + 'A', 'x' + good, '.' + good, good.replace('.', '..')]) {
      await submit(page, bad);
      await expectRefused(page, JSON.stringify(bad));
    }
  });

  test('another schema, case and look-alike characters are refused', async ({ page }) => {
    await open(page);
    await openCode(page);
    const good = forge(3, 3, 'Lan');
    const rows: [string, string][] = [
      ['TEO0', good.replace('TEO1', 'TEO0')],
      ['TEO2 with its own valid checksum', forge(3, 3, 'Lan').replace(/^TEO1/, 'TEO2')],
      ['TEO10', good.replace('TEO1', 'TEO10')],
      ['lower-case prefix', good.replace('TEO1', 'teo1')],
      ['fullwidth digit one', good.replace('TEO1', 'TEO\uff11')],
      ['Cyrillic E', good.replace('TEO1', 'T\u0415O1')],
      ['Arabic-Indic digits', good.replace('.03.03.', '.\u0660\u0663.\u0660\u0663.')],
      ['three-digit chapter', good.replace('.03.', '.003.')],
      ['one-digit chapter', good.replace('.03.', '.3.')],
      ['signed chapter', good.replace('.03.', '.+3.')],
      ['exponent chapter', good.replace('.03.', '.3e0.')],
    ];
    for (const [label, bad] of rows) {
      await submit(page, bad);
      await expectRefused(page, label);
    }
  });

  test('invisible format characters inside a pasted code (zero-width space, soft hyphen) are dropped and the code loads', async ({ page }) => {
    await open(page);
    await openCode(page);
    const good = forge(3, 3, 'Lan');
    await submit(page, good.slice(0, 10) + '\u200b' + good.slice(10, 20) + '\u00ad' + good.slice(20));
    await expectLoaded(page, { name: 'Lan', chapter: IDS[3] as string, furthest: IDS[3] as string });
  });

  test('a lower-case copy of a valid code never loads other progress than the original', async ({ page }) => {
    await open(page);
    await openCode(page);
    await submit(page, forge(5, 9, 'Mai Anh').toLowerCase());
    const mode = (await stateOf(page)).shell.save;
    if (await page.locator('#code-dialog').isVisible()) {
      await expect(page.locator('#code-error')).not.toHaveText('');
      expect(mode).toMatchObject({ chapter: 'intro', name: 'Lan' });
    } else {
      expect(mode).toMatchObject({ chapter: IDS[5], furthest: IDS[9], name: 'Mai Anh' });
    }
  });

  test('a code that points past the last chapter, or that is ahead of its own farthest chapter, is refused', async ({ page }) => {
    await open(page);
    await openCode(page);
    const rows: [string, string][] = [
      ['chapter 20 (no such chapter)', forge(20, 20, 'Lan')],
      ['chapter 99', forge(99, 99, 'Lan')],
      ['farthest 20 with chapter 0', forge(0, 20, 'Lan')],
      ['chapter 19 but farthest 18', forge(19, 18, 'Lan')],
      ['chapter 1 but farthest 0', forge(1, 0, 'Lan')],
    ];
    for (const [label, bad] of rows) {
      await submit(page, bad);
      await expectRefused(page, label);
    }
  });

  test('a name that is not UTF-8, is empty of the n prefix, or holds control characters never reaches the game as is', async ({ page }) => {
    await open(page);
    await openCode(page);
    const invalidUtf8 = forge(2, 2, new Uint8Array([0xff, 0xfe, 0x41]));
    const noPrefix = forge(2, 2, 'Lan').replace('.nTGFu.', '.TGFu.');
    for (const [label, bad] of [['invalid UTF-8', invalidUtf8], ['name segment without the n prefix', noPrefix]] as const) {
      await submit(page, bad);
      await expectRefused(page, label);
    }
    for (const [label, name] of [['newline', 'La\nn'], ['NUL', 'La\u0000n'], ['bidi override', '\u202eLan'], ['zero width space', 'La\u200bn'], ['25 characters', 'A'.repeat(25)], ['200 characters', 'B'.repeat(150)], ['not NFC', 'Te\u0300o'], ['edge spaces', '  Lan  ']] as const) {
      await submit(page, forge(2, 2, name));
      if (await page.locator('#code-dialog').isVisible()) {
        await expectRefused(page, label);
        continue;
      }
      const got = (await stateOf(page)).shell.save.name;
      expect(got, label + ' accepted only after cleaning').toBe(got.normalize('NFC').trim());
      expect(got, label).not.toMatch(/[\p{Cc}\p{Cf}]/u);
      expect([...got].length, label).toBeLessThanOrEqual(24);
      await openCode(page);
    }
  });

  test('a one-megabyte paste is refused at once and hostile text is shown as text', async ({ page }) => {
    const w = watch(page);
    let dialogs = 0;
    page.on('dialog', async (d) => {
      dialogs += 1;
      await d.dismiss();
    });
    await open(page);
    await openCode(page);
    const started = Date.now();
    await submit(page, 'TEO1.' + 'A'.repeat(1_000_000));
    await expectRefused(page, '1 MB paste');
    expect(Date.now() - started, 'refusal must not hang the page').toBeLessThan(5000);
    await submit(page, '<img src=x onerror=alert(1)>TEO1.00.00.nTGFu.AAAAAA');
    await expectRefused(page, 'markup');
    await expect(page.locator('#code-error img')).toHaveCount(0);
    expect(dialogs).toBe(0);
    expectClean(w);
  });
});

test.describe('continue code: valid codes', () => {
  test('the shortest code (chapter 1, empty name) and the longest chapter (ending) load', async ({ page }) => {
    await open(page);
    await openCode(page);
    await submit(page, forge(0, 0, ''));
    await expectLoaded(page, { name: '', chapter: 'intro', furthest: 'intro' });
    await expect.poll(async () => (await storyOf(page)).scene).toBe('phong-ho-so');
    await openCode(page);
    await submit(page, forge(19, 19, 'Lan'));
    await expectLoaded(page, { name: 'Lan', chapter: 'ending', furthest: 'ending' });
    await expect.poll(async () => (await storyOf(page)).scene).toBe(chapterOf('ending').scenes[0]?.id);
  });

  test('entering a code with the spaces, tabs and line breaks of a wrapped paste is accepted and loads the same progress', async ({ page }) => {
    await open(page);
    await openCode(page);
    const good = forge(2, 2, 'Lan');
    await submit(page, '\t ' + good.slice(0, 9) + '\n' + good.slice(9, 20) + ' \r\n' + good.slice(20) + '\n');
    await expectLoaded(page, { name: 'Lan', chapter: 'yule', furthest: 'yule' });
  });

  test('after a refusal the message goes away when the dialog is opened again, and a correct code then loads', async ({ page }) => {
    await open(page);
    await openCode(page);
    await submit(page, 'nonsense nonsense nonsense');
    await expect(page.locator('#code-error')).not.toHaveText('');
    await page.keyboard.press('Escape');
    await expect(page.locator('#code-dialog')).toBeHidden();
    await openCode(page);
    await expect(page.locator('#code-error')).toHaveText('');
    await expect(page.locator('#code-input')).toHaveValue('');
    await submit(page, forge(3, 4, 'Bo'));
    await expectLoaded(page, { name: 'Bo', chapter: 'mistletoe', furthest: 'bethlehem' });
  });

  test('entering an older code while the save is further along does not lower the farthest chapter (Sổ nguồn and later codes keep it)', async ({ page }) => {
    await open(page, save({ furthest: 'dec25', chapter: 'dec25', scene: '' }));
    await openCode(page);
    await submit(page, forge(2, 2, 'Lan'));
    await expect.poll(async () => (await stateOf(page)).shell.save.chapter).toBe('yule');
    const furthest = (await stateOf(page)).shell.save.furthest;
    expect(IDS.indexOf(furthest), 'the farthest chapter reached (dec25) is kept').toBeGreaterThanOrEqual(IDS.indexOf('dec25'));
  });

  test('a code whose chapter has a script starts that chapter at its first scene and never plays a half scene', async ({ page }) => {
    await open(page, save({ scene: 'kim-ket' }));
    await openCode(page);
    await submit(page, forge(0, 0, 'Lan'));
    await expectLoaded(page, { name: 'Lan', chapter: 'intro', furthest: 'intro' });
    await expect.poll(async () => (await storyOf(page)).scene).toBe('phong-ho-so');
    expect((await storyOf(page)).lineIndex).toBe(1);
    expect((await stateOf(page)).shell.save.scene).toBe('phong-ho-so');
  });

  test('the code survives a reload and the new code shown afterwards is the same code', async ({ page }) => {
    await open(page);
    await openCode(page);
    const code = forge(6, 8, 'Bảo Ngọc');
    await submit(page, code);
    await expectLoaded(page, { name: 'Bảo Ngọc', chapter: 'nicholas', furthest: 'krampus' });
    await page.reload();
    await waitReady(page);
    await openCode(page);
    await expect(page.locator('#code-mine')).toHaveValue(code);
  });
});

test.describe('continue code: the code the game shows must read back', () => {
  const names: [string, string][] = [
    ['24 Vietnamese letters with marks', 'Nguyễn Thị Phương Anh Thư Ng'],
    ['24 emoji', '🎄'.repeat(24)],
    ['24 flag emoji (8 bytes each)', '🇻🇳'.repeat(24)],
    ['24 letters that each carry 10 combining marks', ('a' + '\u0301\u0302\u0303\u0300\u0309\u0323\u0304\u0306\u030a\u030b').repeat(24)],
  ];
  for (const [label, name] of names) {
    test('a player named with ' + label + ' can use the code the dialog shows for that save', async ({ page, browser, baseURL }, info) => {
      await open(page, save({ name, furthest: 'dec25', chapter: 'dec25', scene: '' }));
      const saved = (await stateOf(page)).shell.save.name;
      await page.locator('#menu-open').click();
      await page.locator('#menu-code').click();
      const mine = await page.locator('#code-mine').inputValue();
      const other = await browser.newContext({ baseURL, viewport: { width: 800, height: 700 } });
      try {
        const p2 = await other.newPage();
        await p2.goto('/');
        await waitReady(p2);
        await p2.locator('#menu-open').click();
        await p2.locator('#menu-code').click();
        await p2.locator('#code-input').fill(mine);
        await p2.locator('#code-use').click();
        await expect(p2.locator('#code-error'), 'the code shown for ' + label + ' (' + mine.length + ' characters) is refused: ' + (await p2.locator('#code-error').textContent())).toHaveText('');
        await expect(p2.locator('#code-dialog')).toBeHidden();
        expect((await stateOf(p2)).shell.save).toMatchObject({ name: saved, chapter: 'dec25', furthest: 'dec25' });
      } finally {
        await other.close();
      }
      void info;
    });
  }
});

test.describe('continue code: cards and copy', () => {
  const ENDS: [string, string][] = [['nicholas', 'carol'], ['silent-night', 'yule-lads'], ['brooms', 'ending']];
  for (const [id, next] of ENDS) {
    test('the card that closes the act at ' + id + ' shows a code for ' + next + ' that a player can use', async ({ page }) => {
      await open(page, save({ furthest: id, chapter: id, scene: '' }), '?preview=card:' + id);
      await expect(page.locator('#card-code')).toBeVisible();
      const shown = await page.locator('#card-code-text').inputValue();
      const parts = shown.split('.');
      expect(parts[0]).toBe('TEO1');
      expect(IDS[Number(parts[1])]).toBe(next);
      expect(Number(parts[2])).toBeGreaterThanOrEqual(IDS.indexOf(next));
      await page.locator('#card-next').click();
      await openCode(page);
      await submit(page, shown);
      await expectLoaded(page, { name: 'Lan', chapter: next, furthest: IDS[Number(parts[2])]! });
    });
  }

  test('the act-end code keeps a farthest chapter that is already beyond the next chapter', async ({ page }) => {
    await open(page, save({ furthest: 'dickens', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
    const parts = (await page.locator('#card-code-text').inputValue()).split('.');
    expect(IDS[Number(parts[1])]).toBe('carol');
    expect(IDS[Number(parts[2])]).toBe('dickens');
  });

  test('a card that does not end an act carries no code and the frame chapters have no card', async ({ page }) => {
    for (const id of ['saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'carol', 'tree']) {
      await page.goto('about:blank');
      await open(page, save({ furthest: id, chapter: id, scene: '' }), '?preview=card:' + id);
      await expect(page.locator('#card-code'), id).toBeHidden();
    }
  });

  test('"Sao chép" hands the exact code to the clipboard, and a refused clipboard selects the code for a manual copy without errors', async ({ page }) => {
    const w = watch(page);
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t: string) => ((window as unknown as { copied: string[] }).copied.push(t), Promise.resolve()) } });
    });
    await open(page, save({ furthest: 'carol', chapter: 'carol', scene: '' }));
    await openCode(page);
    const mine = await page.locator('#code-mine').inputValue();
    await page.locator('#code-copy').click();
    expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([mine]);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } });
    });
    await page.locator('#code-copy').click();
    await expect
      .poll(() => page.locator('#code-mine').evaluate((el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd]))
      .toEqual([0, mine.length]);
    expectClean(w);
  });

  test('"Sao chép" on the act-end card also copies the shown code and survives a missing clipboard', async ({ page }) => {
    const w = watch(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await open(page, save({ furthest: 'nicholas', chapter: 'nicholas', scene: '' }), '?preview=card:nicholas');
    const shown = await page.locator('#card-code-text').inputValue();
    await page.locator('#card-code-copy').click();
    await expect
      .poll(() => page.locator('#card-code-text').evaluate((el) => [(el as HTMLInputElement).selectionStart, (el as HTMLInputElement).selectionEnd]))
      .toEqual([0, shown.length]);
    expectClean(w);
  });
});

test.describe('continue code: used from other screens', () => {
  test('a code used on the timeline screen leaves it for the chapter in the code', async ({ page }) => {
    await open(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'dong-thoi-gian' });
    await advanceUntil(page, 'timeline');
    await openCode(page);
    await submit(page, forge(0, 19, 'Lan'));
    await expectLoaded(page, { name: 'Lan', chapter: 'intro', furthest: 'ending' });
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    await expect(page.locator('#timeline-screen')).toBeHidden();
    await expect(page.locator('#namecard-screen')).toBeHidden();
    expect(SAVE_KEY).toBeTruthy();
  });
});
