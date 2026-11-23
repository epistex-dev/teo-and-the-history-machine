import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { parseChapter } from '../src/story/parse.ts';
import data from '../src/story/stage-data.json' with { type: 'json' };
import { CAST } from '../src/story/types.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const url = (path: string): string => `new URL('../../${path}', import.meta.url).href`;
const BAKED = 'art/baked';

interface Baked {
  geometry: { layouts: Record<string, unknown>; props: Record<string, number[]> } & Record<string, unknown>;
}
const STALE = 'run `npm run bake` (art/baked is built from art/style and is not committed)';
function baked(dir: string, fail: (message: string) => never): Baked {
  const file = `${dir}/manifest.json`;
  if (!existsSync(file)) fail(`${file} is missing: ${STALE}`);
  return JSON.parse(readFileSync(file, 'utf8')) as Baked;
}

/** Machine layer file name -> part name the engine and tests use. */
const MACHINE_PARTS: Record<string, string> = { body: 'machine-body', stain: 'machine-stain', doorL: 'machine-door-l', doorR: 'machine-door-r', needle: 'machine-needle', crank: 'machine-crank', stuck: 'machine-fx-stuck' };

/** Sprite names a chapter needs: the body and the expression layers of each cast member it shows, and every machine layer. */
function spritesOf(script: ReturnType<typeof parseChapter>): (readonly [string, string])[] {
  const beats = script.scenes.flatMap((s) => s.beats);
  const names = new Set<string>(['teo-front', 'teo-front-face-normal']);
  for (const layer of Object.keys(MACHINE_PARTS)) names.add(`machine-${layer}`);
  const turned = new Set<string>(['front']);
  for (const b of beats) if (b.t === 'turn' && b.who === 'Tèo') turned.add(b.view === 'side' ? 'three-quarter' : b.view);
  for (const b of beats) if (b.t === 'pose' && b.pose !== 'stand') for (const view of turned) names.add(`teo-${view}-${b.pose}`);
  for (const b of beats) {
    if (b.t !== 'say' || !(b.who in CAST)) continue;
    const spec = CAST[b.who as keyof typeof CAST];
    const expr = b.expr ?? 'normal';
    if (spec.key === 'teo') for (const view of turned) { names.add(`teo-${view}`); names.add(`teo-${view}-face-${expr}`); names.add(`teo-${view}-face-normal`); }
    else { names.add(`${spec.dir}-body`); names.add(`${spec.dir}-head-${expr}`); names.add(`${spec.dir}-head-normal`); }
  }
  return [...names].filter((n) => existsSync(`${ROOT}${BAKED}/${n}.webp`)).map((n) => [n.replace(/^machine-(\w+)$/, (_, l: string) => MACHINE_PARTS[l] ?? n), n] as const);
}

type PropRow = { scenery?: boolean; at: number[]; width: number; landscape?: { at: number[]; width: number } };

