// Cúc Cu's five stamp marks in the plate style: a hatched coloured frame round a paper field (the engine prints the label there) and an engraved glyph, told apart by frame shape and glyph; the colours are the palette's three stamp colours.
import marks from '../../src/stamps/marks.json' with { type: 'json' };
import { Plate, WASH } from './draw.mjs';
import { cr, ellipse } from './lib.mjs';
import { CARD, hatch } from './room.mjs';

export const STAMP_FRAME = [0, 0, marks.size[0], marks.size[1]];
const [SW, SH] = marks.size;
const X0 = 5, Y0 = 5, W = SW - 10, H = SH - 10;
const GLYPH = [44, 46];
const COLOUR = { fact: '#2c5a38', legend: '#8b2a22', dispute: '#8b2a22', scripture: '#2d4666', tradition: '#2d4666' };

const rect = (i, r = 6) => { const x = X0 + i, y = Y0 + i, w = W - 2 * i, h = H - 2 * i; return cr([[x + r, y, 1], [x + w - r, y, 1], [x + w, y + r, 1], [x + w, y + h - r, 1], [x + w - r, y + h, 1], [x + r, y + h, 1], [x, y + h - r, 1], [x, y + r, 1]], true, 3); };
const octagon = (i, c = 14) => { const x = X0 + i, y = Y0 + i, w = W - 2 * i, h = H - 2 * i; return [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c], [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]; };
const arch = (i) => { const x = X0 + i, y = Y0 + i, w = W - 2 * i, h = H - 2 * i, r = 34 - i, pts = [[x, y + h]]; for (let k = 0; k <= 10; k++) { const a = Math.PI + (Math.PI / 2) * (k / 10); pts.push([x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]); } for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + (Math.PI / 2) * (k / 10); pts.push([x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]); } pts.push([x + w, y + h]); return pts; };
const swallow = (i) => { const x = X0 + i, y = Y0 + i, w = W - 2 * i, h = H - 2 * i, f = 14; return [[x, y], [x + w, y], [x + w - f, y + h / 2], [x + w, y + h], [x, y + h], [x + f, y + h / 2]]; };
const scallop = (i) => { const x = X0 + i, y = Y0 + i, w = W - 2 * i, h = H - 2 * i, pts = []; const bump = (t) => 2.6 * Math.abs(Math.sin(t * Math.PI * 9)); for (let k = 0; k <= 36; k++) pts.push([x + (w * k) / 36, y + bump(k / 36)]); for (let k = 1; k <= 14; k++) pts.push([x + w - bump(k / 14 * 0.6), y + (h * k) / 14]); for (let k = 1; k <= 36; k++) pts.push([x + w - (w * k) / 36, y + h - bump(k / 36)]); for (let k = 1; k < 14; k++) pts.push([x + bump(k / 14 * 0.6), y + h - (h * k) / 14]); return pts; };

const SHAPES = { fact: rect, legend: scallop, dispute: octagon, scripture: arch, tradition: swallow };
const [gx, gy] = GLYPH;
const GLYPHS = {
  fact: (P, c) => glyph(P, [[gx - 20, gy + 2], [gx - 14, gy - 4], [gx - 6, gy + 6], [gx + 14, gy - 16], [gx + 20, gy - 10], [gx - 6, gy + 18]], c, 0.6),
  legend: (P, c) => {
    P.part(ellipse(gx, gy + 20, 17, 4.5, 28), { tone: () => 0.6, layers: [hatch(0, 1.5, 0.9, 0.1)], fill: CARD, halo: 0, outline: 1, wash: [c, 0.75], seed: 80 });
    glyph(P, [[gx - 8, gy - 6], [gx + 8, gy - 6], [gx + 8, gy + 19], [gx - 8, gy + 19]], c, 0.4);
    P.line([[gx, gy - 6], [gx, gy - 11]], 1.4);
    P.part(cr([[gx, gy - 10, 1], [gx - 5, gy - 17], [gx, gy - 28], [gx + 5, gy - 17]], true, 5), { tone: () => 0.1, layers: [hatch(80, 2.4, 0.7, 0.05)], fill: CARD, halo: 0, outline: 0.9, wash: [WASH.flame, 0.9], seed: 83 });
  },
  dispute: (P, c) => { glyph(P, [[gx - 22, gy - 15], [gx - 22, gy + 15], [gx - 2, gy]], c, 0.6); glyph(P, [[gx + 22, gy - 15], [gx + 22, gy + 15], [gx + 2, gy]], c, 0.6); },
  scripture: (P, c) => { glyph(P, [[gx - 22, gy - 13], [gx - 11, gy - 18], [gx - 2, gy - 10], [gx - 2, gy + 15], [gx - 11, gy + 8], [gx - 22, gy + 11]], c, 0.55); glyph(P, [[gx + 22, gy - 13], [gx + 11, gy - 18], [gx + 2, gy - 10], [gx + 2, gy + 15], [gx + 11, gy + 8], [gx + 22, gy + 11]], c, 0.55); },
  tradition: (P, c) => { for (const x of [gx - 8, gx + 8]) { const outer = ellipse(x, gy, 12, 12, 28), inner = ellipse(x, gy, 6, 6, 28); P.part(outer, { tone: () => 0.55, layers: [hatch(40, 1.5, 0.9, 0.1)], fill: CARD, halo: 0, outline: 1, wash: [c, 0.7], seed: 90 + x }); P.part(inner, { tone: () => 0, fill: CARD, halo: 0, outline: 0.9, seed: 91 + x }); } },
};
function glyph(P, pts, c, tone) { P.part(pts, { tone: () => tone, layers: [hatch(40, 1.5, 0.9, 0.1)], fill: CARD, halo: 0, outline: 1, wash: [c, 0.75], seed: P.nextSeed() }); }

export function stamp(id) {
  const P = new Plate(70 + Object.keys(SHAPES).indexOf(id)), c = COLOUR[id], text = marks.marks[id].text;
  P.part(SHAPES[id](0), { tone: () => 0.62, layers: [hatch(45, 1.5, 1.0, 0.1), hatch(-45, 2.4, 0.7, 0.45)], fill: CARD, halo: 0, outline: 1.3, wash: [c, 0.8] });
  P.part(SHAPES[id](8), { tone: () => 0, fill: CARD, halo: 0, outline: 1, wash: [WASH.wood, 0.1] });
  const dx = text[0] - 8;
  P.line([[dx, Y0 + 14], [dx, Y0 + H - 14]], 0.9);
  GLYPHS[id](P, c);
  return { frame: STAMP_FRAME, plate: P, svg: (scale = 1, o = {}) => P.svg(STAMP_FRAME, { scale, ...o }) };
}
export const STAMP_IDS = Object.keys(marks.marks);
