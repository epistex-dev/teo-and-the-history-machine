import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { stubIds } from './support/stubs.ts';

const root = process.cwd();
const files = readdirSync(join(root, 'story/puzzles')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const puzzle = (id: string) => JSON.parse(readFileSync(join(root, 'story/puzzles', id + '.json'), 'utf8'));

const scratchDir = () => mkdtempSync(join(tmpdir(), 'puzzles-spec-'));
const run = (code: string, arg?: unknown) => {
  const r = spawnSync('node', ['--input-type=module', '-e', "import * as P from './scripts/puzzles.mjs'; import { readFileSync as R } from 'node:fs'; const arg = JSON.parse(R(0, 'utf8')); " + code], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, input: JSON.stringify(arg ?? null) });
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout);
};

type Levels = { l1: number; run: number; l2: number; path: string[]; deep: boolean };
const check = (p: any, full = false, minL2 = 0) => run("const r = P.checkData(arg.p, arg.p.id, { full: arg.full, minL2: arg.minL2 }); console.log(JSON.stringify({ errors: r.errors, warnings: r.warnings, space: r.info.space, count: r.info.count, depth: r.info.prop?.depth, levels: r.info.levels, rho: r.info.rho, bots: r.info.bots }));", { p, full, minL2 }) as { errors: string[]; space: number; count: number; depth: number; levels: Levels; rho: number | null; bots: Record<string, number>; warnings: string[] };
const errorsOf = (p: any, full = false, minL2 = 0) => check(p, full, minL2).errors.join('\n');
const replies = (p: any, boards: unknown[]) => run("const f = new Set(); console.log(JSON.stringify(arg.boards.map((b) => P.reply(arg.p, b, f))));", { p, boards }) as any[];

const SRC = {
  a: { source: 'research/m0b-act-1.md', url: 'https://penelope.uchicago.edu/encyclopaedia_romana/calendar/invictus.html', evidence: ['is annotated N INVICTI CM XXX'] },
  b: { source: 'research/m0b-act-1.md', url: 'https://www.historytoday.com/archive/months-past/first-christmas-celebration', evidence: ['By 380 the day was being celebrated in Constantinople'] },
  c: { source: 'research/m0b-act-1.md', url: 'https://www.liverpool.ac.uk/history/blog/2023/first-noel/', evidence: ['generally thought that this calendar was first produced in 336'] },
};
const common = () => ({
  format: 'T', input: 'order', goal: 'sequence', orientation: 'both', history: 'fx',
  question: 'Xếp các mốc theo thẻ.', aha: 'Một mốc không thẻ nào nhắc tới vẫn xác định được.',
  rules: [{ text: 'Chạm một mảnh rồi chạm một ô.' }],
  hints: [
    { tier: 1, text: 'Câu hỏi: xếp các mốc sao cho khớp mọi thẻ.' },
    { tier: 2, card: 'c2', text: 'Đọc thẻ 2.' },
    { tier: 3, text: 'Có đang đợi một thẻ nói riêng về từng mốc không?' },
    { tier: 4, fills: {}, text: 'Một mốc đã có chỗ.' },
    { tier: 5, solves: true, text: 'Nhờ Cúc Cu soi tỏ: Tèo xếp một cách khớp.' },
  ],
  wrongFrame: { text: 'Mốc đầu tiên luôn ở ô đầu.', cards: ['c3'] },
  reveal: { lines: ['Các thẻ đủ để xếp, kể cả mốc không ai nhắc.'], label: '—' },
  antiGuess: { rule: 'Kiểm tra chấm cả bảng một lần.' },
});
const TEXT: Record<string, string> = { ka: 'Mốc lịch', kb: 'Mốc cây', kc: 'Mốc thiệp', kd: 'Mốc đèn', ke: 'Mốc máy', kf: 'Mốc nến' };
const tokens = (ids: string[]) => ids.map((id) => ({ id, text: TEXT[id], status: 'fact' }));
const slots5 = () => [1, 2, 3, 4, 5].map((i) => ({ id: 's' + i, label: String(i) }));

// 6 tokens, 5 slots: 720 valid states, one solution, kf unused.
const orderFx = (): any => ({
  ...common(), id: 'fx', title: 'Thử', space: 720, bankSeed: 1, slots: slots5(), tokens: tokens(['ka', 'kb', 'kc', 'kd', 'ke', 'kf']),
  cards: [
    { id: 'c1', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.c, text: 'Nếu mốc nến có chỗ, nó đứng trước mốc lịch.', do: { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['lt', ['slot', 'kf'], ['slot', 'ka']]] } },
    { id: 'c2', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.a, text: 'Mốc máy nằm giữa mốc thiệp và mốc lịch.', do: { op: 'between', t: ['kc', 'ke', 'ka'] } },
    { id: 'c3', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.b, text: 'Mốc lịch đứng giữa dãy.', do: { op: 'at', t: 'ka', s: 's3' } },
    { id: 'c4', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.c, text: 'Mốc cây đứng cuối.', do: { op: 'at', t: 'kb', s: 's5' } },
  ],
  solutions: [['kc', 'ke', 'ka', 'kd', 'kb']],
  hints: Object.assign(common().hints, { 3: { tier: 4, fills: { s3: 'ka', s5: 'kb' }, text: 'Hai mốc đã có chỗ.' } }),
  wrongFrame: { text: 'Mốc đầu tiên luôn ở ô đầu.', cards: ['c3'], trap: { s1: 'ka' }, do: { op: 'at', t: 'ka', s: 's1' }, message: 'Chưa khớp: một thẻ đang mâu thuẫn.' },
});

// 5 tokens, 5 slots: 120 valid states, three solutions one swap apart (the shape of the old dec25).
const weakFx = (): any => ({
  ...common(), id: 'wk3', title: 'Ba cách', goal: 'find-all', space: 120, slots: slots5(), tokens: tokens(['ke', 'kc', 'ka', 'kd', 'kb']),
  cards: [
    { id: 'c1', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.a, text: 'Mốc đèn đứng thứ tư.', do: { op: 'at', t: 'kd', s: 's4' } },
    { id: 'c2', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.b, text: 'Mốc máy đứng cuối.', do: { op: 'at', t: 'ke', s: 's5' } },
    { id: 'c3', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.c, text: 'Mốc cây đến trước mốc thiệp.', do: { op: 'before', t: ['kb', 'kc'] } },
  ],
  solutions: [['ka', 'kb', 'kc', 'kd', 'ke'], ['kb', 'ka', 'kc', 'kd', 'ke'], ['kb', 'kc', 'ka', 'kd', 'ke']],
  hints: Object.assign(common().hints, { 3: { tier: 4, fills: { s4: 'kd', s5: 'ke' }, text: 'Hai mốc đã có chỗ.' } }),
  wrongFrame: { text: 'Mốc lịch đến đầu tiên.', cards: ['c3'], do: { op: 'before', t: ['kc', 'kb'] } },
});

// 6 items into 3 groups of any size: many-to-one, 729 valid states.
const classFx = (): any => ({
  id: 'cl', format: 'O', input: 'assign', goal: 'classify', orientation: 'both', history: 'cl', title: 'Cũ hay mới', space: 729, bankSeed: 3,
  question: 'Mỗi tục lệ thuộc nhóm nào?', aha: 'Đếm cũng là bằng chứng.', rules: [{ text: 'Chạm một tục lệ rồi chạm một nhóm.' }],
  slots: ['old', 'mid', 'new'].map((id) => ({ id, label: id, cap: 'any' })),
  tokens: ['i4', 'i1', 'i5', 'i2', 'i6', 'i3'].map((id) => ({ id, text: 'Tục ' + id[1], status: 'fact', required: true })),
  cards: [
    { id: 'c1', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.a, text: 'Tục 1 và tục 4 không cùng nhóm.', do: { op: 'differ', t: ['i1', 'i4'] } },
    { id: 'c2', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.b, text: 'Có đúng hai tục mới.', do: { op: 'count', t: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'], s: 'new', n: 2 } },
    { id: 'c3', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.c, text: 'Tục bốn không mới.', do: { op: 'notAt', t: 'i4', s: 'new' } },
    { id: 'c4', who: 'Máy', kind: 'rule', status: 'rule', source: 'game', text: 'Tục 1, tục 2 và tục 3 đều thuộc nhóm cũ.', do: { op: 'count', t: ['i1', 'i2', 'i3'], s: 'old', n: 3 } },
  ],
  solutions: [[['i1', 'i2', 'i3'], ['i4'], ['i5', 'i6']]],
  hints: [
    { tier: 1, text: 'Câu hỏi: mỗi tục thuộc nhóm nào?' }, { tier: 2, card: 'c4', text: 'Đọc thẻ 4.' }, { tier: 3, text: 'Có chắc tục ấy là mới không?' },
    { tier: 4, fills: { old: ['i1', 'i2', 'i3'] }, text: 'Thẻ 4 xếp ba tục đầu.' }, { tier: 5, solves: true, text: 'Nhờ Cúc Cu soi tỏ: Tèo xếp.' },
  ],
  wrongFrame: { text: 'Tục bốn là tục mới.', cards: ['c3'], do: { op: 'at', t: 'i4', s: 'new' } },
  reveal: { lines: ['Chỉ hai tục là mới.'], label: '—' }, antiGuess: { rule: 'Kiểm tra chấm cả bảng.' },
});

// three dates into seven weekdays; calendar arithmetic through expr (Julian calendar, England 1647).
const weekdayFx = (): any => ({
  id: 'wd', format: 'N', input: 'mark', goal: 'find-weekday', orientation: 'both', history: 'wd', title: 'Thứ mấy', space: 343, bankSeed: 2,
  question: 'Mỗi ngày rơi vào thứ mấy?', aha: 'Số ngày chia cho bảy cho biết thứ.', rules: [{ text: 'Chạm một ngày rồi chạm một thứ.' }],
  slots: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((id, i) => ({ id, label: id, cap: 'any', value: i })),
  tokens: [{ id: 'da', text: '8/6/1647', status: 'fact', required: true, value: 0 }, { id: 'dc', text: '25/12/1647', status: 'fact', required: true, value: 200 }, { id: 'db', text: '14/12/1647', status: 'fact', required: true, value: 189 }],
  cards: [
    { id: 'c1', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.a, text: 'Ngày 8/6/1647 là thứ Ba theo lịch Julius.', do: { op: 'expr', e: ['eq', ['slot', 'da'], ['weekday', 1647, 6, 8, 'julian']] } },
    { id: 'c2', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.b, text: 'Từ 8/6 đến 14/12 có 189 ngày.', do: { op: 'expr', e: ['eq', ['mod', ['sub', ['slot', 'db'], ['slot', 'da']], 7], ['mod', ['sub', ['tok', 'db'], ['tok', 'da']], 7]] } },
    { id: 'c3', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.c, text: 'Từ 8/6 đến 25/12 có 200 ngày.', do: { op: 'expr', e: ['eq', ['mod', ['sub', ['slot', 'dc'], ['slot', 'da']], 7], ['mod', ['sub', ['tok', 'dc'], ['tok', 'da']], 7]] } },
  ],
  solutions: [[[], [], ['da', 'db'], [], [], [], ['dc']]],
  hints: [
    { tier: 1, text: 'Câu hỏi: ba ngày rơi vào thứ nào?' }, { tier: 2, card: 'c1', text: 'Đọc thẻ 1.' }, { tier: 3, text: 'Có chắc số ngày không đổi thứ?' },
    { tier: 4, fills: { tue: ['da'] }, text: 'Thẻ 1 cho một ngày.' }, { tier: 5, solves: true, text: 'Nhờ Cúc Cu soi tỏ: Tèo xếp.' },
  ],
  wrongFrame: { text: 'Ngày 25/12 luôn là ngày nghỉ.', cards: ['c1', 'c3'], do: { op: 'expr', e: ['eq', ['slot', 'dc'], 0] } },
  reveal: { lines: ['Ngày 25/12/1647 là thứ Bảy.'], label: '—' }, antiGuess: { rule: 'Kiểm tra chấm cả bảng.' },
});

const LEG = { source: 'research/m0b-act-2.md', url: 'https://blog.sbb.berlin/luther-als-erfinder-des-weihnachtsbaums-eine-interpretation-des-19-jahrhunderts/', evidence: ['Người ta kể rằng Martin Luther là người đầu tiên thắp nến trên cây thông'] };
const LABEL_STATUS: Record<string, string> = { 'SỰ THẬT': 'fact', 'TRANH CÃI': 'disputed', 'TRUYỀN THUYẾT': 'legend', 'CHƯA CÓ NGUỒN': 'decoy' };
const NOTEBOOK_OF: Record<string, string> = { 'SỰ THẬT': 'dec25.fact.0', 'TRANH CÃI': 'dec25.dispute.0', 'TRUYỀN THUYẾT': 'nicholas.legend.0', 'CHƯA CÓ NGUỒN': 'mistletoe.card.2' };
const piece = (i: number, label: string, text: string, src: any = SRC.a) => ({ id: 'k' + i, text, label, status: LABEL_STATUS[label], notebook: NOTEBOOK_OF[label], ...src });
// the ending's closing sentence: three blanks, one piece per label and five pieces nobody can source: 8*7*6 = 336 fills, one correct.
const conclusionFx = (): any => ({
  template: 'Giáng Sinh có nhiều lớp. Điều chắc: ___ Điều còn tranh cãi: ___ Điều người ta kể: ___',
  blanks: [{ label: 'SỰ THẬT' }, { label: 'TRANH CÃI' }, { label: 'TRUYỀN THUYẾT' }],
  hints: [{ text: 'Câu hỏi: mỗi chỗ trống nhận một mảnh.' }, { text: 'Mở Sổ nguồn trong Menu.' }, { text: 'Nhờ Cúc Cu soi tỏ: Tèo điền cả câu.', solves: true }],
  bank: [
    piece(1, 'SỰ THẬT', 'bản ghi sớm nhất nằm trong một cuốn lịch', SRC.a),
    piece(2, 'TRANH CÃI', 'danh sách có mục Giáng Sinh từ năm 336', SRC.c),
    piece(3, 'TRUYỀN THUYẾT', 'Luther thắp nến đầu tiên trên cây thông', LEG),
    ...[4, 5, 6, 7, 8].map((i) => piece(i, 'CHƯA CÓ NGUỒN', 'điều số ' + i + ' chưa ai chứng minh', SRC.b)),
  ],
});

// Fixtures for L2: unique solutions that L1 alone cannot finish. l2One needs one hypothesis, l2Two needs two.
const l2Fx = (cards: any[], solution: string[], fills: Record<string, string>): any => {
  const p = orderFx();
  p.bankSeed = 0;
  p.cards = cards.map((d, i) => ({ id: 'c' + (i + 1), who: 'Lịch', kind: 'record', status: 'fact', ...[SRC.a, SRC.b, SRC.c][i % 3], text: 'Thẻ ' + (i + 1) + ' của lịch.', do: d }));
  p.solutions = [solution];
  p.hints[1].card = 'c1';
  p.hints[1].text = 'Đọc thẻ 1.';
  p.hints[3].fills = fills;
  const opposite: Record<string, string> = { at: 'notAt', notAt: 'at', adjacent: 'notAdjacent', notAdjacent: 'adjacent' };
  p.wrongFrame = { text: 'Mốc đầu tiên luôn ở ô đầu.', cards: ['c3'], do: { ...cards[2], op: opposite[cards[2].op] } };
  return p;
};
const l2One = () => l2Fx([{ op: 'next', t: ['ka', 'ke'] }, { op: 'adjacent', t: ['ka', 'kb'] }, { op: 'notAt', t: 'kf', s: 's2' }, { op: 'expr', e: ['or', ['not', ['placed', 'kd']], ['lt', ['pos', 'kd'], ['pos', 'kc']]] }, { op: 'at', t: 'kc', s: 's1' }], ['kc', 'kb', 'ka', 'ke', 'kf'], { s1: 'kc' });
const l2Two = () => Object.assign(l2Fx([{ op: 'adjacent', t: ['kf', 'kd'] }, { op: 'adjacent', t: ['kb', 'kd'] }, { op: 'at', t: 'kc', s: 's1' }, [{ op: 'notAdjacent', t: ['kf', 'kc'] }, { op: 'expr', e: ['or', ['not', ['placed', 'ka']], ['lt', ['pos', 'ka'], ['pos', 'kc']]] }], { op: 'adjacent', t: ['kb', 'ke'] }], ['kc', 'ke', 'kb', 'kd', 'kf', null as any], { s1: 'kc' }), { space: 1440 }, { slots: [...slots5(), { id: 's6', label: '6', cap: 1 }] });
// five cards of two parity equations each: unique, but neither one card at a time nor one hypothesis nor two cards together finish it.
const parityFx = (): any => {
  const eq = (n: number, ...t: string[]) => ({ op: 'expr', e: ['eq', ['mod', ['count', 's1', ...t], 2], n] });
  const p = classFx();
  p.id = 'par'; p.bankSeed = 0; p.space = 64;
  p.tokens = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, text: 'Mốc ' + id, status: 'fact', required: true }));
  p.slots = [{ id: 's1', label: 'A', cap: 'any' }, { id: 's2', label: 'B', cap: 'any' }];
  const dos = [[eq(1, 'e', 'd', 'b', 'c'), eq(0, 'c', 'b', 'f', 'a')], [eq(0, 'd', 'c', 'f', 'e'), eq(0, 'c', 'd', 'a', 'e')], [eq(0, 'd', 'b', 'f'), eq(0, 'b', 'd', 'a')], [eq(0, 'a', 'b', 'c', 'f'), eq(1, 'f', 'e', 'c', 'b')], [eq(0, 'a', 'e', 'f', 'b'), eq(0, 'a', 'e', 'f', 'b')]];
  p.cards = dos.map((d, i) => ({ id: 'c' + (i + 1), who: 'Lịch', kind: 'record', status: 'fact', ...[SRC.a, SRC.b, SRC.c][i % 3], text: 'Thẻ ' + (i + 1) + ' của lịch.', do: d }));
  p.solutions = [[['a', 'd', 'f'], ['b', 'c', 'e']]];
  p.wrongFrame = { text: 'Mọi mốc cùng nhóm.', cards: ['c3'], do: { op: 'expr', e: ['eq', ['count', 's1', 'a', 'b', 'c', 'd', 'e', 'f'], 6] } };
  p.hints[1].card = 'c1';
  p.hints[1].text = 'Đọc thẻ 1.';
  p.hints[3].fills = { s1: ['a', 'd', 'f'] };
  return p;
};
// no card says anything about one piece alone in round 1: the first state has no forced move.
const noForceFx = (): any => Object.assign(l2Fx([{ op: 'adjacent', t: ['kb', 'kc'] }, { op: 'before', t: ['kd', 'ke'] }, { op: 'notAt', t: 'ka', s: 's1' }, [{ op: 'before', t: ['kb', 'kd'] }, { op: 'expr', e: ['or', ['not', ['placed', 'ka']], ['lt', ['pos', 'ka'], ['pos', 'kb']]] }], { op: 'oneOf', t: 'kc', s: ['s3', 's5'] }], ['kf', 'kb', 'kc', 'kd', 'ke'], { s2: 'kb' }), { bankSeed: 4 });

