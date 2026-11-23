import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAIL_WORDING, FORMATS, LIMITS, checkFile, checkOne, l2Exemption, requiredSteps } from './puzzles.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const puzzleDir = process.env.PUZZLES_DIR ?? resolve(root, 'story/puzzles');
const jsonPath = process.argv[2] ?? resolve(root, 'story/minigames.json');
const biblePath = process.argv[3] ?? resolve(root, 'story/bible.md');

const SPEC_IDS = ['intro', 'saturnalia', 'yule', 'mistletoe', 'bethlehem', 'dec25', 'nicholas', 'carol', 'krampus', 'befana', 'tree', 'ban1647', 'silent-night', 'yule-lads', 'yule-cat', 'santa-ny', 'caga-tio', 'dickens', 'brooms', 'ending'];
const FRAME_IDS = ['intro', 'ending'];
const CROW_ABSENT = ['intro', 'bethlehem'];
const STAMPS = ['SỰ THẬT', 'TRUYỀN THUYẾT', 'TRANH CÃI', 'THEO KINH THÁNH', 'THEO TRUYỀN THỐNG'];
const MAX_UNKNOWN_YEAR = 3;
const TONES = ['sai', 'chưa ai chứng minh', 'còn tranh cãi'];
const IS_WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;
const FIELDS = ['id', 'act', 'format', 'input', 'goal', 'orientation', 'minutes', 'state', 'aha', 'wrongFrame', 'key', 'label', 'keySource', 'cards', 'solution', 'l2', 'reveal'];
const OPTIONAL = ['puzzle', 'thin', 'note'];
const INPUTS = new Set(['assign', 'order', 'mark', 'transform']);
const ORIENTATIONS = new Set(['portrait', 'landscape', 'both']);
const STATES = new Set(['full', 'ok', 'pending m0c']);
const CARD_STATUS = new Set(['fact', 'legend', 'disputed', 'rule', 'decoy']);
const MAX_PER_FORMAT = 3;
const MIN_SOLVE = 90;
const MAX_SOLVE = 180;
const L2_STEP = /giả định|giả thiết|hypothesis|đọc (?:cùng|hai thẻ)|hai thẻ (?:cùng|đọc)|ghép (?:hai|2) thẻ|joint/iu;

const errors = [];
const warnings = [];
const nfc = (s) => s.normalize('NFC');

function section(lines, title) {
  const start = lines.findIndex((l) => /^##\s/.test(l) && nfc(l).includes(nfc(title)));
  if (start < 0) return null;
  const next = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines.slice(start + 1, next < 0 ? undefined : next);
}

function table(lines, title) {
  const rows = section(lines, title);
  if (!rows) {
    errors.push('bible: section "' + title + '" not found');
    return null;
  }
  const cells = (row) => row.split('|').slice(1, -1).map((c) => nfc(c.trim()));
  const head = rows.find((r) => /^\|\s*#\s*\|/.test(r));
  if (!head) {
    errors.push('bible: section "' + title + '" has no table header');
    return null;
  }
  const header = cells(head);
  const byId = new Map();
  const order = [];
  for (const row of rows) {
    const m = row.match(/^\|\s*(\d+)\s*\|\s*`([a-z0-9-]+)`/);
    if (!m) continue;
    const c = cells(row);
    if (c.length !== header.length) errors.push('bible: "' + title + '" row ' + m[1] + ' has ' + c.length + ' cells, header has ' + header.length);
    if (byId.has(m[2]) || order.some((x) => x.n === Number(m[1]))) errors.push('bible: "' + title + '" has a duplicate row (#' + m[1] + ' ' + m[2] + ')');
    const rec = { n: Number(m[1]), id: m[2], get: (name) => c[header.findIndex((h) => h.startsWith(nfc(name)))] ?? '' };
    byId.set(m[2], rec);
    order.push(rec);
  }
  return { header, order, byId };
}

function need(tbl, title, name) {
  if (!tbl.header.some((h) => h.startsWith(nfc(name)))) {
    errors.push('bible: "' + title + '" has no column "' + name + '"');
    return false;
  }
  return true;
}

function yearOf(cell) {
  const p = cell.match(/\([^)]*?(\d{4})[^)]*\)/);
  if (p) return Number(p[1]);
  const c = cell.match(/thế kỷ (\d+)( TCN)?/);
  if (c) return c[2] ? -((Number(c[1]) - 1) * 100 + 50) : (Number(c[1]) - 1) * 100 + 50;
  const y = cell.match(/(\d{3,4})/);
  return y ? Number(y[1]) : null;
}

