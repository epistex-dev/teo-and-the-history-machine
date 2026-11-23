import { css } from '../palette.ts';
import { PlateMachineView, PropView, type MachineLike } from './machine.ts';
import { boxCss, fitPlate, spriteBox, stepBack, type Backdrop, type ChapterStage, type Fit, type Orientation, type PlateLayout, type Rect } from './stage.ts';
import { CAST, type CastName, type MachineFlag, type Pose, type PoseRoot, type View } from './types.ts';

const FALLBACK = { color: 'night', ground: 'ink' } as const;
const TAP_SLOP = 10;
/** Design units from the seated Tèo's soles to the origin of his sprite; the sit frame is lifted by it so `at` and the default root both name where his feet touch. */
const SIT_SOLES = 55;
/** Height of a figure on the plain stage (no art), as a fraction of the stage unit `--u`. */
const PLAIN_SCALE = { teo: 1, 'cuc-cu': 0.8, 'qua-don': 0.95 } as const;
const modified = (event: MouseEvent | KeyboardEvent): boolean => event.ctrlKey || event.altKey || event.metaKey;

export interface CastMember {
  name: CastName;
  expr: string;
  view?: View;
  /** Tèo only: the engraved pose of the body sprite (stand is the plain `teo-<view>` sheet). */
  pose?: Pose;
  /** Tèo only: per-orientation root override from the @pose directive, on the plate. */
  atRoot?: PoseRoot | null;
}

export interface LineView {
  kind: 'say' | 'narr' | 'stamp';
  speaker: string;
  expr: string | null;
  text: string;
}

interface Figure {
  box: HTMLElement;
  img: HTMLImageElement;
  /** The expression layer over the body (Tèo's face marks, a bird's head). */
  face: HTMLImageElement;
  member: CastMember;
}

const kept = new Map<string, HTMLImageElement>();

/** Holds one image per URL so a figure rebuilt for the next scene is served from memory, not requested again. */
function keep(url: string): HTMLImageElement {
  let img = kept.get(url);
  if (!img) kept.set(url, (img = Object.assign(new Image(), { src: url })));
  return img;
}

/** The line box sets the height the art is fitted to, so the story stays hidden until the page fonts are in (or 2.5 s have passed) and the art never jumps when they arrive. */
export const fontsReady: Promise<void> = Promise.race([
  Promise.all([...document.fonts].map((face) => face.load())).then(() => undefined),
  new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
]).catch(() => undefined);

const loaded = (url: string): boolean => keep(url).complete && keep(url).naturalWidth > 0;
const decoded = (url: string): Promise<boolean> => keep(url).decode().then(() => true, () => false);

export class StoryView {
  readonly root: HTMLElement;
  private readonly cast: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly backdropLandscape: HTMLSourceElement;
  private readonly backdropPortrait: HTMLImageElement;
  private readonly dialogue: HTMLElement;
  private readonly speaker: HTMLElement;
  private readonly text: HTMLElement;
  private readonly live: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly advance: HTMLButtonElement;
  private readonly askBox: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly done: HTMLButtonElement;
  private readonly figures = new Map<CastName, Figure>();
  private machine: MachineLike = new PlateMachineView({}, { frame: [0, 0, 1, 1], layers: {}, pivot: {} });
  private machineOf: ChapterStage['plate'] | null = null;
  /** Tèo's pose on the art stage: set per scene from the script's @pose beats, shown on every Tèo figure. */
  private teoPose: { pose: Pose; at: PoseRoot | null } = { pose: 'stand', at: null };
  private machineAt: PoseRoot | null = null;
  private plateLayout: { portrait: PlateLayout; landscape: PlateLayout } | null = null;
  private readonly props = new Map<string, PropView>();
  /** Props placed on the art itself (the manger on the hillside, the lit patch on the wall); it has the backdrop's box and sits under the cast. */
  private readonly scenery = document.createElement('div');
  private composing = false;
  private stage: ChapterStage = { backdrops: {}, props: {} };
  private bg = 'night';
  private fit: (Fit & { orientation: Orientation }) | null = null;
  private typing: { timer: number; full: string } | null = null;
  textDelay = 0;

