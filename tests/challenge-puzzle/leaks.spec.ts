import { expect, test } from '@playwright/test';
import { expectClean, monitor } from '../support/helpers.ts';
import { stateOf } from '../support/play.ts';
import { reply } from '../../scripts/puzzles.mjs';
import { asList, cool, clearBlanks, clearBoard, domClick, KEY, openPuzzle, openSeeded, pickPiece, placeAll, puzzleFile, puzzleOf, PUZZLES, stored, type Cell } from './helpers.ts';

interface Authoring {
  hints: { text: string; solves?: boolean }[];
  reveal: { lines: string[] };
  conclusion?: { bank: { text: string; label: string }[] };
  tokens: { id: string; text: string; status: string }[];
}

const strings = (x: unknown): string[] => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(strings) : x !== null && typeof x === 'object' ? Object.values(x).flatMap(strings) : []);

test.describe('what the data chunk ships: network', () => {
  for (const id of ['intro', 'dec25', 'ending'] as const) {
    test(id + ': no file the page loads before the first tap carries the authoring notes, the evidence quotes, the hint fills or the wrong-frame prose', async ({ page, baseURL }) => {
      const m = monitor(page);
      const bodies: { url: string; text: string }[] = [];
      page.on('response', async (r) => {
        if (!/\/assets\/.+\.(js|json)$/u.test(new URL(r.url()).pathname)) return;
        bodies.push({ url: new URL(r.url()).pathname, text: await r.text().catch(() => '') });
      });
      await openPuzzle(page, id);
      await page.waitForTimeout(300);
      const file = puzzleFile(id) as unknown as Authoring & Record<string, unknown>;
      const all = bodies.map((b) => b.text).join('\n');
      const unread = strings([
        file.aha,
        file.history,
        file.antiGuess,
        file.space,
        (file.hints as { fills?: unknown }[]).map((h) => h.fills),
        (file.cards as { evidence?: unknown }[]).map((c) => c.evidence),
        (file.tokens as { evidence?: unknown }[]).map((t) => t.evidence),
        (file.conclusion as { bank: { evidence?: unknown }[] } | undefined)?.bank.map((b) => b.evidence),
        (file.wrongFrame as { text?: unknown; message?: unknown }).text,
        (file.wrongFrame as { text?: unknown; message?: unknown }).message,
      ]).filter((t) => t.length >= 12);
      expect(unread.length, 'the file has authoring text to look for').toBeGreaterThan(0);
      const leaks = unread.filter((t) => (all.includes(t) || all.includes(JSON.stringify(t).slice(1, -1))));
      expect(leaks, 'shipped in ' + bodies.map((b) => b.url).join(', ')).toEqual([]);
      expectClean(m, baseURL as string);
    });
  }

  test('the player chunk carries no solver, no bots and no authoring checker', async ({ page }) => {
    const pending: Promise<string>[] = [];
    page.on('response', (r) => {
      if (/\/assets\/puzzle-[^/]+\.js$/u.test(new URL(r.url()).pathname)) pending.push(r.text().catch(() => ''));
    });
    await openPuzzle(page, 'dec25');
    const bodies = await Promise.all(pending);
    const all = bodies.join('\n');
    expect(bodies.length).toBeGreaterThan(0);
    const found = ['antiGuess', 'allArrangements', 'solveLevels', 'propagate', 'conclusionStats', 'checkData', 'bankFlags', 'spearman', 'registerOp'].filter((n) => all.includes(n));
    expect(found).toEqual([]);
  });
});

