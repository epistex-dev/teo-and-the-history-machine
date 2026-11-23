import type { Orientation, PlateGeometry, PropArt } from './stage.ts';
import type { MachineFlag } from './types.ts';

const LEAF_OPEN = 0.22;
const NEEDLE = { rest: -30, stuck: 62 };
const CRANK_REST = 60;

const pct = (value: number, of: number): string => `${(value / of) * 100}%`;

/** What the stage needs from a machine. */
export interface MachineLike {
  readonly root: HTMLElement;
  readonly state: MachineFlag[];
  set(flags: MachineFlag[]): void;
}

/** A prop standing in a frame (the machine's, or the art of the plate for scenery), so it scales with it; its place and width depend on the orientation of the plate. */
export class PropView {
  readonly root = document.createElement('div');

  constructor(
    id: string,
    private readonly art: PropArt,
    private readonly frame: (orientation: Orientation) => [number, number],
  ) {
    this.root.className = 'prop';
    this.root.dataset.prop = id;
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = art.src;
    img.className = 'part';
    img.style.cssText = 'left:0;top:0;width:100%;height:100%';
    this.root.append(img);
  }

  place(orientation: Orientation): void {
    const [fw, fh] = this.frame(orientation);
    const [x, y] = this.art.at[orientation];
    const w = this.art.width[orientation];
    const s = this.root.style;
    s.left = pct(x, fw);
    s.top = pct(y, fh);
    s.width = pct(w, fw);
    s.height = pct(w * this.art.ratio, fh);
  }
}

/** The History Machine from the baked plate layers: one static body and separate alpha layers for the door leaves, needle, crank, stain and steam. */
export class PlateMachineView implements MachineLike {
  readonly root = document.createElement('div');
  state: MachineFlag[] = [];
  private readonly layers = new Map<string, HTMLImageElement>();

  constructor(sprites: Record<string, string>, { frame, layers, pivot }: PlateGeometry['machine']) {
    this.root.className = 'machine';
    for (const [part, r] of Object.entries(layers)) {
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = sprites[part] ?? '';
      img.className = 'part';
      img.dataset.part = part;
      const o = pivot[part];
      img.style.cssText = `left:${pct(r[0], frame[2])};top:${pct(r[1], frame[3])};width:${pct(r[2], frame[2])};height:${pct(r[3], frame[3])}${o ? `;transform-origin:${pct(o[0] - r[0], r[2])} ${pct(o[1] - r[1], r[3])}` : ''}`;
      this.layers.set(part, img);
      this.root.append(img);
    }
    this.set([]);
  }

  set(flags: MachineFlag[]): void {
    this.state = flags;
    const stuck = flags.includes('stuck');
    const leaf = flags.includes('open') ? `scaleX(${LEAF_OPEN})` : '';
    const look: Record<string, [boolean, string]> = {
      'machine-stain': [flags.includes('stained'), ''],
      'machine-door-l': [true, leaf],
      'machine-door-r': [true, leaf],
      'machine-needle': [true, `rotate(${stuck ? NEEDLE.stuck : NEEDLE.rest}deg)`],
      'machine-fx-stuck': [stuck, ''],
      'machine-crank': [true, `rotate(${CRANK_REST}deg)`],
    };
    for (const [part, [on, transform]] of Object.entries(look)) {
      const img = this.layers.get(part);
      if (img) Object.assign(img, { hidden: !on }).style.transform = transform;
    }
    this.root.dataset.flags = flags.join(' ');
  }
}
