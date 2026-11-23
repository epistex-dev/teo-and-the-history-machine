import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const root = process.cwd();

const node = (code: string, arg: unknown, env: Record<string, string> = {}) =>
  spawnSync('node', ['--input-type=module', '-e', "import * as P from './scripts/puzzles.mjs'; const arg = JSON.parse(process.argv.at(-1)); " + code, JSON.stringify(arg ?? null)], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, ...env } });
const checked = (p: any, env: Record<string, string> = {}) => {
  const r = node('const r = P.checkData(arg, arg.id, { full: false, minL2: 0 }); console.log(JSON.stringify({ errors: r.errors, pending: r.pending, space: r.info.space }));', p, env);
  expect(r.status, 'the checker must report, not crash: ' + r.stderr.split('\n').slice(0, 6).join(' | ')).toBe(0);
  return JSON.parse(r.stdout) as { errors: string[]; pending: string[]; space: number };
};
const errorsOf = (p: any, env: Record<string, string> = {}) => checked(p, env).errors.join('\n');
const gate = (args: string[], env: Record<string, string> = {}) => spawnSync('node', ['scripts/puzzles.mjs', 'check', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });

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
const slotsN = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), label: String(i + 1) }));

const record = (id: string, src: any, text: string, d: any) => ({ id, who: 'Sử gia', kind: 'record', status: 'fact', ...src, text, do: d });
const placedBefore = (late: string) => ['or', ['not', ['placed', 'kf']], ['lt', ['slot', 'kf'], ['slot', late]]];

// 6 pieces, 5 slots, one solution; kf is the one piece the solution leaves out and card c1 relates it to ka (placed only before ka).
const orderFx = (relation: any = placedBefore('ka'), withUnused = false): any => ({
  ...common(), id: 'fx', title: 'Thử', space: 720, bankSeed: 1, slots: slotsN(5), tokens: tokens(['ka', 'kb', 'kc', 'kd', 'ke', 'kf']),
  cards: [
    record('c1', SRC.c, 'Nếu mốc nến có chỗ, nó đứng trước mốc lịch.', withUnused ? [{ op: 'unused', t: 'kf' }, { op: 'expr', e: relation }] : { op: 'expr', e: relation }),
    record('c2', SRC.a, 'Mốc máy nằm giữa mốc thiệp và mốc lịch.', { op: 'between', t: ['kc', 'ke', 'ka'] }),
    record('c3', SRC.b, 'Mốc lịch đứng giữa dãy.', { op: 'at', t: 'ka', s: 's3' }),
    record('c4', SRC.c, 'Mốc cây đứng cuối.', { op: 'at', t: 'kb', s: 's5' }),
  ],
  solutions: [['kc', 'ke', 'ka', 'kd', 'kb']],
  hints: Object.assign(common().hints, { 3: { tier: 4, fills: { s3: 'ka', s5: 'kb' }, text: 'Hai mốc đã có chỗ.' } }),
  wrongFrame: { text: 'Mốc đầu tiên luôn ở ô đầu.', cards: ['c3'], trap: { s1: 'ka' }, do: { op: 'at', t: 'ka', s: 's1' }, message: 'Chưa khớp: một thẻ đang mâu thuẫn.' },
});

// 6 pieces, 4 slots: the solution leaves out two pieces, kd and kf.
const twoOutFx = (kfCard: any = { op: 'unused', t: 'kf' }, kdCard: any = { op: 'unused', t: 'kd' }): any => ({
  ...orderFx(), space: 360, slots: slotsN(4),
  cards: [
    record('c1', SRC.a, 'Mốc lịch đứng thứ ba.', { op: 'at', t: 'ka', s: 's3' }),
    record('c2', SRC.c, 'Mốc cây đứng cuối.', { op: 'at', t: 'kb', s: 's4' }),
    record('c3', SRC.b, 'Mốc nến là thừa.', kfCard),
    record('c4', SRC.c, 'Mốc đèn là thừa.', kdCard),
    record('c5', SRC.a, 'Mốc thiệp đứng đầu.', { op: 'at', t: 'kc', s: 's1' }),
  ],
  solutions: [['kc', 'ke', 'ka', 'kb']],
  hints: Object.assign(common().hints, { 3: { tier: 4, fills: { s3: 'ka', s4: 'kb' }, text: 'Hai mốc đã có chỗ.' } }),
  wrongFrame: { text: 'Mốc đầu tiên luôn ở ô đầu.', cards: ['c1'], trap: { s1: 'ka' }, do: { op: 'at', t: 'ka', s: 's1' }, message: 'Chưa khớp: một thẻ đang mâu thuẫn.' },
});

