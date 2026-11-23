// Chapter 2 banquet hall (Saturnalia, Rome, 17 December): painted red wall, fluted columns, an arched night window, hanging oil lamps and a long table
// with a row of candles and wax tapers; flagstone floor in one-point perspective. The host is never drawn.
import { clamp, mix, sstep, f1, cr, ellipse, vnoise, rng, ink } from './lib.mjs';
import { Plate, gauss, WASH, limb, blobTone } from './draw.mjs';
import { CARD, hatch, box, hash, pool, floor, glow, candle, flame } from './room.mjs';
import { LAYOUTS } from './layouts.mjs';

const WALL_RED = '#b8362b', WALL_DEEP = '#5b1a1a', STONE = '#cfd0c4';

// design of both orientations: (x, y, w, h) boxes and table rows; columns and windows are exported so a test can check Quạ Đồn's perch against them
const DESIGN = {
  portrait: { cols: [30, 162], colW: 44, colTop: 40, win: [66, 118, 70, 210], panel: [216, 118, 150, 200], lamp: [296, 40], lamp2: [110, 70], table: [446, 474, 528], candles: [[26, 54, 8], [92, 46, 7], [128, 38, 6], [156, 50, 7], [188, 42, 6]], tapers: [[160, 100], [380, 96]], bowls: [44, 126, 214, 330], bowlY: 462 },
  landscape: { cols: [30, 372], colW: 42, colTop: 24, win: [74, 36, 90, 128], panel: [772, 50, 90, 120], lamp: [470, 20], lamp2: [330, 26], table: [168, 184, 214], candles: [[330, 40, 7], [364, 54, 8], [404, 44, 7], [436, 38, 6], [470, 52, 8], [504, 40, 6], [338, 30, 6]], tapers: [[420, 70], [868, 66]], bowls: [118, 300, 450], bowlY: 178 },
};

