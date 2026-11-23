export type Kind = 'tap' | 'place' | 'remove' | 'wrong' | 'hint' | 'solve';

const QUEUE_TTL_MS = 300;

let ctx: AudioContext | null = null;
let played = 0;
let greeted = false;
let pending: { kind: Kind; at: number } | null = null;
const volume = { sfx: 0.8, music: 0.7 };

export function setVolumes(music: number, sfx: number): void {
  volume.music = music / 100;
  volume.sfx = sfx / 100;
}

function create(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

function tone(c: AudioContext, freq: number, start: number, length: number, type: OscillatorType): void {
  const peak = 0.25 * volume.sfx;
  if (peak < 0.0002) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

const NOTES: Record<Kind, number[]> = {
  tap: [660],
  place: [523],
  remove: [392],
  wrong: [330, 262],
  hint: [660, 784],
  solve: [523, 659, 784],
};

export function play(kind: Kind): void {
  const c = ctx;
  if (!c || volume.sfx === 0) return;
  if (c.state !== 'running') {
    pending = { kind, at: performance.now() };
    return;
  }
  const now = c.currentTime;
  NOTES[kind].forEach((freq, i) => tone(c, freq, now + i * 0.09, 0.14, 'triangle'));
  played += 1;
}

function settle(): void {
  if (!greeted) {
    greeted = true;
    play('tap');
  }
  const queued = pending;
  pending = null;
  if (queued && performance.now() - queued.at <= QUEUE_TTL_MS) play(queued.kind);
}

export function unlockAndPlay(): void {
  const c = create();
  if (!c) return;
  if (c.state === 'running') settle();
  else c.resume().then(settle, () => undefined);
}

export function suspend(): void {
  pending = null;
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
}

export function resumeQuietly(): void {
  pending = null;
  if (ctx) void ctx.resume().catch(() => undefined);
}

export function audioState(): { state: string; currentTime: number; played: number; music: number; sfx: number } {
  return {
    music: Math.round(volume.music * 100),
    sfx: Math.round(volume.sfx * 100),
    state: ctx ? ctx.state : 'none',
    currentTime: ctx ? Math.round(ctx.currentTime * 1000) / 1000 : 0,
    played,
  };
}
