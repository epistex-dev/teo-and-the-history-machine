// Pieces shared by the Act 2 night plates (chapters 8 to 11): the hatched night sky, frost and snow speckle, low mist and smoke, drawn as paper-white marks on dark hatching.
import { clamp, sstep, f1, cr, rng, vnoise } from './lib.mjs';
import { CARD, hatch, box } from './room.mjs';
import { BLUE, BERRY, stars } from './scenery.mjs';

/** The night sky down to y = h: dense burin work, lighter toward the horizon, paper dots for stars (skip(x, y) keeps them off a lit place). */
export function nightSky(P, { W, h, seed, n, skip = () => false, fade = 0.4, top = 0.9 }) {
  P.part(box(0, 0, W, h), { tone: (x, y) => clamp(top - fade * sstep(0, h, y) + 0.05 * (vnoise(x * 0.03, y * 0.05, 4) - 0.5)), layers: [hatch(0, 2.5, 1.2, 0.1, 2.2), hatch(28, 3.2, 0.9, 0.55, 2.2)], seed, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.85] });
  stars(P, [0, 6, W, h - 14], n, seed + 3, skip);
}

/** Frost or snow crystals: n paper-white dots inside the rectangle where ok(x, y) holds. */
export function crystals(P, [x0, y0, x1, y1], n, seed, ok = () => true, op = 0.85) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), s = 0.45 + r() * 0.7;
    if (ok(x, y)) P.raw('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(s) + '" fill="' + BERRY + '" fill-opacity="' + f1(op * (0.6 + 0.4 * r())) + '"/>');
  }
}

/** Mist lying in the rectangle: long pale strokes, a few wavy rows. */
export function mist(P, [x0, y0, x1, y1], rows, seed, op = 0.32) {
  const r = rng(seed);
  for (let i = 0; i < rows; i++) {
    const y = y0 + ((i + r() * 0.8) / rows) * (y1 - y0), a = x0 + r() * (x1 - x0) * 0.4, b = x1 - r() * (x1 - x0) * 0.4, n = 6, pts = [];
    for (let k = 0; k <= n; k++) pts.push([a + ((b - a) * k) / n, y + Math.sin(k * 1.3 + i * 2.1) * 1.6]);
    P.raw('<path d="M' + cr(pts, false, 4).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + '" fill="none" stroke="' + BERRY + '" stroke-width="' + f1(1.6 + r() * 2.2) + '" stroke-linecap="round" stroke-opacity="' + f1(op * (0.5 + r() * 0.6)) + '"/>');
  }
}

/** A thread of smoke from (x, y) rising h px, drifting to the side. */
export function smoke(P, x, y, h, seed, drift = 14) {
  const r = rng(seed);
  for (let j = 0; j < 3; j++) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x + (j - 1) * 3 * t + drift * t * t + Math.sin(t * 6 + j * 2) * (2 + 5 * t), y - h * t]); }
    P.raw('<path d="M' + cr(pts, false, 4).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + '" fill="none" stroke="' + BERRY + '" stroke-width="' + f1(2.2 - j * 0.5) + '" stroke-linecap="round" stroke-opacity="' + f1(0.55 - j * 0.12 + r() * 0.05) + '" filter="url(#rag)"/>');
  }
}

