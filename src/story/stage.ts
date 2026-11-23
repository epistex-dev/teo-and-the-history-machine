import type { Token } from '../palette.ts';

export type Orientation = 'portrait' | 'landscape';

export type Rect = [number, number, number, number];

/** Where the baked plate art puts things, one set per orientation (written by `art/style/layouts.mjs`; units are the art's own pixels). */
export interface PlateLayout {
  size: [number, number];
  /** Highest design y that must stay on screen (Tèo's cap, the machine roof). */
  top: number;
  groundY: number;
  /** Vanishing point of the room: what steps back on a short stage moves toward it. */
  vp: [number, number];
  /** The part of the room's key furniture that must stay on screen (portrait only). */
  keep?: Rect;
  teo: { root: [number, number]; scale: number };
  machine: { origin: [number, number]; scale: number };
  cuccu: { root: [number, number]; scale: number };
  quado: { root: [number, number]; scale: number };
}

/** Frames of the baked sprites in their own units (written by `art/style/assets.mjs`). */
export interface PlateGeometry {
  teo: { frame: Rect; face: Rect };
  quado: { frame: Rect };
  cuccu: { frame: Rect };
  machine: { frame: Rect; layers: Record<string, Rect>; pivot: Record<string, [number, number]> };
}

/** A backdrop of one chapter: colours, art URLs and placement, built into the chapter's own chunk by `scripts/chapters-plugin.ts` from `stage-data.json`. */
export interface Backdrop {
  color: Token;
  ground: Token;
  art: { portrait: string; landscape: string };
  plate: Record<Orientation, PlateLayout>;
}

/** A prop of one chapter: the baked sprite, its height over width and, per orientation, its place and width in the machine frame. */
export interface PropArt {
  src: string;
  /** Placed in art pixels on the backdrop (it scales and crops with the plate) instead of in the machine frame. */
  scenery?: boolean;
  ratio: number;
  at: Record<Orientation, [number, number]>;
  width: Record<Orientation, number>;
}

export interface ChapterStage {
  backdrops: Record<string, Backdrop>;
  props: Record<string, PropArt>;
  /** Baked sprites the chapter uses by name (`teo-front`, `teo-front-face-elated`, `machine-needle` ...) and their frames. */
  plate?: { sprites: Record<string, string>; geometry: PlateGeometry };
}

export interface Fit {
  /** Screen px per design px. */
  k: number;
  /** Top-left of the art box in px inside the story box. */
  ox: number;
  oy: number;
  width: number;
  height: number;
  groundY: number;
  /** How far the cast and the machine have stepped back toward the vanishing point (1 = not at all). */
  back: number;
  vp: [number, number];
}

const GAP = 8;
const TOP_MARGIN = 6;
const STEP_BACK_MIN = 0.8;

/**
 * Plate stage fit: the art covers the stage (cropped at the sides or the top) and the feet stand on the ground line just above the dialogue box.
 * On a short stage the cast and the machine step back toward the vanishing point (smaller, feet higher on the floor) until the highest thing
 * (layout.top) clears the top edge and the room's key furniture (layout.keep) is on screen, down to STEP_BACK_MIN; only past that does the art shrink.
 */
export function fitPlate(layout: PlateLayout, width: number, height: number, dialogueHeight: number): Fit {
  const [aw, ah] = layout.size;
  const room = Math.max(1, height - dialogueHeight - GAP);
  const [vx, vy] = layout.vp;
  const span = Math.max(1, layout.groundY - layout.top);
  const k = Math.min(Math.max(1, room - TOP_MARGIN) / (span * STEP_BACK_MIN), Math.max(width / aw, height / ah));
  let back = Math.max(1, room - TOP_MARGIN) / (span * k);
  if (layout.keep) back = Math.min(back, (layout.keep[1] + room / k - vy) / (layout.groundY - vy));
  back = Math.min(1, Math.max(STEP_BACK_MIN, back));
  const feet = vy + (layout.groundY - vy) * back;
  const oy = Math.min(0, room - feet * k);
  return { k, ox: (width - aw * k) / 2, oy, width: aw * k, height: ah * k, groundY: oy + feet * k, back, vp: [vx, vy] };
}

/** CSS box of a baked sprite: its frame (x, y, w, h around the sprite's feet point) at the cast scale, with the feet at a design point. */
export function spriteBox(fit: Fit, frame: Rect, root: [number, number], scale: number): string {
  const s = scale * fit.back * fit.k;
  const [x, y] = stepBack(fit, root);
  return boxCss({ left: fit.ox + x * fit.k + frame[0] * s, top: fit.oy + y * fit.k + frame[1] * s, width: frame[2] * s, height: frame[3] * s });
}

/** A design point of the cast or the machine once the stage has stepped them back toward the vanishing point. */
export const stepBack = (fit: Fit, [x, y]: [number, number]): [number, number] => [fit.vp[0] + (x - fit.vp[0]) * fit.back, fit.vp[1] + (y - fit.vp[1]) * fit.back];

export const boxCss = (b: Box): string => `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;

export interface Box {
  left: number;
  top: number;
  height: number;
  width: number;
}