function readBible() {
  const lines = readFileSync(biblePath, 'utf8').split('\n');
  const locked = section(lines, 'Danh sách chương đã khóa');
  if (!locked) {
    errors.push('bible: section "Danh sách chương đã khóa" not found');
    return { ids: [], timeline: [], unknown: [], labels: new Map(), stamps: new Map() };
  }
  const ids = [...locked.join('\n').matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) errors.push('bible: duplicate id in locked list: ' + id);
    seen.add(id);
  }
  for (const id of SPEC_IDS) if (!seen.has(id)) errors.push('bible: locked list lacks SPEC id ' + id);
  for (const id of seen) if (!SPEC_IDS.includes(id)) errors.push('bible: locked list has id outside SPEC: ' + id);

  const titleIO = 'Bảng vào/ra';
  const io = table(lines, titleIO);
  if (io) {
    for (const id of SPEC_IDS) if (!io.byId.has(id)) errors.push('bible: "' + titleIO + '" lacks ' + id);
    for (const r of io.order) if (SPEC_IDS[r.n - 1] !== r.id) errors.push('bible: "' + titleIO + '" row ' + r.n + ' has ' + r.id + ' but SPEC has ' + SPEC_IDS[r.n - 1]);
    if (need(io, titleIO, 'Vào') && need(io, titleIO, 'Ra') && need(io, titleIO, 'Giao sang chương sau')) {
      const carry = new Map();
      for (const r of io.order) {
        const at = 'bible: "' + titleIO + '" chapter ' + r.n + ' (' + r.id + ')';
        const vao = r.get('Vào');
        const time = vao.match(/\b23:(\d\d)\b/);
        if (time && Number(time[1]) !== 39 + r.n) errors.push(at + ': Vào has time ' + time[0] + ' but the clock formula gives 23:' + (39 + r.n));
        if (r.n >= 20) continue;
        const giao = r.get('Giao sang chương sau');
        const m = giao.match(/^Đến: ([^;]+);\s*Kim: [^;]+;\s*Mang: ([^;]+);\s*Vì: (\S.*)$/);
        if (!m) {
          errors.push(at + ': Giao must read "Đến: ...; Kim: ...; Mang: ...; Vì: ...", got ' + JSON.stringify(giao));
          continue;
        }
        if (/quạ/iu.test(giao)) errors.push(at + ': Giao must not mention Quạ Đồn');
        const items = m[2].replace(/\([^)]*\)/g, '').split(',').map((s) => nfc(s.trim())).filter(Boolean);
        if (items.length === 0) errors.push(at + ': Mang lists no item');
        carry.set(r.n, items);
        for (const item of carry.get(r.n - 1) ?? []) {
          if (!items.includes(item) && !r.get('Ra').includes('Bỏ lại: ' + item)) errors.push(at + ': Mang of chapter ' + (r.n - 1) + ' has "' + item + '" but it is neither in Mang nor in Ra as "Bỏ lại: ' + item + '"');
        }
        const next = io.order.find((x) => x.n === r.n + 1);
        if (next) {
          const dest = nfc(m[1].trim());
          const nv = next.get('Vào');
          if (!nv.startsWith(dest) || IS_WORD_CHAR.test(nv.charAt(dest.length))) errors.push(at + ': Vào of chapter ' + next.n + ' does not start with the Giao destination "' + dest + '" ending on a word boundary');
          for (const item of items) if (!nv.includes(item)) errors.push(at + ': Vào of chapter ' + next.n + ' lacks the Mang item "' + item + '"');
        }
      }
    }
  }

  const titleLabel = 'Nhãn và cơ sở lịch sử';
  const lab = table(lines, titleLabel);
  const timeline = [];
  const unknown = [];
  const labels = new Map();
  const stamps = new Map();
  if (lab) {
    for (const id of SPEC_IDS) if (!lab.byId.has(id)) errors.push('bible: "' + titleLabel + '" lacks ' + id);
    for (const r of lab.order) if (SPEC_IDS[r.n - 1] !== r.id) errors.push('bible: "' + titleLabel + '" row ' + r.n + ' has ' + r.id + ' but SPEC has ' + SPEC_IDS[r.n - 1]);
    if (need(lab, titleLabel, 'Nhãn') && need(lab, titleLabel, 'Mốc') && need(lab, titleLabel, 'Dấu') && need(lab, titleLabel, 'Quạ Đồn nói')) {
      for (const r of lab.order) {
        const at = 'bible: "' + titleLabel + '" chapter ' + r.n + ' (' + r.id + ')';
        const label = r.get('Nhãn');
        const moc = r.get('Mốc');
        const crow = r.get('Quạ Đồn nói');
        const stamp = r.get('Dấu');
        stamps.set(r.id, stamp);
        if (FRAME_IDS.includes(r.id) ? stamp !== '—' : !STAMPS.includes(stamp)) errors.push(at + ': Dấu must be ' + (FRAME_IDS.includes(r.id) ? '"—" for a frame chapter' : 'one of ' + STAMPS.join(', ')) + ', got "' + stamp + '"');
        if (FRAME_IDS.includes(r.id)) {
          if (label !== 'khung') errors.push(at + ': frame chapter must have label "khung", got "' + label + '"');
        } else {
          const lm = label.match(/^(Cổ|KT|DG)( †)?$/);
          if (!lm) errors.push(at + ': label must be Cổ, KT or DG with optional †, got "' + label + '"');
          else {
            labels.set(lm[1], (labels.get(lm[1]) ?? 0) + 1);
            if (lm[2]) labels.set('†', (labels.get('†') ?? 0) + 1);
            if (moc.startsWith('chưa rõ')) {
              if (!/^chưa rõ \([^)]{15,}\)$/.test(moc)) errors.push(at + ': a "chưa rõ" Mốc needs a stated reason in parentheses (15+ chars), got "' + moc + '"');
              if (label !== 'DG †') errors.push(at + ': a "chưa rõ" Mốc needs label "DG †", got "' + label + '"');
              unknown.push({ id: r.id, n: r.n, moc });
            } else {
              const year = yearOf(moc);
              if (year === null) errors.push(at + ': Mốc has no year: "' + moc + '"');
              else {
                const want = year < 0 ? 'Cổ' : year < 1500 ? 'KT' : 'DG';
                if (lm[1] !== want) errors.push(at + ': label ' + lm[1] + ' does not match Mốc "' + moc + '" (rule gives ' + want + ')');
                timeline.push({ id: r.id, n: r.n, year, moc });
              }
            }
          }
        }
        if (CROW_ABSENT.includes(r.id)) {
          if (!crow.startsWith('vắng')) errors.push(at + ': Quạ Đồn must be absent (vắng)');
        } else if (r.id !== 'ending') {
          const tone = TONES.find((t) => crow.startsWith('(' + t + ')'));
          if (!tone) errors.push(at + ': Quạ Đồn cell must start with a tone tag (sai), (chưa ai chứng minh) or (còn tranh cãi), got "' + crow.slice(0, 40) + '"');
        }
      }
    }
    if (unknown.length > MAX_UNKNOWN_YEAR) errors.push('bible: ' + unknown.length + ' chapters have Mốc "chưa rõ" (max ' + MAX_UNKNOWN_YEAR + ')');
  }
  timeline.sort((a, b) => (a.year === b.year ? a.n - b.n : a.year - b.year));
  return { ids, timeline, unknown, labels, stamps };
}

