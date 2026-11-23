const fs = require('fs');
const path = require('path');
const os = require('os');
const dir = path.resolve(process.argv[2] || path.join(process.env.TMPDIR || os.tmpdir(), 'Game', 'art-style'));
const cache = path.join(process.env.TMPDIR || '/var/tmp', 'Game', 'cache', 'ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(cache)) process.env.PLAYWRIGHT_BROWSERS_PATH = cache;
const { chromium } = require('playwright');
(async () => {
  const dprs = (process.env.DPR || '2').split(',').map(Number);
  const b = await chromium.launch();
  for (const dpr of dprs) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
    for (const n of ['story', 'puzzle']) {
      const f = path.join(dir, n + '.html');
      if (!fs.existsSync(f)) continue;
      const p = await ctx.newPage();
      p.on('pageerror', e => console.log(n, 'ERR', e.message));
      await p.goto('file://' + f);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(300);
      const png = path.join(dir, dpr === 2 ? n + '.png' : n + '@' + dpr + 'x.png');
      await p.screenshot({ path: png });
      console.log(png, (await p.evaluate(() => [...document.fonts].filter(x => x.status === 'loaded').map(x => x.family))).join(','));
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
})();
