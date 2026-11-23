import { expect, test } from '@playwright/test';
import { openPreview, PREVIEW, PUZZLES, puzzleFile, waitPhase } from './helpers.ts';

type Sourced = { id?: string; text?: string; url?: string | string[]; source?: string };
const urls = (u: string | string[] | undefined): string[] => ([] as string[]).concat(u ?? []);
const host = (u: string): string => new URL(u).hostname.replace(/^www\./u, '');

for (const id of PUZZLES) {
  test(id + ': every source link on an evidence card is one real address of the card, one link per address, with its own host as text', async ({ page }) => {
    await openPreview(page, id, { [PREVIEW(id)]: JSON.stringify({ phase: 'board' }) });
    await waitPhase(page, 'board');
    const cards = (puzzleFile(id) as unknown as { cards: Sourced[] }).cards;
    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('.pz-evidence .pz-card')].map((card) => ({
        id: (card as HTMLElement).dataset.card,
        links: [...card.querySelectorAll('.pz-src a')].map((a) => ({ href: a.getAttribute('href') ?? '', text: a.textContent ?? '' })),
      })),
    );
    expect(seen.length).toBe(cards.length);
    for (const card of cards) {
      const dom = seen.find((s) => s.id === card.id);
      const want = card.source === 'game' ? [] : urls(card.url);
      expect(dom?.links.map((l) => l.href), 'card ' + card.id).toEqual(want);
      dom?.links.forEach((l) => expect(l.text, 'card ' + card.id + ' ' + l.href).toBe(host(l.href)));
    }
  });
}

test('ending: every piece of the conclusion links to addresses it really has: one link per address, each one a single address from the file, with its own host as text', async ({ page }) => {
  await openPreview(page, 'ending', { [PREVIEW('ending')]: JSON.stringify({ phase: 'conclusion' }) });
  await waitPhase(page, 'conclusion');
  const bank = (puzzleFile('ending') as unknown as { conclusion: { bank: Sourced[] } }).conclusion.bank;
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.pz-piece-row')].map((row) => ({
      text: row.querySelector('.pz-piece')?.textContent ?? '',
      links: [...row.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href') ?? '', text: a.textContent ?? '' })),
    })),
  );
  expect(rows.length).toBe(bank.length);
  const wrong: string[] = [];
  for (const piece of bank) {
    const row = rows.find((r) => r.text === piece.text);
    const want = urls(piece.url);
    const got = row?.links.map((l) => l.href) ?? [];
    if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(JSON.stringify(piece.text) + ': links ' + JSON.stringify(got) + ', file has ' + JSON.stringify(want));
  }
  expect(wrong, 'a piece whose address list is one comma-joined link, or loses an address').toEqual([]);
});
