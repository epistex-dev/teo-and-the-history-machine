import { bankOrder, helpAnswer, model, reply, toState } from 'virtual:puzzle-core';
import './puzzle.css';
import { play } from '../audio.ts';
import type { MinigameDef, MinigameHandle, MinigameStart } from '../minigame.ts';
import type { SafeStorage } from '../storage.ts';
import { ConclusionBoard } from './conclusion.ts';
import { h } from './dom.ts';
import { EvidenceBoard } from './evidence-board.ts';
import { PieceBoard } from './piece-board.ts';
import type { Cell, PuzzleData, Reply } from './types.ts';

const COOLDOWN_MS = 250;
const SETTLE_PX = 56;
const NUDGE_AFTER = 3;
const STAMPS: Record<string, string> = { 'SỰ THẬT': 'SỰ THẬT', 'TRANH CÃI': 'TRANH CÃI', 'TRUYỀN THUYẾT': 'TRUYỀN THUYẾT' };

type Phase = 'predict' | 'demo' | 'board' | 'reveal' | 'conclusion' | 'verdict';

const DEMO_HINT = 'Đọc các thẻ trước. Chạm một mảnh, rồi chạm ô nó thuộc về. Đặt xong thì bấm Kiểm tra.';

/** Draws one puzzle into the stage: predict, an optional throwaway example, the board with its hints, the reveal, and for the ending the conclusion sentence. */
const KEY = (id: string): string => 'teo:v1:puzzle:' + id;
const RESUME: Phase[] = ['predict', 'demo', 'board', 'reveal', 'conclusion'];

class Player {
  private readonly root: HTMLElement;
  private readonly scroll: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly verdictEl: HTMLElement;
  private readonly hintEl: HTMLElement;
  private readonly live: HTMLElement;
  private readonly check: HTMLButtonElement;
  private readonly hint: HTMLButtonElement;
  private phase: Phase = 'predict';
  private board: PieceBoard | null = null;
  private evidence: EvidenceBoard | null = null;
  private dock: HTMLButtonElement | null = null;
  private sheetFrom = 0;
  private conclusion: ConclusionBoard | null = null;
  private data: PuzzleData;
  private demoSolved = false;
  private found = new Set<string>();
  private demoFound = new Set<string>();
  private predicted: number | null = null;
  private opened = 0;
  private checks = 0;
  private wrongRun = 0;
  private wrongTotal = 0;
  private verdict = '';
  private hintText = '';
  private nudge = false;
  private last: Record<string, number> = {};
  private tapped: { x: number; y: number; t: number } | null = null;
  private guard: { x: number; y: number; t: number } | null = null;
  private readonly store: SafeStorage;
  private restoring = false;
  private completed = false;
  private cWrong = 0;
  /** The last hint tier solved the current step, so its result screen credits Cúc Cu. */
  private helped = false;

