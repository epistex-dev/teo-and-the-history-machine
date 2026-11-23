import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, seedSave, stateOf, storyOf, waitReady } from './support/play.ts';

const save = (scene: string) => ({ schemaVersion: 1, name: 'Lan', furthest: 'intro', chapter: 'intro', scene });
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };

interface Stage {
  machine: string[];
  props: string[];
  machineBox: { left: number; top: number; right: number; bottom: number } | null;
  dialogueTop: number;
  ground: number | null;
}

const stageOf = async (page: Page): Promise<Stage> => ((await storyOf(page)) as unknown as { stage: Stage }).stage;

/** Fonts in, the visible sprites decoded and two frames drawn: the point after which the art no longer moves by itself. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('#story img')].filter((img) => !img.hidden && img.src).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function openAt(page: Page, scene: string, size = PORTRAIT): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, save(scene));
  await page.goto('/');
  await waitReady(page);
  await settled(page);
}

/** Seeds only when storage is empty, so a second scene needs a context of its own. */
async function fresh(page: Page, scene: string): Promise<Page> {
  const next = await page.context().browser()!.newContext({ ...(test.info().project.use as object), viewport: PORTRAIT });
  const p = await next.newPage();
  await openAt(p, scene);
  return p;
}

async function advanceUntil(page: Page, info: TestInfo, done: (text: string) => boolean): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (done((await storyOf(page)).line?.text ?? '')) return;
    await advanceStory(page, info);
  }
  throw new Error('line not reached');
}

/** Opaque extent of Tèo's picture in page px: the drawn art is scaled from its 196 x 200 frame into the figure box. */
async function teoBody(page: Page): Promise<{ left: number; right: number; bottom: number }> {
  return page.evaluate(async () => {
    const figure = document.querySelector('.figure[data-who="teo"]') as HTMLElement;
    const img = figure.querySelector('.pose') as HTMLImageElement;
    const probe = new Image();
    probe.src = img.src;
    await probe.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 196;
    canvas.height = 200;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(probe, 0, 0, 196, 200);
    const data = ctx.getImageData(0, 0, 196, 200).data;
    let l = 196;
    let r = 0;
    let b = 0;
    for (let y = 0; y < 200; y += 1) {
      for (let x = 0; x < 196; x += 1) {
        if (data[(y * 196 + x) * 4 + 3]! > 40) {
          l = Math.min(l, x);
          r = Math.max(r, x);
          b = Math.max(b, y);
        }
      }
    }
    const box = figure.getBoundingClientRect();
    const story = (document.getElementById('story') as HTMLElement).getBoundingClientRect();
    return { left: box.left - story.left + (l / 196) * box.width, right: box.left - story.left + ((r + 1) / 196) * box.width, bottom: box.top - story.top + ((b + 1) / 200) * box.height };
  });
}

const machineBody = async (page: Page) =>
  page.evaluate(() => {
    const m = (document.querySelector('.machine') as HTMLElement).getBoundingClientRect();
    const story = (document.getElementById('story') as HTMLElement).getBoundingClientRect();
    return { left: m.left - story.left + (20 / 400) * m.width, right: m.left - story.left + (340 / 400) * m.width, top: m.top - story.top, bottom: m.top - story.top + (420 / 424) * m.height };
  });

