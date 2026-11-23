import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const notebooks = readdirSync('story/notebook').filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5));

for (const [label, size] of [['320x568', { width: 320, height: 568 }], ['390x844', { width: 390, height: 844 }]] as const) {
  test('a number range in a Sổ nguồn card never breaks across lines, and card text stays verbatim, at ' + label, async ({ page }) => {
    await page.setViewportSize(size);
    const bad: string[] = [];
    for (const id of notebooks) {
      const entry = JSON.parse(readFileSync('story/notebook/' + id + '.json', 'utf8')) as { card?: string[]; full?: Record<string, Array<{ text: string }>> };
      await page.goto('/?preview=card:' + id);
      await page.waitForTimeout(500);
      const card = page.locator('#card-screen .card[data-chapter=' + id + ']');
      expect(await card.count(), 'Sổ nguồn card renders for ' + id).toBe(1);
      for (const sum of await page.locator('#card-screen details summary').all()) await sum.click();
      const broken = await page.evaluate(() => {
        const cardEl = document.querySelector('#card-screen .card')!;
        const cardRect = cardEl.getBoundingClientRect();
        const out: string[] = [];
        for (const node of cardEl.querySelectorAll('*')) {
          for (const child of node.childNodes) {
            if (child.nodeType !== Node.TEXT_NODE) continue;
            for (const m of (child.textContent ?? '').matchAll(/\d+–\d+/gu)) {
              const range = document.createRange();
              range.setStart(child, m.index ?? 0);
              range.setEnd(child, (m.index ?? 0) + m[0].length);
              const rects = [...range.getClientRects()].filter((r) => r.width > 0);
              if (!rects.length) continue;
              if (new Set(rects.map((r) => Math.round(r.top))).size > 1) out.push(m[0] + ' breaks across lines');
              if (rects.some((r) => r.left < cardRect.left - 0.5 || r.right > cardRect.right + 0.5)) out.push(m[0] + ' sticks out of the card');
            }
          }
        }
        return out;
      });
      for (const b of broken) bad.push(id + ': ' + b);
      const body = (await card.textContent()) ?? '';
      for (const line of entry.card ?? []) if (!body.includes(line)) bad.push(id + ': card text not verbatim: ' + line.slice(0, 40));
      for (const points of Object.values(entry.full ?? {})) for (const p of points ?? []) if (!body.includes(p.text)) bad.push(id + ': full text not verbatim: ' + p.text.slice(0, 40));
    }
    expect(bad, 'number ranges must never break across lines and text must stay verbatim').toEqual([]);
  });
}

test('dialog paddings declare the safe-area insets and keep their base sizes when env() is 0', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const computed = async (): Promise<string[]> => {
    return page.evaluate(() => {
      const d = document.createElement('dialog');
      document.body.append(d);
      const cs = getComputedStyle(d);
      const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft];
      d.remove();
      return pad;
    });
  };
  expect(await computed(), 'base dialog padding, top right bottom left').toEqual(['18px', '20px', '20px', '20px']);

  await page.setViewportSize({ width: 844, height: 390 });
  expect(await computed(), 'landscape dialog padding, top right bottom left').toEqual(['10px', '16px', '12px', '16px']);

  // Playwright emulation always resolves env(safe-area-inset-*) to 0px, so a real inset cannot be simulated;
  // the shipped stylesheet must derive every dialog padding from those insets instead.
  const decls = await page.evaluate(() => {
    const out: Array<{ media: string; padding: string }> = [];
    const walk = (rules: CSSRuleList, media: string): void => {
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule) {
          walk(rule.cssRules, rule.conditionText);
          continue;
        }
        if (rule instanceof CSSStyleRule && rule.selectorText?.split(',').map((s) => s.trim()).includes('dialog')) {
          const padding = rule.style.getPropertyValue('padding');
          if (padding) out.push({ media, padding });
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, '');
      } catch {
        // cross-origin sheet: none exist here
      }
    }
    return out;
  });
  expect(decls.length, 'dialog padding rules found in the shipped stylesheet').toBeGreaterThanOrEqual(2);
  const base = decls.find((d) => d.media === '');
  const land = decls.find((d) => d.media.includes('landscape'));
  for (const rule of [base, land]) {
    const padding = rule?.padding.replace(/\s+/gu, '');
    expect(padding, 'dialog padding uses env(safe-area-inset-top, 0px)').toContain('env(safe-area-inset-top,0px)');
    expect(padding, 'dialog padding uses env(safe-area-inset-right, 0px)').toContain('env(safe-area-inset-right,0px)');
    expect(padding, 'dialog padding uses env(safe-area-inset-bottom, 0px)').toContain('env(safe-area-inset-bottom,0px)');
    expect(padding, 'dialog padding uses env(safe-area-inset-left, 0px)').toContain('env(safe-area-inset-left,0px)');
  }
});
