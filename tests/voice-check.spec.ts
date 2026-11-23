import { expect, test } from '@playwright/test';
import { chapterProblems } from '../scripts/puzzles.mjs';

const script = (line: string) => '---\nid: tree\ntitle: T\n---\n\n## a\n' + line + '\n> [vì-sao] Câu trả lời của chặng nằm ở đây.\n';

test.describe('chapter voice check', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('a reserved word inside double quotes is a mention and passes', () => {
    expect(chapterProblems('tree', script('Cúc Cu [normal]: Nhưng "đầu tiên" thì còn tranh cãi.'))).toEqual([]);
    expect(chapterProblems('tree', script('Cúc Cu [normal]: Nhưng “đầu tiên” thì còn tranh cãi.'))).toEqual([]);
  });

  test('an unquoted reserved word outside Quạ Đồn still fails, and Quạ Đồn may use it', () => {
    expect(chapterProblems('tree', script('Cúc Cu [normal]: Đây là mốc đầu tiên.'))).toHaveLength(1);
    expect(chapterProblems('tree', script('> Nó luôn đứng đó.'))).toHaveLength(1);
    expect(chapterProblems('tree', script('Quạ Đồn [normal]: Đây là mốc đầu tiên.'))).toEqual([]);
  });

  test('[vì-sao]: exactly one tagged line, among the last three dialogue lines before @card', () => {
    const lines = (...ls: string[]) => '---\nid: tree\ntitle: T\n---\n\n## a\n' + ls.join('\n') + '\n';
    const say = (t: string) => 'Cúc Cu [normal]: ' + t;
    const answer = '[vì-sao] Câu trả lời của chặng nằm ở đây.';
    // no tag at all
    expect(chapterProblems('tree', lines('> Dòng dẫn mở màn.', say('Một câu thoại bình thường.'), say('Câu chốt trước dấu.'), '> Câu kết cảnh.', '@card'))).toHaveLength(1);
    // tag on the fourth-from-last dialogue line
    expect(chapterProblems('tree', lines('> Dòng dẫn mở màn.', say(answer), say('Một câu thoại bình thường.'), say('Câu chốt trước dấu.'), say('Câu kế của chốt.'), '> Câu kết cảnh.', '@card'))).toHaveLength(1);
    // tag on a say line inside the last three before the card
    expect(chapterProblems('tree', lines('> Dòng dẫn mở màn.', say('Một câu thoại bình thường.'), say('Câu chốt trước dấu.'), say(answer), '> Câu kết cảnh.', '@card'))).toEqual([]);
    // tag on a narration line inside the last three
    expect(chapterProblems('tree', lines('> Dòng dẫn mở màn.', say('Một câu thoại bình thường.'), say('Câu chốt trước dấu.'), '> ' + answer, '> Câu kết cảnh.', '@card'))).toEqual([]);
    // two tags
    expect(chapterProblems('tree', lines('> Dòng dẫn mở màn.', say(answer), say('Một câu thoại bình thường.'), say(answer), '> Câu kết cảnh.', '@card'))).toHaveLength(1);
  });
});
