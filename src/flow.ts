import { END_SCENE } from './order.ts';
import { indexOf, loadPuzzle, loadScript, ORDER } from './chapters.ts';
import type { MinigameDef, MinigameHandle, MinigameStart, MinigameUi } from './minigame.ts';
import { cleanName, freshSave, hasProgress, isNewerSave, mergeSave, readSave, SAVE_KEY, type Save } from './save.ts';
import type { SafeStorage } from './storage.ts';
import { actEndedBy, isFrame } from './meta.ts';
import { chunkOrFail, quietly } from './preload-error.ts';
import type { CodeData } from './code.ts';
import { lastBackdrop, machineBefore, propsBefore } from './scene-state.ts';
import type { AutoAdvance } from './settings.ts';
import { AUTO_DELAYS } from './settings.ts';
import { CAST, type Beat, type CastName, type ChapterScript, type MachineFlag, type View } from './story/types.ts';
import type { CastMember, LineView, StoryView } from './story/view.ts';

const ADVANCE_COOLDOWN_MS = 200;
const LOG_MAX = 200;
/** Puzzle progress lives under this prefix plus the puzzle id (src/puzzle/player.ts). */
export const PUZZLE_KEY = 'teo:v1:puzzle:';
const PREVIEW_KEY = 'preview:';
const HELP_NOTE = ' Muốn thì bấm “Nhờ Cúc Cu soi tỏ”.';

export type Mode = 'loading' | 'story' | 'minigame' | 'card' | 'timeline' | 'namecard' | 'code' | 'end';

const SCREENS = ['card', 'timeline', 'namecard', 'code', 'end'] as const;

export interface Screens {
  root: Record<(typeof SCREENS)[number], HTMLElement>;
  card(chapter: string, code: CodeData | null, done: () => void): Promise<void>;
  timeline(done: () => void): void;
  nameCard(name: string, done: () => void): Promise<void>;
  code(data: CodeData, done: () => void): Promise<void>;
  end(name: string): Promise<void>;
  describe(): Record<string, unknown>;
}

export interface StageDom {
  root: HTMLElement;
  canvasParent: HTMLElement;
  hint: HTMLElement;
  help: HTMLButtonElement;
}

export interface FlowOptions {
  storage: SafeStorage;
  view: StoryView;
  stage: StageDom;
  screens: Screens;
  autoAdvance(): AutoAdvance;
  manual: boolean;
  onStatus(text: string): void;
  onFatal(text: string): void;
  onTransition(): void;
  /** The ending's gear board came up: the cards are gears now. */
  onGears(): void;
  onStep(ms: number): void;
}

const inCast = (who: string): who is CastName => who in CAST;

export class Flow {
  mode: Mode = 'loading';
  save: Save = freshSave();
  handle: MinigameHandle | null = null;
  private script: ChapterScript | null = null;
  private pos = { chapter: 'intro', scene: '' };
  private sceneIdx = 0;
  private beatIdx = 0;
  private lineIdx = 0;
  private line: LineView | null = null;
  private cast: CastMember[] = [];
  private bg: string | null = null;
  private nameFromMe = false;
  private lastAdvance = -Infinity;
  private minigame: Promise<MinigameDef | undefined> | null = null;
  private completing = false;
  /** The player has reached the continue code of the last chapter: from here on every code the game shows is the finished one. */
  private finishedSeen = false;
  private loadingGame = false;
  private loadingChapter = false;
  /** Counts enterChapter calls: only the latest one may show its chapter or end the loading state. */
  private entering = 0;
  newerSave = false;
  private helpNote = '';
  private machine: MachineFlag[] = [];
  private views = new Map<CastName, View>();
  private cardShown = false;
  private preloaded = new Set<string>();
  /** Counts new sessions (Chơi mới, a continue code): what a preload of an earlier one brings in is dropped. */
  private session = 0;
  /** The chapter whose card is on screen, so the Sổ nguồn lists it already. */
  cardChapter: string | null = null;
  private autoTimer = 0;
  readonly log: { speaker: string; text: string }[] = [];
  /** Called when a new session starts (Chơi mới, a continue code). */
  onRestart: (() => void) | null = null;