export function feast(orientation = 'portrait') {
  const L = LAYOUTS['ch2-feast'][orientation], [W, H] = L.size, hy = L.wall, portrait = orientation === 'portrait', D = DESIGN[orientation];
  const P = new Plate(52);
  const lamps = [D.lamp, D.lamp2].map(([x, y]) => [x, y + (portrait ? 118 : 70)]);
  const [tb, tf, ta] = D.table;
  const row = D.candles.map(([x]) => x), rowC = [row.reduce((a, b) => a + b, 0) / row.length, tb - 8];
  const tone = (x, y) => {
    const light = Math.min(1, pool(x, y, rowC, portrait ? 190 : 200, 0.8) + 0.8 * pool(x, y, lamps[0], 90, 0.9) + 0.4 * pool(x, y, lamps[1], 70, 0.9));
    const vig = sstep(portrait ? 230 : 420, portrait ? 520 : 780, Math.hypot((x - W / 2) * (portrait ? 1.1 : 0.9), (y - (portrait ? 460 : 190)) * 0.8)) * 0.3;
    return clamp(0.66 - 0.6 * light + vig + 0.06 * (vnoise(x * 0.04, y * 0.04, 5) - 0.5));
  };
  const sides = (x) => sstep(W * 0.24, W * 0.5, Math.abs(x - W / 2));
  const wallTone = (x, y) => Math.min(tone(x, y) * 1.1 + 0.08, 0.8 - 0.1 * sides(x)) * (1 - 0.15 * sides(x));
  const obstacles = { columns: [], windows: [] };
  // ---------------------------------------------------------------- painted wall
  P.part(box(0, 0, W, hy), { tone: wallTone, layers: [hatch(2, 3.1, 0.95, 0.06, 2.4, { wob: 0.4 }), hatch(64, 4, 0.8, 0.4, 2.4)], seed: 701, fill: CARD, halo: 0, outline: 0, wash: null });
  P.raw('<rect x="0" y="0" width="' + W + '" height="' + hy + '" fill="' + WALL_RED + '" fill-opacity=".5" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  P.raw('<rect x="0" y="0" width="' + W + '" height="' + (portrait ? 150 : 90) + '" fill="' + WALL_DEEP + '" fill-opacity=".3" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
  // dado: a darker band along the foot of the wall, with a ruled top
  const dado = hy - (portrait ? 64 : 40);
  P.part(box(0, dado, W, hy - dado), { tone: (x, y) => clamp(tone(x, y) * 0.7 + 0.28), layers: [hatch(0, 1.9, 1.3, 0.08, 2.2), hatch(62, 3, 0.9, 0.55)], seed: 702, fill: CARD, halo: 0, outline: 1.2, wash: [WALL_DEEP, 0.5] });
  P.line([[0, dado + 6], [W, dado + 6]], 0.7, 0.8);
  // ---------------------------------------------------------------- cornice: frieze band with dentils and garland swags
  const fh = portrait ? 34 : 22;
  P.part(box(0, 0, W, fh), { tone: (x, y) => clamp(0.3 + 0.3 * sstep(0, fh, y) * 0.4 + 0.2 * tone(x, y)), layers: [hatch(0, 1.6, 1.1, 0.08)], seed: 703, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.brass, 0.4] });
  for (let x = 6; x < W; x += 13) P.part(box(x, fh - 11, 7, 8), { tone: () => 0.45, layers: [hatch(90, 1.5, 0.9, 0.1, 1.6)], seed: 704 + x, fill: CARD, halo: 0, outline: 0.7, wash: null });
  const hooks = []; for (let x = 0; x <= W + 1; x += portrait ? 130 : 150) hooks.push(x);
  hooks.forEach((x0, i) => {
    const x1 = hooks[i + 1]; if (x1 === undefined) return;
    const sag = portrait ? 26 : 20, pts = [[x0, fh + 2], [(x0 * 3 + x1) / 4, fh + 2 + sag * 0.85], [(x0 + x1) / 2, fh + 2 + sag], [(x0 + x1 * 3) / 4, fh + 2 + sag * 0.85], [x1, fh + 2]];
    const t = limb(pts, [9, 11, 12, 11, 9], 8, true);
    P.part(t.outline, { tone: (x, y) => clamp(0.3 + 0.2 * tone(x, y)), layers: [hatch(70, 1.5, 0.9, 0.08, 1.6)], seed: 720 + i, fill: CARD, halo: 0.8, outline: 0.9, wash: [WASH.coat, 0.78] });
    for (let k = 1; k < 7; k++) { const c = t.center[Math.floor((k / 7) * (t.center.length - 1))]; P.raw('<circle cx="' + f1(c[0] + (k % 2 ? 2 : -2)) + '" cy="' + f1(c[1] + 4) + '" r="2" fill="' + WASH.cap + '" stroke="' + ink + '" stroke-width=".5"/>'); }
  });
  // ---------------------------------------------------------------- arched window onto the night
  { const [wx, wy, ww, wh] = D.win; obstacles.windows.push([wx - 8, wy - 8, ww + 16, wh + 18]);
    const arch = (x0, y0, w, h, r) => cr([[x0, y0 + h, 1], [x0, y0 + r, 1], [x0 + w * 0.06, y0 + r * 0.4], [x0 + w * 0.26, y0 + r * 0.06], [x0 + w / 2, y0], [x0 + w * 0.74, y0 + r * 0.06], [x0 + w * 0.94, y0 + r * 0.4], [x0 + w, y0 + r, 1], [x0 + w, y0 + h, 1]], true, 4);
    P.part(arch(wx - 8, wy - 8, ww + 16, wh + 18, ww * 0.55), { tone: (x, y) => clamp(0.34 + 0.3 * sstep(wx, wx + ww, x)), layers: [hatch(90, 2, 1.4, 0.08), hatch(20, 2.8, 1, 0.55)], seed: 730, fill: CARD, halo: 0, outline: 1.4, wash: [STONE, 0.7] });
    const pane = arch(wx, wy, ww, wh, ww * 0.5), mc = [wx + ww * 0.68, wy + wh * 0.3];
    P.part(pane, { tone: (x, y) => clamp(0.82 - 0.7 * gauss(Math.hypot(x - mc[0], y - mc[1]), 0, 18)), layers: [hatch(-30, 1.7, 1.45, 0.06, 1.8), hatch(40, 2.3, 1.2, 0.5), hatch(0, 3, 1.0, 0.7)], seed: 731, fill: '#cfd8dc', halo: 0, outline: 1.3, wash: [WASH.sky, 0.78] });
    const r = rng(78);
    for (let i = 0; i < 28; i++) { const x = wx + 5 + r() * (ww - 10), y = wy + 14 + r() * (wh - 24); P.raw('<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="' + f1(0.8 + r() * 1.1) + '" fill="' + CARD + '" fill-opacity=".92"/>'); }
    P.raw('<circle cx="' + f1(mc[0]) + '" cy="' + f1(mc[1]) + '" r="11" fill="' + CARD + '"/><path d="M' + f1(mc[0] - 11) + ' ' + f1(mc[1]) + 'a11 11 0 0 1 22 0" fill="none" stroke="' + ink + '" stroke-width=".7"/>');
    P.raw('<circle cx="' + f1(mc[0]) + '" cy="' + f1(mc[1]) + '" r="17" fill="' + WASH.glow + '" fill-opacity=".34" filter="url(#rag)" style="mix-blend-mode:multiply"/>');
    P.line([[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], 2.4);
    P.part(box(wx - 12, wy + wh + 6, ww + 24, 9), { tone: () => 0.35, layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 732, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] }); }
  // ---------------------------------------------------------------- painted panel on the right wall: a framed field with a laurel border
  { const [px, py, pw, ph] = D.panel;
    P.part(box(px, py, pw, ph), { tone: (x, y) => clamp(wallTone(x, y) * 0.9 + 0.2), layers: [hatch(0, 2.2, 1.0, 0.1, 2), hatch(62, 3, 0.8, 0.5)], seed: 740, fill: CARD, halo: 0, outline: 1.4, wash: [WALL_DEEP, 0.55] });
    P.part(box(px + 7, py + 7, pw - 14, ph - 14), { tone: () => 0.06, layers: [hatch(0, 3, 0.5, 0.05)], seed: 741, fill: null, halo: 0, outline: 0.8, wash: null });
    { const ax = px + pw / 2, ay = py + ph / 2 + 6, s2 = Math.min(pw, ph) / 130;
      const body = cr([[ax - 8 * s2, ay - 40 * s2, 1], [ax + 8 * s2, ay - 40 * s2, 1], [ax + 7 * s2, ay - 30 * s2], [ax + 24 * s2, ay - 8 * s2], [ax + 20 * s2, ay + 22 * s2], [ax + 6 * s2, ay + 40 * s2], [ax + 8 * s2, ay + 46 * s2, 1], [ax - 8 * s2, ay + 46 * s2, 1], [ax - 6 * s2, ay + 40 * s2], [ax - 20 * s2, ay + 22 * s2], [ax - 24 * s2, ay - 8 * s2], [ax - 7 * s2, ay - 30 * s2]], true, 5);
      P.part(body, { tone: (x) => clamp(0.25 + 0.5 * sstep(ax - 22 * s2, ax + 24 * s2, x)), layers: [hatch(82, 1.7, 1.1, 0.08, 1.8)], seed: 742, fill: '#e9d9a4', halo: 0, outline: 1.1, wash: [WASH.brass, 0.7] });
      for (const sg of [-1, 1]) P.line(cr([[ax + sg * 7 * s2, ay - 36 * s2], [ax + sg * 20 * s2, ay - 38 * s2], [ax + sg * 22 * s2, ay - 20 * s2]], false, 4), 1.4); }
    const nl = Math.floor((pw - 24) / 11);
    for (let i = 0; i <= nl; i++) for (const y of [py + 14, py + ph - 14]) P.raw('<path d="M' + f1(px + 12 + i * 11) + ' ' + f1(y) + 'q4 -5 8 0q-4 5 -8 0z" fill="' + WASH.coat + '" fill-opacity=".8" stroke="' + ink + '" stroke-width=".5" style="mix-blend-mode:multiply"/>'); }
  // ---------------------------------------------------------------- fluted columns
  D.cols.forEach((cx, ci) => {
    const w = D.colW, top = D.colTop, bot = hy, x0 = cx - w / 2; obstacles.columns.push([x0 - 4, top - 6, w + 8, bot - top + 6]);
    const shaft = box(x0 + 3, top + 14, w - 6, bot - top - 26);
    P.part(shaft, { tone: (x, y) => clamp(0.2 + 0.5 * sstep(x0 + 8, x0 + w, x) + 0.3 * (1 - pool(x, y, rowC, 220, 0.6))), layers: [hatch(90, 2.1, 1.25, 0.08, 2.2), hatch(24, 3, 0.8, 0.6)], seed: 750 + ci, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.6] });
    for (let k = 1; k < 6; k++) P.line([[x0 + 3 + (k * (w - 6)) / 6, top + 14], [x0 + 3 + (k * (w - 6)) / 6, bot - 12]], 0.45, 0.7);
    P.part(box(x0 - 3, top, w + 6, 14), { tone: (x) => clamp(0.3 + 0.4 * sstep(x0, x0 + w, x)), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 760 + ci, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
    P.raw('<circle cx="' + f1(x0 + 1) + '" cy="' + f1(top + 7) + '" r="5" fill="' + CARD + '" stroke="' + ink + '" stroke-width="1"/><circle cx="' + f1(x0 + w - 1) + '" cy="' + f1(top + 7) + '" r="5" fill="' + CARD + '" stroke="' + ink + '" stroke-width="1"/>');
    P.part(box(x0 - 4, bot - 12, w + 8, 12), { tone: (x) => clamp(0.35 + 0.4 * sstep(x0, x0 + w, x)), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 770 + ci, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.7] });
  });
  // ---------------------------------------------------------------- hanging bronze oil lamps
  D.lamp && [D.lamp, D.lamp2].forEach(([lx, ly], i) => {
    const s = i === 0 ? 1 : 0.8, ly0 = ly + (portrait ? 70 : 38) * s; P.line([[lx, fh], [lx, ly0]], 1.1);
    const bowl = cr([[lx - 26 * s, ly0 + 14 * s, 1], [lx - 22 * s, ly0 + 26 * s], [lx, ly0 + 34 * s], [lx + 22 * s, ly0 + 26 * s], [lx + 26 * s, ly0 + 14 * s, 1]], true, 5);
    P.part(bowl, { tone: (x) => clamp(0.3 + 0.5 * sstep(lx - 24 * s, lx + 24 * s, x)), layers: [hatch(70, 1.4, 1.2, 0.08)], seed: 780 + i, fill: '#e9d9a4', halo: 0.8, outline: 1.2, wash: [WASH.brass, 0.85] });
    P.line([[lx - 26 * s, ly0 + 14 * s], [lx, ly0 + 8 * s], [lx + 26 * s, ly0 + 14 * s]], 1.0);
    for (const sx of [-22, 22]) { P.line([[lx + sx * s, ly0 + 14 * s], [lx + sx * s * 1.3, ly0 + 8 * s]], 2.2); flame(P, lx + sx * s * 1.3, ly0 + 7 * s, 13 * s, 790 + i * 3 + (sx > 0 ? 1 : 0)); }
    P.line([[lx, ly0 + 8 * s], [lx, ly0 + 2 * s]], 1.2); flame(P, lx, ly0 + 2 * s, 15 * s, 795 + i);
  });
  // ---------------------------------------------------------------- floor (flagstones)
  floor(P, { W, H, hy, vp: L.vp, bw: portrait ? 82 : 96, tone, seed: 1100, wash: [STONE, 0.55], joint: { min: 0.22, spread: 0.45 }, grain: 0.6, grid: 1.1, shadowLo: 0.4 });
  P.part(box(0, hy - 6, W, 8), { tone: (x, y) => clamp(0.4 + 0.2 * tone(x, y)), layers: [hatch(0, 1.4, 1.2, 0.08)], seed: 790, fill: CARD, halo: 0, outline: 1.2, wash: [STONE, 0.8] });
  // ---------------------------------------------------------------- the guests: seated Romans behind the table, in front of the dado
  const guests = [], guestsAt = portrait ? [30, 161, 262] : [90, 350, 800], guestR = (cx, s, seed) => {
    const hc = [cx, tb - 46 * s], hr = 13 * s, shY = hc[1] + hr * 1.35;
    P.part(ellipse(cx, hc[1], hr, hr * 1.08, 14), { tone: (x) => clamp(0.34 + 0.28 * sstep(cx - hr, cx + hr, x)), layers: [hatch(60, 1.5, 0.8, 0.12, 1.6)], seed, fill: CARD, halo: 0.5, outline: 1.0, wash: [WASH.coat, 0.5] });
    const torso = cr([[cx - 17 * s, tb + 6, 1], [cx - 15 * s, shY + 4], [cx - 8 * s, shY], [cx + 8 * s, shY], [cx + 15 * s, shY + 4], [cx + 17 * s, tb + 6, 1]], true, 4);
    P.part(torso, { tone: (x, y) => clamp(0.32 + 0.35 * (1 - pool(x, y, rowC, 200, 0.7)) + 0.1 * sstep(shY, tb, y)), layers: [hatch(80, 1.7, 0.9, 0.1, 1.8), hatch(30, 2.4, 0.7, 0.5)], seed: seed + 1, fill: CARD, halo: 0.5, outline: 1.1, wash: [WASH.cap, 0.68] });
    for (const k of [-0.5, 0, 0.5]) P.line(cr([[cx + k * 9 * s, shY + 3], [cx + k * 10 * s, shY + 14 * s], [cx + k * 7 * s, tb - 4]], false, 3), 0.5, 0.6);
    return [cx - 17 * s, hc[1] - hr * 1.15, 34 * s, tb + 6 - hc[1] + hr * 1.15];
  };
  guestsAt.forEach((cx, i) => guests.push(guestR(cx, portrait ? 1 : 1.15, 880 + i * 9)));
  // ---------------------------------------------------------------- long table: cloth, goblets, bowls, a row of candles and two stands of wax tapers
  P.part(box(-4, tb, W + 8, tf - tb), { tone: (x, y) => clamp(0.1 + 0.3 * (1 - pool(x, y, rowC, 200, 0.7))), layers: [hatch(0, 2.2, 0.8, 0.1)], seed: 810, fill: CARD, halo: 0, outline: 1.3, wash: [WASH.glow2, 0.2] });
  const apron = [[-4, tf, 1]]; for (let x = -4; x <= W + 4; x += 18) apron.push([x, ta - 4 + (Math.floor(x / 18) % 2 ? 5 : 0), 1], [x + 9, ta - 1]); apron.push([W + 4, tf, 1]);
  P.part(apron, { tone: (x, y) => clamp(0.18 + 0.4 * (1 - pool(x, y, rowC, 240, 0.6)) + 0.12 * (0.5 + 0.5 * Math.sin(x * 0.35)) + 0.15 * sstep(tf, ta, y)), layers: [hatch(88, 2.4, 1.2, 0.06, 2.2), hatch(20, 3.2, 0.8, 0.55)], seed: 811, fill: CARD, halo: 0, outline: 1.2, wash: [WASH.glow2, 0.18] });
  for (let x = 6; x < W; x += 20) P.line(cr([[x, tf + 2], [x + 1.5, (tf + ta) / 2], [x - 0.5, ta - 6]], false, 3), 0.5, 0.65);
  for (const px of portrait ? [76, 110, 172, 250, 290] : [74, 158, 200, 244, 486, 760, 820]) { const py = tb + (portrait ? 20 : 10);
    P.part(ellipse(px, py, 9, 3.2, 20), { tone: () => 0.32, layers: [hatch(0, 1.4, 0.8, 0.1, 1.4)], seed: 825 + px, fill: CARD, halo: 0.4, outline: 0.9, wash: [WASH.sky2, 0.25] });
    P.part(ellipse(px, py - 1.4, 5.5, 1.8, 18), { tone: () => 0.5, layers: [hatch(0, 1.3, 0.7, 0.1, 1.3)], seed: 826 + px, fill: CARD, halo: 0, outline: 0.7, wash: null });
  }
  for (const bx of D.bowls) {
    const by = D.bowlY, bw2 = portrait ? 20 : 24;
    P.part(ellipse(bx, by, bw2, 6.4, 24), { tone: () => 0.4, layers: [hatch(0, 1.6, 1, 0.1)], seed: 820 + bx, fill: '#e9d9a4', halo: 0, outline: 1.0, wash: [WASH.brass, 0.7] });
    const r2 = rng(bx); for (let i = 0; i < 5; i++) { const fx = bx + (i - 2) * 6.5 + (r2() - 0.5) * 2, fy = by - 4 - r2() * 3; P.raw('<circle cx="' + f1(fx) + '" cy="' + f1(fy) + '" r="' + f1(3.6 + r2()) + '" fill="' + CARD + '" stroke="' + ink + '" stroke-width=".7"/><circle cx="' + f1(fx + 0.8) + '" cy="' + f1(fy + 0.6) + '" r="' + f1(3.6 + r2()) + '" fill="' + [WASH.cap, WASH.glow2, WASH.coat][i % 3] + '" fill-opacity=".7" style="mix-blend-mode:multiply"/>'); }
  }
  // candles in a row along the back edge of the table, tallest in the middle of the lit stretch
  D.candles.forEach(([x, h, w], i) => candle(P, x, tb + 14, h, w, 830 + i * 7, 12 + (i % 3)));
  // two stands of wax tapers (the Saturnalia gift): a bronze jar with thin tapers leaning outward
  D.tapers.forEach(([x, h], ti) => {
    const base = tb + 18;
    for (let k = -2; k <= 2; k++) { const lean = k * 4.4; P.line([[x + k * 1.6, base - 10], [x + lean * 1.4, base - h + Math.abs(k) * 4]], 2.1, 1, ink); P.line([[x + k * 1.6 + 0.6, base - 10], [x + lean * 1.4 + 0.6, base - h + Math.abs(k) * 4]], 1.0, 1, '#f3ead0'); if (k % 2 === 0) flame(P, x + lean * 1.4, base - h + Math.abs(k) * 4 - 2, 12, 850 + ti * 9 + k + 2); }
    P.part(cr([[x - 11, base - 12, 1], [x + 11, base - 12, 1], [x + 9, base - 3], [x + 5, base + 3, 1], [x - 5, base + 3, 1], [x - 9, base - 3]], true, 4), { tone: (px) => clamp(0.3 + 0.5 * sstep(x - 10, x + 10, px)), layers: [hatch(70, 1.4, 1.1, 0.08)], seed: 860 + ti, fill: '#e9d9a4', halo: 0.8, outline: 1.1, wash: [WASH.brass, 0.85] });
  });
  // ---------------------------------------------------------------- wooden stool in front of the table: where the script seats Teo (seat one sit-height above the ground line 622 / 274, under Teo's default x)
  { const [sx0, sy0] = portrait ? [78, 530] : [230, 196];
    P.part(box(sx0, sy0, 40, 7), { tone: (x) => clamp(0.24 + 0.3 * sstep(sx0, sx0 + 40, x)), layers: [hatch(0, 1.5, 1.1, 0.08)], seed: 806, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.wood2, 0.7] });
    for (const lx of [sx0 + 3, sx0 + 30]) P.part(box(lx, sy0 + 7, 7, portrait ? 85 : 71), { tone: (x) => clamp(0.3 + 0.25 * sstep(lx, lx + 7, x)), layers: [hatch(90, 2, 1.2, 0.1)], seed: 807 + lx, fill: CARD, halo: 0.5, outline: 1, wash: [WASH.wood2, 0.8] });
    P.line([[sx0, sy0 + 5], [sx0 + 40, sy0 + 4]], 0.8, 0.8);
  }
  // ---------------------------------------------------------------- glow of the candles and lamps
  glow(P, rowC[0], tb - 10, portrait ? 230 : 330, portrait ? 110 : 80, 0.75);
  for (const [lx, ly] of lamps) glow(P, lx, ly, 60, 50, 0.8);
  return { orientation, layout: L, plate: P, frame: [0, 0, W, H], obstacles, keys: { guests, plates: (portrait ? [76, 110, 172, 250, 290] : [74, 158, 200, 244, 486, 760, 820]).map((px) => [px - 9, tb + (portrait ? 20 : 10) - 3.2, 18, 6.4]) }, svg: (scale = 1, o = {}) => P.svg([0, 0, W, H], { scale, ...o }) };
}