const ELIM = /piece kf is the one piece every solution leaves out/;

test.describe('checker rules from e22fd3c: adversarial fixtures', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'static checks, run once');
  });

  test.describe('elimination rule: the one piece no card relates', () => {
    test('control: the fixture with a real conditional is clean', () => {
      expect(errorsOf(orderFx())).toBe('');
    });

    test('valid design: a conditional that really ties kf to ka (not both placed) is not rejected', () => {
      expect(errorsOf(orderFx(['le', ['add', ['placed', 'kf'], ['placed', 'ka']], 1]))).toBe('');
    });

    test('control: a conditional that names kf only (a decoy related only to itself) is rejected', () => {
      const own = orderFx(['or', ['not', ['placed', 'kf']], ['lt', ['slot', 'kf'], ['pos', 'kf']]]);
      expect(errorsOf(own)).toMatch(ELIM);
    });

    test('defect: a vacuous conditional (pos ka >= 0 is always true) counts as relating kf to ka', () => {
      expect(errorsOf(orderFx(['or', ['not', ['placed', 'kf']], ['ge', ['pos', 'ka'], 0]], true))).toMatch(ELIM);
    });

    test('defect: a tautology (kf placed or not placed, or anything) counts as relating kf to ka', () => {
      expect(errorsOf(orderFx(['or', ['placed', 'kf'], ['not', ['placed', 'kf']], ['lt', ['pos', 'ka'], ['pos', 'kb']]], true))).toMatch(ELIM);
    });

    test('defect: a count that always holds (at most 2 of kf, ka in one slot, or at most 1 in a cap-1 slot) counts as relating kf to ka', () => {
      const p = orderFx();
      p.cards[0].do = [{ op: 'unused', t: 'kf' }, { op: 'count', t: ['kf', 'ka'], s: 's1', max: 2 }];
      expect(errorsOf(p)).toMatch(ELIM);
      const cap1 = orderFx();
      cap1.cards[0].do = [{ op: 'unused', t: 'kf' }, { op: 'count', t: ['kf', 'ka'], s: 's1', max: 1 }];
      expect(errorsOf(cap1)).toMatch(ELIM);
    });

    test('defect: a conjunction of two single-piece facts (kf unplaced and kc first) counts as setting kf against ka', () => {
      expect(errorsOf(orderFx(['and', ['not', ['placed', 'kf']], ['eq', ['pos', 'kc'], 1]]))).toMatch(ELIM);
    });

    test('defect: with two pieces left out the rule is off, so both are found by elimination', () => {
      expect(errorsOf(twoOutFx())).toMatch(/piece (kd|kf) is .*leaves out|found by elimination/);
    });

    test('defect: two left-out pieces related only to each other are still found by elimination', () => {
      const p = twoOutFx([{ op: 'unused', t: 'kf' }, { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['not', ['placed', 'kd']]] }], [{ op: 'unused', t: 'kd' }, { op: 'expr', e: ['or', ['not', ['placed', 'kd']], ['not', ['placed', 'kf']]] }]);
      expect(errorsOf(p)).toMatch(/piece (kd|kf) is .*leaves out|found by elimination/);
    });

    test('finding 3: a card that forces the piece out in one element and adds a dead conditional in another must fail like the merged expr', () => {
      const splitUnused = orderFx();
      splitUnused.cards[0].do = [{ op: 'unused', t: 'kf' }, { op: 'expr', e: placedBefore('ka') }];
      expect(errorsOf(splitUnused)).toMatch(ELIM);
      const mergedUnused = orderFx();
      mergedUnused.cards[0].do = { op: 'expr', e: ['and', ['not', ['placed', 'kf']], placedBefore('ka')] };
      expect(errorsOf(mergedUnused)).toMatch(ELIM);
      const splitNotAt = orderFx();
      splitNotAt.cards[0].do = [
        ...['s1', 's2', 's3', 's4', 's5'].map((s) => ({ op: 'notAt', t: 'kf', s })),
        { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['eq', ['pos', 'kf'], ['pos', 'ka']]] },
      ];
      expect(errorsOf(splitNotAt)).toMatch(ELIM);
    });

    test('finding 3: valid conditional if placed, same slot as ka on a cap-1 board is not rejected', () => {
      const sameOnCap1 = orderFx();
      sameOnCap1.cards[0].do = { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['eq', ['pos', 'kf'], ['pos', 'ka']]] };
      expect(errorsOf(sameOnCap1)).toBe('');
    });

    test('finding 3: an unsourced rule card cannot carry the relation for a left-out piece', () => {
      const unsourced = orderFx();
      unsourced.cards[0] = { id: 'c1', who: 'Luật', kind: 'rule', status: 'rule', source: 'game', text: 'Nếu mốc nến có chỗ, nó đứng trước mốc lịch.', do: { op: 'expr', e: placedBefore('ka') } };
      expect(errorsOf(unsourced)).toMatch(ELIM);
    });
  });

  test.describe('elimination rule: pieces without a class', () => {
    test('a piece of status rule (a game piece, no class) may stay out with no card relating it; a fact piece may not', () => {
      const game = twoOutFx();
      for (const t of game.tokens) if (t.id === 'kd' || t.id === 'kf') t.status = 'rule';
      expect(errorsOf(game)).not.toMatch(/leaves out/);
      const fact = twoOutFx();
      expect(errorsOf(fact)).toMatch(/piece kd is one of the 2 pieces every solution leaves out/);
      expect(errorsOf(fact)).toMatch(/piece kf is one of the 2 pieces every solution leaves out/);
    });
  });

  test.describe('rules branch: a rule holds only constraints symmetric in all pieces', () => {
    const allSix = ['ka', 'kb', 'kc', 'kd', 'ke', 'kf'];
    const SINGLE = /a rule decides for single pieces: rules\[1\]/;
    const withRule = (d: any) => { const p = orderFx(); p.rules.push({ text: 'Luật phụ.', do: d }); return p; };

    test('every single-piece or piece-pair op placed in a rule is rejected', () => {
      const ops: [string, any][] = [
        ['at', { op: 'at', t: 'kc', s: 's1' }],
        ['oneOf', { op: 'oneOf', t: 'kc', s: ['s1', 's2'] }],
        ['unused', { op: 'unused', t: 'kf' }],
        ['differ', { op: 'differ', t: ['ka', 'kb'] }],
        ['next', { op: 'next', t: ['kc', 'ke'] }],
        ['expr', { op: 'expr', e: ['or', ['not', ['placed', 'kf']], ['lt', ['slot', 'kf'], ['slot', 'ka']]] }],
      ];
      for (const [name, d] of ops) expect.soft(errorsOf(withRule(d)), name).toMatch(SINGLE);
    });

    test('a rule that names every piece through a symmetric count passes', () => {
      expect(errorsOf(withRule({ op: 'count', t: allSix, s: 's5', max: 1 }))).not.toMatch(SINGLE);
      expect(errorsOf(withRule({ op: 'expr', e: ['le', ['add', ...allSix.map((t) => ['placed', t])], 5] }))).not.toMatch(SINGLE);
    });

    test.fail('defect: a rule written as one notAt per piece for all six pieces (a symmetric rule) is rejected piece by piece', () => {
      test.info().annotations.push({ type: 'accepted risk', description: "a symmetric rule written as several single-piece notAt is rejected (the rules branch judges each constraint alone)" });
      const p = withRule(allSix.map((t) => ({ op: 'notAt', t, s: 's6' })));
      p.slots.push({ id: 's6', label: '6', min: 0 });
      p.solutions[0].push(null);
      p.space = checked(p).space;
      expect(errorsOf(p), 'one notAt per piece is the same symmetric rule as one count over the six pieces').not.toMatch(SINGLE);
    });

    test('control: a rule over five of six pieces (only kf may enter s6) is rejected', () => {
      const p = withRule({ op: 'count', t: ['ka', 'kb', 'kc', 'kd', 'ke'], s: 's6', max: 0 });
      p.slots.push({ id: 's6', label: '6', cap: 'any', min: 0 });
      p.solutions[0].push([]);
      p.space = checked(p).space;
      expect(errorsOf(p)).toMatch(SINGLE);
    });
  });

  test.describe('class words (CLASS_TALK, SELF_DECLARED)', () => {
    const OLD = ['giả thuyết', 'lời đồn', 'người ta kể', 'truyền thuyết', 'chưa có nguồn'];
    const NEW = ['tương truyền', 'kể lại', 'chuyện kể', 'huyền thoại', 'tin đồn', 'dân gian'];
    const PLACES: [string, RegExp][] = [
      ['slots[0].label', /slots\[0\]\.label names a piece class/],
      ['rules[0].text', /rules\[0\]\.text names a piece class/],
      ['question', /(^|\n)fx: question names a piece class/],
      ['title', /(^|\n)fx: title names a piece class/],
      ['hints[2].text', /hints\[2\]\.text names a piece class/],
      ['piece text', /piece kd text already says what it is/],
    ];
    const talk = (w: string): any => {
      const p = orderFx();
      p.slots[0].label = '1 (' + w + ')';
      p.rules[0].text = 'Chạm một mảnh rồi chạm một ô, ' + w + '.';
      p.question = 'Xếp các mốc theo thẻ, ' + w + '.';
      p.title = 'Thử ' + w;
      p.hints[2].text = 'Có đang đợi một thẻ nói riêng về từng mốc, ' + w + ', không?';
      p.tokens.find((t: any) => t.id === 'kd').text = 'Mốc đèn (' + w + ')';
      return p;
    };
    const missed = (variants: Record<string, string>) => {
      const out: string[] = [];
      for (const [label, w] of Object.entries(variants)) {
        const errs = errorsOf(talk(w));
        const lost = PLACES.filter(([, re]) => !re.test(errs)).map(([place]) => place);
        if (lost.length) out.push(label + ': not caught at ' + (lost.length === PLACES.length ? 'any of the six places' : lost.join(', ')));
      }
      return out;
    };
    const variants = (words: string[], f: (w: string) => string) => Object.fromEntries(words.map((w) => [w, f(w)]));

    test('control: every class word, in lower case, is caught at all six places', () => {
      expect(missed(variants([...OLD, ...NEW, 'chưa phải bản ghi'], (w) => w))).toEqual([]);
    });

    test('upper case and capitalised class words are caught at all six places', () => {
      expect(missed(variants([...OLD, ...NEW], (w) => w.toUpperCase()))).toEqual([]);
      expect(missed(variants([...OLD, ...NEW], (w) => w.charAt(0).toUpperCase() + w.slice(1)))).toEqual([]);
    });

    test('defect: a class word typed with decomposed diacritics (NFD, as pasted from macOS) slips past CLASS_TALK and SELF_DECLARED', () => {
      expect(missed(variants([...OLD, ...NEW], (w) => w.normalize('NFD')))).toEqual([]);
    });

    test('defect: a class word split by a double space, a no-break space or a line break slips past CLASS_TALK and SELF_DECLARED', () => {
      const multi = [...OLD, ...NEW].filter((w) => w.includes(' '));
      const all: Record<string, string> = {};
      for (const w of multi) for (const [name, sep] of [['double space', '  '], ['nbsp', '\u00A0'], ['newline', '\n']] as [string, string][]) all[w + ' (' + name + ')'] = w.replace(' ', sep);
      expect(missed(all)).toEqual([]);
    });

    test('defect: the wordings the Sổ nguồn gate itself reads as "claim is unproven" are no class words (không có nguồn, chưa có bằng chứng, chưa ai chứng minh)', () => {
      expect(missed(variants(['không có nguồn', 'chưa có bằng chứng', 'chưa ai chứng minh'], (w) => w))).toEqual([]);
    });

    test('defect: near-synonyms of the new class words are not caught (truyền miệng, nghe đồn, người ta đồn, theo lời kể)', () => {
      expect(missed(variants(['truyền miệng', 'nghe đồn', 'người ta đồn', 'theo lời kể'], (w) => w))).toEqual([]);
    });

    test('defect: the other class words (đồn đại, lời kể, theo truyền thống, chưa kiểm chứng, không rõ nguồn, chưa được chứng minh) are not caught, in any case or form', () => {
      const more = ['đồn đại', 'lời kể', 'theo truyền thống', 'chưa kiểm chứng', 'không rõ nguồn', 'chưa được chứng minh'];
      expect(missed(variants(more, (w) => w))).toEqual([]);
      expect(missed(variants(more, (w) => w.toUpperCase().normalize('NFD')))).toEqual([]);
      expect(missed(variants(more.filter((w) => w.includes(' ')), (w) => w.replace(' ', '\u00A0')))).toEqual([]);
    });
  });

  test.describe('conclusion label and the Sổ nguồn', () => {
    const LABEL_STATUS: Record<string, string> = { 'SỰ THẬT': 'fact', 'TRANH CÃI': 'disputed', 'TRUYỀN THUYẾT': 'legend', 'CHƯA CÓ NGUỒN': 'decoy' };
    const NOTEBOOK_OF: Record<string, string> = { 'SỰ THẬT': 'dec25.fact.0', 'TRANH CÃI': 'dec25.dispute.0', 'TRUYỀN THUYẾT': 'nicholas.legend.0', 'CHƯA CÓ NGUỒN': 'mistletoe.card.2' };
    const LEG = { source: 'research/m0b-act-2.md', url: 'https://blog.sbb.berlin/luther-als-erfinder-des-weihnachtsbaums-eine-interpretation-des-19-jahrhunderts/', evidence: ['Người ta kể rằng Martin Luther là người đầu tiên thắp nến trên cây thông'] };
    const piece = (i: number, label: string, text: string, src: any) => ({ id: 'k' + i, text, label, status: LABEL_STATUS[label], notebook: NOTEBOOK_OF[label], ...src });
    const withConclusion = (): any => {
      const p = orderFx();
      p.conclusion = {
        template: 'Giáng Sinh có nhiều lớp. Điều chắc: ___ Điều còn tranh cãi: ___ Điều người ta kể: ___',
        blanks: [{ label: 'SỰ THẬT' }, { label: 'TRANH CÃI' }, { label: 'TRUYỀN THUYẾT' }],
        hints: [{ text: 'Câu hỏi: mỗi chỗ trống nhận một mảnh.' }, { text: 'Mở Sổ nguồn trong Menu.' }, { text: 'Nhờ Cúc Cu soi tỏ: Tèo điền cả câu.', solves: true }],
        bank: [
          piece(1, 'SỰ THẬT', 'bản ghi sớm nhất nằm trong một cuốn lịch', SRC.a),
          piece(2, 'TRANH CÃI', 'danh sách có mục Giáng Sinh từ năm 336', SRC.c),
          piece(3, 'TRUYỀN THUYẾT', 'Luther thắp nến đầu tiên trên cây thông', LEG),
          ...[4, 5, 6, 7, 8].map((i) => piece(i, 'CHƯA CÓ NGUỒN', 'điều số ' + i + ' chưa ai chứng minh', SRC.b)),
        ],
      };
      return p;
    };
    const readNotebook = (id: string) => JSON.parse(readFileSync(join(root, 'story/notebook', id + '.json'), 'utf8'));
    const scratch = (mutate: (dir: string) => void, body: (dir: string) => void, extra: string[] = []) => {
      const dir = mkdtempSync(join(tmpdir(), 'checker-rules-'));
      try {
        for (const id of ['dec25', 'nicholas', 'mistletoe', ...extra]) copyFileSync(join(root, 'story/notebook', id + '.json'), join(dir, id + '.json'));
        mutate(dir);
        body(dir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
    const setCard = (dir: string, line: string) => {
      const nb = readNotebook('mistletoe');
      nb.card[2] = line;
      writeFileSync(join(dir, 'mistletoe.json'), JSON.stringify(nb));
    };
    const labelErrors = (dir: string) => errorsOf(withConclusion(), { NOTEBOOK_DIR: dir });

    test('control: the fixture conclusion is clean against the real notebooks', () => {
      expect(errorsOf(withConclusion())).toBe('');
    });

    test.fail('defect: a card line that denies the claim is unproven ("không phải chưa có nguồn") still backs the label CHƯA CÓ NGUỒN', () => {
      test.info().annotations.push({ type: 'accepted risk', description: "a negated Sổ nguồn line still backs the label CHƯA CÓ NGUỒN (the gate reads phrases, not sentences)" });
      scratch((dir) => setCard(dir, 'Đã có nguồn rõ ràng, không phải chưa có nguồn.'), (dir) => {
        expect(labelErrors(dir)).toMatch(/does not say the claim is unproven/);
      });
    });

    test('valid design wrongly rejected: a card line that says "chưa được chứng minh" (natural wording) is not read as unproven', () => {
      scratch((dir) => setCard(dir, 'Hai việc này chưa được chứng minh là có liên quan.'), (dir) => {
        expect(labelErrors(dir)).toBe('');
      });
    });

    test('valid design wrongly rejected: an unproven card line with a no-break space or a double space inside the phrase is not read as unproven', () => {
      for (const line of ['Chưa ai chứng\u00A0minh hai việc có liên quan.', 'Chưa ai  chứng minh hai việc có liên quan.']) {
        scratch((dir) => setCard(dir, line), (dir) => {
          expect.soft(labelErrors(dir), JSON.stringify(line)).toBe('');
        });
      }
    });

    test('defect: a notebook file that is not valid JSON crashes the checker instead of reporting an error', () => {
      scratch((dir) => writeFileSync(join(dir, 'nicholas.json'), '{ "id": "nicholas", '), (dir) => {
        const r = node('const r = P.checkData(arg, arg.id, { full: false, minL2: 0 }); console.log(JSON.stringify(r.errors));', withConclusion(), { NOTEBOOK_DIR: dir });
        expect(r.status, r.stderr.split('\n').slice(0, 4).join(' | ')).toBe(0);
        expect(r.stdout).toMatch(/nicholas/);
      });
    });

    test.fail('defect: a piece may rest on a Sổ nguồn entry about another claim, as long as the entry has the right status', () => {
      test.info().annotations.push({ type: 'accepted risk', description: "a piece may point at a same-status Sổ nguồn entry about another topic (the gate compares status, not claims)" });
      const p = withConclusion();
      p.conclusion.bank[0].notebook = 'mistletoe.fact.0';
      expect(errorsOf(p), 'the calendar piece rests on the first kiss under mistletoe in 1784').not.toBe('');
    });

    test.fail('defect: a section the gate can never accept ("tradition") is only reported once its chapter is written, not while it is pending', () => {
      test.info().annotations.push({ type: 'accepted risk', description: "a pending chapter's tradition section is not checked until the chapter is written" });
      const p = withConclusion();
      p.conclusion.bank[0].notebook = 'zzz.tradition.0';
      expect(checked(p).errors.join('\n')).toMatch(/tradition/);
    });

    test('defect: the release gate opens on placeholder notebooks (entries "x", no sources) for the chapters that were pending', () => {
      scratch((dir) => {
        const entry = { text: 'x', sources: [] };
        writeFileSync(join(dir, 'tree.json'), JSON.stringify({ id: 'tree', card: ['a', 'b', 'c'], full: { legend: [entry] } }));
      }, (dir) => {
        const r = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
        expect(r.status, 'release gate on placeholder notebooks: ' + r.stdout.split('\n').slice(-2).join(' ')).toBe(1);
      }, ['dickens', 'saturnalia', 'befana']);
    });

    const REAL = ['dickens', 'saturnalia', 'befana'];
    const written = (url: string, status = 'verified') => (dir: string) => {
      const entry = { text: 'Một dòng có nguồn.', sources: [{ label: 'iwm.org.uk', url }] };
      writeFileSync(join(dir, 'tree.json'), JSON.stringify({ id: 'tree', status, card: ['a', 'b', 'c'], full: { legend: [entry] } }));
    };

    test('defect: the release gate opens on a verified Sổ nguồn whose link is not http(s), or whose status is not verified; a sourced verified one passes', () => {
      scratch(written('javascript:alert(1)'), (dir) => {
        const r = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
        expect(r.status, 'a javascript: link').toBe(1);
        expect(r.stdout + r.stderr).toMatch(/is not an http\(s\) link/);
      }, REAL);
      scratch(written('https://www.iwm.org.uk/x', 'placeholder'), (dir) => {
        const r = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
        expect(r.status, 'status placeholder').toBe(1);
        expect(r.stdout + r.stderr).toMatch(/not "verified"/);
      }, REAL);
      scratch(written('https://www.iwm.org.uk/x'), (dir) => {
        const r = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
        expect(r.status, r.stdout + r.stderr).toBe(0);
      }, REAL);
    });

    test('control: the release gate fails on a pending chapter wherever the flag stands in the command line', () => {
      scratch(() => undefined, (dir) => {
        for (const args of [['--release', 'ending'], ['ending', '--release']]) {
          const r = gate(args, { NOTEBOOK_DIR: dir });
          expect.soft(r.status, args.join(' ')).toBe(1);
          expect.soft(r.stderr, args.join(' ')).toMatch(/RELEASE GATE: \d+ conclusion piece/);
        }
      });
    });

    test('finding 7: voice check rejects >25 words per line, >12 words between punctuation, and >2 commas in a sentence on full puzzles', () => {
      const longCard = orderFx();
      longCard.cards[0].text = 'Một hai ba bốn năm sáu bảy tám, chín mười mười một mười hai mười ba; mười bốn mười lăm mười sáu, mười bảy mười tám mười chín hai mươi.';
      expect(errorsOf(longCard)).toMatch(/cards\[0\]\.text has \d+ words \(max 25\)/);
      const longClause = orderFx();
      longClause.question = 'Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba.';
      expect(errorsOf(longClause)).toMatch(/question has 16 words between punctuation \(max 12\)/);
      const manyCommas = orderFx();
      manyCommas.aha = 'Một hai, ba bốn, năm sáu, bảy tám.';
      expect(errorsOf(manyCommas)).toMatch(/aha has 3 commas in a sentence \(max 2\)/);
      const afterNumber = orderFx();
      afterNumber.cards[0].text = 'Một hai ba bốn năm sáu bảy tám chín thế kỷ 4. Mười mười một mười hai mười ba mười bốn.';
      expect(errorsOf(afterNumber)).not.toMatch(/between punctuation/);
    });

    test('finding 8: --release validates custom chapter Sổ nguồn, counts missing notebook files in checkData errors, and rejects empty or array full', () => {
      scratch(() => undefined, (dir) => {
      const rMissing = node('const p = JSON.parse((await import("node:fs")).readFileSync("story/puzzles/ending.json", "utf8")); const r = P.checkData(p, "ending", { full: false, release: true }); console.log(JSON.stringify(r.errors));', null, { NOTEBOOK_DIR: dir });
      expect(JSON.parse(rMissing.stdout).join('\n')).toMatch(/RELEASE GATE: .*dickens/);
      });

      scratch((dir) => {
        writeFileSync(join(dir, 'nicholas.json'), JSON.stringify({ id: 'nicholas', status: 'placeholder', card: ['a', 'b', 'c'], full: {} }));
      }, (dir) => {
        const r = gate(['--release', 'nicholas'], { NOTEBOOK_DIR: dir });
        expect(r.status).toBe(1);
        expect(r.stdout + r.stderr).toMatch(/RELEASE GATE: Sổ nguồn of nicholas/);
      });

      scratch((dir) => {
        writeFileSync(join(dir, 'tree.json'), JSON.stringify({ id: 'tree', status: 'verified', card: ['a', 'b', 'c'], full: [] }));
      }, (dir) => {
        const r = gate(['--release', 'ending'], { NOTEBOOK_DIR: dir });
        expect(r.status).toBe(1);
        expect(r.stdout + r.stderr).toMatch(/full is not an object|full has no entries/);
      }, REAL);
    });
  });
});