  constructor(private readonly o: FlowOptions) {
    o.view.onAdvance(() => this.advance());
    o.stage.help.addEventListener('keydown', (event) => {
      if (event.repeat) event.preventDefault();
    });
  }

  async start(): Promise<void> {
    const raw = this.o.storage.getItem(SAVE_KEY);
    this.newerSave = isNewerSave(raw);
    this.save = readSave(raw) ?? freshSave();
    if (this.save.scene === END_SCENE && this.save.chapter === ORDER.at(-1)) {
      this.pos = { chapter: this.save.chapter, scene: END_SCENE };
      return this.showEnd();
    }
    await this.enterChapter(this.save.chapter, this.save.scene);
  }

  /** The save holds real progress: a name, a later chapter or scene, or a solved puzzle. */
  get hasProgress(): boolean {
    return hasProgress(this.save, this.sceneOrder(this.save.chapter, this.save.scene));
  }

  advance(): void {
    if (this.mode !== 'story' || this.loadingGame || this.loadingChapter || this.o.view.asking) return;
    const now = performance.now();
    if (now - this.lastAdvance < ADVANCE_COOLDOWN_MS) return;
    this.lastAdvance = now;
    this.warm();
    if (this.o.view.finishTyping()) {
      this.scheduleAuto();
      return;
    }
    this.step();
  }

  private scheduleAuto(): void {
    window.clearTimeout(this.autoTimer);
    const auto = AUTO_DELAYS[this.o.autoAdvance()];
    if (!auto || this.mode !== 'story' || this.o.view.asking || !this.line || this.covered()) return;
    const [base, perChar] = auto;
    this.autoTimer = window.setTimeout(() => {
      if (!this.covered()) this.advance();
    }, base + perChar * this.line.text.length);
  }

  private covered = (): boolean => document.hidden || document.querySelector('dialog[open]') !== null;

  /** Called when the auto-advance setting changes, a dialog closes or the tab shows again while a line is on screen. */
  settingsChanged(): void {
    this.scheduleAuto();
  }

  /** The progress of a puzzle the player has not finished: every puzzle from chapter index `from` on, or all of them for 0. */
  private clearPuzzles(from: number): void {
    if (this.newerSave) return;
    for (const key of this.o.storage.keys(PUZZLE_KEY)) if (from === 0 || indexOf(key.slice(PUZZLE_KEY.length)) >= from) this.o.storage.removeItem(key);
  }

  /** A new session: whatever was still loading for the old one is dropped when it arrives. */
  private leaveGame(): void {
    this.onRestart?.();
    this.entering += 1;
    this.session += 1;
    this.preloaded.clear();
    this.finishedSeen = false;
    this.loadingGame = false;
    this.loadingChapter = false;
    this.handle?.destroy();
    this.handle = null;
  }

  async newGame(): Promise<void> {
    this.leaveGame();
    if (!this.newerSave) this.o.storage.removeItem(SAVE_KEY);
    this.clearPuzzles(0);
    this.save = freshSave();
    this.nameFromMe = false;
    this.log.length = 0;
    await this.enterChapter('intro', '');
  }

  async loadProgress(data: CodeData): Promise<void> {
    this.leaveGame();
    const stored = readSave(this.o.storage.getItem(SAVE_KEY));
    const furthest = [data.furthest, this.save.furthest, stored?.furthest ?? 'intro'].reduce((a, b) => (indexOf(b) > indexOf(a) ? b : a));
    const finished = data.finished === true;
    this.save = { ...freshSave(), name: data.name, chapter: data.chapter, furthest, scene: finished ? END_SCENE : '' };
    this.nameFromMe = true;
    if (!this.newerSave) this.o.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    this.clearPuzzles(indexOf(data.chapter));
    this.log.length = 0;
    if (finished) {
      this.script = null;
      this.minigame = null;
      return this.showEnd();
    }
    await this.enterChapter(data.chapter, '');
  }