test.describe('chapter 1 stage (baked plate art, layout from art/style/scene.mjs)', () => {
  for (const [label, size] of [['390 x 844 portrait', PORTRAIT], ['landscape', LANDSCAPE]] as const) {
    test(`${label}: Tèo's feet are above the dialogue box and he does not overlap the machine`, async ({ page }, info) => {
      await openAt(page, 'cuc-cu', size);
      await advanceUntil(page, info, (text) => text.startsWith('Tôi là Cúc Cu'));
      const s = await storyOf(page);
      expect(s.cast?.map((c) => c.name).sort()).toEqual(['Cúc Cu', 'Tèo']);
      const stage = await stageOf(page);
      const dialogue = await page.locator('.dialogue').boundingBox();
      const story = (await page.locator('#story').boundingBox())!;
      expect(dialogue).toBeTruthy();
      expect(stage.dialogueTop).toBeCloseTo(dialogue!.y - story.y, 0);
      const teo = await teoBody(page);
      expect(teo.bottom, 'Tèo feet above the dialogue box').toBeLessThanOrEqual(stage.dialogueTop - 2);
      const machine = await machineBody(page);
      expect(teo.right, 'Tèo stays left of the machine body').toBeLessThanOrEqual(machine.left);
      expect(machine.bottom, 'machine stands on the same ground').toBeLessThanOrEqual(stage.ground! + 1);
      expect(Math.abs(machine.bottom - stage.ground!), 'machine and Tèo share one ground line').toBeLessThan(0.02 * story.height);
      expect(Math.abs(teo.bottom - stage.ground!), 'Tèo feet on the ground line').toBeLessThan(0.02 * story.height);
      expect(machine.top, 'machine top inside the stage').toBeGreaterThanOrEqual(-1);
      expect(machine.right).toBeLessThanOrEqual(story.width + 1);
    });
  }

  test('portrait: Tèo stands within 0.85 x stage width, landscape within 0.72 x stage height, and neither is tiny', async ({ page }, info) => {
    await openAt(page, 'cuc-cu');
    await advanceUntil(page, info, (text) => text.startsWith('Tôi là Cúc Cu'));
    const unit = () => page.evaluate(() => ((document.querySelector('.figure[data-who="teo"]') as HTMLElement).getBoundingClientRect().height));
    const w = (await page.locator('#story').boundingBox())!.width;
    expect(await unit()).toBeLessThanOrEqual(0.85 * w + 0.5);
    expect(await unit()).toBeGreaterThan(0.6 * w);
    await page.setViewportSize(LANDSCAPE);
    await expect.poll(async () => (await page.locator('#story').boundingBox())!.width).toBeGreaterThan(600);
    const h = (await page.locator('#story').boundingBox())!.height;
    await expect.poll(unit).toBeLessThanOrEqual(0.72 * h + 0.5);
    expect(await unit()).toBeGreaterThan(0.5 * h);
  });

  test('the backdrop of the records office is the art of ch1-office and the bg id is mapped', async ({ page }) => {
    await openAt(page, 'phong-ho-so');
    const s = await storyOf(page);
    expect(s.bg?.id).toBe('phong-ho-so-cuc-bac');
    await expect(page.locator('#backdrop')).toBeVisible();
    expect(await page.locator('#backdrop-portrait').getAttribute('src')).toContain('ch1-office-portrait');
    expect(await page.locator('#backdrop-landscape').getAttribute('srcset')).toContain('ch1-office-landscape');
    expect((await page.locator('#story').getAttribute('data-stage'))).toBe('art');
  });

  test('the machine follows the story: clean, stained by the coffee, the stain stays, door open, needle stuck', async ({ page }, info) => {
    await openAt(page, 'phong-ho-so');
    expect(await stageOf(page)).toMatchObject({ machine: [], props: [] });
    await advanceUntil(page, info, (text) => text.startsWith('Vệt nâu loang'));
    expect(await stageOf(page)).toMatchObject({ machine: ['stained'], props: ['coffee-cup', 'letter-blurred'] });
    await expect(page.locator('.machine [data-prop="coffee-cup"]')).toBeVisible();
    await expect(page.locator('.machine [data-prop="letter-blurred"]')).toBeVisible();
    await page.reload();
    await waitReady(page);
    expect(await stageOf(page)).toMatchObject({ machine: [] });

    const hoiTen = await fresh(page, 'hoi-ten');
    expect(await stageOf(hoiTen)).toMatchObject({ machine: ['stained'], props: ['coffee-cup', 'letter-blurred'] });

    const cucCu = await fresh(page, 'cuc-cu');
    expect(await stageOf(cucCu)).toMatchObject({ machine: ['stained', 'open'], props: ['coffee-cup'] });
    const leaves = await cucCu.locator('.machine img[data-part="machine-door-l"]').evaluate((el) => (el as HTMLElement).style.transform);
    expect(leaves).toBe('scaleX(0.22)');

    const kimKet = await fresh(page, 'kim-ket');
    expect(await stageOf(kimKet)).toMatchObject({ machine: ['stained', 'open', 'stuck'], props: ['coffee-cup'] });
    await expect(kimKet.locator('.machine img[data-part="machine-fx-stuck"]')).toBeVisible();
    await expect(kimKet.locator('.machine [data-prop="coffee-cup"]')).toBeVisible();
    await advanceUntil(kimKet, info, (text) => text.startsWith('Tèo cài bút'));
    expect((await stageOf(kimKet)).props, 'the cup stays to the end of the scene').toEqual(['coffee-cup']);
    for (const p of [hoiTen, cucCu, kimKet]) await p.context().close();
  });

  test('Cúc Cu comes out of the machine door: his feet stand on the door perch from the scene layout', async ({ page }, info) => {
    await openAt(page, 'cuc-cu');
    await advanceUntil(page, info, (text) => text.startsWith('Tôi là Cúc Cu'));
    const s = await storyOf(page);
    const cuc = s.cast?.find((c) => c.name === 'Cúc Cu') as unknown as { box: { left: number; width: number; height: number; top: number } };
    const machine = await machineBody(page);
    expect(cuc.box.left + cuc.box.width / 2).toBeGreaterThan(machine.left);
    expect(cuc.box.left + cuc.box.width / 2).toBeLessThan(machine.right);
    expect(cuc.box.top + cuc.box.height, 'perch is above the machine ground').toBeLessThan(machine.bottom);
  });

  test('turned faces are used where the art has them: three-quarter for Tèo in the Cúc Cu scene, never losing an expression', async ({ page }, info) => {
    await openAt(page, 'cuc-cu');
    await advanceUntil(page, info, (text) => text.startsWith('Tôi là Cúc Cu'));
    const teo = (await storyOf(page)).cast?.find((c) => c.name === 'Tèo') as unknown as { view: string; expr: string };
    expect(teo).toMatchObject({ view: 'front', expr: 'normal' });
    await advanceUntil(page, info, (text) => text.startsWith('Vậy tôi dán lại'));
    expect((await storyOf(page)).cast?.find((c) => c.name === 'Tèo')).toMatchObject({ view: 'three-quarter', expr: 'normal' });
    expect(await page.locator('.figure[data-who="teo"] .pose').getAttribute('src')).toContain('teo-three-quarter');
    expect(await page.locator('.figure[data-who="teo"] .face').getAttribute('src')).toContain('teo-three-quarter-face-normal');
    await advanceUntil(page, info, (text) => text.startsWith('Bốn mặt số, bốn tấm thẻ'));
    expect(await page.locator('.figure[data-who="teo"] .pose').getAttribute('src')).toContain('teo-three-quarter');
    expect((await stateOf(page)).story?.scene).toBe('cuc-cu');
  });

  for (const [label, size] of [['390 x 844 portrait', PORTRAIT], ['landscape', LANDSCAPE]] as const) {
    test(`${label}: every line has a character on stage, the art covers the stage and the dialogue box never clips the Lật trang button`, async ({ page }, info) => {
      await openAt(page, 'phong-ho-so', size);
      for (let i = 0; i < 14; i += 1) {
        const s = await storyOf(page);
        if (s.scene !== 'phong-ho-so') break;
        expect(s.cast?.length, `line ${i} shows at least one character`).toBeGreaterThan(0);
        const geo = await page.evaluate(() => {
          const rect = (q: string) => (document.querySelector(q) as HTMLElement).getBoundingClientRect();
          const story = rect('#story');
          const d = rect('.dialogue');
          const b = rect('#advance');
          const art = rect('#backdrop');
          return { story: { l: story.left, r: story.right, t: story.top, b: story.bottom }, d: { l: d.left, r: d.right, t: d.top, b: d.bottom }, b: { l: b.left, r: b.right, t: b.top, b: b.bottom, h: b.height }, art: { l: art.left, r: art.right, t: art.top, b: art.bottom } };
        });
        expect(geo.b.l, 'Lật trang inside the dialogue box (left)').toBeGreaterThanOrEqual(geo.d.l - 0.5);
        expect(geo.b.r, 'Lật trang inside the dialogue box (right)').toBeLessThanOrEqual(geo.d.r + 0.5);
        expect(geo.b.t, 'Lật trang inside the dialogue box (top)').toBeGreaterThanOrEqual(geo.d.t - 0.5);
        expect(geo.b.b, 'Lật trang inside the dialogue box (bottom)').toBeLessThanOrEqual(geo.d.b + 0.5);
        expect(geo.d.b, 'dialogue box inside the story box').toBeLessThanOrEqual(geo.story.b + 0.5);
        expect(geo.art.l, 'the art reaches the left edge').toBeLessThanOrEqual(geo.story.l + 1);
        expect(geo.art.r, 'the art reaches the right edge').toBeGreaterThanOrEqual(geo.story.r - 1);
        expect(geo.art.t, 'the art reaches the top edge').toBeLessThanOrEqual(geo.story.t + 1);
        expect(geo.art.b, 'the art runs behind the dialogue box').toBeGreaterThanOrEqual(geo.d.t);
        if ((await storyOf(page)).asking) break;
        await advanceStory(page, info);
      }
    });
  }

  test('[khô] never shows on screen, in the line, the live region or the log', async ({ page }, info) => {
    await openAt(page, 'kim-ket');
    const seen: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      seen.push((await page.locator('#line').textContent()) ?? '', (await page.locator('#live').textContent()) ?? '');
      if ((await storyOf(page)).scene !== 'kim-ket') break;
      await advanceStory(page, info);
    }
    await page.locator('#log-open').click();
    seen.push((await page.locator('#log-list').textContent()) ?? '');
    expect(seen.join('\n').toLowerCase()).not.toContain('[khô]');
    expect(seen.join('\n')).toContain('Chưa có. Câu ấy nghe xuôi tai');
  });

  const FIGURE = { 'Tèo': 'teo', 'Cúc Cu': 'cuc-cu', 'Quạ Đồn': 'qua-don' } as const;

  /** The figure shows the expression layer the script asked for (not the normal fallback) and both images decoded. */
  async function expectDrawn(page: Page, who: keyof typeof FIGURE, expr: string): Promise<void> {
    const cast = (await storyOf(page)).cast?.find((c) => c.name === who) as unknown as { expr: string; view: string } | undefined;
    expect(cast, `${who} is on stage`).toBeTruthy();
    expect(cast!.expr).toBe(expr);
    const figure = page.locator(`.figure[data-who="${FIGURE[who]}"]`);
    const face = figure.locator('.face');
    const sprite = who === 'Tèo' ? `teo-${cast!.view}-face-${expr}` : `${who === 'Quạ Đồn' ? 'quado' : 'cuccu'}-head-${expr}`;
    await expect(face).toHaveAttribute('src', new RegExp(sprite + '[-.]'));
    for (const img of [face, figure.locator('.pose')]) {
      await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth), { message: `${sprite} decoded` }).toBeGreaterThan(0);
    }
  }

  test('every expression the chapter 1 script uses is drawn: Tèo scared, awkward and normal, Cúc Cu normal and talking', async ({ page }, info) => {
    await openAt(page, 'phong-ho-so');
    await advanceUntil(page, info, (text) => text.startsWith('Tên người gửi'));
    await expectDrawn(page, 'Tèo', 'scared');
    const kimKet = await fresh(page, 'kim-ket');
    await advanceUntil(kimKet, info, (text) => text.startsWith('Chưa có.'));
    await expectDrawn(kimKet, 'Tèo', 'awkward');
    await expectDrawn(kimKet, 'Cúc Cu', 'normal');
    await advanceUntil(kimKet, info, (text) => text.startsWith('Đoán chưa phải nguồn'));
    await expectDrawn(kimKet, 'Cúc Cu', 'talking');
    await kimKet.context().close();
  });

  /** Every visible sprite of every figure: it has a picture (a changed pose keeps the old one until the new one is in), and a body never stands there without its face. */
  const drawnNow = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.figure')].map((figure) => {
        const shown = (cls: string) => {
          const img = figure.querySelector<HTMLImageElement>(cls);
          return img && !img.hidden ? { src: img.getAttribute('src') ?? '', decoded: img.naturalWidth > 0 } : null;
        };
        return { who: (figure as HTMLElement).dataset.who ?? '', pose: shown('.pose'), face: shown('.face') };
      }),
    );

  test('slow *-face-*.webp: no beat shows a face layer without a decoded image, and every expression is drawn once it arrives', async ({ page }, info) => {
    await page.route('**/*-face-*.webp', async (route) => {
      await new Promise((done) => setTimeout(done, 600));
      await route.continue();
    });
    await page.route('**/*-head-*.webp', async (route) => {
      await new Promise((done) => setTimeout(done, 600));
      await route.continue();
    });
    await openAt(page, 'kim-ket');
    const broken: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      for (const f of await drawnNow(page)) {
        for (const [layer, img] of [['pose', f.pose], ['face', f.face]] as const) if (img && !img.decoded) broken.push(`beat ${i}: ${f.who} ${layer} ${img.src} is shown before it is decoded`);
        if (f.who === 'teo' && Boolean(f.pose) !== Boolean(f.face)) broken.push(`beat ${i}: Tèo's body and face are not shown together`);
      }
      if ((await storyOf(page)).line?.text.startsWith('Chưa có.')) break;
      await advanceStory(page, info);
    }
    expect(broken).toEqual([]);
    expect((await storyOf(page)).line?.text, 'the loop reached the awkward beat').toMatch(/^Chưa có\./);
    await expectDrawn(page, 'Tèo', 'awkward');
  });

  test('slow fonts: the story is never on screen with the fallback font, so the art does not jump when the real font arrives', async ({ page }) => {
    await page.route('**/*.woff2', async (route) => {
      await new Promise((done) => setTimeout(done, 1500));
      await route.continue();
    });
    await page.addInitScript(() => {
      const seen: { shown: boolean; line: number; machine: number }[] = [];
      (window as unknown as { seen: typeof seen }).seen = seen;
      const sample = () => {
        const story = document.getElementById('story');
        const machine = document.querySelector('.machine');
        const dialogue = document.querySelector('.dialogue');
        if (story && machine && dialogue) seen.push({ shown: !story.hidden && getComputedStyle(story).visibility !== 'hidden', line: dialogue.getBoundingClientRect().height, machine: machine.getBoundingClientRect().bottom });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.setViewportSize(PORTRAIT);
    await seedSave(page, save('cuc-cu'));
    await page.goto('/');
    await waitReady(page);
    await page.waitForTimeout(2500);
    const seen = await page.evaluate(() => (window as unknown as { seen: { shown: boolean; line: number; machine: number }[] }).seen);
    const shown = seen.filter((s) => s.shown);
    expect(shown.length, 'frames with the story on screen').toBeGreaterThan(5);
    const last = seen[seen.length - 1]!;
    expect(shown.filter((s) => Math.abs(s.line - last.line) > 0.5 || Math.abs(s.machine - last.machine) > 0.5), 'frames drawn before the real font arrived').toEqual([]);
  });

  test('chapter 25 in the same office: Quạ Đồn smug then doubtful on the machine roof, after the name card', async ({ page }, info) => {
    await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: 'ending', chapter: 'ending', scene: 'the-ten' });
    await page.goto('/');
    await waitReady(page);
    expect(((await storyOf(page)) as unknown as { stage: unknown }).stage).toBeTruthy();
    await advanceUntil(page, info, (text) => text.startsWith('Ngòi bút theo kịp'));
    await advanceStory(page, info);
    await expect(page.locator('#namecard-next')).toBeVisible();
    await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
    await page.locator('#namecard-next').click();
    await expect.poll(async () => (await stateOf(page)).shell.mode).toBe('story');
    await advanceUntil(page, info, (text) => text.startsWith('Dài quá'));
    await expectDrawn(page, 'Quạ Đồn', 'smug');
    await advanceUntil(page, info, (text) => text === 'Nguồn đâu?');
    await expectDrawn(page, 'Quạ Đồn', 'doubtful');
    const s = await storyOf(page);
    const qua = s.cast?.find((c) => c.name === 'Quạ Đồn') as unknown as { box: { left: number; width: number; top: number; height: number } };
    const machine = await machineBody(page);
    expect(qua.box.left + qua.box.width / 2).toBeGreaterThan(machine.left);
    expect(qua.box.left + qua.box.width / 2).toBeLessThan(machine.right);
    expect(qua.box.top + qua.box.height, 'Quạ stands on the roof, above the machine ground').toBeLessThan(machine.bottom);
  });
});
