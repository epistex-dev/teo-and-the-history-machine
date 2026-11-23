// Scenery props of the plates that the script reveals mid scene: the manger with its oil lamp on the Bethlehem hillside (chapter 5), the lit patch on the
// Myra warehouse wall that holds only shadows (chapter 7), the lit patch on the Italian kitchen wall with the shadows of a broom, a threshold and a road ending in a star (chapter 10)
// and the lit square on the low boughs of the Strasbourg fir (chapter 11). Each is drawn in its own frame; the stage data places it on the plate in art pixels.
import { clamp, sstep, f1, cr, rng, vnoise, ink } from './lib.mjs';
import { WASH } from './draw.mjs';
import { CARD, hatch, pool } from './room.mjs';
import { STONE, RED, GREEN, oilLamp } from './scenery.mjs';
import { drawTree } from './parlour.mjs';

const STRAW = '#e8d7a0';

/** Engraved shadow patch: parallel strokes clipped to a silhouette over the gold light, plus a thin border. No solid fills. */
const engraved = (P, id, path, pitch, o, ang = 0) => {
  P.raw('<clipPath id="' + id + '"><path d="' + path + '"/></clipPath>');
  const m = Math.tan((ang * Math.PI) / 180), lines = [];
  for (let b = -160; b < 180; b += pitch) lines.push('<path d="M0 ' + f1(b) + 'L100 ' + f1(b + 100 * m) + '" stroke="' + ink + '" stroke-width=".55" stroke-opacity="' + o + '" fill="none"/>');
  P.raw('<g clip-path="url(#' + id + ')" filter="url(#rag)">' + lines.join('') + '</g>');
  P.raw('<path d="' + path + '" fill="none" stroke="' + ink + '" stroke-width=".8" stroke-opacity="' + Math.min(1, o + 0.08) + '" filter="url(#rag)"/>');
};
const GLOW = '<defs><radialGradient id="litglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".62"/><stop offset=".45" stop-color="#f4b447" stop-opacity=".3"/><stop offset="1" stop-color="#f0a53a" stop-opacity="0"/></radialGradient></defs>';

/** Where the lamp flame sits in the manger frame: the stage must keep this point on screen. */
export const MANGER_FLAME = [110, 56];

export function mangerLamp(P) {
  const mx = 100, yb = 100, w = 58, h = 20, x0 = mx - w / 2, x1 = mx + w / 2, lamp = [mx + w * 0.32, yb - 20];
  P.raw(GLOW + '<ellipse cx="' + f1(lamp[0] - 10) + '" cy="' + f1(lamp[1] + 4) + '" rx="78" ry="62" fill="url(#litglow)" filter="url(#rag)"/>');
  for (const sg of [-1, 1]) for (const k of [-1, 1]) P.line([[mx + sg * w * 0.34 + k * 6, yb + 8], [mx + sg * w * 0.34 - k * 6, yb - h * 0.55]], 2.2, 1);
  P.part([[x0 - 2, yb - h, 1], [x1 + 2, yb - h, 1], [x1 - 4, yb, 1], [x0 + 4, yb, 1]], { tone: (px, py) => clamp(0.3 + 0.35 * sstep(x0, x1, px) + 0.2 * (1 - pool(px, py, lamp, 60, 1))), layers: [hatch(88, 1.6, 1.2, 0.08, 1.8), hatch(20, 2.4, 0.8, 0.5)], seed: 1560, fill: CARD, halo: 0.8, outline: 1.3, wash: [WASH.wood2, 0.7] });
  for (const fx of [0.33, 0.66]) P.line([[x0 + w * fx, yb - h], [x0 + w * fx - 1.5, yb]], 0.6, 0.8);
  P.part(cr([[x0 - 1, yb - h, 1], [x0 + w * 0.2, yb - h - 8], [x0 + w * 0.5, yb - h - 12], [x0 + w * 0.8, yb - h - 8], [x1 + 1, yb - h, 1], [x0 + w * 0.5, yb - h + 4]], true, 5), { tone: () => 0.12, layers: [hatch(70, 2.2, 0.6, 0.05, 1.6)], seed: 1561, fill: STRAW, halo: 0.8, outline: 0.9, wash: [WASH.brass, 0.75] });
  const r = rng(77); for (let i = 0; i < 22; i++) { const sx = x0 + 4 + r() * (w - 8), sy = yb - h - 2 - r() * 8, a = (r() - 0.5) * 1.3; P.line([[sx, sy + 4], [sx + Math.sin(a) * 6, sy - Math.cos(a) * 4]], 0.6, 0.9); }
  oilLamp(P, x1 - 4, yb - h - 5, 0.55, 1570, 17);
}

