// Pieces shared by the Act 1 plates (chapters 4 to 7): the three stamp colours as washes, rectangle clipping, a one-point view, night stars, oil lamps and masonry.
import { clamp, sstep, f1, cr, rng, vnoise, ink } from './lib.mjs';
import { WASH } from './draw.mjs';
import { CARD, hatch, box, flame } from './room.mjs';

export const GREEN = '#2c5a38', RED = '#8b2a22', BLUE = '#2d4666', BERRY = '#fbfbf6', STONE = '#a89878';

/** Sutherland-Hodgman clip against a rectangle so the big wall and ceiling quads stay cheap to hatch. */
export function clip(poly, [x0, y0, x1, y1]) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + (b[1] - a[1]) * t]; }],
    [(p) => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y0]; }],
    [(p) => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y1]; }],
  ];
  let out = poly.map((p) => [p[0], p[1]]);
  for (const [inside, cut] of edges) { const src = out; out = []; for (let i = 0; i < src.length; i++) { const a = src[i], b = src[(i + 1) % src.length]; if (inside(a)) { out.push(a); if (!inside(b)) out.push(cut(a, b)); } else if (inside(b)) out.push(cut(a, b)); } }
  return out;
}

/** One-point view of a layout: pr(X, Y, z) projects metres (right, up, depth) with the floor meeting the bottom edge at depth 1; ray() runs a line on to the screen edge x. */
export function view(L, m) {
  const [W, H] = L.size, [vx, vy] = L.vp, hs = H - vy;
  const pr = (X, Y, z) => [vx + (X * m) / z, vy + (hs - Y * m) / z];
  const ray = (p, x) => { const s = (x - vx) / (p[0] - vx); return [x, vy + (p[1] - vy) * s]; };
  const E = [-30, -30, W + 30, H + 30];
  return { W, H, vx, vy, hs, m, pr, ray, E, quad: (pts) => clip(pts, E) };
}

/** Paper dots in a hatched night sky: the stars. No ray, no wheel. */
export function stars(P, [x0, y0, x1, y1], n, seed, skip = () => false) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 0.8 + r() * 1.1;
    if (skip(x, y)) continue;
    P.raw('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(s) + '" fill="' + BERRY + '"/>');
  }
}

/** A brass oil lamp with a spout flame, standing with its base centre at (x, y); s scales it. */
export function oilLamp(P, x, y, s, seed, flameH = 15) {
  const bowl = cr([[x - 17 * s, y - 14 * s, 1], [x - 12 * s, y - 4 * s], [x, y, 1], [x + 12 * s, y - 4 * s], [x + 17 * s, y - 14 * s, 1], [x + 8 * s, y - 18 * s], [x - 8 * s, y - 18 * s]], true, 4);
  P.part(bowl, { tone: (px) => clamp(0.3 + 0.5 * sstep(x - 14 * s, x + 14 * s, px)), layers: [hatch(70, 1.4, 1.1, 0.08, 1.8)], seed, fill: '#e9d9a4', halo: 0.8, outline: 1.1, wash: [WASH.brass, 0.85] });
  P.part(cr([[x - 17 * s, y - 14 * s, 1], [x - 24 * s, y - 20 * s], [x - 28 * s, y - 19 * s, 1], [x - 20 * s, y - 11 * s, 1]], true, 3), { tone: () => 0.4, layers: [hatch(70, 1.4, 1.1, 0.08, 1.8)], seed: seed + 1, fill: '#e9d9a4', halo: 0, outline: 0.9, wash: [WASH.brass, 0.85] });
  P.line(cr([[x + 17 * s, y - 14 * s], [x + 24 * s, y - 12 * s], [x + 25 * s, y - 5 * s]], false, 4), 1.1);
  flame(P, x - 27 * s, y - 20 * s, flameH * s, seed + 3);
}

/** Ashlar blocks on a wall quad given by its four corners (top-left, top-right, bottom-right, bottom-left): rows of running-bond joints that follow the perspective. */
export function joints(P, [tl, tr, br, bl], rows, cols, seed, w = 0.7) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const r = rng(seed);
  for (let i = 1; i < rows; i++) { const a = lerp(tl, bl, i / rows), b = lerp(tr, br, i / rows); P.line([a, b], w, 0.9); }
  for (let i = 0; i < rows; i++) {
    const t0 = i / rows, t1 = (i + 1) / rows, off = (i % 2) * 0.5 + (r() - 0.5) * 0.08;
    for (let j = 0; j < cols; j++) { const u = (j + off) / cols; if (u <= 0.02 || u >= 0.98) continue; const top = lerp(lerp(tl, tr, u), lerp(bl, br, u), t0), bot = lerp(lerp(tl, tr, u), lerp(bl, br, u), t1); P.line([top, bot], w, 0.9); }
  }
}
export { CARD, hatch, box, vnoise };