function readGames() {
  let data;
  try {
    data = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    errors.push('json: cannot read or parse ' + jsonPath + ': ' + e.message);
    return [];
  }
  if (!Array.isArray(data)) {
    errors.push('json: top level must be an array');
    return [];
  }
  return data;
}

function strings(o, path = '') {
  if (typeof o === 'string') return [[path, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => strings(v, path + '[' + i + ']'));
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => strings(v, path ? path + '.' + k : k));
  return [];
}

const bible = readBible();
const games = readGames();
const ids = new Set();
const signatures = new Map();
const formats = new Map();
const runPuzzle = [];
const runStub = [];
const l2Steps = new Map();
const stubPath = (id) => resolve(puzzleDir, 'stubs', id + '.json');
const l2Exempt = (id) => { try { return l2Exemption(JSON.parse(readFileSync(resolve(puzzleDir, id + '.json'), 'utf8'))); } catch { return null; } };
const isStub = (id) => { try { return JSON.parse(readFileSync(resolve(puzzleDir, id + '.json'), 'utf8')).stub === true; } catch { return false; } };

games.forEach((g, i) => {
  const at = 'entry ' + (i + 1) + (g && typeof g.id === 'string' ? ' (' + g.id + ')' : '');
  if (g === null || typeof g !== 'object' || Array.isArray(g)) {
    errors.push(at + ': not an object');
    return;
  }
  for (const f of FIELDS) if (!(f in g)) errors.push(at + ': missing field ' + f);
  for (const f of Object.keys(g)) if (!FIELDS.includes(f) && !OPTIONAL.includes(f)) errors.push(at + ': unknown field ' + f);
  if (typeof g.id !== 'string' || !/^[a-z0-9-]+$/.test(g.id)) errors.push(at + ': id must match [a-z0-9-]+');
  else if (ids.has(g.id)) errors.push(at + ': duplicate id');
  else ids.add(g.id);
  if (!FORMATS.includes(g.format)) errors.push(at + ': format outside the closed list: ' + JSON.stringify(g.format));
  if (!INPUTS.has(g.input)) errors.push(at + ': input outside vocabulary: ' + JSON.stringify(g.input));
  if (typeof g.goal !== 'string' || !/^[a-z-]+$/.test(g.goal)) errors.push(at + ': goal must be a lowercase word');
  if (!ORIENTATIONS.has(g.orientation)) errors.push(at + ': orientation outside vocabulary: ' + JSON.stringify(g.orientation));
  if (!Array.isArray(g.minutes) || g.minutes.length !== 2 || !g.minutes.every(Number.isInteger) || g.minutes[0] < MIN_SOLVE || g.minutes[1] > MAX_SOLVE || g.minutes[0] > g.minutes[1]) errors.push(at + ': minutes must be [low, high] seconds inside ' + MIN_SOLVE + '..' + MAX_SOLVE);
  if (!STATES.has(g.state)) errors.push(at + ': state must be full, ok or "pending m0c"');
  for (const f of ['aha', 'wrongFrame', 'key', 'keySource', 'solution', 'reveal']) if (typeof g[f] !== 'string' || g[f].trim() === '' || /[\r\n]/.test(g[f])) errors.push(at + ': ' + f + ' must be a non-empty single line');
  const want = bible.stamps.get(g.id);
  if (want && g.label !== want) errors.push(at + ': label "' + g.label + '" differs from the bible stamp "' + want + '"');
  if (!Array.isArray(g.cards) || g.cards.length === 0 || g.cards.length > LIMITS.cards) errors.push(at + ': cards must list 1..' + LIMITS.cards + ' evidence cards');
  else {
    g.cards.forEach((c, j) => {
      if (!c || typeof c.text !== 'string' || !c.text.trim() || typeof c.source !== 'string' || !c.source.trim()) errors.push(at + ': card ' + (j + 1) + ' needs text and source');
      if (!c || !CARD_STATUS.has(c.status)) errors.push(at + ': card ' + (j + 1) + ' status must be one of ' + [...CARD_STATUS].join(', '));
    });
  }
  for (const [path, s] of strings(g)) {
    if (s !== nfc(s)) errors.push(at + ': ' + path + ' is not NFC');
    const m = /^cards\[\d+\]\.text$/.test(path) ? null : s.match(FAIL_WORDING);
    if (m) errors.push(at + ': ' + path + ' implies a fail state ("' + m[0] + '")');
  }
  const file = 'story/puzzles/' + g.id + '.json';
  if (!('l2' in g)) { /* reported above as a missing field */ } else if (typeof g.l2 !== 'string' || !g.l2.trim() || /[\r\n]/.test(g.l2)) errors.push(at + ': l2 must be a non-empty single line naming the intended hypothesis or joint-card step(s), steps separated by ";" (a puzzle with l2Exempt: "không ...", L1 only)');
  else {
    const steps = g.l2.split(';').map((s) => s.trim()).filter(Boolean);
    l2Steps.set(g.id, /^không(?![\p{L}])/iu.test(g.l2.trim()) ? 0 : steps.length);
    const exempt = l2Exempt(g.id);
    const need = requiredSteps(g.id, g.act, exempt !== null);
    if (exempt !== null) {
      if (!/^không(?![\p{L}])/iu.test(g.l2.trim())) errors.push(at + ': the puzzle has l2Exempt, so it needs no L2 step and l2 must start with "không"');
    } else {
      if (steps.length < need) errors.push(at + ': l2 lists ' + steps.length + ' step(s) but this chapter needs ' + need + ' (acts 3 and 4 and the ending need two)');
      for (const s of steps) if (s.length < 20 || !L2_STEP.test(s)) errors.push(at + ': l2 step "' + s.slice(0, 40) + '" must name a hypothesis ("giả định ...") or two cards read together ("đọc cùng ...") and what it rules out');
    }
  }
  if (g.state === 'full') {
    if (g.puzzle !== file || !existsSync(resolve(puzzleDir, g.id + '.json'))) errors.push(at + ': state full needs puzzle ' + file);
    else if (isStub(g.id)) errors.push(at + ': a stub puzzle cannot back a row with state full');
    else runPuzzle.push(g.id);
  } else if (g.puzzle) {
    if (g.puzzle !== file || !existsSync(resolve(puzzleDir, g.id + '.json'))) errors.push(at + ': puzzle must be ' + file + ' and exist');
    else if (!isStub(g.id)) errors.push(at + ': only a full row has a real puzzle file; a row that is not full may name a stub (stub: true)');
    else runStub.push({ id: g.id });
  } else if (existsSync(stubPath(g.id))) runStub.push({ id: g.id, file: stubPath(g.id) });
  const signature = [g.format, g.input, g.goal].join('+');
  signatures.set(signature, [...(signatures.get(signature) ?? []), g.id]);
  formats.set(g.format, [...(formats.get(g.format) ?? []), g.id]);
});