  constructor(data: PuzzleData, private readonly o: MinigameStart) {
    this.data = data;
    this.store = o.storage;
    this.scroll = h('div', { class: 'pz-scroll' });
    this.verdictEl = h('p', { class: 'pz-verdict' });
    this.hintEl = h('p', { class: 'pz-hint' });
    this.check = h('button', { type: 'button', id: 'pz-check', class: 'pz-check' }, 'Kiểm tra');
    this.hint = h('button', { type: 'button', id: 'pz-hint', class: 'pz-hint-btn quiet' }, 'Gợi ý');
    this.bar = h('div', { class: 'pz-bar' }, h('div', { class: 'pz-msgs', 'aria-live': 'polite', role: 'status' }, this.verdictEl, this.hintEl), h('div', { class: 'pz-actions' }, this.check, this.hint));
    this.live = h('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    this.root = h('div', { class: 'pz', 'data-puzzle': data.id }, this.scroll, this.bar, this.live);
    for (const b of [this.check, this.hint]) b.addEventListener('keydown', (e) => { if (e.repeat) e.preventDefault(); });
    this.root.addEventListener('click', (e) => this.settle(e), true);
    this.check.addEventListener('click', () => this.onCheck());
    this.hint.addEventListener('click', () => this.onHint());
    o.canvasParent.append(this.root);
    o.ui.setHint('');
    o.ui.setHelp(false);
    this.begin();
  }

  /** A double tap or a held key counts once: the same control answers again only after a short pause. */
  private cooled(key: string): boolean {
    const now = performance.now();
    if (now - (this.last[key] ?? -Infinity) < COOLDOWN_MS) return false;
    this.last[key] = now;
    return true;
  }

  /** A second tap on the spot of the tap that just changed the screen lands on the old control's place, not on what the new screen drew there. */
  private settle(e: MouseEvent): void {
    if (e.detail === 0) return;
    const now = performance.now();
    const g = this.guard;
    if (g && now - g.t < COOLDOWN_MS && Math.hypot(e.clientX - g.x, e.clientY - g.y) < SETTLE_PX) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    this.guard = null;
    this.tapped = { x: e.clientX, y: e.clientY, t: now };
  }

  /** Everything a reload must bring back; the board's own placements and the conclusion's fills ride along. */
  private persist(): void {
    if (this.completed || this.restoring || this.phase === 'verdict') return;
    const saved = { phase: this.phase, predicted: this.predicted, opened: this.opened, wrongRun: this.wrongRun, wrongTotal: this.wrongTotal, checks: this.checks, found: [...this.found], cWrong: this.cWrong, board: this.board?.cells() ?? null, fills: this.conclusion?.indices() ?? null, pointed: this.evidence?.pointed() ?? [], nudge: this.nudge };
    this.store.setItem(KEY(this.data.id), JSON.stringify(saved));
  }

  private restore(): boolean {
    let s: Record<string, unknown> | null = null;
    try {
      s = JSON.parse(this.store.getItem(KEY(this.data.id)) ?? 'null');
    } catch {
      s = null;
    }
    const d = this.data;
    const phase = s?.phase as Phase;
    if (!s || typeof s !== 'object' || !RESUME.includes(phase)) return false;
    if ((phase === 'predict' && !d.predict) || (phase === 'demo' && !d.demo) || (phase === 'conclusion' && !d.conclusion)) return false;
    const num = (v: unknown, max: number): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? (v as number) : 0);
    this.predicted = d.predict && Number.isInteger(s.predicted) && (s.predicted as number) >= 0 && (s.predicted as number) < d.predict.options.length ? (s.predicted as number) : null;
    this.opened = num(s.opened, this.tiersFor(phase).length);
    this.wrongRun = num(s.wrongRun, 999);
    this.wrongTotal = num(s.wrongTotal, 9999);
    this.checks = num(s.checks, 9999);
    this.cWrong = num(s.cWrong, 9999);
    this.helped = (phase === 'reveal' || phase === 'conclusion') && this.tiersFor(phase).slice(0, this.opened).some((t) => t.solves);
    const solutions = new Set(d.solutions.map((sol) => toState(d, sol).join(',')));
    this.found = new Set(Array.isArray(s.found) ? s.found.filter((f): f is string => typeof f === 'string' && solutions.has(f)) : []);
    this.restoring = true;
    this.show(phase);
    this.restoring = false;
    if (phase === 'board' && this.board) {
      const cap = model(d).cap;
      const ids = new Set(d.tokens.map((t) => t.id));
      const used = new Set<string>();
      const saved = Array.isArray(s.board) ? s.board : [];
      const cells = d.slots.map((_, i) => {
        const list = ([] as unknown[]).concat(saved[i] ?? []).filter((id): id is string => typeof id === 'string' && ids.has(id) && !used.has(id)).slice(0, cap[i] ?? 1);
        list.forEach((id) => used.add(id));
        return list;
      });
      this.board.fill(cells);
      const cards = new Set(d.cards.map((c) => c.id));
      this.pointCards(Array.isArray(s.pointed) ? s.pointed.filter((id): id is string => typeof id === 'string' && cards.has(id)) : []);
    }
    if (phase === 'conclusion') this.conclusion?.restore(s.fills);
    const tiers = this.tiersFor(phase);
    if (this.opened && tiers.length) this.setHint(this.hintOf(this.opened, tiers));
    this.nudge = s.nudge === true && this.wrongRun >= NUDGE_AFTER && this.opened < tiers.length && (phase === 'board' || phase === 'conclusion');
    this.syncButtons();
    this.persist();
    return true;
  }

  private begin(): void {
    if (this.restore()) return;
    if (this.data.predict) this.show('predict');
    else if (this.data.demo) this.show('demo');
    else this.show('board');
  }

  private say = (text: string): void => {
    this.live.textContent = '';
    window.setTimeout(() => (this.live.textContent = text), 20);
  };

  private setVerdict(text: string): void {
    this.verdict = text;
    this.verdictEl.textContent = text;
  }