/** The lit patch on the wall: a tall trapezoid of gold light (nearer edge on the left, as the wall runs off to the right), the shadow of a window frame across it, and below the
 * middle the shadow of one hand holding a small pouch by its cord. Shadow only: the hand is cut off by the right edge of the light, no body anywhere. */
export function windowShadow(P) {
  const X = (u) => 2 + 86 * u, top = (u) => 4 + 44 * u, bot = (u) => 206 - 42 * u, Y = (u, v) => top(u) + v * (bot(u) - top(u));
  const quad = (u0, v0, u1, v1) => [[X(u0), Y(u0, v0)], [X(u1), Y(u1, v0)], [X(u1), Y(u1, v1)], [X(u0), Y(u0, v1)]];
  const d = (pts) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
  P.raw('<defs><radialGradient id="litpatch" cx="50%" cy="48%" r="62%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".95"/><stop offset=".7" stop-color="#f4b447" stop-opacity=".82"/><stop offset="1" stop-color="#f0a53a" stop-opacity=".55"/></radialGradient></defs>');
  P.raw('<path d="' + d(quad(0, 0, 1, 1)) + '" fill="url(#litpatch)" filter="url(#rag)"/>');
  for (let v = 0.03; v < 1; v += 0.035) P.line([[X(0), Y(0, v)], [X(1), Y(1, v)]], 0.4, 0.16);
  const bars = [quad(0, 0, 1, 0.04), quad(0, 0.96, 1, 1), quad(0, 0, 0.05, 1), quad(0.95, 0, 1, 1), quad(0.47, 0, 0.53, 1), quad(0, 0.32, 1, 0.355), quad(0, 0.65, 1, 0.685)];
  for (const b of bars) P.raw('<path d="' + d(b) + '" fill="' + ink + '" fill-opacity=".82" filter="url(#rag)"/>');
  const hand = 'M92 150 L92 124 L66 119 L56 113 C50 106 44 100 38 99 C32 99 30 104 33 109 C27 111 26 118 31 121 C27 125 29 131 35 132 C36 138 42 140 47 137 L62 140 Z';
  P.raw('<path d="' + hand + '" fill="' + ink + '" fill-opacity=".9" filter="url(#rag)"/>');
  P.raw('<path d="M36 134 Q34 150 33 156" stroke="' + ink + '" stroke-opacity=".9" stroke-width="1.1" fill="none"/>');
  P.raw('<path d="M33 154 C24 158 21 172 26 180 C31 186 41 186 46 180 C50 171 44 158 35 154 Z" fill="' + ink + '" fill-opacity=".9" filter="url(#rag)"/>');
  P.raw('<path d="M27 158 L40 159" stroke="' + CARD + '" stroke-opacity=".45" stroke-width=".8"/>');
}

/** The lit patch on the kitchen wall (100 x 170): a tall rectangle of gold light and in it only shadows: a threshold with its two posts at the foot, a broom leaning on the left, a road that
 * narrows to the top, and one star where the road ends. Nobody on the road, nothing at its end but the star. */