test.describe('puzzle checker and solver', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  test('the five puzzle files pass every check with no allowance: no warning, and the PENDING table is gone', () => {
    const r = spawnSync('node', ['scripts/puzzles.mjs', 'check'], { cwd: root, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain('OK: ' + files.length + ' puzzle(s)');
    expect(r.stdout).not.toMatch(/pending redesign|warn:/);
    expect(run("console.log(JSON.stringify(typeof P.PENDING));")).toBe('undefined');
    for (const id of files) expect(run("const r = P.checkOne(arg); console.log(JSON.stringify([r.errors, r.warnings]));", id), id).toEqual([[], []]);
  });

  test('clean fixtures pass in full: valid space, solution count and depth as declared, every bot under 5%', () => {
    for (const [p, space, depth] of [[orderFx(), 720, 2], [classFx(), 729, 2], [weekdayFx(), 343, 2]] as [any, number, number][]) {
      const r = check(p, true);
      expect(r.errors, p.id).toEqual([]);
      expect([r.space, r.count, r.depth], p.id).toEqual([space, 1, depth]);
      for (const k of ['random', 'mash', 'hill', 'tap', 'local', 'bank', 'idle', 'hold']) expect(r.bots[k], p.id + ' ' + k).toBeLessThan(0.05);
    }
  });

  test('bots: blind guessing matches 12 over the valid space, idle and bank order never solve, the local-search bot punishes close solutions', () => {
    const r = check(orderFx(), true);
    expect(r.bots.random).toBeGreaterThan(12 / 720 - 0.01);
    expect(r.bots.random).toBeLessThan(12 / 720 + 0.01);
    expect(r.bots.mash).toBeLessThan(0.04);
    expect([r.bots.idle, r.bots.hold, r.bots.bank]).toEqual([0, 0, 0]);
    const weak = check(weakFx(), true);
    expect(weak.space).toBe(120);
    expect(weak.bots.random).toBeLessThan(0.01);
    expect(weak.bots.local).toBeGreaterThan(0.2);
    expect(weak.errors.join('\n')).toMatch(/bot local solves within 12 checks/);
    expect(weak.errors.join('\n')).toMatch(/valid answer space 120 < 241/);
  });

  test('B1 and D-c: the reachable space ignores a piece\'s status (the UI never refuses), a stale declared space is caught, a declared solution may not put a legend piece in a fact slot', () => {
    const legend = orderFx();
    Object.assign(legend.tokens.find((t: any) => t.id === 'kf'), { status: 'legend', text: 'Người ta kể rằng mốc nến có thật', source: 'research/m0b-act-1.md', url: SRC.a.url, evidence: SRC.a.evidence });
    const r = check(legend, true);
    expect([r.space, r.count]).toEqual([720, 1]);
    expect(r.errors.join('\n')).not.toMatch(/declared space|valid answer space/);
    const placed = orderFx();
    placed.tokens.find((t: any) => t.id === 'kb').status = 'legend';
    placed.tokens.find((t: any) => t.id === 'kb').text = 'Người ta kể rằng mốc cây có thật';
    expect(errorsOf(placed)).toMatch(/declared solution .* is not a valid board/);
    const stale = orderFx();
    stale.space = 719;
    expect(errorsOf(stale)).toMatch(/declared space 719 but the valid state count is 720/);
    const none = orderFx();
    delete none.space;
    expect(errorsOf(none)).toMatch(/missing space/);
  });

  test('two solutions, a redundant card and an unfair rule are each caught', () => {
    const two = orderFx();
    two.cards = two.cards.filter((c: any) => c.id !== 'c4');
    two.hints[3].fills = { s3: 'ka' };
    expect(errorsOf(two)).toMatch(/solver finds [2-9] solution\(s\)/);
    const extra = orderFx();
    extra.cards.push({ id: 'c5', who: 'Lịch', kind: 'record', status: 'fact', ...SRC.a, text: 'Mốc máy đứng thứ hai.', do: { op: 'at', t: 'ke', s: 's2' } });
    expect(errorsOf(extra)).toMatch(/card c5 is not needed|more than 5 clue cards/);
    const many = orderFx();
    many.cards.push({ ...many.cards[2], id: 'c5' }, { ...many.cards[2], id: 'c6' });
    expect(errorsOf(many)).toMatch(/more than 5 clue cards/);
  });

  test('B2: a bank in answer order is rejected, the shown order is a fixed seeded shuffle that never solves', () => {
    const inOrder = orderFx();
    const by = Object.fromEntries(inOrder.tokens.map((t: any) => [t.id, t]));
    inOrder.tokens = ['kc', 'ke', 'ka', 'kd', 'kb', 'kf'].map((id) => by[id]);
    expect(errorsOf(inOrder)).toMatch(/bank order fills a solution \(file order\)/);
    const reversed = orderFx();
    reversed.tokens = ['kf', 'kb', 'kd', 'ka', 'ke', 'kc'].map((id) => by[id]);
    expect(errorsOf(reversed)).toMatch(/bank order fills a solution/);
    const full = check(inOrder, true);
    expect(full.bots.bank).toBe(1);
    expect(full.errors.join('\n')).toMatch(/bot bank solves within 12 checks with P=1/);
    const shown = run("console.log(JSON.stringify({ a: P.bankOrder(arg).map((t) => t.id), b: P.bankOrder(arg).map((t) => t.id), seeded: P.bankOrder({ ...arg, bankSeed: 7 }).map((t) => t.id) }));", orderFx());
    expect(shown.a).toEqual(shown.b);
    expect([...shown.a].sort()).toEqual(['ka', 'kb', 'kc', 'kd', 'ke', 'kf']);
    expect(shown.a).not.toEqual(['ka', 'kb', 'kc', 'kd', 'ke', 'kf']);
    expect(shown.seeded).not.toEqual(shown.a);
    const board = run("console.log(JSON.stringify(P.reply(arg, P.bankOrder(arg).slice(0, 5).map((t) => t.id))));", orderFx());
    expect(board.type).not.toBe('solved');
  });

  test('B3: depth counts synchronous rounds, so card order never changes it; a long chain is too deep', () => {
    const chain = (order: number[]) => {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const cards = [{ id: 'z', do: { op: 'unused', t: 'x' } }].slice(0, 0);
      const links = names.slice(1).map((n, i) => ({ id: 'c' + i, do: { op: 'next', t: [names[i], n] } }));
      return { id: 'ch', tokens: names.map((id) => ({ id, text: id, status: 'fact' })), slots: names.map((_, i) => ({ id: 's' + i, label: String(i) })), rules: [], cards: [...cards, ...order.map((i) => links[i])] };
    };
    const out = run("const f = (p) => { const r = P.propagate(p); return { depth: r.depth, log: r.log.map((x) => x.newlyFixed.slice().sort()) }; }; console.log(JSON.stringify(arg.map(f)));", [chain([0, 1, 2, 3, 4, 5, 6]), chain([6, 5, 4, 3, 2, 1, 0]), chain([3, 0, 5, 1, 6, 2, 4])]);
    expect(out[1]).toEqual(out[0]);
    expect(out[2]).toEqual(out[0]);
    expect(out[0].depth).toBeGreaterThan(3);
    expect(check(orderFx()).depth).toBeLessThanOrEqual(3);
    const deepCards = [{ op: 'notAt', t: 'kd', s: 's5' }, { op: 'notAdjacent', t: ['kb', 'ke'] }, { op: 'next', t: ['ka', 'kd'] }, { op: 'between', t: ['kd', 'ka', 'kc'] }, { op: 'adjacent', t: ['ke', 'ka'] }];
    const deepFx = (order: number[]) => {
      const p = orderFx();
      p.cards = order.map((i, k) => ({ id: 'c' + (k + 1), who: 'Lịch', kind: 'record', status: 'fact', ...[SRC.a, SRC.b, SRC.c][k % 3], text: 'Thẻ ' + (k + 1), do: deepCards[i] }));
      p.hints[1].card = 'c1';
      p.hints[1].text = 'Đọc thẻ 1.';
      p.wrongFrame.cards = ['c1'];
      delete p.wrongFrame.trap;
      delete p.wrongFrame.message;
      p.hints[3].fills = {};
      return p;
    };
    const forward = check(deepFx([0, 1, 2, 3, 4]));
    const backward = check(deepFx([4, 3, 2, 1, 0]));
    expect(forward.depth).toBeGreaterThan(3);
    expect(backward.depth).toBe(forward.depth);
    expect(forward.errors.join('\n')).toMatch(/inference depth \d+ > 3/);
  });

  test('B4: many-to-one slots and calendar arithmetic are expressed, solved, counted and declared', () => {
    const cl = classFx();
    const r = check(cl);
    expect(r.errors).toEqual([]);
    expect([r.space, r.count]).toEqual([729, 1]);
    expect(replies(cl, ['i1+i2+i3,i4,i5+i6', 'i1+i2,i3+i4,i5+i6', 'i1+i2+i3,i4', 'i1+i2+i3,,i4+i5+i6'])).toMatchObject([{ type: 'solved' }, { type: 'wrong' }, { type: 'format', reason: 'count' }, { type: 'wrong' }]);
    const wd = weekdayFx();
    expect(check(wd).errors).toEqual([]);
    expect(replies(wd, [',,da+db,,,,dc', ',,da,,,,db+dc'])).toMatchObject([{ type: 'solved' }, { type: 'wrong' }]);
    const days = run("console.log(JSON.stringify([P.OPS.expr ? 1 : 0, ['julian', 1647, 6, 8], ['julian', 1647, 12, 25], ['gregorian', 2000, 1, 1]].map((x) => (Array.isArray(x) ? P.compileDo({ ...arg, slots: arg.slots, tokens: arg.tokens, rules: [], cards: [] }, [{ op: 'expr', e: ['weekday', x[1], x[2], x[3], x[0]] }]).length : x))));", wd);
    expect(days).toEqual([1, 1, 1, 1]);
    const rule = run("const e = (a) => { const p = { ...arg, cards: [{ id: 'q', do: { op: 'expr', e: a } }] }; return P.solutions({ ...p, tokens: p.tokens.map((t) => ({ ...t, required: false })), slots: p.slots }, new Set(['q'])).length; }; console.log(JSON.stringify([e(['eq', ['weekday', 1647, 6, 8, 'julian'], 2]), e(['eq', ['weekday', 1647, 12, 25, 'julian'], 6]), e(['eq', ['weekday', 2000, 1, 1, 'gregorian'], 6]), e(['eq', ['weekday', 2000, 1, 1, 'gregorian'], 5])]));", wd);
    expect(rule.map((n: number) => n > 0)).toEqual([true, true, true, false]);
    const sized = run("const p = arg; const t = P.states(p); console.log(JSON.stringify({ n: t.length, solved: P.solutions(p).length, prop: P.propagate(p).dom }));", wd);
    expect([sized.n, sized.solved]).toEqual([343, 1]);
    expect(sized.prop.da).toEqual([3]);
    expect(sized.prop.db).toEqual([3]);
    expect(sized.prop.dc).toEqual([7]);
    const arrival = run("const p = { id: 'ya', slots: [12, 13, 14, 15, 16].map((d) => ({ id: 'n' + d, label: 'n' + d, cap: 1, min: 0, value: d })), tokens: [1, 2, 3].map((k) => ({ id: 'l' + k, text: 'l' + k, status: 'fact', required: true, value: k })), rules: [], cards: [{ id: 'c1', do: { op: 'expr', e: ['and', ['eq', ['slot', 'l1'], ['add', ['tok', 'l1'], 11]], ['eq', ['slot', 'l2'], ['add', ['tok', 'l2'], 11]], ['eq', ['slot', 'l3'], ['add', ['tok', 'l3'], 11]]] } }] }; const s = P.solutions(p); console.log(JSON.stringify({ n: s.length, a: P.answerOf(p, s[0]), dom: P.propagate(p).dom }));", null);
    expect(arrival.n).toBe(1);
    expect(arrival.a).toEqual(['l1', 'l2', 'l3', null, null]);
    const custom = run("P.registerOp('even', ([a]) => a % 2 === 0); const p = { id: 'cu', slots: [1, 2, 3, 4].map((i) => ({ id: 's' + i, label: '' + i })), tokens: [{ id: 'a', text: 'a', status: 'fact' }, { id: 'b', text: 'b', status: 'fact' }, { id: 'c', text: 'c', status: 'fact' }, { id: 'd', text: 'd', status: 'fact' }], rules: [], cards: [{ id: 'c1', do: [{ op: 'even', t: 'a' }, { op: 'at', t: 'b', s: 's1' }] }] }; console.log(JSON.stringify(P.solutions(p).map((v) => v[0])));", null);
    expect([...new Set(custom)]).toEqual([2, 4]);
  });

  test('B6: history is the key: sourced cards must be needed and removing them must raise the count', () => {
    const rules = orderFx();
    for (const c of rules.cards) { c.status = 'rule'; c.kind = 'rule'; c.source = 'game'; delete c.url; delete c.evidence; }
    expect(errorsOf(rules)).toMatch(/history is not the key: only 0 sourced card\(s\)/);
    const one = orderFx();
    for (const id of ['c1', 'c3', 'c4']) { const c = one.cards.find((x: any) => x.id === id); c.status = 'rule'; c.kind = 'rule'; c.source = 'game'; delete c.url; delete c.evidence; }
    expect(errorsOf(one)).toMatch(/history is not the key: only 1 sourced card\(s\)/);
    const decoyed = orderFx();
    decoyed.cards[1].status = 'decoy';
    decoyed.cards[1].shows = 'fact';
    expect(errorsOf(decoyed)).toMatch(/tagged decoy|history is not the key/);
    const tutorial = orderFx();
    tutorial.id = 'intro';
    tutorial.history = 'none';
    for (const c of tutorial.cards) { c.status = 'rule'; c.kind = 'rule'; c.source = 'game'; delete c.url; delete c.evidence; }
    expect(errorsOf(tutorial)).toBe('');
  });

  test('FIX: fail wording is banned in hints, messages and rules only, never in card text; the trap is checked', () => {
    const cardText = orderFx();
    cardText.cards[1].text = 'Mốc máy nằm giữa mốc thiệp và mốc lịch, nơi Baldur chết và hết giờ.';
    expect(errorsOf(cardText)).toBe('');
    const hint = orderFx();
    hint.hints[0].text = 'Hết giờ rồi, bắt đầu lại nhé.';
    expect(errorsOf(hint)).toMatch(/hints\[0\]\.text implies a fail state/);
    const rule = orderFx();
    rule.rules[0].text = 'Bạn sẽ thua nếu đặt sai.';
    expect(errorsOf(rule)).toMatch(/rules\[0\]\.text implies a fail state/);
    const message = orderFx();
    message.wrongFrame.message = 'Game over.';
    expect(errorsOf(message)).toMatch(/wrongFrame\.message implies a fail state/);

    const inSolution = orderFx();
    inSolution.wrongFrame.trap = { s3: 'ka' };
    expect(errorsOf(inSolution)).toMatch(/wrongFrame\.trap is part of a solution/);
    const weakCards = orderFx();
    weakCards.wrongFrame.cards = ['c4'];
    expect(errorsOf(weakCards)).toMatch(/wrongFrame\.cards c4 do not eliminate the trap board/);
    const leak = orderFx();
    leak.wrongFrame.message = 'Thẻ 3 nói còn một mốc đến sau mốc thiệp.';
    expect(errorsOf(leak)).toMatch(/wrongFrame\.message names thiệp/);
    const slotNo = orderFx();
    slotNo.wrongFrame.message = 'Chưa khớp ở ô 5.';
    expect(errorsOf(slotNo)).toMatch(/points at a slot number/);
    const frame = classFx();
    frame.wrongFrame.cards = ['c2'];
    expect(errorsOf(frame)).toMatch(/do not break wrongFrame\.do/);
  });

  test('UI model: format errors are separate from wrong, wrong says nothing about a slot, idle and empty boards never solve', () => {
    const p = orderFx();
    const wrongBoards = ['kc,ke,ka,kb,kd', 'kd,kb,kc,ka,ke', 'kb,kd,ka,ke,kc', 'ke,kc,ka,kd,kb', 'kf,ke,ka,kd,kb', 'kc,ke,ka,kb,kd'];
    const out = replies(p, ['kc,ke,ka,kd,kb', ',,,,', 'kc,,ka,kd,kb', 'kc,ke,ka,kd', 'kc,ke,ka,kd,kb,ka', 'kc,ke,ka,kd,zz', 'kc,ke,ka,kc,kb', 'kc+ke,ka,kd,kb,kf', 'KC, Mốc máy ,ka,kd,KB', ...wrongBoards, 'kc,ke,ka,kd,']);
    expect(out[0]).toEqual({ type: 'solved' });
    expect(out[1]).toEqual({ type: 'incomplete', empty: 5 });
    expect(out[2]).toEqual({ type: 'incomplete', empty: 1 });
    expect(out[3]).toEqual({ type: 'format', reason: 'count', expected: 5, got: 4 });
    expect(out[4]).toEqual({ type: 'format', reason: 'count', expected: 5, got: 6 });
    expect(out[5]).toEqual({ type: 'format', reason: 'unknown', id: 'zz' });
    expect(out[6]).toEqual({ type: 'format', reason: 'duplicate', id: 'kc' });
    expect(out[7]).toEqual({ type: 'format', reason: 'capacity' });
    expect(out[8]).toEqual({ type: 'solved' });
    const wrong = out.slice(9, 9 + wrongBoards.length);
    for (const w of wrong) expect(w).toEqual({ type: 'wrong' });
    expect(out.at(-1)).toEqual({ type: 'incomplete', empty: 1 });
    expect(replies(p, ['ka,kb,kc,kd,ke', 'kb,ke,kc,kd,ka'])).toEqual([{ type: 'wrong' }, { type: 'wrong' }]);
    const legend = orderFx();
    legend.tokens.find((t: any) => t.id === 'kf').status = 'legend';
    const probes = ['kf,ke,ka,kd,kb', 'kc,kf,ka,kd,kb', 'kc,ke,kf,kd,kb', 'kc,ke,ka,kf,kb', 'kc,ke,ka,kd,kf'];
    const plain = replies(p, probes);
    expect(replies(legend, probes)).toEqual(plain);
    for (const r of plain) expect(r).toEqual({ type: 'wrong' });
    expect(replies(legend, ['kc,ke,ka,kd,kb'])).toEqual([{ type: 'solved' }]);
    const weak = weakFx();
    expect(replies(weak, [weak.solutions[0], weak.solutions[0], weak.solutions[1], weak.solutions[2]])).toEqual([{ type: 'found', n: 1, of: 3 }, { type: 'found', n: 1, of: 3 }, { type: 'found', n: 2, of: 3 }, { type: 'solved' }]);
  });

  const requiredFx = (): any => { const p = orderFx(); for (const t of p.tokens) if (t.id !== 'kf') t.required = true; return p; };
  const stubShape = (p: any): any => ({ id: p.id, stub: true, input: p.input, space: p.space, slots: p.slots.map((s: any) => ({ id: s.id, ...(s.cap !== undefined ? { cap: s.cap } : {}) })), tokens: p.tokens.map((t: any) => ({ id: t.id, ...(t.required ? { required: true } : {}) })), cards: p.cards.map((c: any) => ({ id: c.id, do: c.do })), solutions: p.solutions });

  test('B1: Kiểm tra never tells whether a piece is required: one piece alone is answered the same whichever piece it is, a missing required piece is a plain wrong', () => {
    const p = requiredFx();
    const alone = p.tokens.map((t: any) => t.id + ',,,,');
    const out = replies(p, alone);
    for (const r of out) expect(r).toEqual({ type: 'incomplete', empty: 4 });
    expect(replies(p, ['kf,ke,ka,kd,kb', 'kc,ke,ka,kd,kf'])).toEqual([{ type: 'wrong' }, { type: 'wrong' }]);
    const sizes = run("const out = {}; for (const q of arg) { out[q.id] = q.slots.map((s) => new Set(q.tokens.map((t) => JSON.stringify(P.reply(q, q.slots.map((x) => (x.id === s.id ? [t.id] : [])))))).size); } console.log(JSON.stringify(out));", files.map(puzzle)) as Record<string, number[]>;
    for (const id of files) expect(sizes[id]!.every((n) => n === 1), id + ' answers a single piece differently by piece: ' + sizes[id]).toBe(true);
  });

  test('S1: a board in the wrong frame and a board that breaks one card are answered like any other wrong board; the checker proves it and can fail', () => {
    for (const id of files) expect(run("console.log(JSON.stringify(P.replyLeaks(arg)));", puzzle(id)), id).toEqual([]);
    for (const p of [orderFx(), requiredFx(), classFx(), weekdayFx(), weakFx()]) expect(run("console.log(JSON.stringify(P.replyLeaks(arg)));", p), p.id).toEqual([]);
    const leaky = run("const near = new Set(P.solutions(arg, new Set(['c1', 'c3', 'c4'])).map((v) => v.join(','))); const ask = (q, b) => { const r = P.reply(q, b); const v = P.parseBoard(q, b).v; return v && near.has(v.join(',')) && r.type === 'wrong' ? { type: 'trap', cards: ['c2'] } : r; }; const alone = (q, b) => { const r = P.reply(q, b); return Array.isArray(b) && b.filter(Boolean).length === 1 && b.includes('kf') ? { type: 'incomplete', empty: 3 } : r; }; console.log(JSON.stringify({ near: P.replyLeaks(arg, ask), alone: P.replyLeaks(arg, alone) }));", orderFx()) as { near: string[]; alone: string[] };
    expect(leaky.near.join('\n')).toMatch(/near-solution without card c2 .* is answered \{"type":"trap","cards":\["c2"\]\}, not a plain wrong/);
    expect(leaky.alone.join('\n')).toMatch(/a single piece alone in slot s1 is answered differently by piece/);
    expect(errorsOf(orderFx())).not.toMatch(/reply leaks/);
  });

  test('S11: a forced first move is a piece a card puts into a slot, a piece a card only leaves out is no move', () => {
    const leftOut = stubShape(Object.assign(l2Fx([{ op: 'adjacent', t: ['kb', 'kc'] }, { op: 'before', t: ['kd', 'ke'] }, { op: 'unused', t: 'ka' }, { op: 'before', t: ['kb', 'kd'] }, [{ op: 'oneOf', t: 'kc', s: ['s3', 's5'] }, { op: 'notAt', t: 'kf', s: 's2' }]], ['kf', 'kb', 'kc', 'kd', 'ke'], {}), { bankSeed: 4 }));
    expect(check(leftOut, true, 0).errors).toEqual(['fx: no forced move in round 1: the first state needs a move that follows from one card']);
    expect(run("console.log(JSON.stringify(P.checkData(arg, arg.id, { full: false, minL2: 0 }).info.prop.forced));", leftOut)).toBe(0);
  });

  test('S11: stub mode runs the bots (the bank-order bot excepted) and prints the numbers the gates use', () => {
    const weak = check(stubShape(weakFx()), true);
    expect(weak.errors.join('\n')).toMatch(/bot local solves within 12 checks/);
    expect(weak.bots.local).toBeGreaterThan(0.2);
    const inAnswerOrder = stubShape(l2One());
    inAnswerOrder.tokens = ['kc', 'kb', 'ka', 'ke', 'kf', 'kd'].map((id) => ({ id }));
    const bank = check(inAnswerOrder, true, 0);
    expect(bank.bots.bank, 'the unshuffled stub order hands over the answer').toBe(1);
    expect(bank.errors).toEqual([]);
  });

  test('S12: every puzzle but the intro tutorial needs wrongFrame.do; the intro needs it or a stated reason', () => {
    const p = orderFx();
    delete p.wrongFrame.do;
    expect(errorsOf(p)).toMatch(/wrongFrame\.do is missing/);
    const intro = orderFx();
    Object.assign(intro, { id: 'intro', history: 'none' });
    for (const c of intro.cards) { c.status = 'rule'; c.kind = 'rule'; c.source = 'game'; delete c.url; delete c.evidence; }
    expect(errorsOf(intro)).toBe('');
    delete intro.wrongFrame.do;
    expect(errorsOf(intro)).toMatch(/wrongFrame\.do is missing.*intro may instead give wrongFrame\.exempt/);
    intro.wrongFrame.exempt = 'Chưa đủ lý do.';
    expect(errorsOf(intro)).toMatch(/wrongFrame\.do is missing/);
    intro.wrongFrame.exempt = 'Câu mở đầu chỉ dạy cách chạm, chưa có khung sai nào để phá.';
    expect(errorsOf(intro)).toBe('');
    const notIntro = orderFx();
    delete notIntro.wrongFrame.do;
    notIntro.wrongFrame.exempt = 'Câu này nói rằng nó không cần khung sai nào cả.';
    expect(errorsOf(notIntro)).toMatch(/wrongFrame\.do is missing/);
  });

  test('S13: in stub mode every piece must be named by a card; a decoy counts once an unused card names it', () => {
    const named = stubShape(l2One());
    expect(check(named, false).errors.join('\n')).not.toMatch(/named by no card/);
    const loose = stubShape(l2One());
    loose.cards = loose.cards.filter((c: any) => c.id !== 'c4' && c.id !== 'c5');
    expect(check(loose, false).errors.join('\n')).toMatch(/piece kc is named by no card/);
    const decoy = stubShape(l2One());
    decoy.cards[3].do = decoy.cards[3].do[0];
    expect(check(decoy, false).errors.join('\n')).toMatch(/piece kd is named by no card/);
    const full = l2One();
    full.cards = full.cards.filter((c: any) => c.id !== 'c5');
    expect(errorsOf(full)).not.toMatch(/named by no card/);
  });

  test('S11/S13: every stub passes stub mode with the bots run, a forced first move and no piece left unnamed; no two puzzles share a card shape', () => {
    const stubDir = join(root, 'story/puzzles/stubs');
    const stubs = existsSync(stubDir) ? readdirSync(stubDir).filter((f) => f.endsWith('.json')) : [];
    expect(stubs.map((f) => f.replace(/\.json$/, '')).sort()).toEqual([...stubIds()].sort());
    const out = run("const out = {}; for (const f of arg) { const r = P.checkFile('story/puzzles/stubs/' + f); out[f] = { errors: r.errors, forced: r.info.prop?.forced, bots: r.info.bots }; } console.log(JSON.stringify(out));", stubs) as Record<string, { errors: string[]; forced: number; bots: Record<string, number> }>;
    for (const f of stubs) {
      const r = out[f]!;
      expect(r.errors, f).toEqual([]);
      expect(r.forced, f + ' forced moves').toBeGreaterThanOrEqual(1);
      for (const k of ['random', 'mash', 'hill', 'tap', 'local', 'idle', 'hold']) expect(r.bots[k]!, f + ' bot ' + k).toBeLessThan(0.05);
    }
    const shapes = new Map<string, string[]>();
    for (const id of [...files, ...stubs.map((f) => f.slice(0, -5))]) {
      const p = files.includes(id) ? puzzle(id) : JSON.parse(readFileSync(join(root, 'story/puzzles/stubs', id + '.json'), 'utf8'));
      const shape = p.cards.map((c: any) => [].concat(c.do ?? []).map((d: any) => d.op).join('+')).join(',');
      shapes.set(shape, [...(shapes.get(shape) ?? []), id]);
    }
    expect([...shapes].filter(([, owners]) => owners.length > 1)).toEqual([]);
  });
  test('S7: a card that only sorts a piece into a class is flagged when the piece already says its own status', () => {
    const withText = (id: string, text: string, card: any) => { const p = orderFx(); p.tokens.find((t: any) => t.id === id).text = text; p.cards[0] = { ...p.cards[0], id: 'c1', do: card }; return errorsOf(p); };
    for (const text of ['Giả thuyết: mốc nến', 'Người ta kể rằng mốc nến có thật', 'Truyền thuyết về mốc nến', 'Mốc nến chưa có nguồn', 'Mốc nến thời Bede tả']) expect(withText('kf', text, { op: 'unused', t: 'kf' }), text).toMatch(/card c1 only classifies piece kf, whose text already says what it is/);
    expect(withText('kf', 'Mốc nến', { op: 'unused', t: 'kf' })).not.toMatch(/only classifies/);
    expect(withText('kf', 'Giả thuyết: mốc nến', { op: 'before', t: ['ka', 'kf'] }), 'a card that relates two pieces is no classification').not.toMatch(/only classifies/);
    expect(withText('kb', 'Truyền thuyết về mốc cây', { op: 'at', t: 'kb', s: 's5' }), 'a piece pinned to one position is not classified').not.toMatch(/only classifies/);
    const bin = classFx();
    bin.tokens.find((t: any) => t.id === 'i6').text = 'Tục chưa có nguồn';
    bin.cards.push({ id: 'c5', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.a, text: 'Tục sáu là tục mới.', do: { op: 'at', t: 'i6', s: 'new' } });
    expect(errorsOf(bin)).toMatch(/card c5 only classifies piece i6, whose text already says what it is \("chưa có nguồn"\)/);
    const many = run("console.log(JSON.stringify(arg.map((p) => P.checkData(p, p.id, { full: false, minL2: 0 }).errors.filter((e) => /only classifies/.test(e)).length)));", [orderFx(), classFx(), weekdayFx()]);
    expect(many).toEqual([0, 0, 0]);
  });

  test('hint tier 5 yields a solution not yet found, for one solution and for several', () => {
    for (const p of [orderFx(), weakFx(), classFx(), weekdayFx()]) {
      const r = run("const f = new Set(); const out = []; for (let k = 0; k < arg.solutions.length; k++) { const a = P.helpAnswer(arg, f); out.push(P.reply(arg, a, f).type); } console.log(JSON.stringify({ out, text: P.hintText(arg, 5) }));", p);
      expect(r.out, p.id).toEqual([...p.solutions.slice(1).map(() => 'found'), 'solved']);
      expect(r.text, p.id).toContain('Tèo xếp: ');
    }
    const known = weakFx();
    const second = run("const f = new Set(); P.reply(arg, arg.solutions[0], f); console.log(JSON.stringify(P.hintText(arg, 5, f)));", known);
    expect(second).not.toContain('ka,kb,kc,kd,ke');
    const broken = orderFx();
    broken.hints[4].solves = false;
    expect(errorsOf(broken)).toMatch(/hint tier 5 must be the solving/);
  });

  test('the player view lists every piece with its id, the answer syntax, and the same shuffled bank every time', () => {
    for (const id of files) {
      const first = spawnSync('node', ['scripts/puzzles.mjs', 'view', id], { cwd: root, encoding: 'utf8' });
      const second = spawnSync('node', ['scripts/puzzles.mjs', 'view', id], { cwd: root, encoding: 'utf8' });
      expect(first.status, first.stderr).toBe(0);
      expect(second.stdout, id).toBe(first.stdout);
      const p = puzzle(id);
      expect(first.stdout, id).toContain(p.question);
      expect(first.stdout, id).toContain('## Cách nộp đáp án');
      expect(first.stdout, id).toContain('đúng ' + p.slots.length + ' mục');
      expect(first.stdout, id).not.toContain(p.aha);
      expect(first.stdout, id).not.toContain(p.reveal.lines[0]);
      for (const h of p.hints) expect(first.stdout, id).not.toContain(h.text);
      for (const c of p.cards) expect(first.stdout, id).toContain(c.text);
      for (const t of p.tokens) expect(first.stdout, id).toContain('mã ' + t.id + ' — [' + t.text + ']');
      for (const s of p.solutions) expect(first.stdout, id).not.toContain(s.join(','));
    }
    const view = run("console.log(JSON.stringify(P.view(arg)));", weekdayFx()) as string;
    expect(view).toContain('nối các mã bằng dấu +');
    const multi = run("console.log(JSON.stringify(P.view(arg)));", weakFx()) as string;
    expect(multi).toContain('có 3 cách xếp khớp');
  });

  test('the five hint tiers of every puzzle file: tier 5 solves, tiers 1 to 3 hold no deduction, tier 4 is a forced first move; the CLI prints the answer and accepts it', () => {
    for (const id of files) {
      const p = puzzle(id);
      expect(p.hints.map((h: { tier: number }) => h.tier), id).toEqual([1, 2, 3, 4, 5]);
      expect(p.hints[4].solves, id).toBe(true);
      expect(p.hints[3].fills, id).toBeTruthy();
      expect(p.hints.slice(0, 3).some((h: { fills?: unknown; solves?: unknown }) => h.fills || h.solves), id).toBe(false);
      const hint = spawnSync('node', ['scripts/puzzles.mjs', 'hint', id, '5'], { cwd: root, encoding: 'utf8' });
      expect(hint.stdout, id).toContain('Tèo xếp: ');
      const boards = p.solutions.map((s: unknown[]) => s.map((e) => [].concat(e as never).join('+')).join(','));
      const reply = spawnSync('node', ['scripts/puzzles.mjs', 'reply', id, ...boards], { cwd: root, encoding: 'utf8' });
      expect(JSON.parse(reply.stdout.trim().split('\n').at(-1)!), id).toEqual({ type: 'solved' });
    }
  });

  test('L1 and L2: rounds and steps are reported, never depend on card order, and every chapter without an l2Exempt reason needs an L2 step', () => {
    const base = check(orderFx());
    expect([base.levels.l2, base.levels.deep]).toEqual([0, false]);
    expect(errorsOf(orderFx(), false, 1)).toMatch(/too easy for this chapter: L1 plus 0 L2 step\(s\) solve it, at least 1 needed/);
    const one = check(l2One(), true, 1);
    expect(one.errors).toEqual([]);
    expect([one.levels.l2, one.levels.run, one.levels.path]).toEqual([1, 3, ['hypothesis ka≠2']]);
    expect(errorsOf(l2One(), false, 2)).toMatch(/L1 plus 1 L2 step\(s\) solve it, at least 2 needed/);
    const two = check(l2Two(), true, 2);
    expect(two.errors).toEqual([]);
    expect([two.levels.l2, two.levels.run, two.levels.path.length]).toEqual([2, 3, 2]);
    const orders = run("const out = []; for (const p of arg) { const E = P.solveLevels(p); out.push([E.l1, E.run, E.l2, E.path]); } console.log(JSON.stringify(out));", [0, 1, 2].map((k) => { const p = l2Two(); p.cards = k === 0 ? p.cards : k === 1 ? p.cards.slice().reverse() : [p.cards[2], p.cards[4], p.cards[0], p.cards[3], p.cards[1]]; return p; })) as any[];
    expect(orders[1].slice(0, 3)).toEqual(orders[0].slice(0, 3));
    expect(orders[2].slice(0, 3)).toEqual(orders[0].slice(0, 3));
    const deep = run("P.LIMITS.l2Max = 1; const r = P.checkData(arg, arg.id, { full: false, minL2: 0 }); console.log(JSON.stringify({ errors: r.errors, deep: r.info.levels.deep }));", l2Two());
    expect(deep.deep).toBe(true);
    expect(deep.errors.join('\n')).toMatch(/needs more than 1 L2 actions/);
    const intro = orderFx();
    intro.id = 'intro';
    expect(run("console.log(JSON.stringify(P.checkData(arg, arg.id, { full: false }).errors));", intro).join('\n')).toMatch(/too easy for this chapter/);
    intro.l2Exempt = 'Câu đố làm quen chỉ cần L1, chưa dạy giả định.';
    expect(run("console.log(JSON.stringify(P.checkData(arg, arg.id, { full: false }).errors));", intro)).toEqual([]);
    const need = run("import('node:fs').then((fs) => { const m = JSON.parse(fs.readFileSync('story/minigames.json', 'utf8')); console.log(JSON.stringify({ rows: m.map((r) => [r.id, P.requiredL2(r.id), r.act]), unknown: P.requiredL2('no-such-chapter') })); });", null) as any;
    for (const [id, got, act] of need.rows) expect(got, id).toBe(files.includes(id) && puzzle(id).l2Exempt ? 0 : id === 'ending' || act >= 3 ? 2 : 1);
    expect(need.unknown).toBe(1);
  });

  test('l2Exempt: the exemption from the L2 gate needs a written reason, and check prints it', () => {
    const run1 = (p: any) => run("const r = P.checkData(arg, arg.id, { full: false }); console.log(JSON.stringify({ errors: r.errors, exempt: r.info.l2Exempt, need: r.info.needL2 }));", p) as { errors: string[]; exempt: string | null; need: number };
    const p = orderFx();
    expect(run1(p).errors.join('\n')).toMatch(/too easy for this chapter/);
    p.l2Exempt = 'Ngắn.';
    expect(run1(p).errors.join('\n')).toMatch(/l2Exempt must be a sentence of at least 15 characters/);
    expect(run1(p).errors.join('\n')).toMatch(/too easy for this chapter/);
    p.l2Exempt = 'Câu đố tra văn bản, không có chỗ cho giả định.';
    expect(run1(p)).toEqual({ errors: [], exempt: p.l2Exempt, need: 0 });
    const out = spawnSync('node', ['scripts/puzzles.mjs', 'check', 'intro'], { cwd: root, encoding: 'utf8' });
    expect(out.status, out.stdout + out.stderr).toBe(0);
    expect(out.stdout).toContain('L2 gate EXEMPT: ' + puzzle('intro').l2Exempt);
    expect(spawnSync('node', ['scripts/puzzles.mjs', 'check', 'dec25'], { cwd: root, encoding: 'utf8' }).stdout).not.toContain('EXEMPT');
  });

  test('L2: two cards read together are a step of their own, and a puzzle beyond L2 is reported as needing branching', () => {
    const joint = run("const p = { id: 'jt', slots: [1, 2, 3, 4, 5].map((i) => ({ id: 's' + i, label: '' + i })), tokens: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, text: id, status: 'fact' })), rules: [], cards: [{ id: 'c1', do: { op: 'adjacent', t: ['d', 'e'] } }, { id: 'c2', do: { op: 'next', t: ['c', 'b'] } }, { id: 'c3', do: { op: 'notAt', t: 'd', s: 's5' } }, { id: 'c4', do: { op: 'next', t: ['a', 'e'] } }] }; const r = P.solveLevels(p); console.log(JSON.stringify({ l2: r.l2, path: r.path, solved: r.solved }));", null);
    expect(joint).toEqual({ l2: 1, path: ['joint c1+c4'], solved: true });
    const par = parityFx();
    const lv = run("const p = arg; const sols = P.solutions(p); const proj = Object.fromEntries(p.tokens.map((t, i) => [t.id, [sols[0][i]]])); const r = P.solveLevels(p, proj); console.log(JSON.stringify({ n: sols.length, solved: r.solved, deep: r.deep }));", par);
    expect(lv).toEqual({ n: 1, solved: false, deep: false });
    expect(errorsOf(par)).toMatch(/propagation alone leaves a in \[1,2\] but solutions give \[1\]: branching needed/);
  });

  test('N1: history "none" is only for the intro, no history hides as a game rule, a legend card carries no constraint, the legend lane is declared', () => {
    const none = orderFx();
    none.history = 'none';
    expect(errorsOf(none)).toMatch(/history "none" is only for the intro tutorial/);
    const asRule = (p: any, id: string, text: string) => { const c = p.cards.find((x: any) => x.id === id); Object.assign(c, { status: 'rule', kind: 'rule', source: 'game', text }); delete c.url; delete c.evidence; return p; };
    expect(errorsOf(asRule(orderFx(), 'c3', 'Năm 380 mốc lịch đứng giữa dãy.'))).toMatch(/rule card c3 carries the number 380/);
    expect(errorsOf(asRule(orderFx(), 'c3', 'Mốc lịch của Luther đứng giữa dãy.'))).toMatch(/rule card c3 carries the proper name Luther/);
    const known = asRule(orderFx(), 'c3', 'Constantinople đứng giữa dãy.');
    known.tokens[0].text = 'Mốc ở Constantinople';
    expect(errorsOf(known)).toMatch(/rule card c3 carries the proper name Constantinople/);
    expect(errorsOf(asRule(orderFx(), 'c3', 'Mốc lịch đứng giữa dãy, không phải mốc thiệp.'))).not.toMatch(/rule card/);
    const intro = asRule(orderFx(), 'c3', 'Năm 380 mốc lịch đứng giữa dãy.');
    intro.id = 'intro';
    intro.history = 'none';
    expect(errorsOf(intro)).not.toMatch(/rule card/);
    const kind = orderFx();
    kind.cards[1].kind = 'rule';
    expect(errorsOf(kind)).toMatch(/card c2 kind rule does not match status fact/);

    for (const [status, shows] of [['legend', undefined], ['decoy', 'legend']]) {
      const legend = orderFx();
      Object.assign(legend.cards[3], { status, shows, kind: 'retelling', text: 'Người ta kể rằng mốc cây đứng cuối.' });
      expect(errorsOf(legend), String(status)).toMatch(/card c4 is a legend and must not carry a constraint/);
    }
    const clean = orderFx();
    clean.cards.push({ id: 'c5', who: 'Người ta kể', kind: 'retelling', status: 'legend', ...LEG, text: 'Người ta kể rằng Luther thắp nến đầu tiên trên cây thông.' });
    expect(errorsOf(clean)).toBe('');
    const lane = orderFx();
    lane.slots[0].accepts = ['fact', 'legend'];
    expect(errorsOf(lane)).toMatch(/slot s1 accepts legend tokens but is not declared as a legend lane/);
    lane.slots[0].lane = 'legend';
    expect(errorsOf(lane)).toMatch(/slot s1 is a legend lane and must not accept fact pieces/);
    lane.slots[0].accepts = ['legend'];
    expect(errorsOf(lane)).not.toMatch(/legend lane|label/);
    lane.slots[0].label = 'Người ta kể rằng';
    expect(errorsOf(lane)).toMatch(/slots\[0\]\.label names a piece class \("Người ta kể"\)/);
    lane.slots[0].label = 'Sách báo sau này';
    expect(errorsOf(lane)).not.toMatch(/legend lane|label/);
  });

  test('F-e: a legend lane on a plain slot is no lane: it must accept legend and refuse fact pieces, and its label carries no class word', () => {
    const edit = (f: (s: any) => void) => { const p = orderFx(); f(p.slots[0]); return errorsOf(p); };
    expect(edit((s) => { s.lane = 'legend'; })).toMatch(/slot s1 is a legend lane but does not accept legend pieces/);
    expect(edit((s) => { s.lane = 'legend'; s.label = 'Nấc 1'; })).toMatch(/does not accept legend pieces/);
    expect(edit((s) => { s.lane = 'legend'; s.accepts = ['fact', 'legend']; s.label = 'Nấc 1'; })).toMatch(/slot s1 is a legend lane and must not accept fact pieces/);
    expect(edit((s) => { s.lane = 'legend'; s.accepts = ['legend']; s.label = 'Nấc 1 (cũ nhất)'; })).not.toMatch(/legend lane|label/);
    expect(edit((s) => { s.lane = 'story'; })).toMatch(/slot s1 lane must be "legend"/);
    expect(edit((s) => { s.lane = 'legend'; s.accepts = ['legend']; s.label = 'Truyền thuyết'; })).toMatch(/slots\[0\]\.label names a piece class \("Truyền thuyết"\)/);
  });

  test('N2: the conclusion step is checked: sourced pieces, one meaning per label, a unique answer or a guess under 5%, labels hidden from the player', () => {
    const withC = (c?: (x: any) => void) => { const p = orderFx(); p.conclusion = conclusionFx(); c?.(p.conclusion); return p; };
    const clean = check(withC());
    expect(clean.errors).toEqual([]);
    const stats = run("console.log(JSON.stringify(P.conclusionStats(arg)));", withC());
    expect(stats.N).toBe(336);
    expect(stats.K).toBe(1);
    expect(stats.P).toBeCloseTo(12 / 336, 5);
    const ending = orderFx();
    ending.id = 'ending';
    expect(errorsOf(ending)).toMatch(/the ending needs a conclusion step/);
    expect(errorsOf(withC((c) => { delete c.bank[0].source; }))).toMatch(/conclusion\.bank\[0\] has no source/);
    expect(errorsOf(withC((c) => { delete c.bank[1].evidence; }))).toMatch(/conclusion\.bank\[1\] has no evidence quote/);
    expect(errorsOf(withC((c) => { c.bank[2].evidence = ['một câu không có trong nguồn']; }))).toMatch(/conclusion\.bank\[2\]: evidence not found/);
    expect(errorsOf(withC((c) => { c.bank[0].label = 'NHÃN BỪA'; }))).toMatch(/conclusion\.bank\[0\] label NHÃN BỪA must be one of/);
    expect(errorsOf(withC((c) => { c.bank[0].status = 'legend'; }))).toMatch(/label SỰ THẬT means status fact but the piece declares legend/);
    expect(errorsOf(withC((c) => { c.bank[2].label = 'SỰ THẬT'; c.bank[2].status = 'fact'; }))).toMatch(/conclusion has no correct fill/);
    expect(errorsOf(withC((c) => { c.bank[0].card = 'c9'; }))).toMatch(/conclusion\.bank\[0\] card c9 does not exist/);
    expect(errorsOf(withC((c) => { c.bank[2].card = 'c2'; }))).toMatch(/conclusion\.bank\[2\]: it rests on c2, shown as fact, but is declared legend/);
    expect(errorsOf(withC((c) => { c.blanks[1].label = 'BỪA'; }))).toMatch(/conclusion blank label BỪA/);
    expect(errorsOf(withC((c) => { c.template = 'Chỉ một chỗ: ___'; }))).toMatch(/conclusion\.template has 1 blank/);
    const guess = withC((c) => { c.bank = c.bank.slice(0, 3).concat([piece(4, 'SỰ THẬT', 'một điều chắc khác', SRC.b), piece(5, 'TRANH CÃI', 'một điều tranh cãi khác', SRC.c), piece(6, 'TRUYỀN THUYẾT', 'một điều kể khác', LEG)]); });
    expect(errorsOf(guess)).toMatch(/conclusion: guessing wins within 12 tries with P=\d+\.\d% \(8 correct of 120 fills\)/);
    const none = withC((c) => { c.bank = c.bank.filter((b: any) => b.label !== 'TRUYỀN THUYẾT'); });
    expect(errorsOf(none)).toMatch(/conclusion has no correct fill/);
    const view = run("console.log(JSON.stringify({ v: P.view(arg), f: '' }));", withC()).v as string;
    expect(view).toContain('## Bước kết luận');
    for (const b of conclusionFx().bank) expect(view).toContain('[' + b.text + ']');
    for (const label of Object.keys(LABEL_STATUS)) expect(view).not.toContain(label);
    const pieces = view.split('\n').filter((l) => /^- mã k\d/.test(l));
    expect(pieces).toHaveLength(8);
    for (const l of pieces) expect(l).not.toMatch(/sự thật|tranh cãi|truyền thuyết|chưa có nguồn|fact|legend|disputed/i);
  });

  test('F1: the shown bank order may not track the solution (|Spearman rho| < 0.4), also for slots that take many pieces', () => {
    const sp = run("console.log(JSON.stringify([P.spearman([1, 2, 3, 4], [1, 2, 3, 4]), P.spearman([1, 2, 3, 4], [4, 3, 2, 1]), P.spearman([1, 2, 3], [1, 1, 1]), P.spearman([1, 2, 3, 4], [1, 2, 4, 3]), P.bankRho({ ...arg, tokens: arg.tokens.slice(0, 2) }, [[1, 2, 0, 0, 0, 0]])]));", orderFx());
    expect(sp).toEqual([1, -1, 0, 0.8, null]);
    const seeds = run("const out = []; for (let s = 0; s < 12; s++) { const p = { ...arg, bankSeed: s }; const d = p.solutions.map((x) => P.toState(p, x)); const r = P.checkData(p, p.id, { full: false, minL2: 0 }); out.push([P.bankRho(p, d), r.errors.some((e) => /Spearman/.test(e)), r.errors.some((e) => /bank order fills/.test(e))]); } console.log(JSON.stringify(out));", orderFx()) as [number, boolean, boolean][];
    expect(seeds.some(([rho]) => rho >= 0.4)).toBe(true);
    expect(seeds.some(([rho]) => rho < 0.4)).toBe(true);
    for (const [rho, flagged, filled] of seeds) if (!filled) expect(flagged).toBe(rho >= 0.4);
    const sorted = classFx();
    const by = Object.fromEntries(sorted.tokens.map((t: any) => [t.id, t]));
    sorted.tokens = ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'].map((id) => by[id]);
    expect(errorsOf(sorted)).toMatch(/bank order fills a solution \(file order \(placed pieces in answer order\)\)/);
    sorted.tokens.reverse();
    expect(errorsOf(sorted)).toMatch(/bank order fills a solution \(file order \(placed pieces in answer order\)\)/);
    const day = weekdayFx();
    const dd = Object.fromEntries(day.tokens.map((t: any) => [t.id, t]));
    day.tokens = ['da', 'db', 'dc'].map((id) => dd[id]);
    expect(errorsOf(day)).toMatch(/bank order fills a solution \(file order \(placed pieces in answer order\)\)/);
  });

  test('F2: a trap message may only say "Chưa khớp" or name a card, never a slot, a slot label or an ordinal word', () => {
    const msg = (m: string, edit?: (p: any) => void) => { const p = orderFx(); p.wrongFrame.message = m; edit?.(p); return errorsOf(p); };
    for (const m of ['Chưa khớp.', 'Chưa khớp', 'Chưa khớp: một thẻ đang mâu thuẫn.']) expect(msg(m), m).toBe('');
    for (const m of ['Chưa khớp: bánh ở nấc 1 sai.', 'Chưa khớp: bánh cũ nhất không phải ở đây.', 'Chưa khớp: hàng đầu sai.', 'Chưa khớp: mốc nằm sau thẻ 2.', 'Chưa khớp: thứ ba sai.']) expect(msg(m), m).toMatch(/wrongFrame\.message uses slot or ordinal wording/);
    expect(msg('Chưa khớp: sơ khai sai.', (p) => { p.slots[0].label = 'Sơ khai'; })).toMatch(/wrongFrame\.message uses slot or ordinal wording \(sơ, khai|wrongFrame\.message uses slot or ordinal wording \(khai/);
  });

  test('F3: fail wording is banned on every player-facing string, not only hints, messages and rules', () => {
    const put = (path: string, text: string) => {
      const p = orderFx();
      p.conclusion = conclusionFx();
      p.predict = { prompt: 'Theo bạn mốc nào cũ nhất?', options: ['Mốc lịch', 'Mốc cây'] };
      p.demo = { question: 'Ví dụ làm quen.', rules: [{ text: 'Chạm một mảnh.' }] };
      const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
      let o = p;
      for (const k of keys.slice(0, -1)) o = o[k];
      o[keys.at(-1)!] = text;
      return errorsOf(p);
    };
    const cases: [string, string][] = [
      ['reveal.lines[0]', 'Bạn thua nếu xếp sai.'], ['predict.prompt', 'Đoán sai là game over.'], ['predict.options[1]', 'Hết giờ thì mất'],
      ['antiGuess.rule', 'Kiểm tra sai thì bắt đầu lại.'], ['question', 'Xếp các mốc trước khi hết giờ.'], ['conclusion.template', 'Game over: ___ ___ ___'], ['conclusion.bank[3].text', 'điều khiến bạn thất bại'],
    ];
    cases.push(['title', 'Ai thua ai thắng'], ['wrongFrame.text', 'Bạn thua nếu tin mốc đầu tiên.'], ['demo.question', 'Ví dụ: sai là game over.'], ['demo.rules[0].text', 'Chạm sai thì bắt đầu lại.'], ['demo.rules[0]', 'Hết giờ là mất.']);
    for (const [path, text] of cases) expect(put(path, text), path).toMatch(new RegExp(path.replace(/[[\]]/g, '\\$&') + ' implies a fail state'));
    expect(put('title', 'Hai cuốn lịch')).not.toMatch(/implies a fail state/);
    expect(put('demo.question', 'Ví dụ làm quen.')).not.toMatch(/implies a fail state/);
  });

  test('F4: the negative checks that guard sources, hints, text and wrong frames', () => {
    const edit = (f: (p: any) => void) => { const p = orderFx(); f(p); return errorsOf(p); };
    expect(edit((p) => { p.cards[1].evidence = ['một câu không có trong nguồn']; })).toMatch(/card c2: evidence not found in research\/m0b-act-1\.md/);
    expect(edit((p) => { delete p.cards[1].evidence; })).toMatch(/card c2 has no evidence quote/);
    expect(edit((p) => { p.cards[1].url = 'https://example.org/không-có'; })).toMatch(/card c2: url not in research\/m0b-act-1\.md/);
    for (const [i, key] of [[0, 'tier 1'], [1, 'tier 2'], [2, 'tier 3']] as [number, string][]) expect(edit((p) => { p.hints[i].text = 'Hãy đặt Mốc lịch vào đúng chỗ.'; }), key).toMatch(new RegExp('hint ' + key + ' reveals token text "Mốc lịch"'));
    expect(edit((p) => { p.hints[3].text = 'Mốc lịch đã có chỗ.'; })).not.toMatch(/reveals token text/);
    expect(edit((p) => { p.title = 'Thử'.normalize('NFD'); })).toMatch(/title is not NFC/);
    expect(edit((p) => { p.question = 'Giu-se đi tìm nhà trọ cho các mốc.'; })).toMatch(/question has taboo wording: Giu-se/);
    expect(edit((p) => { p.hints[1].card = 'c9'; })).toMatch(/hint tier 2 must point at a card/);
    expect(edit((p) => { delete p.hints[1].card; })).toMatch(/hint tier 2 must point at a card/);
    expect(edit((p) => { p.hints[3].fills = { s2: 'ka' }; })).toMatch(/hint tier 4 fill s2=ka is not forced within 3 rounds/);
    expect(edit((p) => { p.hints[3].fills = {}; })).toMatch(/hint tier 4 must show a first inference/);
    expect(edit((p) => { p.wrongFrame.cards = ['c9']; })).toMatch(/wrongFrame\.cards must name existing cards/);
    expect(edit((p) => { p.wrongFrame.cards = []; })).toMatch(/wrongFrame\.cards must name existing cards/);
    expect(edit((p) => { p.cards[1].kind = 'sách'; })).toMatch(/card c2 kind sách/);
  });

  test('F6: "inference" is a card kind and the player view labels it "suy ra"', () => {
    const p = orderFx();
    p.cards[1].kind = 'inference';
    expect(errorsOf(p)).toBe('');
    const view = run("console.log(JSON.stringify(P.view(arg)));", p) as string;
    expect(view).toMatch(/\*\*Sự thật\*\* · Lịch · suy ra\n/);
    expect(view).toContain('bản ghi');
  });

  test('NOTE: a first state needs a forced move, a token cannot repeat inside one constraint, weekdays and dates are verified against the calendar', () => {
    const forced = noForceFx();
    expect(check(forced).errors).toEqual(['fx: no forced move in round 1: the first state needs a move that follows from one card']);
    expect(check(l2One(), false, 1).errors).toEqual([]);
    const twice = orderFx();
    twice.cards[1].do = { op: 'same', t: ['ka', 'ka'] };
    expect(errorsOf(twice)).toMatch(/constraint: token repeated in one constraint/);

    const names = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const dated = () => {
      const p = weekdayFx();
      p.slots.forEach((s: any, i: number) => { s.weekday = names[i]; });
      Object.assign(p.tokens.find((t: any) => t.id === 'da'), { date: { y: 1647, m: 6, d: 8, cal: 'julian' } });
      Object.assign(p.tokens.find((t: any) => t.id === 'db'), { date: { y: 1647, m: 12, d: 14, cal: 'julian' } });
      Object.assign(p.tokens.find((t: any) => t.id === 'dc'), { date: { y: 1647, m: 12, d: 25, cal: 'julian' } });
      return p;
    };
    expect(errorsOf(dated())).toBe('');
    const forgot = dated();
    delete forgot.slots[1].value;
    expect(errorsOf(forgot)).toMatch(/slot mon is Thứ hai \(weekday\(\) number 1\) but its value is 2/);
    const mondayFirst = dated();
    mondayFirst.slots = [...mondayFirst.slots.slice(1), mondayFirst.slots[0]].map((s: any, i: number) => ({ ...s, value: i }));
    expect(errorsOf(mondayFirst)).toMatch(/slot mon is Thứ hai \(weekday\(\) number 1\) but its value is 0/);
    const unknown = dated();
    unknown.slots[0].weekday = 'Thứ chín';
    expect(errorsOf(unknown)).toMatch(/slot sun weekday "Thứ chín" is not a weekday name/);
    const wrongDay = dated();
    wrongDay.tokens.find((t: any) => t.id === 'dc').date.d = 24;
    expect(errorsOf(wrongDay)).toMatch(/token dc \(24\/12\/1647 julian\) falls on thứ sáu by the calendar, but the declared solution puts it in slot sat \(Thứ bảy\)/);
    const gregorian = dated();
    gregorian.tokens.find((t: any) => t.id === 'da').date.cal = 'gregorian';
    expect(errorsOf(gregorian)).toMatch(/token da \(8\/6\/1647 gregorian\) falls on/);
  });


  const dated = (years: Record<string, number>) => {
    const p = orderFx();
    for (const t of p.tokens) if (years[t.id]) t.text = TEXT[t.id] + ' ' + years[t.id];
    return p;
  };
  // the old dec25 as the reviewer found it: years on the pieces and on the cards, order readable by sorting them
  const oldDec25 = (): any => ({
    id: 'od', format: 'M', input: 'order', goal: 'rank-ties', orientation: 'both', history: 'od', title: 'Ngày 25/12', space: 2100, bankSeed: 0,
    question: 'Bản ghi nào đến trước?', aha: 'Hai mục cùng lịch.', rules: [{ text: 'Chạm một mảnh rồi chạm một nấc.' }],
    slots: ['s1', 's2', 's3'].map((id, i) => ({ id, label: 'Nấc ' + (i + 1), cap: 'any', min: 1 })),
    tokens: [
      { id: 'hyp', text: 'Giả thuyết: Giáng Sinh thay lễ mặt trời', status: 'disputed' }, { id: 'xm', text: 'Bản ghi: mục Chúa sinh 25/12 (lịch 354)', status: 'fact' },
      { id: 'birth', text: 'Ngày sinh thật (chưa ai biết)', status: 'fact' }, { id: 'c380', text: 'Bản ghi năm 380: Constantinople mừng 25/12', status: 'fact' },
      { id: 'sun', text: 'Bản ghi: mục N INVICTI 25/12 (lịch 354)', status: 'fact' }, { id: 'list', text: 'Bản ghi: danh sách có mục Giáng Sinh', status: 'fact' },
    ],
    cards: [
      { id: 'c1', who: 'Lịch năm 354', when: '354', kind: 'record', status: 'fact', ...SRC.a, text: 'Lịch năm 354 ghi ngày 25/12 hai mục: N INVICTI và Chúa sinh ở Bêlem.', do: { op: 'same', t: ['xm', 'sun'] } },
      { id: 'c2', who: 'Sử gia', when: '336', kind: 'record', status: 'disputed', ...SRC.c, text: 'Danh sách có mục Giáng Sinh được cho là có từ năm 336, không muộn hơn bản ghi năm 380.', do: { op: 'expr', e: ['le', ['pos', 'list'], ['pos', 'c380']] } },
      { id: 'c3', who: 'Sử gia', when: '380', kind: 'record', status: 'disputed', ...SRC.b, text: 'Lịch 354 nằm giữa danh sách có mục Giáng Sinh và bản ghi năm 380 ở Constantinople.', do: { op: 'between', t: ['list', 'sun', 'c380'] } },
      { id: 'c4', who: 'Sử gia Hijmans', kind: 'record', status: 'fact', ...SRC.c, text: 'Không bản ghi nào cho biết ngày sinh thật của Chúa.', do: { op: 'unused', t: 'birth' } },
      { id: 'c5', who: 'Giả thuyết hiện đại', kind: 'hypothesis', status: 'disputed', ...SRC.b, text: 'Ngày 25/12 được chọn vì trùng lễ mặt trời: giả thuyết của sử gia.', do: { op: 'unused', t: 'hyp' } },
    ],
    solutions: [[['list'], ['xm', 'sun'], ['c380']]],
  });

  test('B4 (number-sorted variant): years printed on the pieces, or on the cards that name them, let the player sort the answer, so the file fails; misleading years do not', () => {
    const years = { kc: 354, ke: 1605, ka: 1843, kd: 1914, kb: 1955 };
    expect(errorsOf(dated(years))).toMatch(/readable from surface cues: sorting the pieces by the numbers/);
    expect(check(dated(years)).errors).toHaveLength(1);
    expect(errorsOf(dated({ kc: 1914, ke: 354, ka: 1955, kd: 1605, kb: 1843 }))).not.toMatch(/surface cues/);
    expect(errorsOf(orderFx())).not.toMatch(/surface cues/);
    const sorted = run("console.log(JSON.stringify(P.surface(arg)));", dated(years));
    expect(sorted).toEqual({ number: true, keyword: false, roman: false });
    const old = oldDec25();
    expect(errorsOf(old)).toMatch(/readable from surface cues: sorting the pieces by the numbers/);
    expect(run("console.log(JSON.stringify(P.surface(arg)));", old).number).toBe(true);
    const bare = oldDec25();
    for (const c of bare.cards) delete c.when;
    bare.cards[0].who = 'Cuốn lịch La Mã';
    bare.cards[0].text = 'Cuốn lịch La Mã ghi cùng một ngày hai mục: N INVICTI và Chúa sinh ở Bêlem.';
    bare.cards[1].text = 'Danh sách có mục Giáng Sinh được cho là soạn không muộn hơn bản ghi ở Constantinople.';
    bare.cards[2].text = 'Cuốn lịch La Mã nằm giữa danh sách có mục Giáng Sinh và bản ghi ở Constantinople.';
    bare.tokens[1].text = 'Mục Chúa sinh trong cuốn lịch La Mã';
    bare.tokens[3].text = 'Bản ghi ở Constantinople';
    bare.tokens[4].text = 'Mục N INVICTI trong cuốn lịch La Mã';
    expect(errorsOf(bare)).not.toMatch(/surface cues|states an order/);
    expect(run("console.log(JSON.stringify(P.surface(arg)));", bare)).toEqual({ number: false, keyword: false, roman: false });
  });

  test('B4: a card that states an order may not carry a year or a when in an ordering puzzle; a card without an order may', () => {
    const edit = (i: number, f: (c: any) => void) => { const p = orderFx(); f(p.cards[i]); return errorsOf(p); };
    expect(edit(1, (c) => { c.when = '380'; })).toMatch(/card c2 states an order and shows when "380" in an ordering puzzle/);
    expect(edit(1, (c) => { c.text = 'Mốc máy nằm giữa mốc thiệp và mốc lịch năm 1843.'; })).toMatch(/card c2 states an order and shows the year 1843/);
    expect(edit(1, (c) => { c.who = 'Lịch năm 354'; })).toMatch(/card c2 states an order and shows the year 354/);
    expect(edit(2, (c) => { c.when = '1843'; })).not.toMatch(/states an order/);
    const mark = classFx();
    mark.cards[1].when = '1843';
    expect(errorsOf(mark)).not.toMatch(/states an order/);
  });

  test('B4: Roman day counts are read: anchors on the cards give the mapping, and a board that is just every piece on its own date fails as readable; a board that also needs a decision does not', () => {
    const roman = (n: string) => 'Ngày a.d. ' + n + ' Kal. Ian.';
    const fx = (): any => ({
      id: 'rm', input: 'mark',
      slots: [17, 18, 19, 20, 21].map((d, i) => ({ id: 's' + (i + 1), label: d + '/12', cap: 1, value: d })),
      tokens: ['XVI', 'XV', 'XIV', 'XII', 'VIII'].map((n) => ({ id: n.toLowerCase(), text: roman(n), status: 'fact' })),
      cards: [{ id: 'c1', text: 'Lễ bắt đầu ngày 17/12, lối La Mã viết là a.d. XVI Kal. Ian. Còn ngày a.d. VIII Kal. Ian. là 25/12.' }],
      solutions: [['xvi', 'xv', 'xiv', null, 'xii']],
    });
    expect(run("console.log(JSON.stringify(P.surface(arg)));", fx())).toEqual({ number: false, keyword: false, roman: true });
    const decided = fx();
    decided.solutions = [['xvi', 'xv', null, 'xii', null]];
    expect(run("console.log(JSON.stringify(P.surface(arg)));", decided)).toEqual({ number: false, keyword: false, roman: false });
    const leftOut = fx();
    leftOut.solutions = [['xvi', 'xv', null, null, 'xii']];
    expect(run("console.log(JSON.stringify(P.surface(arg)));", leftOut), 'a part of the board the Roman reader reads is not that board: the reader does not know which piece to leave out').toEqual({ number: false, keyword: false, roman: false });
    const noAnchor = fx();
    noAnchor.cards[0].text = 'Lễ bắt đầu ngày 17/12, lối La Mã viết là a.d. XVI Kal. Ian.';
    expect(run("console.log(JSON.stringify(P.surface(arg)));", noAnchor)).toMatchObject({ roman: false });
    expect(run("console.log(JSON.stringify([P.romanValue('XIV'), P.romanValue('IX'), P.romansIn('Ngày a.d. XIV Kal. Ian. và XII')]));", null)).toEqual([14, 9, [14, 12]]);
    const real = puzzle('saturnalia');
    expect(run("console.log(JSON.stringify(P.surface(arg)));", real), 'the redesigned saturnalia needs a decision beyond the Roman mapping').toMatchObject({ roman: false });
    const shortcut = puzzle('saturnalia');
    shortcut.solutions = [['m', 'k', 't', 'p', 'r', 'n', null]];
    shortcut.cards[0].text = 'Lễ bắt đầu ngày 17/12, lối La Mã viết là a.d. XVI Kal. Ian. Còn ngày a.d. VIII Kal. Ian. là 25/12.';
    expect(run("console.log(JSON.stringify(P.surface(arg)));", shortcut), 'an answer that is just every piece on its own date is still caught').toMatchObject({ roman: true });
    const readable = puzzle('saturnalia');
    readable.cards = [shortcut.cards[0]];
    readable.rules = [];
    readable.solutions = shortcut.solutions;
    expect(errorsOf(readable)).toMatch(/readable from surface cues: reading the Roman day counts off the anchors/);
  });

  test('F-d: the facilitator sheet answers a wrong-frame board like any wrong board: no trap line, no card pointed at, never undefined', () => {
    for (const id of files) {
      const r = spawnSync('node', ['scripts/puzzles.mjs', 'facilitator', id], { cwd: root, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout, id).not.toContain('undefined');
      expect(r.stdout, id).not.toContain('Rơi vào bẫy');
      expect(r.stdout, id).not.toContain('Đọc lại thẻ');
    }
  });

  test('F-e: the answer syntax says codes are case-insensitive, and a reply accepts either case', () => {
    const view = spawnSync('node', ['scripts/puzzles.mjs', 'view', 'yule'], { cwd: root, encoding: 'utf8' }).stdout;
    expect(view).toContain('chữ hoa hay chữ thường đều được');
    expect(view).not.toContain('chữ thường, không dấu cách');
    const p = puzzle('yule');
    const boards = ['B,,S,P,H,,', 'b,,s,p,h,,'];
    expect(replies(p, boards).map((r) => r.type)).toEqual(['solved', 'solved']);
    for (const t of p.tokens) expect(t.id, 'a code letter confusable with I, 1 or l').not.toMatch(/^[Il1O0]$/);
  });

  test('F1 (3 placed pieces): the rho limit is skipped when fewer than four pieces are placed, since three points only give 0.5 or 1', () => {
    const r = check(puzzle('saturnalia'));
    expect(r.rho).toBeNull();
    expect(r.errors).toEqual([]);
  });

  test('F2-r2: an exact trap needs the trap pieces alone, a full table is not the frame', () => {
    const p = puzzle('saturnalia');
    const boards = [',k,,p,,n,', 'm,k,t,p,r,n,', 'm,,t,,r,,'];
    expect(replies(p, boards)).toEqual([{ type: 'wrong' }, { type: 'wrong' }, { type: 'solved' }]);
    const loose = puzzle('saturnalia');
    delete loose.wrongFrame.exact;
    expect(replies(loose, boards.slice(0, 2)).map((r) => r.type)).toEqual(['wrong', 'wrong']);
  });

  test('F3-r2: pieces that alternate between placed and unplaced in the file, id or shown order give the extras away', () => {
    const p = puzzle('saturnalia');
    expect(check(p).errors).toEqual([]);
    const file = puzzle('saturnalia');
    file.tokens = ['m', 'k', 't', 'p', 'r', 'n'].map((id) => file.tokens.find((t: any) => t.id === id));
    expect(errorsOf(file)).toMatch(/file order \(placed and unplaced pieces alternate\)/);
    const ids = puzzle('saturnalia');
    const swap: Record<string, string> = { m: 'a', t: 'c', r: 'e', k: 'b', p: 'd', n: 'f' };
    const text = JSON.stringify(ids).replace(/"(m|t|r|k|p|n)"/g, (_, x) => '"' + swap[x] + '"');
    expect(errorsOf(JSON.parse(text))).toMatch(/id order \(placed and unplaced pieces alternate\)/);
  });

  test('F4-r2: yule models its wrong frame, so only the card that breaks it passes; a rule card does not', () => {
    expect(check(puzzle('yule')).errors).toEqual([]);
    for (const cards of [['c1'], ['c2'], ['c3']]) {
      const y = puzzle('yule');
      y.wrongFrame.cards = cards;
      expect(errorsOf(y), cards.join()).toMatch(/do not eliminate the trap board/);
      expect(errorsOf(y), cards.join()).toMatch(/do not break wrongFrame\.do/);
    }
    const y = puzzle('yule');
    expect(replies(y, ['B,,S,P,H,,', ',S,,P,H,,', 'B,S,,P,,,H', 'S,,B,P,H,,']).map((r) => r.type)).toEqual(['solved', 'wrong', 'wrong', 'wrong']);
    expect(replies(y, ['B,S,,P,H,,'])[0]).toEqual({ type: 'wrong' });
  });

  test('F5-r2: a card may cite two research files; every file must exist and every quote must be in one of them', () => {
    expect(check(puzzle('saturnalia')).errors).toEqual([]);
    const gone = puzzle('saturnalia');
    gone.cards[1].source = 'research/m0b-act-1.md §5 S2; research/none.md §1';
    expect(errorsOf(gone)).toMatch(/source file missing/);
    const one = puzzle('saturnalia');
    one.cards[2].source = 'research/m0b-act-1.md §5 S2';
    expect(errorsOf(one)).toMatch(/evidence not found in research\/m0b-act-1\.md §5 S2: a sexto decimo/);
    expect(errorsOf(one)).toMatch(/url not in research\/m0b-act-1\.md §5 S2: https:\/\/penelope\.uchicago\.edu\/Thayer/);
  });

  test('F6-r2: the paper view names the puzzle id for reply and hint and numbers the cells as "mục k = label", so a column number is never read as a cell number', () => {
    const view = spawnSync('node', ['scripts/puzzles.mjs', 'view', 'yule'], { cwd: root, encoding: 'utf8' }).stdout;
    expect(view).toContain('Mã câu đố: yule');
    expect(view).toContain('mục 1 = Năm viết, cột 2');
    expect(view).toContain('mục 4 = Thời được tả, cột 1');
    expect(view).not.toMatch(/^\d+\. (Năm viết|Thời được tả)/m);
    const dec = check(puzzle('dec25'));
    expect(dec.warnings).toEqual([]);
  });

  test('B4: keywords carry a slot to a piece when a card names the piece and a slot word together', () => {
    const p = { id: 'kw', input: 'assign', slots: [1, 2, 3].map((i) => ({ id: 's' + i, label: 'Nấc ' + i })), tokens: ['bánh lịch', 'bánh cây', 'bánh thiệp'].map((text, i) => ({ id: 't' + i, text, status: 'fact' })), cards: [{ id: 'c1', text: 'Bánh lịch ở nấc 1.' }, { id: 'c2', text: 'Bánh cây ở nấc 2.' }, { id: 'c3', text: 'Bánh thiệp ở nấc 3.' }], solutions: [['t0', 't1', 't2']] };
    expect(run("console.log(JSON.stringify(P.surface(arg)));", p)).toEqual({ number: false, keyword: true, roman: false });
    p.cards = [{ id: 'c1', text: 'Bánh lịch đến trước bánh cây.' }, { id: 'c2', text: 'Bánh cây đến trước bánh thiệp.' }, { id: 'c3', text: 'Bánh thiệp không ở đầu.' }];
    expect(run("console.log(JSON.stringify(P.surface(arg)));", p)).toEqual({ number: false, keyword: false, roman: false });
  });

  test('B4 (neutral-noun variant): any record whose relation the evidence never states is a warning, whoever speaks; an inference or a matching evidence is not', () => {
    const neutral = () => {
      const p = orderFx();
      const names: Record<string, string> = { ka: 'Bánh A', kb: 'Bánh B', kc: 'Bánh C', kd: 'Bánh D', ke: 'Bánh E', kf: 'Bánh F' };
      for (const t of p.tokens) t.text = names[t.id];
      p.cards[0].text = 'Bánh F là thừa.';
      p.cards[1].who = 'Sử gia';
      p.cards[1].text = 'Bánh E nằm giữa bánh C và bánh A.';
      return p;
    };
    const w = check(neutral()).warnings.join('\n');
    expect(w).toMatch(/card c2 \(record, Sử gia\) says "giữa" but its evidence never states that relation/);
    const ok = neutral();
    ok.cards[1].evidence = ['The calendar lists the day between two others'];
    expect(check(ok).warnings).toEqual([]);
    const inf = neutral();
    inf.cards[1].kind = 'inference';
    expect(check(inf).warnings).toEqual([]);
    const game = neutral();
    game.cards[1].who = 'Lịch';
    expect(check(game).warnings.join('\n')).toMatch(/card c2 \(record, Lịch\) says "giữa" but its evidence never states that relation/);
    const nobody = neutral();
    delete nobody.cards[1].who;
    expect(check(nobody).warnings.join('\n')).toMatch(/card c2 \(record, no speaker\) says "giữa"/);
    const old = check(oldDec25()).warnings.join('\n');
    expect(old).toMatch(/card c2 \(record, Sử gia\) says "muộn"/);
    expect(old).toMatch(/card c3 \(record, Sử gia\) says "giữa"/);
    expect(check(orderFx()).warnings).toEqual([expect.stringMatching(/card c2 \(record, Lịch\) says "giữa"/)]);
  });

  test('N1′ (generic rule text): a rule card must name the pieces or slots its constraint is about', () => {
    const asRule = (id: string, text: string) => {
      const p = orderFx();
      Object.assign(p.cards.find((x: any) => x.id === id), { status: 'rule', kind: 'rule', source: 'game', text });
      for (const k of ['url', 'evidence']) delete p.cards.find((x: any) => x.id === id)[k];
      return errorsOf(p);
    };
    expect(asRule('c2', 'Quy tắc xếp mảnh cũ trước.')).toMatch(/rule card c2 does not express its constraint \(between .*\): its text names 0 of the pieces and slots it constrains, 2 needed/);
    expect(asRule('c2', 'Mảnh nằm giữa hai mảnh khác.')).toMatch(/rule card c2 does not express its constraint/);
    expect(asRule('c2', 'Mốc máy nằm giữa mốc thiệp và mốc lịch.')).not.toMatch(/does not express/);
    expect(asRule('c2', 'Mốc máy nằm giữa hai mốc khác.')).toMatch(/names 1 of the pieces/);
    expect(asRule('c3', 'Mốc nào cũng có chỗ của nó.')).toMatch(/rule card c3 does not express its constraint \(at /);
    expect(asRule('c3', 'Mốc lịch đứng giữa dãy.')).not.toMatch(/does not express/);
    const intro = orderFx();
    intro.id = 'intro';
    intro.history = 'none';
    for (const c of intro.cards) { c.status = 'rule'; c.kind = 'rule'; c.source = 'game'; c.text = 'Quy tắc chung.'; delete c.url; delete c.evidence; }
    expect(errorsOf(intro)).toMatch(/rule card c2 does not express its constraint/);
    expect(check(puzzle('intro')).errors).toEqual([]);
  });

  test('F-c: a capitalised proper name that opens a sentence of a rule card is caught, an ordinary opening word is not', () => {
    const asRule = (text: string) => {
      const p = orderFx();
      Object.assign(p.cards[2], { status: 'rule', kind: 'rule', source: 'game', text });
      delete p.cards[2].url;
      delete p.cards[2].evidence;
      return errorsOf(p);
    };
    expect(asRule('Luther đứng sau mốc lịch.')).toMatch(/rule card c3 carries the proper name Luther/);
    expect(asRule('Mốc lịch đứng giữa dãy. Strasbourg ở ngay trước.')).toMatch(/rule card c3 carries the proper name Strasbourg/);
    expect(asRule('Mốc lịch đứng giữa dãy.')).not.toMatch(/proper name/);
    expect(asRule('Mốc lịch đứng giữa dãy. Mốc cây đứng cuối.')).not.toMatch(/proper name/);
  });

  test('D-c (refusal as detector): a board with a legend piece in a fact slot is answered like any wrong board, and only a solution is held to the status rule', () => {
    const p = orderFx();
    Object.assign(p.tokens.find((t: any) => t.id === 'kf'), { status: 'legend', text: 'Người ta kể rằng mốc nến có thật', source: 'research/m0b-act-1.md', url: SRC.a.url, evidence: SRC.a.evidence });
    const slots = ['kc', 'ke', 'ka', 'kd', 'kb'];
    const boards = slots.map((_, i) => slots.map((t, j) => (i === j ? 'kf' : t)).join(','));
    expect(replies(p, boards)).toEqual(boards.map(() => ({ type: 'wrong' })));
    const parse = run("console.log(JSON.stringify(arg.boards.map((b) => P.parseBoard(arg.p, b))));", { p, boards }) as any[];
    for (const b of parse) expect(b.type).toBeUndefined();
    const reasons = run("const out = []; for (const x of arg.p.tokens) for (let s = 0; s < 5; s++) { const cells = ['', '', '', '', '']; cells[s] = x.id; const r = P.parseBoard(arg.p, cells); out.push(r.reason ?? null); } console.log(JSON.stringify(out));", { p }) as (string | null)[];
    expect(reasons.every((r) => r === null)).toBe(true);
    const states = run("console.log(JSON.stringify(P.states(arg).filter((v) => v[arg.tokens.findIndex((t) => t.id === 'kf')] > 0).length));", p);
    expect(states).toBeGreaterThan(0);
    const inSlot = orderFx();
    Object.assign(inSlot.tokens.find((t: any) => t.id === 'ka'), { status: 'legend', text: 'Người ta kể rằng mốc lịch có thật' });
    expect(errorsOf(inSlot)).toMatch(/declared solution .* is not a valid board/);
  });

  test('B5 (stub): a logic-only puzzle with placeholder text and no sources is checked for space, uniqueness, necessity, L2 and surface cues', () => {
    const stubOf = (p: any, id = p.id): any => ({
      id, stub: true, input: p.input, space: p.space,
      slots: p.slots.map((s: any) => ({ id: s.id, ...(s.cap !== undefined ? { cap: s.cap } : {}) })),
      tokens: p.tokens.map((t: any) => ({ id: t.id, ...(t.required ? { required: true } : {}) })),
      cards: p.cards.map((c: any) => ({ id: c.id, do: c.do })),
      solutions: p.solutions,
    });
    const clean = check(stubOf(l2One()), true);
    expect(clean.errors).toEqual([]);
    expect([clean.space, clean.count, clean.levels.l2]).toEqual([720, 1, 1]);
    expect(check(stubOf(l2Two()), true, 2).errors).toEqual([]);
    const two = stubOf(l2One());
    two.cards = two.cards.slice(0, 3);
    expect(errorsOf(two, true)).toMatch(/solver finds \d+ solution\(s\)|is not needed/);
    const easy = stubOf(orderFx());
    easy.cards[2].do = [easy.cards[2].do, { op: 'notAt', t: 'kd', s: 's1' }];
    expect(errorsOf(easy, true, 1)).toMatch(/too easy for this chapter: L1 plus 0 L2 step\(s\)/);
    expect(errorsOf(easy, true, 0)).toBe('');
    const small = stubOf(orderFx());
    small.tokens = small.tokens.slice(0, 5);
    small.cards[0].do = { op: 'unused', t: 'kd' };
    small.solutions = [['kc', 'ke', 'ka', 'kd', 'kb']];
    small.space = 120;
    expect(errorsOf(small, true, 0)).toMatch(/valid answer space 120 < 241/);
    const stale = stubOf(l2One());
    stale.space = 719;
    expect(errorsOf(stale, true)).toMatch(/declared space 719 but the valid state count is 720/);
    const yr: Record<string, number> = { kc: 354, ke: 1605, ka: 1843, kd: 1914, kb: 1955 };
    const sorted = stubOf(orderFx());
    sorted.tokens.forEach((t: any) => { if (yr[t.id]) t.text = 'Mốc ' + yr[t.id]; });
    expect(errorsOf(sorted, true, 0)).toMatch(/readable from surface cues: sorting the pieces by the numbers/);
    const noInput = stubOf(orderFx());
    delete noInput.solutions;
    expect(errorsOf(noInput, true, 0)).toMatch(/stub is missing solutions/);
    const real = run("const r = P.checkData(arg, arg.id, { full: true, stub: true, minL2: 0 }); console.log(JSON.stringify({ errors: r.errors, space: r.info.space }));", orderFx());
    expect(real.errors).toHaveLength(1);
    expect(real.errors[0]).toMatch(/^fx: piece kd is named by no card/);
    expect(real.space).toBe(720);
  });

  test('B5 (stub CLI): "puzzles.mjs stub <file>" prints a verdict and exits 1 on a broken stub', () => {
    const scratch = scratchDir();
    try {
      const good: any = { id: 'fx', stub: true, input: 'order', space: 720, slots: slots5().map((s) => ({ id: s.id })), tokens: ['ka', 'kb', 'kc', 'kd', 'ke', 'kf'].map((id) => ({ id })), cards: l2One().cards.map((c: any) => ({ id: c.id, do: c.do })), solutions: [['kc', 'kb', 'ka', 'ke', 'kf']] };
      const file = join(scratch, 'fx.json');
      writeFileSync(file, JSON.stringify(good));
      const ok = spawnSync('node', ['scripts/puzzles.mjs', 'stub', file], { cwd: root, encoding: 'utf8' });
      expect(ok.status, ok.stdout + ok.stderr).toBe(0);
      expect(ok.stdout).toContain('fx STUB');
      expect(ok.stdout).toContain('OK (stub');
      expect(ok.stdout).toContain('forced moves in round 1: 1');
      expect(ok.stdout).toMatch(/tap-everything \d+\.\d%, bank order n\/a/);
      writeFileSync(file, JSON.stringify({ ...good, cards: good.cards.slice(0, 3) }));
      const bad = spawnSync('node', ['scripts/puzzles.mjs', 'stub', file], { cwd: root, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toMatch(/solver finds|is not needed/);
      const none = spawnSync('node', ['scripts/puzzles.mjs', 'stub'], { cwd: root, encoding: 'utf8' });
      expect(none.status).toBe(2);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test('B5 (matrix): every row needs an l2 describing its hypothesis or joint-card steps, matching the checker; a row that is not full may name a stub', () => {
    const levels = run("const out = {}; for (const id of arg) out[id] = P.checkOne(id).info.levels.l2; console.log(JSON.stringify(out));", files) as Record<string, number>;
    const rows = JSON.parse(readFileSync(join(root, 'story/minigames.json'), 'utf8')) as any[];
    const steps = (n: number, id: string) => (n === 0 ? 'không: chỉ đọc từng thẻ một (L1)' : Array.from({ length: n }, (_, i) => 'giả định mảnh số ' + (i + 1) + ' không ở ô đầu, rồi đọc lại các thẻ').join('; '));
    const fill = (r: any) => ({ ...r, l2: steps(levels[r.id] ?? (r.id === 'ending' || r.act >= 3 ? 2 : 1), r.id) });
    const scratch = scratchDir();
    const spare = rows.filter((r) => r.act < 3 && r.id !== 'mistletoe' && levels[r.id] === 1 && !stubIds().includes(r.id)).map((r) => r.id);
    const [stubRow, twin] = [...stubIds().filter((id) => id !== 'mistletoe' && rows.find((r) => r.id === id).act < 3), ...spare] as [string, string];
    const unfull = (r: any) => (r.state === 'full' ? { ...r, state: 'ok' } : r);
    const runMatrix = (matrix: any[], env: Record<string, string> = {}, stubIds: string[] = [stubRow]) => {
      rmSync(scratch, { recursive: true, force: true });
      mkdirSync(join(scratch, 'puzzles'), { recursive: true });
      for (const id of files) copyFileSync(join(root, 'story/puzzles', id + '.json'), join(scratch, 'puzzles', id + '.json'));
      for (const id of stubIds) writeFileSync(join(scratch, 'puzzles', id + '.json'), JSON.stringify({ ...stubFile(), id }));
      writeFileSync(join(scratch, 'matrix.json'), JSON.stringify(matrix));
      const r = spawnSync('node', ['scripts/check-minigames.mjs', join(scratch, 'matrix.json')], { cwd: root, encoding: 'utf8', env: { ...process.env, PUZZLES_DIR: join(scratch, 'puzzles'), ...env } });
      return { out: r.stdout, err: r.stderr.split('\n').filter((l) => /^error: /.test(l)) };
    };
    const stubFile = () => { const p = l2One(); return { id: 'x', stub: true, input: p.input, space: p.space, slots: p.slots.map((s: any) => ({ id: s.id })), tokens: p.tokens.map((t: any) => ({ id: t.id })), cards: p.cards.map((c: any) => ({ id: c.id, do: c.do })), solutions: p.solutions }; };
    const hit = (err: string[], re: RegExp) => err.filter((l) => re.test(l));
    try {
      const good = rows.map((r) => (r.id === stubRow ? { ...unfull(fill(r)), puzzle: 'story/puzzles/' + stubRow + '.json' } : fill(r)));
      const clean = runMatrix(good);
      expect(clean.err.filter((l) => /l2|stub|story\/puzzles/.test(l) && !/^error: puzzle /.test(l)), clean.err.join('\n')).toEqual([]);
      expect(clean.out).toContain('stubs checked (logic only): ' + stubRow);
      expect(hit(clean.err, /duplicate card shape/)).toEqual([]);

      const twins = runMatrix(good.map((r: any) => (r.id === twin ? { ...unfull(r), puzzle: 'story/puzzles/' + twin + '.json' } : r)), {}, [stubRow, twin]);
      expect(hit(twins.err, new RegExp('duplicate card shape .*: (' + stubRow + ', ' + twin + '|' + twin + ', ' + stubRow + ')')), twins.err.join('\n')).toHaveLength(1);

      const act3 = rows.find((r) => r.act >= 3 && r.id !== 'ending').id;
      const bad = good.map((r: any) => {
        if (r.id === 'intro') return { ...r, l2: 'Có một bước giả định nhỏ' };
        if (r.id === 'ending') return { ...r, l2: 'giả định đèn lồng không ở nấc 2, rồi đọc lại các thẻ' };
        if (r.id === act3) return { ...r, l2: 'giả định mảnh số 1 không ở ô đầu, rồi đọc lại các thẻ' };
        if (r.id === 'yule') return { ...r, l2: 'Một bước nhỏ ở đâu đó thôi nhé, không cần nói rõ' };
        if (r.id === 'mistletoe') { const { l2, ...rest } = r; return rest; }
        if (r.id === stubRow) return { ...r, state: 'full' };
        return r;
      });
      const res = runMatrix(bad);
      expect(hit(res.err, /intro\).*l2 must start with "không"|intro\): the intro is solved by L1 alone/).length, res.err.join('\n')).toBe(1);
      expect(hit(res.err, /\(ending\): l2 lists 1 step\(s\) but this chapter needs 2/).length).toBe(1);
      expect(hit(res.err, new RegExp('\\(' + act3 + '\\): l2 lists 1 step\\(s\\) but this chapter needs 2')).length).toBe(1);
      expect(hit(res.err, /ending: l2 in the matrix describes 1 step\(s\) but the checker needs 2/).length).toBe(1);
      expect(hit(res.err, /\(yule\): l2 step ".*" must name a hypothesis/).length).toBe(1);
      expect(hit(res.err, /\(mistletoe\): missing field l2/).length).toBe(1);
      expect(hit(res.err, new RegExp('\\(' + stubRow + '\\): a stub puzzle cannot back a row with state full')).length).toBe(1);

      const open = rows.find((r) => r.id !== 'intro' && r.id !== stubRow && r.id !== twin).id;
      const real = good.map((r: any) => (r.id === open ? { ...unfull(r), puzzle: 'story/puzzles/intro.json' } : r.id === stubRow ? { ...r, puzzle: 'story/puzzles/intro.json' } : r));
      const wrong = runMatrix(real);
      expect(hit(wrong.err, new RegExp('\\(' + open + '\\): puzzle must be story/puzzles/' + open + '\\.json and exist')).length).toBe(1);
      expect(hit(wrong.err, new RegExp('\\(' + stubRow + '\\): puzzle must be')).length).toBe(1);

      const orphan = good.map((r: any) => (r.id === stubRow ? { ...r, puzzle: undefined } : r));
      expect(hit(runMatrix(orphan).err, new RegExp(stubRow + '\\.json has no row')).length).toBe(1);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});


test.describe('puzzle redesign: sources, frames, the ending and the conclusion', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  const rows = () => JSON.parse(readFileSync(join(root, 'story/minigames.json'), 'utf8')) as any[];

  test('R-a: a puzzle that is not the intro needs wrongFrame.do; the intro needs wrongFrame.exempt with a reason', () => {
    for (const id of files) {
      const p = puzzle(id);
      if (id === 'intro') {
        expect(p.wrongFrame.do).toBeUndefined();
        expect(String(p.wrongFrame.exempt).length).toBeGreaterThanOrEqual(15);
        delete p.wrongFrame.exempt;
        expect(errorsOf(p)).toMatch(/wrongFrame\.do is missing/);
      } else {
        expect(p.wrongFrame.do, id).toBeTruthy();
        delete p.wrongFrame.do;
        expect(errorsOf(p), id).toMatch(/wrongFrame\.do is missing/);
      }
    }
  });

  test('R-b: saturnalia leaves at least four boards after any two cards, and its assumption card is not shown as a fact', () => {
    const p = puzzle('saturnalia');
    const left = run("const sts = P.states(arg); const ids = arg.cards.map((c) => c.id); const out = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push([ids[i] + ids[j], P.solutions(arg, new Set([ids[i], ids[j]]), sts).length]); console.log(JSON.stringify(out));", p) as [string, number][];
    expect(left.length).toBe(6);
    for (const [pair, n] of left) expect(n, pair).toBeGreaterThanOrEqual(4);
    const assumption = p.cards.filter((c: any) => /giả sử|giả định/iu.test(c.text));
    expect(assumption.length).toBe(1);
    expect(assumption[0].status).toBe('disputed');
    expect(assumption[0].who).not.toMatch(/Macrobius/);
    expect(p.predict.options).toContain('21/12');
    expect(p.predict.options).not.toContain('25/12');
  });

  test('R-c: dec25 says what the sources say: no "hoặc cùng lúc", no earliest-record claim, the hedge "được cho là lễ mặt trời" on card c1 and on no piece or option, and the pieces do not declare their own status', () => {
    const p = puzzle('dec25');
    const text = JSON.stringify(p) + readFileSync(join(root, 'story/notebook/dec25.json'), 'utf8');
    expect(text).not.toMatch(/hoặc cùng lúc/);
    expect(text).not.toMatch(/[Bb]ản ghi (chép )?sớm nhất/);
    expect(p.cards.find((c: any) => c.do?.op === 'same').text).toMatch(/cả hai nằm trong một cuốn lịch La Mã, nên cùng lúc/);
    expect(JSON.stringify(p.cards.find((c: any) => c.id === 'c1').do)).not.toContain('"or"');
    expect(p.cards.find((c: any) => c.do?.op === 'same').text).toMatch(/^Mục N INVICTI \(được cho là lễ mặt trời\)/);
    for (const t of p.tokens) expect(t.text, t.id).not.toMatch(/lễ mặt trời|được cho là/);
    for (const t of p.tokens) expect(t.text, t.id).not.toMatch(/^Giả thuyết/);
    expect(p.tokens.find((t: any) => t.id === 'birth').text).not.toMatch(/thật/);
    expect(p.predict.options.join(' ')).not.toMatch(/lễ mặt trời|được cho là/);
    const book = /cuốn lịch|lịch La Mã/;
    for (const t of p.tokens) expect(t.text, t.id + ' does not say which book it sits in: only card c1 says both entries share one').not.toMatch(book);
    expect([p.title, p.question, p.predict.prompt, ...p.predict.options, ...p.rules.map((r: any) => r.text), ...p.hints.slice(0, 3).map((h: any) => h.text)].join(' ')).not.toMatch(book);
    expect(p.tokens.find((t: any) => t.id === 'hyp').text).toMatch(/cho lễ ở Rôma$/);
    expect(p.tokens.find((t: any) => t.id === 'birth').text).not.toMatch(/Bêlem|Bethlehem|Tin Mừng|bản ghi/i);
    const c4 = p.cards.find((c: any) => c.id === 'c4');
    expect(c4.do).toEqual({ op: 'expr', e: ['or', ['not', ['placed', 'birth']], ['lt', ['slot', 'birth'], ['slot', 'list']]] });
    expect(c4.kind).toBe('inference');
    expect(c4.who).toMatch(/^Suy ra từ .*Hijmans.*Bible Odyssey/);
    expect(c4.text).toMatch(/Không bản ghi nào chép ngày sinh thật của Chúa: nếu ngày sinh ấy có chỗ, nó đứng trước danh sách có mục Giáng Sinh/);
    expect(c4.text).not.toMatch(/ở ngoài/);
    expect(JSON.stringify(p.cards.map((c: any) => c.do))).not.toContain('"unused"');
    expect(c4.evidence.join(' ')).toMatch(/the earliest Christians did not know exactly when Jesus was born/);
    expect(p.cards.find((c: any) => c.id === 'c5').do).toEqual({
      op: 'expr',
      e: ['or', ['not', ['placed', 'hyp']], ['and', ['gt', ['slot', 'hyp'], ['slot', 'sun']], ['lt', ['slot', 'hyp'], ['slot', 'xm']]]],
    });
    expect(p.cards.find((c: any) => c.id === 'c5').kind).toBe('inference');
    expect(p.cards.find((c: any) => c.id === 'c5').who).toMatch(/^Suy ra từ History Today và sử gia Hijmans/);
    expect(p.cards.find((c: any) => c.id === 'c5').text).toMatch(/^Giả thuyết: lễ mặt trời có trước việc chọn ngày\. Nếu việc ấy có chỗ, nó sau mục N INVICTI, trước mục Chúa sinh\.$/);
    expect(p.wrongFrame.text).toBe('Tèo đoán: lễ mặt trời có bản ghi trước.');
    expect(rows().find((r) => r.id === 'dec25').wrongFrame).not.toMatch(/người ta kể|thay lễ mặt trời/);
  });

  test('R-c2: dec25 needs its cards: no card names a rung or sets one, each card names as many sources as it links, predict holds the true answer, and the only L2 step comes from cards 1 and 3 plus the rule that a rung takes at most two pieces', () => {
    const p = puzzle('dec25');
    for (const c of p.cards) {
      expect(c.text, c.id).not.toMatch(/nấc|mới nhất|cũ nhất/);
      for (const d of [c.do].flat()) expect(['at', 'notAt', 'oneOf'], c.id).not.toContain(d.op);
      if (c.kind !== 'hypothesis') expect(c.who.replace(/^Suy ra từ /, '').split(' và ').length, c.id + ' names as many sources as it links').toBe([c.url].flat().length);
    }
    expect(p.predict.options).toContain('Cùng lúc');
    expect(p.predict.options.join(' ')).not.toMatch(/chưa rõ|chờ/i);
    const lv = check(p, true).levels;
    expect([lv.l2, lv.path]).toEqual([1, ['hypothesis xm≠3']]);
    const l2 = rows().find((r) => r.id === 'dec25').l2;
    expect(l2).toMatch(/mỗi nấc nhiều nhất hai mảnh/);
    expect(l2).not.toMatch(/các thẻ đã đọc/);
    const free = puzzle('dec25');
    for (const s of free.slots) s.cap = 'any';
    expect(check(free).count, 'without the rule that a rung takes at most two pieces the cards alone leave more than one board').toBeGreaterThan(1);
  });

  test('R-c3: dec25 card c3 rests on two firm dates and is a fact in the puzzle and the row; the aha and the reveal speak of the surviving 354 copy, not of every record; hint 2 counts the three pieces card c2 relates', () => {
    const p = puzzle('dec25');
    const row = rows().find((r) => r.id === 'dec25');
    expect(p.cards.find((c: any) => c.id === 'c3').status).toBe('fact');
    expect(row.cards[2].status).toBe('fact');
    expect(p.cards.filter((c: any) => c.status === 'disputed').map((c: any) => c.id)).toEqual(['c5']);
    expect(row.cards.map((c: any) => c.status)).toEqual(p.cards.map((c: any) => c.status));
    expect(row.aha).toBe(p.aha);
    expect(p.aha).toMatch(/354 còn lại/);
    expect(p.reveal.lines[0]).toMatch(/354 còn lại/);
    expect(p.reveal.lines[0]).toMatch(/^Hai mục cùng nằm trong một cuốn lịch/);
    expect(p.hints[1].text).toMatch(/với ba mảnh khác/);
  });

  test('R-d: yule attributes the three-century gap as an inference from Heimskringla and Hákon, with a column rule that does not contradict it', () => {
    const p = puzzle('yule');
    const c5 = p.cards.find((c: any) => c.id === 'c4');
    expect(c5.kind).toBe('inference');
    expect(c5.who).toMatch(/Heimskringla/);
    expect(c5.evidence.join(' ')).toMatch(/1230/);
    expect(c5.evidence.join(' ')).toMatch(/934–961/);
    expect(p.rules.map((r: any) => r.text).join(' ')).not.toMatch(/gần ba thế kỷ là ít nhất/);
    for (const t of p.tokens) expect(t.text, t.id).not.toMatch(/thời .* tả/);
    expect(p.reveal.label).toBe('SỰ THẬT');
    expect(rows().find((r) => r.id === 'yule').label).toBe(p.reveal.label);
  });

  test('R-e: hint 3 of every puzzle puts the wrong frame to the player as a question, and yule no longer hands over the hypothesis step', () => {
    expect(puzzle('yule').hints[2].text).not.toMatch(/Thử một cột/);
    for (const id of files) expect(puzzle(id).hints[2].text, id).toMatch(/\?$/);
  });

  test('R-f: kind "modern" is a card kind of its own, shown as a modern historian\'s statement and not as a record', () => {
    expect(puzzle('saturnalia').cards.some((c: any) => c.kind === 'modern')).toBe(true);
    expect(puzzle('bethlehem').cards.find((c: any) => c.id === 'c3').kind).toBe('modern');
    expect(spawnSync('node', ['scripts/puzzles.mjs', 'view', 'bethlehem'], { cwd: root, encoding: 'utf8' }).stdout).toMatch(/Yale ISM Review; BAR · nhận định hiện đại/);
    const odd = puzzle('bethlehem');
    odd.cards[4].kind = 'chronicle';
    expect(errorsOf(odd)).toMatch(/card c5 kind chronicle/);
  });

  test('R-g: ending: the wrong frame is the journey order, the board is incomplete until all five gears are placed, and an empty board spends no check', () => {
    const p = puzzle('ending');
    expect(p.wrongFrame.text).toMatch(/gặp sau/);
    expect(p.wrongFrame.do.length).toBe(4);
    expect(p.wrongFrame.cards).toEqual(['c2', 'c4']);
    const none = ['', '', '', '', ''];
    const half = [['d'], ['t'], ['k'], [], []];
    const lone = ['x', '', '', '', ''];
    const journey = [['d'], ['t'], ['k'], ['h'], ['l']];
    const full = [['d'], ['t'], ['k'], ['l'], ['h']];
    const out = replies(p, [none, half, lone, journey, full]);
    expect(out[0]).toEqual({ type: 'incomplete', empty: 5 });
    expect(out[1]).toEqual({ type: 'incomplete', empty: 2 });
    expect(out[2]).toEqual({ type: 'incomplete', empty: 4 });
    expect(out[3]).toEqual({ type: 'wrong' });
    expect(out[4]).toEqual({ type: 'solved' });
    const without = puzzle('ending');
    delete without.minPlaced;
    expect(replies(without, [none, half]).map((r) => r.type), 'without minPlaced only the empty board is incomplete (minPlaced defaults to 1)').toEqual(['incomplete', 'wrong']);
    const bad = puzzle('ending');
    bad.minPlaced = 6;
    expect(errorsOf(bad)).toMatch(/minPlaced must be an integer from 1 to the number of required pieces/);
    expect(run("console.log(JSON.stringify(P.replyLeaks(arg)));", p)).toEqual([]);
  });

  test('R-h: ending cards carry no years, hint 3 and the reveal say only what the board proves, and nothing claims the tree stood in the trench', () => {
    const p = puzzle('ending');
    for (const c of p.cards) expect(c.text, c.id).not.toMatch(/\b1[0-9]{3}\b/);
    expect(p.hints[2].text).not.toMatch(/cây thông|ở giữa/);
    expect(p.reveal.lines[1]).toBe('Ghi chép cây thông đứng sau cuốn lịch La Mã.');
    expect(JSON.stringify({ aha: p.aha, reveal: p.reveal, hints: p.hints })).not.toMatch(/chiến hào/);
  });

  test('R-i: the conclusion keeps six correct pieces, the decoy is unsourced and does not mention the Nativity', () => {
    const bank = puzzle('ending').conclusion.bank as any[];
    expect(bank.filter((b) => b.label === 'SỰ THẬT').map((b) => b.text)).toEqual(['cuốn lịch La Mã năm 354 có ghi Giáng Sinh ngày 25/12', 'năm 1843, một tấm thiệp Giáng Sinh thương mại được in 1.000 tấm']);
    expect(bank.filter((b) => b.label === 'TRANH CÃI').length).toBe(2);
    expect(bank.filter((b) => b.label === 'TRUYỀN THUYẾT').length).toBe(2);
    const decoy = bank.find((b) => b.status === 'decoy');
    expect(decoy.label).toBe('CHƯA CÓ NGUỒN');
    expect(decoy.text).toBe('Truyện Baldur sinh ra tục hôn dưới tầm gửi');
    expect(bank.some((b) => /Chúa sinh/.test(b.text))).toBe(false);
    expect(run("console.log(JSON.stringify(P.conclusionStats(arg)));", puzzle('ending'))).toMatchObject({ K: 8, N: 5040 });
  });

  test('R-j: the conclusion has three hint tiers in the puzzle file, only the last solves, and the checker scans them like the board hints', () => {
    const p = puzzle('ending');
    expect(p.conclusion.hints.map((h: any) => !!h.solves)).toEqual([false, false, true]);
    const none = puzzle('ending');
    delete none.conclusion.hints;
    expect(errorsOf(none)).toMatch(/conclusion\.hints must be 3 tiers/);
    const early = puzzle('ending');
    early.conclusion.hints[1].solves = true;
    expect(errorsOf(early)).toMatch(/only tier 3 solves/);
    const bad = puzzle('ending');
    bad.conclusion.hints[0].text = 'Tèo thua rồi, thử lại.';
    expect(errorsOf(bad)).toMatch(/conclusion\.hints\[0\]\.text/);
    const long = puzzle('ending');
    long.conclusion.hints[1].text = Array.from({ length: 30 }, () => 'chữ').join(' ');
    expect(errorsOf(long)).toMatch(/conclusion\.hints\[1\]\.text has 30 words/);
  });

  test('R-k: the conclusion rule the UI uses is the checker\'s: conclusionCorrect is exported to the player and a fill counts only with distinct pieces of the blank\'s label', () => {
    expect(readFileSync(join(root, 'scripts/puzzle-core-plugin.ts'), 'utf8')).toMatch(/PLAYER_EXPORTS = \[[^\]]*'conclusionCorrect'/);
    const p = puzzle('ending');
    const idx = (label: string) => p.conclusion.bank.map((b: any, i: number) => (b.label === label ? i : -1)).filter((i: number) => i >= 0);
    const [f1, f2] = idx('SỰ THẬT');
    const [d1, d2] = idx('TRANH CÃI');
    const [l1, l2] = idx('TRUYỀN THUYẾT');
    const ask = (fills: unknown) => run("console.log(JSON.stringify(P.conclusionCorrect(arg.c, arg.fills)));", { c: p.conclusion, fills });
    expect(ask([f1, f2, d1, d2, l1, l2])).toBe(true);
    expect(ask([f2, f1, d2, d1, l2, l1])).toBe(true);
    expect(ask([f1, f1, d1, d2, l1, l2])).toBe(false);
    expect(ask([f1, f2, d1, d2, l1, null])).toBe(false);
    expect(ask([f1, f2, d1, d2, l1, d1])).toBe(false);
    expect(ask([f1, f2, d1, d2, l1])).toBe(false);
    const src = readFileSync(join(root, 'src/puzzle/conclusion.ts'), 'utf8');
    expect(src).toContain("from 'virtual:puzzle-core'");
    expect(src).not.toMatch(/bank\[j\]\?\.label === b\.label/);
  });

  test('R-l: the minigames rows follow the puzzle files', () => {
    const r = rows();
    expect(r.find((x) => x.id === 'ending').aha).toBe(puzzle('ending').aha);
    expect(r.find((x) => x.id === 'dec25').aha).toBe(puzzle('dec25').aha);
    expect(r.find((x) => x.id === 'saturnalia').cards.length).toBe(puzzle('saturnalia').cards.length);
    expect(r.find((x) => x.id === 'dec25').cards.length).toBe(puzzle('dec25').cards.length);
    expect(JSON.stringify(r.find((x) => x.id === 'dec25'))).not.toMatch(/hoặc cùng lúc/);
  });
});


test.describe('puzzle gate round 3: every card read by a human, surface cues, empty boards, wording', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  const surfaceOf = (p: any) => run("console.log(JSON.stringify(P.surface(arg)));", p) as { number: boolean; keyword: boolean; roman: boolean };
  const ROMAN_DIGIT: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
  const romanNo = (s: string) => [...s].reduce((n, ch, i, a) => n + (ROMAN_DIGIT[a[i + 1]!]! > ROMAN_DIGIT[ch]! ? -ROMAN_DIGIT[ch]! : ROMAN_DIGIT[ch]!), 0);
  const LENGTH: Record<string, number> = { ba: 3, năm: 5, bảy: 7 };

  // What a reader takes from each card's words, written from the text alone and never from a card's 'do': the start day and the Roman
  // mapping from card 1, the feast length from card 2 (it names no way of counting, so the end is the sixth or the seventh day after the start),
  // the Roman end named on card 3 (a count of three days that shows the way of counting), the "chính giữa" relation of card 4. The second rule of the game (rules[1]) puts exactly three pieces on the strip.
  const reader = () => {
    const p = puzzle('saturnalia');
    const data = run("const sts = P.states(arg); const by = {}; for (const c of arg.cards) by[c.id] = P.solutions(arg, new Set([c.id]), sts).map((v) => v.join(',')); console.log(JSON.stringify({ sts: sts.map((v) => v.join(',')), by }));", p) as { sts: string[]; by: Record<string, string[]> };
    const text = (id: string) => p.cards.find((c: any) => c.id === id).text as string;
    const start = Number(text('c1').match(/ngày (\d+)\/12/)![1]);
    const startNo = romanNo(text('c1').match(/a\.d\. ([IVXLC]+)/)![1]!);
    const no = p.tokens.map((t: any) => romanNo(t.text.match(/a\.d\. ([IVXLC]+)/)![1]));
    const board = (key: string) => key.split(',').map(Number);
    const placed = (v: number[]) => v.flatMap((s, i) => (s > 0 ? [{ i, day: p.slots[s - 1].value as number }] : []));
    const three = (v: number[]) => placed(v).length === 3;
    const len = LENGTH[text('c2').match(/(ba|năm|bảy) ngày/)![1]!]!;
    const ends = /tính cả ngày đầu/.test(text('c2')) ? [start + len - 1] : [start + len - 1, start + len];
    const named = romanNo(text('c3').match(/từ a\.d\. [IVXLC]+ đến a\.d\. ([IVXLC]+)/)![1]!);
    const reads: Record<string, (v: number[]) => boolean> = {
      c1: (v) => placed(v).every((x) => x.day === start + startNo - no[x.i]),
      c2: (v) => placed(v).some((x) => ends.includes(x.day)),
      c3: (v) => placed(v).some((x) => no[x.i] === named),
      c4: (v) => { const d = placed(v).map((x) => x.day).sort((a, b) => a - b); return /chính giữa/.test(text('c4')) && d[1]! - d[0]! === d[2]! - d[1]!; },
    };
    const read = (id: string) => data.sts.filter((k) => three(board(k)) && reads[id]!(board(k)));
    return { p, data, read, three, reads, board, text };
  };

  test('N1: saturnalia: each card does what its words say, and a reader who has only the words needs every card', () => {
    const { p, data, read, three, reads, board, text } = reader();
    for (const c of p.cards) {
      const want = new Set(read(c.id));
      const got = new Set(data.by[c.id]);
      expect({ card: c.id, same: want.size === got.size && [...want].every((k) => got.has(k)), reader: want.size, card_do: got.size }, 'card ' + c.id + ' constrains what its text says').toMatchObject({ same: true });
    }
    expect(text('c4'), 'card 4 states no feast length: the lengths belong to cards 2 and 3').not.toMatch(/(ba|năm|bảy) ngày/);
    expect(data.sts.filter((k) => three(board(k)) && Object.values(reads).every((r) => r(board(k))))).toHaveLength(1);
    for (const c of p.cards) {
      const rest = data.sts.filter((k) => three(board(k)) && Object.entries(reads).every(([id, r]) => id === c.id || r(board(k))));
      expect(rest.length, 'a reader needs card ' + c.id).toBeGreaterThan(1);
    }
  });

  test('N2a: the Roman reader takes the rule "a.d. goes down by one" as the second anchor, and reports a board only when the board it reads is a full solution', () => {
    const real = puzzle('saturnalia');
    expect(run("console.log(JSON.stringify(P.romanBoard(arg, arg.cards)));", real), 'one date anchor and the rule read all six pieces').toEqual([2, 1, 5, 6, 4, 3]);
    expect(surfaceOf(real)).toMatchObject({ roman: false });
    const roman = (n: string) => 'Ngày a.d. ' + n + ' Kal. Ian.';
    const fx = (): any => ({
      id: 'rm2', input: 'mark',
      slots: [17, 18, 19, 20, 21].map((d, i) => ({ id: 's' + (i + 1), label: d + '/12', cap: 1, value: d })),
      tokens: ['XVI', 'XV', 'XIV', 'XII', 'VIII'].map((n) => ({ id: n.toLowerCase(), text: roman(n), status: 'fact' })),
      cards: [{ id: 'c1', text: 'Lễ bắt đầu ngày 17/12, tức a.d. XVI Kal. Ian. Mỗi ngày muộn hơn, số a.d. nhỏ đi một.' }],
      solutions: [['xvi', 'xv', 'xiv', null, 'xii']],
    });
    expect(surfaceOf(fx()), 'every piece on its own date is readable from the one anchor and the rule').toMatchObject({ roman: true });
    const decided = fx();
    decided.solutions = [['xvi', 'xv', null, 'xii', null]];
    expect(surfaceOf(decided)).toMatchObject({ roman: false });
    const subset = fx();
    subset.solutions = [['xvi', 'xv', null, null, 'xii']];
    expect(surfaceOf(subset), 'the reader does not know which piece to leave out: a part of the read board is not the read board').toMatchObject({ roman: false });
    const noRule = fx();
    noRule.cards[0].text = 'Lễ bắt đầu ngày 17/12, tức a.d. XVI Kal. Ian.';
    expect(run("console.log(JSON.stringify(P.romanBoard(arg, arg.cards)));", noRule)).toBeNull();
    const up = fx();
    up.cards[0].text = 'Lễ bắt đầu ngày 17/12, tức a.d. XVI Kal. Ian. Mỗi ngày muộn hơn, số a.d. lớn thêm một.';
    expect(run("console.log(JSON.stringify(P.romanBoard(arg, arg.cards)));", up)).toEqual([1, 0, 0, 0, 0]);
  });

  test('N2b: a piece that declares its own status is caught in more than the old fixed phrases, and the header says the list is a first layer', () => {
    for (const text of ['Theo một giả thuyết, 25/12 được chọn vì trùng lễ mặt trời', 'Lời đồn rằng 25/12 được chọn vì trùng lễ mặt trời', 'Điều chưa phải bản ghi: 25/12 được chọn vì trùng lễ mặt trời']) {
      const dec = puzzle('dec25');
      dec.tokens.find((t: any) => t.id === 'hyp').text = text;
      expect(errorsOf(dec), text).toMatch(/piece hyp text already says what it is/);
      dec.cards.find((c: any) => c.id === 'c5').do = { op: 'unused', t: 'hyp' };
      expect(errorsOf(dec), text).toMatch(/card c5 only classifies piece hyp, whose text already says what it is/);
    }
    expect(errorsOf(puzzle('dec25'))).toBe('');
    expect(readFileSync(join(root, 'scripts/puzzles.mjs'), 'utf8')).toMatch(/first layer, not a proof/);
  });

  test('N3: yule states no per-column year distance that the real years contradict', () => {
    const p = puzzle('yule');
    expect(p.rules.map((r: any) => r.text).join(' ')).not.toMatch(/thế kỷ/);
    expect(p.cards.find((c: any) => c.id === 'c4').text).toMatch(/ít nhất hai cột/);
  });

  test('nghi vấn 1: yule has no card a reader can drop: the lanes come from the cards, no rule carries a constraint, and without the lane statements the solver finds more than one solution', () => {
    const p = puzzle('yule');
    expect(p.cards.some((c: any) => c.kind === 'rule')).toBe(false);
    expect(p.cards).toHaveLength(5);
    expect(p.rules.some((r: any) => r.do)).toBe(false);
    expect(check(p).errors).toEqual([]);
    const off = puzzle('yule');
    for (const c of off.cards) c.do = [].concat(c.do).filter((d: any) => d.op !== 'oneOf');
    expect(run("console.log(JSON.stringify(P.solutions(arg).length));", off)).toBeGreaterThan(1);
  });

  test('N4: the words say the incomplete count depends on the slot minimums and on how many pieces are placed, never on which', () => {
    expect(/depends on slot minimums only/.test(readFileSync(join(root, '.agents/skills/web-game/PUZZLE_DESIGN.md'), 'utf8'))).toBe(false);
    expect(/the count depends on the slots only/.test(readFileSync(join(root, 'scripts/puzzles.mjs'), 'utf8'))).toBe(false);
  });

  test('N5: dec25 does not call the Constantinople piece a record of its own: History Today says only that the day was being celebrated', () => {
    const p = puzzle('dec25');
    const t = p.tokens.find((x: any) => x.id === 'c380').text as string;
    expect(t).toMatch(/cử hành/);
    expect(JSON.stringify(p)).not.toMatch(/bản ghi (ở|về) (lễ [^"]* ở )?Constantinople/i);
    expect(t).not.toMatch(/bản ghi/i);
    expect(p.tokens.find((x: any) => x.id === 'hyp').text).not.toMatch(/bản ghi/i);
    expect(p.tokens.find((x: any) => x.id === 'hyp').text).toMatch(/Rôma/);
    for (const c of p.cards.filter((x: any) => /Constantinople/.test(x.text))) expect(c.text, c.id).not.toMatch(/bản ghi/i);
  });

  test('N6: nothing a puzzle prints addresses the reader as "bạn": the facilitator sheet, and the checker scans every text', () => {
    const bạn = /(^|[^\p{L}])[Bb]ạn([^\p{L}]|$)/u;
    const mine = scratchDir();
    try {
      writeFileSync(join(mine, 'wk3.json'), JSON.stringify(weakFx()));
      const r = spawnSync('node', ['scripts/puzzles.mjs', 'facilitator', 'wk3'], { cwd: root, encoding: 'utf8', env: { ...process.env, PUZZLES_DIR: mine } });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toMatch(/Đã tìm được n\/3 cách/);
      expect(r.stdout).not.toMatch(bạn);
    } finally {
      rmSync(mine, { recursive: true, force: true });
    }
    for (const id of files) expect(spawnSync('node', ['scripts/puzzles.mjs', 'facilitator', id], { cwd: root, encoding: 'utf8' }).stdout, id).not.toMatch(bạn);
    const talk = orderFx();
    talk.hints[2].text = 'Bạn có đang đợi một thẻ nói riêng về từng mốc không?';
    expect(errorsOf(talk)).toMatch(/hints\[2\]\.text addresses the reader as "bạn"/);
    const rule = orderFx();
    rule.rules[0].text = 'Chạm một mảnh rồi chạm một ô, bạn nhé.';
    expect(errorsOf(rule)).toMatch(/rules\[0\]\.text addresses the reader as "bạn"/);
    expect(errorsOf(orderFx())).toBe('');
    for (const id of files) expect(check(puzzle(id)).errors, id).toEqual([]);
  });

  test('N7: hint tier 3 names the assumption to question and never points at a card; a "thẻ N" in a hint names a card that exists, and tier 2 names its own', () => {
    for (const id of files) {
      const p = puzzle(id);
      expect(p.hints[2].text, id).not.toMatch(/(tìm|đọc|xem|mở)\s+(lại\s+)?thẻ|thẻ\s*(số\s*)?\d/i);
      for (const h of p.hints) for (const m of h.text.matchAll(/thẻ (\d+)/gi)) expect(Number(m[1]), id + ' tier ' + h.tier).toBeLessThanOrEqual(p.cards.length);
      expect(p.hints[1].text, id).toContain('thẻ ' + (p.cards.findIndex((c: any) => c.id === p.hints[1].card) + 1));
    }
    const dec = puzzle('dec25');
    dec.hints[2].text = 'Tìm thẻ nói về hai mục cùng ngày. Có chắc mục N INVICTI được ghi trước mục Chúa sinh?';
    expect(errorsOf(dec)).toMatch(/hint tier 3 points at a card/);
    const stale = puzzle('yule');
    stale.hints[3].text = 'Thẻ 9 đặt tên Giuli vào cột 1.';
    expect(errorsOf(stale)).toMatch(/hint tier 4 names thẻ 9 but the puzzle has 5 cards/);
    const wrong = puzzle('saturnalia');
    wrong.hints[1].text = 'Đọc thẻ 3 trước: thẻ ấy đổi số La Mã sang ngày tháng 12.';
    expect(errorsOf(wrong)).toMatch(/hint tier 2 points at card c1 but its text names thẻ 3/);
  });

  test('N8: the Reply type has no "trap" any more: the UI answers a wrong-frame board like any wrong board', () => {
    expect(readFileSync(join(root, 'src/puzzle/types.ts'), 'utf8')).not.toMatch(/'trap'/);
  });

  test('nghi vấn 3: an empty board is "incomplete" in every puzzle, never a check, and the reply still leaks nothing', () => {
    const stubDir = join(root, 'story/puzzles/stubs');
    const stubs = (existsSync(stubDir) ? readdirSync(stubDir) : []).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(stubDir, f), 'utf8')));
    const required = orderFx();
    for (const t of required.tokens) if (t.id !== 'kf') t.required = true;
    const all = [...files.map(puzzle), ...stubs, orderFx(), required, classFx(), weekdayFx(), weakFx()];
    const out = run("console.log(JSON.stringify(arg.map((q) => [q.id, P.reply({ ...q, tokens: q.tokens.map((t) => ({ text: t.id, status: 'fact', ...t })) }, q.slots.map(() => null))])));", all) as [string, { type: string; empty: number }][];
    expect(out).toHaveLength(all.length);
    for (const [id, r] of out) { expect(r.type, id).toBe('incomplete'); expect(r.empty, id).toBeGreaterThanOrEqual(1); }
    const empty = Object.fromEntries(out.map(([id, r]) => [id, r.empty]));
    expect([empty.saturnalia, empty.yule, empty.ending]).toEqual([1, 1, 5]);
    for (const id of files) expect(run("console.log(JSON.stringify(P.replyLeaks(arg)));", puzzle(id)), id).toEqual([]);
    expect(replies(puzzle('saturnalia'), [',,,,,,', 'm,,t,,r,,'])).toEqual([{ type: 'incomplete', empty: 1 }, { type: 'solved' }]);
  });
});


test.describe('class comes from cards: the solver ignores piece status, rules and texts never decide it', () => {
  const legend = (p: any, id = 'kf', text = 'Mốc nến') => { Object.assign(p.tokens.find((t: any) => t.id === id), { status: 'legend', text, source: SRC.a.source, url: SRC.a.url, evidence: SRC.a.evidence }); return p; };
  const without = (p: any, id: string) => { p.cards = p.cards.filter((c: any) => c.id !== id); return p; };
  const kept = () => {
    const p = orderFx();
    for (const t of p.tokens) if (t.id !== 'kf') t.required = true;
    p.space = 120;
    return without(legend(p), 'c1');
  };

  test('a legend piece is kept out by a card: with the card the board passes, without it the solver counts the boards that use the piece', () => {
    expect(errorsOf(legend(orderFx()))).not.toMatch(/piece kf|solver finds/);
    expect(errorsOf(without(legend(orderFx()), 'c1'))).toMatch(/solver finds 2 solution\(s\)/);
  });

  test('a legend piece kept out only by capacity, with no card that lets a board use it elsewhere, is caught', () => {
    expect(errorsOf(kept())).toMatch(/piece kf \(legend\): no card names it/);
    const decoy = kept();
    decoy.tokens.find((t: any) => t.id === 'kf').status = 'decoy';
    expect(errorsOf(decoy)).toMatch(/piece kf \(decoy\): no card names it/);
    const named = legend(orderFx());
    for (const t of named.tokens) if (t.id !== 'kf') t.required = true;
    named.space = 120;
    expect(errorsOf(named)).toMatch(/piece kf \(legend\): removing every card that names it never lets a board use it elsewhere/);
  });

  test('a rule constraint decides for single pieces unless it is symmetric under swapping any two pieces; naming every piece is no exemption', () => {
    const ids = ['ka', 'kb', 'kc', 'kd', 'ke', 'kf'];
    const rule = (d: any) => { const p = without(orderFx(), 'c4'); p.rules[0].do = d; return errorsOf(p); };
    const decides = /a rule decides for single pieces: .* the cards, not a rule, must say where each piece goes/;
    expect(rule([{ op: 'at', t: 'kb', s: 's5' }])).toMatch(decides);
    const disguised = { op: 'expr', e: ['and', ['eq', ['pos', 'kb'], 5], ...ids.map((t) => ['or', ['placed', t], ['not', ['placed', t]]])] };
    expect(rule([disguised])).toMatch(decides);
    expect(rule([{ op: 'count', t: ids, s: 's5', max: 1 }])).not.toMatch(decides);
    expect(rule([{ op: 'expr', e: ['le', ['add', ...ids.map((t) => ['if', ['placed', t], 1, 0])], 5] }])).not.toMatch(decides);
    expect(rule([{ op: 'spaced', t: ids }])).not.toMatch(decides);
  });

  test('a legend piece named by no card is caught even when removing another card frees a slot for it (ending with cap 1, c5 dropped, d optional)', () => {
    const e = puzzle('ending');
    for (const s of e.slots) delete s.cap;
    e.cards = e.cards.filter((c: any) => c.id !== 'c5');
    e.tokens.find((t: any) => t.id === 'd').required = false;
    e.minPlaced = 4;
    e.space = run('console.log(JSON.stringify(P.states(arg).length));', e);
    expect(errorsOf(e)).toMatch(/piece x \(legend\): no card names it/);
  });

  const endingNoC5 = (cap: 1 | 'any') => {
    const e = puzzle('ending');
    if (cap === 1) for (const s of e.slots) delete s.cap;
    e.cards = e.cards.filter((c: any) => c.id !== 'c5');
    e.tokens.find((t: any) => t.id === 'd').required = false;
    e.minPlaced = 4;
    const c1 = e.cards.find((c: any) => c.id === 'c1');
    c1.do = [c1.do, { op: 'notAt', t: 'x', s: 's1' }];
    return e;
  };
  const respace = (e: any) => { e.space = run('console.log(JSON.stringify(P.states(arg).length));', e); return e; };

  test('a card that works for other pieces and carries one stray constraint on the class piece does not carry its class: only the constraints that name the piece are removed, not the card (capacity variant)', () => {
    expect(errorsOf(respace(endingNoC5(1)))).toMatch(/piece x \(legend\): removing every card that names it never lets a board use it elsewhere/);
  });

  test('a constraint that mentions the class piece without depending on it (a tautology inside a real constraint) names nothing: it is neither a card for the class nor removed with its real part', () => {
    const e = endingNoC5(1);
    const c1 = e.cards.find((c: any) => c.id === 'c1');
    c1.do = { op: 'expr', e: ['and', ['or', ['and', ['lt', ['slot', 'd'], ['slot', 't']], ['lt', ['slot', 't'], ['slot', 'l']]], ['and', ['lt', ['slot', 'l'], ['slot', 't']], ['lt', ['slot', 't'], ['slot', 'd']]]], ['or', ['placed', 'x'], ['not', ['placed', 'x']]]] };
    expect(errorsOf(respace(e))).toMatch(/piece x \(legend\): no card names it/);
  });

  test('the same stray constraint with a symmetric counting rule (at most five pieces on the axis) keeps the class on the rule, not a card, and is caught', () => {
    const e = endingNoC5('any');
    e.rules.push({ text: 'Không quá năm bánh trên trục.', do: [{ op: 'expr', e: ['le', ['add', ...e.tokens.map((t: any) => ['if', ['placed', t.id], 1, 0])], 5] }] });
    expect(errorsOf(respace(e))).toMatch(/piece x \(legend\): removing every card that names it never lets a board use it elsewhere/);
  });

  test('a piece left out of the declared solution is checked whatever its status label: relabelled "fact" with no source, it is still caught', () => {
    const e = respace(endingNoC5(1));
    e.cards.find((c: any) => c.id === 'c1').do = e.cards.find((c: any) => c.id === 'c1').do[0];
    const x = e.tokens.find((t: any) => t.id === 'x');
    x.status = 'fact';
    delete x.source; delete x.url; delete x.evidence;
    expect(errorsOf(e)).toMatch(/piece x \(fact\): no card names it/);
    expect(errorsOf(puzzle('ending'))).toBe('');
  });

  test('the predict step never names a piece class or a legend piece: yule\'s prompt may not repeat the Yule piece, and an option may not carry a class word', () => {
    const y = puzzle('yule');
    expect(errorsOf(y)).toBe('');
    y.predict.prompt = 'Yule ngoại giáo ở Na Uy: người chép sống cách thời ấy bao lâu?';
    expect(errorsOf(y)).toMatch(/predict\.prompt names piece T/);
    const o = puzzle('yule');
    o.predict.options[1] = 'Yule ngoại giáo, một thế kỷ sau';
    expect(errorsOf(o)).toMatch(/predict\.options\[1\] names piece T/);
    const c = puzzle('yule');
    c.predict.options[2] = 'Người ta kể rằng ba thế kỷ sau';
    expect(errorsOf(c)).toMatch(/predict\.options\[2\] names a piece class \("Người ta kể"\)/);
    const q = puzzle('yule');
    q.predict.prompt = 'Mảnh nào chưa phải bản ghi?';
    expect(errorsOf(q)).toMatch(/predict\.prompt names a piece class/);
  });

  test('a second optional piece: a card that names it frees a slot, but the legend piece no card names stays caught; a sourced card that names the legend piece passes, a rule card that names it does not', () => {
    const fx = (naming: 'kd' | 'kf') => {
      const p = orderFx();
      for (const t of p.tokens) t.required = ['ka', 'kc', 'ke'].includes(t.id);
      legend(p);
      p.cards = p.cards.filter((c: any) => c.id !== 'c1');
      p.cards.push(naming === 'kd'
        ? { id: 'c5', who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.a, text: 'Mốc đèn đứng thứ tư.', do: { op: 'at', t: 'kd', s: 's4' } }
        : { id: 'c1', who: 'Máy', kind: 'rule', status: 'rule', source: 'game', text: 'Mốc nến là thừa.', do: { op: 'unused', t: 'kf' } });
      p.hints[1].text = 'Đọc thẻ 1.';
      p.solutions = [['kc', 'ke', 'ka', 'kd', 'kb']];
      p.space = run('console.log(JSON.stringify(P.states(arg).length));', p);
      return p;
    };
    expect(errorsOf(fx('kd'))).toMatch(/piece kf \(legend\): no card names it/);
    expect(errorsOf(fx('kf'))).toMatch(/piece kf \(legend\): no card names it \(a rule card does not count\)/);
    const sourced = fx('kf');
    Object.assign(sourced.cards.find((c: any) => c.id === 'c1'), { who: 'Sử gia', kind: 'record', status: 'fact', ...SRC.a, text: 'Mốc nến là thừa.' });
    expect(errorsOf(sourced)).toMatch(/piece kf is the one piece every solution leaves out, and no card sets it against a piece that is placed/);
    sourced.cards.find((c: any) => c.id === 'c1').do = { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['lt', ['slot', 'kf'], ['slot', 'ka']]] };
    expect(errorsOf(sourced)).toBe('');
  });

  test('a piece never says its own class, with or without a card that classifies it', () => {
    const said = orderFx();
    said.tokens.find((t: any) => t.id === 'ka').text = 'Người ta kể rằng mốc lịch có thật';
    expect(errorsOf(said)).toMatch(/piece ka text already says what it is \("Người ta kể"\)/);
    const hyp = orderFx();
    hyp.tokens.find((t: any) => t.id === 'kd').text = 'Giả thuyết: mốc đèn';
    expect(errorsOf(hyp)).toMatch(/piece kd text already says what it is \("Giả thuyết"\)/);
    expect(errorsOf(orderFx())).not.toMatch(/already says what it is/);
  });

  test('the question, a rule and hints 1 to 3 never name a piece class or single out a legend or decoy piece', () => {
    const q = orderFx();
    q.question = 'Có mảnh chưa phải bản ghi, không ô nào đợi nó.';
    expect(errorsOf(q)).toMatch(/question names a piece class \("chưa phải bản ghi"\)/);
    const r = orderFx();
    r.rules[0].text = 'Mảnh Người ta kể không có ô.';
    expect(errorsOf(r)).toMatch(/rules\[0\]\.text names a piece class \("Người ta kể"\)/);
    const h = orderFx();
    h.hints[0].text = 'Câu hỏi: mảnh nào chưa phải bản ghi?';
    expect(errorsOf(h)).toMatch(/hints\[0\]\.text names a piece class/);
    const named = orderFx();
    legend(named, 'kf', 'Mốc nến thắp đầu tiên');
    named.rules[0].text = 'Nến thắp lên thì để đó.';
    expect(errorsOf(named)).toMatch(/rules\[0\]\.text names piece kf \("nến thắp"\)/);
    const lane = orderFx();
    lane.rules[0].text = 'Làn thời được tả nhận bản ghi.';
    expect(errorsOf(lane)).not.toMatch(/names a piece class/);
    expect(errorsOf(orderFx())).not.toMatch(/names a piece class|names piece/);
  });

  test('hints 1 to 3 never name a legend, decoy or disputed piece (tier 4 may); nor do the question and the rules for a disputed piece', () => {
    for (const status of ['legend', 'decoy', 'disputed']) {
      for (const i of [0, 1, 2]) {
        const p = orderFx();
        Object.assign(p.tokens.find((t: any) => t.id === 'kf'), { status, text: 'Mốc nến thắp đầu tiên', ...(status === 'legend' ? { source: SRC.a.source, url: SRC.a.url, evidence: SRC.a.evidence } : {}) });
        p.hints[i].text = i === 1 ? 'Đọc thẻ 2: mốc nến thắp đầu tiên có thật không?' : 'Câu hỏi: mốc nến thắp đầu tiên có thật không?';
        expect(errorsOf(p), status + ' hint ' + i).toMatch(new RegExp('hints\\[' + i + '\\]\\.text names piece kf \\("nến thắp'));
      }
    }
    const tier4 = orderFx();
    legend(tier4, 'kf', 'Mốc nến thắp đầu tiên');
    tier4.hints[3].text = 'Mốc nến thắp đầu tiên đã có chỗ.';
    expect(errorsOf(tier4)).not.toMatch(/names piece kf/);
    const disputed = orderFx();
    Object.assign(disputed.tokens.find((t: any) => t.id === 'kd'), { status: 'disputed', text: 'Mốc đèn treo cao' });
    disputed.rules[0].text = 'Đèn treo cao thì để đó.';
    expect(errorsOf(disputed)).toMatch(/rules\[0\]\.text names piece kd/);
    disputed.rules[0].text = 'Chạm một mảnh rồi chạm một ô.';
    disputed.question = 'Mốc đèn treo cao đứng đâu?';
    expect(errorsOf(disputed)).toMatch(/question names piece kd/);
  });

  test('a slot label carries no class word: the lane that holds a legend piece is named by a card, not by its label', () => {
    for (const label of ['Truyền thuyết', 'Ngăn người ta kể', 'Giả thuyết', 'Chưa có nguồn']) {
      const p = orderFx();
      p.slots[1].label = label;
      expect(errorsOf(p), label).toMatch(/slots\[1\]\.label names a piece class/);
    }
    const p = orderFx();
    p.slots[1].label = 'Sách báo sau này';
    expect(errorsOf(p)).not.toMatch(/label names/);
  });

  test('a conclusion piece carries no label word in its text: the label is the answer', () => {
    const withBank = (i: number, text: string) => { const p = orderFx(); p.conclusion = conclusionFx(); p.conclusion.bank[i].text = text; return errorsOf(p); };
    expect(withBank(1, 'danh sách có mục Giáng Sinh từ năm 336, còn tranh cãi')).toMatch(/conclusion\.bank\[1\] text carries its label \("tranh cãi"\)/);
    expect(withBank(2, 'Người ta kể rằng Luther thắp nến đầu tiên trên cây thông')).toMatch(/conclusion\.bank\[2\] text carries its label \("Người ta kể rằng"\)/);
    expect(withBank(0, 'điều chắc chắn: bản ghi sớm nhất nằm trong một cuốn lịch')).toMatch(/conclusion\.bank\[0\] text carries its label \("chắc chắn"\)/);
    expect(withBank(1, 'danh sách có mục Giáng Sinh từ năm 336')).not.toMatch(/carries its label/);
  });

  test('the paper prototype never tags a piece with its class, and a legend piece does not have to open with "người ta kể" (a legend card still does)', () => {
    const p = legend(orderFx());
    expect(run("console.log(JSON.stringify(P.view(arg)));", p)).not.toMatch(/Người ta kể rằng/);
    expect(errorsOf(p)).not.toMatch(/token kf: a legend must open/);
    const card = orderFx();
    Object.assign(card.cards[1], { status: 'legend', kind: 'retelling', text: 'Mốc máy nằm giữa.', do: undefined });
    expect(errorsOf(card)).toMatch(/card c2: a legend must open with "người ta kể"/);
  });

  test('yule and the ending keep the class on a card: a card sets the left-out piece against another piece, no rule carries a constraint, no piece or conclusion piece says what it is', () => {
    const relatedBy = (p: any, id: string) => p.cards.filter((c: any) => [].concat(c.do).some((d: any) => { const named = d.op === 'expr' ? JSON.stringify(d.e).match(/"[A-Za-z]+"/g)!.map((s) => s.slice(1, -1)) : [].concat(d.t); return named.includes(id) && new Set(named.filter((t: string) => p.tokens.some((x: any) => x.id === t))).size >= 2; })).length;
    const yule = puzzle('yule');
    expect(relatedBy(yule, 'T')).toBe(1);
    expect(yule.cards.find((c: any) => c.id === 'c5').text).not.toMatch(/để ngoài|bỏ ngoài|không đặt/i);
    expect(yule.rules.some((r: any) => r.do)).toBe(false);
    expect(yule.tokens.map((t: any) => t.text).join(' ')).not.toMatch(/người ta kể|truyền thuyết/i);
    const end = puzzle('ending');
    expect(relatedBy(end, 'x')).toBe(1);
    expect(end.cards.find((c: any) => c.id === 'c5').text).not.toMatch(/để ngoài|bỏ ngoài|không đặt/i);
    expect(end.tokens.map((t: any) => t.text).join(' ')).not.toMatch(/người ta kể|truyền thuyết/i);
    expect([end.question, ...end.rules.map((r: any) => r.text)].join(' ')).not.toMatch(/người ta kể|chưa phải bản ghi/i);
    expect(end.conclusion.bank.map((b: any) => b.text).join(' ')).not.toMatch(/người ta kể|tranh cãi|chắc|truyền thuyết|không chỉ/i);
    expect(end.conclusion.template).toMatch(/Chắc: ___.*Còn tranh cãi: ___.*Người ta kể rằng ___/);
  });

  test('no piece is singled out by form or count: the ending pieces are all gears and may stay off the axis, dec25 and yule pieces share one mould, and the cards say what they carry', () => {
    const end = puzzle('ending');
    for (const t of end.tokens) expect(t.text, t.id).toMatch(/^Bánh /);
    expect(end.rules.map((r: any) => r.text).join(' ')).toMatch(/Bánh có thể không đặt/);
    expect(end.question).toMatch(/hay không vào nấc nào/);
    expect(end.question).not.toMatch(/năm nấc|năm bánh|sáu bánh/i);
    const luther = end.cards.find((c: any) => c.id === 'c5');
    expect(luther.text).toMatch(/^Cây có nến:/);
    expect(JSON.stringify(luther)).not.toMatch(/tác phẩm|Suy ra/);
    expect(luther.do).toEqual({ op: 'expr', e: ['or', ['not', ['placed', 'x']], ['and', ['gt', ['pos', 'x'], ['pos', 't']], ['lt', ['pos', 'x'], ['pos', 'k']]]] });
    expect(luther.text).not.toMatch(/lịch La Mã|cuốn lịch/);
    expect(luther.text).toMatch(/đều sau ghi chép Strasbourg, trước tấm thiệp\./);
    expect(luther.text.split(/\s+/).length).toBeLessThanOrEqual(25);
    expect(luther.evidence.join(' ')).toMatch(/1611/);
    expect(luther.evidence.join(' ')).toMatch(/1660/);
    expect(JSON.stringify(luther)).not.toMatch(/1708|yalebooks/);
    expect(luther.evidence.join(' ')).toMatch(/1843/);
    const bankLinks = end.conclusion.bank.map((b: any) => ([] as string[]).concat(b.url).length);
    expect(new Set(bankLinks).size, 'one link count for every conclusion piece: ' + bankLinks.join(',')).toBe(1);
    const dec = puzzle('dec25');
    for (const id of ['hyp', 'c380']) expect(dec.tokens.find((t: any) => t.id === id).text, id).not.toMatch(/bản ghi/i);
    expect(dec.rules.map((r: any) => r.text).join(' ')).toMatch(/Mảnh có thể không đặt/);
    const yule = puzzle('yule');
    for (const t of yule.tokens) expect(t.text.split(' ').length, t.id).toBeLessThanOrEqual(8);
    expect(yule.tokens.find((t: any) => t.id === 'T').text).toBe('Thời Yule ngoại giáo của Na Uy');
    expect(yule.rules.map((r: any) => r.text).join(' ')).not.toMatch(/ba ngày|chi tiết/i);
    expect([yule.predict.prompt, ...yule.predict.options].join(' ')).not.toMatch(/ba ngày|Yule/);
    const c5y = yule.cards.find((c: any) => c.id === 'c5');
    expect(c5y.kind).toBe('inference');
    expect(c5y.text).toMatch(/Vẫn có chút ngờ về Snorri/);
    expect(yule.tokens.filter((t: any) => /^Thời .* của Na Uy$/.test(t.text)).map((t: any) => t.id), 'T has the form of the dated point H').toEqual(['H', 'T']);
    expect(c5y.text).not.toMatch(/Học giả|không phải bản ghi/);
    expect(yule.hints[2].text).not.toMatch(/ba ngày|Yule/);
  });
});


test.describe('m3 close: conclusion labels follow the Sổ nguồn, a left-out piece needs a relating card, rules hold no single-piece constraint, class words', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  const notebookOf = (id: string) => JSON.parse(readFileSync(join(root, 'story/notebook', id + '.json'), 'utf8'));
  const rowsOf = () => JSON.parse(readFileSync(join(root, 'story/minigames.json'), 'utf8')) as any[];
  const withNotebook = (index: number, notebook: string | undefined) => {
    const p = puzzle('ending');
    if (notebook === undefined) delete p.conclusion.bank[index].notebook;
    else p.conclusion.bank[index].notebook = notebook;
    return p;
  };
  const pendingOf = (p: any) => run("console.log(JSON.stringify(P.checkData(arg, arg.id, { full: true }).pending));", p) as string[];
  const gate = (args: string[], env: Record<string, string> = {}) => spawnSync('node', ['scripts/puzzles.mjs', 'check', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

  test('V1: the ending decoy is a claim the Sổ nguồn calls unsourced (Baldur does not give the kiss), no longer the disputed Saturnalia question', () => {
    const p = puzzle('ending');
    const decoy = p.conclusion.bank.find((b: any) => b.status === 'decoy');
    expect(decoy.notebook).toBe('mistletoe.card.2');
    expect(notebookOf('mistletoe').card[2]).toBe('Chưa ai chứng minh hai việc có liên quan.');
    expect(decoy.text).toMatch(/Baldur/);
    expect(JSON.stringify(p.conclusion.bank)).not.toMatch(/Saturnalia đổi tên/);
    expect(errorsOf(p)).toBe('');
  });

  test('V1: a conclusion piece whose label differs from the status the Sổ nguồn gives its entry fails, the old decoy among them', () => {
    expect(errorsOf(withNotebook(5, 'saturnalia.dispute.0'))).toMatch(/conclusion\.bank\[5\]: label CHƯA CÓ NGUỒN but the Sổ nguồn of saturnalia files it under dispute \(TRANH CÃI\)/);
    expect(errorsOf(withNotebook(0, 'dec25.dispute.0'))).toMatch(/conclusion\.bank\[0\]: label SỰ THẬT but the Sổ nguồn of dec25 files it under dispute/);
    expect(errorsOf(withNotebook(2, 'dec25.fact.0'))).toMatch(/conclusion\.bank\[2\]: label TRANH CÃI but the Sổ nguồn of dec25 files it under fact/);
    expect(errorsOf(withNotebook(5, 'mistletoe.legend.0'))).toMatch(/label CHƯA CÓ NGUỒN but the Sổ nguồn of mistletoe files it under legend/);
    expect(errorsOf(withNotebook(5, 'mistletoe.card.0'))).toMatch(/rests on a line of the mistletoe card that does not say the claim is unproven/);
    expect(errorsOf(withNotebook(5, 'saturnalia.tradition.0'))).toMatch(/files tradition\.0 under "theo truyền thống", which no conclusion label means/);
  });

  test('V1: every conclusion piece declares its Sổ nguồn entry, and the entry must exist', () => {
    expect(errorsOf(withNotebook(0, undefined))).toMatch(/conclusion\.bank\[0\] needs notebook "<chapter>\.<fact\|dispute\|legend\|card>\.<n>"/);
    expect(errorsOf(withNotebook(0, 'dec25.fact.9'))).toMatch(/the Sổ nguồn of dec25 has no entry fact\.9/);
    for (const b of puzzle('ending').conclusion.bank) expect(b.notebook, b.text).toMatch(/^[a-z0-9-]+\.(fact|dispute|legend|card)\.\d+$/);
  });

  test('V1: a piece resting on a chapter whose Sổ nguồn is missing is pending: the normal check passes, the release gate fails', () => {
    const dir = scratchDir();
    try {
      for (const id of ['dec25', 'mistletoe']) copyFileSync(join(root, 'story/notebook', id + '.json'), join(dir, id + '.json'));
      const plain = gate(['ending'], { NOTEBOOK_DIR: dir });
      expect(plain.status, plain.stdout + plain.stderr).toBe(0);
      expect(plain.stdout).toMatch(/OK: 1 puzzle\(s\), \d+ chapter script\(s\), 4 pending/);
      const release = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
      expect(release.status).toBe(1);
      expect(release.stderr).toMatch(/RELEASE GATE: 4 conclusion piece\(s\) rest on a Sổ nguồn that is not written yet/);
      expect(release.stderr).toContain('FAIL: 4 error(s)');
      expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['release:check']).toBe('node scripts/puzzles.mjs check --release');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('V1: the release gate passes once every Sổ nguồn the conclusion rests on exists', () => {
    const dir = scratchDir();
    try {
      for (const id of ['dec25', 'mistletoe', 'dickens', 'saturnalia', 'befana']) copyFileSync(join(root, 'story/notebook', id + '.json'), join(dir, id + '.json'));
      const entry = { text: 'x', sources: [{ label: 'iwm.org.uk', url: 'https://www.iwm.org.uk/x' }] };
      writeFileSync(join(dir, 'tree.json'), JSON.stringify({ id: 'tree', status: 'verified', card: ['a', 'b', 'c'], full: { legend: [entry] } }));
      const ok = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
      expect(ok.status, ok.stdout + ok.stderr).toBe(0);
      expect(ok.stdout).toMatch(/^OK: 1 puzzle\(s\), \d+ chapter script\(s\)$/m);
      writeFileSync(join(dir, 'tree.json'), JSON.stringify({ id: 'tree', status: 'verified', card: ['a', 'b', 'c'], full: { fact: [entry] } }));
      const bad = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toMatch(/the Sổ nguồn of tree has no entry legend\.0/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('V2: the one piece every solution leaves out must be set against another piece by a card; a card that only says "unused" fails with a clear message', () => {
    const lone = orderFx();
    lone.cards.find((c: any) => c.id === 'c1').do = { op: 'unused', t: 'kf' };
    expect(errorsOf(lone)).toMatch(/piece kf is the one piece every solution leaves out, and no card sets it against a piece that is placed.*found by elimination/);
    expect(errorsOf(orderFx())).toBe('');
    const two = orderFx();
    two.tokens.find((t: any) => t.id === 'kd').required = false;
    expect(errorsOf(two)).not.toMatch(/the one piece every solution leaves out/);
  });

  test('V2: yule and the ending leave their piece out by a card that relates it, not by an order', () => {
    for (const [id, piece] of [['yule', 'T'], ['ending', 'x']] as [string, string][]) {
      const p = puzzle(id);
      expect(errorsOf(p), id).toBe('');
      const card = p.cards.find((c: any) => c.id === 'c5');
      expect(card.do, id).toMatchObject({ op: 'expr' });
      expect(JSON.stringify(card.do), id).toContain('"' + piece + '"');
      expect(card.text, id).not.toMatch(/để ngoài/);
      const unused = puzzle(id);
      unused.cards.find((c: any) => c.id === 'c5').do = { op: 'unused', t: piece };
      expect(errorsOf(unused), id).toMatch(new RegExp('piece ' + piece + ' is the one piece every solution leaves out'));
    }
  });

  test('V3: a rule that constrains specific pieces fails even when the cards still give the declared solution (the reviewer variants)', () => {
    const decides = /a rule decides for single pieces: rules\[\d+\] constrains T \(notAt\) and not every piece alike/;
    const long = puzzle('yule');
    long.rules.push({ text: 'Mảnh Yule không nằm ở cột nào trước cột 7 của làn thời được tả.', do: { op: 'notAt', t: 'T', s: long.slots.slice(0, 6).map((s: any) => s.id) } });
    expect(errorsOf(long)).toMatch(decides);
    const short = puzzle('yule');
    short.rules.push({ text: 'Mảnh Yule không đứng ở ba cột đầu.', do: { op: 'notAt', t: 'T', s: ['s1', 's2', 's3'] } });
    expect(errorsOf(short)).toMatch(decides);
    const fx = orderFx();
    fx.rules.push({ text: 'Mốc nến không đứng đầu.', do: [{ op: 'notAt', t: 'kf', s: 's1' }] });
    expect(errorsOf(fx)).toMatch(/a rule decides for single pieces: rules\[1\] constrains kf \(notAt\)/);
    const sym = orderFx();
    sym.rules.push({ text: 'Không quá một mốc ở nấc 5.', do: { op: 'count', t: ['ka', 'kb', 'kc', 'kd', 'ke', 'kf'], s: 's5', max: 1 } });
    expect(errorsOf(sym)).not.toMatch(/a rule decides for single pieces/);
    expect(errorsOf(puzzle('saturnalia'))).not.toMatch(/a rule decides for single pieces/);
  });

  test('class words: each synonym is caught on a slot label, a rule, the question and a piece text', () => {
    for (const w of ['tương truyền', 'kể lại', 'chuyện kể', 'huyền thoại', 'tin đồn', 'dân gian']) {
      const label = orderFx();
      label.slots[0].label = '1 (' + w + ')';
      expect(errorsOf(label), w + ' on a slot label').toMatch(new RegExp('slots\\[0\\]\\.label names a piece class \\("' + w + '"\\)'));
      const rule = orderFx();
      rule.rules[0].text = 'Chạm một mảnh rồi chạm một ô, ' + w + '.';
      expect(errorsOf(rule), w + ' on a rule').toMatch(new RegExp('rules\\[0\\]\\.text names a piece class \\("' + w + '"\\)'));
      const q = orderFx();
      q.question = 'Xếp các mốc theo thẻ, ' + w + '.';
      expect(errorsOf(q), w + ' in the question').toMatch(new RegExp('question names a piece class \\("' + w + '"\\)'));
      const piece = orderFx();
      piece.tokens.find((t: any) => t.id === 'kd').text = 'Mốc đèn (' + w + ')';
      expect(errorsOf(piece), w + ' on a piece').toMatch(new RegExp('piece kd text already says what it is \\("' + w + '"\\)'));
    }
  });

  test('N1, N2: the ending question and reveal no longer say a card names the oldest gear, and hint tier 3 keeps its first sentence only', () => {
    const p = puzzle('ending');
    expect(p.question).toContain('chưa thẻ nào nói bánh nào cũ nhất');
    expect(p.question).not.toMatch(/gọi tên/);
    expect(p.reveal.lines[0]).toBe('Không thẻ nào nói bánh nào cũ nhất; xếp xong, chỗ ấy thuộc về bánh lịch.');
    expect(p.hints[2].text).toBe('Bánh gặp sau trên đường đi có chắc mới hơn không?');
  });

  test('S3: no ending piece is named after a person: every gear is an object', () => {
    const p = puzzle('ending');
    expect(p.tokens.map((t: any) => t.text).join(' ')).not.toMatch(/Luther/);
    for (const t of p.tokens) expect(t.text, t.id).toMatch(/^Bánh [^\p{Lu}]+$/u);
    expect(rowsOf().find((r) => r.id === 'ending').key).not.toMatch(/Bánh nến Luther/);
  });

  test('S5: the yule matrix note carries no word of Quạ Đồn ("luôn") and follows card 5', () => {
    const row = rowsOf().find((r) => r.id === 'yule');
    expect(row.solution).not.toMatch(/luôn/);
    expect(row.solution).toMatch(/vẫn có chút ngờ/);
  });
});

test.describe('CLI: node scripts/puzzles.mjs check <id>', () => {
  const cli = (...args: string[]) => spawnSync('node', ['scripts/puzzles.mjs', 'check', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });

  test('an id that matches no puzzle file and no chapter script fails loudly and names the id', () => {
    const r = cli('carrol-typo');
    expect(r.status, 'exit code, stdout: ' + r.stdout).not.toBe(0);
    expect(r.stderr).toContain('carrol-typo');
    expect(r.stdout).not.toContain('OK:');
  });

  test('one unknown id in a list fails the whole check', () => {
    const r = cli('tree', 'carrol-typo');
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('carrol-typo');
  });

  test('a real puzzle id still passes and counts one puzzle', () => {
    const r = cli('tree');
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('OK: 1 puzzle(s), 1 chapter script(s)');
  });

  test('a chapter id whose puzzle file is missing still checks, but the OK line counts 0 puzzles', () => {
    const missing = ['caga-tio', 'dickens', 'santa-ny', 'yule-cat', 'yule-lads'].find((id) => existsSync(join(root, 'story/chapters', id + '.md')) && !existsSync(join(root, 'story/puzzles', id + '.json')));
    test.skip(!missing, 'every written chapter has a puzzle file again');
    const r = cli(missing!);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('OK: 0 puzzle(s), 1 chapter script(s)');
  });
});