  /** What the continue code holds: the finished mark once the player is on the end screen. */
  codeData(): CodeData {
    const { name, chapter, furthest, scene } = this.save;
    return { name, chapter, furthest, finished: scene === END_SCENE || this.finishedSeen };
  }

  /** The ending's gear board is up: the cards are inside the machine as gears, so the Sổ nguồn stays shut until the conclusion. */
  get cardsAreGears(): boolean {
    return this.mode === 'minigame' && this.script?.id === ORDER.at(-1) && ['predict', 'demo', 'board'].includes(this.handle?.phase?.() ?? '');
  }

  pause(): void {
    this.handle?.pause();
  }

  resume(): void {
    this.handle?.resume();
  }

  private show(mode: Mode): void {
    if (mode !== this.mode) this.o.onTransition();
    this.mode = mode;
    this.o.view.hidden = mode !== 'story';
    this.o.stage.root.hidden = mode !== 'minigame';
    for (const key of SCREENS) this.o.screens.root[key].hidden = mode !== key;
    if (mode !== 'story') window.clearTimeout(this.autoTimer);
    if (mode !== 'card') this.cardChapter = null;
  }

  private sceneOrder = (chapter: string, scene: string): number => {
    if (scene === END_SCENE) return Infinity;
    return this.script && this.script.id === chapter ? this.script.scenes.findIndex((s) => s.id === scene) : -1;
  };

  private persist(): void {
    const { chapter, scene } = this.pos;
    const furthest = indexOf(chapter) > indexOf(this.save.furthest) ? chapter : this.save.furthest;
    const mine: Save = { ...this.save, furthest, chapter, scene };
    if (this.newerSave) {
      this.save = mine;
      return;
    }
    const stored = readSave(this.o.storage.getItem(SAVE_KEY));
    this.save = mergeSave(stored, mine, this.sceneOrder, { nameFromMe: this.nameFromMe });
    const ok = this.o.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
    this.o.onStatus(ok ? 'Đã lưu tiến độ.' : 'Chưa lưu được, tiến độ chỉ giữ đến khi đóng trang.');
  }

  private async enterChapter(id: string, sceneId: string): Promise<void> {
    const mine = (this.entering += 1);
    this.pos = { chapter: id, scene: sceneId };
    this.script = null;
    this.minigame = null;
    this.cardShown = false;
    this.show('loading');
    this.loadingChapter = true;
    let script: ChapterScript | null | undefined;
    try {
      script = await chunkOrFail(loadScript(id) as Promise<ChapterScript | undefined>);
    } finally {
      if (mine === this.entering) this.loadingChapter = false;
    }
    if (!script || mine !== this.entering) return;
    this.script = script;
    this.o.view.setStage(script.stage);
    this.enterScene(Math.max(0, script.scenes.findIndex((s) => s.id === sceneId)));
  }

  private enterScene(i: number): void {
    const script = this.script as ChapterScript;
    const scene = script.scenes[i] as ChapterScript['scenes'][number];
    this.sceneIdx = i;
    this.beatIdx = 0;
    this.lineIdx = 0;
    this.line = null;
    this.cast = [];
    this.bg = lastBackdrop(script, i);
    this.pos = { chapter: script.id, scene: scene.id };
    this.persist();
    const view = this.o.view;
    view.resetCast();
    view.setPlate(null);
    view.setBackdrop(this.bg);
    this.machine = machineBefore(script, i);
    this.views.clear();
    view.setMachine(this.machine);
    view.setPose({ pose: 'stand', at: null });
    for (const id of propsBefore(script, i)) view.setProp(id, true);
    this.show('story');
    if (script.scenes.slice(0, i).some((s) => s.beats.some((b) => b.t === 'minigame'))) this.preloadNext();
    this.step();
  }

  private nameOrDefault(): string {
    return this.save.name || 'người đã hỏi';
  }

