// Pieces shared by the story rooms (office, banquet, hall): hatch specs, light pools, plank or flagstone floors in one-point perspective, candles.
import { clamp, f1, cr, ellipse, vnoise, rng, engrave, family, fanLines, ink } from './lib.mjs';
import { WASH, gauss } from './draw.mjs';

export const CARD = '#f5eed8';
export const hatch = (angle, gap, w, lo, step = 2, extra = {}) => ({ angle, gap, w, lo, step, ...extra });
export const box = (x, y, w, h) => [[x, y, 1], [x + w, y, 1], [x + w, y + h, 1], [x, y + h, 1]];
export const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
/** Light falling off with distance from c: 1 at the source, a quarter at r. k squeezes the x axis. */
export const pool = (x, y, c, r, k = 1) => 1 / (1 + Math.pow(Math.hypot((x - c[0]) * k, y - c[1]) / r, 2));

/** Warm glow wash (lantern light) over an ellipse. */
export function glow(P, cx, cy, rx, ry, op = 1) {
  P.raw('<defs><radialGradient id="warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".9"/><stop offset=".45" stop-color="#f4b447" stop-opacity=".55"/><stop offset="1" stop-color="#f0a53a" stop-opacity="0"/></radialGradient></defs>');
  P.raw('<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(rx) + '" ry="' + f1(ry) + '" fill="url(#warm)" fill-opacity="' + op + '" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
}

/**
 * Floor in one-point perspective: boards of varied length with staggered joints, hatching along the grain and across it where it is in shadow.
 * o: W, H, hy (wall line), vp, bw (board width at the bottom), tone(x, y), seed, wash [colour, opacity], joint {min, spread} (board length in depth units), grain (hatch width), cols (board columns; default fills the width at the bottom row, so a wall line far below the vanishing point needs more).
 */
export function floor(P, o) {
  const { W, H, hy, vp: [vx, vy], bw, tone, seed = 900, wash = [WASH.wood, 0.38], joint = { min: 0.38, spread: 0.5 }, grain = 0.85, grid = 1.3, shadowLo = 0.34 } = o;
  const fy0 = hy, fy1 = H, hs = fy1 - vy, C = hs;
  const nCols = o.cols ?? Math.ceil(W / bw) + 8, startI = -Math.ceil(nCols / 2) - 1;
  const xAt = (xb, y) => vx + (xb - vx) * ((y - vy) / hs);
  const colOf = (x, y) => Math.floor(((x - vx) / ((y - vy) / hs)) / bw);
  const joints = new Map();
  for (let i = startI; i < startI + nCols; i++) { const rr = rng(seed + i * 7); let z = 1 + rr() * 0.5 - 0.5; const zs = []; while (z < 4.5) { z += joint.min + rr() * joint.spread; zs.push(z); } joints.set(i, zs); }
  const boardTone = (x, y) => { const z = C / (y - vy), i = colOf(x, y), zs = joints.get(i) || []; let k = 0; while (k < zs.length && zs[k] < z) k++; return hash(i, k); };
  const ftone = (x, y) => { const b = boardTone(x, y); return clamp(tone(x, y) * 0.8 + 0.2 * b + 0.17 + 0.22 * (vnoise(x * 0.07, y * 0.5, 9) - 0.5)); };
  P.part(box(0, fy0, W, fy1 - fy0), { tone: () => 0, layers: [], seed: seed + 1, fill: CARD, halo: 0, outline: 0, wash: null });
  const grainX = []; for (let xb = vx - bw * (nCols / 2); xb <= vx + bw * (nCols / 2); xb += bw / 6) grainX.push(xb);
  P.raw('<path d="' + engrave(fanLines([vx, vy], grainX, fy1, fy0, fy1), { tone: ftone, w: grain, lo: 0.1, step: 2.6, wob: 0.5, seed: seed + 2, inside: (x) => x >= 0 && x <= W }) + '" fill="' + ink + '"/>');
  P.raw('<path d="' + engrave(family(4, 3.4, [0, fy0, W, fy1], 0.3, 12), { tone: (x, y) => ftone(x, y) * 0.8 - 0.14, w: 1.1, lo: shadowLo, step: 2.4, wob: 0.2, seed: seed + 3, inside: () => true }) + '" fill="' + ink + '"/>');
  for (let i = startI; i <= startI + nCols; i++) { const xb = vx + i * bw; P.line([[xAt(xb, fy0), fy0], [xAt(xb, fy1), fy1]], grid, 0.95); }
  for (let i = startI; i < startI + nCols; i++) for (const z of joints.get(i)) { const y = vy + C / z; if (y <= fy0 + 2 || y > fy1 + 2) continue; const xa = xAt(vx + i * bw, y), xc = xAt(vx + (i + 1) * bw, y); if (xc < 0 || xa > W) continue; P.line([[xa, y], [xc, y + 0.4]], 0.5 + 0.9 * (y - vy) / hs, 0.95); }
  P.raw('<path d="M0 ' + fy0 + 'H' + W + 'V' + fy1 + 'H0Z" fill="' + wash[0] + '" fill-opacity="' + wash[1] + '" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
}

/** A flame: pale core with a flame-coloured wash. (x, y) is the base, h the height. */
export function flame(P, x, y, h, seed = 1) {
  const w = h * 0.2;
  P.part(cr([[x, y, 1], [x - w, y - h * 0.28], [x - w * 0.6, y - h * 0.62], [x + w * 0.1, y - h, 1], [x + w * 0.7, y - h * 0.6], [x + w, y - h * 0.28]], true, 5), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.7, 0.05)], fill: '#fff3b0', seed, wash: [WASH.flame, 0.9], halo: 0, outline: 0.8 });
}

/** A wax candle standing on (x, y) with its base centre; lit when flameH > 0. */
export function candle(P, x, y, h, w, seed = 1, flameH = 0, col = '#f3ead0') {
  const top = y - h;
  P.part(cr([[x - w / 2, y, 1], [x - w / 2, top + 1.5, 1], [x - w * 0.3, top - 0.8], [x + w * 0.3, top - 0.8], [x + w / 2, top + 1.5, 1], [x + w / 2, y, 1]], true, 3), { tone: (px) => clamp(0.12 + 0.55 * ((px - (x - w / 2)) / w)), layers: [hatch(85, 1.5, 1.0, 0.08, 1.8)], fill: col, seed, wash: [WASH.glow2, 0.4], halo: 0.8, outline: 0.9 });
  P.line([[x, top], [x, top - Math.max(2, h * 0.08)]], 0.9);
  if (flameH) flame(P, x, top - Math.max(2, h * 0.08), flameH, seed + 3);
}
export { ellipse, gauss, vnoise };