  private setHint(text: string): void {
    this.hintText = text;
    this.hintEl.textContent = text;
  }

  private hooks = { say: (t: string) => this.say(t), tone: (kind: 'place' | 'remove') => play(kind), changed: () => { if (this.verdict) this.setVerdict(''); this.nudge = false; this.helped = false; this.syncButtons(); this.persist(); } };

  private show(phase: Phase): void {
    this.phase = phase;
    this.root.dataset.phase = phase;
    this.scroll.replaceChildren();
    this.scroll.scrollTop = 0;
    this.dock?.remove();
    this.dock = null;
    this.setVerdict('');
    this.setHint('');
    this.nudge = false;
    this.guard = this.tapped && performance.now() - this.tapped.t < 100 ? this.tapped : null;
    this.board = null;
    this.evidence = null;
    if (phase !== 'verdict') this.conclusion = null;
    this.bar.hidden = phase === 'predict' || phase === 'reveal' || phase === 'verdict';
    if (phase === 'predict') this.drawPredict();
    else if (phase === 'demo') this.drawBoard(true);
    else if (phase === 'board') this.drawBoard(false);
    else if (phase === 'reveal') this.drawReveal();
    else if (phase === 'conclusion') this.drawConclusion();
    else this.drawVerdict();
    this.syncButtons();
    this.persist();
    this.scroll.querySelector<HTMLElement>('[data-first]')?.focus({ preventScroll: true });
  }

  private head(title: string, question: string): HTMLElement {
    return h('header', { class: 'pz-head' },
      h('p', { class: 'pz-kicker' }, 'Câu đố'),
      h('h2', { class: 'pz-title', tabindex: '-1', 'data-first': '' }, title),
      h('p', { class: 'pz-question' }, question));
  }

  private rules(exclude?: { text: string }): HTMLElement {
    const list = h('ul', { class: 'pz-rule-list' });
    for (const r of this.data.rules) {
      if (r !== exclude) list.append(h('li', {}, r.text));
    }
    return h('details', { class: 'pz-rules' }, h('summary', {}, 'Luật chơi'), list);
  }

  private drawPredict(): void {
    const p = this.data.predict as NonNullable<PuzzleData['predict']>;
    const list = h('ul', { class: 'pz-options' });
    p.options.forEach((text, i) => {
      const b = h('button', { type: 'button', id: 'pz-option-' + i, class: 'pz-option quiet', 'data-option': i }, text);
      b.addEventListener('click', () => {
        if (this.phase !== 'predict' || !this.cooled('predict')) return;
        this.predicted = i;
        this.show(this.data.demo ? 'demo' : 'board');
      });
      list.append(h('li', {}, b));
    });
    this.scroll.append(h('div', { class: 'pz-left' }, this.head(this.data.title, this.data.question)),
      h('div', { class: 'pz-right' }, h('p', { class: 'pz-prompt' }, p.prompt), h('p', { class: 'pz-note' }, 'Chạm một ô để đoán trước. Lời đoán không ai chấm.'), list));
  }

  private drawBoard(demo: boolean): void {
    const d = this.data;
    const src = demo && d.demo ? { ...d.demo, id: d.id + '-demo' } : d;
    this.board = new PieceBoard(src as never, this.hooks, d.input === 'assign' && src.slots.length <= 4);
    this.evidence = new EvidenceBoard(src.cards, demo ? 'Thẻ của ví dụ' : 'Thẻ bằng chứng');
    const top = h('div', { class: 'pz-top' }, this.head(demo ? 'Làm quen' : d.title, demo && d.demo ? d.demo.question : d.question));
    if (demo) {
      const skip = h('button', { type: 'button', id: 'pz-skip', class: 'pz-skip quiet' }, 'Bỏ qua ví dụ');
      skip.addEventListener('click', () => {
        if (this.phase === 'demo' && this.cooled('skip')) this.show('board');
      });
      top.append(skip);
    } else {
      const kept = d.solutions.some((sol) => d.tokens.some((t) => !sol.flat().includes(t.id)));
      if (kept) top.append(h('p', { class: 'pz-note pz-unplaced' }, 'Không cần đặt hết các mảnh: mảnh nào không hợp thì để lại trong hộp.'));
      const capRule = d.rules.find((r) => /(?:nhiều nhất|tối đa)\s*(?:hai|\d+)\s*mảnh/i.test(r.text));
      if (capRule) top.append(h('p', { class: 'pz-note pz-cap' }, capRule.text));
      top.append(this.rules(capRule));
    }
    const dock = h('button', { type: 'button', class: 'pz-dock quiet', 'aria-expanded': 'false', 'aria-controls': (this.evidence as EvidenceBoard).root.id }, (demo ? 'Thẻ của ví dụ' : 'Thẻ bằng chứng') + ' · ' + src.cards.length);
    dock.addEventListener('click', () => {
      if ((this.phase === 'board' || this.phase === 'demo') && this.cooled('dock') && this.evidence) this.setSheet(!this.evidence.isOpen());
    });
    this.dock = dock;
    const left = h('div', { class: 'pz-left' }, top, this.evidence.root);
    this.root.insertBefore(dock, this.bar);
    this.scroll.append(left, h('div', { class: 'pz-right' }, this.board.root));
    this.demoSolved = false;
    this.syncButtons();
  }