export function kitchenShadows(P) {
  const d = (pts) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join('L') + 'Z';
  P.raw('<defs><radialGradient id="litkitchen" cx="50%" cy="52%" r="64%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".95"/><stop offset=".7" stop-color="#f4b447" stop-opacity=".84"/><stop offset="1" stop-color="#f0a53a" stop-opacity=".55"/></radialGradient></defs>');
  P.raw('<path d="' + d([[2, 2], [98, 2], [98, 168], [2, 168]]) + '" fill="url(#litkitchen)" filter="url(#rag)"/>');
  for (let y = 6; y < 168; y += 6) P.line([[2, y], [98, y]], 0.4, 0.16);
  // every shadow is engraved: line work clipped to its silhouette over the gold light, no flat fills
  const eg = (id, path, pitch, o, ang = 0) => engraved(P, id, path, pitch, o, ang);
  eg('ksThr', d([[2, 146], [98, 146], [98, 156], [2, 156]]), 2.2, 0.8);
  engraved(P, 'ksJamL', d([[14, 146], [20, 146], [20, 96], [14, 96]]), 2.2, 0.85, 90);
  engraved(P, 'ksJamR', d([[80, 146], [86, 146], [86, 96], [80, 96]]), 2.2, 0.85, 90);
  engraved(P, 'ksLin', d([[14, 96], [86, 96], [86, 102], [14, 102]]), 1.8, 0.8);
  eg('ksRoad', d([[48.6, 64], [51.4, 64], [86, 146], [14, 146]]), 2.8, 0.6, 55);
  P.line([[52.5, 68], [79, 144]], 0.7, 0.5); P.line([[47.5, 68], [21, 144]], 0.7, 0.5);
  eg('ksHan', d([[8, 84], [11, 84], [34, 154], [27, 154]]), 4.2, 0.8, 72);
  P.line([[10.4, 86], [30.6, 151]], 0.6, 0.7); P.line([[9.2, 90], [29.2, 152]], 0.4, 0.5);
  // the brush: a flared, ragged head whose bristles stick out past the bottom edge, not a smooth bottle
  eg('ksHead', 'M25 154 L37.5 154 L40.5 143 C41.5 136 40 128 38.5 125 C36.5 121.5 29.5 121.5 27.5 125 C25.5 129 24.5 137 25.5 144 Z', 3.2, 0.85, 62);
  for (let k = 0; k < 9; k++) { const bx = 26.5 + k * 1.35, dv = Math.sin(k * 2.7) * 2.4; P.line([[bx + 0.6, 148], [bx + dv, 157.5 + 1.2 * Math.sin(k * 1.9)]], 0.55, 0.75); }
  for (const k of [-0.5, -0.15, 0.25, 0.6]) P.line([[30 + k * 8, 152], [31 + k * 12, 126]], 0.5, 0.7);
  const R = 9, r = 3.6, c = [50, 38], pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; pts.push([c[0] + q * Math.cos(a), c[1] + q * Math.sin(a)]); }
  eg('ksStar', d(pts), 2.2, 0.6, 30);
}

/** The light on the low boughs of the fir (100 x 130, the fir's base centre at 50, 125, same scale as the plate's fir): a warm pool of light with no edge, in which the same boughs as the dark mass
 * are brought up; it fades out halfway up the tree. The boughs are drawn only inside the pool and fade into the dark with it. Nothing hangs on the boughs. */
