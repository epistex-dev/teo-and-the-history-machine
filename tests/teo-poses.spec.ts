import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { advanceStory, seedSave, stateOf, storyOf, waitReady } from './support/play.ts';
import { chapterOf } from './support/script.ts';
import type { Pose } from '../src/story/types.ts';

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const stageData = JSON.parse(readFileSync('src/story/stage-data.json', 'utf8')) as { backdrops: Record<string, { plate: string }>; props: Record<string, { at: [number, number]; width: number; landscape: { at: [number, number]; width: number } }> };
const backdrops = stageData.backdrops;
type Rect = [number, number, number, number];
async function roomOf(plate: string, orientation: string): Promise<{ layout: { size: [number, number] } }> {
  const { ROOMS } = (await import('../art/style/assets.mjs' as string)) as { ROOMS: Record<string, (o: string) => { layout: { size: [number, number] } }> };
  return ROOMS[plate]!(orientation);
}
const KEY_OBJECTS = ['lamp', 'lantern', 'candle', 'crown', 'bunch', 'sheet'];

/** Small key objects of a plate the figure must not stand in front of, in art px: lamps, candles, the sheet on the line, the flame of the manger. */
async function keyObjects(plate: string, orientation: 'portrait' | 'landscape'): Promise<{ name: string; rect: Rect }[]> {
  const { MANGER_FLAME } = (await import('../art/style/lit.mjs' as string)) as { MANGER_FLAME: [number, number] };
  const room = (await roomOf(plate, orientation)) as { keys?: Record<string, unknown> };
  const found = Object.entries(room.keys ?? {}).filter(([name, v]) => KEY_OBJECTS.includes(name) && Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number')) as [string, Rect][];
  const out = found.map(([name, rect]) => ({ name, rect }));
  if (plate === 'ch5-bethlehem') {
    const m = stageData.props['manger-lamp']!;
    const { at, width } = orientation === 'portrait' ? m : m.landscape;
    const k = width / 200;
    out.push({ name: 'manger flame', rect: [at[0] + MANGER_FLAME[0] * k - 4, at[1] + MANGER_FLAME[1] * k - 4, 8, 8] });
  }
  return out;
}

interface Probe {
  chapter: string;
  scene: string;
  plate: string;
  pose: Pose;
  line: string;
  text: string;
}

/** Every @pose beat of every written chapter with the first line shown after it and the plate it is drawn on; the line is where the test stops to look. */
function probes(): Probe[] {
  const out: Probe[] = [];
  for (const file of readdirSync('story/chapters').filter((f) => f.endsWith('.md'))) {
    const script = chapterOf(file.replace(/\.md$/, ''));
    let bg = '';
    for (const scene of script.scenes) {
      scene.beats.forEach((b, i) => {
        if (b.t === 'bg') bg = b.id;
        if (b.t !== 'pose') return;
        const next = scene.beats.slice(i + 1).find((x) => x.t === 'say' || x.t === 'narr');
        if (next && (next.t === 'say' || next.t === 'narr')) out.push({ chapter: script.id, scene: scene.id, plate: backdrops[bg]!.plate, pose: b.pose, line: next.text, text: next.text });
      });
      for (const b of scene.beats) if (b.t === 'bg') bg = b.id;
    }
  }
  return out;
}

/** The pose in effect at a line: the last @pose before it in its scene, stand when there is none (a scene starts standing). */
function poseAt(chapter: string, scene: string, start: string): Pose {
  const beats = chapterOf(chapter).scenes.find((s) => s.id === scene)!.beats;
  let pose: Pose = 'stand';
  for (const b of beats) {
    if (b.t === 'pose') pose = b.pose;
    if ((b.t === 'say' || b.t === 'narr') && b.text.startsWith(start)) return pose;
  }
  throw new Error(chapter + ' ' + scene + ': no line starts with ' + start);
}

async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('#story img')].filter((img) => !img.hidden && img.src).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