for (const [signature, owners] of signatures) if (owners.length > 1) errors.push('duplicate signature ' + signature + ': ' + owners.join(', '));
for (const [format, owners] of formats) if (owners.length > MAX_PER_FORMAT) errors.push('format ' + format + ' is used by ' + owners.length + ' puzzles (max ' + MAX_PER_FORMAT + '): ' + owners.join(', '));
for (let i = 1; i < SPEC_IDS.length; i++) {
  const a = games.find((x) => x && x.id === SPEC_IDS[i - 1]);
  const b = games.find((x) => x && x.id === SPEC_IDS[i]);
  if (a && b && a.format === b.format) errors.push('adjacent puzzles share format ' + a.format + ': ' + a.id + ', ' + b.id);
}
for (const id of SPEC_IDS) if (!ids.has(id)) errors.push('missing SPEC chapter id in json: ' + id);
for (const id of ids) if (!SPEC_IDS.includes(id)) errors.push('extra chapter id in json (not in SPEC): ' + id);
if (games.length === SPEC_IDS.length && games.some((g, i) => g.id !== SPEC_IDS[i])) errors.push('json rows must follow the SPEC chapter order');
if (existsSync(puzzleDir)) for (const f of readdirSync(puzzleDir)) if (f.endsWith('.json') && ![...runPuzzle, ...runStub.map((s) => s.id)].includes(f.slice(0, -5))) errors.push('story/puzzles/' + f + ' has no row: a full row, or a row whose puzzle field names this stub');

