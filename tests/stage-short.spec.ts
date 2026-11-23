import { expect, test, type Page } from '@playwright/test';
import { advanceStory, seedSave, storyOf, waitReady } from './support/play.ts';

type Rect = [number, number, number, number];
type Layouts = Record<string, { portrait: { size: [number, number]; keep: Rect } }>;

const ROOMS = [
  ['intro', 'phong-ho-so', 'ch1-office'],
  ['saturnalia', 'ban-tiec', 'ch2-feast'],
  ['yule', 'sanh-dai', 'ch3-hall'],
  ['mistletoe', 'hanh-lang', 'ch4-corridor'],
  ['bethlehem', 'ngoai-thanh', 'ch5-bethlehem'],
  ['dec25', 'kho-lich', 'ch6-vault'],
  ['nicholas', 'ben-cang', 'ch7-harbour'],
  ['carol', 'san-lang', 'ch8-yard'],
  ['krampus', 'dau-doc', 'ch9-village'],
  ['befana', 'nha-o-y', 'ch10-kitchen'],
  ['tree', 'can-phong', 'ch11-parlour'],
  ['ban1647', 'hieu-in', 'ch12-street'],
  ['silent-night', 'truoc-nha-tho', 'ch13-church'],
  ['ending', 'thao-may', 'ch1-office'],
] as const;
const SHORT = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
] as const;
const OTHERS = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 915, height: 412 },
] as const;
const CAP_MARGIN = 16;
const BEATS = 6;

async function layouts(): Promise<Layouts> {
  return (await import('../art/style/layouts.mjs' as string)).LAYOUTS;
}

async function settled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('#story img')].filter((img) => !img.hidden && img.src).map((img) => img.decode().catch(() => undefined)));
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
}

/** Per beat of the scene: Tèo's cap clearance from the top of the stage, his feet against the dialogue box, and how far the key furniture's top sticks out of the stage. */
async function play(page: Page, info: Parameters<typeof advanceStory>[1], chapter: string, scene: string, size: { width: number; height: number }, keep: Rect | null, plate: [number, number]) {
  await page.setViewportSize(size);
  await seedSave(page, { schemaVersion: 1, name: 'Lan', furthest: chapter, chapter, scene });
  await page.goto('/');
  await waitReady(page);
  const seen: { beat: number; cap: number; feet: number; keepCut: number; keepSide: number }[] = [];
  for (let i = 0; i < BEATS; i += 1) {
    const s = await storyOf(page);
    if (s.scene !== scene || s.mode !== 'story' || s.asking) break;
    await settled(page);
    const story = (await page.locator('#story').boundingBox())!;
    const dialogue = (await page.locator('.dialogue').boundingBox())!;
    const teo = (await page.locator('.figure[data-who="teo"]').boundingBox())!;
    const bd = (await page.locator('.backdrop').boundingBox())!;
    const k = bd.width / plate[0];
    const at = keep ? { top: bd.y + keep[1] * k, left: bd.x + keep[0] * k, right: bd.x + (keep[0] + keep[2]) * k } : null;
    seen.push({
      beat: s.beat ?? i,
      cap: teo.y - story.y,
      feet: dialogue.y - (teo.y + teo.height),
      keepCut: at ? story.y - at.top : -1,
      keepSide: at ? Math.max(story.x - at.left, at.right - (story.x + story.width)) : -1,
    });
    await advanceStory(page, info);
  }
  expect(seen.length, 'beats seen').toBeGreaterThanOrEqual(3);
  return seen;
}

test.describe('short stages keep Tèo and the room whole', () => {
  test.setTimeout(180_000);
  for (const [chapter, scene, room] of ROOMS) {
    for (const size of SHORT) {
      test(`${chapter} at ${size.width}x${size.height}: Tèo's cap clears the top by ${CAP_MARGIN} px and the key furniture of the room is on the stage`, async ({ page }, info) => {
        const { portrait } = (await layouts())[room]!;
        const seen = await play(page, info, chapter, scene, size, portrait.keep, portrait.size);
        for (const b of seen) {
          expect(b.cap, `beat ${b.beat}: cap clearance`).toBeGreaterThanOrEqual(CAP_MARGIN);
          expect(b.feet, `beat ${b.beat}: Tèo above the dialogue box`).toBeGreaterThanOrEqual(-4);
          expect(b.keepCut, `beat ${b.beat}: key furniture top is cut by this many px`).toBeLessThanOrEqual(1);
          expect(b.keepSide, `beat ${b.beat}: key furniture cut at the side`).toBeLessThanOrEqual(1);
        }
      });
    }
    for (const size of OTHERS) {
      test(`${chapter} at ${size.width}x${size.height}: Tèo stays inside the stage and above the dialogue box`, async ({ page }, info) => {
        const { portrait } = (await layouts())[room]!;
        const seen = await play(page, info, chapter, scene, size, size.width < size.height ? portrait.keep : null, portrait.size);
        for (const b of seen) {
          expect(b.cap, `beat ${b.beat}: cap clearance`).toBeGreaterThanOrEqual(4);
          expect(b.feet, `beat ${b.beat}: Tèo above the dialogue box`).toBeGreaterThanOrEqual(-4);
          expect(b.keepCut, `beat ${b.beat}: key furniture top is cut by this many px`).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});