export function treeLight(P) {
  const cx = 50, cy = 86, rx = 52, ry = 50;
  P.raw('<defs><radialGradient id="littree" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".62"/><stop offset=".55" stop-color="#f4b447" stop-opacity=".34"/><stop offset="1" stop-color="#f0a53a" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="litfade" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="' + rx + '" gradientTransform="translate(0 ' + cy + ') scale(1 ' + f1(ry / rx) + ') translate(0 ' + (-cy) + ')"><stop offset="0" stop-color="white"/><stop offset=".6" stop-color="white" stop-opacity=".9"/><stop offset="1" stop-color="black"/></radialGradient>'
    + '<mask id="litmask" maskUnits="userSpaceOnUse" x="-10" y="0" width="120" height="130"><rect x="-10" y="0" width="120" height="130" fill="url(#litfade)"/></mask></defs>');
  P.raw('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (rx + 6) + '" ry="' + (ry + 6) + '" fill="url(#littree)" filter="url(#rag)"/>');
  P.raw('<g mask="url(#litmask)">');
  drawTree(P, 50, 125, 1, { tone: (x, y) => clamp(0.3 + 0.12 * (1 - sstep(60, 125, y))), maxTier: 4, wash: 0.6, seed: 3300 });
  P.raw('</g>');
}

const PAPER = '#e0d2ac';
/** One sheet of paper lying on the well lid (64 x 52): a mask drawn on it and left unfinished. The left half has its horn, brow and nose; the right half is only the outline of the face and a faint dotted horn.
 * With holes the same drawing has two eye holes pricked through, dark where the wood of the lid shows. A drawn paper only: no head, no costume, nobody. */
function draftSheet(P, holes) {
  const sheet = [[4, 14, 1], [56, 6, 1], [62, 42, 1], [8, 48, 1]];
  P.part(sheet, { tone: (x, y) => clamp(0.12 + 0.18 * sstep(4, 62, x) + 0.06 * (vnoise(x * 0.2, y * 0.2, 4) - 0.5)), layers: [hatch(8, 1.7, 0.7, 0.08, 1.8)], seed: 4101, fill: CARD, halo: 0, outline: 1.1, wash: [PAPER, 0.7] });
  P.line([[33, 7], [34, 47]], 0.5, 0.35);
  const face = cr([[33, 12, 1], [43, 17], [45, 29], [40, 40], [33, 44, 1], [26, 40], [21, 29], [23, 17]], true, 6);
  P.line(face.concat([face[0]]), 1.3, 1);
  P.line(cr([[24, 18], [19, 12], [20, 5]], false, 5), 1.3, 1);
  P.line(cr([[22, 20], [27, 25], [31, 24]], false, 4), 1.1, 1);
  P.line([[33, 27], [32, 33], [35, 34]], 0.9, 0.9);
  for (const [a, b] of [[[43, 18], [47, 12]], [[47, 12], [48, 6]]]) P.line([a, b], 0.9, 0.5);
  P.line([[39, 36], [43, 34]], 0.6, 0.4);
  if (holes) {
    P.line(cr([[36, 24], [41, 22], [44, 24]], false, 4), 1.1, 1);
    for (const [x, y] of [[27.5, 29], [39.5, 28.5]]) P.raw('<ellipse cx="' + x + '" cy="' + y + '" rx="3.6" ry="2.6" fill="' + ink + '" stroke="' + ink + '" stroke-width=".6" filter="url(#rag)"/>');
  }
}
export const draftFace = (P) => draftSheet(P, false);
export const draftHoles = (P) => draftSheet(P, true);

/** The page lying on the kitchen table (48 x 24): one name written on it, a single line of cursive loops and nothing else. */
export function namePage(P) {
  P.part([[8, 3, 1], [42, 3, 1], [47, 21, 1], [2, 21, 1]], { tone: (x) => clamp(0.1 + 0.15 * sstep(2, 47, x)), layers: [hatch(2, 1.7, 0.7, 0.08, 1.8)], seed: 4201, fill: CARD, halo: 0, outline: 1.1, wash: [PAPER, 0.7] });
  P.line(cr([[9, 13], [12, 9], [14, 14], [17, 8], [19, 14], [22, 10], [24, 14], [27, 9], [29, 14], [33, 11], [38, 12]], false, 5), 1.0, 1);
  P.line([[10, 16.5], [36, 16.5]], 0.45, 0.5);
}

/** The name draft lying on the parlour desk (52 x 26): two ruled lines of loops and a heavy short stroke; the sheet still blank at the foot. */
export function nameDraft(P) {
  P.part([[4, 4, 1], [44, 2, 1], [49, 20, 1], [2, 23, 1]], { tone: (x) => clamp(0.1 + 0.16 * sstep(2, 49, x)), layers: [hatch(3, 1.7, 0.7, 0.08, 1.8)], seed: 4701, fill: CARD, halo: 0.5, outline: 1.0, wash: [PAPER, 0.72] });
  P.line([[6, 12], [46, 10.5]], 0.8, 0.65); P.line([[7, 17], [40, 16]], 0.8, 0.65);
  P.line(cr([[10, 11], [13, 8], [15, 12], [18, 7], [20, 12], [23, 9], [25, 12], [28, 8], [30, 12]], false, 5), 1.3, 0.95);
  P.line(cr([[12, 16], [15, 13.5], [18, 16.5], [21, 14], [24, 16.5], [27, 14.5], [30, 16]], false, 5), 1.3, 0.95);
  P.line([[33, 16], [39, 15.7]], 1.9, 0.9);
}

/** A cut mistletoe sprig lying on the floorboards (22 x 13): paired leaves, three pearls of berries, the cut stem end. */
export function mistletoeSprig(P) {
  P.part(cr([[2, 10, 1], [5, 6], [10, 4], [16, 5], [20, 9], [17, 11], [10, 12], [5, 11]], true, 4), { tone: (x) => clamp(0.22 + 0.2 * sstep(4, 20, x)), layers: [hatch(15, 1.4, 0.8, 0.1, 1.5)], seed: 4801, fill: CARD, halo: 0.5, outline: 0.9, wash: [GREEN, 0.68] });
  for (const [x, y, w, h, a] of [[4, 8, 5, 2.4, -20], [9, 6, 5.5, 2.6, -8], [14, 6.5, 5, 2.4, 10], [17, 9, 4, 2.2, 24]]) P.raw('<ellipse cx="' + x + '" cy="' + y + '" rx="' + w / 2 + '" ry="' + h / 2 + '" transform="rotate(' + a + ' ' + x + ' ' + y + ')" fill="' + GREEN + '" fill-opacity="1" stroke="' + ink + '" stroke-width=".6" filter="url(#rag)"/>');
  for (const [x, y] of [[7, 9.5], [11, 8.5], [15, 9.5]]) P.raw('<circle cx="' + x + '" cy="' + y + '" r="1.3" fill="' + CARD + '" stroke="' + ink + '" stroke-width=".5"/>');
}

/** A small empty sack resting at the wall foot (32 x 26): a slumped pouch with a tied neck, hatched for the cloth folds. */
export function smallBag(P) {
  P.part(cr([[3, 24, 1], [4, 14], [8, 8], [13, 5], [18, 5.5], [22, 8], [26, 14], [27, 24], [22, 25, 1], [10, 25, 1]], true, 5), { tone: (x, y) => clamp(0.3 + 0.3 * sstep(6, 27, x) + 0.12 * sstep(14, 25, y)), layers: [hatch(70, 1.7, 0.9, 0.1, 1.7), hatch(20, 2.6, 0.7, 0.5)], seed: 4901, fill: CARD, halo: 0.8, outline: 1.1, wash: [WASH.coat, 0.45] });
  P.line(cr([[11, 6], [13, 2.5], [16, 2], [18.5, 4]], false, 4), 1.1, 1);
  P.line([[12.5, 3.6], [17.5, 3.2]], 0.8, 0.9);
  P.line(cr([[8, 16], [12, 13], [17, 14], [22, 17]], false, 4), 0.6, 0.7);
  P.line(cr([[6, 20], [12, 17.5], [20, 18.5], [25, 21]], false, 4), 0.6, 0.6);
}

/** A folded sheet left at the wall foot (38 x 22): cloth in flat folds, seen at a slant, nothing on it. */
export function foldedSheet(P) {
  P.part(cr([[2, 17, 1], [6, 10], [14, 7], [26, 7.5], [35, 12], [36, 18], [28, 21, 1], [9, 20, 1]], true, 5), { tone: (x, y) => clamp(0.14 + 0.24 * sstep(6, 36, x) + 0.1 * (vnoise(x * 0.15, y * 0.3, 6) - 0.5)), layers: [hatch(8, 1.6, 0.8, 0.12, 1.7)], seed: 4951, fill: CARD, halo: 0.8, outline: 1.1, wash: ['#fbf6e4', 0.5] });
  P.line(cr([[8, 14], [16, 11.5], [26, 12], [33, 15]], false, 4), 0.6, 0.7);
  P.line(cr([[6, 18.5], [16, 16], [28, 16.5], [34, 18.5]], false, 4), 0.6, 0.6);
  P.line([[14, 8.5], [13, 19.5]], 0.5, 0.5); P.line([[24, 8], [24.5, 20]], 0.5, 0.5);
}

/** An apple (24 x 24) lying on the floor, with its stem and one leaf. */
export function apple(P) {
  const body = cr([[12, 6, 1], [18, 5], [22, 10], [21, 17], [16, 22], [12, 21, 1], [8, 22], [3, 17], [2, 10], [6, 5]], true, 6);
  P.part(body, { tone: (x, y) => clamp(0.28 + 0.4 * sstep(4, 20, x) + 0.1 * sstep(8, 22, y)), layers: [hatch(75, 1.3, 0.9, 0.06, 1.5), hatch(-20, 2, 0.7, 0.5)], seed: 4301, fill: CARD, halo: 0.6, outline: 1.0, wash: [RED, 0.85] });
  P.line([[12, 7], [13, 1.5]], 1.1, 1);
  P.part(cr([[13, 3, 1], [18, 0.5], [21, 2.5], [16, 4.5]], true, 3), { tone: () => 0.4, layers: [hatch(60, 1.2, 0.8, 0.1, 1.4)], seed: 4302, fill: CARD, halo: 0, outline: 0.8, wash: [GREEN, 0.75] });
}

/** A paper star (36 x 18) lying flat on the writing desk, seen from above at a slant. */
export function paperStar(P) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5 + 0.12, q = i % 2 ? 4.4 : 11; pts.push([18 + q * 1.5 * Math.cos(a), 9 + q * 0.62 * Math.sin(a), 1]); }
  P.part(pts, { tone: (x) => clamp(0.12 + 0.3 * sstep(6, 30, x)), layers: [hatch(15, 1.4, 0.8, 0.06, 1.6)], seed: 4401, fill: CARD, halo: 0.5, outline: 1.0, wash: [PAPER, 0.75] });
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (2 * i * Math.PI) / 5 + 0.12; P.line([[18, 9], [18 + 11 * 1.5 * Math.cos(a) * 0.85, 9 + 11 * 0.62 * Math.sin(a) * 0.85]], 0.4, 0.45); }
}