const stubDir = resolve(puzzleDir, 'stubs');
if (existsSync(stubDir)) for (const f of readdirSync(stubDir)) if (f.endsWith('.json') && !runStub.some((s) => s.file && s.id === f.slice(0, -5))) errors.push('story/puzzles/stubs/' + f + ' has no row that is not full: delete the stub once its puzzle is a full file');

const shapes = new Map();
for (const { id, file } of [...runPuzzle.map((id) => ({ id })), ...runStub]) {
  const r = file ? checkFile(file) : checkOne(id);
  try {
    const cards = JSON.parse(readFileSync(file ?? resolve(puzzleDir, id + '.json'), 'utf8')).cards;
    const shape = cards.map((c) => [].concat(c.do ?? []).map((d) => d.op).join('+')).join(',');
    shapes.set(shape, [...(shapes.get(shape) ?? []), id]);
  } catch { /* an unreadable puzzle is reported by the check above */ }
  for (const e of r.errors) errors.push('puzzle ' + e);
  for (const w of r.warnings) warnings.push('puzzle ' + w);
  const l2 = r.info.levels?.l2;
  if (l2 !== undefined && l2Steps.has(id) && l2Steps.get(id) !== l2) errors.push(id + ': l2 in the matrix describes ' + l2Steps.get(id) + ' step(s) but the checker needs ' + l2 + ' L2 action(s) for story/puzzles/' + id + '.json');
}

