import { KIND, SHOWN } from 'virtual:puzzle-core';
import { h, hostOf } from './dom.ts';
import type { Card, Status } from './types.ts';

const STAMP: Partial<Record<Status, string>> = { fact: 'SỰ THẬT', disputed: 'TRANH CÃI', legend: 'TRUYỀN THUYẾT' };

/** What the player sees on a card: a decoy shows the status it pretends to have, never the word "decoy". */
export const shownStatus = (c: Pick<Card, 'status' | 'shows'>): Status => (c.status === 'decoy' ? (c.shows ?? 'fact') : c.status);

function cardEl(c: Card, index: number): HTMLElement {
  const shown = shownStatus(c);
  const urls = ([] as string[]).concat(c.url ?? []);
  const head = h('div', { class: 'pz-card-head' }, h('span', { class: 'pz-no' }, `Thẻ ${index + 1}`));
  if (c.kind === 'rule') head.append(h('span', { class: 'flag' }, KIND.rule ?? 'luật chơi'));
  else {
    head.append(h('span', { class: 'flag pz-kind', 'data-kind': c.kind }, KIND[c.kind] ?? c.kind));
    const stamp = h('span', { class: 'stamp plain', 'data-stamp': STAMP[shown] ?? '' }, h('span', { class: 'stamp-text' }, SHOWN[shown] ?? shown));
    head.append(stamp);
  }
  const who = [c.who, c.when].filter(Boolean).join(' · ');
  const li = h('li', { class: 'pz-card card', 'data-card': c.id, 'data-kind': c.kind, 'data-shown': shown }, head);
  if (who) li.append(h('p', { class: 'pz-who' }, who));
  li.append(h('p', { class: 'pz-text' }, c.text));
  if (c.source !== 'game' && urls.length) {
    const src = h('p', { class: 'pz-src' }, 'Nguồn: ');
    for (const url of urls) src.append(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, hostOf(url)));
    li.append(src);
  }
  return li;
}

export class EvidenceBoard {
  readonly root: HTMLElement;
  private readonly cards = new Map<string, HTMLElement>();
  private open = false;

  constructor(cards: Card[], heading = 'Thẻ bằng chứng') {
    const id = `pz-ev-${Math.random().toString(36).slice(2, 7)}`;
    const list = h('ul', { class: 'pz-cards' });
    cards.forEach((c, i) => {
      const el = cardEl(c, i);
      this.cards.set(c.id, el);
      list.append(el);
    });
    this.root = h('section', { class: 'pz-evidence', id, 'aria-labelledby': id + '-h', 'data-open': 'false' }, h('h3', { id: id + '-h', class: 'pz-h' }, heading), list);
  }

  /** The portrait sheet opens and closes from the dock button; the landscape column ignores it. */
  setOpen(open: boolean): void {
    this.open = open;
    this.root.dataset.open = String(open);
  }

  isOpen(): boolean {
    return this.open;
  }

  /** Marks the cards a hint or the wrong-frame message points at; a mark is for the player to read, never for a place on the board. */
  point(ids: string[]): void {
    for (const [id, el] of this.cards) {
      const on = ids.includes(id);
      if (on) el.dataset.pointed = 'true';
      else delete el.dataset.pointed;
    }
    this.cards.get(ids[0] ?? '')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }

  pointed(): string[] {
    return [...this.cards].filter(([, el]) => el.dataset.pointed === 'true').map(([id]) => id);
  }
}
