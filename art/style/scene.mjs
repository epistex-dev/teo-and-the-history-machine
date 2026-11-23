// Chapter 1 records office ("Phòng Hồ sơ Cực Bắc") at night: wall of archive drawers, a snowy window, the ceiling loudspeaker and a plank floor
// in one-point perspective. Characters and the machine are separate sprites; the scene only holds the empty room.
import { clamp, mix, sstep, f1, cr, ellipse, vnoise, rng, engrave, family, fanLines, bbox, inside, ink, paper, hatchRegion } from './lib.mjs';
import { Plate, gauss, WASH } from './draw.mjs';
import { CARD, hatch, box, hash, pool, floor, glow } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';

export const LAYOUT = LAYOUTS['ch1-office'];

export function scene(orientation = 'portrait') {
  const L = LAYOUT[orientation], [W, H] = L.size, [vx, vy] = L.vp, hy = L.wall, portrait = orientation === 'portrait';
  const P = new Plate(51);
  // light: a warm pool from the machine's dial side, cool moonlight from the window, dark corners (one tone for the whole plate)
  const lamp = portrait ? [250, 430] : [634, 168], moon = portrait ? [76, 290] : [130, 100];
  const tone = (x, y) => {
    const dl = Math.hypot((x - lamp[0]) * 0.8, y - lamp[1]), dm = Math.hypot(x - moon[0], (y - moon[1]) * 0.8);
    const light = 1 / (1 + Math.pow(dl / (portrait ? 150 : 170), 2)) + 0.3 / (1 + Math.pow(dm / 90, 2));
    const vig = sstep(portrait ? 230 : 420, portrait ? 480 : 760, Math.hypot((x - W / 2) * (portrait ? 1.1 : 0.9), (y - (portrait ? 430 : 200)) * 0.8)) * 0.34;
    return clamp(0.66 - 0.6 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 3) - 0.5));
  };
  const win = portrait ? [20, 150, 100, 190] : [70, 40, 120, 140], dr = portrait ? [124, 148, 112, 238] : [350, 90, 108, 120];
  // the wall is open paper near the hanging lamp and the window and only gets hatched as it falls away from them
  const pendant = portrait ? [300, 168] : [470, 78], glass = [win[0] + win[2] / 2, win[1] + win[3] * 0.45], pool = (x, y, c, r, k) => 1 / (1 + Math.pow(Math.hypot((x - c[0]) * k, y - c[1]) / r, 2));
  const sides = (x) => sstep(W * 0.24, W * 0.5, Math.abs(x - W / 2));
  const wallTone = (x, y) => {
    const light = Math.min(1, pool(x, y, pendant, portrait ? 80 : 110, 0.9) + 0.7 * pool(x, y, glass, portrait ? 70 : 70, 0.8) + 0.45 * pool(x, y, lamp, portrait ? 90 : 110, 0.8));
    const t = clamp(0.7 - 0.8 * light + 0.9 * (tone(x, y) - 0.66 + 0.6 * (1 / (1 + Math.pow(Math.hypot((x - lamp[0]) * 0.8, y - lamp[1]) / (portrait ? 150 : 170), 2)))));
    return Math.min(t, 0.55 - 0.15 * sides(x)) * (1 - 0.3 * sides(x));
  };
  // ---------------------------------------------------------------- back wall
  const wallBox = box(0, 0, W, hy);
  P.part(wallBox, { tone: wallTone, layers: [hatch(88, 3.3, 0.95, 0.06, 2.4, { wob: 0.4 }), hatch(30, 4, 0.8, 0.42, 2.4)], seed: 601, fill: paper, halo: 0, outline: 0, wash: null });
  P.raw('<rect x="0" y="0" width="' + W + '" height="' + hy + '" fill="' + WASH.sky + '" fill-opacity=".34" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  // wainscot: vertical boards under a rail
  const rail = hy - (portrait ? 92 : 56);
  P.part(box(0, rail, W, hy - rail), { tone: (x, y) => clamp(tone(x, y) * 0.8 + 0.22 + 0.16 * hash(Math.floor(x / (portrait ? 26 : 30)), 1)), layers: [hatch(90, 2.2, 1.5, 0.06, 2.2, { wob: 0.3 }), hatch(25, 3, 1.0, 0.58)], seed: 602, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.56] });
  for (let x = portrait ? 26 : 30; x < W; x += portrait ? 26 : 30) P.line([[x, rail + 4], [x, hy]], 0.9, 0.9);
  P.part(box(0, rail - 7, W, 9), { tone: (x, y) => clamp(0.34 + 0.2 * (1 - tone(x, y))), layers: [hatch(0, 1.5, 1.2, 0.08)], seed: 603, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood, 0.6] });
  // ---------------------------------------------------------------- window with snow night
  const [wx, wy, ww, wh] = win;
  const frame = cr([[wx - 8, wy + wh + 10, 1], [wx - 8, wy + 36, 1], [wx + ww / 2, wy - 8, 1], [wx + ww + 8, wy + 36, 1], [wx + ww + 8, wy + wh + 10, 1]], true, 3);
  P.part(frame, { tone: (x, y) => clamp(0.4 + 0.3 * sstep(wx, wx + ww, x)), layers: [hatch(90, 2, 1.4, 0.08), hatch(20, 2.8, 1, 0.55)], seed: 604, fill: CARD, halo: 0, outline: 1.4, wash: [WASH.wood, 0.58] });
  const pane = cr([[wx, wy + wh, 1], [wx, wy + 38, 1], [wx + ww / 2, wy + 2, 1], [wx + ww, wy + 38, 1], [wx + ww, wy + wh, 1]], true, 3);
  const moonC = [wx + ww * 0.7, wy + 56];
  P.part(pane, { tone: (x, y) => clamp(0.82 - 0.7 * gauss(Math.hypot(x - moonC[0], y - moonC[1]), 0, 20) + 0.14 * sstep(wy + 60, wy + wh, y) * -1), layers: [hatch(-30, 1.7, 1.45, 0.06, 1.8), hatch(40, 2.3, 1.2, 0.5), hatch(0, 3, 1.0, 0.7)], seed: 605, fill: '#cfd8dc', halo: 0, outline: 1.3, wash: [WASH.sky, 0.78] });
  const r = rng(77);
  for (let i = 0; i < 46; i++) { const x = wx + 4 + r() * (ww - 8), y = wy + 6 + r() * (wh - 12); P.raw('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(0.9 + r() * 1.3) + '" fill="' + CARD + '" fill-opacity=".92"/>'); }
  P.raw('<circle cx="' + f1(moonC[0]) + '" cy="' + f1(moonC[1]) + '" r="14" fill="' + CARD + '"/><path d="M' + f1(moonC[0] - 14) + ' ' + f1(moonC[1]) + 'a14 14 0 0 1 28 0" fill="none" stroke="' + ink + '" stroke-width=".7"/>');
  P.raw('<circle cx="' + f1(moonC[0]) + '" cy="' + f1(moonC[1]) + '" r="20" fill="' + WASH.glow + '" fill-opacity=".34" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  P.line([[wx + ww / 2, wy + 2], [wx + ww / 2, wy + wh]], 3.2); P.line([[wx, wy + wh * 0.56], [wx + ww, wy + wh * 0.56]], 3.2);
  P.line([[wx + ww / 2, wy + 2], [wx + ww / 2, wy + wh]], 0.8, 1, CARD);
  P.part(box(wx - 14, wy + wh + 8, ww + 28, 12), { tone: (x, y) => clamp(0.3 + 0.3 * sstep(wx, wx + ww, x)), layers: [hatch(0, 1.5, 1.2, 0.08)], seed: 606, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.6] });
  P.part(cr([[wx - 10, wy + wh + 8, 1], [wx + 14, wy + wh - 2], [wx + 48, wy + wh + 2], [wx + 90, wy + wh - 3], [wx + ww + 10, wy + wh + 8, 1]], true, 4), { tone: () => 0.06, layers: [hatch(0, 3, 0.8, 0.05)], seed: 607, fill: '#fbfbf6', halo: 0, outline: 1.0, wash: [WASH.sky2, 0.32] });
  // ---------------------------------------------------------------- archive wall: drawers with brass pulls and label cards
  const [dx, dy, dw, dh] = dr, cols = 4, rows = portrait ? 7 : 4;
  P.part(box(dx - 6, dy - 6, dw + 12, dh + 12), { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.25), layers: [hatch(88, 2, 1.4, 0.08), hatch(25, 2.8, 1.0, 0.55)], seed: 608, fill: CARD, halo: 0, outline: 1.6, wash: [WASH.wood2, 0.6] });
  const cw = dw / cols, rh = dh / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = dx + i * cw + 2, y = dy + j * rh + 2, w = cw - 4, h = rh - 4, sh = hash(i, j);
    P.part(box(x, y, w, h), { tone: (xx, yy) => clamp(tone(xx, yy) * 0.55 + 0.18 + 0.16 * sh + 0.14 * sstep(y + h * 0.6, y + h, yy)), layers: [hatch(90, 1.9, 1.3, 0.1, 1.8), hatch(30, 2.6, 0.9, 0.56)], seed: 620 + i * 10 + j, fill: CARD, halo: 0, outline: 0.9, wash: [WASH.wood, 0.34 + 0.2 * sh] });
    P.part(box(x + w * 0.22, y + h * 0.18, w * 0.56, h * 0.28), { tone: () => 0.1, layers: [hatch(0, 2.2, 0.6, 0.05)], seed: 700 + i * 10 + j, fill: '#f1e6c6', halo: 0, outline: 0.7, wash: null });
    P.line([[x + w * 0.3, y + h * 0.32], [x + w * 0.7, y + h * 0.32]], 0.5, 0.7);
    P.raw('<ellipse cx="' + f1(x + w / 2) + '" cy="' + f1(y + h * 0.72) + '" rx="' + f1(w * 0.14) + '" ry="' + f1(Math.max(1.6, h * 0.07)) + '" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".8"/>');
    if (sh > 0.7) P.raw('<ellipse cx="' + f1(x + w / 2) + '" cy="' + f1(y + h * 0.72) + '" rx="' + f1(w * 0.14) + '" ry="' + f1(Math.max(1.6, h * 0.07)) + '" fill="' + WASH.brass + '" fill-opacity=".8" style="mix-blend-mode:multiply"/>');
  }
  // ---------------------------------------------------------------- ceiling loudspeaker on its bracket
  const [sx, sy] = portrait ? [300, 126] : [470, 36];
  P.line([[sx, portrait ? 40 : 0], [sx, sy - 24]], 1.6);
  P.part(cr([[sx - 16, sy - 24, 1], [sx + 16, sy - 24, 1], [sx + 10, sy - 6, 1], [sx - 10, sy - 6, 1]], true, 3), { tone: () => 0.4, layers: [hatch(80, 1.6, 1.2, 0.1)], seed: 640, fill: '#e9d9a4', halo: 0, outline: 1.2, wash: [WASH.brass, 0.8] });
  const horn = cr([[sx - 7, sy - 6, 1], [sx - 9, sy + 14], [sx - 20, sy + 32], [sx - 42, sy + 46, 1], [sx + 42, sy + 46, 1], [sx + 20, sy + 32], [sx + 9, sy + 14], [sx + 7, sy - 6, 1]], true, 5);
  P.part(horn, { tone: (x, y) => clamp(0.3 + 0.5 * sstep(sx - 30, sx + 34, x) - 0.25 * gauss(x, sx - 14, 6) * gauss(y, sy + 24, 14)), layers: [hatch(80, 1.6, 1.4, 0.08), hatch(25, 2.3, 1, 0.52)], seed: 641, fill: '#e9d9a4', halo: 1.6, outline: 1.3, wash: [WASH.brass, 0.85] });
  P.part(ellipse(sx, sy + 46, 42, 7.5, 32), { tone: (x) => clamp(0.8 - 0.1 * sstep(sx - 30, sx + 30, x)), layers: [hatch(0, 1.4, 1.2, 0.1)], seed: 642, fill: '#4d3a22', halo: 0, outline: 1.3, wash: null });
  P.line(cr([[sx - 40, sy + 49], [sx, sy + 54], [sx + 40, sy + 49]], false, 5), 1.2, 0.9);
  for (let i = 0; i < 3; i++) P.line(cr([[sx - 8 - i * 10, sy + 10 + i * 10], [sx, sy + 14 + i * 10 + 2], [sx + 8 + i * 10, sy + 10 + i * 10]], false, 4), 0.5, 0.6);
  // ---------------------------------------------------------------- plank floor
  floor(P, { W, H, hy, vp: L.vp, bw: portrait ? 58 : 70, tone, seed: 900 });
  // skirting board where the floor meets the wall
  P.part(box(0, hy - 8, W, 10), { tone: (x, y) => clamp(0.44 + 0.2 * tone(x, y)), layers: [hatch(0, 1.4, 1.3, 0.08)], seed: 660, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.wood2, 0.7] });
  // ---------------------------------------------------------------- writing desk in front of the machine: the letter, the cup and the lantern stand on it
  { const top = portrait ? [[92, 650], [218, 650], [208, 568], [102, 568]] : [[478, 306], [600, 306], [590, 240], [490, 240]];
    const fx0 = top[0][0], fx1 = top[1][0], fyF = top[0][1], backY = top[3][1], apronH = portrait ? 26 : 24, legW = portrait ? 10 : 11, foot = portrait ? 706 : 356;
    P.part(top, { tone: (x, y) => clamp(0.16 + 0.13 * sstep(fyF, backY, y) - 0.1 * pool(x, y, portrait ? [250, 430] : [634, 168], portrait ? 130 : 150, 0.9) + 0.08 * (vnoise(x * 0.05, y * 0.08, 7) - 0.5)), layers: [hatch(0, 1.6, 1.3, 0.12, 2.1), hatch(90, 2.8, 0.5, 0.5)], seed: 670, fill: CARD, halo: 1.2, outline: 1.3, wash: [WASH.wood, 0.32] });
    P.part(box(fx0, fyF, fx1 - fx0, apronH), { tone: (x) => clamp(0.34 + 0.2 * sstep(fx0, fx1, x)), layers: [hatch(90, 2, 1.1, 0.1), hatch(0, 2.6, 0.7, 0.5)], seed: 671, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.wood2, 0.66] });
    for (const lx of [fx0 + 2, fx1 - legW - 2]) P.part(box(lx, fyF + apronH, legW, foot - fyF - apronH), { tone: () => clamp(0.4), layers: [hatch(90, 1.8, 1.0, 0.1)], seed: 672 + lx, fill: CARD, halo: 0, outline: 1.1, wash: [WASH.wood2, 0.7] });
    for (const t of [0.38, 0.66]) { const dx2 = fx0 + (fx1 - fx0) * t; P.line([[dx2, fyF + 4], [dx2, fyF + apronH - 4]], 0.7, 0.8); P.raw('<circle cx="' + f1(fx0 + (fx1 - fx0) * (t - 0.14)) + '" cy="' + f1(fyF + apronH / 2) + '" r="1.5" fill="#e9d9a4" stroke="' + ink + '" stroke-width=".5"/>'); }
  }
  // ---------------------------------------------------------------- stool beside the desk: where the script seats Teo (seat one sit-height above the ground line 622 / 274)
  { const [sx0, sy0] = portrait ? [44, 530] : [400, 196];
    P.part(box(sx0, sy0, 40, 7), { tone: (x) => clamp(0.26 + 0.3 * sstep(sx0, sx0 + 40, x)), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 676, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.7] });
    for (const lx of [sx0 + 3, sx0 + 30]) P.part(box(lx, sy0 + 7, 7, portrait ? 85 : 71), { tone: (x) => clamp(0.32 + 0.25 * sstep(lx, lx + 7, x)), layers: [hatch(90, 2, 1.2, 0.1)], seed: 677 + lx, fill: CARD, halo: 0.5, outline: 1, wash: [WASH.wood2, 0.8] });
    P.line([[sx0, sy0 + 5], [sx0 + 40, sy0 + 4]], 0.8, 0.8);
  }
  // ---------------------------------------------------------------- glow washes (warm pool, cool window light)
  glow(P, lamp[0], lamp[1], portrait ? 190 : 250, portrait ? 190 : 150);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], keys: { desk: portrait ? [92, 568, 126, 82] : [478, 240, 122, 66] }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
