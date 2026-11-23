import { expect, test } from '@playwright/test';
import { expectClean, monitor } from '../support/helpers.ts';
import { openPreview, PREVIEW, probeBoards, PUZZLES, puzzleFile, reply, runBoards, toBoard } from './helpers.ts';

const WRONG = 'Chưa khớp với các thẻ.';
const KEEP = ['phase', 'predicted', 'opened', 'found', 'cWrong', 'pointed', 'fills'];

/** The reply to a board that is not a solution says nothing but its count of empty places or a plain wrong: the same words, the same counters, the same sound, no hint opened, no card pointed at, no change to the page. */
for (const id of PUZZLES) {
  test(id + ': every single piece, pair, near solution, wrong-frame and bank-order board gets only the plain reply of its kind', async ({ page, baseURL }, info) => {
    const m = monitor(page);
    await openPreview(page, id);
    await toBoard(page, info);
    const file = puzzleFile(id);
    const probes = probeBoards(id);
    expect(probes.length, 'the probe set is not empty').toBeGreaterThan(30);
    const seen = await runBoards(page, id, probes.map((p) => p.cells), PREVIEW(id));
    const problems: string[] = [];
    const kinds = new Set<string>();
    const sounds = new Set<number>();
    let run = 0;
    let checks = 0;
    seen.forEach(({ before, after }, i) => {
      const probe = probes[i] as (typeof probes)[number];
      const oracle = reply(file, probe.cells, new Set()) as { type: string; empty?: number };
      const tag = probe.kind + ' ' + JSON.stringify(probe.cells);
      kinds.add(probe.kind.replace(/ without .*| \(.*$|: .*/u, ''));
      sounds.add(after.played - before.played);
      if (oracle.type === 'incomplete') {
        if (after.game.verdict !== 'Chưa đủ: còn ' + oracle.empty + ' chỗ chưa có mảnh.') problems.push(tag + ' incomplete said: ' + after.game.verdict);
      } else if (oracle.type === 'wrong') {
        run += 1;
        checks += 1;
        const want = WRONG + (run >= 3 ? ' Đã ' + run + ' lần liền: bấm Gợi ý để mở bậc kế tiếp.' : '');
        if (after.game.verdict !== want) problems.push(tag + ' wrong said: ' + after.game.verdict + ' (wanted: ' + want + ')');
        if (after.game.nudge !== run >= 3 || after.nudgeAttr !== String(run >= 3)) problems.push(tag + ' nudge ' + after.game.nudge + '/' + after.nudgeAttr + ' at run ' + run);
      } else problems.push(tag + ' the checker says ' + oracle.type + ': a probe must not be a solution');
      const g = after.game;
      if (g.phase !== 'board' || g.completed) problems.push(tag + ' left the board: ' + g.phase);
      if (g.hints !== 0 || g.hint !== '' || g.pointed.length || g.found !== 0) problems.push(tag + ' opened a hint or pointed at a card: hints ' + g.hints + ' pointed ' + g.pointed + ' found ' + g.found);
      if (g.checks !== checks || g.wrong !== run || g.wrongTotal !== checks) problems.push(tag + ' counters ' + g.checks + '/' + g.wrong + '/' + g.wrongTotal + ', wanted ' + checks + '/' + run + '/' + checks);
      if (after.scroll !== before.scroll) problems.push(tag + ' the page body changed under the check (a card or piece was marked)');
      for (const k of KEEP) if (JSON.stringify(before.stored?.[k]) !== JSON.stringify(after.stored?.[k])) problems.push(tag + ' saved ' + k + ' changed: ' + JSON.stringify(before.stored?.[k]) + ' -> ' + JSON.stringify(after.stored?.[k]));
    });
    expect(problems.slice(0, 8), problems.length + ' boards answered more than the plain reply').toEqual([]);
    expect([...sounds].length, 'the same sound for every kind of reply: ' + [...sounds]).toBe(1);
    expect([...kinds].sort().join('|')).toContain('single');
    expectClean(m, baseURL as string);
  });
}

test('the replies to the same board are the same on a second visit: the wrong-frame board of every puzzle is answered exactly like a random wrong board', async ({ page }, info) => {
  const frames: Record<string, string> = {};
  for (const id of PUZZLES) {
    await openPreview(page, id);
    await toBoard(page, info);
    const probes = probeBoards(id);
    const file = puzzleFile(id);
    const wf = probes.filter((p) => p.kind.startsWith('wrong frame')).slice(0, 1);
    const generic = probes.filter((p) => p.kind === 'any rules board' && (reply(file, p.cells, new Set()) as { type: string }).type === 'wrong').slice(0, 1);
    if (!wf.length) continue;
    const cards = await page.evaluate(() => document.querySelector('.pz-cards, .pz-evidence')?.outerHTML ?? '');
    const a = await runBoards(page, id, [...wf, ...generic].map((p) => p.cells), PREVIEW(id));
    const sig = (o: (typeof a)[number]['after']): string => JSON.stringify({ v: o.game.verdict.replace(/\d+/gu, 'N'), h: o.game.hints, p: o.game.pointed, hint: o.game.hint, nudge: o.nudgeAttr, w: o.msgs.replace(/\d+/gu, 'N') });
    frames[id] = sig(a[0]!.after) === sig(a[1]!.after) && (await page.evaluate(() => document.querySelector('.pz-cards, .pz-evidence')?.outerHTML ?? '')) === cards ? 'same' : 'differs: ' + sig(a[0]!.after) + ' vs ' + sig(a[1]!.after);
  }
  expect(Object.values(frames).every((v) => v === 'same'), JSON.stringify(frames)).toBe(true);
  expect(Object.keys(frames).length, 'at least the four puzzles with a wrong frame were compared').toBeGreaterThanOrEqual(4);
});
