import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { parseChapter } from '../src/story/parse.ts';
import { intro } from './support/script.ts';

const doc = (body: string, head = '---\nid: t\ntitle: T\n---\n') => head + body;

test.describe('chapter script parser', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('the fixture exercises every directive and speaker kind', () => {
    const c = parseChapter(readFileSync('tests/fixtures/sample-chapter.md', 'utf8'), 'sample-chapter.md');
    expect(c.id).toBe('sample');
    expect(c.title).toBe('Chương mẫu');
    expect(c.scenes.map((s) => s.id)).toEqual(['mo-dau', 'kiem-chung']);
    expect(c.lineCount).toBe(7);
    const beats = c.scenes.flatMap((s) => s.beats);
    expect(beats.map((b) => b.t)).toEqual(['bg', 'plate', 'narr', 'say', 'say', 'ask-name', 'say', 'plate', 'say', 'say', 'minigame', 'stamp', 'say', 'card']);
    expect(beats.find((b) => b.t === 'say' && b.who === 'Ông già Noel')).toMatchObject({ expr: null });
    expect(beats.find((b) => b.t === 'say' && b.who === 'Tèo')).toMatchObject({ expr: 'elated', text: 'Thư! Tớ sắp có ghế xoay.' });
    expect(beats.filter((b) => b.t === 'plate')).toEqual([
      { t: 'plate', text: 'Hình I. — Một ngọn đèn nhuộm vàng những tay nắm đồng.' },
      { t: 'plate', text: 'Hình II. — Bàn chứng cứ còn một chỗ hở.' },
    ]);
    expect(beats.find((b) => b.t === 'stamp')).toMatchObject({ label: 'TRUYỀN THUYẾT' });
    expect(beats.find((b) => b.t === 'say' && b.text.includes('{ten}'))).toBeTruthy();
  });

  test('chapter 1 parses and meets the R1 length of 25 to 40 lines with the name prompt and the mini game', () => {
    expect(intro.id).toBe('intro');
    expect(intro.lineCount).toBeGreaterThanOrEqual(25);
    expect(intro.lineCount).toBeLessThanOrEqual(40);
    const kinds = intro.scenes.flatMap((s) => s.beats).map((b) => b.t);
    expect(kinds).toContain('ask-name');
    expect(kinds).toContain('minigame');
    expect(kinds.indexOf('ask-name')).toBeLessThan(kinds.indexOf('minigame'));
  });

  const bad: [string, string, RegExp][] = [
    ['no front matter', '## a\n> x\n', /front matter/],
    ['front matter never closed', '---\nid: t\ntitle: T\n## a\n> x\n', /not closed|allows only/],
    ['id not kebab-case', doc('## a\n> x\n', '---\nid: Bad Id\ntitle: T\n---\n'), /kebab-case id/],
    ['no title', doc('## a\n> x\n', '---\nid: t\n---\n'), /title/],
    ['scene id not kebab-case', doc('## Hỏi Tên\n> x\n'), /kebab-case/],
    ['duplicate scene id', doc('## a\n> x\n## a\n> y\n'), /duplicate scene id/],
    ['content before the first scene', doc('> x\n## a\n> y\n'), /before the first/],
    ['unknown directive', doc('## a\n@wipe\n> x\n'), /unknown directive/],
    ['@stamp with an unknown label', doc('## a\n@stamp KHÔNG BIẾT\n> x\n'), /@stamp must be one of/],
    ['@bg without an id', doc('## a\n@bg\n> x\n'), /@bg needs/],
    ['expression the character does not have', doc('## a\nTèo [dancing]: Hi\n'), /no expression "dancing"/],
    ['Noel with an expression', doc('## a\nÔng già Noel [normal]: Ho\n'), /voice only/],
    ['a speaker misspelled without diacritics', doc('## a\nTeo [normal]: Hi\n'), /misspelling of "Tèo"/],
    ['two name prompts', doc('## a\n@ask-name\n> x\n## b\n@ask-name\n> y\n'), /at most one @ask-name/],
    ['two mini games', doc('## a\n@minigame\n> x\n## b\n@minigame\n> y\n'), /at most one @minigame/],
    ['a scene with no line', doc('## a\n@bg x\n'), /has no line/],
    ['text that is not NFC', doc('## a\n> e\u0300\n'), /not NFC/],
    ['a line that is none of the kinds', doc('## a\nhello there\n'), /not a dialogue/],
  ];
  for (const [name, source, error] of bad) {
    test(`rejects: ${name}`, () => {
      expect(() => parseChapter(source, 'bad.md')).toThrow(error);
    });
  }

  test('[khô] is stripped from a narration line too, with or without a space after the >', () => {
    for (const line of ['> [khô] Xong rồi', '>[khô] Xong rồi', '>   [Khô]   Xong rồi']) {
      expect(parseChapter(doc(`## a\n${line}\n`)).scenes[0]?.beats[0]).toMatchObject({ t: 'narr', text: 'Xong rồi' });
    }
  });

  test('[vì-sao] is stripped from a say or narration line, with or without a space after the >', () => {
    for (const line of ['> [vì-sao] Xong rồi', '>[vì-sao] Xong rồi', '>   [Vì-Sao]   Xong rồi', 'Tèo [normal]: [vì-sao] Xong rồi']) {
      expect(parseChapter(doc(`## a\n${line}\n`)).scenes[0]?.beats[0]).toMatchObject({ text: 'Xong rồi' });
    }
  });

  const nearMiss: [string, string, RegExp][] = [
    ['a tag without diacritics', 'Tèo [normal]: [kho] Xong', /misspelling of \[khô\]/],
    ['a tag with a typo in a narration line', '> [khó] Xong', /misspelling of \[khô\]/],
    ['a tag in capitals without diacritics', 'Tèo [normal]: [KHO] Xong', /misspelling of \[khô\]/],
    ['the retired tag [đùa]', 'Tèo [normal]: [đùa] Xong', /misspelling of \[khô\]/],
    ['{tên} with diacritics', 'Tèo [normal]: Chào {tên}!', /only \{ten\}/],
    ['{Ten} with a capital', 'Tèo [normal]: Chào {Ten}!', /only \{ten\}/],
    ['{ten without its brace', '> Chào {ten', /only \{ten\}/],
    ['a stray closing brace', '> Chào ten}', /only \{ten\}/],
    ['[khô] after the first words', '> Xong [khô] rồi', /only allowed right after the speaker/],
    ['[vì-sao] after the first words', 'Tèo [normal]: Câu [vì-sao] rồi', /\[vì-sao\] is only allowed right after the speaker/],
    ['a misspelled [vì-sao]', 'Tèo [normal]: [vi-sao] Xong', /misspelling of \[vì-sao\]/],
    ['[vì-sao] in a narration line not at the start', '> Xong [vì-sao] rồi', /\[vì-sao\] is only allowed right after the speaker/],
  ];
  for (const [name, line, error] of nearMiss) {
    test(`rejects a near miss: ${name}`, () => {
      expect(() => parseChapter(doc(`## a\n${line}\n`), 'bad.md')).toThrow(error);
    });
  }

  const plateNear: [string, string, RegExp][] = [
    ['Arabic numeral', '@plate Hình 1. — Sảnh dài.', /must read/],
    ['no diacritics in Hình', '@plate Hinh I. — Sảnh dài.', /must read/],
    ['lower-case numeral', '@plate Hình i. — Sảnh dài.', /must read/],
    ['a hyphen for the dash', '@plate Hình I. - Sảnh dài.', /must read/],
    ['an en dash for the dash', '@plate Hình I. – Sảnh dài.', /must read/],
    ['no full stop after the numeral', '@plate Hình I — Sảnh dài.', /must read/],
    ['no caption', '@plate Hình I. —', /must read/],
    ['no argument', '@plate', /must read/],
    ['an invalid numeral', '@plate Hình IIII. — Sảnh dài.', /expected Hình I\./],
    ['the wrong number for the first plate', '@plate Hình II. — Sảnh dài.', /expected Hình I\./],
    ['a caption of 17 words', '@plate Hình I. — ' + Array.from({ length: 17 }, () => 'chữ').join(' '), /over 16 words/],
    ['a year in the caption', '@plate Hình I. — Rôma năm 17.', /no digit/],
    ['a stamp label in the caption', '@plate Hình I. — Dấu SỰ THẬT lên thư.', /no stamp label/],
    ['a stray brace in the caption', '@plate Hình I. — Thư gửi {tên}.', /only \{ten\}/],
    ['a joke mark in the caption', '@plate Hình I. — [khô] Thư nhòe.', /not allowed in a @plate/],
  ];
  for (const [name, line, error] of plateNear) {
    test(`rejects a near miss: @plate with ${name}`, () => {
      expect(() => parseChapter(doc(`## a\n${line}\n> x\n`), 'bad.md')).toThrow(error);
    });
  }

  test('a 16-word caption passes and is kept whole', () => {
    const caption = Array.from({ length: 16 }, () => 'chữ').join(' ');
    expect(parseChapter(doc(`## a\n@plate Hình I. — ${caption}\n> x\n`)).scenes[0]?.beats[0]).toEqual({ t: 'plate', text: `Hình I. — ${caption}` });
  });

  test('plates count up from I across scenes, once per scene, before the first line, and are not dialogue lines', () => {
    const c = parseChapter(doc('## a\n@bg x\n@plate Hình I. — Một.\n> x\n@prop y\n## b\n> y\n## c\n@plate Hình II. — Hai.\n> z\n'));
    expect(c.lineCount).toBe(3);
    expect(c.scenes.map((s) => s.beats.filter((b) => b.t === 'plate').length)).toEqual([1, 0, 1]);
    expect(() => parseChapter(doc('## a\n@plate Hình I. — Một.\n@plate Hình II. — Hai.\n> x\n'), 'bad.md')).toThrow(/at most one @plate per scene/);
    expect(() => parseChapter(doc('## a\n> x\n@plate Hình I. — Một.\n'), 'bad.md')).toThrow(/before the first line/);
    expect(() => parseChapter(doc('## a\n@plate Hình I. — Một.\n> x\n## b\n@plate Hình I. — Hai.\n> y\n'), 'bad.md')).toThrow(/expected Hình II\./);
  });

  test('an ordinary bracket at the start of a line stays text', () => {
    expect(parseChapter(doc('## a\n> [Bản nháp] Cảnh kết\n')).scenes[0]?.beats[0]).toMatchObject({ t: 'narr', text: '[Bản nháp] Cảnh kết' });
  });

  test('a chapter allows at most three [khô] lines', () => {
    const jokes = (n: number) => doc('## a\n> x\n' + Array.from({ length: n }, (_, k) => 'Tèo [normal]: [khô] Dòng ' + k + '\n').join(''));
    for (const n of [0, 3]) expect(() => parseChapter(jokes(n))).not.toThrow();
    expect(() => parseChapter(jokes(4), 'many.md')).toThrow(/at most 3 \[khô\] lines per chapter, found 4/);
  });

  test('[khô] marks are stripped from the shown text and {ten} is kept for the player name', () => {
    const c = parseChapter(doc('## a\nTèo [normal]: [khô] Chào {ten}!\n'));
    expect(c.scenes[0]?.beats[0]).toMatchObject({ t: 'say', text: 'Chào {ten}!' });
  });
});

