export interface MinigameUi {
  setHint(text: string): void;
  setHelp(visible: boolean): void;
  onHelp(callback: () => void): void;
}

import type { SafeStorage } from './storage.ts';

export interface MinigameStart {
  canvasParent: HTMLElement;
  /** The app's one SafeStorage: progress the game keeps goes through it, so a cleared key stays cleared. */
  storage: SafeStorage;
  ui: MinigameUi;
  manual: boolean;
  onComplete(): void;
  onStep(ms: number): void;
}

export interface MinigameHandle {
  describe(): Record<string, unknown>;
  /** The puzzle phase ('predict' | 'demo' | 'board' | 'reveal' | 'conclusion' | 'verdict'); a game without phases leaves it out. */
  phase?(): string;
  advance(ms: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export interface MinigameDef {
  id: string;
  orientation: 'portrait' | 'landscape' | 'both';
  start(options: MinigameStart): Promise<MinigameHandle>;
}
