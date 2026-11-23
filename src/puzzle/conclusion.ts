import { conclusionCorrect } from 'virtual:puzzle-core';
import { h, hostOf, keepFocus } from './dom.ts';
import type { BoardHooks } from './piece-board.ts';
import type { Conclusion } from './types.ts';

/** The ending's last step: fill the blanks of one sentence with sourced pieces. A piece never shows its label; the player tells fact, dispute and legend apart. */
export class ConclusionBoard {
  readonly root: HTMLElement;
  selected: number | null = null;
  private readonly fills: (number | null)[];
  private readonly order: number[];

  constructor(private readonly c: Conclusion, private readonly hooks: BoardHooks, order: number[], private readonly ids: number[]) {
    this.fills = c.blanks.map(() => null);
    this.order = order;
    this.root = h('div', { class: 'pz-conclusion' });
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selected !== null) {
        const j = this.selected;
        this.selected = null;
        this.render(this.fk(j));
      }
    });
    this.render();
  }

  private text = (j: number): string => this.c.bank[j]?.text ?? '';
  private fk = (j: number): string => 'piece:' + this.ids[j];
  private blankOf = (j: number): number => this.fills.indexOf(j);

  /** The checker's rule: every blank holds a distinct piece carrying the blank's label. */
  correct(): boolean {
    return conclusionCorrect(this.c, this.fills);
  }

  empty(): number {
    return this.fills.filter((f) => f === null).length;
  }

  filled(): (string | null)[] {
    return this.fills.map((j) => (j === null ? null : this.text(j)));
  }

  indices(): (number | null)[] {
    return [...this.fills];
  }

  restore(fills: unknown): void {
    if (!Array.isArray(fills)) return;
    this.c.blanks.forEach((_, i) => {
      const j = fills[i];
      this.fills[i] = Number.isInteger(j) && this.c.bank[j as number] && !this.fills.slice(0, i).includes(j as number) ? (j as number) : null;
    });
    this.render();
  }

  labels(): (string | null)[] {
    return this.fills.map((j) => (j === null ? null : (this.c.bank[j]?.label ?? null)));
  }

  solve(): void {
    this.c.blanks.forEach((b, i) => {
      this.fills[i] = this.c.bank.findIndex((p, j) => p.label === b.label && !this.fills.slice(0, i).includes(j));
    });
    this.selected = null;
    this.render();
  }

  lock(): void {
    this.root.dataset.locked = 'true';
    for (const b of this.root.querySelectorAll('button')) b.disabled = true;
  }

  private onClick(e: MouseEvent): void {
    if (this.root.dataset.locked) return;
    const target = e.target as HTMLElement;
    const blank = target.closest<HTMLElement>('.pz-blank');
    const piece = target.closest<HTMLElement>('.pz-piece');
    if (blank?.dataset.blank !== undefined) {
      const i = Number(blank.dataset.blank);
      const here = this.fills[i] ?? null;
      if (this.selected !== null) {
        const j = this.selected;
        const was = this.blankOf(j);
        if (was >= 0) this.fills[was] = null;
        this.fills[i] = j;
        this.selected = null;
        this.hooks.say('Đã điền: ' + this.text(j));
        this.hooks.tone('place');
        this.hooks.changed();
        return this.render('blank:' + i);
      }
      if (here !== null) {
        this.fills[i] = null;
        this.selected = here;
        this.hooks.say('Đã gỡ: ' + this.text(here) + '. Đang cầm mảnh này.');
        this.hooks.tone('remove');
        this.hooks.changed();
        return this.render(this.fk(here));
      }
      return this.hooks.say('Chọn một mảnh trước, rồi chạm vào chỗ trống.');
    }
    if (piece?.dataset.piece !== undefined) {
      const j = this.ids.indexOf(Number(piece.dataset.piece));
      if (j < 0) return;
      this.selected = this.selected === j ? null : j;
      this.hooks.say(this.selected === null ? 'Đã bỏ chọn.' : 'Đã chọn: ' + this.text(j) + '. Chạm vào một chỗ trống để điền.');
      this.render(this.fk(j));
    }
  }

  private render(focus?: string): void {
    keepFocus(this.root, () => {
      const parts = this.c.template.split('___');
      const sentence = h('p', { class: 'pz-sentence' });
      parts.forEach((part, i) => {
        sentence.append(part);
        if (i >= parts.length - 1) return;
        const j = this.fills[i] ?? null;
        sentence.append(h('button', {
          type: 'button',
          class: 'pz-blank',
          'data-blank': i,
          'data-filled': String(j !== null),
          'data-fk': 'blank:' + i,
          'aria-label': 'Chỗ trống ' + (i + 1) + ': ' + (j === null ? 'trống' : this.text(j)),
        }, j === null ? '' + (i + 1) : this.text(j)));
      });
      const bank = h('ul', { class: 'pz-pieces', 'aria-label': 'Mảnh để điền' });
      for (const j of this.order) {
        const p = this.c.bank[j];
        if (!p) continue;
        const used = this.blankOf(j) >= 0;
        const item = h('li', { class: 'pz-piece-row', 'data-used': String(used) });
        item.append(used ? h('span', { class: 'pz-gap', 'aria-hidden': 'true' }) : h('button', { type: 'button', class: 'pz-piece', 'data-piece': this.ids[j], 'data-fk': this.fk(j), 'aria-pressed': String(this.selected === j) }, p.text));
        const urls = ([] as string[]).concat(p.url ?? []);
        if (!used && urls.length) item.append(h('p', { class: 'pz-src' }, 'Nguồn: ', ...urls.map((url) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, hostOf(url)))));
        bank.append(item);
      }
      this.root.replaceChildren(sentence, bank);
    }, focus);
  }
}