/** One paper slip lying flat on the stone step (32 x 16), a few grey rules on it and a single heavier short stroke; no letter, no name. */
export function loneSlip(P) {
  P.part([[5, 4, 1], [28, 2, 1], [31, 12, 1], [2, 14, 1]], { tone: (x) => clamp(0.1 + 0.14 * sstep(2, 31, x)), layers: [hatch(4, 1.7, 0.7, 0.08, 1.8)], seed: 4501, fill: CARD, halo: 0.5, outline: 1.0, wash: [PAPER, 0.7] });
  for (const [y, b] of [[6, 24], [8.4, 22], [10.8, 15]]) P.line([[7, y], [b, y - 0.3]], 0.5, 0.6);
  P.line([[17, 10.8], [24, 10.5]], 1.2, 0.9);
}

/** A page of a calendar (24 x 32): a red band across the head, a grid of day boxes and one box ringed. No digit. */
export function calendarPage(P) {
  P.part([[2, 2, 1], [22, 1, 1], [23, 30, 1], [1, 31, 1]], { tone: (x) => clamp(0.1 + 0.16 * sstep(2, 23, x)), layers: [hatch(2, 1.7, 0.7, 0.08, 1.8)], seed: 4601, fill: CARD, halo: 0.5, outline: 1.1, wash: [PAPER, 0.6] });
  P.part([[2, 2, 1], [22, 1, 1], [22.4, 9, 1], [1.8, 9.4, 1]], { tone: () => 0.35, layers: [hatch(88, 1.4, 0.8, 0.1, 1.6)], seed: 4602, fill: CARD, halo: 0, outline: 0.9, wash: [RED, 0.85] });
  for (let i = 1; i < 5; i++) P.line([[1.6 + i * 0.1, 9.4 + i * 4.5], [22.6 + i * 0.1, 8.4 + i * 4.5]], 0.45, 0.6);
  for (let j = 1; j < 5; j++) P.line([[1.6 + j * 4.2, 9.4], [1.8 + j * 4.2, 30.6]], 0.45, 0.6);
  P.raw('<ellipse cx="16.6" cy="18.8" rx="3" ry="2.3" fill="none" stroke="' + RED + '" stroke-width="1.1"/>');
}