  private step(): void {
    const script = this.script as ChapterScript;
    const beats = (script.scenes[this.sceneIdx] as ChapterScript['scenes'][number]).beats;
    for (;;) {
      const beat: Beat | undefined = beats[this.beatIdx];
      this.beatIdx += 1;
      if (!beat) return this.nextScene();
      switch (beat.t) {
        case 'bg':
          this.bg = beat.id;
          this.o.view.setBackdrop(beat.id);
          continue;
        case 'plate':
          this.o.view.setPlate(beat.text);
          continue;
        case 'machine':
          this.machine = beat.flags;
          this.o.view.setMachine(beat.flags, beat.at ?? null);
          continue;
        case 'pose':
          this.o.view.setPose(beat);
          continue;
        case 'prop':
          this.o.view.setProp(beat.id, beat.on);
          continue;
        case 'turn':
          this.views.set(beat.who, beat.view);
          if (beat.who !== 'Tèo' && !this.cast.some((m) => m.name === beat.who)) this.cast.push({ name: beat.who, expr: 'normal' });
          this.applyViews();
          continue;
        case 'card':
          void this.showCard(() => this.step());
          return;
        case 'timeline':
          this.show('timeline');
          this.o.screens.timeline(() => this.leaveScreen('timeline'));
          return;
        case 'name-card':
          this.show('namecard');
          void this.o.screens.nameCard(this.nameOrDefault(), () => this.leaveScreen('namecard'));
          return;
        case 'code':
          this.finishedSeen ||= script.id === ORDER.at(-1);
          this.show('code');
          void this.o.screens.code({ ...this.codeData(), chapter: script.id }, () => this.leaveScreen('code'));
          return;
        case 'say':
          this.present({ kind: 'say', speaker: beat.who, expr: beat.expr, text: beat.text }, beat.who);
          return;
        case 'narr':
          this.present({ kind: 'narr', speaker: '', expr: null, text: beat.text }, null);
          return;
        case 'stamp':
          this.present({ kind: 'stamp', speaker: 'Cúc Cu', expr: null, text: `Dấu của Cúc Cu: ${beat.label}` }, null);
          return;
        case 'ask-name':
          this.o.view.ask(this.save.name, (raw) => this.submitName(raw));
          return;
        case 'minigame':
          if (this.save.puzzles?.includes(script.id)) continue;
          void this.runMinigame();
          return;
      }
    }
  }

  private present(line: LineView, who: string | null): void {
    if (who && inCast(who)) {
      const expr = line.expr ?? 'normal';
      const member = this.cast.find((m) => m.name === who);
      if (member) member.expr = expr;
      else this.cast.push({ name: who, expr });
    }
    this.lineIdx += 1;
    this.line = { ...line, text: line.text.replaceAll('{ten}', () => this.nameOrDefault()) };
    this.log.push({ speaker: this.line.speaker, text: this.line.text });
    if (this.log.length > LOG_MAX) this.log.shift();
    for (const m of this.cast) {
      const view = this.views.get(m.name);
      if (view) m.view = view;
    }
    this.o.view.showLine(this.line, this.cast);
    this.scheduleAuto();
  }

  private applyViews(): void {
    for (const m of this.cast) {
      const view = this.views.get(m.name);
      if (view) m.view = view;
    }
  }

  /** A second tap on the button of a screen that is already gone does nothing. */
  private leaveScreen(from: Mode): void {
    if (this.mode !== from) return;
    this.lastAdvance = performance.now();
    this.show('story');
    this.step();
  }

  private async showCard(done: () => void): Promise<void> {
    const script = this.script as ChapterScript;
    this.cardShown = true;
    if (isFrame(script.id)) return done();
    this.show('card');
    this.cardChapter = script.id;
    await this.o.screens.card(script.id, this.cardCode(script.id), () => {
      if (this.mode !== 'card') return;
      this.lastAdvance = performance.now();
      this.show('story');
      done();
    });
  }

