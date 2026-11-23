import fs from 'node:fs';
import path from 'node:path';
import { scene, LAYOUT } from './scene.mjs';
import { machine, LAYERS } from './machine.mjs';
import { teoBody } from './teo.mjs';
import { crow, cuckoo } from './birds.mjs';
import { drawFace } from './faces.mjs';
import { engrave, family, stroke, fillp, ink, paper, clamp, sstep, f1, cr, ellipse, bbox, inside } from './lib.mjs';

const src = new URL('.', import.meta.url).pathname;
const out = path.resolve(process.argv[2] || path.join(process.env.TMPDIR || '/var/tmp', 'Game', 'art-style'));
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(src, 'style.css'), path.join(out, 'style.css'));
fs.cpSync(path.join(src, 'fonts'), path.join(out, 'fonts'), { recursive: true });
const PAPER = '#ece2c8';
const P = d => `<path d="${d}" fill="${ink}"/>`;
const line = (x0, y0, x1, y1, w = 1, op = 1, col = ink) => `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="${col}" stroke-width="${w}" ${op < 1 ? `stroke-opacity="${op}"` : ''} fill="none"/>`;
const rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" ${o.extra || ''}/>`;
const lozenge = (cx, cy, r, col = ink) => `<path d="M${cx} ${cy - r}L${cx + r * 0.8} ${cy}L${cx} ${cy + r}L${cx - r * 0.8} ${cy}Z" fill="${col}"/>`;

const DEFS = `<defs>
<filter id="grainf" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0 0.12  0 0 0 -1.6 1.0"/></filter>
<filter id="rough" x="-5%" y="-8%" width="110%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.4" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
</defs>`;

function chrome() {
  return [
    `<rect width="390" height="844" fill="${PAPER}"/>`,
    line(0, 58.8, 390, 58.8, 1.7), line(0, 62, 390, 62, 0.6),
  ];
}
function hatchBox(x, y, w, h, o = {}) {
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return P(engrave(family(o.angle ?? 45, o.gap ?? 2.1, bbox(pts), 0, 3), { tone: o.tone || (() => 0.95), inside: inside(pts), w: o.w ?? 1.5, lo: 0.05, step: 2.4, wob: 0.15, seed: o.seed ?? 5 }));
}
const grain = `<svg class="grain" width="390" height="844" xmlns="http://www.w3.org/2000/svg"><rect width="390" height="844" filter="url(#grainf)"/></svg>`;
const page = (name, svgInner, html) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>11 engraved plate - ${name}</title><link rel="stylesheet" href="style.css"></head><body><div id="app"><svg class="bg" width="390" height="844" viewBox="0 0 390 844" xmlns="http://www.w3.org/2000/svg">${DEFS}${svgInner}</svg><div class="foxing"></div>${html}${grain}</div></body></html>`;

// ---------------------------------------------------------------- story
{
  const t0 = Date.now();
  const L = LAYOUT.portrait, sc = scene('portrait');
  const put = (m, root, s) => sc.plate.raw('<g transform="translate(' + f1(root[0]) + ' ' + f1(root[1]) + ') scale(' + s + ')">' + m.plate.z.join('') + '</g>');
  for (const l of ['body', 'stain', 'doorL', 'doorR', 'needle', 'crank']) put(machine(l), L.machine.origin, L.machine.scale);
  put(cuckoo('smug'), L.cuccu.root, L.cuccu.scale);
  const teo = teoBody('three-quarter', 'smug');
  put(teo, L.teo.root, L.teo.scale);
  const view = [12, 840 - 578, 366, 578];
  const plate = sc.plate.svg(view).replace('<svg ', '<svg x="12" y="70" ') +
    rect(12, 70, 366, 578, { stroke: ink, sw: 2 }) + rect(8.5, 66.5, 373, 585, { stroke: ink, sw: 0.8 });
  const dlg = [
    rect(14, 676, 362, 156, { stroke: ink, sw: 1.5 }), rect(18.5, 680.5, 353, 147, { stroke: ink, sw: 0.65 }),
    lozenge(14, 676, 4.5), lozenge(376, 676, 4.5), lozenge(14, 832, 4.5), lozenge(376, 832, 4.5),
  ].join('');
  const svg = chrome().join('') + plate + dlg;
  const html = `<div class="title">Tèo và Cỗ máy Lịch sử</div><div class="mb" style="left:224px;width:76px">Thoại</div><div class="mb" style="left:308px;width:70px">Menu</div>