for (const [shape, owners] of shapes) if (owners.length > 1) errors.push('duplicate card shape ' + shape + ': ' + owners.join(', ') + ' repeat one deduction under different names; change the card shape of one');
for (const w of warnings) console.warn('warn: ' + w);
if (errors.length > 0) {
  for (const e of errors) console.error('error: ' + e);
  console.error('FAIL: ' + errors.length + ' error(s)');
  process.exit(1);
}
const states = (s) => games.filter((g) => g.state === s).map((g) => g.id);
console.log('OK: ' + games.length + ' entries, ' + signatures.size + ' unique signatures, ' + formats.size + ' formats (max ' + Math.max(...[...formats.values()].map((v) => v.length)) + ' per format), no adjacent repeats, the 25 SPEC ids present in bible and json');
console.log('formats: ' + [...formats].map(([f, o]) => f + '=' + o.length).join(' '));
console.log('puzzles checked in full: ' + runPuzzle.join(', '));
console.log('stubs checked (logic only): ' + runStub.map((s) => s.id).join(', '));
console.log('pending m0c: ' + states('pending m0c').join(', '));
console.log('thin: ' + games.filter((g) => g.thin).map((g) => g.id).join(', '));
console.log('labels: ' + [...bible.labels].map(([l, n]) => l + '=' + n).join(' '));
console.log('timeline: ' + bible.timeline.map((x) => x.id + '(' + x.moc + ')').join(' < '));
console.log('unknown-year block: ' + bible.unknown.map((x) => x.id).join(', '));
