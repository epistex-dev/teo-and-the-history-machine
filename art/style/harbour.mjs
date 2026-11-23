// Chapter 7 harbour at Myra, night: a flagstone quay running out to the pier head, a tall stone warehouse wall on the left with a shuttered window, dark water on the right with
// the lamp's reflection, a small boat far out, and one oil lantern hung on a post at the pier head as the key light. No figure, no light in any window.
import { clamp, sstep, f1, cr, ellipse, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, floor, glow, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view, stars } from './scenery.mjs';

const FAR = 6.5;
const DESIGN = {
  portrait: { m: 300, wallX: 1.8, wallH: 4.2, wallEnd: 5.5, edge: 1.5, post: [0.6, 6.1, 2.2], win: [3.0, 3.7, 2.2, 3.5], bw: 104, boat: [330, 1], seaDark: 0.78 },
  landscape: { m: 270, wallX: 2.1, wallH: 3.4, wallEnd: 6.0, edge: 2.1, post: [0.6, 6.1, 2.2], win: [3.6, 4.5, 1.7, 2.7], bw: 124, boat: [412, 1], seaDark: 0.78 },
};

function lantern(P, x, y, s, seed) {
  P.line([[x, y - 9 * s], [x, y]], 1.0);
  P.part(cr([[x - 8 * s, y + 1 * s, 1], [x - 5 * s, y - 3 * s], [x, y - 6 * s, 1], [x + 5 * s, y - 3 * s], [x + 8 * s, y + 1 * s, 1]], true, 3), { tone: () => 0.5, layers: [hatch(70, 1.3, 1.0, 0.1, 1.5)], seed, fill: '#8a6a3c', halo: 0, outline: 0.9, wash: [WASH.wood2, 0.7] });
  P.part(box(x - 6.5 * s, y + 1 * s, 13 * s, 21 * s), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.6, 0.05, 1.6)], seed: seed + 1, fill: '#f6ecc0', halo: 0, outline: 1.1, wash: [WASH.glow, 0.8] });
  for (const k of [-0.33, 0.33]) P.line([[x + k * 13 * s, y + 1 * s], [x + k * 13 * s, y + 22 * s]], 0.7, 0.9);
  flame(P, x, y + 19 * s, 15 * s, seed + 2);
  P.part(box(x - 8 * s, y + 22 * s, 16 * s, 3.4 * s), { tone: () => 0.5, layers: [hatch(0, 1.3, 1.0, 0.1, 1.5)], seed: seed + 3, fill: '#8a6a3c', halo: 0, outline: 0.9, wash: [WASH.wood2, 0.7] });
}