<div class="cap">Hình I. — Đêm Yule trong đại sảnh, bên Cỗ máy Lịch sử</div>
<div class="dlg"><div class="who"><span>Tèo</span><span style="flex:1;border-top:.8px solid #6b1c17;margin-top:1px"></span></div><div class="say">Nghe hợp lý ghê! Tớ ghi vào thư ngay nhé?</div><div class="pips"><i></i><i class="on"></i><i></i><i></i></div><div class="next">Lật trang</div></div>`;
  fs.writeFileSync(path.join(out, 'story.html'), page('story', svg, html));
  console.log('story svg KB', Math.round(svg.length / 1024), 'ms', Date.now() - t0);
}

// ---------------------------------------------------------------- puzzle
{
  const g = [...chrome()];
  // page frame
  g.push(rect(8, 68, 374, 768, { stroke: ink, sw: 0.8 }), rect(11.5, 71.5, 367, 761, { stroke: ink, sw: 1.7 }));
  // sun medallion (the Sol Invictus of the third clue)
  {
    const cx = 336, cy = 106;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, long = i % 2 === 0, r1 = long ? 36 : 29, r0 = 22, w = long ? 0.085 : 0.07;
      g.push(`<path d="M${f1(cx + Math.cos(a - w) * r0)} ${f1(cy + Math.sin(a - w) * r0)}L${f1(cx + Math.cos(a) * r1)} ${f1(cy + Math.sin(a) * r1)}L${f1(cx + Math.cos(a + w) * r0)} ${f1(cy + Math.sin(a + w) * r0)}Z" fill="${ink}"/>`);
    }
    const disc = ellipse(cx, cy, 20, 20, 48);
    g.push(`<circle cx="${cx}" cy="${cy}" r="20" fill="#f6eed6" stroke="${ink}" stroke-width="1.3"/>`);
    g.push(P(engrave(family(0, 1.5, bbox(disc), 0, 3), { tone: (x, y) => { const d = Math.hypot(x - cx, y - cy); return clamp(0.08 + 0.7 * sstep(6, 20, d) + 0.25 * sstep(-10, 16, (x - cx) * 0.5 + (y - cy) * 0.8) * sstep(4, 12, d)); }, inside: inside(disc), w: 1.0, lo: 0.08, step: 1.4, wob: 0.1, seed: 9 })));
    g.push(`<circle cx="${cx}" cy="${cy}" r="14.5" fill="none" stroke="${ink}" stroke-width=".6"/><circle cx="${cx}" cy="${cy}" r="21.5" fill="none" stroke="${ink}" stroke-width=".7"/>`);
    g.push(`<g style="mix-blend-mode:multiply"><circle cx="${cx + 0.8}" cy="${cy + 0.6}" r="36" fill="#e3a93a" fill-opacity=".55"/></g>`);
  }
  // title rule
  g.push(line(20, 123, 262, 123, 1.1), line(20, 126, 262, 126, 0.5), lozenge(268, 124.5, 4.2));
  // dividers
  const divider = y => [line(24, y, 172, y, 0.9), line(24, y + 2.6, 172, y + 2.6, 0.45), line(218, y, 366, y, 0.9), line(218, y + 2.6, 366, y + 2.6, 0.45), lozenge(195, y + 1.3, 5), lozenge(184, y + 1.3, 2), lozenge(206, y + 1.3, 2)].join('');
  g.push(divider(452), divider(556), divider(727));
  // cards
  const cards = [[146, 104, '#2f5d3a', '#7fa07a'], [258, 84, '#8b2a22', '#c98378'], [350, 84, '#2d4666', '#8aa0bd']];
  cards.forEach(([y, h, c, tint], i) => {
    g.push(hatchBox(20, y + 4, 354, h, { seed: 20 + i, tone: () => 0.95 }));
    g.push(rect(16, y, 354, h, { fill: '#f5eed8', stroke: ink, sw: 1.4 }));
    g.push(rect(19.5, y + 3.5, 347, h - 7, { stroke: ink, sw: 0.55 }));
    // spine
    g.push(rect(16, y, 11, h, { fill: '#f5eed8' }));
    g.push(P(engrave(family(90, 1.7, [16, y, 27, y + h], 0, 5), { tone: (x, yy) => 0.78 - 0.25 * sstep(y, y + h, yy), inside: (x, yy) => x > 16.6 && x < 26.4 && yy > y + 0.6 && yy < y + h - 0.6, w: 1.2, lo: 0.1, step: 2, seed: 30 + i })));
    g.push(line(27, y, 27, y + h, 1.1));
    g.push(`<g style="mix-blend-mode:multiply"><rect x="16" y="${y}" width="11" height="${h}" fill="${tint}" fill-opacity=".8"/></g>`);
  });
  // slots (recessed blanks)
  [21, 141, 261].forEach((x, i) => {
    g.push(rect(x, 470, 108, 64, { fill: '#e4d8b8' }));
    const rbb = [x, 470, x + 108, 534];
    g.push(P(engrave(family(45, 2.0, rbb, 0, 3), { tone: (xx, yy) => 0.15 + 0.85 * Math.exp(-(Math.min(xx - x, yy - 470)) / 3.2) * 1 + 0.0, inside: (xx, yy) => xx > x + 1 && xx < x + 107 && yy > 471 && yy < 533, w: 1.2, lo: 0.1, step: 2.2, wob: 0.1, seed: 40 + i })));
    g.push(rect(x, 470, 108, 64, { stroke: ink, sw: 1.3 }), rect(x + 3.5, 473.5, 101, 57, { stroke: ink, sw: 0.5, extra: 'stroke-dasharray="3 2.2"' }));
  });
  // tokens (tinted label plates)
  const toks = [[21, 580, 96, '#cfd8dc'], [137, 580, 100, '#f4ecd2'], [257, 580, 112, '#d3dcbf'], [39, 644, 138, '#ecd695'], [197, 644, 154, '#e4bba8']];
  toks.forEach(([x, y, w, fill], i) => {
    g.push(hatchBox(x + 3, y + 3, w, 52, { seed: 50 + i, gap: 2 }));
    g.push(rect(x, y, w, 52, { fill: '#f1e8cd', stroke: ink, sw: 1.4 }));
    g.push(`<g style="mix-blend-mode:multiply"><rect x="${x}" y="${y}" width="${w}" height="52" fill="${fill}" fill-opacity=".9"/></g>`);
    g.push(rect(x + 3.5, y + 3.5, w - 7, 45, { stroke: ink, sw: 0.5 }));
  });
  // buttons
  g.push(hatchBox(20, 756, 160, 56, { seed: 60 }), rect(16, 752, 160, 56, { fill: '#f5eed8', stroke: ink, sw: 1.6 }), rect(20, 756, 152, 48, { stroke: ink, sw: 0.6 }));
  g.push(hatchBox(198, 756, 180, 56, { seed: 61 }), rect(194, 752, 180, 56, { fill: '#661b16', stroke: ink, sw: 1.6 }), rect(198, 756, 172, 48, { stroke: '#f6edd5', sw: 0.6, extra: 'stroke-opacity=".7"' }));
  const html = `<div class="title">Tèo và Cỗ máy Lịch sử</div><div class="mb" style="left:308px;width:70px">Menu</div>
