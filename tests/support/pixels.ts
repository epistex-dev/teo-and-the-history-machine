import { PNG } from 'pngjs';

export type Rgb = readonly [number, number, number];

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionStats {
  total: number;
  black: number;
  background: number;
  text: number;
}

const near = (r: number, g: number, b: number, c: Rgb, tolerance: number) =>
  Math.abs(r - c[0]) + Math.abs(g - c[1]) + Math.abs(b - c[2]) <= tolerance;

export function analyseRegion(png: Buffer, region: Region, background: Rgb, text: Rgb): RegionStats {
  const image = PNG.sync.read(png);
  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(image.width, Math.ceil(region.x + region.width));
  const y1 = Math.min(image.height, Math.ceil(region.y + region.height));
  const stats: RegionStats = { total: 0, black: 0, background: 0, text: 0 };
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i] ?? 0;
      const g = image.data[i + 1] ?? 0;
      const b = image.data[i + 2] ?? 0;
      stats.total += 1;
      if (r < 20 && g < 20 && b < 20) stats.black += 1;
      else if (near(r, g, b, background, 40)) stats.background += 1;
      else if (near(r, g, b, text, 120)) stats.text += 1;
    }
  }
  return stats;
}