  /** Opens or closes the portrait evidence sheet and keeps the dock's state in sync; the landscape column ignores it. */
  private setSheet(open: boolean): void {
    if (!this.evidence || this.evidence.isOpen() === open) return;
    if (open) this.sheetFrom = this.scroll.scrollTop;
    this.evidence.setOpen(open);
    this.dock?.setAttribute('aria-expanded', String(open));
    this.scroll.scrollTop = open ? 0 : this.sheetFrom;
  }

  /** A hint or a restored save points at cards: the portrait sheet opens on them; the landscape column scrolls instead. */
  private pointCards(ids: string[]): void {
    if (!this.evidence) return;
    if (ids.length) this.setSheet(true);
    this.evidence.point(ids);
  }

  private drawReveal(): void {
    const r = this.data.reveal;
    const stamp = STAMPS[r.label];
    const echo = this.predicted !== null && this.data.predict ? h('p', { class: 'pz-echo' }, 'Lúc đầu Tèo đoán: ' + (this.data.predict.options[this.predicted] ?? '') + '.') : null;
    const next = h('button', { type: 'button', id: 'pz-next', class: 'pz-next' }, this.data.conclusion ? 'Viết câu kết' : 'Lật trang');
    next.addEventListener('click', () => this.finishReveal());
    this.scroll.append(h('div', { class: 'pz-left pz-reveal' },
      h('p', { class: 'pz-kicker' }, this.helped ? 'Cúc Cu xếp hộ' : 'Khớp rồi'),
      h('h2', { class: 'pz-title', tabindex: '-1', 'data-first': '' }, 'Cúc Cu soi tỏ'),
      echo,
      ...r.lines.map((l) => h('p', { class: 'pz-line' }, l)),
      stamp ? h('span', { class: 'stamp plain', 'data-stamp': stamp }, h('span', { class: 'stamp-text' }, r.label)) : null,
      next));
    this.say((this.helped ? 'Cúc Cu đã xếp hộ cả bảng. ' : 'Khớp mọi thẻ. ') + r.lines.join(' '));
  }

  private drawConclusion(): void {
    const c = this.data.conclusion as NonNullable<PuzzleData['conclusion']>;
    const order = bankOrder({ id: this.data.id + ':conclusion', tokens: c.bank.map((_, i) => ({ id: String(i), text: '', status: 'fact' })), slots: [], cards: [], solutions: [] } as never).map((t) => Number(t.id));
    const ids = bankOrder({ id: this.data.id + ':conclusion:id', tokens: c.bank.map((_, i) => ({ id: String(i), text: '', status: 'fact' })), slots: [], cards: [], solutions: [] } as never).map((t) => Number(t.id));
    this.conclusion = new ConclusionBoard(c, this.hooks, order, ids);
    this.scroll.append(h('div', { class: 'pz-left' }, h('header', { class: 'pz-head' }, h('p', { class: 'pz-kicker' }, 'Câu kết'), h('h2', { class: 'pz-title', tabindex: '-1', 'data-first': '' }, 'Viết câu kết'), h('p', { class: 'pz-question' }, 'Điền mỗi chỗ trống một mảnh. Máy không nói mảnh nào thuộc loại nào: tự phân biệt bằng các thẻ.'))),
      h('div', { class: 'pz-right' }, this.conclusion.root));
  }