<div class="h1">Vì sao lại là 25/12?</div>
<div class="card" style="top:146px;height:104px;--c:#2c5a38"><div class="t">Ghi chép năm 354</div><div class="b">Lịch La Mã ghi 25/12 là ngày Chúa giáng sinh.</div><div class="stamp" style="--c:#2c5a38">Sự thật</div></div>
<div class="card" style="top:258px;height:84px;--c:#8b2a22"><div class="t">Giả thuyết tính ngày</div><div class="b">25/3 cộng thêm 9 tháng.</div><div class="stamp" style="--c:#8b2a22">Tranh cãi</div></div>
<div class="card" style="top:350px;height:84px;--c:#2d4666"><div class="t">Người ta kể rằng</div><div class="b">Lễ Mặt Trời Bất Bại cũng rơi vào 25/12.</div><div class="stamp" style="--c:#2d4666">Truyền thuyết</div></div>
<div class="slot" style="left:21px">1</div><div class="slot" style="left:141px">2</div><div class="slot" style="left:261px">3</div>
<div class="tok" style="left:21px;top:580px;width:96px">354</div><div class="tok" style="left:137px;top:580px;width:100px">25/3</div><div class="tok" style="left:257px;top:580px;width:112px">9 tháng</div>
<div class="tok" style="left:39px;top:644px;width:138px">Mặt Trời</div><div class="tok" style="left:197px;top:644px;width:154px">Saturnalia</div>
<div class="pb" style="left:16px;width:160px;color:#1b1712">Gợi ý</div><div class="pb" style="left:194px;width:180px;color:#f6edd5">Nộp</div>`;
  fs.writeFileSync(path.join(out, 'puzzle.html'), page('puzzle', g.join(''), html));
  console.log('puzzle svg KB', Math.round(g.join('').length / 1024));
}
console.log('out', out);
