import { bankOrder, model, pieceIds } from 'virtual:puzzle-core';
import { h, keepFocus } from './dom.ts';
import type { Cell, Slot, Token } from './types.ts';

export interface BoardHooks {
  /** Spoken to a screen reader only; nothing here says whether a placement is right. */
  say(text: string): void;
  /** The player moved a piece: the last verdict no longer describes this board. */
  changed(): void;
  /** A piece went into a slot or came out of one. */
  tone(kind: 'place' | 'remove'): void;
}

interface Source {
  id: string;
  slots: Slot[];
  tokens: Token[];
}

const DRAG_PX = 10;

/** A piece bank and a list of slots: assign, order, multi-capacity and mark puzzles are the same board with different slot caps. */
export class PieceBoard {
  readonly root: HTMLElement;
  selected: string | null = null;
  /** The piece last lifted out of a slot: while it is the one held, tapping another placed piece lifts that one too instead of dropping this one on it. */
  private held: string | null = null;
  private readonly content = new Map<string, string[]>();
  private readonly tokens: Token[];
  private readonly caps: number[];
  private readonly byId = new Map<string, Token>();
  /** The page never carries the file's piece ids: a piece is a button with an opaque number, translated back here. */
  private readonly domId: Record<string, string>;
  private readonly fromDom = new Map<string, string>();
  private suppress = false;
  private drag: { id: string; x: number; y: number; started: boolean; ghost: HTMLElement | null } | null = null;

