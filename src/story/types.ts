import type { ChapterStage } from './stage.ts';

export const STAMPS = ['SỰ THẬT', 'TRUYỀN THUYẾT', 'TRANH CÃI', 'THEO KINH THÁNH', 'THEO TRUYỀN THỐNG'] as const;
export type Stamp = (typeof STAMPS)[number];

export const CAST = {
  'Tèo': { key: 'teo', dir: 'teo', expressions: ['normal', 'elated', 'angry', 'awkward', 'fainted', 'scared', 'smug', 'tired'] },
  'Cúc Cu': { key: 'cuc-cu', dir: 'cuccu', expressions: ['normal', 'talking', 'smug', 'surprised', 'deflated'] },
  'Quạ Đồn': { key: 'qua-don', dir: 'quado', expressions: ['normal', 'talking', 'smug', 'surprised', 'doubtful'] },
} as const;
export type CastName = keyof typeof CAST;
export const VOICE_ONLY = 'Ông già Noel';
export const MACHINE_FLAGS = ['stained', 'open', 'stuck'] as const;
export type MachineFlag = (typeof MACHINE_FLAGS)[number];
export const VIEWS = ['front', 'three-quarter', 'side'] as const;
export type View = (typeof VIEWS)[number];
export const POSES = ['stand', 'read', 'sheet', 'sit'] as const;
export type Pose = (typeof POSES)[number];
/** Per-orientation root override on the plate (null keeps the default): where Tèo's soles touch the ground, or the machine's origin. */
export type PoseRoot = { portrait: [number, number] | null; landscape: [number, number] | null };

export type Beat =
  | { t: 'say'; who: string; expr: string | null; text: string }
  | { t: 'narr'; text: string }
  | { t: 'bg'; id: string }
  | { t: 'plate'; text: string }
  | { t: 'ask-name' }
  | { t: 'minigame' }
  | { t: 'stamp'; label: Stamp }
  | { t: 'card' }
  | { t: 'machine'; flags: MachineFlag[]; at?: PoseRoot | null }
  | { t: 'pose'; pose: Pose; at: PoseRoot | null }
  | { t: 'prop'; id: string; on: boolean }
  | { t: 'turn'; who: CastName; view: View }
  | { t: 'timeline' }
  | { t: 'name-card' }
  | { t: 'code' };

export interface Scene {
  id: string;
  beats: Beat[];
}

export interface ChapterScript {
  id: string;
  title: string;
  scenes: Scene[];
  lineCount: number;
  draft: boolean;
  /** Added by the build (`scripts/chapters-plugin.ts`), not by the parser. */
  stage?: ChapterStage;
}
