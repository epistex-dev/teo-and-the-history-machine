// Tèo's expressions: eyebrows, lids and mouth drawn over the head base. A view maps face-surface coordinates (u across, y down) to the picture:
// the front is the identity, a turned head wraps the same drawing around a sphere, so every expression exists in every view.
import { clamp, mix, cr, f1, ink } from './lib.mjs';
import { limb } from './draw.mjs';

const CARD = '#f5eed8';
export const TEO_EXPR = ['normal', 'elated', 'angry', 'awkward', 'fainted', 'scared', 'smug', 'tired'];

// brow heights [inner, middle, outer] (y; more negative = higher), lid openness (0 closed, 1 open, >1 wide), mouth corners [dy left, dy right] (negative = up), opening
export const EXPR = {
  normal:  { bl: [-283.6, -284.8, -283.8], br: [-283.6, -284.4, -283.9], lidL: 0.8, lidR: 0.8, ml: -0.1, mr: 0.1, open: 0, crease: 0 },
  elated:  { bl: [-286.0, -288.2, -286.6], br: [-286.0, -288.2, -286.6], lidL: 1.15, lidR: 1.15, ml: -1.9, mr: -2.0, open: 3.4, teeth: true, crease: 1 },
  angry:   { bl: [-281.0, -283.4, -285.6], br: [-281.0, -283.4, -285.6], lidL: 0.62, lidR: 0.62, ml: 1.3, mr: 1.3, open: 0, press: 1, crease: 0.6 },
  awkward: { bl: [-286.2, -288.0, -286.0], br: [-282.6, -283.4, -283.6], lidL: 1.05, lidR: 0.95, ml: 0.9, mr: -1.4, open: 0.7, crease: 0.3 },
  fainted: { bl: [-285.2, -285.8, -282.4], br: [-285.2, -285.8, -282.4], lidL: 0, lidR: 0, ml: 0.4, mr: 0.4, open: 3.6, slack: true, crease: 0 },
  scared:  { bl: [-288.8, -289.2, -285.6], br: [-288.8, -289.2, -285.6], lidL: 1.35, lidR: 1.35, ml: 0.9, mr: 0.9, open: 2.2, wavy: true, crease: 0.4 },
  smug:    { bl: [-282.6, -283.2, -283.0], br: [-286.2, -288.0, -286.2], lidL: 0.55, lidR: 0.6, ml: 0.2, mr: -2.1, open: 0, crease: 0.5 },
  tired:   { bl: [-283.2, -283.8, -282.0], br: [-283.2, -283.8, -282.0], lidL: 0.42, lidR: 0.42, ml: 0.9, mr: 0.9, open: 0, bags: true, crease: 0 },
};

export const EYE_Y = -278.4;
export const EYE_X = 6.4;

// view maps: front u -> x; head yaw wraps around a sphere of radius R
export const VIEWS = {
  front: { R: 15, yaw: 0, cx: 0 },
  'three-quarter': { R: 15.5, yaw: 0.62, cx: 1.2 },
};
const mapper = v => {
  const { R, yaw, cx } = VIEWS[v];
  const sx = u => { const ph = Math.asin(clamp(u / R, -0.97, 0.97)); return cx + R * Math.sin(ph + yaw); };
  const w = u => { const ph = Math.asin(clamp(u / R, -0.97, 0.97)); return Math.max(0.28, Math.cos(ph + yaw)); };
  return { x: sx, w, p: (u, y) => [sx(u), y] };
};

