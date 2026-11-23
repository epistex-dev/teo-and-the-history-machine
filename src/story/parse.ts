import { END_SCENE } from '../order.ts';
import { CAST, MACHINE_FLAGS, POSES, STAMPS, VIEWS, VOICE_ONLY, type Beat, type CastName, type ChapterScript, type MachineFlag, type Pose, type PoseRoot, type Scene, type Stamp, type View } from './types.ts';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAY = /^([^:[\]>@#\s][^:[\]]*?)(?:\s*\[([a-z]+)\])?:\s+(\S.*)$/;
const JOKE_MARK = /^\[khô\]\s*/iu;
const JOKE_ANYWHERE = /\[khô\]/iu;
const WHY_MARK = /^\[vì-sao\]\s*/iu;
const WHY_ANYWHERE = /\[vì-sao\]/iu;
const MAX_JOKES = 3;
const PLATE = /^Hình ([IVX]+)\. — (\S.*)$/u;
const MAX_PLATE_WORDS = 16;
const toRoman = (n: number): string => 'X'.repeat(Math.floor(n / 10)) + ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][n % 10];

/** Reads `at <x>,<y>` (portrait) and `land <x>,<y>` (landscape) out of a directive argument, null for an orientation that keeps its default; what is left comes back for flag lists. */
function parseAt(arg: string | undefined, n: number, what: string, fail: (line: number, message: string) => never, rest: (leftover: string) => void): PoseRoot | null {
  const at = /(?:^|\s)at\s+(-?[\d.]+),(-?[\d.]+)(?=\s|$)/.exec(arg ?? '');
  const land = /(?:^|\s)land\s+(-?[\d.]+),(-?[\d.]+)(?=\s|$)/.exec(arg ?? '');
  const stripped = (arg ?? '').replace(/(?:^|\s)(?:at|land)\s+(-?[\d.]+),(-?[\d.]+)/g, ' ');
  if (/(?:^|\s)(?:at|land)(?=\s|$)/.test(stripped)) fail(n, `${what}: at/land takes <x>,<y> in plate units`);
  rest(stripped.replace(/\s+/g, ' ').trim());
  if (!at && !land) return null;
  return { portrait: at ? [+at[1]!, +at[2]!] : null, landscape: land ? [+land[1]!, +land[2]!] : null };
}

const PLACEHOLDER = '{ten}';

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();
const castFolded = new Map<string, string>([...Object.keys(CAST), VOICE_ONLY].map((name) => [fold(name), name]));

export function parseChapter(source: string, file = 'chapter'): ChapterScript {
  const fail = (line: number, message: string): never => {
    throw new Error(`${file}:${line}: ${message}`);
  };
  if (source !== source.normalize('NFC')) throw new Error(`${file}: text is not NFC`);
  const checkText = (line: number, text: string): void => {
    const tag = /^\[([^\]]*)\]/.exec(text);
    if (tag && ['kho', 'dua'].includes(fold(tag[1] ?? '').trim())) fail(line, `"${tag[0]}" is a misspelling of [khô]`);
    if (tag && ['vi-sao', 'vi sao'].includes(fold(tag[1] ?? '').trim())) fail(line, `"${tag[0]}" is a misspelling of [vì-sao]`);
    if (/[{}]/.test(text.replaceAll(PLACEHOLDER, ''))) fail(line, `only ${PLACEHOLDER} is a placeholder: ${text.slice(0, 40)}`);
  };

  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  if (lines[0]?.trim() !== '---') fail(1, 'front matter must start with ---');
  const meta: Record<string, string> = {};
  for (i = 1; i < lines.length && lines[i]?.trim() !== '---'; i += 1) {
    const m = /^(id|title|status):\s*(\S.*)$/.exec(lines[i] ?? '');
    if (!m) fail(i + 1, 'front matter allows only id:, title: and status:');
    meta[m![1]!] = m![2]!.trim();
  }
  if (i >= lines.length) fail(1, 'front matter is not closed');
  if (!meta.id || !KEBAB.test(meta.id)) fail(2, 'front matter needs a kebab-case id');
  if (!meta.title) fail(2, 'front matter needs a title');
  if (meta.status !== undefined && meta.status !== 'draft') fail(2, 'status can only be draft');

  const scenes: Scene[] = [];
  let scene: Scene | null = null;
  let lineCount = 0;
  let asks = 0;
  let games = 0;
  let jokes = 0;
  let plates = 0;
  let plated = false;
  let spoken = false;
  const unmark = (s: string): string => {
    if (JOKE_MARK.test(s)) jokes += 1;
    return s.replace(WHY_MARK, '').replace(JOKE_MARK, '').trim();
  };
  const once = new Map<string, number>();

  for (i += 1; i < lines.length; i += 1) {
    const n = i + 1;
    const raw = lines[i] ?? '';
    const line = raw.trim();
    if (!line) continue;

    const head = /^##\s+(.+?)\s*$/.exec(line);
    if (head) {
      const id = head[1]!;
      if (!KEBAB.test(id)) fail(n, `scene id "${id}" is not kebab-case`);
      if (id === END_SCENE) fail(n, `scene id "${END_SCENE}" is reserved for the end screen`);
      if (scenes.some((s) => s.id === id)) fail(n, `duplicate scene id "${id}"`);
      scene = { id, beats: [] };
      plated = false;
      spoken = false;
      scenes.push(scene);
      continue;
    }
    if (!scene) fail(n, 'content before the first ## scene');
    const beats = scene!.beats;

    if (line.startsWith('@')) {
      const m = /^@([a-z-]+)(?:\s+(.+))?$/.exec(line);
      const name = m?.[1];
      const arg = m?.[2]?.trim();
      const bare = () => {
        if (arg) fail(n, `@${name} takes no argument`);
      };
      if (name === 'bg') {
        if (!arg || !KEBAB.test(arg)) fail(n, '@bg needs a kebab-case asset id');
        beats.push({ t: 'bg', id: arg! });
      } else if (name === 'ask-name') {
        bare();
        asks += 1;
        beats.push({ t: 'ask-name' });
      } else if (name === 'minigame') {
        bare();
        games += 1;
        beats.push({ t: 'minigame' });
      } else if (name === 'machine') {
        let flags: string[] = [];
        const at = parseAt(arg, n, '@machine', fail, (rest) => { flags = rest.split(/\s+/).filter(Boolean); });
        for (const flag of flags) if (!(MACHINE_FLAGS as readonly string[]).includes(flag)) fail(n, `@machine flag must be one of ${MACHINE_FLAGS.join(' | ')}`);
        beats.push(at ? { t: 'machine', flags: flags as MachineFlag[], at } : { t: 'machine', flags: flags as MachineFlag[] });
      } else if (name === 'pose') {
        const p = /^(stand|read|sheet|sit)(?:\s|$)/.exec(arg ?? '');
        if (!p) fail(n, `@pose needs one of ${POSES.join(' | ')} plus optional at <x>,<y> and land <x>,<y>`);
        beats.push({ t: 'pose', pose: p![1] as Pose, at: parseAt(arg, n, '@pose', fail, () => {}) });
      } else if (name === 'turn') {
        const t = /^(teo|cuc-cu|qua-don)\s+(front|three-quarter|side)$/.exec(arg ?? '');
        if (!t) fail(n, `@turn needs <teo|cuc-cu|qua-don> <${VIEWS.join('|')}>`);
        const who = (Object.keys(CAST) as CastName[]).find((c) => CAST[c].key === t![1]) as CastName;
        beats.push({ t: 'turn', who, view: t![2] as View });
      } else if (name === 'prop') {
        const p = /^(-?)([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(arg ?? '');
        if (!p) fail(n, '@prop needs <id> or -<id>');
        beats.push({ t: 'prop', id: p![2]!, on: p![1] === '' });
      } else if (name === 'timeline' || name === 'name-card' || name === 'code' || name === 'card') {
        bare();
        once.set(name, (once.get(name) ?? 0) + 1);
        if ((once.get(name) ?? 0) > 1) fail(n, `at most one @${name} per chapter`);
        beats.push({ t: name } as Beat);
      } else if (name === 'plate') {
        const m = PLATE.exec(arg ?? '');
        if (!m) fail(n, '@plate must read "Hình N. — caption" with N a Roman numeral');
        const caption = m![2]!;
        if (m![1] !== toRoman(plates + 1)) fail(n, '@plate numbers count up from I in each chapter: expected Hình ' + toRoman(plates + 1) + '.');
        if (plated) fail(n, 'at most one @plate per scene');
        if (spoken) fail(n, '@plate must come before the first line of its scene');
        if (caption.split(/\s+/).length > MAX_PLATE_WORDS) fail(n, '@plate caption is over ' + MAX_PLATE_WORDS + ' words');
        if (/\d/.test(caption)) fail(n, '@plate caption holds no digit (no year or label)');
        if ((STAMPS as readonly string[]).some((label) => caption.toUpperCase().includes(label))) fail(n, '@plate caption holds no stamp label');
        if (JOKE_ANYWHERE.test(caption)) fail(n, '[khô] is not allowed in a @plate caption');
        if (WHY_ANYWHERE.test(caption)) fail(n, '[vì-sao] is not allowed in a @plate caption');
        checkText(n, caption);
        plates += 1;
        plated = true;
        beats.push({ t: 'plate', text: 'Hình ' + m![1] + '. — ' + caption });
      } else if (name === 'stamp') {
        if (!arg || !(STAMPS as readonly string[]).includes(arg)) fail(n, `@stamp must be one of ${STAMPS.join(' | ')}`);
        beats.push({ t: 'stamp', label: arg as Stamp });
      } else fail(n, `unknown directive ${line}`);
      continue;
    }

    if (line.startsWith('>')) {
      const text = unmark(line.slice(1).trim());
      if (!text) fail(n, 'empty narration line');
      if (JOKE_ANYWHERE.test(text)) fail(n, '[khô] is only allowed right after the speaker');
      if (WHY_ANYWHERE.test(text)) fail(n, '[vì-sao] is only allowed right after the speaker');
      checkText(n, text);
      beats.push({ t: 'narr', text });
      lineCount += 1;
      spoken = true;
      continue;
    }

    const say = SAY.exec(line);
    if (!say) fail(n, `not a dialogue, narration or directive line: ${line.slice(0, 40)}`);
    const who = say![1]!.trim();
    const expr = say![2] ?? null;
    const text = unmark(say![3]!);
    if (!text) fail(n, 'empty dialogue line');
    if (JOKE_ANYWHERE.test(text)) fail(n, '[khô] is only allowed right after the speaker');
    if (WHY_ANYWHERE.test(text)) fail(n, '[vì-sao] is only allowed right after the speaker');
    checkText(n, text);
    const near = castFolded.get(fold(who));
    if (near && near !== who) fail(n, `speaker "${who}" is a misspelling of "${near}"`);
    if (who === VOICE_ONLY) {
      if (expr) fail(n, `${VOICE_ONLY} is voice only and takes no expression`);
    } else if (who in CAST) {
      const allowed = CAST[who as keyof typeof CAST].expressions as readonly string[];
      if (expr && !allowed.includes(expr)) fail(n, `${who} has no expression "${expr}" (${allowed.join(', ')})`);
    } else if (expr) fail(n, `${who} has no art, so no expression`);
    beats.push({ t: 'say', who, expr, text });
    lineCount += 1;
    spoken = true;
  }

  if (!scenes.length) fail(lines.length, 'a chapter needs at least one scene');
  for (const s of scenes) if (!s.beats.some((b) => b.t === 'say' || b.t === 'narr')) fail(lines.length, `scene "${s.id}" has no line`);
  if (asks > 1) fail(lines.length, 'at most one @ask-name per chapter');
  if (games > 1) fail(lines.length, 'at most one @minigame per chapter');
  if (jokes > MAX_JOKES) fail(lines.length, `at most ${MAX_JOKES} [khô] lines per chapter, found ${jokes}`);
  return { id: meta.id!, title: meta.title!, scenes, lineCount, draft: meta.status === 'draft' };
}

export type { Beat, ChapterScript };