  /** The continue code shown with the card that closes an act: it resumes at the start of the next chapter. */
  private cardCode(id: string): CodeData | null {
    const next = ORDER[indexOf(id) + 1];
    if (actEndedBy(id) === null || !next) return null;
    return { name: this.save.name, chapter: next, furthest: indexOf(next) > indexOf(this.save.furthest) ? next : this.save.furthest };
  }

  /** Shows the card of any chapter, for review (?preview=card:<id>); Lật trang returns to where the player was. */
  async previewCard(id: string): Promise<void> {
    if (isFrame(id) || indexOf(id) < 0) return;
    this.show('card');
    this.cardChapter = id;
    await this.o.screens.card(id, this.cardCode(id), () => void this.enterChapter(this.pos.chapter, this.pos.scene));
  }

  /** Opens the puzzle of any chapter that has a puzzle file, for review (?preview=puzzle:<id>); finishing it returns to where the player was. */
  async previewPuzzle(id: string): Promise<void> {
    const def = await loadPuzzle(id);
    if (!def) return;
    const { stage } = this.o;
    stage.hint.textContent = '';
    stage.help.hidden = true;
    this.show('minigame');
    const { storage } = this.o;
    this.handle = await def.start({
      canvasParent: stage.canvasParent,
      storage: {
        ...storage,
        getItem: (key) => storage.getItem(PREVIEW_KEY + key),
        setItem: (key, value) => storage.setItem(PREVIEW_KEY + key, value),
        removeItem: (key) => storage.removeItem(PREVIEW_KEY + key),
        keys: (prefix) => storage.keys(PREVIEW_KEY + prefix).map((key) => key.slice(PREVIEW_KEY.length)),
      },
      ui: this.stageUi(),
      manual: this.o.manual,
      onComplete: () => {
        this.handle?.destroy();
        this.handle = null;
        void this.enterChapter(this.pos.chapter, this.pos.scene);
      },
      onStep: this.o.onStep,
    });
  }

  private submitName(raw: string): void {
    this.save.name = cleanName(raw);
    this.nameFromMe = true;
    this.persist();
    this.o.view.closeAsk();
    this.step();
  }

  private nextScene(): void {
    const script = this.script as ChapterScript;
    if (this.sceneIdx + 1 < script.scenes.length) return this.enterScene(this.sceneIdx + 1);
    if (!this.cardShown && !isFrame(script.id)) return void this.showCard(() => this.nextScene());
    const next = ORDER[indexOf(script.id) + 1];
    if (!next) return this.showEnd();
    void this.enterChapter(next, '');
  }

  private showEnd(): void {
    this.pos = { chapter: ORDER.at(-1) as string, scene: END_SCENE };
    this.persist();
    this.show('end');
    void this.o.screens.end(this.nameOrDefault());
  }

  /** The end screen's "Xem lại thư trả lời": the name card again, then back to the end screen. */
  replayNameCard(): void {
    if (this.mode !== 'end') return;
    this.show('namecard');
    void this.o.screens.nameCard(this.nameOrDefault(), () => this.showEnd());
  }

  /** What the chapter needs later (every figure sprite, the mini game code) is fetched on the first tap, never before it, so the first screen carries none of it. */
  private warm(): void {
    this.o.view.warm();
    if (this.script?.scenes.some((s) => s.beats.some((b) => b.t === 'minigame'))) void this.ensureMinigame();
  }

  /** Once the puzzle is open (or was passed already) and the browser is idle, fetches the next chapter's script chunk and its backdrops so Lật trang finds them in memory. */
  private preloadNext(): void {
    const next = ORDER[indexOf((this.script as ChapterScript).id) + 1];
    if (!next || this.preloaded.has(next)) return;
    this.preloaded.add(next);
    const session = this.session;
    const run = (): void => {
      if (session !== this.session) return;
      void quietly(() => loadScript(next)).then((script) => {
        if (session !== this.session) return;
        if (script) this.o.view.preloadStage(script.stage);
        else this.preloaded.delete(next);
      });
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 300);
  }