  constructor(root: HTMLElement) {
    const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`) as T;
    this.root = root;
    this.cast = $('cast');
    this.backdrop = $('backdrop');
    this.backdropLandscape = $<HTMLSourceElement>('backdrop-landscape');
    this.backdropPortrait = $<HTMLImageElement>('backdrop-portrait');
    this.scenery.className = 'scenery';
    this.backdrop.after(this.scenery);
    this.dialogue = root.querySelector<HTMLElement>('.dialogue') as HTMLElement;
    this.speaker = $('speaker');
    this.text = $('line');
    this.live = $('live');
    this.caption = $('plate-caption');
    this.advance = $<HTMLButtonElement>('advance');
    this.askBox = $('ask');
    this.input = $<HTMLInputElement>('name');
    this.done = $<HTMLButtonElement>('name-done');
    this.input.addEventListener('compositionstart', () => (this.composing = true));
    this.input.addEventListener('compositionend', () => (this.composing = false));
    const relayout = () => this.relayout();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(relayout);
      observer.observe(root);
      observer.observe(this.dialogue);
    }
    addEventListener('resize', relayout);
  }

  onAdvance(callback: () => void): void {
    let pressedAt: { x: number; y: number } | null = null;
    this.root.addEventListener('pointerdown', (event) => {
      pressedAt = { x: event.clientX, y: event.clientY };
    });
    this.root.addEventListener('click', (event) => {
      if (!this.askBox.hidden || (event.target as Element).closest('#ask')) return;
      const from = pressedAt;
      pressedAt = null;
      if (modified(event)) return;
      if (event.detail > 0 && from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP) return;
      callback();
    });
    document.addEventListener('keydown', (event) => {
      const target = event.target as HTMLElement | null;
      if (event.repeat && event.key === 'Enter' && target?.tagName === 'BUTTON') event.preventDefault();
      if (event.repeat || modified(event) || this.root.hidden || !this.askBox.hidden || event.isComposing || document.querySelector('dialog[open]')) return;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      const native = target?.tagName === 'BUTTON' && (event.key === 'Enter' || event.key === ' ');
      if (native || !['Enter', ' ', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      callback();
    });
  }

  get hidden(): boolean {
    return this.root.hidden === true;
  }

  set hidden(value: boolean) {
    this.root.hidden = value;
    if (!value) {
      this.advance.focus({ preventScroll: true });
      this.relayout();
      this.root.style.visibility = 'hidden';
      void fontsReady.then(() => {
        this.root.style.visibility = '';
        this.relayout();
      });
    }
  }

  get asking(): boolean {
    return !this.askBox.hidden;
  }

  get typingNow(): boolean {
    return this.typing !== null;
  }

  /** Shows the rest of a line that is still being typed; true when it was typing. */
  finishTyping(): boolean {
    if (!this.typing) return false;
    window.clearInterval(this.typing.timer);
    this.text.textContent = this.typing.full;
    this.typing = null;
    this.live.removeAttribute('aria-busy');
    return true;
  }

  /** The backdrops and props the chapter on screen can use; an id it lacks shows plain night. Tèo's normal pose and face start loading here, before the first backdrop is set, so a slow cold load does not show the room without him. */
  setStage(stage: ChapterStage | undefined): void {
    this.stage = stage ?? { backdrops: {}, props: {} };
    for (const name of ['teo-front', 'teo-front-face-normal']) {
      const url = this.stage.plate?.sprites[name];
      if (url) void decoded(url);
    }
  }

  /** Fetches and decodes every figure sprite of the chapter (all faces and heads, the other views); the first tap calls it, so the first screen loads only what it shows. */
  warm(): void {
    for (const [name, url] of Object.entries(this.stage.plate?.sprites ?? {})) if (/^(teo|cuccu|quado)-/.test(name)) void decoded(url);
    for (const p of Object.values(this.stage.props)) if (p.scenery) keep(p.src);
  }

  /** Starts fetching the backdrops of a chapter that is not on screen yet, in the orientation the player holds; nothing waits on them. */
  preloadStage(stage: ChapterStage | undefined): void {
    const landscape = matchMedia('(orientation: landscape)').matches;
    for (const b of Object.values(stage?.backdrops ?? {})) keep(landscape ? b.art.landscape : b.art.portrait);
    for (const p of Object.values(stage?.props ?? {})) if (p.scenery) keep(p.src);
  }

  get plate(): string | null {
    return this.caption.hidden ? null : this.caption.textContent;
  }

  setPlate(text: string | null): void {
    this.caption.hidden = !text;
    this.caption.textContent = text ?? '';
  }

  setBackdrop(id: string | null): void {
    const b: Pick<Backdrop, 'color' | 'ground'> & Partial<Backdrop> = (id && this.stage.backdrops[id]) || FALLBACK;
    this.useMachine();
    this.bg = b.color;
    this.root.style.setProperty('--bg', css(b.color));
    this.root.style.setProperty('--ground', css(b.ground));
    this.root.dataset.bg = id ?? '';
    this.backdrop.hidden = !b.art;
    this.scenery.hidden = !b.art;
    this.plateLayout = this.stage.plate && b.plate ? b.plate : null;
    this.root.dataset.stage = this.plateLayout ? 'art' : 'flat';
    this.root.dataset.art = this.plateLayout ? 'plate' : '';
    if (b.art) {
      this.backdropLandscape.srcset = b.art.landscape;
      this.backdropPortrait.src = b.art.portrait;
    }
    this.machine.root.hidden = !this.plateLayout;
    for (const f of this.figures.values()) this.paintPlate(f);
    this.relayout();
  }

  get background(): string {
    return this.bg;
  }

  setMachine(flags: MachineFlag[], at: PoseRoot | null = null): void {
    this.machineAt = at;
    this.machine.set(flags);
    this.relayout();
  }

  /** Puts Tèo in one of the engraved poses (and optionally moves his feet); repaints the figures already on stage. */
  setPose(pose: { pose: Pose; at: PoseRoot | null }): void {
    this.teoPose = pose;
    if (!this.stage.plate) return;
    for (const f of this.figures.values()) {
      if (f.member.name !== 'Tèo') continue;
      f.member = { ...f.member, pose: pose.pose, atRoot: pose.at };
      f.box.dataset.pose = pose.pose;
      this.paintPlate(f);
      if (this.fit && this.plateLayout) this.placeFigure(f, this.plateLayout[this.fit.orientation], this.fit);
    }
  }

  setProp(id: string, on: boolean): void {
    const have = this.props.get(id);
    if (!on) {
      have?.root.remove();
      this.props.delete(id);
      return;
    }
    const art = this.stage.props[id];
    if (have || !art) return;
    const [, , fw, fh] = (this.stage.plate as NonNullable<ChapterStage['plate']>).geometry.machine.frame;
    const sprite = new PropView(id, art, art.scenery ? (o) => this.plateLayout?.[o].size ?? [1, 1] : () => [fw, fh]);
    this.props.set(id, sprite);
    (art.scenery ? this.scenery : this.machine.root).append(sprite.root);
    sprite.place(this.fit?.orientation ?? this.orientation());
  }

  /** The machine is built from the sprites of the chapter on screen; a new chapter's stage brings a new one. */
  private useMachine(): void {
    const plate = this.stage.plate ?? null;
    if (plate === this.machineOf) return;
    this.machineOf = plate;
    const next = new PlateMachineView(plate?.sprites ?? {}, plate?.geometry.machine ?? { frame: [0, 0, 1, 1], layers: {}, pivot: {} });
    next.set(this.machine.state);
    this.machine.root.replaceWith(next.root);
    this.machine = next;
    for (const sprite of this.props.values()) sprite.root.remove();
    this.props.clear();
  }

  resetCast(): void {
    this.cast.replaceChildren(this.machine.root);
    this.figures.clear();
    for (const sprite of this.props.values()) sprite.root.remove();
    this.props.clear();
    this.machine.set([]);
  }

  private orientation(): Orientation {
    return this.root.clientWidth > this.root.clientHeight ? 'landscape' : 'portrait';
  }

  /** Art stage: the backdrop, machine and cast share one scale so the feet stand on the art's ground line. */
  relayout(): void {
    const plate = this.plateLayout;
    if (!plate || this.root.hidden) {
      this.fit = null;
      return;
    }
    const orientation = this.orientation();
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    if (w === 0 || h === 0) return;
    const dialogue = this.dialogue.offsetHeight + parseFloat(getComputedStyle(this.dialogue).marginBottom || '0');
    const spec = plate[orientation];
    const fit = fitPlate(spec, w, h, dialogue);
    this.fit = { ...fit, orientation };
    this.backdrop.style.cssText = boxCss({ left: fit.ox, top: fit.oy, width: fit.width, height: fit.height });
    this.scenery.style.cssText = this.backdrop.style.cssText;
    const geometry = (this.stage.plate as NonNullable<ChapterStage['plate']>).geometry;
    this.machine.root.style.cssText = spriteBox(fit, geometry.machine.frame, this.machineAt?.[orientation] ?? spec.machine.origin, spec.machine.scale);
    for (const prop of this.props.values()) prop.place(orientation);
    for (const f of this.figures.values()) this.placeFigure(f, spec, this.fit);
  }

  private spriteSpec(name: CastName, spec: PlateLayout, member?: CastMember, orientation?: Orientation): { frame: Rect; at: PlateLayout['teo'] } {
    const dir = CAST[name].dir as 'teo' | 'cuccu' | 'quado';
    const geo = (this.stage.plate as NonNullable<ChapterStage['plate']>).geometry[dir];
    const at = { ...spec[dir] };
    const root = name === 'Tèo' ? member?.atRoot?.[orientation ?? 'portrait'] : null;
    if (root) at.root = root;
    const pose = name === 'Tèo' ? member?.pose ?? this.teoPose.pose : 'stand';
    const posed = pose !== 'stand' ? (geo as typeof geo & { poses?: Record<string, { frame: Rect }> }).poses?.[pose] : undefined;
    const frame = posed?.frame ?? geo.frame;
    return { frame: pose === 'sit' ? [frame[0], frame[1] - SIT_SOLES, frame[2], frame[3]] : frame, at };
  }

  private placeFigure(f: Figure, spec: PlateLayout, fit: Fit & { orientation: Orientation }): void {
    const { frame, at } = this.spriteSpec(f.member.name, spec, f.member, fit.orientation);
    f.box.style.cssText = spriteBox(fit, frame, at.root, at.scale);
  }

  /** Body sprite plus the expression layer; an expression the chapter has no sprite for shows the normal one. */
  private paintPlate(f: Figure): void {
    if (!this.stage.plate) return;
    const { sprites, geometry } = this.stage.plate;
    const spec = CAST[f.member.name];
    const turned = f.member.view === 'side' ? 'three-quarter' : (f.member.view ?? 'front');
    const teo = spec.key === 'teo';
    const pose = teo ? f.member.pose ?? this.teoPose.pose : 'stand';
    const body = teo ? (pose === 'stand' ? `teo-${turned}` : `teo-${turned}-${pose}`) : `${spec.dir}-body`;
    const layer = (expr: string): string => (teo ? `teo-${turned}-face-${expr}` : `${spec.dir}-head-${expr}`);
    const face = sprites[layer(f.member.expr)] ? layer(f.member.expr) : layer('normal');
    f.box.dataset.view = teo ? turned : 'front';
    const urls = [sprites[body] ?? '', sprites[face] ?? ''] as const;
    const show = (): void => {
      f.img.src = urls[0];
      f.face.src = urls[1];
      f.img.hidden = f.face.hidden = false;
    };
    const want = (f.box.dataset.want = urls.join('|'));
    if (!f.img.hidden || urls.every(loaded)) show();
    else void Promise.all(urls.map(decoded)).then((ok) => ok.every(Boolean) && f.box.dataset.want === want && show());
    if (teo) {
      const poses = (geometry.teo as typeof geometry.teo & { poses?: Record<string, { frame: Rect; face: Rect }> }).poses;
      const g = (pose !== 'stand' ? poses?.[pose] : undefined) ?? geometry.teo;
      const [fx, fy, fw, fh] = g.frame;
      const [x, y, w, h] = g.face;
      f.face.style.cssText = `inset:auto;left:${((x - fx) / fw) * 100}%;top:${((y - fy) / fh) * 100}%;width:${(w / fw) * 100}%;height:${(h / fh) * 100}%`;
    }
  }

  showLine(line: LineView, shown: CastMember[]): void {
    this.askBox.hidden = true;
    const cast = this.plateLayout && !shown.some((m) => m.name === 'Tèo') ? [{ name: 'Tèo' as const, expr: 'normal' }, ...shown] : shown;
    for (const member of cast) this.place(member, member.name === line.speaker);
    const label = line.kind === 'narr' ? '' : line.speaker;
    this.speaker.textContent = label;
    this.speaker.hidden = label === '';
    this.root.dataset.kind = line.kind;
    this.finishTyping();
    if (this.textDelay <= 0 || line.text.length === 0) this.text.textContent = line.text;
    else this.typeOut(line.text);
    this.relayout();
  }

  private typeOut(full: string): void {
    const graphemes = Array.from(full);
    let shown = 0;
    this.text.textContent = '';
    this.live.setAttribute('aria-busy', 'true');
    const timer = window.setInterval(() => {
      shown += 1;
      this.text.textContent = graphemes.slice(0, shown).join('');
      if (shown >= graphemes.length) {
        window.clearInterval(timer);
        this.typing = null;
        this.live.removeAttribute('aria-busy');
      }
    }, this.textDelay);
    this.typing = { timer, full };
  }

  private place(member: CastMember, active: boolean): void {
    const spec = CAST[member.name];
    let f = this.figures.get(member.name);
    if (!f) {
      const box = document.createElement('div');
      box.className = 'figure';
      box.dataset.who = spec.key;
      box.style.setProperty('--scale', String(PLAIN_SCALE[spec.key]));
      const img = document.createElement('img');
      img.className = 'pose';
      img.alt = '';
      img.draggable = false;
      img.hidden = true;
      const face = document.createElement('img');
      face.className = 'face';
      face.alt = '';
      face.draggable = false;
      face.hidden = true;
      box.append(img, face);
      this.cast.append(box);
      f = { box, img, face, member };
      this.figures.set(member.name, f);
    }
    f.member = member.name === 'Tèo' ? { ...member, pose: this.teoPose.pose, atRoot: this.teoPose.at } : member;
    f.box.dataset.expr = member.expr;
    f.box.dataset.pose = member.name === 'Tèo' ? this.teoPose.pose : '';
    f.box.dataset.active = active ? '1' : '0';
    this.paintPlate(f);
    if (this.fit && this.plateLayout) this.placeFigure(f, this.plateLayout[this.fit.orientation], this.fit);
  }

  ask(initial: string, submit: (raw: string) => void): void {
    this.finishTyping();
    this.speaker.hidden = true;
    this.askBox.hidden = false;
    this.input.value = initial;
    this.composing = false;
    const send = () => submit(this.input.value);
    this.done.onclick = send;
    this.input.onkeydown = (event) => {
      if (event.key !== 'Enter') return;
      if (event.isComposing || event.keyCode === 229 || this.composing) return;
      event.preventDefault();
      send();
    };
    this.input.focus({ preventScroll: true });
    this.relayout();
  }

  closeAsk(): void {
    this.askBox.hidden = true;
    this.advance.focus({ preventScroll: true });
    this.relayout();
  }

  describeCast(): { name: string; expr: string; view: string; box: { left: number; top: number; width: number; height: number; feet: number } | null }[] {
    const stage = this.root.getBoundingClientRect();
    return [...this.figures].map(([name, f]) => {
      const r = f.box.getBoundingClientRect();
      return {
        name,
        expr: f.box.dataset.expr ?? '',
        view: f.box.dataset.view ?? 'front',
        pose: f.box.dataset.pose || 'stand',
        box: this.fit ? { left: r.left - stage.left, top: r.top - stage.top, width: r.width, height: r.height, feet: this.feetY(name) } : null,
      };
    });
  }

  private feetY(name: CastName): number {
    if (this.fit && this.plateLayout) {
      const f = this.figures.get(name);
      const { at } = this.spriteSpec(name, this.plateLayout[this.fit.orientation], f?.member, this.fit.orientation);
      return this.fit.oy + stepBack(this.fit, at.root)[1] * this.fit.k;
    }
    return 0;
  }

  describeStage(): { machine: string[]; props: string[]; machineBox: { left: number; top: number; right: number; bottom: number } | null; dialogueTop: number; ground: number | null } {
    const stage = this.root.getBoundingClientRect();
    const m = this.machine.root.getBoundingClientRect();
    return {
      machine: this.machine.state,
      props: [...this.props.keys()],
      machineBox: this.fit ? { left: m.left - stage.left, top: m.top - stage.top, right: m.right - stage.left, bottom: m.bottom - stage.top } : null,
      dialogueTop: this.dialogue.getBoundingClientRect().top - stage.top,
      ground: this.fit ? this.fit.groundY : null,
    };
  }
}
