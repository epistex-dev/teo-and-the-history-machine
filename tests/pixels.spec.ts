import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { analyseRegion } from './support/pixels.ts';

const HOLLY = [0xc9, 0x34, 0x3b] as const;
const SNOW = [0xff, 0xf6, 0xe3] as const;

function image(fill: (x: number, y: number) => readonly [number, number, number]): Buffer {
  const png = new PNG({ width: 100, height: 60 });
  for (let y = 0; y < 60; y += 1) {
    for (let x = 0; x < 100; x += 1) {
      const [r, g, b] = fill(x, y);
      const i = (y * 100 + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

test.describe('pixel checker self-test', () => {
  test.beforeEach(({ baseURL }, info) => {
    test.skip(!baseURL || info.project.name !== 'desktop-chromium', 'pure function, runs once');
  });
  const region = { x: 0, y: 0, width: 100, height: 60 };

  test('accepts holly with snow glyphs', () => {
    const png = image((x, y) => (x > 40 && x < 50 && y > 20 && y < 40 ? SNOW : HOLLY));
    const s = analyseRegion(png, region, HOLLY, SNOW);
    expect(s.black).toBe(0);
    expect(s.text).toBeGreaterThan(50);
  });

  test('flags a black box behind the text', () => {
    const png = image((x, y) => (x > 40 && x < 50 && y > 20 && y < 40 ? SNOW : x > 10 ? [0, 0, 0] : HOLLY));
    const s = analyseRegion(png, region, HOLLY, SNOW);
    expect(s.black).toBeGreaterThan(1000);
  });
});