  constructor(private readonly data: Source, private readonly hooks: BoardHooks, private readonly row = false) {
    this.tokens = bankOrder(data as never);
    this.caps = model(data as never).cap;
    this.domId = pieceIds(data as never);
    for (const [id, dom] of Object.entries(this.domId)) this.fromDom.set(dom, id);
    for (const t of data.tokens) this.byId.set(t.id, t);
    for (const s of data.slots) this.content.set(s.id, []);
    this.root = h('div', { class: 'pz-board' });
    this.root.addEventListener('click', (e) => this.onClick(e), true);
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.selected) {
        const id = this.selected;
        this.selected = null;
        this.hooks.say('Đã bỏ chọn ' + this.text(id) + '.');
        this.render('piece:' + this.domId[id]);
      }
    });
    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.render();
  }

  private text = (id: string): string => this.byId.get(id)?.text ?? id;
  private slotOf = (id: string): string | undefined => [...this.content].find(([, list]) => list.includes(id))?.[0];
  private slotIndex = (sid: string): number => this.data.slots.findIndex((s) => s.id === sid);
  private label = (sid: string): string => this.data.slots[this.slotIndex(sid)]?.label ?? sid;

  /** One entry per slot in slot order, each the ids placed there. */
  cells(): Cell[] {
    return this.data.slots.map((s) => [...(this.content.get(s.id) ?? [])]);
  }

  placements(): Record<string, string[]> {
    return Object.fromEntries(this.data.slots.map((s) => [s.id, [...(this.content.get(s.id) ?? [])]]));
  }

  bankIds(): string[] {
    return this.tokens.filter((t) => !this.slotOf(t.id)).map((t) => t.id);
  }

  fill(cells: Cell[]): void {
    for (const list of this.content.values()) list.length = 0;
    this.data.slots.forEach((s, i) => {
      const cell = cells[i];
      (this.content.get(s.id) as string[]).push(...(cell === null || cell === undefined ? [] : ([] as string[]).concat(cell)));
    });
    this.selected = null;
    this.render();
  }

  private lift(id: string): void {
    for (const list of this.content.values()) {
      const at = list.indexOf(id);
      if (at >= 0) list.splice(at, 1);
    }
  }

  private put(id: string, sid: string): boolean {
    const list = this.content.get(sid) as string[];
    const cap = this.caps[this.slotIndex(sid)] ?? 1;
    if (!list.includes(id) && cap > 1 && list.length >= cap) {
      this.hooks.say(this.label(sid) + ' chỉ nhận tối đa ' + cap + ' mảnh.');
      return false;
    }
    this.lift(id);
    if (cap === 1) for (const old of list.splice(0)) this.hooks.say(this.text(old) + ' trở lại hộp.');
    list.push(id);
    this.selected = null;
    this.hooks.say('Đã đặt ' + this.text(id) + ' vào ' + this.label(sid) + '.');
    this.hooks.tone('place');
    this.hooks.changed();
    return true;
  }

  private onPiece(id: string): void {
    if (this.selected === id) {
      this.selected = null;
      this.hooks.say('Đã bỏ chọn ' + this.text(id) + '.');
    } else {
      this.selected = id;
      this.held = null;
      this.hooks.say('Đã chọn ' + this.text(id) + '. Chạm vào một ô để đặt.');
    }
    this.render('piece:' + this.domId[id]);
  }

  private onChip(id: string): void {
    const from = this.slotOf(id) as string;
    if (this.selected && this.selected !== id && this.selected !== this.held) return this.onSlot(from);
    this.lift(id);
    this.selected = id;
    this.held = id;
    this.hooks.say('Đã gỡ ' + this.text(id) + ' khỏi ' + this.label(from) + '. Đang cầm ' + this.text(id) + '.');
    this.hooks.tone('remove');
    this.hooks.changed();
    this.render('piece:' + this.domId[id]);
  }

  private onSlot(sid: string): void {
    const id = this.selected;
    if (!id) return this.hooks.say('Chọn một mảnh trước, rồi chạm vào ô.');
    const placed = this.put(id, sid);
    this.render(placed ? 'slot:' + sid : undefined);
  }

  private dropOn(id: string, target: string | 'bank'): void {
    if (target === 'bank') {
      if (this.slotOf(id)) {
        this.lift(id);
        this.hooks.say(this.text(id) + ' trở lại hộp.');
        this.hooks.tone('remove');
        this.hooks.changed();
      }
      this.selected = null;
      return this.render('piece:' + this.domId[id]);
    }
    this.render(this.put(id, target) ? 'slot:' + target : undefined);
  }

  private onClick(e: MouseEvent): void {
    if (this.suppress) {
      this.suppress = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement;
    const piece = target.closest<HTMLElement>('.pz-piece');
    const id = this.fromDom.get(piece?.dataset.piece ?? '');
    if (piece && id) return piece.classList.contains('pz-chip') ? this.onChip(id) : this.onPiece(id);
    const slot = target.closest<HTMLElement>('.pz-slot');
    if (slot?.dataset.slot) return this.onSlot(slot.dataset.slot);
  }

  /** Dragging is an extra: a press that moves 10 px or more carries the piece to the slot (or the box) under the pointer. */
  private onDown(e: PointerEvent): void {
    const piece = (e.target as HTMLElement).closest<HTMLElement>('.pz-piece');
    const id = this.fromDom.get(piece?.dataset.piece ?? '');
    if (!id || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.drag = { id, x: e.clientX, y: e.clientY, started: false, ghost: null };
    const move = (m: PointerEvent): void => {
      const d = this.drag;
      if (!d) return;
      if (!d.started && Math.hypot(m.clientX - d.x, m.clientY - d.y) >= DRAG_PX) {
        d.started = true;
        d.ghost = h('div', { class: 'pz-ghost', 'aria-hidden': 'true' }, this.text(d.id));
        document.body.append(d.ghost);
      }
      if (d.ghost) {
        d.ghost.style.left = m.clientX + 'px';
        d.ghost.style.top = m.clientY + 'px';
      }
    };
    const hide = (): void => {
      if (document.hidden) end(new PointerEvent('pointercancel'));
    };
    const end = (u: PointerEvent): void => {
      document.removeEventListener('visibilitychange', hide);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      const d = this.drag;
      this.drag = null;
      d?.ghost?.remove();
      if (!d?.started || u.type === 'pointercancel') return;
      this.suppress = true;
      window.setTimeout(() => (this.suppress = false), 60);
      const under = document.elementFromPoint(u.clientX, u.clientY);
      const slot = under?.closest<HTMLElement>('.pz-slot');
      if (slot?.dataset.slot) this.dropOn(d.id, slot.dataset.slot);
      else if (under?.closest('.pz-bank')) this.dropOn(d.id, 'bank');
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    document.addEventListener('visibilitychange', hide);
  }

  private pieceButton(t: Token, inSlot: boolean): HTMLElement {
    const picked = this.selected === t.id;
    const here = this.slotOf(t.id);
    return h('button', {
      type: 'button',
      class: 'pz-piece' + (inSlot ? ' pz-chip' : ''),
      'data-piece': this.domId[t.id],
      'data-fk': (inSlot ? 'chip:' : 'piece:') + this.domId[t.id],
      'aria-pressed': inSlot ? null : String(picked),
      'aria-label': inSlot ? t.text + ', ở ' + this.label(here as string) + '. Chạm để gỡ.' : null,
    }, t.text);
  }

  private render(focus?: string): void {
    const shelf = this.root.querySelector('.pz-bank')?.scrollTop ?? 0;
    keepFocus(this.root, () => {
      const armed = this.selected !== null;
      const slots = h('ol', { class: 'pz-slots', 'aria-label': 'Bảng đặt mảnh', 'data-armed': String(armed), 'data-row': this.row ? '' : null });
      if (this.row) slots.style.setProperty('--n', String(this.data.slots.length));
      const longWord = (text: string): boolean => text.split(/\s+/u).some((w) => w.length > 5);
      if (this.row && (this.data.slots.some((s) => longWord(s.label)) || this.tokens.some((t) => longWord(t.text)))) slots.dataset.long = '';
      for (const s of this.data.slots) {
        const list = this.content.get(s.id) as string[];
        const names = list.map((id) => this.text(id)).join(', ');
        const chips = h('ul', { class: 'pz-chips' });
        for (const id of list) chips.append(h('li', {}, this.pieceButton(this.byId.get(id) as Token, true)));
        slots.append(h('li', { class: 'pz-slot', 'data-slot': s.id, 'data-filled': String(list.length > 0) },
          h('button', { type: 'button', class: 'pz-slot-btn', 'data-fk': 'slot:' + s.id, 'aria-label': s.label + ': ' + (names || 'trống') }, h('span', { class: 'pz-slot-label' }, s.label)),
          chips));
      }
      const bank = h('ul', { class: 'pz-bank', 'aria-label': 'Mảnh để đặt' });
      for (const t of this.tokens) {
        bank.append(this.slotOf(t.id) ? h('li', { class: 'pz-gap', 'aria-hidden': 'true' }) : h('li', {}, this.pieceButton(t, false)));
      }
      this.root.replaceChildren(slots, bank);
    }, focus);
    if (shelf > 0) (this.root.querySelector('.pz-bank') as HTMLElement).scrollTop = shelf;
  }
}