  private drawVerdict(): void {
    const labels = (this.conclusion?.labels() ?? []) as (string | null)[];
    const sentence = this.data.conclusion?.template.split('___') ?? [];
    const filled = this.conclusion?.filled() ?? [];
    const p = h('p', { class: 'pz-sentence pz-final' });
    sentence.forEach((part, i) => {
      p.append(part);
      if (i < sentence.length - 1) p.append(h('b', {}, filled[i] ?? ''), ' ', h('span', { class: 'stamp plain', 'data-stamp': STAMPS[labels[i] ?? ''] ?? '' }, h('span', { class: 'stamp-text' }, labels[i] ?? '')));
    });
    const next = h('button', { type: 'button', id: 'pz-next', class: 'pz-next' }, 'Lật trang');
    next.addEventListener('click', () => this.complete());
    this.scroll.append(h('div', { class: 'pz-left pz-reveal' }, h('p', { class: 'pz-kicker' }, this.helped ? 'Câu kết' : 'Câu kết của Tèo'), h('h2', { class: 'pz-title', tabindex: '-1', 'data-first': '' }, this.helped ? 'Cúc Cu viết hộ' : 'Đã khớp'), p, next));
    this.say(this.helped ? 'Cúc Cu đã viết hộ câu kết.' : 'Câu kết đã khớp.');
  }

  private finishReveal(): void {
    if (this.data.conclusion) {
      this.opened = 0;
      this.helped = false;
      this.wrongRun = 0;
      this.cWrong = 0;
      this.show('conclusion');
    }
    else this.complete();
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    this.store.removeItem(KEY(this.data.id));
    this.o.onComplete();
  }

  /** The hint ladder of the board is the puzzle's own; the conclusion has three rungs of its own. */
  private tiers(): { text: string; card?: string; solves?: boolean }[] {
    return this.tiersFor(this.phase);
  }

  private tiersFor(phase: Phase): { text: string; card?: string; solves?: boolean }[] {
    if (phase === 'demo') return [];
    if (phase === 'conclusion') return (this.data.conclusion?.hints ?? []).map((x) => ({ text: x.text, solves: x.solves }));
    return this.data.hints;
  }

  private hintOf(opened: number, tiers: { text: string }[]): string {
    const k = Math.min(opened, tiers.length);
    return 'Gợi ý ' + k + '/' + tiers.length + ': ' + (tiers[k - 1]?.text ?? '');
  }

  private syncButtons(): void {
    const demo = this.phase === 'demo';
    const tiers = this.tiers();
    const used = Math.min(this.opened, Math.max(tiers.length - 1, 0));
    const solves = tiers[used]?.solves === true;
    this.check.textContent = demo && this.demoSolved ? 'Vào câu đố' : 'Kiểm tra';
    this.hint.textContent = solves ? 'Nhờ Cúc Cu soi tỏ' : 'Gợi ý' + (this.opened && !demo ? ' ' + (used + 1) + '/' + tiers.length : '');
    this.hint.dataset.nudge = String(this.nudge);
    this.hint.dataset.next = String(Math.min(used + 1, tiers.length));
    if (solves) this.hint.setAttribute('aria-label', 'Nhờ Cúc Cu soi tỏ: Cúc Cu làm hộ');
    else if (this.opened || demo) this.hint.removeAttribute('aria-label');
    else this.hint.setAttribute('aria-label', 'Gợi ý, bậc 1 trên ' + tiers.length);
  }

  private applyReply(r: Reply, demo: boolean): void {
    if (r.type === 'incomplete') {
      play('wrong');
      return this.setVerdict('Chưa đủ: còn ' + r.empty + ' chỗ chưa có mảnh.');
    }
    if (r.type === 'found') {
      play('solve');
      this.wrongRun = 0;
      return this.setVerdict('Khớp mọi thẻ. Đã tìm được ' + r.n + '/' + r.of + ' cách. Còn cách nào khác cũng khớp không?');
    }
    if (r.type === 'solved') {
      play('solve');
      this.wrongRun = 0;
      if (demo) {
        this.demoSolved = true;
        this.setVerdict('Khớp. Giờ vào câu đố thật.');
        this.syncButtons();
        return;
      }
      return this.show('reveal');
    }
    play('wrong');
    this.checks += demo ? 0 : 1;
    const text = 'Chưa khớp với các thẻ.';
    if (demo) return this.setVerdict(text);
    this.wrongRun += 1;
    this.wrongTotal += 1;
    this.nudge = this.wrongRun >= NUDGE_AFTER && this.opened < this.tiers().length;
    this.setVerdict(this.nudge ? text + ' Đã ' + this.wrongRun + ' lần liền: bấm Gợi ý để mở bậc kế tiếp.' : text);
    this.syncButtons();
    this.persist();
  }