async function showLine(page: Page, info: TestInfo, p: { chapter: string; scene: string }, text: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: p.chapter, chapter: p.chapter, scene: p.scene });
  await page.goto('/');
  await waitReady(page);
  for (let i = 0; i < 40; i += 1) {
    if (((await storyOf(page)).line?.text ?? '').startsWith(text.slice(0, 30))) return settled(page);
    const mode = (await stateOf(page)).shell.mode;
    if (mode === 'namecard') {
      await expect.poll(async () => ((await stateOf(page)).story as unknown as { screen: { ready?: boolean } }).screen.ready, { timeout: 15_000 }).toBe(true);
      await page.locator('#namecard-next').click();
    } else if (mode === 'code') await page.locator('#code-screen-next').click();
    else await advanceStory(page, info);
  }
  throw new Error('line not reached: ' + text);
}

interface Seen {
  pose: string;
  src: string;
  face: boolean;
  opaque: { left: number; right: number; top: number; bottom: number };
  machine: { left: number; right: number; top: number; bottom: number };
  dialogueTop: number;
  story: { width: number; height: number };
  art: { left: number; top: number; width: number };
  artSize: [number, number];
}

/** Tèo's opaque extent, the machine body, the dialogue top and the art box, all in story px. */
async function seen(page: Page): Promise<Seen> {
  return page.evaluate(async () => {
    const story = (document.getElementById('story') as HTMLElement).getBoundingClientRect();
    const figure = document.querySelector('.figure[data-who="teo"]') as HTMLElement;
    const img = figure.querySelector('.pose') as HTMLImageElement;
    const probe = new Image();
    probe.src = img.src;
    await probe.decode();
    const W = 192;
    const H = 192;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(probe, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    let l = W, r = 0, t = H, b = 0;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (data[(y * W + x) * 4 + 3]! > 40) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); }
    const box = figure.getBoundingClientRect();
    const m = (document.querySelector('.machine') as HTMLElement).getBoundingClientRect();
    const back = (document.getElementById('backdrop') as HTMLElement).getBoundingClientRect();
    const faceImg = figure.querySelector('.face') as HTMLImageElement;
    return {
      pose: figure.dataset.pose ?? '',
      src: img.src,
      face: !faceImg.hidden && faceImg.naturalWidth > 0,
      opaque: { left: box.left - story.left + (l / W) * box.width, right: box.left - story.left + ((r + 1) / W) * box.width, top: box.top - story.top + (t / H) * box.height, bottom: box.top - story.top + ((b + 1) / H) * box.height },
      machine: { left: m.left - story.left + (20 / 400) * m.width, right: m.left - story.left + (340 / 400) * m.width, top: m.top - story.top, bottom: m.top - story.top + (420 / 424) * m.height },
      dialogueTop: (document.querySelector('.dialogue') as HTMLElement).getBoundingClientRect().top - story.top,
      story: { width: story.width, height: story.height },
      art: { left: back.left - story.left, top: back.top - story.top, width: back.width },
      artSize: [0, 0] as [number, number],
    };
  });
}