test.describe('@pose and @machine at directives', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  const beatsOf = (body: string) => parseChapter(doc('## a\n' + body + '\n> x\n')).scenes[0]!.beats;

  test('@pose takes one of the four poses, with an optional root per orientation', () => {
    expect(beatsOf('@pose stand')[0]).toEqual({ t: 'pose', pose: 'stand', at: null });
    expect(beatsOf('@pose sit')[0]).toEqual({ t: 'pose', pose: 'sit', at: null });
    expect(beatsOf('@pose read at 64,622')[0]).toEqual({ t: 'pose', pose: 'read', at: { portrait: [64, 622], landscape: null } });
    expect(beatsOf('@pose sheet land 420.5,274')[0]).toEqual({ t: 'pose', pose: 'sheet', at: { portrait: null, landscape: [420.5, 274] } });
    expect(beatsOf('@pose sit land 1,2 at 3,4')[0]).toEqual({ t: 'pose', pose: 'sit', at: { portrait: [3, 4], landscape: [1, 2] } });
  });

  test('@machine keeps its flags and gains an optional origin; without one the beat is unchanged', () => {
    expect(beatsOf('@machine stained open')[0]).toEqual({ t: 'machine', flags: ['stained', 'open'] });
    expect(beatsOf('@machine')[0]).toEqual({ t: 'machine', flags: [] });
    expect(beatsOf('@machine stained at 150,400 land 500,60')[0]).toEqual({ t: 'machine', flags: ['stained'], at: { portrait: [150, 400], landscape: [500, 60] } });
    expect(beatsOf('@machine at 150,400')[0]).toEqual({ t: 'machine', flags: [], at: { portrait: [150, 400], landscape: null } });
  });

  const bad: [string, string, RegExp][] = [
    ['no pose', '@pose', /@pose needs one of stand \| read \| sheet \| sit/],
    ['an unknown pose', '@pose kneel', /@pose needs one of/],
    ['a pose glued to a word', '@pose sitting', /@pose needs one of/],
    ['at without numbers', '@pose sit at', /at\/land takes <x>,<y>/],
    ['land with a space inside the pair', '@pose sit land 1, 2', /at\/land takes <x>,<y>/],
    ['at on a machine without numbers', '@machine open at left', /at\/land takes <x>,<y>/],
    ['an unknown machine flag after at', '@machine at 1,2 broken', /@machine flag must be one of/],
  ];
  for (const [name, line, error] of bad) {
    test(`rejects: ${name}`, () => {
      expect(() => parseChapter(doc('## a\n' + line + '\n> x\n'), 'bad.md')).toThrow(error);
    });
  }
});