/** The lit square the machine throws on the church door (60 x 90): gold light, the faint planks of the door, and in it only two standing shadows and a guitar held across the right one's body.
 * Shadows, not people: no face, no hand, no feature. */
export function doorShadows(P) {
  P.raw('<defs><radialGradient id="doorlit" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#ffd25a" stop-opacity=".95"/><stop offset=".7" stop-color="#f4b447" stop-opacity=".8"/><stop offset="1" stop-color="#f0a53a" stop-opacity=".5"/></radialGradient></defs>');
  P.raw('<rect x="1" y="1" width="58" height="88" fill="url(#doorlit)" filter="url(#rag)"/>');
  for (const x of [10, 20, 30, 40, 50]) P.line([[x, 3], [x, 87]], 0.4, 0.22);
  // every shadow is engraved line work clipped to its silhouette over the gold: hatch strokes, a thin border, uneven heads. No solid ink mass.
  const eg = (id, path, pitch, o, ang = 0) => engraved(P, id, path, pitch, o, ang);
  eg('dsB1', 'M9 89 L10 53 Q11 42 20 41 Q29 42 30 53 L31 89 Z', 6.5, 0.8, 82);
  eg('dsH1', 'M14.4 31 C14.7 27.4 17.2 24.3 20.2 24.4 C23.2 24.6 25.5 27.6 25.6 31.3 C25.6 34.8 23.1 37.7 19.9 37.7 C16.5 37.8 14.2 34.5 14.4 31 Z', 3.2, 0.8, 74);
  eg('dsB2', 'M31 89 L32 59 Q33 50 41 49 Q49 50 50 59 L51 89 Z', 3.2, 0.8, 80);
  eg('dsH2', 'M36.1 39 C36.4 36 38.6 33.9 41.2 34 C43.8 34.1 45.7 36.4 45.7 39.3 C45.6 42.4 43.4 44.5 40.8 44.4 C38 44.3 35.9 42 36.1 39 Z', 3.2, 0.8, 70);
  // the guitar held across the right one: hatched pear body, outlined neck and headstock, a light sound hole
  eg('dsG', 'M40.2 60.5 C38.6 62.5 37.6 65.5 37.8 69 C38 73.5 40.8 77.5 45.2 78 C49.8 78.4 53.4 74.6 53.8 70 C54.2 65.8 52.4 62 49.6 60.2 C48.2 59.4 47 59.2 45.8 59.4 C43.6 59.8 41.6 59 40.2 60.5 Z', 3.4, 0.75, 12);
  eg('dsN', 'M43 56 L45.8 55 L53.6 33 L51 32.2 Z', 3, 0.8, 62);
  eg('dsS', 'M51.4 28.1 L55 29 L53.8 33.9 L50.2 33 Z', 3, 0.8, 14);
  P.raw('<ellipse cx="46" cy="69" rx="2.6" ry="2.6" fill="' + CARD + '" fill-opacity=".5"/>');
  P.raw('<path d="M38.4 73 C38.4 66 39.6 62 40.8 60 M53.6 73 C53.6 66 51 62 50 60" fill="none" stroke="' + CARD + '" stroke-opacity=".3" stroke-width=".7"/>');
}

/** The faint mark for the choir (60 x 90), drawn over the same square: one soft band of smoke-grey behind the two shadows, nothing in it with a shape. */
export function choirMark(P) {
  const pts = []; for (let k = 0; k <= 10; k++) pts.push([3 + k * 5.4, 18 + Math.sin(k * 1.1) * 3.4]);
  const d = 'M' + cr(pts, false, 4).map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L');
  for (const [w, o] of [[20, 0.2], [13, 0.26], [7, 0.36], [3, 0.6]]) P.raw('<path d="' + d + '" fill="none" stroke="' + ink + '" stroke-opacity="' + o + '" stroke-width="' + w + '" stroke-linecap="round"/>');
}