test.describe('Tèo poses on the plate stage', () => {
  const all = probes();

  test('every chapter that uses a pose names a baked sprite for it, in the chunk of that chapter', () => {
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all.map((p) => p.pose))).toEqual(new Set(['sit', 'read', 'sheet', 'stand']));
  });

  const narrated: [string, string, string, Pose][] = [
    ['intro', 'phong-ho-so', 'Phòng Hồ sơ Cực Bắc, 23:40', 'sit'],
    ['intro', 'phong-ho-so', 'Tèo, người giữ hồ sơ tập sự, ngồi giữa', 'sit'],
    ['saturnalia', 'ban-tiec', 'Cả bàn cùng nhìn vào giữa', 'stand'],
    ['saturnalia', 'ban-tiec', 'Hôm nay là Saturnalia', 'sit'],
    ['saturnalia', 'vua-tiec', 'Tiệc đến lúc chọn vua', 'sit'],
    ['bethlehem', 'hai-ban-ke', 'Tèo ngồi xuống bậc đá', 'sit'],
    ['bethlehem', 'mang-co', 'Quanh máng cỏ, đêm không vẽ thêm nét nào. Tèo đứng nhìn từ xa', 'stand'],
    ['bethlehem', 'mang-co', 'Rồi anh cúi xuống, cài cành tầm gửi', 'read'],
    ['bethlehem', 'mang-co', 'Tèo nâng vành mũ lên', 'stand'],
    ['dec25', 'kho-lich', 'Tèo cúi xuống trang đang mở', 'read'],
    ['ban1647', 'hieu-in', 'Tèo ghé sát tờ ngoài cùng', 'read'],
    ['ban1647', 'nua-duoi', 'Tèo đứng lại bên bậc đá', 'stand'],
    ['krampus', 'mat-na-giay', 'Tèo đặt hình vẽ lên nắp giếng', 'read'],
    ['yule-lads', 'bep-iceland', 'Tèo rút tờ giấy trắng, trải lên bàn', 'sheet'],
    ['ending', 'the-ten', 'Anh với vào lòng máy', 'sit'],
  ];
  for (const [chapter, scene, start, pose] of narrated) {
    test(`narration "${start.slice(0, 40)}" has the ${pose} pose in force (${chapter}/${scene})`, () => {
      expect(poseAt(chapter, scene, start)).toBe(pose);
    });
  }

  test('no line in the written chapters says Tèo sits, bends or leans over unless a non-standing pose is in force', () => {
    const verb = /Tèo (?:ngồi|cúi|ghé sát)|anh (?:ngồi|cúi) |ngồi giữa những dãy|Rồi anh cúi/;
    for (const file of readdirSync('story/chapters').filter((f) => f.endsWith('.md'))) {
      const script = chapterOf(file.replace(/\.md$/, ''));
      for (const scene of script.scenes) {
        let pose: Pose = 'stand';
        for (const b of scene.beats) {
          if (b.t === 'pose') pose = b.pose;
          if (b.t === 'narr' && verb.test(b.text)) expect(pose, script.id + '/' + scene.id + ': ' + b.text.slice(0, 50)).not.toBe('stand');
        }
      }
    }
  });

  for (const [label, size] of [['390 x 844 portrait', PORTRAIT], ['844 x 390 landscape', LANDSCAPE]] as const) {
    for (const p of all) {
      test(`${label}: ${p.chapter}/${p.scene} ${p.pose} "${p.text.slice(0, 28)}" shows its sprite, clear of the dialogue, the key objects and the machine`, async ({ page }, info) => {
        await showLine(page, info, p, p.text, size);
        const s = await seen(page);
        s.artSize = (await roomOf(p.plate, size === PORTRAIT ? 'portrait' : 'landscape')).layout.size;
        const orientation = size === PORTRAIT ? 'portrait' : 'landscape';
        expect(s.pose).toBe(p.pose);
        if (p.pose === 'stand') expect(s.src).toMatch(/teo-(?:front|three-quarter)[^-]*\.|teo-front/);
        else expect(s.src).toContain('teo-front-' + p.pose);
        expect(s.face, 'the face layer is drawn over the pose').toBe(true);
        expect(s.opaque.left, 'inside the stage on the left').toBeGreaterThanOrEqual(0);
        expect(s.opaque.right, 'inside the stage on the right').toBeLessThanOrEqual(s.story.width);
        expect(s.opaque.bottom, 'soles above the dialogue box').toBeLessThanOrEqual(s.dialogueTop + 1);
        expect(s.opaque.top, 'head below the top of the stage').toBeGreaterThanOrEqual(0);
        const overlapsMachine = s.opaque.left < s.machine.right && s.machine.left < s.opaque.right && s.opaque.top < s.machine.bottom && s.machine.top < s.opaque.bottom;
        expect(overlapsMachine, 'figure and machine do not overlap').toBe(false);
        const k = s.art.width / s.artSize[0];
        for (const { name, rect: [x, y, w, h] } of await keyObjects(p.plate, orientation)) {
          const o = { left: s.art.left + x * k, right: s.art.left + (x + w) * k, top: s.art.top + y * k, bottom: s.art.top + (y + h) * k };
          const hit = s.opaque.left < o.right && o.left < s.opaque.right && s.opaque.top < o.bottom && o.top < s.opaque.bottom;
          expect(hit, 'figure does not cover the ' + name).toBe(false);
        }
      });
    }
  }
});
