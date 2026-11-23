import type { ChapterScript, MachineFlag } from './story/types.ts';

export function machineBefore(script: ChapterScript, sceneIdx: number): MachineFlag[] {
  let flags: MachineFlag[] = [];
  for (let i = 0; i < sceneIdx; i += 1) for (const beat of script.scenes[i]?.beats ?? []) if (beat.t === 'machine') flags = beat.flags;
  return flags;
}

export function propsBefore(script: ChapterScript, sceneIdx: number): string[] {
  const on = new Set<string>();
  for (let i = 0; i < sceneIdx; i += 1) for (const beat of script.scenes[i]?.beats ?? []) if (beat.t === 'prop') beat.on ? on.add(beat.id) : on.delete(beat.id);
  return [...on];
}

export function lastBackdrop(script: ChapterScript, sceneIdx: number): string | null {
  let id: string | null = null;
  for (let i = 0; i < sceneIdx; i += 1) for (const beat of script.scenes[i]?.beats ?? []) if (beat.t === 'bg') id = beat.id;
  return id;
}
