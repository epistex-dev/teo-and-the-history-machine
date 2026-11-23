import './style.css';
import { audioState, resumeQuietly, setVolumes, suspend, unlockAndPlay } from './audio.ts';
import { advanceClock, installVirtualClock } from './clock.ts';
import { Flow } from './flow.ts';
import type { Screens } from './flow.ts';
import { applyToDocument, SETTINGS_KEY, SettingsStore, TEXT_SPEEDS, useSettings, type Settings } from './settings.ts';
import { chunkOrFail, clearReloadParam, installPreloadErrorHandler, reloadedAfterFailure } from './preload-error.ts';
import { createSafeStorage } from './storage.ts';
import { fontsReady, StoryView } from './story/view.ts';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

const params = new URLSearchParams(location.search);
const manual = params.get('manual') === '1';
if (manual) installVirtualClock();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $('status');
const storageWarning = $('storage-warning');
const saveNewer = $('save-newer');
const netError = $('net-error');
const netErrorText = $('net-error-text');

const storage = createSafeStorage();
storage.onFallback(() => {
  storageWarning.hidden = false;
});
storage.onRecover(() => {
  storageWarning.hidden = true;
});

let phase: 'loading' | 'ready' | 'network-error' = 'loading';
let readyAt = Infinity;
const marks: number[] = [];
const frames: { at: number; ms: number }[] = [];
const TRANSITION_BEFORE_MS = 100;
const TRANSITION_AFTER_MS = 1500;

try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) frames.push({ at: entry.startTime, ms: Math.round(entry.duration) });
  }).observe({ type: 'long-animation-frame', buffered: false });
} catch {
  /* long-animation-frame is Chromium only */
}

function longFrames(): { boot: number[]; play: number[] } {
  const boot: number[] = [];
  const play: number[] = [];
  for (const f of frames) {
    const transition = marks.some((m) => f.at >= m - TRANSITION_BEFORE_MS && f.at <= m + TRANSITION_AFTER_MS);
    (f.at < readyAt || transition ? boot : play).push(f.ms);
  }
  return { boot, play };
}

function fatal(text: string, detail = 'Kiểm tra mạng rồi thử lại'): void {
  phase = 'network-error';
  status.textContent = text;
  netErrorText.textContent = detail;
  netError.hidden = false;
}

installPreloadErrorHandler(() => fatal('Không tải được một phần của truyện.'));
$('net-retry').addEventListener('click', () => location.reload());

const settings = new SettingsStore(
  () => storage.getItem(SETTINGS_KEY),
  (raw) => void storage.setItem(SETTINGS_KEY, raw),
);
useSettings(settings);
const view = new StoryView($('story'));
let loaded: Screens | null = null;
const loadScreens = async (): Promise<Screens> => (loaded ??= (await chunkOrFail(import('./screens.ts'))).createScreens());
const screens: Screens = {
  root: { card: $('card-screen'), timeline: $('timeline-screen'), namecard: $('namecard-screen'), code: $('code-screen'), end: $('end-screen') },
  card: async (...args) => (await loadScreens()).card(...args),
  timeline: (done) => void loadScreens().then((s) => s.timeline(done)),
  nameCard: async (...args) => (await loadScreens()).nameCard(...args),
  code: async (...args) => (await loadScreens()).code(...args),
  end: async (...args) => (await loadScreens()).end(...args),
  describe: () => loaded?.describe() ?? {},
};

const flow = new Flow({
  storage,
  view,
  screens,
  autoAdvance: () => settings.current.autoAdvance,
  stage: { root: $('stage'), canvasParent: $('mg-canvas'), hint: $('mg-hint'), help: $<HTMLButtonElement>('mg-help') },
  manual,
  onStatus: (text) => {
    status.textContent = text;
  },
  onFatal: (text) => fatal(text, text),
  onTransition: () => marks.push(performance.now()),
  onGears: () => $<HTMLDialogElement>('notebook-dialog').close(),
  onStep: advanceClock,
});

const applySettings = (s: Settings): void => {
  setVolumes(s.music, s.sfx);
  const cps = TEXT_SPEEDS[s.textSpeed];
  view.textDelay = cps > 0 ? 1000 / cps : 0;
  flow.settingsChanged();
};
applyToDocument(settings);
applySettings(settings.current);

const SHELL_BUTTONS = ['menu-open', 'log-open', 'end-notebook', 'end-card', 'end-new'];
let shell: Promise<void> | null = null;
const ensureShell = (): Promise<void> =>
  (shell ??= (async () => {
    for (const id of SHELL_BUTTONS) $(id).removeEventListener('click', wireLazily);
    const { wireShell } = await chunkOrFail(import('./shell.ts'));
    wireShell(flow, settings, applySettings);
  })());
const wireLazily = async (event: Event): Promise<void> => {
  const button = event.currentTarget as HTMLElement;
  await ensureShell();
  button.click();
};
for (const id of SHELL_BUTTONS) $(id).addEventListener('click', wireLazily);

document.addEventListener('click', () => unlockAndPlay(), { capture: true });
document.addEventListener('touchend', () => unlockAndPlay(), { capture: true });
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.key === 'Enter' || event.key === ' ') unlockAndPlay();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    flow.pause();
    suspend();
  } else {
    flow.resume();
    flow.settingsChanged();
    resumeQuietly();
  }
});
document.addEventListener('close', () => flow.settingsChanged(), true);

window.render_game_to_text = () =>
  JSON.stringify({
    shell: {
      phase,
      mode: flow.mode,
      status: status.textContent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      storage: { persistent: storage.persistent, warning: !storageWarning.hidden, newerSave: flow.newerSave },
      save: flow.save,
      audio: audioState(),
      settings: { ...settings.current, reducedMotionEffective: settings.reducedMotion },
      longFrames: longFrames(),
      hidden: document.hidden,
    },
    story: flow.describe(),
    game: flow.handle ? flow.handle.describe() : null,
  });

window.advanceTime = (ms) => {
  flow.handle?.advance(ms);
};

const titleChunk = params.has('preview') || reloadedAfterFailure() ? null : chunkOrFail(import('./title.ts'));

void flow.start().then(
  async () => {
    saveNewer.hidden = !flow.newerSave;
    const preview = /^card:([a-z0-9-]+)$/.exec(params.get('preview') ?? '');
    if (preview?.[1]) await flow.previewCard(preview[1]);
    const puzzle = /^puzzle:([a-z0-9-]+)$/.exec(params.get('preview') ?? '');
    if (puzzle?.[1]) await flow.previewPuzzle(puzzle[1]);
    if (titleChunk) void (await titleChunk).showTitle({ flow, ensureShell });
    await fontsReady;
    if (phase === 'loading' && flow.mode !== 'loading') {
      phase = 'ready';
      readyAt = performance.now();
      clearReloadParam();
    }
  },
  (error: unknown) => fatal('Không mở được truyện.', `Không mở được truyện: ${(error as Error).message}`),
);