  private onCheck(): void {
    if (!this.cooled('check')) return;
    if (this.phase === 'demo') {
      if (this.demoSolved) return this.show('board');
      const demo = { ...(this.data.demo as NonNullable<PuzzleData['demo']>), id: this.data.id + '-demo' };
      return this.applyReply(reply(demo as never, (this.board as PieceBoard).cells(), this.demoFound), true);
    }
    if (this.phase === 'conclusion') return this.checkConclusion();
    if (this.phase !== 'board') return;
    this.applyReply(reply(this.data, (this.board as PieceBoard).cells(), this.found), false);
  }

  private checkConclusion(): void {
    const c = this.conclusion as ConclusionBoard;
    if (c.empty()) {
      play('wrong');
      return this.setVerdict('Chưa đủ: còn ' + c.empty() + ' chỗ chưa có mảnh.');
    }
    if (c.correct()) {
      play('solve');
      c.lock();
      return this.show('verdict');
    }
    play('wrong');
    this.cWrong += 1;
    this.wrongRun += 1;
    this.wrongTotal += 1;
    this.nudge = this.wrongRun >= NUDGE_AFTER && this.opened < this.tiers().length;
    this.setVerdict(this.nudge ? 'Chưa khớp. Đã ' + this.wrongRun + ' lần liền: bấm Gợi ý để mở bậc kế tiếp.' : 'Chưa khớp.');
    this.syncButtons();
    this.persist();
  }

  private onHint(): void {
    if (!this.cooled('hint')) return;
    if (this.phase === 'demo') {
      play('hint');
      return this.setHint(DEMO_HINT);
    }
    if (this.phase !== 'board' && this.phase !== 'conclusion') return;
    const tiers = this.tiers();
    const tier = tiers[Math.min(this.opened, tiers.length - 1)];
    if (!tier) return;
    if (this.opened < tiers.length) this.opened += 1;
    else if (!tier.solves) return;
    this.wrongRun = 0;
    this.nudge = false;
    this.helped = tier.solves === true;
    this.setVerdict('');
    if (!tier.solves) play('hint');
    this.setHint(this.hintOf(this.opened, tiers));
    if (this.phase === 'board') {
      const pointed = tier.card ? [tier.card] : [];
      this.pointCards(pointed);
      if (tier.solves) {
        const answer = helpAnswer(this.data, this.found) as Cell[];
        (this.board as PieceBoard).fill(answer);
        this.applyReply(reply(this.data, answer, this.found), false);
      }
    } else if (tier.solves) {
      (this.conclusion as ConclusionBoard).solve();
      this.persist();
      this.checkConclusion();
    }
    this.syncButtons();
    this.persist();
  }

  name(): Phase {
    return this.phase;
  }

  describe(): Record<string, unknown> {
    const b = this.board;
    const c = this.conclusion;
    return {
      id: this.data.id,
      kind: 'puzzle',
      manual: this.o.manual,
      phase: this.phase,
      completed: this.completed,
      predicted: this.predicted,
      selected: b?.selected ?? null,
      board: b?.placements() ?? null,
      bank: b?.bankIds() ?? null,
      order: bankOrder(this.data as never).map((t) => t.id),
      checks: this.checks,
      wrong: this.wrongRun,
      wrongTotal: this.wrongTotal,
      hints: this.opened,
      hint: this.hintText,
      verdict: this.verdict,
      nudge: this.nudge,
      pointed: this.evidence?.pointed() ?? [],
      found: this.found.size,
      of: this.data.solutions.length,
      conclusion: c ? { filled: c.filled(), selected: c.selected, empty: c.empty(), wrong: this.cWrong } : null,
      cards: this.data.cards.length,
    };
  }

  destroy(): void {
    this.root.remove();
  }
}

export function createPuzzleMinigame(data: PuzzleData | undefined): MinigameDef {
  return {
    id: data?.id ?? '',
    orientation: 'both',
    start: async (options) => {
      if (!data) return { describe: () => ({}), advance: () => undefined, pause: () => undefined, resume: () => undefined, destroy: () => undefined };
      const player = new Player(data, options);
      const handle: MinigameHandle = {
        describe: () => player.describe(),
        phase: () => player.name(),
        advance: (ms) => {
          if (typeof ms === 'number' && ms > 0) options.onStep(Math.min(ms, 30_000));
        },
        pause: () => undefined,
        resume: () => undefined,
        destroy: () => player.destroy(),
      };
      return handle;
    },
  };
}
