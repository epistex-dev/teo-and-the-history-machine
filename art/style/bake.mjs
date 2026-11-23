// Bakes the story art to WebP: node art/style/bake.mjs [outDir]
// SVG sources (art/style/*.mjs) -> headless Chromium PNG at DPR 1 -> ImageMagick WebP. Offline, no paid or AI service, deterministic.
// The result lives in art/baked (gitignored) and is cached by content hash under $TMPDIR/Game/cache/art-bake, so an unchanged source is not redrawn.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rasterize, tmp } from './raster.mjs';
import { listAssets, GEOMETRY } from './assets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] || path.join(here, '..', 'baked'));
const cacheDir = path.join(tmp, 'cache', 'art-bake');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

// resolution (bitmap px per frame unit) and WebP quality per kind; chosen by measurement, see docs/approvals.md
export const SETTINGS = {
  scene: { res: 1.2, quality: 60, alpha: false },
  teo: { res: 1.4, quality: 76, alpha: true },
  face: { res: 4, quality: 82, alpha: true },
  bird: { res: 2.2, quality: 76, alpha: true },
  machine: { res: 1.2, quality: 76, alpha: true },
  prop: { res: 2.4, quality: 76, alpha: true },
  stamp: { res: 2, quality: 72, alpha: true },
};
const env = { ...process.env };
const overrides = process.env.BAKE_OVERRIDE ? JSON.parse(process.env.BAKE_OVERRIDE) : {};
const cfg = kind => ({ ...SETTINGS[kind], ...(overrides[kind] || {}) });

const sources = fs.readdirSync(here).filter(f => f.endsWith('.mjs')).sort().map(f => fs.readFileSync(path.join(here, f), 'utf8')).join('\n');
const tool = (() => { try { return execFileSync('magick', ['-version'], { encoding: 'utf8' }).split('\n')[0]; } catch { throw new Error('ImageMagick (magick) with WebP support is required to bake the art'); } })();
const key = (id, c) => crypto.createHash('sha256').update(sources).update(tool).update(id).update(JSON.stringify(c)).digest('hex').slice(0, 24);

const assets = listAssets();
const todo = [];
const manifest = { files: {}, geometry: GEOMETRY };
for (const a of assets) {
  const c = { ...cfg(a.kind), ...a.tune }, k = key(a.id, c), cached = path.join(cacheDir, k + '.webp'), dest = path.join(out, a.id + '.webp');
  a.c = c; a.cached = cached; a.dest = dest;
  if (fs.existsSync(cached)) { fs.copyFileSync(cached, dest); a.hit = true; } else todo.push(a);
}
if (todo.length) {
  const jobs = todo.map(a => { const m = a.make(); a.m = m; const [, , w, h] = m.frame; return { name: a.id, svg: m.plate.svg(m.frame, { scale: a.c.res }), width: w * a.c.res, height: h * a.c.res, alpha: a.c.alpha }; });
  const byId = new Map(todo.map(a => [a.id, a]));
  await rasterize(jobs, (job, png) => {
    const a = byId.get(job.name), tmpPng = path.join(cacheDir, a.id + '.png');
    fs.writeFileSync(tmpPng, png);
    const args = [tmpPng, '-quality', String(a.c.quality), '-define', 'webp:method=6', '-define', 'webp:alpha-quality=' + (a.c.alphaQuality ?? 90), '-define', 'webp:alpha-compression=1', '-define', 'webp:exact=false'];
    execFileSync('magick', [...args, a.cached]);
    fs.unlinkSync(tmpPng);
    fs.copyFileSync(a.cached, a.dest);
  });
}
for (const a of assets) {
  const size = execFileSync('magick', ['identify', '-format', '%w %h', a.dest + '[0]'], { encoding: 'utf8' }).split(' ').map(Number);
  manifest.files[a.id] = { w: size[0], h: size[1], bytes: fs.statSync(a.dest).size, res: a.c.res };
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log('baked ' + assets.length + ' assets (' + todo.length + ' drawn, ' + (assets.length - todo.length) + ' from cache) into ' + out + ' - ' + Math.round(Object.values(manifest.files).reduce((s, f) => s + f.bytes, 0) / 1024) + ' KB');
if (process.env.BAKE_REPORT) for (const [id, f] of Object.entries(manifest.files)) console.log(id.padEnd(34), String(f.w + 'x' + f.h).padEnd(10), (f.bytes / 1024).toFixed(1) + ' KB');
