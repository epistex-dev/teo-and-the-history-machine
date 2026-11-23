export const SETTINGS_KEY = 'teo:v1:settings';
export const SETTINGS_VERSION = 1;

export const TEXT_SPEEDS = { instant: 0, fast: 90, normal: 45, slow: 22 } as const;
export const AUTO_DELAYS = { off: null, slow: [1800, 60], normal: [1200, 45], fast: [700, 30] } as const;
export const FONT_SIZES = { small: 0.9, normal: 1, large: 1.2, xlarge: 1.4 } as const;

export type TextSpeed = keyof typeof TEXT_SPEEDS;
export type AutoAdvance = keyof typeof AUTO_DELAYS;
export type FontSize = keyof typeof FONT_SIZES;

export interface Settings {
  textSpeed: TextSpeed;
  autoAdvance: AutoAdvance;
  music: number;
  sfx: number;
  fontSize: FontSize;
  /** null follows prefers-reduced-motion until the player chooses. */
  reducedMotion: boolean | null;
}

export const DEFAULTS: Settings = { textSpeed: 'instant', autoAdvance: 'off', music: 70, sfx: 80, fontSize: 'normal', reducedMotion: null };

const oneOf = <T extends string>(table: Record<T, unknown>, value: unknown, fallback: T): T => (typeof value === 'string' && Object.hasOwn(table, value) ? (value as T) : fallback);
const volume = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback);

export function parseSettings(raw: string | null): Settings {
  let data: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
  } catch {
    /* corrupt settings fall back to defaults */
  }
  return {
    textSpeed: oneOf(TEXT_SPEEDS, data.textSpeed, DEFAULTS.textSpeed),
    autoAdvance: oneOf(AUTO_DELAYS, data.autoAdvance, DEFAULTS.autoAdvance),
    music: volume(data.music, DEFAULTS.music),
    sfx: volume(data.sfx, DEFAULTS.sfx),
    fontSize: oneOf(FONT_SIZES, data.fontSize, DEFAULTS.fontSize),
    reducedMotion: typeof data.reducedMotion === 'boolean' ? data.reducedMotion : null,
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify({ version: SETTINGS_VERSION, ...s });

const systemReduced = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export class SettingsStore {
  private value: Settings;
  private readonly listeners: ((s: Settings) => void)[] = [];

  constructor(
    private readonly read: () => string | null,
    private readonly write: (raw: string) => void,
  ) {
    this.value = parseSettings(read());
  }

  get current(): Settings {
    return this.value;
  }

  get reducedMotion(): boolean {
    return this.value.reducedMotion ?? systemReduced();
  }

  onChange(listener: (s: Settings) => void): void {
    this.listeners.push(listener);
  }

  update(patch: Partial<Settings>): void {
    this.value = parseSettings(JSON.stringify({ ...this.value, ...patch }));
    this.write(serializeSettings(this.value));
    for (const listener of this.listeners) listener(this.value);
  }

}

let active: SettingsStore | null = null;

export function useSettings(store: SettingsStore): void {
  active = store;
}

/** Read by mini games: the player's choice, else the system preference. */
export const reducedMotion = (): boolean => active?.reducedMotion ?? systemReduced();

export function applyToDocument(store: SettingsStore): void {
  const root = document.documentElement;
  root.style.setProperty('--font-scale', String(FONT_SIZES[store.current.fontSize]));
  root.dataset.reducedMotion = String(store.reducedMotion);
}
