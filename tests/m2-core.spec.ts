import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { encodeCode, makeCode, parseCode } from '../src/code.ts';
import { fitFont, timelineOf, type ChapterMeta } from '../src/chapter-meta.ts';
import { ORDER } from '../src/order.ts';
import { parseSettings, serializeSettings } from '../src/settings.ts';
import { parseChapter } from '../src/story/parse.ts';

const doc = (body: string, head = '---\nid: t\ntitle: T\n---\n') => head + body;
const bible = readFileSync('story/bible.md', 'utf8');
const raw = JSON.parse(readFileSync('story/meta.json', 'utf8')) as { acts: unknown[]; chapters: ChapterMeta[] };
const META = raw.chapters;
const ACTS = raw.acts;

/**
 * Sổ nguồn wording that says less than the research sentence it comes from, on purpose: the research text overclaims, the card drops
 * exactly that phrase. `research` is the research wording and `card` its replacement in the card; every other word must match
 * research/ verbatim, and the card must not contain `overclaim`.
 */
const SOFTENED = [
  { research: 'Bản ghi sớm nhất được biết về lễ Giáng Sinh ngày 25/12', card: 'Một bản ghi lễ Giáng Sinh ngày 25/12', overclaim: 'sớm nhất' },
  { research: 'có mục lễ “N INVICTI” ngày 25/12', card: 'có mục “N INVICTI” (được cho là lễ mặt trời) ngày 25/12', overclaim: 'mục lễ “N INVICTI”' },
];

