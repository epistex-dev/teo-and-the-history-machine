// Every baked story asset: its id, source frame and the plate that draws it. The bake script renders these and the engine places them by the manifest.
import { POSE_GEO, teoBody, FRAME as TEO_FRAME } from './teo.mjs';
import { Plate } from './draw.mjs';
import { drawFace, TEO_EXPR } from './faces.mjs';
import { crow, cuckoo, CROW_EXPR, CUCKOO_EXPR, CROW_FRAME, CUCKOO_FRAME } from './birds.mjs';
import { machine, LAYERS as MACHINE_LAYERS, MFRAME, DIAL, HINGE } from './machine.mjs';
import { prop, PROPS } from './props.mjs';
import { scene } from './scene.mjs';
import { feast } from './feast.mjs';
import { hall } from './hall.mjs';
import { corridor } from './corridor.mjs';
import { bethlehem } from './bethlehem.mjs';
import { vault } from './vault.mjs';
import { harbour } from './harbour.mjs';
import { yard } from './yard.mjs';
import { village } from './village.mjs';
import { kitchen } from './kitchen.mjs';
import { yuleLads } from './yule-lads.mjs';
import { yuleCat } from './yule-cat.mjs';
import { santaNy } from './santa-ny.mjs';
import { cagaTio } from './caga-tio.mjs';
import { dickens } from './dickens.mjs';
import { brooms } from './brooms.mjs';
import { parlour } from './parlour.mjs';
import { street } from './street.mjs';
import { church } from './church.mjs';
import { LAYOUTS } from './layouts.mjs';
import { stamp, STAMP_IDS } from './stamps.mjs';
import { title } from './title.mjs';

/** Room plates by id: the stage data names a backdrop's plate by these ids. */
export const ROOMS = { 'ch1-office': scene, 'ch2-feast': feast, 'ch3-hall': hall, 'ch4-corridor': corridor, 'ch5-bethlehem': bethlehem, 'ch6-vault': vault, 'ch7-harbour': harbour, 'ch8-yard': yard, 'ch9-village': village, 'ch10-kitchen': kitchen, 'ch11-parlour': parlour, 'ch12-street': street, 'ch13-church': church, 'ch14-iceland-kitchen': yuleLads, 'ch15-wool-workshop': yuleCat, 'ch16-print-shop': santaNy, 'ch17-tio-corner': cagaTio, 'ch18-london-snow': dickens, 'ch19-norway-yard': brooms };

export const TEO_VIEWS = ['front', 'three-quarter'];
export const POSED = ['read', 'sheet', 'sit'];
// facial features live in this rectangle of Teo's frame; the same overlay rect serves every view
export const TEO_FACE = [-18, -296, 38, 42];

const faceSprite = (view, expr) => { const P = new Plate(12); drawFace(P, expr, view); return { frame: TEO_FACE, plate: P }; };

// scenery props are large and soft, so they bake at a lower resolution than the small props
const SCENERY_PROPS = { 'manger-lamp': { res: 1.5 }, 'window-shadow': { res: 1.5 }, 'kitchen-shadows': { res: 1.5 }, 'tree-light': { res: 1.5 }, 'draft-face': { res: 2.5 }, 'draft-holes': { res: 2.5 }, 'name-page': { res: 2.5 }, 'name-draft': { res: 2.5 }, 'mistletoe-sprig': { res: 2.5 }, 'small-bag': { res: 2.5 }, 'folded-sheet': { res: 2.5 }, apple: { res: 2.5 }, 'paper-star': { res: 2.5 }, 'step-apple': { res: 2.5 }, 'lone-slip': { res: 2.5 }, 'door-calendar': { res: 2.5 }, 'door-shadows': { res: 2.5 }, 'choir-mark': { res: 2 } };

// kind: how the bake treats the pixels (scene = opaque, figure/part = alpha), res: bitmap px per frame unit
// per-plate bake tune (quality) where a plate would otherwise burst its chapter budget; see the bake test
const TUNES = { 'bg-ch5-bethlehem-portrait': { quality: 45 }, 'bg-ch5-bethlehem-landscape': { quality: 45 }, 'bg-ch14-iceland-kitchen-portrait': { quality: 52 }, 'bg-ch14-iceland-kitchen-landscape': { quality: 52 }, 'bg-ch15-wool-workshop-portrait': { quality: 48 }, 'bg-ch15-wool-workshop-landscape': { quality: 48 }, 'bg-ch16-print-shop-portrait': { quality: 44 }, 'bg-ch16-print-shop-landscape': { quality: 44 }, 'bg-ch17-tio-corner-portrait': { quality: 44 }, 'bg-ch17-tio-corner-landscape': { quality: 44 } };

export function listAssets() {
  const a = [];
  for (const [room, make] of Object.entries(ROOMS)) for (const o of ['portrait', 'landscape']) a.push({ id: 'bg-' + room + '-' + o, kind: 'scene', make: () => make(o), tune: TUNES['bg-' + room + '-' + o] });
  for (const v of TEO_VIEWS) {
    a.push({ id: 'teo-' + v, kind: 'teo', make: () => teoBody(v) });
    for (const e of TEO_EXPR) a.push({ id: 'teo-' + v + '-face-' + e, kind: 'face', make: () => faceSprite(v, e) });
    for (const p of POSED) a.push({ id: `teo-${v}-${p}`, kind: 'teo', make: () => teoBody(v, p) });
  }
  a.push({ id: 'quado-body', kind: 'bird', make: () => crow('normal', 'body') });
  for (const e of CROW_EXPR) a.push({ id: 'quado-head-' + e, kind: 'bird', make: () => crow(e, 'head') });
  a.push({ id: 'cuccu-body', kind: 'bird', make: () => cuckoo('normal', 'body') });
  for (const e of CUCKOO_EXPR) a.push({ id: 'cuccu-head-' + e, kind: 'bird', make: () => cuckoo(e, 'head') });
  for (const l of Object.keys(MACHINE_LAYERS)) a.push({ id: 'machine-' + l, kind: 'machine', make: () => machine(l) });
  for (const id of Object.keys(PROPS)) a.push({ id: 'prop-' + id, kind: 'prop', tune: SCENERY_PROPS[id], make: () => prop(id) });
  for (const id of STAMP_IDS) a.push({ id: 'stamp-' + id, kind: 'stamp', make: () => stamp(id) });
  // the title-screen scene is a hero image, so a bit above scene resolution
  a.push({ id: 'title', kind: 'scene', tune: { res: 1.5, quality: 70 }, make: () => title() });
  return a;
}

// what the engine needs besides the pixels: frames, feet, hinge points and the stage layouts
export const GEOMETRY = {
  teo: { frame: TEO_FRAME, face: TEO_FACE, feet: [0, 0], poses: POSE_GEO },
  quado: { frame: CROW_FRAME, feet: [0, 0] },
  cuccu: { frame: CUCKOO_FRAME, feet: [0, 0] },
  machine: { frame: MFRAME, layers: MACHINE_LAYERS, dial: DIAL, hinge: HINGE },
  props: PROPS,
  layouts: LAYOUTS,
};