export function harbour(orientation = 'portrait') {
  const L = LAYOUTS['ch7-harbour'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, pr, ray, E, quad } = view(L, D.m), WX = D.wallX, EDGE = D.edge;
  const P = new Plate(57);
  const far = { l: pr(-WX, 0, FAR)[0], b: pr(0, 0, FAR)[1] }, edgeFar = pr(EDGE, 0, FAR);
  const [px, pz, ph] = D.post, pBase = pr(px, 0, pz), pTop = pr(px, ph, pz), lamp = [pTop[0] - (portrait ? 12 : 11), pTop[1] + (portrait ? 20 : 16)];
  const tone = (x, y) => {
    const light = pool(x, y, lamp, portrait ? 170 : 190, 0.9);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 400 : 190)) * 0.8)) * 0.3;
    return clamp(0.84 - 0.78 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 8) - 0.5));
  };
  // ---------------------------------------------------------------- sky, far shore, a boat, the water
  P.part(box(0, 0, W, vy + 6), { tone: (x, y) => clamp(0.9 - 0.4 * sstep(0, vy, y) + 0.05 * (vnoise(x * 0.03, y * 0.05, 4) - 0.5)), layers: [hatch(0, 2.5, 1.2, 0.1, 2.2), hatch(28, 3.2, 0.9, 0.55, 2.2)], seed: 1701, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.85] });
  stars(P, [0, 6, W, vy - 14], portrait ? 38 : 56, 17, (x, y) => (x - lamp[0]) ** 2 + (y - lamp[1]) ** 2 < 2500);
  const shore = [[-10, vy + 8], [-10, vy - 4]]; for (let x = 0; x <= W + 10; x += 20) shore.push([x, vy - 3 - 11 * vnoise(x * 0.025, 3, 6) * (x > W * 0.55 ? 1.4 : 0.5)]); shore.push([W + 10, vy + 8]);
  P.part(shore, { tone: () => 0.82, layers: [hatch(2, 2.2, 1.1, 0.1, 2.2), hatch(-30, 3, 0.9, 0.6)], seed: 1702, fill: CARD, halo: 0, outline: 1.0, wash: [BLUE, 0.8] });
  const water = box(0, vy + 2, W, far.b - vy + 6);
  P.part(water, { tone: (x, y) => Math.min(0.86, clamp(D.seaDark - 0.5 * pool(x, y, lamp, portrait ? 150 : 170, 0.5) * sstep(vy, far.b + 80, y) + 0.08 * (vnoise(x * 0.02, y * 0.3, 9) - 0.5))), layers: [hatch(0, 2.3, 1.1, 0.1, 2.2, { wob: 0.4 }), hatch(3, 3.4, 0.8, 0.55, 2.2)], seed: 1703, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.7] });
  { const [bx, s] = D.boat, by = vy + 14 * s, hull = cr([[bx - 22 * s, by - 4 * s, 1], [bx - 14 * s, by + 5 * s], [bx + 12 * s, by + 5 * s], [bx + 24 * s, by - 6 * s, 1], [bx + 8 * s, by - 3 * s], [bx - 10 * s, by - 3 * s]], true, 4);
    P.line([[bx + 2 * s, by - 3 * s], [bx + 2 * s, by - 30 * s]], 1.3);
    P.part([[bx + 3 * s, by - 28 * s, 1], [bx + 3 * s, by - 5 * s, 1], [bx + 17 * s, by - 6 * s, 1]], { tone: () => 0.5, layers: [hatch(80, 1.8, 0.8, 0.1, 1.6)], seed: 1704, fill: CARD, halo: 0, outline: 0.9, wash: [WASH.wood, 0.4] });
    P.part(hull, { tone: () => 0.74, layers: [hatch(0, 1.6, 1.2, 0.1, 1.6)], seed: 1705, fill: CARD, halo: 0, outline: 1.1, wash: [BLUE, 0.7] }); }
  // ---------------------------------------------------------------- flagstone quay with the water beside it
  floor(P, { W, H, hy: far.b, vp: L.vp, bw: D.bw, tone, seed: 1750, wash: [STONE, 0.55], joint: { min: 0.14, spread: 0.26 }, grain: 0.6, grid: 1.1, shadowLo: 0.4 });
  P.raw('<path d="M0 ' + f1(far.b) + 'H' + W + 'V' + H + 'H0Z" fill="' + BLUE + '" fill-opacity=".3" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  const edgeNear = ray(edgeFar, W + 30), rightWater = quad([[edgeFar[0], far.b - 6], [W + 30, far.b - 6], edgeNear, edgeFar]);
  if (rightWater.length > 2) {
    P.part(rightWater, { tone: (x, y) => Math.min(0.88, clamp(D.seaDark - 0.55 * pool(x, y, lamp, portrait ? 150 : 180, 0.5) + 0.08 * (vnoise(x * 0.02, y * 0.3, 9) - 0.5))), layers: [hatch(0, 2.3, 1.1, 0.1, 2.2, { wob: 0.4 }), hatch(3, 3.4, 0.8, 0.55, 2.2)], seed: 1706, fill: CARD, halo: 0, outline: 0, wash: [BLUE, 0.7] });
  }
  { const r = rng(41), x0 = lamp[0], span = far.b - vy - 10; for (let i = 0; i < 8; i++) { const y = vy + 8 + (i * span) / 8, w = (6 + i * 2.6) * (0.7 + r() * 0.6) * (portrait ? 1 : 0.9); P.raw('<path d="M' + f1(x0 - w / 2) + ' ' + f1(y) + 'h' + f1(w) + '" stroke="#ffd25a" stroke-width="1.5" stroke-opacity="' + f1(0.9 - i * 0.07) + '" stroke-linecap="round" fill="none"/>'); } }
  // coping stones along the edge and the pier head
  { const strip = quad([pr(EDGE - 0.12, 0, FAR), pr(EDGE, 0, FAR), pr(EDGE, 0, 0.3), pr(EDGE - 0.12, 0, 0.3)]);
    if (strip.length > 2) P.part(strip, { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.12), layers: [hatch(80, 1.8, 1.2, 0.08, 1.8)], seed: 1707, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    for (let z = 0.7; z < FAR; z *= 1.22) P.line([pr(EDGE - 0.12, 0, z), pr(EDGE, 0, z)], 0.8, 0.9);
    const head = quad([pr(-WX, 0, FAR), pr(EDGE, 0, FAR), pr(EDGE, 0, FAR - 0.18), pr(-WX, 0, FAR - 0.18)]);
    P.part(head, { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.12), layers: [hatch(0, 1.6, 1.2, 0.08, 1.8)], seed: 1708, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    for (const z of [2.9, 4.1, 5.3]) { const b = pr(EDGE - 0.22, 0, z), s = D.m / z; P.part(cr([[b[0] - 0.09 * s, b[1], 1], [b[0] - 0.07 * s, b[1] - 0.2 * s], [b[0] - 0.12 * s, b[1] - 0.26 * s, 1], [b[0] + 0.12 * s, b[1] - 0.26 * s, 1], [b[0] + 0.07 * s, b[1] - 0.2 * s], [b[0] + 0.09 * s, b[1], 1]], true, 3), { tone: (x, y) => clamp(0.35 + 0.35 * sstep(b[0] - 0.1 * s, b[0] + 0.1 * s, x) + 0.2 * (1 - pool(x, y, lamp, 130, 0.9))), layers: [hatch(88, 1.4, 1.1, 0.08, 1.5)], seed: 1710 + Math.round(z * 10), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] }); } }
  // ---------------------------------------------------------------- the stone warehouse wall on the left, ashlar courses and a shuttered window
  let win = [];
  { const X = -WX, wq = (y0, y1, a, b) => quad([pr(X, y1, a), pr(X, y1, b), pr(X, y0, b), pr(X, y0, a)]);
    P.part(wq(0, D.wallH, 0.2, D.wallEnd), { tone: (x, y) => Math.min(0.8, clamp(tone(x, y) * 0.95 + 0.05)), layers: [hatch(8, 2.5, 1.1, 0.08, 2.2), hatch(80, 3.4, 0.8, 0.5)], seed: 1720, fill: CARD, halo: 0, outline: 1.3, wash: [STONE, 0.55] });
    P.raw('<path d="' + 'M' + wq(0, D.wallH, 0.2, D.wallEnd).map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z" fill="' + BLUE + '" fill-opacity=".3" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
    const ok = (a, b) => a[0] > -40 && a[0] < W + 40 && b[0] > -40 && b[0] < W + 40;
    for (let h = 0.4; h < D.wallH; h += 0.4) { const a = pr(X, h, 0.2), b = pr(X, h, D.wallEnd); const q = ray(a, -30); P.line([q[0] < 0 ? q : a, b], 0.6, 0.85); }
    for (let row = 0; row * 0.4 < D.wallH; row++) for (let z = 0.5 + (row % 2) * 0.09; z < D.wallEnd; z *= 1.17) { const a = pr(X, row * 0.4, z), b = pr(X, (row + 1) * 0.4, z); if (a[1] > -10 && b[1] < H + 10 && ok(a, b)) P.line([a, b], 0.6, 0.85); }
    P.part(wq(D.wallH - 0.18, D.wallH + 0.05, 0.2, D.wallEnd), { tone: (x, y) => clamp(tone(x, y) * 0.6 + 0.15), layers: [hatch(8, 1.6, 1.1, 0.08)], seed: 1721, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    const [wa, wb, wy0, wy1] = D.win;
    P.part(wq(wy0 - 0.1, wy1 + 0.1, wa - 0.12, wb + 0.12), { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.12), layers: [hatch(80, 1.8, 1.0, 0.08, 1.8)], seed: 1722, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    P.part(wq(wy0, wy1, wa, wb), { tone: () => 0.78, layers: [hatch(90, 1.7, 1.2, 0.1, 1.6), hatch(20, 2.5, 0.9, 0.5)], seed: 1723, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.line([pr(X, (wy0 + wy1) / 2, wa), pr(X, (wy0 + wy1) / 2, wb)], 1.2, 1);
    for (let k = 1; k < 4; k++) { const z = wa + ((wb - wa) * k) / 4; P.line([pr(X, wy0, z), pr(X, wy1, z)], 0.8, 0.9); } win = [pr(X, wy1, wa), pr(X, wy1, wb), pr(X, wy0, wb), pr(X, wy0, wa)]; }
  // ---------------------------------------------------------------- barrels against the wall
  for (const [z, i] of [[2.9, 0], [3.4, 1]]) { const b = pr(-WX + 0.38, 0, z), s = D.m / z, bw = 0.34 * s, bh = 0.55 * s;
    P.part(cr([[b[0] - bw * 0.8, b[1] - bh, 1], [b[0] - bw, b[1] - bh * 0.5], [b[0] - bw * 0.8, b[1], 1], [b[0] + bw * 0.8, b[1], 1], [b[0] + bw, b[1] - bh * 0.5], [b[0] + bw * 0.8, b[1] - bh, 1]], true, 4), { tone: (x, y) => clamp(0.3 + 0.4 * sstep(b[0] - bw, b[0] + bw, x) + 0.2 * (1 - pool(x, y, lamp, 150, 0.9))), layers: [hatch(88, 1.6, 1.2, 0.08, 1.8), hatch(15, 2.4, 0.8, 0.55)], seed: 1730 + i, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.7] });
    for (const t of [0.25, 0.75]) P.line(cr([[b[0] - bw * 0.95, b[1] - bh * t], [b[0], b[1] - bh * t + 3], [b[0] + bw * 0.95, b[1] - bh * t]], false, 4), 1.1, 1); }
  // ---------------------------------------------------------------- the post at the pier head with its oil lantern
  { const w = (0.13 * D.m) / pz;
    P.part(box(pBase[0] - w / 2, pTop[1], w, pBase[1] - pTop[1]), { tone: (x, y) => clamp(0.35 + 0.35 * sstep(pBase[0] - w / 2, pBase[0] + w / 2, x) + 0.2 * (1 - pool(x, y, lamp, 120, 0.9))), layers: [hatch(90, 1.6, 1.2, 0.08, 1.8), hatch(18, 2.4, 0.8, 0.5)], seed: 1740, fill: CARD, halo: 0.6, outline: 1.2, wash: [WASH.wood2, 0.75] });
    P.line(cr([[pBase[0], pTop[1] + 14], [pBase[0] - 6, pTop[1] + 3], [lamp[0], pTop[1] + 2]], false, 4), 1.6, 1);
    lantern(P, lamp[0], pTop[1] + 4, portrait ? 1 : 0.9, 1742); }
  glow(P, lamp[0], lamp[1] + 14, portrait ? 150 : 170, portrait ? 110 : 100, 0.85);
  const wx = win.map((p) => p[0]), wyy = win.map((p) => p[1]);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp, keys: { boat: [D.boat[0] - 24 * D.boat[1], vy + 14 * D.boat[1] - 30 * D.boat[1], 48 * D.boat[1], 35 * D.boat[1]], lantern: [lamp[0] - 8, lamp[1] - 8, 16, 16] }, win: [Math.min(...wx), Math.min(...wyy), Math.max(...wx) - Math.min(...wx), Math.max(...wyy) - Math.min(...wyy)], svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
