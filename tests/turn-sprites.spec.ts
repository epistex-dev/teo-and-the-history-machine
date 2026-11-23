import { expect, test } from '@playwright/test';
import { chapters } from '../scripts/chapters-plugin.ts';

const transform = (md: string): unknown => {
  const context = { error: (message: string): never => { throw new Error(message); } };
  return (chapters().transform as (this: typeof context, code: string, id: string) => unknown).call(context, md, '/story/chapters/t.md?chapter');
};
const head = '---\nid: t\ntitle: T\n---\n\n## a\n';

test.describe('@turn for a figure at build time', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('a chapter that turns Quạ Đồn onto the stage without giving him a line fails the build', () => {
    expect(() => transform(head + '@turn qua-don front\n> Một dòng.\nTèo [normal]: Chào.\n')).toThrow(/Quạ Đồn.*no line/);
  });

  test('the same chapter builds once Quạ Đồn speaks, and Tèo may be turned without a line', () => {
    expect(() => transform(head + '@turn qua-don front\n> Một dòng.\nQuạ Đồn [normal]: Chào.\n')).not.toThrow();
    expect(() => transform(head + '@turn teo three-quarter\n> Một dòng.\nCúc Cu [normal]: Chào.\n')).not.toThrow();
  });
});
