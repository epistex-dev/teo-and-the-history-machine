// Chapter 3 Norse hall at midwinter: a long timber hall in one-point perspective, two rows of carved posts, tie beams, an earth floor with the long hearth
// glowing at the far end, a trestle bench across the nave with the candle on it. The candle is the key light: the glow stops at the second row of posts.
import { clamp, mix, sstep, f1, cr, ellipse, vnoise, rng, engrave, family, fanLines, inPoly, ink } from './lib.mjs';
import { Plate, gauss, WASH } from './draw.mjs';
import { CARD, hatch, box, hash, pool, glow, candle } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';

const DEEP = '#4d3a22', EMBER = '#f0a53a';
// m: px per metre at depth 1; the floor meets the bottom edge of the art at depth 1
const DESIGN = {
  portrait: { m: 320, bench: 2.6, candle: [165, 0], quad: 'left' },
  landscape: { m: 285, bench: 2.6, candle: [400, 0], quad: 'left' },
};
const ROWS = [2.3, 3.4, 5.0], ROW_X = 0.85, FAR = 7.5, WALL_X = 2.4, ROOF = 3.4, BENCH_H = 0.45;

// Sutherland-Hodgman clip against a rectangle so the big wall and ceiling quads stay cheap to hatch
function clip(poly, [x0, y0, x1, y1]) {
  const edges = [[(p) => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + (b[1] - a[1]) * t]; }], [(p) => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + (b[1] - a[1]) * t]; }], [(p) => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y0]; }], [(p) => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, y1]; }]];
  let out = poly.map((p) => [p[0], p[1]]);
  for (const [inside, cut] of edges) { const src = out; out = []; for (let i = 0; i < src.length; i++) { const a = src[i], b = src[(i + 1) % src.length]; if (inside(a)) { out.push(a); if (!inside(b)) out.push(cut(a, b)); } else if (inside(b)) out.push(cut(a, b)); } }
  return out;
}