/** The backdrops, props and baked sprites a chapter uses, written into its own chunk so the shell grows with no chapter. */
function stageOf(script: ReturnType<typeof parseChapter>, bakedDir: string, fail: (message: string) => never): string {
  const beats = script.scenes.flatMap((s) => s.beats);
  for (const b of beats) if (b.t === 'bg' && !(b.id in data.backdrops)) fail(`${script.id}: @bg ${b.id} is not in src/story/stage-data.json`);
  for (const b of beats) if (b.t === 'prop' && !(b.id in data.props)) fail(`${script.id}: @prop ${b.id} is not in src/story/stage-data.json`);
  for (const b of beats) if (b.t === 'turn' && b.who !== 'Tèo' && !beats.some((s) => s.t === 'say' && s.who === b.who)) fail(`${script.id}: @turn for ${b.who}, who has no line in this chapter, so the chunk carries none of the sprites`);
  for (const b of beats) if (b.t === 'pose' && b.pose !== 'stand' && !existsSync(`${ROOT}${BAKED}/teo-front-${b.pose}.webp`)) fail(`${script.id}: @pose ${b.pose} has no baked sprite: ${STALE}`);
  const used = (kind: 'bg' | 'prop', known: object): string[] => [...new Set(beats.flatMap((b) => (b.t === kind && b.id in known ? [b.id] : [])))];
  const info = baked(bakedDir, fail);
  const layouts = info.geometry.layouts as Record<string, Record<string, unknown>>;
  for (const id of used('bg', data.backdrops)) if (!layouts[data.backdrops[id as keyof typeof data.backdrops].plate]) fail(`${script.id}: the baked manifest has no layout for the plate of ${id}: ${STALE}`);
  for (const id of used('prop', data.props)) if (!info.geometry.props[id]) fail(`${script.id}: the baked manifest has no frame for prop ${id}: ${STALE}`);
  const backdrops = used('bg', data.backdrops).map((id) => {
    const b = data.backdrops[id as keyof typeof data.backdrops];
    const art = `{portrait:${url(`${BAKED}/bg-${b.plate}-portrait.webp`)},landscape:${url(`${BAKED}/bg-${b.plate}-landscape.webp`)}}`;
    return `${JSON.stringify(id)}:{color:${JSON.stringify(b.color)},ground:${JSON.stringify(b.ground)},art:${art},plate:${JSON.stringify(layouts[b.plate])}}`;
  });
  const props = used('prop', data.props).map((id) => {
    const p = data.props[id as keyof typeof data.props] as PropRow;
    const frame = info.geometry.props[id] as number[];
    const ratio = Math.round(((frame[3] as number) / (frame[2] as number)) * 1000) / 1000;
    const at = { portrait: p.at, landscape: (p.landscape ?? p).at };
    const width = { portrait: p.width, landscape: (p.landscape ?? p).width };
    return `${JSON.stringify(id)}:{src:${url(`${BAKED}/prop-${id}.webp`)},${p.scenery ? 'scenery:true,' : ''}ratio:${ratio},at:${JSON.stringify(at)},width:${JSON.stringify(width)}}`;
  });
  const g = info.geometry as Record<string, Record<string, unknown>>;
  const m = g.machine as { frame: number[]; layers: Record<string, number[]>; hinge: Record<string, number[]>; dial: number[] };
  const part = (l: string): string => MACHINE_PARTS[l] as string;
  const layers = Object.fromEntries(Object.entries(m.layers).map(([l, r]) => [part(l), r]));
  const pivot = { [part('needle')]: m.dial, [part('crank')]: m.hinge.crank, [part('doorL')]: m.hinge.doorL, [part('doorR')]: m.hinge.doorR };
  const teoGeo = g.teo as { frame: number[]; face: number[]; poses?: Record<string, { frame: number[]; face: number[] }> };
  const geometry = { teo: { frame: teoGeo.frame, face: teoGeo.face, poses: teoGeo.poses ?? {} }, quado: { frame: g.quado!.frame }, cuccu: { frame: g.cuccu!.frame }, machine: { frame: m.frame, layers, pivot } };
  const sprites = spritesOf(script).map(([key, file]) => `${JSON.stringify(key)}:${url(`${BAKED}/${file}.webp`)}`);
  return `{backdrops:{${backdrops.join(',')}},props:{${props.join(',')}},plate:{sprites:{${sprites.join(',')}},geometry:${JSON.stringify(geometry)}}}`;
}

/** Bakes the plate art (art/style, cached by content hash) before the first chapter is read. */
function bake(): void {
  execFileSync(process.execPath, [`${ROOT}art/style/bake.mjs`], { stdio: 'inherit' });
}

/** `bakedDir` is where the baked manifest is read from; only a test points it elsewhere. */
export function chapters(bakedDir = `${ROOT}${BAKED}`): Plugin {
  return {
    name: 'teo-chapters',
    enforce: 'pre',
    buildStart() {
      bake();
    },
    transform(code, id) {
      if (!id.endsWith('.md?chapter')) return null;
      const file = id.split('?')[0]!;
      const script = parseChapter(code, file.slice(file.lastIndexOf('/') + 1));
      return { code: `export default {...${JSON.stringify(script)},stage:${stageOf(script, bakedDir, (message) => this.error(message))}};`, map: null };
    },
  };
}