test.describe('the answer before solving: DOM, aria, storage', () => {
  for (const id of ['intro', 'dec25', 'ending'] as const) {
    test(id + ': the page before the first check holds no reveal line, no hint, no status attribute on pieces', async ({ page }) => {
      const file = puzzleFile(id) as unknown as Authoring;
      await openSeeded(page, id, { phase: 'board' });
      const html = await page.evaluate(() => document.documentElement.outerHTML);
      for (const line of file.reveal.lines) expect(html, 'reveal line in the DOM').not.toContain(line);
      for (const h of file.hints) expect(html, 'hint text in the DOM').not.toContain(h.text);
      const bad = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll('.pz-piece, .pz-slot, .pz-slot-btn, .pz-bank, .pz-board, .pz-gap, .pz-blank')) {
          for (const a of el.attributes) {
            const word = a.name === 'aria-label' ? /đúng|sai|chính xác|SỰ THẬT|TRANH CÃI|TRUYỀN THUYẾT|decoy|legend|disputed|correct|wrong/iu : /fact|legend|disputed|decoy|solution|answer|correct|truth|status|wrong|valid/iu;
            if (a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'title' ? word.test((a.name.startsWith('data-') ? a.name + '=' : '') + a.value.replace(/^(?:piece|chip|slot|blank):/u, '')) : false) out.push(el.className + ' ' + a.name + '=' + a.value);
          }
        }
        return out;
      });
      expect(bad, 'attributes that name a status or answer').toEqual([]);
      const state = JSON.stringify(await stateOf(page));
      expect(state).not.toMatch(/solution|answer/iu);
      for (const line of file.reveal.lines) expect(state).not.toContain(line);
    });
  }

  test('ending conclusion: no piece or blank shows or hides a label, the decoy word or a status in text, attributes or aria', async ({ page }) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    const text = await page.evaluate(() => document.querySelector('.pz-conclusion')?.outerHTML ?? '');
    expect(text).not.toMatch(/SỰ THẬT|TRANH CÃI|TRUYỀN THUYẾT|CHƯA CÓ NGUỒN|decoy|legend|disputed/u);
    const aria = await page.evaluate(() => [...document.querySelectorAll('.pz [aria-label]')].map((e) => e.getAttribute('aria-label') ?? '').join('|'));
    expect(aria).not.toMatch(/SỰ THẬT|TRANH CÃI|TRUYỀN THUYẾT|CHƯA CÓ NGUỒN/u);
  });

  test('ending conclusion: the piece ids in the DOM are not the authoring indices, which are grouped by label', async ({ page }) => {
    const file = puzzleFile('ending') as unknown as Authoring;
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    const dom = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pz-piece')].map((b) => ({ id: Number(b.dataset.piece), text: b.textContent ?? '' })));
    const bank = (file.conclusion as NonNullable<Authoring['conclusion']>).bank;
    const same = dom.filter((d) => bank[d.id]?.text === d.text && bank.findIndex((b) => b.text === d.text) === d.id).length;
    expect(dom.length).toBe(bank.length);
    expect(same, 'pieces whose DOM id is their position in the label-grouped authoring list').toBeLessThanOrEqual(1);
  });

  test('ending conclusion: the order of the pieces on screen is not the authoring order and not grouped by label', async ({ page }) => {
    const file = puzzleFile('ending') as unknown as Authoring;
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    const ids = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pz-piece')].map((b) => Number(b.dataset.piece)));
    const bank = (file.conclusion as NonNullable<Authoring['conclusion']>).bank;
    expect(ids).not.toEqual([...ids].sort((a, b) => a - b));
    const labels = ids.map((i) => bank[i]?.label);
    const grouped = JSON.stringify(labels) === JSON.stringify([...labels].sort());
    expect(grouped, 'pieces on screen sorted by label').toBe(false);
  });

  test('storage after wrong checks and a hint holds the player\'s own moves only', async ({ page }) => {
    const file = puzzleFile('dec25');
    await openSeeded(page, 'dec25', { phase: 'board' });
    await placeAll(page, file, [['hyp'], ['xm', 'sun'], ['birth']]);
    await cool(page);
    await domClick(page, '#pz-check');
    await cool(page);
    await domClick(page, '#pz-hint');
    const raw = (await stored(page, 'dec25')) as string;
    const s = JSON.parse(raw) as Record<string, unknown>;
    expect(Object.keys(s).sort()).toEqual(['board', 'cWrong', 'checks', 'fills', 'found', 'nudge', 'opened', 'phase', 'pointed', 'predicted', 'wrongRun', 'wrongTotal']);
    expect(s.found).toEqual([]);
    expect(s.board).toEqual([['hyp'], ['xm', 'sun'], ['birth']]);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.filter((k) => k.includes('teo:v1:puzzle'))).toEqual([KEY('dec25')]);
    expect(keys.filter((k) => k.startsWith('teo:v1:puzzle')), 'a preview writes no real progress key').toEqual([]);
    const hints = file.hints;
    expect(raw).not.toContain((hints[2] as { text: string }).text);
  });

  test('one tier at a time: after the first hint only its text is on the page', async ({ page }) => {
    const file = puzzleFile('ending');
    await openSeeded(page, 'ending', { phase: 'board' });
    await cool(page);
    await domClick(page, '#pz-hint');
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    expect(html).toContain((file.hints[0] as { text: string }).text);
    for (const h of file.hints.slice(1)) expect(html).not.toContain(h.text);
    expect((await page.locator('#pz-hint').getAttribute('aria-label')) ?? '').not.toContain((file.hints[1] as { text: string }).text);
  });
});

test.describe('bank order and bank-shaped guesses never solve', () => {
  for (const id of PUZZLES) {
    test(id + ': every board a player gets by dropping the bank in order is turned down, as the checker says', async ({ page }) => {
      const file = puzzleFile(id);
      await openSeeded(page, id, { phase: 'board' });
      const core = (await import('../../scripts/puzzles.mjs')) as unknown as { bankBoards: (p: unknown) => [string, number[]][] };
      const boards = core.bankBoards(file);
      for (const [name, v] of boards) {
        const cells: Cell[] = file.slots.map((_, i) => {
          const ids = file.tokens.filter((_t, t) => v[t] === i + 1).map((t) => t.id);
          return ids.length ? ids : null;
        });
        await clearBoard(page);
        await placeAll(page, file, cells);
        const expected = reply(file, cells.map((c) => (c === null ? [] : asList(c))), new Set());
        await cool(page);
        await domClick(page, '#pz-check');
        const p = await puzzleOf(page);
        expect(expected.type, name + ' is a solution by the checker').not.toBe('solved');
        expect(p.phase, name + ' reached the reveal').toBe('board');
      }
    });
  }

  test('ending conclusion: the pieces in on-screen order, reversed, and in authoring order never solve it', async ({ page }) => {
    await openSeeded(page, 'ending', { phase: 'conclusion' });
    const bank = (puzzleFile('ending').conclusion as NonNullable<Authoring['conclusion']>).bank;
    const texts = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pz-piece')].map((b) => b.textContent));
    const shown = texts.map((t) => bank.findIndex((p) => p.text === t));
    const orders = [shown.slice(0, 6), shown.slice().reverse().slice(0, 6), [0, 1, 2, 3, 4, 5], [6, 5, 4, 3, 2, 1]];
    for (const order of orders) {
      await clearBlanks(page);
      for (const [i, j] of order.entries()) {
        await pickPiece(page, j);
        await domClick(page, '.pz-blank[data-blank="' + i + '"]');
      }
      await cool(page);
      await domClick(page, '#pz-check');
      const p = await puzzleOf(page);
      expect(p.phase, 'order ' + order.join(',')).toBe('conclusion');
    }
  });
});
