// Chapter 18 a London street in the snow, late on 24 December 1843: two shop windows shine side by side with a dark wall between them. The left one is a bookshop -
// a stack of new books with one open at its title page behind the glass, and the mist of a breath fading on the pane. The right one is a print shop - small cards
// stand in rows in its display case, and a crack of lamplight escapes its door. Snow lies on the sills, the eaves and the cobbles, keeps falling, and a fresh
// slide-track ends by the machine's feet. No figure, no letters, no carriage.
import { clamp, sstep, f1, cr, vnoise, rng, ink } from './lib.mjs';
import { Plate, WASH } from './draw.mjs';
import { CARD, hatch, box, pool, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';
import { BLUE, STONE, view } from './scenery.mjs';
import { nightSky } from './night.mjs';

const BRICK = '#8a6a3c', BRICK2 = '#4d3a22', SLATE = '#3a352e', PAPER = '#f1e6c6', SNOW = '#e9e2cc';
const Z = 7, ZJ = 6.5, UP = 2.35, TOP = 4.5;
const DESIGN = {
  portrait: { m: 300, z: 7, half: 4.4, book: [-4.2, -1.7], pier: [-1.7, 0.05], shop: [0.05, 2.7], door: [2.85, 3.65], reach: 84, wins: [[-4.0, -3.1], [-1.0, -0.1], [1.9, 2.8]] },
  landscape: { m: 250, z: 4, half: 7.6, book: [-4.4, -1.5], pier: [-1.5, -0.4], shop: [-0.4, 1.9], door: [2.2, 3.0], reach: 76, wins: [[-4.0, -3.0], [-1.1, -0.2], [0.8, 1.7]] },
};

export function dickens(orientation = 'portrait') {
  const L = LAYOUTS['ch18-london-snow'][orientation], D = DESIGN[orientation], portrait = orientation === 'portrait';
  const { W, H, vx, vy, hs } = view(L, D.m), z0 = D.z, zj = z0 - 0.5;
  const P = new Plate(84), K = portrait ? 1 : 1.35;
  const fx = (X, z = z0) => vx + (X * D.m) / z, fy = (Y, z = z0) => vy + (hs - Y * D.m) / z;
  const wall = (X0, X1, Y0, Y1, z = z0) => [[fx(X0, z), fy(Y1, z), 1], [fx(X1, z), fy(Y1, z), 1], [fx(X1, z), fy(Y0, z), 1], [fx(X0, z), fy(Y0, z), 1]];
  const base = fy(0);
  const [ba, bb] = D.book, [pa, pb] = D.pier, [sa, sb] = D.shop, [da, db] = D.door;
  const paneY = [fy(portrait ? 2.05 : 1.85), fy(0.75)];
  const glowC = [fx((ba + bb) / 2), (paneY[0] + paneY[1]) / 2], glowD = [fx((sa + sb) / 2), (paneY[0] + paneY[1]) / 2];
  const tone = (x, y) => {
    const light = (pool(x, y, glowC, D.reach, 0.75) + pool(x, y, glowD, D.reach, 0.75)) * sstep(paneY[0] - 14, paneY[0] - 4, y);
    const vig = sstep(portrait ? 200 : 380, portrait ? 520 : 760, Math.hypot((x - W / 2) * (portrait ? 1.2 : 0.9), (y - (portrait ? 420 : 200)) * 0.8)) * 0.28;
    return clamp(0.88 - 0.75 * Math.min(1, light) + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 12) - 0.5));
  };
  // ---------------------------------------------------------------- night sky with falling snow, and a slate roof carrying snow
  nightSky(P, { W, h: Math.max(39, fy(TOP, zj) + 4), seed: 2801, n: portrait ? 36 : 50, fade: 0.2, top: 0.9 });
  { const r = rng(79); const n = portrait ? 46 : 64; for (let i = 0; i < n; i++) { const x = r() * W, y = r() * (portrait ? 240 : 110), l = 1.6 + r() * 2.6, o = 0.35 + r() * 0.5;
      P.line([[x, y], [x + 1.2, y + l]], 1.1, o, SNOW); } }
  { const eave = fy(TOP, zj), l = fx(-D.half, zj), r = fx(D.half, zj);
    P.part([[l - 20, eave, 1], [l + (r - l) * 0.04, fy(TOP + 1.6, zj), 1], [r - (r - l) * 0.04, fy(TOP + 1.6, zj), 1], [r + 20, eave, 1]], { tone: (x, y) => clamp(0.6 + 0.2 * sstep(fy(TOP + 1.6, zj), eave, y)), layers: [hatch(88, 2.6, 1.1, 0.1, 2.2), hatch(8, 4.4, 0.8, 0.55)], seed: 2802, fill: CARD, halo: 0, outline: 1.2, wash: [SLATE, 0.55] });
    P.part(box(l - 20, eave - 7, r - l + 40, 12), { tone: () => 0.14, layers: [], seed: 2803, fill: SNOW, halo: 0, outline: 0.7, wash: null });
    const sa = D.wins[0][0] - 0.5, sb2 = D.wins[2][1] + 0.5;
    P.part(box(fx(sa, zj), fy(TOP + 1.15, zj), fx(sb2, zj) - fx(sa, zj), fy(TOP + 1.45, zj) - fy(TOP + 1.15, zj)), { tone: () => 0.6, layers: [hatch(90, 1.7, 1.0, 0.08, 1.8)], seed: 2804, fill: CARD, halo: 0, outline: 1.1, wash: [BRICK, 0.5] });
    P.part(box(fx(sa, zj) - 3, fy(TOP + 1.15, zj) - 5, fx(sb2, zj) - fx(sa, zj) + 6, 7), { tone: () => 0.14, layers: [], seed: 2805, fill: SNOW, halo: 0, outline: 0.6, wash: null }); }
  // ---------------------------------------------------------------- first floor: brick, dark windows with snow on their sills
  { const q = wall(-D.half, D.half, UP + 0.12, TOP, zj);
    P.part(q, { tone: (x, y) => Math.min(0.88, clamp(tone(x, y) * 0.9 + 0.02)), layers: [hatch(2, 3.0 * K, 1.1, 0.08, 2.2), hatch(86, 2.6, 0.9, 0.5)], seed: 2810, fill: CARD, halo: 0, outline: 1.2, wash: [BRICK2, 0.5] });
    for (const [a, b] of D.wins) { const fr = wall(a - 0.1, b + 0.1, UP + 0.62, UP + 1.7, zj), q2 = wall(a, b, UP + 0.7, UP + 1.6, zj);
      P.part(fr, { tone: () => 0.42, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2811, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.7] });
      P.part(q2, { tone: () => 0.9, layers: [hatch(80, 1.5, 1.2, 0.1, 1.6)], seed: 2812, fill: CARD, halo: 0, outline: 0.9, wash: [BLUE, 0.45] });
      P.line([[(q2[0][0] + q2[1][0]) / 2, q2[0][1]], [(q2[0][0] + q2[1][0]) / 2, q2[3][1]]], 0.9, 0.9); P.line([[q2[0][0], (q2[0][1] + q2[3][1]) / 2], [q2[1][0], (q2[0][1] + q2[3][1]) / 2]], 0.9, 0.9);
      P.part(box(fx(a - 0.12, zj), fy(UP + 0.62, zj) - 4, fx(b + 0.12, zj) - fx(a - 0.12, zj), 6), { tone: () => 0.14, layers: [], seed: 2813, fill: SNOW, halo: 0, outline: 0.6, wash: null }); } }
  // a dark veil over everything above the window heads: the sky reads as deep night even where the facade runs past the art top
  P.part(box(0, 0, W, paneY[0] - 4), { tone: () => 0, layers: [], fill: null, halo: 0, outline: 0, wash: ['#1e1b17', 0.55] });
  // ---------------------------------------------------------------- ground floor: brick, plinth, and the two lit windows with the dark pier between
  P.part(wall(-D.half, D.half, 0.3, UP), { tone: (x, y) => Math.min(0.82, clamp(tone(x, y) * 0.95 + 0.12)), layers: [hatch(2, 3.0 * K, 1.1, 0.08, 2.2), hatch(86, 2.6, 0.9, 0.5)], seed: 2820, fill: CARD, halo: 0, outline: 1.2, wash: [BRICK, 0.55] });
  P.part(wall(-D.half, D.half, 0, 0.37), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.22), layers: [hatch(0, 1.7, 1.1, 0.08, 1.8), hatch(72, 2.6, 0.8, 0.5)], seed: 2821, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
  P.part(wall(pa, pb, 0.3, UP), { tone: (x, y) => clamp(0.8 - 0.25 * pool(x, y, glowC, D.reach * 1.3, 0.8) + 0.06 * (vnoise(x * 0.07, y * 0.07, 8) - 0.5)), layers: [hatch(2, 2.8, 1.1, 0.08, 2.0), hatch(86, 2.4, 0.9, 0.5)], seed: 2822, fill: CARD, halo: 0, outline: 1.2, wash: [BRICK, 0.6] });
  for (const [a, b] of [[ba, bb], [sa, sb]]) {
    P.part(wall(a - 0.1, b + 0.1, paneY[0] - 0.12, paneY[1] + 0.12), { tone: (x) => clamp(0.3 + 0.25 * (1 - pool(x, paneY[0] + 20, glowC, D.reach * 1.4, 0.8))), layers: [hatch(90, 1.7, 1.1, 0.08, 1.7)], seed: 2823, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.75] });
    P.part(wall(a, b, paneY[0], paneY[1]), { tone: () => 0.1, layers: [hatch(80, 3.6, 0.7, 0.05, 2.2)], seed: 2824, fill: '#f6ecc0', halo: 0.5, outline: 0.9, wash: [WASH.glow, 0.3] });
    P.line([[fx((a + b) / 2), paneY[0]], [fx((a + b) / 2), paneY[1]]], 1.0, 0.85);
    P.part(box(fx(a - 0.14), paneY[1] - 4, fx(b + 0.14) - fx(a - 0.14), 6), { tone: () => 0.14, layers: [], seed: 2825, fill: SNOW, halo: 0, outline: 0.6, wash: null }); }
  // the bookshop: a stack of new books, one open at its title page, and the mist of a breath on the glass
  { const bw = (fx(bb) - fx(ba)) * 0.42, bx = portrait ? fx(ba) + 6 + bw / 2 + 4 : fx((ba + bb) / 2), by = paneY[1] - 6;
    for (let i = 0; i < 3; i++) { const w = bw - i * 7, h = 6, x = bx - w / 2, y = by - i * (h + 1.5);
      P.part(box(x, y, w, h), { tone: (px, py) => clamp(0.3 + 0.16 * sstep(x, x + w, px) + 0.14 * (vnoise(px * 0.09, py * 0.09, 6) - 0.5)), layers: [hatch(0, 1.3, 0.9, 0.08, 1.6)], seed: 2826 + i, fill: CARD, halo: 0.5, outline: 0.9, wash: [i === 1 ? '#b8362b' : '#a7692f', 0.55] }); }
    const oy2 = by - 3 * 7.5 - 4;
    P.part([[bx - bw / 2 - 4, oy2 + 9, 1], [bx - 2, oy2, 1], [bx - 2, oy2 + 9, 1]], { tone: () => 0.09, layers: [hatch(-24, 2.2, 0.8, 0.05, 1.8)], seed: 2829, fill: PAPER, halo: 0.5, outline: 0.8, wash: null });
    P.part([[bx + 2, oy2, 1], [bx + bw / 2 + 4, oy2 + 9, 1], [bx + 2, oy2 + 9, 1]], { tone: () => 0.09, layers: [hatch(24, 2.2, 0.8, 0.05, 1.8)], seed: 2830, fill: PAPER, halo: 0.5, outline: 0.8, wash: null });
    P.line([[bx - 9, oy2 + 3.5], [bx - 3, oy2 + 3.5]], 0.6, 0.5); P.line([[bx + 3, oy2 + 3.5], [bx + 9, oy2 + 3.5]], 0.6, 0.5);
    const mx = bx + bw * 0.28, my = paneY[0] + (paneY[1] - paneY[0]) * 0.3;
    P.raw('<ellipse cx="' + f1(mx) + '" cy="' + f1(my) + '" rx="' + f1(bw * 0.3) + '" ry="' + f1((paneY[1] - paneY[0]) * 0.14) + '" fill="#f6ecc0" fill-opacity=".4" filter="url(#rag)" style="mix-blend-mode:screen"/>'); }
  // the print shop: small cards standing in rows in the display case, and a crack of lamplight at the door
  { const cx0 = fx(sa) + 10, cx1 = fx(sb) - 10, cy0 = paneY[0] + 8, ch = paneY[1] - paneY[0] - 22;
    P.part(box(cx0 - 5, cy0 - 5, cx1 - cx0 + 10, ch + 10), { tone: () => 0.34, layers: [hatch(0, 1.4, 1.0, 0.08, 1.6)], seed: 2831, fill: CARD, halo: 0.5, outline: 1.0, wash: [WASH.wood2, 0.7] });
    const rows = portrait ? 2 : 1, per = 5, cw = (cx1 - cx0) / per;
    for (let r2 = 0; r2 < rows; r2++) for (let i = 0; i < per; i++) { const x = cx0 + i * cw + cw * 0.22, y = cy0 + 2 + r2 * (ch / 2 + 3), w = cw * 0.5, h = ch / 2 - 6;
      P.part([[x, y + h, 1], [x + w * 0.14, y, 1], [x + w * 0.9, y + h * 0.1, 1], [x + w * 0.8, y + h, 1]], { tone: () => 0.09, layers: [hatch(-14, 2.0, 0.8, 0.05, 1.6)], seed: 2832 + r2 * per + i, fill: PAPER, halo: 0.4, outline: 0.7, wash: null });
      P.line([[x + w * 0.24, y + h * 0.34], [x + w * 0.7, y + h * 0.36]], 0.5, 0.45); P.line([[x + w * 0.24, y + h * 0.6], [x + w * 0.62, y + h * 0.62]], 0.5, 0.4); }
    const dx0 = fx(da), dx1 = fx(db), dt = fy(2.05), dbm = fy(0.3);
    P.part(box(dx0 - 3, dt - 3, dx1 - dx0 + 6, dbm - dt + 3), { tone: () => 0.36, layers: [hatch(90, 1.6, 1.1, 0.08, 1.6)], seed: 2840, fill: CARD, halo: 0, outline: 1.0, wash: [WASH.wood2, 0.75] });
    P.part(box(dx0, dt, dx1 - dx0, dbm - dt), { tone: (x, y) => clamp(0.38 + 0.2 * sstep(dx0, dx1, x)), layers: [hatch(90, 1.6, 1.2, 0.08, 1.8), hatch(18, 2.6, 0.8, 0.5)], seed: 2841, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
    P.line([[dx0 + 1.5, dt + 4], [dx0 + 1.5, dbm - 2]], 1.6, 0.85, '#e9d9a4'); }
  // ---------------------------------------------------------------- the street: snow over the cobbles, a fresh slide-track, and the falling snow over it all
  P.part([[-20, base - 2], [W + 20, base - 2], [W + 20, H + 10], [-20, H + 10]], { tone: (x, y) => Math.min(0.9, clamp(0.52 - 0.3 * pool(x, y, glowC, D.reach * 1.6, 0.8) - 0.3 * pool(x, y, glowD, D.reach * 1.6, 0.8) + 0.12 * (vnoise(x * 0.04, y * 0.14, 9) - 0.5) + 0.1 * sstep(base, H, y))), layers: [hatch(0.6, 3.2 * K, 1.0, 0.1, 2.6, { wob: 0.5 }), hatch(-33, 5.2 * K, 0.8, 0.5)], seed: 2850, fill: CARD, halo: 0, outline: 0, wash: [SNOW, 0.65] });
  { const r = rng(85); for (let i = 0; i < (portrait ? 26 : 38); i++) { const y = base + 4 + Math.pow(r(), 0.8) * (H - base - 14), t = (y - vy) / hs, x = r() * W, s = 0.5 + 2.2 * t * (0.6 + r() * 0.6);
      P.part(cr([[x - 9 * s, y, 1], [x - 5 * s, y - 3 * s], [x + 6 * s, y - 3.4 * s], [x + 10 * s, y, 1], [x + 4 * s, y + 2.6 * s], [x - 6 * s, y + 2.4 * s]], true, 4), { tone: (px, py) => clamp(0.42 + 0.2 * sstep(x - 9 * s, x + 10 * s, px) + 0.2 * tone(px, py)), layers: [hatch(0, 1.6, 0.9, 0.1, 1.8)], seed: 2851 + i, fill: CARD, halo: 0, outline: 0.7, wash: [STONE, 0.4] }); } }
  { const t0 = [portrait ? 199 : 545, portrait ? 592 : 262], t1 = [portrait ? 185 : 507, portrait ? 580 : 248];
    for (const [k, d] of [[0, 0], [1, 3.2], [2, -2.6]]) { const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6, x = t0[0] + (t1[0] - t0[0]) * t + d * (portrait ? 1 : 0.8), y = t0[1] + (t1[1] - t0[1]) * t + 2.4 * Math.sin(Math.PI * t) + (k % 2) * 1.2; pts.push([x, y]); } P.line(pts, 1.4, 0.5); }
    const r = rng(87); for (let i = 0; i < 5; i++) { const t = r(), x = t0[0] + (t1[0] - t0[0]) * t, y = t0[1] + (t1[1] - t0[1]) * t; P.line([[x - 4, y + 3], [x + 4, y + 3.6]], 1.0, 0.4); } }
  { const r = rng(89); const n = portrait ? 30 : 44; for (let i = 0; i < n; i++) { const x = r() * W, y = (portrait ? 150 : 40) + r() * (H - (portrait ? 150 : 40)), l = 1.6 + r() * 2.4, o = 0.3 + r() * 0.45;
      P.line([[x, y], [x + 1.2, y + l]], 1.0, o, SNOW); } }
  // ---------------------------------------------------------------- the warm glow of the two windows
  glow(P, glowC[0], glowC[1] + 26, portrait ? 74 : 68, portrait ? 62 : 56, 0.72);
  glow(P, glowD[0], glowD[1] + 26, portrait ? 70 : 64, portrait ? 58 : 52, 0.66);
  const keys = {
    window: portrait ? [fx(ba) + 4, paneY[0] + 3, 60, 15] : [fx(ba) + 2, paneY[0] + 3, 88, 15],
    mist: portrait ? [fx(ba) + 30, paneY[0] + 6, 28, 13] : [fx(ba) + 36, paneY[0] + 6, 50, 13],
    case: portrait ? [fx(sa) + 10, paneY[0] + 8, fx(sb) - fx(sa) - 20, 12] : [fx(sa) + 15, paneY[0] + 8, 100, 12],
    pier: portrait ? [fx(pb) - 14, paneY[0] + 3, 9, 15] : [fx(pa) + 16, paneY[0] + 3, fx(pb) - fx(pa) - 30, 15],
    track: portrait ? [184, 570, 16, 18] : [508, 236, 34, 16],
  };
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], lamp: glowC, layers: {}, keys, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