export function drawFace(P, expr, view = 'front') {
  const e = EXPR[expr], M = mapper(view);
  const g = (pts, w = 0.7, op = 1) => P.line(cr(pts.map(p => M.p(p[0], p[1])), false, 4), w, op);
  const brow = (sx, ys, thick) => {
    const xs = [2.4, 6.9, 11.2].map(x => sx * x);
    const pts = xs.map((x, i) => M.p(x, ys[i]));
    const t = limb([pts[0], pts[1], pts[2]], [thick * 1.15, thick * 1.3, thick * 0.35], 6);
    P.raw(`<path d="M${t.outline.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z" fill="${ink}"/>`);
  };
  brow(-1, e.bl, 1.15); brow(1, e.br, 1.15);
  // eyes
  const eye = (sx, o, side) => {
    const x0 = sx * EYE_X, y0 = EYE_Y, hw = 3.3;
    const open = Math.max(0, o);
    const upper = y0 - 2.5 * Math.min(open, 1.25) - 0.1;
    const xo = x0 + sx * hw, xi = x0 - sx * hw; // outer corner is away from the nose
    if (open < 0.08) {
      g([[xo, y0 + 0.4], [x0 + sx * 1.2, y0 + 1.7], [x0 - sx * 1.2, y0 + 1.8], [xi, y0 + 0.5]], 0.95);
      g([[xo + sx * 0.5, y0 + 0.1], [xo + sx * 1.6, y0 - 0.5]], 0.45, 0.8);
      return;
    }
    const top = [[xo, y0 + 0.5], [x0 + sx * 1.5, upper + 0.4], [x0 - sx * 0.7, upper], [xi, y0 + 0.2]];
    const low = [[xi, y0 + 0.2], [x0 - sx * 1.2, y0 + 1.3 + 0.25 * open], [x0 + sx * 1.4, y0 + 1.3 + 0.2 * open], [xo, y0 + 0.5]];
    const shape = [...cr(top.map(p => M.p(p[0], p[1])), false, 5), ...cr(low.map(p => M.p(p[0], p[1])), false, 5)];
    const wv = M.w(x0 / 1);
    P.raw(`<path d="M${shape.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z" fill="${CARD}"/>`);
    const c = M.p(x0 + sx * 0.3, y0 + 0.15);
    const ir = Math.min(1.7, 1.05 + 0.5 * Math.min(open, 1)) * (open > 1.2 ? 0.88 : 1);
    P.raw(`<clipPath id="ec${side}${expr}${view[0]}"><path d="M${shape.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z"/></clipPath><g clip-path="url(#ec${side}${expr}${view[0]})"><ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(ir * wv)}" ry="${f1(ir)}" fill="${ink}"/><ellipse cx="${f1(c[0] + 0.5 * wv)}" cy="${f1(c[1] - 0.55)}" rx=".42" ry=".42" fill="${CARD}"/></g>`);
    P.line(cr(top.map(p => M.p(p[0], p[1])), false, 5), 0.95);
    P.line(cr(low.map(p => M.p(p[0], p[1])), false, 5), 0.38, 0.7);
    P.line([M.p(xo + sx * 0.4, y0 - 0.1), M.p(xo + sx * 1.8, y0 - 0.9)], 0.5, 0.85);
    // upper lid crease
    if (open > 0.5) g([[x0 - sx * 2.4, upper - 1.0], [x0 + sx * 0.2, upper - 1.5], [x0 + sx * 2.8, upper - 0.5]], 0.35, 0.6);
    if (e.bags) g([[x0 - 2.6, y0 + 3.0], [x0, y0 + 3.6], [x0 + 2.6, y0 + 3.1]], 0.4, 0.75);
  };
  eye(-1, e.lidL, 'l'); eye(1, e.lidR, 'r');
  // mouth
  const cy = -262.0, cxm = 0.3, hw = 4.3;
  const L = [-hw + cxm, cy + e.ml], Rr = [hw + cxm, cy + e.mr];
  const mid = [cxm, cy + (e.ml + e.mr) / 2 * 0.2 + (e.open > 0 ? -0.5 : 0.3 - (e.ml + e.mr) * 0.2)];
  if (e.open > 0.5) {
    const o = e.open, hwm = e.teeth ? 5.3 : hw;
    const Lm = [-hwm + cxm, cy + e.ml], Rm = [hwm + cxm, cy + e.mr];
    const upper = [Lm, [-2.4, cy - 0.5 + e.ml * 0.15], [cxm, cy - 0.1], [2.8, cy - 0.5 + e.mr * 0.15], Rm];
    const lowerPts = e.slack ? [[Rm[0] - 1.4, Rm[1] + o * 0.45], [cxm + 0.7, cy + o + 0.2], [Lm[0] + 1.4, Lm[1] + o * 0.45]]
      : [[Rm[0] - 0.4, Rm[1] + o * 0.35], [cxm + 2.7, cy + o * 0.86], [cxm, cy + o], [cxm - 2.7, cy + o * 0.86], [Lm[0] + 0.4, Lm[1] + o * 0.35]];
    const shape = [...cr(upper.map(p => M.p(p[0], p[1])), false, 5), ...cr(lowerPts.map(p => M.p(p[0], p[1])), false, 5)];
    P.raw(`<path d="M${shape.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z" fill="${ink}"/>`);
    if (e.teeth) {
      const low = [[Rm[0] - 0.7, Rm[1] + 0.9], [cxm + 2.4, cy + 0.42 * o], [cxm, cy + 0.5 * o], [cxm - 2.4, cy + 0.42 * o], [Lm[0] + 0.7, Lm[1] + 0.9]];
      const teeth = [...cr(upper.map(p => M.p(p[0], p[1] + 0.15)), false, 5), ...cr(low.map(p => M.p(p[0], p[1])), false, 5)];
      P.raw(`<path d="M${teeth.map(q => f1(q[0]) + ' ' + f1(q[1])).join('L')}Z" fill="${CARD}"/>`);
      for (const tx of [-2.6, 0, 2.6]) g([[cxm + tx, cy - 0.2], [cxm + tx, cy + 0.42 * o]], 0.25, 0.55);
      g([[Lm[0] + 0.9, Lm[1] + 1.0], [cxm - 2.4, cy + 0.42 * o], [cxm, cy + 0.5 * o], [cxm + 2.4, cy + 0.42 * o], [Rm[0] - 0.9, Rm[1] + 1.0]], 0.3, 0.6);
    }
    g(upper, 0.85);
    g(lowerPts, 0.5, 0.85);
  } else if (e.open > 0) {
    g([L, [-2, cy + 0.4], [cxm, cy], [2.6, cy + 0.2], Rr], 0.85);
    g([[L[0] + 1.2, L[1] + 0.8], [cxm - 1, cy + 1.7], [Rr[0] - 0.4, Rr[1] + 1.2]], 0.4, 0.8);
  } else {
    g([L, [-2.2, cy - 0.1 + e.ml * 0.35], [cxm, cy + 0.1 + (e.press ? 0.4 : 0)], [2.4, cy - 0.1 + e.mr * 0.35], Rr], e.press ? 1.0 : 0.85);
    g([[-2.0, cy + 2.4], [cxm, cy + 2.9 + (e.press ? -0.4 : 0)], [2.4, cy + 2.4]], 0.4, 0.7);
  }
  // corner marks and cheek lines
  g([[L[0] - 0.4, L[1] + (e.ml > 0 ? -0.4 : 0.2)], [L[0] - 1.2, L[1] + (e.ml > 0 ? -1.2 : -0.6)]], 0.4, 0.8);
  g([[Rr[0] + 0.4, Rr[1] + (e.mr > 0 ? -0.4 : 0.2)], [Rr[0] + 1.2, Rr[1] + (e.mr > 0 ? -1.2 : -0.6)]], 0.4, 0.8);
  if (e.crease) {
    const k = e.crease;
    g([[-6.6, -270.4], [-6.6 - 0.4 * k, -266.6], [L[0] - 1.6 * k, L[1] - 1.2]], 0.45, 0.8);
    g([[6.6, -270.4], [6.8 + 0.4 * k, -266.6], [Rr[0] + 1.6 * k, Rr[1] - 1.2]], 0.45, 0.8);
  }
  // forehead lines when the brows climb
  const lift = Math.max(0, -Math.min(e.bl[1], e.br[1]) - 288.4 + 0.0);
  if (e.bl[1] < -287 || e.br[1] < -287.6) { g([[-8, -290.6], [-2, -291.4], [4, -290.8]], 0.4, 0.65); g([[-5, -293], [1, -293.6], [7, -293]], 0.35, 0.5); }
  return e;
}