export function hall(orientation = 'portrait') {
  const L = LAYOUTS['ch3-hall'][orientation], [W, H] = L.size, [vx, vy] = L.vp, hs = H - vy, portrait = orientation === 'portrait', D = DESIGN[orientation], m = D.m;
  const P = new Plate(53);
  const pr = (X, Y, z) => [vx + (X * m) / z, vy + (hs - Y * m) / z];
  const ray = (p, x) => { const s = (x - vx) / (p[0] - vx); return [x, vy + (p[1] - vy) * s]; };
  const zBench = D.bench, benchTop = pr(0, BENCH_H, zBench)[1], benchFloor = pr(0, 0, zBench)[1];
  const cx = D.candle[0], cy = benchTop - 1, candleC = [cx, cy - 22];
  // far hearth: a lit opening in the end wall
  const far = { l: pr(-WALL_X, 0, FAR)[0], r: pr(WALL_X, 0, FAR)[0], b: pr(0, 0, FAR)[1], t: pr(0, ROOF, FAR)[1] };
  const hearth = [(far.l + far.r) / 2, far.b - 4];
  const tone = (x, y) => {
    const light = Math.min(1, pool(x, y, candleC, portrait ? 150 : 170, 0.8) + 0.5 * pool(x, y, hearth, portrait ? 36 : 40, 0.9));
    const depth = sstep(benchFloor - (portrait ? 40 : 30), vy + 40, y) * 0.2;
    const vig = sstep(portrait ? 220 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.1 : 0.9), (y - (portrait ? 480 : 200)) * 0.8)) * 0.3;
    return clamp(0.78 - 0.72 * light + vig * 0.7 + depth + 0.06 * (vnoise(x * 0.04, y * 0.04, 6) - 0.5));
  };
  const E = [-30, -30, W + 30, H + 30];
  const quad = (pts) => clip(pts, E);
  const topL = pr(-WALL_X, ROOF, FAR), botL = pr(-WALL_X, 0, FAR), topR = pr(WALL_X, ROOF, FAR), botR = pr(WALL_X, 0, FAR);
  // ---------------------------------------------------------------- end wall, side walls, ceiling
  P.part(box(far.l, far.t, far.r - far.l, far.b - far.t), { tone: (x, y) => clamp(tone(x, y) * 0.9 + 0.1), layers: [hatch(0, 2.2, 1.2, 0.06, 2), hatch(70, 3, 0.9, 0.55)], seed: 901, fill: CARD, halo: 0, outline: 1.2, wash: [DEEP, 0.55] });
  const sideWall = (sg) => { const t = sg < 0 ? topL : topR, b = sg < 0 ? botL : botR, xe = sg < 0 ? -30 : W + 30; return quad([t, b, ray(b, xe), ray(t, xe)]); };
  for (const sg of [-1, 1]) P.part(sideWall(sg), { tone: (x, y) => Math.min(0.62, clamp(tone(x, y) * 0.9 + 0.1)), layers: [hatch(sg < 0 ? 14 : -14, 2.6, 1.1, 0.06, 2.2), hatch(78, 3.4, 0.8, 0.5)], seed: 902 + sg, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.5] });
  const ceil = quad([topL, topR, ray(topR, W + 30), [W + 30, -30], [-30, -30], ray(topL, -30)]);
  const ceilLines = fanLines([vx, vy], Array.from({ length: 30 }, (_, i) => vx + (i - 15) * (portrait ? 40 : 60)), vy - 200, vy - 20, -40);
  P.part(ceil, { tone: (x, y) => clamp(tone(x, y) * 0.9 + 0.2), layers: [hatch(0, 2.4, 1.1, 0.06, 2.2), { lines: ceilLines, w: 1.1, lo: 0.2, step: 2.4 }], seed: 903, fill: CARD, halo: 0, outline: 1.2, wash: [DEEP, 0.6] });
  // long roof beams running to the vanishing point and tie beams across the nave
  for (const X of [-1.5, -0.55, 0.55, 1.5]) P.line([pr(X, ROOF, 1.1), pr(X, ROOF, FAR)], 3.2, 0.9);
  for (const z of [...ROWS, 6.4]) { const a = pr(-WALL_X, ROOF, z), b = pr(WALL_X, ROOF, z), th = (0.22 * m) / z; P.part(clip([[a[0], a[1] - th / 2], [b[0], b[1] - th / 2], [b[0], b[1] + th / 2], [a[0], a[1] + th / 2]], E), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.25), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 910 + Math.round(z * 10), fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.62] }); }
  // banners with a lozenge on the end wall
  for (const sg of [-1, 1]) { const bx = vx + sg * (far.r - far.l) * 0.32, bw = (far.r - far.l) * 0.1, bt = far.t + (far.b - far.t) * 0.14, bh = (far.b - far.t) * 0.36; P.part([[bx - bw, bt, 1], [bx + bw, bt, 1], [bx + bw, bt + bh, 1], [bx, bt + bh * 0.86], [bx - bw, bt + bh, 1]], { tone: () => 0.5, layers: [hatch(90, 1.8, 1.0, 0.08)], seed: 920 + sg, fill: CARD, halo: 0, outline: 0.8, wash: [WASH.cap, 0.55] }); P.raw('<path d="M' + f1(bx) + ' ' + f1(bt + bh * 0.22) + 'l' + f1(bw * 0.55) + ' ' + f1(bh * 0.18) + 'l-' + f1(bw * 0.55) + ' ' + f1(bh * 0.18) + 'l-' + f1(bw * 0.55) + ' -' + f1(bh * 0.18) + 'z" fill="none" stroke="' + ink + '" stroke-width=".7"/>'); }
  // hearth opening at the far end: the one lit patch of the plate
  { const hw = (far.r - far.l) * 0.16, hh = (far.b - far.t) * 0.3, hx = hearth[0];
    P.part([[hx - hw, far.b, 1], [hx - hw, far.b - hh * 0.6], [hx - hw * 0.7, far.b - hh], [hx + hw * 0.7, far.b - hh], [hx + hw, far.b - hh * 0.6], [hx + hw, far.b, 1]], { tone: (x, y) => clamp(0.08 + 0.3 * sstep(far.b - hh, far.b, y) * 0), layers: [hatch(80, 2.4, 0.6, 0.06)], seed: 930, fill: '#fff3b0', halo: 0, outline: 1.0, wash: [EMBER, 0.85] });
    for (const dx of [-0.5, 0, 0.5]) P.raw('<path d="M' + f1(hx + dx * hw) + ' ' + f1(far.b) + 'q' + f1(-hw * 0.25) + ' ' + f1(-hh * 0.5) + ' ' + f1(hw * 0.1) + ' ' + f1(-hh * 0.8) + 'q' + f1(hw * 0.3) + ' ' + f1(hh * 0.4) + ' ' + f1(hw * 0.25) + ' ' + f1(hh * 0.8) + 'z" fill="' + ink + '" fill-opacity=".85"/>'); }
  // ---------------------------------------------------------------- earth floor with the long hearth channel
  const floorPoly = quad([botL, botR, ray(botR, W + 30), [W + 30, H], [-30, H], ray(botL, -30)]);
  const ftone = (x, y) => Math.min(0.7, clamp(tone(x, y) * 0.85 + 0.1 + 0.2 * (vnoise(x * 0.06, y * 0.25, 12) - 0.5)));
  P.part(floorPoly, { tone: ftone, layers: [hatch(0, 2.6, 1.1, 0.1, 2.2, { wob: 0.5 }), hatch(14, 3.6, 0.9, 0.5), hatch(-18, 4.4, 0.8, 0.7)], seed: 940, fill: CARD, halo: 0, outline: 0, wash: [WASH.wood2, 0.4] });
  { const a = [pr(-0.3, 0, 3.8), pr(0.3, 0, 3.8), pr(0.3, 0, 7.2), pr(-0.3, 0, 7.2)];
    P.part(a, { tone: (x, y) => clamp(0.5 + 0.4 * sstep(vy + 60, vy + 100, y)), layers: [hatch(90, 1.8, 1.0, 0.1, 1.8)], seed: 941, fill: '#a89878', halo: 0, outline: 1.1, wash: [DEEP, 0.6] });
    const r = rng(95); for (let i = 0; i < 9; i++) { const z = 4.2 + i * 0.34, p = pr((r() - 0.5) * 0.4, 0, z); P.raw('<ellipse cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" rx="' + f1(6 / z) + '" ry="' + f1(2.2 / z) + '" fill="' + EMBER + '" fill-opacity=".75" style="mix-blend-mode:multiply"/>'); } }
  // ---------------------------------------------------------------- carved posts (two rows) and the trestle bench with the candle
  const post = (X, z, seed) => {
    const x0 = vx + ((X - 0.15) * m) / z, x1 = vx + ((X + 0.15) * m) / z, yb = vy + hs / z, yt = vy + (hs - ROOF * m) / z;
    if (x1 < -10 || x0 > W + 10) return;
    const ty = Math.max(yt, -10);
    P.part(box(x0, ty, x1 - x0, yb - ty), { tone: (x, y) => Math.min(0.66, clamp(tone(x, y) * 0.8 + 0.12 + 0.2 * sstep(x0, x1, x) * (X < 0 ? 0 : 1) + 0.2 * (1 - sstep(x0, x1, x)) * (X < 0 ? 1 : 0))), layers: [hatch(90, 1.9, 1.3, 0.08, 2.2), hatch(24, 2.8, 0.9, 0.55)], seed, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.62] });
    for (const hgt of [0.5, 1.1, 1.7, 2.3, 2.9]) { const y = vy + (hs - hgt * m) / z; if (y < -5 || y > H) continue; const w = x1 - x0; P.line(cr([[x0, y], [x0 + w * 0.25, y - w * 0.08], [x0 + w * 0.5, y], [x0 + w * 0.75, y - w * 0.08], [x1, y]], false, 4), Math.max(0.6, 1.6 / z), 0.9); P.line(cr([[x0, y + w * 0.14], [x0 + w * 0.25, y + w * 0.06], [x0 + w * 0.5, y + w * 0.14], [x0 + w * 0.75, y + w * 0.06], [x1, y + w * 0.14]], false, 4), Math.max(0.5, 1.2 / z), 0.8); }
    P.part(box(x0 - 3 / z * 2, yb - (0.12 * m) / z, x1 - x0 + 6 / z * 2, (0.12 * m) / z), { tone: () => 0.5, layers: [hatch(0, 1.5, 1.0, 0.1)], seed: seed + 1, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
  };
  const drawRow = (z, i) => { post(-ROW_X, z, 950 + i * 4); post(ROW_X, z, 951 + i * 4); };
  ROWS.slice().reverse().forEach((z, i) => { if (z < zBench) return; drawRow(z, i); });
  // bench across the nave: a plank on two trestles
  { const a = pr(-2.0, BENCH_H, zBench), b = pr(2.0, BENCH_H, zBench), th = (0.07 * m) / zBench, leg = (BENCH_H * m) / zBench;
    for (const X of [-1.7, -0.5, 0.7, 1.7]) { const p = pr(X, 0, zBench); P.part(box(p[0] - 3.4, p[1] - leg, 6.8, leg), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.2), layers: [hatch(90, 1.7, 1.1, 0.08, 1.8)], seed: 960 + Math.round(X * 10), fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.6] }); }
    P.part([[a[0], a[1] - th], [b[0], b[1] - th], [b[0], b[1] + th * 0.4], [a[0], a[1] + th * 0.4]], { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.12), layers: [hatch(0, 1.5, 1.1, 0.06, 1.8)], seed: 965, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood, 0.55] });
    P.line([[a[0], a[1] - th], [b[0], b[1] - th]], 1.2); }
  // the candle on the bench is a separate sprite (prop candle-wax); the plate only carries its pool of light
  ROWS.slice().reverse().forEach((z, i) => { if (z >= zBench) return; drawRow(z, i + 4); });
  glow(P, candleC[0], candleC[1], portrait ? 170 : 200, portrait ? 130 : 110, 0.85);
  glow(P, hearth[0], hearth[1] - 6, portrait ? 52 : 60, portrait ? 36 : 40, 0.8);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], bench: { candle: [cx, cy], top: benchTop }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
