import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const dist = join(process.cwd(), 'dist');
const firstScene = process.env.FIRST_SCENE ?? 'intro';
const limit = Number(process.env.FIRST_LOAD_MAX_BYTES ?? 1_000_000);
const webpLimit = Number(process.env.WEBP_MAX_BYTES ?? 400_000);

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(dist);

const rows = [];
for (const path of files.sort()) {
  const data = await readFile(path);
  rows.push({
    file: path.slice(dist.length + 1),
    raw: data.length,
    gzip: gzipSync(data, { level: 9 }).length,
    brotli: brotliCompressSync(data).length,
  });
}
const sum = (list, key) => list.reduce((total, row) => total + row[key], 0);
const js = rows.filter((row) => row.file.endsWith('.js'));
const webp = rows.filter((row) => row.file.endsWith('.webp'));

// First load = what a real browser fetches from the first request until the first story screen has been idle for 2 s, with no tap, in the larger of
// the two phone orientations (firstLoadPlusFirstTapKB adds what the first tap starts to fetch). Text is counted gzip -9, binary files (WebP, woff2) as served.
const { createServer } = await import('node:net');
const { spawn } = await import('node:child_process');
const { createRequire } = await import('node:module');
const cache = join(process.env.TMPDIR ?? '/var/tmp', 'Game', 'cache', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
if (process.platform === 'linux' && !process.env.CI) process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= '1';
const { chromium } = createRequire(import.meta.url)('playwright');
const port = await new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});
const server = spawn(process.execPath, [join(process.cwd(), 'tests/support/serve-dist.mjs')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i += 1) {
  if (await fetch(base).then((r) => r.ok, () => false)) break;
  await new Promise((resolve) => setTimeout(resolve, 100));
}
const orientations = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const loads = {};
const afterTap = {};
const browser = await chromium.launch();
try {
  for (const [name, viewport] of Object.entries(orientations)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 3, hasTouch: true });
    const page = await context.newPage();
    const pending = [];
    const fetched = new Map();
    page.on('response', (response) => {
      pending.push(response.body().then((body) => {
        const path = new URL(response.url()).pathname.replace(/^\//, '') || 'index.html';
        fetched.set(path, { gzip: /\.(js|css|svg|html)$/.test(path) ? gzipSync(body, { level: 9 }).length : body.length });
      }, () => undefined));
    });
    await page.goto(base);
    await page.waitForFunction(() => window.render_game_to_text && JSON.parse(window.render_game_to_text()).shell.phase === 'ready');
    await page.waitForTimeout(2000);
    await Promise.all(pending);
    loads[name] = new Map(fetched);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await Promise.all(pending);
    afterTap[name] = +(sum([...fetched.values()], 'gzip') / 1000).toFixed(1);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
const [worst, fetchedFiles] = Object.entries(loads).sort((a, b) => sum([...b[1].values()], 'gzip') - sum([...a[1].values()], 'gzip'))[0];
const firstLoad = [...fetchedFiles].map(([file, { gzip }]) => ({ file, gzip }));
const firstLoadBytes = sum(firstLoad, 'gzip');
const byType = {};
for (const row of firstLoad) byType[row.file.split('.').pop()] = (byType[row.file.split('.').pop()] ?? 0) + row.gzip;
for (const type of Object.keys(byType)) byType[type] = +(byType[type] / 1000).toFixed(1);

console.table(rows);
// WebP a chapter loads = the files its own chunk names (plate, cast sprites, machine layers, props); sprites shared between chapters count in each.
const byName = new Map(webp.map((row) => [row.file.slice('assets/'.length), row.raw]));
const perChapter = {};
for (const row of js.filter((r) => /^assets\/chapter-[a-z0-9]+-/.test(r.file))) {
  const names = new Set((await readFile(join(dist, row.file), 'utf8')).match(/[\w.-]+\.webp/g) ?? []);
  perChapter[row.file.match(/chapter-([a-z0-9]+)-/)[1]] = [...names].reduce((total, name) => total + (byName.get(name) ?? 0), 0);
}
console.log(JSON.stringify({
  jsGzipKB: +(sum(js, 'gzip') / 1000).toFixed(1),
  jsGzipKiB: +(sum(js, 'gzip') / 1024).toFixed(1),
  jsBrotliKB: +(sum(js, 'brotli') / 1000).toFixed(1),
  firstLoadOrientation: worst,
  firstLoadPlusFirstTapKB: afterTap,
  firstLoadByOrientationKB: Object.fromEntries(Object.entries(loads).map(([name, map]) => [name, +(sum([...map.values()], 'gzip') / 1000).toFixed(1)])),
  firstLoadFiles: firstLoad.map((row) => row.file).sort(),
  firstLoadByTypeKB: byType,
  firstLoadGzipKB: +(firstLoadBytes / 1000).toFixed(1),
  jsRawKB: +(sum(js, 'raw') / 1000).toFixed(1),
  webpKB: +(sum(webp, 'raw') / 1000).toFixed(1),
  webpPerChapterKB: Object.fromEntries(Object.entries(perChapter).map(([id, bytes]) => [id, +(bytes / 1000).toFixed(1)])),
}));
if (!firstLoad.some((row) => row.file.startsWith(`assets/chapter-${firstScene}-`)) || firstLoadBytes > limit) {
  console.error(`first load ${firstLoadBytes} B gzip exceeds ${limit} B or misses the ${firstScene} script chunk`);
  process.exit(1);
}
for (const [id, bytes] of Object.entries(perChapter)) {
  if (bytes > webpLimit) {
    console.error(`chapter ${id} loads ${bytes} B of baked WebP art, over ${webpLimit} B`);
    process.exit(1);
  }
}