test.describe('M2 core logic', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'pure logic, runs once');
  });

  test('[khô] is stripped from lines and refused anywhere else', () => {
    const c = parseChapter(doc('## a\nTèo [elated]: [khô] Nhận chính thức!\nCúc Cu: [Khô] Nguồn đâu?\n'), 't.md');
    const lines = c.scenes[0]!.beats.flatMap((b) => (b.t === 'say' ? [b.text] : []));
    expect(lines).toEqual(['Nhận chính thức!', 'Nguồn đâu?']);
    expect(() => parseChapter(doc('## a\nTèo: Nhận [khô] chính thức\n'), 't.md')).toThrow(/khô/);
    expect(() => parseChapter(doc('## a\n> Cảnh [khô] này\n'), 't.md')).toThrow(/khô/);
  });

  test('chapter 1 never lets [khô] reach the screen text', () => {
    const intro = parseChapter(readFileSync('story/chapters/intro.md', 'utf8'), 'intro.md');
    const texts = intro.scenes.flatMap((s) => s.beats.flatMap((b) => (b.t === 'say' || b.t === 'narr' ? [b.text] : [])));
    expect(texts.length).toBeGreaterThan(25);
    for (const t of texts) expect(t.toLowerCase()).not.toContain('[khô]');
  });

  test('new directives: @machine, @prop, @turn, @timeline, @name-card and the draft status', () => {
    const c = parseChapter(
      doc('## a\n@machine stained open\n@prop coffee-cup\n@prop -coffee-cup\n@turn teo three-quarter\n@turn cuc-cu side\n> x\n@timeline\n@name-card\n', '---\nid: t\ntitle: T\nstatus: draft\n---\n'),
      't.md',
    );
    expect(c.draft).toBe(true);
    expect(c.scenes[0]!.beats.map((b) => b.t)).toEqual(['machine', 'prop', 'prop', 'turn', 'turn', 'narr', 'timeline', 'name-card']);
    expect(c.scenes[0]!.beats[0]).toEqual({ t: 'machine', flags: ['stained', 'open'] });
    expect(c.scenes[0]!.beats[4]).toEqual({ t: 'turn', who: 'Cúc Cu', view: 'side' });
    for (const bad of ['@machine broken', '@turn teo back', '@turn nobody side', '@prop', '@timeline now']) {
      expect(() => parseChapter(doc(`## a\n${bad}\n> x\n`), 't.md'), bad).toThrow();
    }
    expect(() => parseChapter(doc('## a\n> x\n@timeline\n@timeline\n'), 't.md')).toThrow(/at most one/);
    expect(() => parseChapter(doc('## a\n> x\n', '---\nid: t\ntitle: T\nstatus: done\n---\n'), 't.md')).toThrow(/draft/);
  });

  test('the ending chapter has the timeline and the name card, is no draft and carries no draft marker', () => {
    const e = parseChapter(readFileSync('story/chapters/ending.md', 'utf8'), 'ending.md');
    expect(e.id).toBe('ending');
    const beats = e.scenes.flatMap((s) => s.beats.map((b) => b.t));
    expect(beats).toContain('timeline');
    expect(beats).toContain('name-card');
    expect(e.draft).toBe(false);
    for (const s of e.scenes) for (const b of s.beats) if (b.t === 'narr' || b.t === 'say') expect(b.text).not.toContain('[Bản nháp]');
  });

  test('chapter data follows bible §7: 20 chapters, 16 dated, 2 undated, 2 frame, stamps and labels as in the table', () => {
    const rows = bible.split('\n').filter((l) => /^\|\s*\d+\s*\|\s*`/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
    const table = rows.filter((r) => r.length >= 5);
    expect(META.map((c) => c.id)).toEqual([...ORDER]);
    expect(ACTS).toHaveLength(4);
    for (const c of META) {
      const row = table.find((r) => r[1]!.replaceAll('`', '') === c.id)!;
      expect(row, c.id).toBeTruthy();
      expect(row[2]!.replace(/\s*†/, ''), c.id).toBe(c.label ?? 'khung');
      expect(row[2]!.includes('†'), c.id).toBe(c.dagger);
      expect(row[4], c.id).toBe(c.stamp ?? '—');
      expect(row[3], c.id).toBe(c.moc ?? '—');
    }
    const t = timelineOf(META);
    expect(t.nodes).toHaveLength(16);
    expect(t.unknown.map((c) => c.id)).toEqual(['befana', 'brooms']);
    expect(META.filter((c) => c.label === null).map((c) => c.id)).toEqual(['intro', 'ending']);
    expect(META.filter((c) => c.label === 'Cổ')).toHaveLength(1);
    expect(META.filter((c) => c.label === 'KT')).toHaveLength(5);
    expect(META.filter((c) => c.label === 'DG')).toHaveLength(12);
    expect(META.filter((c) => c.dagger)).toHaveLength(7);
  });

  test('the verified Sổ nguồn cards come from research/: every sentence in full, every item sourced, every link opened (✔)', () => {
    const files = readdirSync('research').filter((f) => /^m0b-act-\d+\.md$/.test(f)).sort().map((f) => {
      const notebooks = new Map<string, string>();
      const kept: string[] = [];
      let section = '';
      let open: { id: string; lines: string[] } | null = null;
      for (const line of readFileSync(`research/${f}`, 'utf8').split('\n')) {
        if (/^#{1,3} /.test(line)) {
          if (open) notebooks.set(open.id, open.lines.join('\n'));
          open = null;
          if (line.startsWith('## ')) section = line;
          if (/^### .*Sổ tay/.test(line)) {
            const id = /Sổ tay\s+`?([\w-]+)`?\s*$/.exec(line)?.[1] ?? /^## .*?(?:—|Chương \d+,)\s*`?([\w-]+)/.exec(section)?.[1];
            if (id) open = { id, lines: [] };
          }
        }
        if (open) open.lines.push(line);
        else kept.push(line);
      }
      if (open) notebooks.set(open.id, open.lines.join('\n'));
      return { file: `research/${f}`, notebooks, checked: kept.join('\n') };
    });
    const opened = (checked: string, url: string) => {
      for (let at = checked.indexOf(url); at >= 0; at = checked.indexOf(url, at + 1)) if (!checked.slice(Math.max(0, at - 2), at).includes('○')) return true;
      return false;
    };
    const softenedUsed = new Set<string>();
    const inResearch = (notebook: string, text: string): boolean => {
      if (notebook.includes(text)) return true;
      const soft = SOFTENED.find((s) => text.includes(s.card));
      if (!soft) return false;
      softenedUsed.add(soft.card);
      expect(text, `the card must not repeat the research's overclaim "${soft.overclaim}"`).not.toContain(soft.overclaim);
      return notebook.includes(text.replace(soft.card, soft.research));
    };
    const ids = readdirSync('story/notebook').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
    expect(ids.length, 'story/notebook has entries').toBeGreaterThan(0);
    for (const id of ids) {
      const entry = JSON.parse(readFileSync(`story/notebook/${id}.json`, 'utf8')) as { status: string; source: string; stamp: string; card: string[]; full: Record<string, { text: string; sources: { url: string }[] }[]> };
      expect(entry.status).toBe('verified');
      const home = files.find((f) => f.notebooks.has(id));
      expect(home, `${id}: no Sổ tay block for this notebook in any research/m0b-act-*.md`).toBeTruthy();
      expect(entry.source, `${id}: source names the file that holds the block`).toBe(home!.file);
      expect(entry.stamp).toBe(META.find((c) => c.id === id)?.stamp);
      expect(entry.card.length).toBeGreaterThanOrEqual(2);
      expect(entry.card.length).toBeLessThanOrEqual(3);
      const notebook = home!.notebooks.get(id) ?? '';
      expect(notebook, `${id}: research has a Sổ tay block`).not.toBe('');
      for (const line of entry.card) expect(inResearch(notebook, line), `${id}: card line must be in research: ${line}`).toBe(true);
      for (const points of Object.values(entry.full)) {
        for (const p of points) {
          expect(inResearch(notebook, p.text), `${id}: ${p.text}`).toBe(true);
          expect(p.sources.length, `${id}: no sources: ${p.text.slice(0, 40)}`).toBeGreaterThan(0);
          for (const s of p.sources) {
            expect(s.url).toMatch(/^https:\/\//);
            expect(opened(home!.checked, s.url), `${id}: not a ✔ URL in research: ${s.url}`).toBe(true);
          }
        }
      }
    }
    expect([...softenedUsed].sort(), 'every softened phrase is still in use').toEqual(SOFTENED.map((s) => s.card).sort());
  });

  test('continue codes round trip and every check rejects what it should', () => {
    for (const [chapter, furthest] of [['intro', 'intro'], ['dec25', 'nicholas'], ['ending', 'ending']] as const) {
      for (const name of ['', 'Lan', 'Tèo 日本', '<b>&</b>']) {
        const r = parseCode(makeCode({ name, chapter, furthest }));
        expect(r).toEqual({ ok: true, data: { name, chapter, furthest } });
      }
    }
    const reason = (code: string) => {
      const r = parseCode(code);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('')).toBe('empty');
    expect(reason('TEO1.00')).toBe('length');
    expect(reason('x'.repeat(500))).toBe('length');
    expect(reason('TEO9.00.00.nAAAA.ABCDEF')).toBe('schema');
    expect(reason('WXYZ.00.00.nAAAAAAAA.ABCDEF')).toBe('schema');
    expect(reason(makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule' }).slice(0, -1) + '0')).toBe('checksum');
    expect(reason(encodeCode(10, 3, 'Lan'))).toBe('beyond');
    expect(reason(encodeCode(25, 25, 'Lan'))).toBe('chapter');
    expect(reason(encodeCode(3, 4, 'a\u0000b'))).toBe('name');
    expect(reason(`${makeCode({ name: 'Lan', chapter: 'yule', furthest: 'yule' })}.x`)).toBe('format');
  });

  test('settings: unknown values fall back, the volumes are clamped and the round trip is stable', () => {
    expect(parseSettings(null)).toMatchObject({ textSpeed: 'instant', autoAdvance: 'off', fontSize: 'normal', reducedMotion: null });
    expect(parseSettings('{"music":900,"sfx":-4,"textSpeed":"slow","reducedMotion":false,"__proto__":{"x":1}}')).toMatchObject({ music: 100, sfx: 0, textSpeed: 'slow', reducedMotion: false });
    expect(parseSettings('[1,2]')).toMatchObject({ music: 70 });
    const s = parseSettings('{"music":30,"fontSize":"large"}');
    expect(parseSettings(serializeSettings(s))).toEqual(s);
  });

  test('a long name shrinks until it fits and stops at the minimum size', () => {
    const width = (px: number) => px * 0.6 * 24;
    const px = fitFont(width, 900);
    expect(width(px)).toBeLessThanOrEqual(900);
    expect(px).toBeLessThan(150);
    expect(fitFont((p) => p * 0.6 * 3, 900)).toBe(150);
    expect(fitFont((p) => p * 100, 900)).toBe(40);
  });

  test('bible §11: a chapter whose NT column says "có" mentions the Holy Family in its script (chapter 13)', () => {
    const row = bible.split('\n').find((l) => /^\|\s*13\s*\|\s*`silent-night`\s+Stille/.test(l));
    const nt = row?.split('|').slice(1, -1).map((c) => c.trim()).at(-1);
    const script = readFileSync('story/chapters/silent-night.md', 'utf8');
    const names = ['Chúa Hài Đồng', 'Hài Nhi', 'Đức Mẹ', 'Maria', 'Thánh Giuse', 'hang đá', 'máng cỏ'];
    const mentioned = names.filter((n) => script.includes(n));
    if (nt === 'có') expect(mentioned.join(', '), '§11: NT "có" says the script shows the Holy Family, but silent-night.md names none; fix the row or the script').not.toBe('');
  });

  test('the tree transcriptions stay apart: research quotes Tille verbatim (Zischgolt) and the Sổ nguồn carries no merged gloss', () => {
    const research = readFileSync('research/m0b-act-2.md', 'utf8');
    expect(research).toContain('Aepfel, Oblaten, Zischgolt, Zucker etc.');
    expect(research).not.toContain('Zischgold, Zucker');
    const notebook = JSON.parse(readFileSync('story/notebook/tree.json', 'utf8')) as { full: { fact: { text: string }[] } };
    expect(notebook.full.fact[0]!.text).not.toContain('(Zischgold)');
  });
});
