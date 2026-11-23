// Rasterizer: headless Chromium (Playwright, already a dev dependency) draws each SVG to a PNG; no network, no paid service.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const tmp = path.join(process.env.TMPDIR || '/var/tmp', 'Game');
const browsers = path.join(tmp, 'cache', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(browsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
if (process.platform === 'linux' && !process.env.CI) process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= '1';

export async function rasterize(jobs, onDone) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const out = [];
  for (const job of jobs) {
    const w = Math.round(job.width), h = Math.round(job.height);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:${job.alpha ? 'transparent' : '#ece2c8'}">${job.svg}</body></html>`);
    const png = await page.screenshot({ omitBackground: Boolean(job.alpha), clip: { x: 0, y: 0, width: w, height: h } });
    out.push(png);
    if (onDone) await onDone(job, png);
  }
  await browser.close();
  return out;
}