  private ensureMinigame(): Promise<MinigameDef | undefined> {
    const id = (this.script as ChapterScript).id;
    this.minigame ??= loadPuzzle(id) ?? Promise.reject(new Error(`Chương ${id} thiếu câu đố`));
    this.minigame.catch(() => undefined);
    return this.minigame;
  }

  private stageUi(): MinigameUi {
    const { hint, help } = this.o.stage;
    let onHelp = () => undefined as void;
    help.onclick = () => onHelp();
    return {
      setHint: (text) => {
        this.helpNote = '';
        hint.textContent = text;
      },
      setHelp: (visible) => {
        help.hidden = !visible;
        if (visible && !this.helpNote) {
          this.helpNote = HELP_NOTE;
          hint.textContent = (hint.textContent ?? '') + HELP_NOTE;
        }
      },
      onHelp: (callback) => {
        onHelp = callback;
      },
    };
  }

  private async runMinigame(): Promise<void> {
    const { stage } = this.o;
    const retry = () => {
      this.beatIdx -= 1;
    };
    const mine = this.entering;
    let def: MinigameDef | undefined;
    this.loadingGame = true;
    try {
      def = await this.ensureMinigame();
    } catch (error) {
      if (mine !== this.entering) return;
      retry();
      this.o.onFatal(`Không tải được câu đố: ${(error as Error).message}`);
      return;
    } finally {
      if (mine === this.entering) this.loadingGame = false;
    }
    if (mine !== this.entering) return;
    if (!def) {
      retry();
      this.minigame = null;
      return;
    }
    stage.hint.textContent = '';
    stage.help.hidden = true;
    this.show('minigame');
    try {
      const handle = await def.start({
        canvasParent: stage.canvasParent,
        storage: this.o.storage,
        ui: this.stageUi(),
        manual: this.o.manual,
        onComplete: () => this.completeMinigame(),
        onStep: this.o.onStep,
      });
      if (mine !== this.entering) handle.destroy();
      else {
        this.handle = handle;
        this.preloadNext();
        if (this.cardsAreGears) this.o.onGears();
      }
    } catch (error) {
      if (mine !== this.entering) return;
      retry();
      this.show('story');
      this.o.onFatal(`Không khởi động được câu đố: ${(error as Error).message.slice(0, 160)}`);
    }
  }

  private completeMinigame(): void {
    if (this.completing) return;
    this.completing = true;
    const chapter = this.script?.id;
    queueMicrotask(() => {
      this.handle?.destroy();
      this.handle = null;
      this.completing = false;
      if (chapter && !this.save.puzzles?.includes(chapter)) {
        this.save = { ...this.save, puzzles: [...(this.save.puzzles ?? []), chapter] };
        this.persist();
      }
      this.show('story');
      this.lastAdvance = performance.now();
      this.step();
    });
  }

  describe(): Record<string, unknown> | null {
    const script = this.script;
    const scene = script?.scenes[this.sceneIdx];
    if (!script || !scene) return { chapter: this.pos.chapter, mode: this.mode, screen: (SCREENS as readonly string[]).includes(this.mode) ? this.o.screens.describe() : null };
    return {
      chapter: script.id,
      title: script.title,
      mode: this.mode,
      scene: scene.id,
      sceneIndex: this.sceneIdx,
      scenes: script.scenes.length,
      beat: this.beatIdx,
      lineIndex: this.lineIdx,
      sceneLines: scene.beats.filter((b) => b.t === 'say' || b.t === 'narr').length,
      line: this.line,
      plate: this.o.view.plate,
      asking: this.o.view.asking,
      name: this.save.name,
      bg: { id: this.bg, color: this.o.view.background },
      cast: this.o.view.describeCast(),
      stage: this.o.view.describeStage(),
      screen: (SCREENS as readonly string[]).includes(this.mode) ? this.o.screens.describe() : null,
      logLength: this.log.length,
    };
  }
}
