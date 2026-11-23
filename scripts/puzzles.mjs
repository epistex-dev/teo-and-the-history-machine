#!/usr/bin/env node
// Puzzle checker, solver and paper-prototype printer.
//   node scripts/puzzles.mjs check [--release] [id...]   run every check (default: all files in story/puzzles); --release also fails a conclusion piece whose Sổ nguồn chapter is not written yet (npm run release:check)
//   node scripts/puzzles.mjs view <id>            player view (cards, bank in the shown order with ids, answer syntax)
//   node scripts/puzzles.mjs facilitator <id>     facilitator sheet
//   node scripts/puzzles.mjs reply <id> board...  UI answer per board; boards share one "found" set
//   node scripts/puzzles.mjs hint <id> <1-5> [board...]   hint text; tier 5 prints a solution not among the given boards
//   node scripts/puzzles.mjs stub <file|id>       logic-only check of a puzzle with placeholder text and no sources (see Stub below)
//
// Model. A state puts every token in a slot (1-based) or leaves it unplaced (0). The UI never refuses a placement because of
// a piece's status, so the reachable states respect only slot capacity and required tokens; every count, threshold and bot
// below works on those. The solver ignores token.status as well: a board is a solution when the cards (and the rules) hold, so the
// cards alone must keep a legend or decoy piece out of a fact slot. slot.accepts (default: fact, rule, disputed) is checked on the declared
// solutions only: a legend piece never sits in a fact slot of a declared solution.
// Classification (classification(), classTalk(), selfDeclared(), conclusion()). The player derives each piece's status (fact, legend, hypothesis,
// decoy, not a record) from sourced cards, never from the piece text or the rules. Checked structurally: (1) with every rule constraint that is not
// symmetric under swapping any two pieces removed (tested by permutation over the reachable states), the cards alone still give exactly the declared
// solutions; (2) for each legend, decoy or disputed piece, and every piece a declared solution leaves out whatever its status, removing the constraints that depend on it (the rest of each card stays) must admit a solution that places it elsewhere than every
// declared solution does (no card names it, or capacity, the minimums and the other cards already keep it out: the class is then carried by the slots,
// not by a card). Checked by phrase lists only (a piece can say its class in other words, and no code reads card text against its constraint; a review
// does): piece text, rule text, question, title, hints 1-3, slot labels and conclusion.bank text may not carry a class or a label; and the question,
// rules and hints 1-3 may not repeat the words of a legend, decoy or disputed piece. Piece texts are never read by the solver, so the neutral-text run is the solver itself. Not checked: that a card's
// text says what its constraint does, that a piece cannot be told from its text by tone, and whether the card a conclusion label rests on exists in the Sổ nguồn.
// A rule constraint symmetric under any swap of two pieces (a count over all pieces, spaced) singles out none and stays.
//
// Fields added to the format (older files keep working; "REQUIRED" = the checker rejects a file without it):
//   space               REQUIRED. Number of valid states; the checker recomputes it and rejects a mismatch.
//   bankSeed            optional number; reseeds bankOrder(), the shuffled order in which the UI and view() show the tokens.
//   slot.cap            max tokens in the slot: integer or "any" (default 1). A slot with cap > 1 classifies many-to-one.
//   minPlaced           optional (default 1): fewer pieces than this on the board is answered "incomplete" (no check is spent), whatever the slot minimums say; so an empty board is never a check. At most the number of required pieces.
//   slot.min            min tokens in the slot (default 1 without cap, 0 with cap).
//   slot.value          number used by expr (default: the 1-based slot index).
//   token.required      true: the token must be placed (default false).
//   token.value         number used by expr.
//   solutions[i][k]     a token id; an array of ids for a slot with cap > 1; null for an empty slot.
//   do ops (cards, rules, wrongFrame.do), tokens in "t", slots in "s":
//     at, notAt, oneOf, used, unused, before, next, adjacent, notAdjacent, between   (as before)
//     same {t:[a,b]}, differ {t:[a,b]}, count {t:[...], s:slot, n | min | max}
//     spaced {t:[...]}  some three of the placed tokens sit in equally spaced slots (by slot index; slot.value is not read)
//     expr {e:[...]}  JSON expression; true means the constraint holds. Nodes: numbers, booleans, strings (calendar names),
//       ["pos",t] slot index (0 unplaced), ["slot",t] slot.value, ["tok",t] token.value, ["placed",t], ["count",slotId,t...],
//       add sub mul mod abs min max eq ne lt le gt ge and or not if,
//       ["jdn",y,m,d,"julian"|"gregorian"], ["weekday",y,m,d,"julian"|"gregorian"] (0 = Sunday). An unplaced token gives NaN
//       for ["slot",t], so every comparison with it is false.
//     any other op name is looked up in OPS; registerOp(name, (vals, c) => boolean) adds one in code (vals follow c.t).
//   slot.lane           "legend": the only kind of slot that may list legend in accepts; it must list legend and must not accept fact.
//                       Its label, like every slot label, carries no class word: a card says what the lane holds.
//   slot.weekday        optional weekday name (Chủ nhật, Thứ hai ... Thứ bảy); must agree with slot.value (0 = Sunday, weekday()).
//   token.date          optional {y, m, d, cal}; when the solution puts it in a slot with weekday, weekday(y, m, d, cal) must be that day.
//   card.kind           record (a source document), modern (a modern historian's statement), retelling, hypothesis, inference (the game derives it), rule. kind rule <=> status rule; a legend card carries no do.
//   conclusion          {template with ___ per blank, blanks [{label}], bank [{id?, text, label, status, notebook, card?, source, url, evidence}], hints [{text}, {text}, {text, solves: true}]}; the ending needs it.
//                       notebook "<chapter>.<fact|dispute|legend|card>.<n>" is the Sổ nguồn entry the piece rests on (story/notebook/<chapter>.json, full.<section>[n] or card[n] for a line saying the claim is unproven);
//                       its label must be the status that entry has. A chapter whose notebook file does not exist yet is "pending": reported, never an error, and an error under check --release.
//                       The UI judges a fill with conclusionCorrect (exported to the player), the same rule conclusionStats counts.
//                       label SỰ THẬT / TRANH CÃI / TRUYỀN THUYẾT / CHƯA CÓ NGUỒN (matches no blank), status must be fact / disputed / legend / decoy.
//                       Labels are hidden in view(); the checker counts correct fills and needs P(guess within 12) < 5%.
//   wrongFrame.trap     partial board {slotId: tokenId | [ids]} a player in the wrong frame builds. The checker uses it to prove the cards break the frame; the UI answers it
//                       like any other wrong board (no frame message, no card pointed at: cards are pointed at only by the hint tiers the player presses).
//   wrongFrame.exact   optional true: the trap also needs the exact piece set. Every optional piece (not required) outside the trap must be unplaced,
//                       so a board that adds pieces the trap does not name is no trap (a board with every piece placed breaks the card that limits how many are placed).
//   wrongFrame.do       REQUIRED in every puzzle but the intro tutorial: constraints stating the frame; the cards in wrongFrame.cards must leave no state satisfying them.
//   wrongFrame.exempt   the intro tutorial only: a sentence saying why it has no wrongFrame.do.
//   l2Exempt            optional: a sentence (>= 15 characters) saying why the puzzle has no L2 step; lifts the "L2 >= 1" gate, and check prints it.
// Answer syntax (reply, view): one line, one entry per slot in slot order, entries split by ",", several tokens of one slot
// joined by "+", a token written as its id (its text also works), case-insensitive. Replies: format (unknown id, wrong
// number of entries, token twice, slot over capacity: not a check), incomplete (slots below their minimum, or fewer pieces than minPlaced; the count depends on the slot
// minimums and on how many pieces are placed, never on which piece is placed or whether it is required; an empty board is always incomplete, minPlaced defaulting to 1, and spends no check),
// wrong (every other board, near-solutions and wrong-frame boards included), found (n of K), solved.
// replyLeaks() proves it: a single piece alone, a near-solution (all cards but one) and a wrong-frame board are answered exactly like any other wrong board.
// Thresholds (LIMITS) are proposals from PUZZLE_DESIGN.md, adjusted with a reason: minSpace 241 because one solution found by
// random checks within 12 tries is 12/space, which is below 5% only from 241 valid states; slots 7 (was 6) because a weekday row
// has seven cells and wraps to two rows (the 320 px limit in PUZZLE_DESIGN.md counts tokens per row).
// Difficulty. L1: one round applies every card once to the previous round's domains (order independent), then tidies without
// cards (a placed token excludes others, a slot with no other candidate, count limits); L1 rounds = rounds that changed anything.
// L2: one refuted hypothesis (assume a placement, run L1, contradiction removes it) or two cards read together. check reports L1
// rounds, the longest L1 run (<= LIMITS.depth) and the fewest L2 actions that finish the puzzle (<= LIMITS.l2Max); nothing deeper
// is ever used, so a puzzle that needs more is rejected as "branching needed". requiredL2(id) is the chapter minimum.
// The bank may not follow the solution: |Spearman rho| < LIMITS.rho over the placed tokens, and no board filled in bank order wins.
// Placed and unplaced pieces may not alternate in the file order, the sorted id order or the shown order (a reader would spot the extras by position or by letter).
// Surface cues. surface(p) plays a player who reads no relation: (1) in an order puzzle it sorts the pieces by the numbers printed
// on them (token text, else the year of the card whose text names the piece by a word only that piece has), (2) it drops each
// piece into the slot whose label word or number appears on a card naming the piece. A board that is a solution fails the file
// as "readable from surface cues"; a card that shows a year and states an order fails too. A card of kind record whose text
// states a relation (between, before, after, next, same) that its evidence never states is a warning. In a mark or assign puzzle with
// dates for slots, the Roman day counts on the pieces are read too: the anchors on the cards (a Roman count next to a date, or one such anchor and a card
// saying the a.d. number goes down by one each day) give the mapping and every piece goes on its own date; the file fails as readable only when that board is itself a declared
// solution (a solution that leaves pieces out is not: the reader does not know which).
// A rule card's text must name what its constraint is about (tokens or slots), and no capitalised proper name may open a sentence.
// A card that only sorts single pieces into a class (used, unused, a lane of several slots, a slot that takes many) classifies them; the piece's text may not already say what it is ("giả thuyết", "lời đồn", "Người ta kể",
// "truyền thuyết", "chưa có nguồn", "thời ... tả"), or the player reads the class off the piece and never needs the card.
// Stub. "stub": true in a puzzle file, or "puzzles.mjs stub <file|id>", checks only the logic of a puzzle with placeholder text and
// no sources: structure, valid space, one solution, every card needed, L1/L2 difficulty, surface cues, the reply properties and every bot
// (the bank-order bot excepted while the stub's piece order is unshuffled). It prints the numbers the gates use.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.PUZZLES_DIR ?? join(root, 'story/puzzles');
const notebookDir = process.env.NOTEBOOK_DIR ?? join(root, 'story/notebook');

export const LIMITS = { minSpace: 241, cards: 5, tokens: 6, slots: 7, depth: 3, l2Max: 3, checks: 12, botP: 0.05, trials: 4000, tapTrials: 600, hintTiers: 5, cardWords: 25, lineWords: 25, sourcedNeeded: 2, rho: 0.4, fillRound: 3 };
const STATUS = ['fact', 'legend', 'disputed', 'rule', 'decoy'];
const KINDS = ['record', 'modern', 'retelling', 'hypothesis', 'inference', 'rule'];
export const FORMATS = ['G', 'P', 'T', 'D', 'E', 'M', 'W', 'C', 'I', 'N', 'A', 'O', 'L', 'R'];
const STAMPS = ['SỰ THẬT', 'TRUYỀN THUYẾT', 'TRANH CÃI', 'THEO KINH THÁNH', 'THEO TRUYỀN THỐNG', '—'];
const ACCEPT = ['fact', 'rule', 'disputed'];
const KIND = { record: 'bản ghi', modern: 'nhận định hiện đại', retelling: 'kể lại', hypothesis: 'giả thuyết', inference: 'suy ra', rule: 'luật chơi' };
const WEEKDAYS = [['chủ nhật', 'cn'], ['thứ hai', 't2'], ['thứ ba', 't3'], ['thứ tư', 't4'], ['thứ năm', 't5'], ['thứ sáu', 't6'], ['thứ bảy', 't7']];
const CONCLUSION = { 'SỰ THẬT': 'fact', 'TRANH CÃI': 'disputed', 'TRUYỀN THUYẾT': 'legend', 'CHƯA CÓ NGUỒN': 'decoy' };
const SLOT_WORDS = ['đầu tiên', 'đầu', 'cuối cùng', 'cuối', 'nhất', 'nhì', 'thứ \\p{L}+', 'trước', 'sau', 'giữa', 'cũ', 'mới', 'sớm', 'muộn', 'nấc', 'bậc', 'hàng', 'cột', 'ngăn', 'ô', 'vị trí', 'chỗ', 'mặt số', 'trên', 'dưới', 'trái', 'phải'];
const SHOWN = { fact: 'Sự thật', legend: 'Người ta kể rằng', disputed: 'Tranh cãi', rule: 'Luật chơi' };
const L = '(?<![\\p{L}\\p{M}\\p{N}])';
const R = '(?![\\p{L}\\p{M}\\p{N}])';
const word = (list) => new RegExp(L + '(?:' + list.join('|') + ')' + R, 'iu');
export const FAIL_WORDING = word(['game over', 'fails?', 'failed', 'failure', 'you lose', 'loses?', 'losing', 'lost', 'times? out', 'timed out', 'out of time', 'dies', 'dead', 'ends? the game', 'restarts?', 'start(?:s|ed)? over', 'defeat(?:s|ed)?', 'thua', 'hết giờ', 'chết', 'bắt đầu lại', 'sai rồi', 'thất bại']);
export const ADDRESS = word(['bạn']);
export const TABOO = word(['Nguồn đâu', 'Lord of Misrule', 'đại trà', 'mass-produced', 'biên niên', 'bánh xe mặt trời', 'khúc củi', 'Bê-lem', 'Giu-se', 'Ma-ri-a', 'Qui-ri-ni-ô', 'Li-bê-ri-ô', 'Hê-rô-đê', 'Bết-lê-hem', 'Giô-sép', 'Đức Chúa Jesus']);
const SLOT_RE = word(SLOT_WORDS);
const POINTS = new RegExp('(?:' + L + '(?:tìm|đọc|xem|mở)\\s+(?:lại\\s+)?thẻ|' + L + 'thẻ\\s*(?:số\\s*)?\\d)', 'iu');
const UI_PATH = /^(hints\[\d+\]\.text|wrongFrame\.(?:message|text)|rules\[\d+\]\.text|title|demo\.question|demo\.rules\[\d+\](?:\.text)?|reveal\.lines\[\d+\]|predict\.prompt|predict\.options\[\d+\]|antiGuess\.rule|question|conclusion\.template|conclusion\.bank\[\d+\]\.text|conclusion\.hints\[\d+\]\.text)$/;
const nfc = (s) => s.normalize('NFC');
const tidy = (s) => nfc(String(s ?? '')).replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\s+/g, ' ');
const flat = (s) => nfc(s).replace(/\s+/g, ' ').toLowerCase();
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s) => s.split(/(?<=[.!?…])\s+/).filter((x) => x.trim()).length;
const arr = (x) => (x === undefined || x === null ? [] : [].concat(x));
const range = (n) => Array.from({ length: n }, (_, i) => i);

export function load(id) {
  return JSON.parse(readFileSync(join(dir, id + '.json'), 'utf8'));
}

function* strings(o, path = '') {
  if (typeof o === 'string') yield [path, o];
  else if (Array.isArray(o)) for (const [i, v] of o.entries()) yield* strings(v, path + '[' + i + ']');
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) yield* strings(v, path ? path + '.' + k : k);
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s) => {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// The ids a page may show for the pieces of a board: a shuffle of the token positions that carries nothing of the file's ids or of the answer.
export function pieceIds(p) {
  const order = bankOrder({ id: p.id + ':piece-id', tokens: p.tokens.map((_, i) => ({ id: String(i) })) });
  return Object.fromEntries(p.tokens.map((t, i) => [t.id, order[i].id]));
}

export function bankOrder(p) {
  const r = rng(hash(p.id + ':' + (p.bankSeed ?? 0)));
  const a = p.tokens.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- model --------------------------------------------------------------
const statusOf = (p) => Object.fromEntries(p.tokens.map((t) => [t.id, t.status === 'decoy' ? (t.shows ?? 'fact') : t.status]));

export function model(p) {
  const T = p.tokens.length;
  const n = p.slots.length;
  const st = statusOf(p);
  const tid = p.tokens.map((t) => t.id);
  const cap = p.slots.map((s) => (s.cap === 'any' ? T : (s.cap ?? 1)));
  const min = p.slots.map((s) => s.min ?? (s.cap === undefined ? 1 : 0));
  const open = (t, ok) => [...(t.required ? [] : [0]), ...range(n).map((i) => i + 1).filter((s) => ok(s))];
  const allow = p.tokens.map((t) => open(t, () => true));
  const fit = p.tokens.map((t) => open(t, (s) => (p.slots[s - 1].accepts ?? ACCEPT).includes(st[t.id])));
  return { T, n, tid, fit, tix: Object.fromEntries(tid.map((t, i) => [t, i])), six: Object.fromEntries(p.slots.map((s, i) => [s.id, i + 1])), cap, min, allow, st };
}

export function states(p) {
  const M = model(p);
  const out = [];
  const v = new Array(M.T).fill(0);
  const cnt = new Array(M.n + 1).fill(0);
  const deficit = () => { let d = 0; for (let s = 1; s <= M.n; s++) d += Math.max(0, M.min[s - 1] - cnt[s]); return d; };
  const go = (i) => {
    if (deficit() > M.T - i) return;
    if (i === M.T) { out.push(v.slice()); return; }
    for (const s of M.allow[i]) {
      if (s && cnt[s] >= M.cap[s - 1]) continue;
      v[i] = s;
      if (s) cnt[s]++;
      go(i + 1);
      if (s) cnt[s]--;
    }
    v[i] = 0;
  };
  go(0);
  return out;
}

function validState(M, v) {
  const cnt = new Array(M.n + 1).fill(0);
  for (let i = 0; i < M.T; i++) { if (!M.allow[i].includes(v[i])) return false; if (v[i]) cnt[v[i]]++; }
  for (let s = 1; s <= M.n; s++) if (cnt[s] > M.cap[s - 1] || cnt[s] < M.min[s - 1]) return false;
  return true;
}

// A solution may never put a piece where its status does not belong (a legend piece in a fact slot); the UI never enforces it.
const legal = (M, v) => validState(M, v) && v.every((s, i) => M.fit[i].includes(s));

export function toState(p, ans) {
  const M = model(p);
  if (!Array.isArray(ans) || ans.length !== M.n) throw new Error('needs ' + M.n + ' entries');
  const v = new Array(M.T).fill(0);
  ans.forEach((e, i) => {
    for (const t of arr(e)) {
      const k = M.tix[t];
      if (k === undefined) throw new Error('unknown token ' + t);
      if (v[k]) throw new Error('token ' + t + ' placed twice');
      v[k] = i + 1;
    }
  });
  return v;
}

export function answerOf(p, v) {
  const M = model(p);
  return range(M.n).map((s) => {
    const ids = M.tid.filter((_, t) => v[t] === s + 1);
    return (p.slots[s].cap === undefined || p.slots[s].cap === 1) ? (ids[0] ?? null) : ids;
  });
}

export const answerText = (p, ans) => ans.map((e) => arr(e).join('+')).join(',');

// ---- constraints --------------------------------------------------------
const jdn = (y, m, d, cal = 'gregorian') => {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const base = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4);
  return cal === 'julian' ? base - 32083 : base - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
const FN = {
  add: (...a) => a.reduce((x, y) => x + y, 0), sub: (a, b) => a - b, mul: (...a) => a.reduce((x, y) => x * y, 1),
  mod: (a, b) => ((a % b) + b) % b, abs: Math.abs, min: Math.min, max: Math.max,
  eq: (a, b) => a === b, ne: (a, b) => a === a && b === b && a !== b, lt: (a, b) => a < b, le: (a, b) => a <= b, gt: (a, b) => a > b, ge: (a, b) => a >= b,
  and: (...a) => a.every(Boolean), or: (...a) => a.some(Boolean), not: (a) => !a, if: (c, a, b) => (c ? a : b),
  jdn, weekday: (y, m, d, cal) => (((jdn(y, m, d, cal) + 1) % 7) + 7) % 7,
};

function refsOf(e, out = []) {
  if (!Array.isArray(e)) return out;
  const add = (t) => { if (!out.includes(t)) out.push(t); };
  if (e[0] === 'count') e.slice(2).forEach(add);
  else if (['pos', 'slot', 'tok', 'placed'].includes(e[0])) add(e[1]);
  else for (const x of e.slice(1)) refsOf(x, out);
  return out;
}

function exprFn(e, refs, M, p) {
  const ri = Object.fromEntries(refs.map((t, i) => [t, i]));
  const tok = (t) => { if (!(t in M.tix)) throw new Error('unknown token ' + t); return t; };
  const build = (x) => {
    if (typeof x === 'number' || typeof x === 'boolean' || typeof x === 'string') return () => x;
    if (!Array.isArray(x)) throw new Error('bad expression ' + JSON.stringify(x));
    const [h, ...a] = x;
    if (h === 'pos') { const i = ri[tok(a[0])]; return (v) => v[i]; }
    if (h === 'placed') { const i = ri[tok(a[0])]; return (v) => v[i] > 0; }
    if (h === 'slot') { const i = ri[tok(a[0])]; return (v) => (v[i] > 0 ? (p.slots[v[i] - 1].value ?? v[i]) : NaN); }
    if (h === 'tok') { const val = p.tokens[M.tix[tok(a[0])]].value; return () => val; }
    if (h === 'count') {
      const s = M.six[a[0]];
      if (!s) throw new Error('unknown slot ' + a[0]);
      const idx = a.slice(1).map((t) => ri[tok(t)]);
      return (v) => idx.filter((i) => v[i] === s).length;
    }
    const f = FN[h];
    if (!f) throw new Error('unknown expression op ' + h);
    const fs = a.map(build);
    return (v) => f(...fs.map((g) => g(v)));
  };
  return build(e);
}

const within = (k, c) => (c.n === undefined || k === c.n) && (c.min === undefined || k >= c.min) && (c.max === undefined || k <= c.max);
export const OPS = {
  at: ([a], c) => a === c.s[0],
  notAt: ([a], c) => a !== c.s[0],
  oneOf: ([a], c) => c.s.includes(a),
  used: ([a]) => a > 0,
  unused: ([a]) => a === 0,
  before: ([a, b]) => a > 0 && b > 0 && a < b,
  next: ([a, b]) => a > 0 && b === a + 1,
  adjacent: ([a, b]) => a > 0 && b > 0 && Math.abs(a - b) === 1,
  notAdjacent: ([a, b]) => a > 0 && b > 0 && Math.abs(a - b) > 1,
  between: ([a, b, x]) => a > 0 && b > 0 && x > 0 && ((a < b && b < x) || (x < b && b < a)),
  same: ([a, b]) => a > 0 && a === b,
  differ: ([a, b]) => a > 0 && b > 0 && a !== b,
  count: (vals, c) => within(vals.filter((x) => x === c.s[0]).length, c),
  spaced: (vals) => { const at = vals.filter((x) => x > 0); return at.some((a, i) => at.some((b, j) => at.some((c, k) => i !== j && j !== k && i !== k && b - a === c - b && a < b))); },
  expr: (vals, c) => c.f(vals) === true,
};
export const registerOp = (name, fn) => { OPS[name] = fn; };

function mk(p, d) {
  const M = model(p);
  if (!OPS[d.op]) throw new Error('unknown op ' + d.op);
  const c = { ...d, s: arr(d.s).map((x) => M.six[x]) };
  if (c.s.some((x) => x === undefined)) throw new Error('unknown slot in ' + JSON.stringify(d));
  if (d.op === 'expr') { c.t = refsOf(d.e); c.f = exprFn(d.e, c.t, M, p); } else c.t = arr(d.t);
  c.ti = c.t.map((t) => { if (!(t in M.tix)) throw new Error('unknown token ' + t); return M.tix[t]; });
  if (new Set(c.t).size !== c.t.length) throw new Error('token repeated in one constraint ' + JSON.stringify(d));
  return c;
}

// Constraints grouped by their origin (one rule text or one card), in reading order.
export function compileGroups(p, active = new Set(p.cards.map((c) => c.id))) {
  const out = [];
  for (const [i, r] of (p.rules ?? []).entries()) out.push({ id: 'rule#' + (i + 1), cs: arr(r.do).map((d) => mk(p, d)) });
  for (const card of p.cards) if (active.has(card.id)) out.push({ id: card.id, cs: arr(card.do).map((d) => mk(p, d)) });
  return out;
}

export const compile = (p, active) => compileGroups(p, active).flatMap((g) => g.cs);

export const compileDo = (p, list) => arr(list).map((d) => mk(p, d));
const holds = (c, vals) => OPS[c.op](vals, c);
const satisfies = (cs, v) => cs.every((c) => holds(c, c.ti.map((i) => v[i])));

export function solutions(p, active, sts = states(p)) {
  const cs = compile(p, active);
  return sts.filter((v) => satisfies(cs, v));
}

export const allArrangements = (p) => states(p).map((v) => answerOf(p, v));

// ---- propagation: synchronous rounds -------------------------------------
// L1: every constraint alone (arc consistency) plus the counting rules, applied in synchronous rounds until nothing changes.
// L2: when L1 is stuck, one synchronous step eliminates (a) every value whose assumption makes L1 reach a contradiction
// (one-step hypothesis) and (b) every value no joint placement of two cards supports, then L1 runs again. Nothing deeper
// (no assumption inside an assumption, no guess kept) is ever used.
function engine(p) {
  const M = model(p);
  const { n, T, tid } = M;
  const groups = compileGroups(p);
  const cs = groups.flatMap((g) => g.cs);
  const D0 = M.allow.map((a) => new Set(a));
  const sumCap = M.cap.reduce((a, b) => a + b, 0);
  const sumMin = M.min.reduce((a, b) => a + b, 0);
  const cap1 = M.cap.every((c) => c === 1);
  const edges = cs.filter((c) => c.op === 'before').map((c) => c.ti);
  const reach = range(T).map(() => new Array(T).fill(false));
  for (const [a, b] of edges) reach[a][b] = true;
  for (const k of range(T)) for (const i of range(T)) for (const j of range(T)) if (reach[i][k] && reach[k][j]) reach[i][j] = true;
  if (range(T).some((i) => reach[i][i])) throw new Error('contradiction: before cycle');
  const lin = []; const lout = [];
  const chainIn = (t) => (lin[t] ??= Math.max(0, ...edges.filter(([, b]) => b === t).map(([a]) => chainIn(a) + 1)));
  const chainOut = (t) => (lout[t] ??= Math.max(0, ...edges.filter(([a]) => a === t).map(([, b]) => chainOut(b) + 1)));
  const lo = (t) => 1 + (cap1 ? range(T).filter((i) => reach[i][t]).length : chainIn(t));
  const hi = (t) => n - (cap1 ? reach[t].filter(Boolean).length : chainOut(t));
  const ordered = (t) => edges.some(([a, b]) => a === t || b === t);
  const fixedAt = (D, t) => (D[t].size === 1 && !D[t].has(0) ? [...D[t]][0] : 0);
  const capOf = (U) => [...U].reduce((a, s) => a + (s ? M.cap[s - 1] : 0), 0);
  const del = (D, t, drop) => {
    let ch = false;
    for (const v of [...D[t]]) if (drop(v)) { D[t].delete(v); ch = true; }
    if (!D[t].size) throw new Error('contradiction at ' + tid[t]);
    return ch;
  };

  const tidy = (D) => {
    let any = false;
    for (let ch = true; ch;) {
      ch = false;
      for (let s = 1; s <= n; s++) {
        const here = range(T).filter((t) => fixedAt(D, t) === s).length;
        if (here > M.cap[s - 1]) throw new Error('contradiction: slot ' + s + ' overfull');
        if (here === M.cap[s - 1]) for (const t of range(T)) if (fixedAt(D, t) !== s && D[t].has(s)) ch = del(D, t, (v) => v === s) || ch;
        const who = range(T).filter((t) => D[t].has(s));
        if (who.length < M.min[s - 1]) throw new Error('contradiction: slot ' + s + ' has too few candidates');
        if (M.min[s - 1] > 0 && who.length === M.min[s - 1]) for (const t of who) if (D[t].size > 1) ch = del(D, t, (v) => v !== s) || ch;
      }
      const must = range(T).filter((t) => !D[t].has(0));
      if (must.length > sumCap) throw new Error('contradiction: too many tokens must be placed');
      if (must.length === sumCap) for (const t of range(T)) if (D[t].has(0) && D[t].size > 1) ch = del(D, t, (v) => v !== 0) || ch;
      const can = range(T).filter((t) => !(D[t].size === 1 && D[t].has(0)));
      if (can.length < sumMin) throw new Error('contradiction: too few tokens can be placed');
      if (can.length === sumMin) for (const t of can) if (D[t].has(0)) ch = del(D, t, (v) => v === 0) || ch;
      any = any || ch;
    }
    return any;
  };

  const round = (snap) => {
    const next = snap.map((s) => new Set(s));
    const keep = (t, ok) => { for (const v of [...next[t]]) if (!ok(v)) next[t].delete(v); };
    for (const c of cs) {
      const supp = c.ti.map(() => new Set());
      const vals = [];
      const go = (i) => {
        if (i === c.ti.length) { if (holds(c, vals)) vals.forEach((v, j) => supp[j].add(v)); return; }
        for (const v of snap[c.ti[i]]) {
          if (v && vals.slice(0, i).filter((x) => x === v).length >= M.cap[v - 1]) continue;
          vals[i] = v;
          go(i + 1);
        }
        vals.length = i;
      };
      go(0);
      c.ti.forEach((t, j) => keep(t, (v) => supp[j].has(v)));
    }
    for (const t of range(T)) if (ordered(t)) keep(t, (v) => v >= lo(t) && v <= hi(t));
    for (let m = 1; m < 1 << T; m++) {
      const sub = range(T).filter((i) => m & (1 << i));
      if (sub.length < 2 || sub.some((t) => snap[t].has(0))) continue;
      const U = new Set(sub.flatMap((t) => [...snap[t]]));
      if (capOf(U) < sub.length) throw new Error('contradiction (Hall)');
      if (capOf(U) === sub.length) for (const u of range(T)) if (!sub.includes(u)) keep(u, (v) => !U.has(v));
    }
    if (next.some((s) => !s.size)) throw new Error('contradiction at ' + tid[next.findIndex((s) => !s.size)]);
    const changedA = next.some((s, t) => s.size !== snap[t].size);
    return { D: next, changed: tidy(next) || changedA };
  };

  // L1 to a fixpoint from the domains "from" (copied). "seen" holds the tokens already reported as placed.
  const closure = (from, seen = new Set(), first = false) => {
    let D = from.map((s) => new Set(s));
    const log = [];
    let rounds = 0;
    let forced = 0;
    for (let r = 1; r <= 40; r++) {
      const before = D;
      const res = round(D);
      D = res.D;
      if (r === 1) forced = range(T).filter((t) => before[t].size > 1 && D[t].size === 1 && !D[t].has(0)).length;
      const now = range(T).filter((t) => fixedAt(D, t) && !seen.has(t));
      now.forEach((t) => seen.add(t));
      if (res.changed) rounds++;
      if (res.changed || (first && r === 1)) log.push({ round: r, newlyFixed: now.map((t) => tid[t] + '=' + fixedAt(D, t)) });
      if (!res.changed) break;
    }
    return { D, rounds, log, forced };
  };

  // Every L2 action available at the domains D: one refuted hypothesis, or one pair of cards read together.
  // An action is { via, label, drop: Map token index -> Set of values it removes }.
  const actions = (D) => {
    const out = [];
    for (const t of range(T)) {
      if (D[t].size < 2) continue;
      for (const v of D[t]) {
        const X = D.map((s) => new Set(s));
        X[t] = new Set([v]);
        try { closure(X); } catch { out.push({ via: 'hypothesis', label: tid[t] + '≠' + v, drop: new Map([[t, new Set([v])]]) }); }
      }
    }
    const lists = groups.filter((g) => g.cs.length);
    for (let i = 0; i < lists.length; i++) {
      for (let j = i; j < lists.length; j++) {
        const cl = i === j ? lists[i].cs : lists[i].cs.concat(lists[j].cs);
        const tokens = [...new Set(cl.flatMap((c) => c.ti))].sort((a, b) => a - b);
        if (tokens.every((t) => D[t].size < 2)) continue;
        const pos = Object.fromEntries(tokens.map((t, k) => [t, k]));
        const last = cl.map((c) => Math.max(...c.ti.map((t) => pos[t])));
        const supp = tokens.map(() => new Set());
        const v = new Array(T).fill(-1);
        const cnt = new Array(n + 1).fill(0);
        const go = (k) => {
          if (k === tokens.length) { tokens.forEach((t, x) => supp[x].add(v[t])); return; }
          const t = tokens[k];
          for (const val of D[t]) {
            if (val && cnt[val] >= M.cap[val - 1]) continue;
            v[t] = val;
            if (val) cnt[val]++;
            if (cl.every((c, x) => last[x] !== k || holds(c, c.ti.map((q) => v[q])))) go(k + 1);
            if (val) cnt[val]--;
          }
          v[t] = -1;
        };
        go(0);
        const gone = new Map(tokens.map((t, x) => [t, new Set([...D[t]].filter((val) => !supp[x].has(val)))]).filter(([, s]) => s.size));
        if (gone.size) out.push({ via: 'joint', label: lists[i].id + (i === j ? '' : '+' + lists[j].id), drop: gone });
      }
    }
    return out;
  };
  return { M, cs, groups, D0, closure, actions };
}

export function propagate(p) {
  const E = engine(p);
  const r = E.closure(E.D0, new Set(), true);
  const first = r.log.find((x) => x.newlyFixed.length);
  return { dom: Object.fromEntries(E.M.tid.map((t, i) => [t, [...r.D[i]].sort((a, b) => a - b)])), log: r.log, depth: r.rounds, entry: r.log[0]?.newlyFixed.length ?? 0, forced: r.forced, firstFixedRound: first ? first.round : Infinity };
}

// Difficulty. l1 = L1 rounds that changed something in the main line, run = the longest stretch of L1 rounds between two L2 actions; l2 = the fewest L2 actions (one refuted hypothesis, or
// one pair of cards read together, each followed by L1) after which L1 finishes the puzzle, found by breadth-first search
// up to LIMITS.l2Max. Nothing depends on card order. solved: L1 and L2 together reach the target at all; deep: that takes
// more than LIMITS.l2Max actions. target: token id -> slots still allowed at the end (default: one value each).
export function solveLevels(p, target) {
  const E = engine(p);
  const { M } = E;
  const sorted = (s) => JSON.stringify([...s].sort((a, b) => a - b));
  const done = (D) => M.tid.every((t, i) => (target ? sorted(D[i]) === JSON.stringify(target[t]) : D[i].size === 1));
  const dom = (D) => Object.fromEntries(M.tid.map((t, i) => [t, [...D[i]].sort((a, b) => a - b)]));
  const sig = (D) => D.map((s) => [...s].sort((a, b) => a - b).join('.')).join('|');
  const apply = (D, a) => {
    const X = D.map((s) => new Set(s));
    for (const [t, vs] of a.drop) { for (const v of vs) X[t].delete(v); if (!X[t].size) throw new Error('contradiction at ' + M.tid[t]); }
    return X;
  };
  const seen = new Set();
  const r0 = E.closure(E.D0, seen, true);
  const log = r0.log.map((x) => ({ level: 'L1', ...x }));
  const base = { l1: r0.rounds, run: r0.rounds, log, forced: r0.forced };
  if (done(r0.D)) return { ...base, solved: true, deep: false, l2: 0, path: [], dom: dom(r0.D) };
  let level = [{ D: r0.D, path: [], l1: r0.rounds, run: r0.rounds }];
  const known = new Set([sig(r0.D)]);
  for (let k = 1; k <= LIMITS.l2Max; k++) {
    const next = [];
    for (const node of level) {
      for (const a of E.actions(node.D)) {
        const c = E.closure(apply(node.D, a), new Set(seen));
        const s = sig(c.D);
        if (known.has(s)) continue;
        known.add(s);
        const path = node.path.concat(a.via + ' ' + a.label);
        const run = Math.max(node.run, c.rounds);
        if (done(c.D)) return { ...base, l1: node.l1 + c.rounds, run, solved: true, deep: false, l2: k, path, dom: dom(c.D) };
        next.push({ D: c.D, path, l1: node.l1 + c.rounds, run });
      }
    }
    if (!next.length) break;
    level = next;
  }
  let D = r0.D;
  for (let k = 0; k < 40; k++) {
    const acts = E.actions(D);
    if (!acts.length) break;
    for (const a of acts) D = apply(D, a);
    D = E.closure(D, new Set(seen)).D;
    if (done(D)) return { ...base, solved: true, deep: true, l2: LIMITS.l2Max + 1, path: [], dom: dom(D) };
  }
  return { ...base, solved: false, deep: false, l2: Infinity, path: [], dom: dom(D) };
}

// ---- UI feedback model (whole answer only) --------------------------------
const norm = (s) => nfc(String(s)).trim().toLowerCase();

export function parseBoard(p, input) {
  const M = model(p);
  const raw = typeof input === 'string' ? input.split(',') : input;
  if (raw.length !== M.n) return { type: 'format', reason: 'count', expected: M.n, got: raw.length };
  const byName = new Map();
  for (const [i, t] of p.tokens.entries()) byName.set(norm(t.id), i);
  for (const [i, t] of p.tokens.entries()) if (!byName.has(norm(t.text))) byName.set(norm(t.text), i);
  const v = new Array(M.T).fill(0);
  const cnt = new Array(M.n + 1).fill(0);
  for (let s = 1; s <= M.n; s++) {
    const cell = raw[s - 1];
    const names = (Array.isArray(cell) ? cell : cell == null ? [] : String(cell).split('+')).filter((x) => x != null && String(x).trim() !== '');
    for (const name of names) {
      const t = byName.get(norm(name));
      if (t === undefined) return { type: 'format', reason: 'unknown', id: String(name).trim() };
      if (v[t]) return { type: 'format', reason: 'duplicate', id: M.tid[t] };
      v[t] = s;
      cnt[s]++;
    }
    if (cnt[s] > M.cap[s - 1]) return { type: 'format', reason: 'capacity' };
  }
  let empty = 0;
  for (let s = 1; s <= M.n; s++) empty += Math.max(0, M.min[s - 1] - cnt[s]);
  if (!empty) empty = Math.max(0, (p.minPlaced ?? 1) - v.filter(Boolean).length);
  return { v, empty };
}

function trapTest(p) {
  const M = model(p);
  const entries = Object.entries(p.wrongFrame?.trap ?? {}).map(([s, ts]) => [M.six[s], arr(ts).map((t) => M.tix[t])]);
  const named = new Set(entries.flatMap(([, ts]) => ts));
  const exact = p.wrongFrame?.exact === true;
  return (v) => entries.length > 0 && entries.every(([s, ts]) => ts.every((t) => v[t] === s)) && (!exact || range(M.T).every((t) => named.has(t) || p.tokens[t].required || !v[t]));
}

export function reply(p, input, found = new Set()) {
  const b = parseBoard(p, input);
  if (b.type) return b;
  if (b.empty) return { type: 'incomplete', empty: b.empty };
  const K = p.solutions.length;
  if (validState(model(p), b.v) && solutions(p, undefined, [b.v]).length) {
    found.add(b.v.join(','));
    return found.size >= K ? { type: 'solved' } : { type: 'found', n: found.size, of: K };
  }
  return { type: 'wrong' };
}

const sample = (xs, n) => (xs.length <= n ? xs : range(n).map((i) => xs[Math.floor((i * xs.length) / n)]));

// What the UI answers must say nothing the player has not proved. Problems found: a single piece alone is answered differently from another piece in the same slot
// (the reply tells which pieces are needed), or a valid board that is no solution (a near-solution that breaks one card, a wrong-frame board, any other) is answered
// with anything but a plain wrong (the empty board is the one exception: it is answered "incomplete" and never a check). "ask" is the reply function to test.
export function replyLeaks(p, ask = reply, sts = states(p)) {
  const M = model(p);
  const out = [];
  const board = (v) => answerOf(p, v);
  for (let s = 1; s <= M.n; s++) {
    const seen = new Map();
    for (let t = 0; t < M.T; t++) {
      const v = new Array(M.T).fill(0);
      v[t] = s;
      const key = JSON.stringify(ask(p, board(v)));
      seen.set(key, [...(seen.get(key) ?? []), M.tid[t]]);
    }
    if (seen.size > 1) out.push('a single piece alone in slot ' + p.slots[s - 1].id + ' is answered differently by piece: ' + [...seen].map(([k, ts]) => ts.join('+') + ' ' + k).join(' | '));
  }
  const cards = p.cards.map((c) => c.id);
  const sols = new Set(solutions(p, undefined, sts).map((v) => v.join(',')));
  const lists = [['wrong-frame board', sts.filter(trapTest(p))], ['board', sts]];
  for (const c of cards) lists.push(['near-solution without card ' + c, solutions(p, new Set(cards.filter((x) => x !== c)), sts)]);
  for (const [what, list] of lists) {
    for (const v of sample(list.filter((x) => !sols.has(x.join(',')) && x.some(Boolean)), 60)) {
      const r = ask(p, board(v));
      if (JSON.stringify(r) !== JSON.stringify({ type: 'wrong' })) { out.push(what + ' ' + answerText(p, board(v)) + ' is answered ' + JSON.stringify(r) + ', not a plain wrong'); break; }
    }
  }
  return out;
}

export function helpAnswer(p, found = new Set()) {
  return p.solutions.find((s) => !found.has(toState(p, s).join(','))) ?? p.solutions[0];
}

function fill(p, order, robin) {
  const M = model(p);
  const v = new Array(M.T).fill(0);
  const cnt = new Array(M.n + 1).fill(0);
  let cur = 0;
  for (const id of order) {
    const t = M.tix[id];
    const slots = range(M.n).map((i) => i + 1);
    const tryList = robin ? slots.slice(cur).concat(slots.slice(0, cur)) : slots;
    const s = tryList.find((x) => cnt[x] < M.cap[x - 1] && M.allow[t].includes(x));
    if (s) { v[t] = s; cnt[s]++; if (robin) cur = s % M.n; }
  }
  return v;
}

// The boards a player gets by dropping the bank in order: first fit, round robin, equal blocks (for slots that take many).
function blocks(p, order) {
  const M = model(p);
  const v = new Array(M.T).fill(0);
  const cnt = new Array(M.n + 1).fill(0);
  let s = 1;
  let left = order.length;
  const target = (x) => Math.min(M.cap[x - 1], Math.ceil(left / (M.n - x + 1)));
  for (const id of order) {
    const t = M.tix[id];
    while (s < M.n && cnt[s] >= target(s)) s++;
    const slot = range(M.n).map((i) => i + 1).find((x) => x >= s && cnt[x] < M.cap[x - 1] && M.allow[t].includes(x));
    if (slot) { v[t] = slot; cnt[slot]++; }
    left--;
  }
  return v;
}

function bankOrders(p) {
  const ids = p.tokens.map((t) => t.id);
  const shown = bankOrder(p).map((t) => t.id);
  return [['file order', ids], ['reversed file order', ids.slice().reverse()], ['shown order', shown], ['reversed shown order', shown.slice().reverse()]];
}

export function bankBoards(p) {
  return bankOrders(p).flatMap(([name, o]) => [[name, fill(p, o, false)], [name + ' (round robin)', fill(p, o, true)], [name + ' (in blocks)', blocks(p, o)]]);
}

// Bank orders that hand over a solution: a board filled in bank order is a solution, or the placed tokens of a solution
// follow the bank in rising or falling slot order (so a bank sorted by the answer is caught even for slots that take many).
export function bankFlags(p, decl = p.solutions.map((s) => toState(p, s))) {
  const M = model(p);
  const key = (v) => v.join(',');
  const out = [];
  for (const [label, v] of bankBoards(p)) if (decl.some((d) => key(d) === key(v))) out.push(label);
  for (const [name, o] of bankOrders(p)) {
    for (const d of decl) {
      const seq = o.map((id) => d[M.tix[id]]).filter(Boolean);
      if (seq.length >= 3 && (seq.every((x, i) => i === 0 || x >= seq[i - 1]) || seq.every((x, i) => i === 0 || x <= seq[i - 1]))) out.push(name + ' (placed pieces in answer order)');
    }
  }
  for (const [name, o] of [...bankOrders(p), ['id order', p.tokens.map((t) => t.id).sort()]]) {
    for (const d of decl) {
      const flags = o.map((id) => d[M.tix[id]] > 0);
      const placed = flags.filter(Boolean).length;
      if (Math.min(placed, flags.length - placed) >= 2 && flags.every((x, i) => i === 0 || x !== flags[i - 1])) out.push(name + ' (placed and unplaced pieces alternate)');
    }
  }
  return [...new Set(out)];
}

const ranks = (xs) => xs.map((x) => { const less = xs.filter((y) => y < x).length; const same = xs.filter((y) => y === x).length; return less + (same + 1) / 2; });
export function spearman(xs, ys) {
  const a = ranks(xs);
  const b = ranks(ys);
  const ma = a.reduce((x, y) => x + y, 0) / a.length;
  const mb = b.reduce((x, y) => x + y, 0) / b.length;
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0);
  return va && vb ? cov / Math.sqrt(va * vb) : 0;
}

// Largest |Spearman rho| between the shown bank order and a declared solution's slots over the placed tokens (null: fewer than 4
// placed; with 3 points rho is only ever +-0.5 or +-1, so the limit would forbid every board; bankFlags still guards the order).
export function bankRho(p, decl = p.solutions.map((s) => toState(p, s))) {
  const M = model(p);
  const shown = bankOrder(p).map((t) => M.tix[t.id]);
  let best = null;
  for (const d of decl) {
    const placed = shown.filter((t) => d[t]);
    if (placed.length < 4) continue;
    const r = Math.abs(spearman(placed.map((_, i) => i), placed.map((t) => d[t])));
    best = best === null ? r : Math.max(best, r);
  }
  return best;
}

const weekdayIndex = (name) => WEEKDAYS.findIndex((w) => w.includes(flat(String(name)).trim()));

// Chapter by chapter minimum of L2 steps: acts 3 and 4 and the ending need two, every other chapter one. A puzzle file may carry l2Exempt, a written reason
// (>= 15 characters) why it has no L2 step; the checker then needs none and prints the reason.
export const l2Exemption = (p) => (typeof p?.l2Exempt === 'string' && p.l2Exempt.trim().length >= 15 ? p.l2Exempt.trim() : null);
export const requiredSteps = (id, act, exempt = false) => (exempt ? 0 : id === 'ending' || act >= 3 ? 2 : 1);
export function requiredL2(id, p) {
  let act;
  let exempt = null;
  try { act = JSON.parse(readFileSync(join(root, 'story/minigames.json'), 'utf8')).find((r) => r.id === id)?.act; } catch { act = undefined; }
  try { exempt = l2Exemption(p ?? JSON.parse(readFileSync(join(root, 'story/puzzles', id + '.json'), 'utf8'))); } catch { exempt = null; }
  return requiredSteps(id, act, exempt !== null);
}

// A history card smuggled in as a game rule: no year, no capitalised name (outside the intro).
const isRule = (c) => c.status === 'rule' || c.kind === 'rule';
function ruleCards(p, err) {
  if (p.id === 'intro') return;
  const mid = /(?<=[\p{Ll}\p{N},;:] )\p{Lu}[\p{L}\p{M}]*/gu;
  const lowerSeen = new Set();
  const skip = new Set(p.cards.filter(isRule).map((c) => c.text));
  for (const [path, s] of strings(p)) {
    if (skip.has(s) || /(^|\.)(url|source|evidence|id)(\[\d+\])?$/.test(path)) continue;
    for (const m of s.matchAll(/(?<![\p{L}\p{M}\p{N}])\p{Ll}[\p{L}\p{M}]*/gu)) lowerSeen.add(flat(m[0]));
  }
  const known = new Set();
  for (const x of [...p.cards.filter((c) => c.status !== 'rule'), ...p.tokens]) for (const m of String(x.text ?? '').matchAll(mid)) known.add(m[0]);
  for (const c of p.cards) {
    if (!isRule(c)) continue;
    const text = String(c.text ?? '');
    const year = text.match(/(?<![\p{L}\p{N}\/.,])\d{3,4}(?![\p{L}\p{N}\/])/u);
    if (year) err('rule card ' + c.id + ' carries the number ' + year[0] + ': a year or date belongs on a sourced card, not on a game rule');
    const opening = [...text.matchAll(/(?:^|[.!?…]\s+)(\p{Lu}[\p{L}\p{M}]*)/gu)].map((m) => m[1]).filter((w) => !lowerSeen.has(flat(w)));
    const names = [...text.matchAll(mid)].map((m) => m[0]).concat(opening, [...known].filter((n) => new RegExp(L + n + R, 'u').test(text)));
    if (names.length) err('rule card ' + c.id + ' carries the proper name ' + names[0] + ': names belong on sourced cards, not on a game rule');
  }
}

// A rule card's text must name what its constraint is about: for each constraint, at least two of its pieces and slots
// (one when it constrains a single piece), by a word only that piece or slot has (a number for a numbered one).
const STOP = new Set(['các', 'một', 'những', 'không', 'được', 'trong', 'này', 'cho', 'với', 'của', 'khi', 'nào', 'đều', 'hơn', 'ngay', 'nhưng', 'nên', 'cũng', 'theo', 'rằng', 'thì', 'đến', 'tới', 'chỉ', 'còn', 'mỗi', 'bên', 'phải']);
const wordsOf = (s) => flat(String(s ?? '')).split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
const keysOf = (s) => wordsOf(s).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOP.has(w));
const unique = (lists) => {
  const df = {};
  for (const ws of lists) for (const w of new Set(ws)) df[w] = (df[w] ?? 0) + 1;
  return lists.map((ws) => [...new Set(ws)].filter((w) => df[w] === 1));
};
const labelKeys = (p) => unique(p.slots.map((s) => wordsOf(s.label ?? s.id))).map((ws) => ws.filter((w) => /^\d+$/.test(w) || (w.length >= 3 && !STOP.has(w))));
const YEAR = /(?<![\p{L}\p{N}\/.,])(?:\d{1,2}\/\d{1,2}\/)?(\d{3,4})(?![\p{L}\p{N}\/])/gu;
export const yearsIn = (s) => [...String(s ?? '').matchAll(YEAR)].map((m) => Number(m[1]));

function ruleExpress(p, err) {
  const M = model(p);
  const own = unique(p.tokens.map((t) => wordsOf(t.text ?? t.id).filter((w) => /^\d+$/.test(w) || (w.length >= 3 && !STOP.has(w)))));
  const lab = labelKeys(p);
  for (const c of p.cards) {
    if (!isRule(c)) continue;
    const said = new Set(wordsOf(c.text));
    for (const d of arr(c.do)) {
      let k;
      try { k = mk(p, d); } catch { continue; }
      const tokens = k.t.filter((t) => !own[M.tix[t]].length || own[M.tix[t]].some((w) => said.has(w)));
      const slots = arr(d.s).filter((s) => lab[M.six[s] - 1].some((w) => said.has(w)));
      const need = k.t.length >= 2 ? 2 : 1;
      if (tokens.length + slots.length < need) err('rule card ' + c.id + ' does not express its constraint (' + d.op + ' ' + JSON.stringify(d.t ?? d.e) + '): its text names ' + (tokens.length + slots.length) + ' of the pieces and slots it constrains, ' + need + ' needed; a rule text must say what it is about');
    }
  }
}

const ROMAN = /(?<![\p{L}\p{N}])(?=[IVXLCDM]{2,}(?![\p{L}\p{N}]))M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})(?![\p{L}\p{N}])/gu;
const AD = /a\.d\.\s*((?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))(?![\p{L}\p{N}])/gu;
const DATE = /(?<![\p{L}\p{N}])(\d{1,2})\/(\d{1,2})(?![\p{L}\p{N}\/])/gu;
export const romanValue = (r) => [...String(r).toUpperCase()].reduce((sum, ch, i, a) => { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; return sum + (i + 1 < a.length && v[ch] < v[a[i + 1]] ? -v[ch] : v[ch]); }, 0);
// Roman numerals a text shows: after "a.d." (any length) or standing alone with two letters or more.
export const romansIn = (s) => [...new Set([...String(s ?? '').matchAll(AD)].map((m) => romanValue(m[1])).concat([...String(s ?? '').matchAll(ROMAN)].map((m) => romanValue(m[0]))))];
const dateKey = (label) => { const m = String(label ?? '').match(/^\s*(\d{1,2})\/(\d{1,2})/); return m ? [Number(m[1]), Number(m[2])] : null; };

// A mark or assign puzzle with dates for slots and Roman day counts on the pieces: the player reads the mapping off the anchors the
// cards give (a Roman count next to a date; a second anchor is a card saying the a.d. number goes down by one, or up by one, each day)
// and drops every piece on its own date. Returns that board.
export function romanBoard(p, cards) {
  const slots = p.slots.map((s) => dateKey(s.label));
  if (p.input === 'order' || slots.filter(Boolean).length < 2) return null;
  const anchors = [];
  for (const c of cards) {
    const text = [c.text, c.who].join(' ');
    const dates = [...text.matchAll(DATE)].map((m) => ({ at: m.index, day: Number(m[1]), month: Number(m[2]) }));
    for (const m of text.matchAll(AD)) {
      const near = dates.slice().sort((a, b) => Math.abs(a.at - m.index) - Math.abs(b.at - m.index))[0];
      if (near) anchors.push({ n: romanValue(m[1]), ...near });
    }
  }
  const month = anchors[0]?.month;
  const pairs = anchors.filter((a) => a.month === month);
  const saysStep = (re) => cards.some((c) => re.test(String(c.text ?? '')));
  const down = saysStep(/a\.d\.\s+(?:nhỏ đi|giảm đi|giảm)\s+(?:một|1)(?![\p{L}\p{N}])/iu);
  const up = saysStep(/a\.d\.\s+(?:lớn thêm|tăng thêm|tăng)\s+(?:một|1)(?![\p{L}\p{N}])/iu);
  const step = new Set(pairs.map((a) => a.n)).size >= 2 ? undefined : down !== up ? (down ? -1 : 1) : null;
  if (!pairs.length || step === null) return null;
  const fits = step ?? [-1, 1].find((k) => pairs.every((a) => a.day - k * a.n === pairs[0].day - k * pairs[0].n));
  if (fits === undefined) return null;
  const base = pairs[0].day - fits * pairs[0].n;
  return p.tokens.map((t) => {
    const n = romansIn(t.text)[0];
    if (n === undefined) return 0;
    const at = slots.findIndex((k) => k && k[1] === month && k[0] === base + fits * n);
    return at < 0 ? 0 : at + 1;
  });
}

// What a player sees without reading any relation. number: the pieces sorted by the numbers on the page (in an order puzzle);
// keyword: every piece put in the slot whose label word or number a card naming that piece also carries.
export function surface(p, decl = p.solutions.map((s) => toState(p, s))) {
  const M = model(p);
  const own = unique(p.tokens.map((t) => keysOf(t.text ?? t.id)));
  const cards = p.cards.map((c) => { const text = [c.text, c.who].join(' '); return { c, key: new Set(keysOf(text)), all: new Set(wordsOf(text)) }; });
  const cardYears = (c) => { const w = yearsIn(c.when); return w.length ? w : yearsIn([c.text, c.who].join(' ')); };
  const nums = p.tokens.map((t, i) => {
    const mine = [...yearsIn(t.text), ...romansIn(t.text)];
    if (mine.length) return [...new Set(mine)];
    const score = cards.map((x) => own[i].filter((w) => x.key.has(w)).length);
    const top = Math.max(0, ...score);
    return top ? [...new Set(cards.flatMap((x, k) => (score[k] === top ? cardYears(x.c) : [])))] : [];
  });
  const sortable = (d) => {
    const placed = range(M.T).filter((i) => d[i]);
    const have = placed.filter((i) => nums[i].length);
    if (have.length < 3 || placed.length - have.length > 1) return false;
    const agree = (dir, a, na, b, nb) => (d[a] < d[b] ? dir * na < dir * nb : d[a] > d[b] ? dir * na > dir * nb : na === nb);
    return [1, -1].some((dir) => {
      const pick = (k, chosen) => k === have.length || nums[have[k]].some((n) => have.slice(0, k).every((a, x) => agree(dir, a, chosen[x], have[k], n)) && pick(k + 1, [...chosen, n]));
      return pick(0, []);
    });
  };
  const slotKey = labelKeys(p);
  const board = p.tokens.map((_, i) => {
    const hit = new Set();
    for (const x of cards) if (own[i].some((w) => x.key.has(w))) p.slots.forEach((_s, s) => { if (slotKey[s].some((w) => x.all.has(w))) hit.add(s + 1); });
    return hit.size === 1 ? [...hit][0] : 0;
  });
  const read = romanBoard(p, cards.map((x) => x.c));
  return { number: p.input === 'order' && decl.some(sortable), keyword: decl.some((d) => d.join(',') === board.join(',')), roman: read !== null && decl.some((d) => d.join(',') === read.join(',')) };
}

const ORDERING = ['before', 'next', 'adjacent', 'notAdjacent', 'between', 'expr'];
function yearCards(p, err) {
  if (p.input !== 'order' || p.history === 'none') return;
  for (const c of p.cards) {
    if (!arr(c.do).some((d) => ORDERING.includes(d.op))) continue;
    const years = yearsIn([c.when, c.text, c.who].join(' '));
    if (c.when || years.length) err('card ' + c.id + ' states an order and shows ' + (c.when ? 'when "' + c.when + '"' : 'the year ' + years[0]) + ' in an ordering puzzle: the order can be read from the number; a year may stay only on a card that states no order');
  }
}

const RELATION = [
  [['giữa'], /between|mid/i],
  [['trước', 'sớm', 'cũ hơn', 'đầu tiên', 'cổ nhất'], /before|earl|first|oldest|preced|prior/i],
  [['sau', 'muộn', 'mới hơn', 'mới nhất', 'cuối cùng'], /after|later|latest|by \d|until|follow|since|then|last/i],
  [['liền', 'kề', 'xen'], /next|adjacent|immediate|consecutive|follow|between/i],
  [['cùng nấc', 'cùng lúc', 'cùng thời', 'cùng một'], /same|both|together|alongside|simultan|and/i],
];
function relationWarnings(p, warn) {
  for (const c of p.cards) {
    if (c.kind !== 'record') continue;
    const evidence = arr(c.evidence).join(' ');
    for (const [say, see] of RELATION) {
      const hit = say.find((w) => new RegExp(L + w + R + (w === 'giữa' ? '.*\\svà\\s' : ''), 'iu').test(nfc(String(c.text ?? ''))));
      if (hit && !see.test(evidence)) warn('card ' + c.id + ' (record, ' + (c.who ?? 'no speaker') + ') says "' + hit + '" but its evidence never states that relation: a relation the game works out is an inference, not a historian\'s record');
    }
  }
}

// ---- bots: only what the UI answers (found, incomplete, wrong) -------
function neighbours(M, v) {
  const res = [];
  for (let i = 0; i < M.T; i++) {
    for (let j = i + 1; j < M.T; j++) if (v[i] !== v[j]) { const w = v.slice(); w[i] = v[j]; w[j] = v[i]; if (validState(M, w)) res.push(w); }
    for (let s = 0; s <= M.n; s++) if (s !== v[i]) { const w = v.slice(); w[i] = s; if (validState(M, w)) res.push(w); }
  }
  return res;
}

export function bots(p, sts = states(p), decl = p.solutions.map((s) => toState(p, s))) {
  const M = model(p);
  const rand = rng(20261118);
  const base = M.n + 1;
  const code = (v) => v.reduce((a, x, i) => a + x * base ** i, 0);
  const solSet = new Set(decl.map(code));
  const K = decl.length;
  const N = sts.length;
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const fresh = (tried) => { for (let k = 0; k < 10000; k++) { const v = pick(sts); if (!tried.has(code(v))) return v; } return null; };
  const play = (make, trials = LIMITS.trials) => {
    let wins = 0;
    for (let k = 0; k < trials; k++) {
      const bot = make();
      const got = new Set();
      const tried = new Set();
      for (let c = 0; c < LIMITS.checks && got.size < K && tried.size < N; c++) {
        const v = bot.next(tried, got, c);
        if (!v) break;
        const cd = code(v);
        tried.add(cd);
        const fb = solSet.has(cd) ? 'found' : 'wrong';
        if (fb === 'found') got.add(cd);
        bot.see?.(v, fb);
      }
      if (got.size >= K) wins++;
    }
    return wins / trials;
  };
  const walk = (cur, tried) => { const free = neighbours(M, cur).filter((w) => !tried.has(code(w))); return free.length ? pick(free) : fresh(tried); };
  const result = {};
  result.random = play(() => ({ next: (tried) => fresh(tried) }));
  result.mash = play(() => ({ next: () => pick(sts) }));
  result.hill = play(() => { let cur = null; return { next: (tried) => (cur = cur ? walk(cur, tried) : fresh(tried)) }; });
  result.local = play(() => {
    const centers = [];
    return {
      next: (tried, got, c) => {
        if (c === 0 && K > 1) return pick(decl);
        while (centers.length) {
          const free = neighbours(M, centers[centers.length - 1]).filter((w) => !tried.has(code(w)));
          if (free.length) return pick(free);
          centers.pop();
        }
        return fresh(tried);
      },
      see: (v, fb) => { if (fb !== 'wrong') centers.push(v); },
    };
  });
  let tap = 0;
  for (let k = 0; k < LIMITS.tapTrials; k++) {
    const perm = range(M.T).map((i) => [rand(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const out = new Set();
    const v = new Array(M.T).fill(0);
    const cnt = new Array(M.n + 1).fill(0);
    const go = (i) => {
      if (out.size >= LIMITS.checks) return;
      let d = 0;
      for (let s = 1; s <= M.n; s++) d += Math.max(0, M.min[s - 1] - cnt[s]);
      if (d > M.T - i) return;
      if (i === M.T) { out.add(code(v)); return; }
      const t = perm[i];
      for (const s of M.allow[t]) {
        if (s && cnt[s] >= M.cap[s - 1]) continue;
        v[t] = s;
        if (s) cnt[s]++;
        go(i + 1);
        if (s) cnt[s]--;
      }
      v[t] = 0;
    };
    go(0);
    if ([...solSet].every((x) => out.has(x))) tap++;
  }
  result.tap = tap / LIMITS.tapTrials;
  result.bank = bankFlags(p, decl).length ? 1 : 0;
  result.idle = reply(p, p.slots.map(() => null)).type === 'solved' ? 1 : 0;
  result.hold = result.idle;
  let exact = 1;
  if (K <= LIMITS.checks) for (let i = 0; i < K; i++) exact *= (LIMITS.checks - i) / (N - i);
  result.exactRandom = exact;
  return result;
}

// A piece whose own text says what it is (a hypothesis, a retelling, unsourced, "told in the time of ...") needs no card to be classified.
// The phrase list is a first layer, not a proof: it finds the declarations it names, and a piece can say its class in other words. What decides is a reader's step the checker cannot take: hide the card
// that only classifies, and ask whether a reader can still classify the piece from the piece and the question. A review does that for every such card. classification() is the structural layer.
// Every list is matched on tidy() text: NFC, one space for any whitespace run (nbsp, newline, double space), no zero-width characters, case folded by the i flag.
// The wordings a Sổ nguồn line may use to say a claim is unproven are class talk too: in a piece, a slot label, a rule, the question, the title or hints 1 to 3 they say which piece has no source, exactly as "chưa có nguồn" does.
const UNPROVEN_WORDS = ['chưa ai chứng minh', 'chưa được chứng minh', 'chưa có nguồn', 'không có nguồn', 'chưa có bằng chứng'];
const CLASS_WORDS = ['giả thuyết', 'lời đồn', 'người ta kể', 'truyền thuyết', 'tương truyền', 'kể lại', 'chuyện kể', 'huyền thoại', 'tin đồn', 'dân gian', 'truyền miệng', 'nghe đồn', 'người ta đồn', 'đồn đại', 'theo lời kể', 'lời kể', 'theo truyền thống', 'chưa kiểm chứng', 'không rõ nguồn', ...UNPROVEN_WORDS];
const SELF_DECLARED = new RegExp(L + '(?:' + [...CLASS_WORDS, 'chưa phải bản ghi'].join('|') + ')' + R + '|' + L + 'thời(?:\\s+\\S+){1,3}\\s+tả' + R, 'iu');
function selfDeclared(p, err) {
  const M = model(p);
  const bin = (s) => { const x = p.slots[M.six[s] - 1]; return x.cap === 'any' || x.cap > 1; };
  const classifies = (d) => arr(d.t).length === 1 && (d.op === 'used' || d.op === 'unused' || (d.op === 'oneOf' && arr(d.s).length >= 2) || (['at', 'notAt'].includes(d.op) && arr(d.s).every(bin)));
  const by = new Map();
  for (const c of p.cards) {
    const ds = arr(c.do);
    if (ds.length && ds.every(classifies)) for (const t of new Set(ds.map((d) => arr(d.t)[0]))) if (!by.has(t)) by.set(t, c.id);
  }
  for (const t of p.tokens) {
    const hit = tidy(t.text).match(SELF_DECLARED);
    if (!hit) continue;
    if (by.has(t.id)) err('card ' + by.get(t.id) + ' only classifies piece ' + t.id + ', whose text already says what it is ("' + hit[0] + '"): the player reads the class off the piece and never needs the card; take the declaration off the piece or give the card more to do');
    else err('piece ' + t.id + ' text already says what it is ("' + hit[0] + '"): a piece never declares or implies its class, a sourced card carries it');
  }
}

// The class of a piece (legend, decoy) comes from sourced cards, never from the slots, a rule or the piece text. The solver ignores token.status, so
// (1) a rule holds only constraints symmetric in all pieces (a count over all of them); one that names some pieces and not all fails,
// (2) for each legend, decoy or disputed piece, and each piece a declared solution leaves out, removing the constraints that depend on it must admit a solution that places the piece elsewhere than every declared solution does, and
// (3) in a full puzzle (not a stub) every piece every solution leaves out needs a card constraint that restricts it relative to a piece some solution places (a conditional: placed only if it holds; checked as: with the other
//     pieces fixed, the pairs of places the two pieces may take are not a product of two independent sets, so a vacuous conditional, a tautology, an always-true count and a conjunction of single-piece facts do not count): otherwise a player
//     places what the other cards place, is left with those pieces, and finds their class by elimination without reading the card that sorts them. A piece of status rule (the game pieces of the intro tutorial) has no class and is outside it.
const namedBy = (d) => (d.op === 'expr' ? refsOf(d.e) : arr(d.t));
function classification(p, decl, sts, err, stub) {
  const M = model(p);
  const swapped = (v, i) => { const w = v.slice(); [w[i], w[i + 1]] = [w[i + 1], w[i]]; return w; };
  const alone = (d) => {
    const c = mk(p, d);
    const f = (v) => holds(c, c.ti.map((i) => v[i]));
    return sts.every((v) => range(M.T - 1).every((i) => f(v) === f(swapped(v, i))));
  };
  const rules = (p.rules ?? []).map((r) => ({ ...r, do: arr(r.do).filter(alone) }));
  const bare = { ...p, rules };
  for (const [i, r] of (p.rules ?? []).entries()) {
    const single = arr(r.do).filter((d) => !alone(d));
    if (single.length) err('a rule decides for single pieces: rules[' + i + '] constrains ' + [...new Set(single.flatMap(namedBy))].join(', ') + ' (' + single.map((d) => d.op).join(', ') + ') and not every piece alike; the cards, not a rule, must say where each piece goes and which stay out, so a rule may only hold a constraint symmetric in all pieces (a count over all of them)');
  }
  const out = p.tokens.filter((t) => decl.every((d) => d[M.tix[t.id]] === 0)).map((t) => t.id);
  const ties = (ds, a, b) => {
    const cs = arr(ds).map((d) => mk(p, d));
    const ti = [...new Set(cs.flatMap((c) => c.ti))];
    const i = ti.indexOf(a);
    const j = ti.indexOf(b);
    if (i < 0 || j < 0) return false;
    const pos = cs.map((c) => c.ti.map((t) => ti.indexOf(t)));
    const holdsAll = (args) => cs.every((c, k) => holds(c, pos[k].map((x) => args[x])));
    const seen = new Set();
    return sts.some((v) => {
      const args = ti.map((x) => v[x]);
      const key = args.filter((_, k) => k !== i && k !== j).join();
      if (seen.has(key)) return false;
      seen.add(key);
      const sat = [];
      const Ax = new Set();
      const By = new Set();
      for (const x of M.allow[a]) {
        for (const y of M.allow[b]) {
          const ok = holdsAll(args.map((z, k) => (k === i ? x : k === j ? y : z)));
          if (ok) { Ax.add(x); By.add(y); }
          if (!(x > 0 && x === y && M.cap[x - 1] < 2)) sat.push([x, y, ok]);
        }
      }
      return [...Ax].some((x) => x > 0) && sat.some(([x, y, ok]) => !ok && Ax.has(x) && By.has(y));
    });
  };
  for (const t of p.tokens) {
    const at = M.tix[t.id];
    if (!['legend', 'decoy', 'disputed'].includes(t.status) && !decl.some((d) => d[at] === 0)) continue;
    const names = (d) => {
      if (!namedBy(d).includes(t.id)) return false;
      const c = mk(p, d);
      const j = c.ti.indexOf(at);
      return j < 0 || sts.some((v) => { const args = c.ti.map((i) => v[i]); const was = holds(c, args); return range(M.n + 1).some((x) => x !== args[j] && holds(c, args.map((y, k) => (k === j ? x : y))) !== was); });
    };
    const sourcedCard = (c) => (p.id === 'intro' && p.history === 'none') || (c.source !== 'game' && c.status !== 'rule');
    const naming = p.cards.some((c) => sourcedCard(c) && arr(c.do).some(names));
    const cut = { ...bare, cards: p.cards.map((c) => ({ ...c, do: sourcedCard(c) ? arr(c.do).filter((d) => !names(d)) : c.do })) };
    const carried = naming && solutions(cut, undefined, sts).some((v) => decl.every((d) => d[at] !== v[at]));
    const related = p.cards.some((c) => sourcedCard(c) && range(M.T).some((u) => u !== at && !out.includes(M.tid[u]) && ties(c.do, at, u)));
    if (!stub && t.status !== 'rule' && out.includes(t.id) && !related) err('piece ' + t.id + ' is ' + (out.length === 1 ? 'the one piece' : 'one of the ' + out.length + ' pieces') + ' every solution leaves out, and no card sets it against a piece that is placed (a constraint counts only when it restricts ' + t.id + ' relative to that piece: not one that names it alone, holds whatever the board, or is a conjunction of single-piece facts): a player places what the other cards place and is left with ' + (out.length === 1 ? t.id : 'the left-out pieces') + ', so its class is found by elimination and the card that sorts it is never needed; give a card that relates ' + t.id + ' to a placed piece so the cards show it has no place (a conditional constraint: placed only if it holds)');
    if (!carried) err('piece ' + t.id + ' (' + t.status + '): ' + (naming ? 'removing every card that names it never lets a board use it elsewhere than the declared solution does (only the constraints that name it go, the rest of each card stays)' : 'no card names it (a rule card does not count), so removing nothing never lets a board use it elsewhere than the declared solution does') + ': the slots (capacity, minimums) or a rule keep it where it is, not a sourced card; a card that names it must carry its class');
  }
}

// What a rule, the question, the title and hints 1 to 3 may not say: which kind of piece stays out, or what a piece is.
const CLASS_TALK = word([...CLASS_WORDS, '(?:chưa|không) phải bản ghi']);
function classTalk(p, err) {
  const told = [['question', p.question], ...arr(p.rules).map((r, i) => ['rules[' + i + '].text', r.text]), ...arr(p.hints).slice(0, 3).map((h, i) => ['hints[' + i + '].text', h.text]), ['predict.prompt', p.predict?.prompt], ...arr(p.predict?.options).map((o, i) => ['predict.options[' + i + ']', o])];
  const lines = [...told, ['title', p.title], ...arr(p.slots).map((s, i) => ['slots[' + i + '].label', s.label])];
  for (const [path, s] of lines) {
    const hit = tidy(s).match(CLASS_TALK);
    if (hit) err(path + ' names a piece class ("' + hit[0] + '"): only a sourced card says which pieces are legends, hypotheses or decoys');
  }
  const own = unique(p.tokens.map((t) => keysOf(t.text ?? t.id)));
  for (const [i, t] of p.tokens.entries()) {
    if (!['legend', 'decoy', 'disputed'].includes(t.status)) continue;
    for (const [path, s] of told) {
      const said = new Set(wordsOf(s));
      const w = own[i].filter((x) => said.has(x));
      if (w.length >= 2) err(path + ' names piece ' + t.id + ' ("' + w.join(' ') + '"): a rule, the question or a hint of tiers 1 to 3 never singles out a legend, decoy or disputed piece');
    }
  }
}

// ---- checks ------------------------------------------------------------
function core(p, name, errors, opts = {}) {
  const { full = true, demo = false, stub = false } = opts;
  const err = (m) => errors.push(name + ': ' + m);
  const warn = (m) => opts.warnings?.push(name + ': ' + m);
  let bad = false;
  const hard = (m) => { bad = true; err(m); };
  const info = { stub };
  const ids = (xs) => xs.map((x) => x.id);
  for (const [k, xs] of [['tokens', p.tokens], ['slots', p.slots], ['cards', p.cards]]) {
    if (!Array.isArray(xs) || !xs.length) return err(k + ' missing'), info;
    if (new Set(ids(xs)).size !== xs.length) hard('duplicate ' + k + ' id');
  }
  if (p.tokens.length > LIMITS.tokens) hard('more than ' + LIMITS.tokens + ' tokens');
  if (p.slots.length > LIMITS.slots) hard('more than ' + LIMITS.slots + ' slots');
  if (p.cards.length > LIMITS.cards) hard('more than ' + LIMITS.cards + ' clue cards');
  const tokenIds = new Set(ids(p.tokens));
  for (const t of p.tokens) if (!STATUS.includes(t.status)) err('token ' + t.id + ' status ' + t.status);
  if (p.minPlaced !== undefined && !(Number.isInteger(p.minPlaced) && p.minPlaced >= 1 && p.minPlaced <= p.tokens.filter((t) => t.required).length)) err('minPlaced must be an integer from 1 to the number of required pieces');
  for (const s of p.slots) {
    if (s.cap !== undefined && s.cap !== 'any' && !(Number.isInteger(s.cap) && s.cap >= 1)) err('slot ' + s.id + ' cap must be a positive integer or "any"');
    if (s.min !== undefined && !(Number.isInteger(s.min) && s.min >= 0 && s.min <= (s.cap === 'any' ? p.tokens.length : (s.cap ?? 1)))) err('slot ' + s.id + ' min must be an integer from 0 to its cap');
    const acc = arr(s.accepts);
    if (acc.includes('legend') && s.lane !== 'legend') err('slot ' + s.id + ' accepts legend tokens but is not declared as a legend lane (lane: "legend")');
    if (s.lane !== undefined && s.lane !== 'legend') err('slot ' + s.id + ' lane must be "legend"');
    if (s.lane === 'legend') {
      if (!acc.includes('legend')) err('slot ' + s.id + ' is a legend lane but does not accept legend pieces (accepts must list legend)');
      if (acc.includes('fact')) err('slot ' + s.id + ' is a legend lane and must not accept fact pieces');
    }
  }
  for (const [i, s] of p.slots.entries()) {
    if (s.weekday === undefined) continue;
    const w = weekdayIndex(s.weekday);
    if (w < 0) err('slot ' + s.id + ' weekday "' + s.weekday + '" is not a weekday name');
    else if ((s.value ?? i + 1) !== w) err('slot ' + s.id + ' is ' + s.weekday + ' (weekday() number ' + w + ') but its value is ' + (s.value ?? i + 1));
  }
  for (const c of p.cards) {
    if (!STATUS.includes(c.status)) err('card ' + c.id + ' status ' + c.status);
    if (!KINDS.includes(c.kind)) err('card ' + c.id + ' kind ' + c.kind);
    const shown = c.status === 'decoy' ? (c.shows ?? 'fact') : c.status;
    if (shown === 'legend' && arr(c.do).length) err('card ' + c.id + ' is a legend and must not carry a constraint (do): a retelling can never be needed for the answer');
    else if (c.status !== 'rule' && c.status !== 'decoy' && shown !== 'legend' && !arr(c.do).length) err('card ' + c.id + ' has no constraint');
    if ((c.kind === 'rule') !== (shown === 'rule')) err('card ' + c.id + ' kind ' + c.kind + ' does not match status ' + shown + ' (a game rule is both, nothing else is)');
  }
  if (!demo && !stub) { ruleCards(p, err); ruleExpress(p, err); }
  let M = model(p);
  try { compile(p); if (p.wrongFrame?.do) compileDo(p, p.wrongFrame.do); } catch (e) { return err('constraint: ' + e.message), info; }
  if (M.fit.some((a) => !a.length)) return err('a required token fits no slot'), info;
  let decl;
  try { decl = p.solutions.map((s) => toState(p, s)); } catch (e) { return err('declared solutions: ' + e.message), info; }
  if (bad) return info;

  const sts = states(p);
  info.space = sts.length;
  if (!demo && p.space !== undefined && p.space !== sts.length) err('declared space ' + p.space + ' but the valid state count is ' + sts.length + ' (accepts, capacity and required tokens applied)');
  if (full && sts.length < LIMITS.minSpace) err('valid answer space ' + sts.length + ' < ' + LIMITS.minSpace);
  const sols = solutions(p, undefined, sts);
  info.count = sols.length;
  const key = (v) => v.join(',');
  const show = (vs) => JSON.stringify(vs.map((v) => answerText(p, answerOf(p, v))));
  for (const d of decl) if (!legal(M, d)) err('declared solution ' + answerText(p, answerOf(p, d)) + ' is not a valid board (legend token in a fact slot, slot over capacity, or a required token left out)');
  if (JSON.stringify(sols.map(key).sort()) !== JSON.stringify(decl.map(key).sort())) err('solver finds ' + sols.length + ' solution(s) ' + show(sols) + ', declared ' + show(decl));
  info.necessity = [];
  const without = {};
  for (const c of p.cards) {
    const rest = new Set(ids(p.cards).filter((x) => x !== c.id));
    const k = solutions(p, rest, sts).length;
    without[c.id] = k;
    info.necessity.push(c.id + ':' + sols.length + '→' + k);
    const free = c.status === 'decoy' || c.status === 'legend';
    if (free ? k !== sols.length : k <= sols.length) err('card ' + c.id + (free ? ' is tagged decoy but removing it changes the count' : ' is not needed: removing it leaves ' + k + ' solution(s)'));
  }
  for (const t of p.tokens) {
    if (!t.date) continue;
    for (const d of decl) {
      const slot = p.slots[d[M.tix[t.id]] - 1];
      if (!slot || slot.weekday === undefined) continue;
      const real = FN.weekday(t.date.y, t.date.m, t.date.d, t.date.cal ?? 'gregorian');
      if (weekdayIndex(slot.weekday) !== real) err('token ' + t.id + ' (' + t.date.d + '/' + t.date.m + '/' + t.date.y + ' ' + (t.date.cal ?? 'gregorian') + ') falls on ' + WEEKDAYS[real][0] + ' by the calendar, but the declared solution puts it in slot ' + slot.id + ' (' + slot.weekday + ')');
    }
  }
  const tutorial = p.id === 'intro' && p.history === 'none';
  if (!demo && !stub && p.history === 'none' && p.id !== 'intro') err('history "none" is only for the intro tutorial: every other puzzle must make a sourced card the key');
  if (!demo && !stub && !tutorial) {
    const sourced = p.cards.filter((c) => c.source && c.source !== 'game' && c.status !== 'rule' && c.status !== 'decoy');
    const needed = sourced.filter((c) => without[c.id] > sols.length);
    info.sourcedNeeded = needed.length;
    if (needed.length < LIMITS.sourcedNeeded) err('history is not the key: only ' + needed.length + ' sourced card(s) are needed (min ' + LIMITS.sourcedNeeded + ')');
    const bare = solutions(p, new Set(p.cards.filter((c) => !sourced.includes(c)).map((c) => c.id)), sts).length;
    info.withoutHistory = bare;
    if (bare <= sols.length) err('history is not the key: without the sourced cards the solution count stays ' + bare);
  }
  let prop;
  let lv;
  const proj = Object.fromEntries(p.tokens.map((t, i) => [t.id, [...new Set(sols.map((s) => s[i]))].sort((a, b) => a - b)]));
  try { prop = propagate(p); lv = solveLevels(p, proj); } catch (e) { return err('propagation: ' + e.message), info; }
  info.prop = prop;
  info.levels = lv;
  if (!lv.solved) for (const t of p.tokens) if (JSON.stringify(lv.dom[t.id]) !== JSON.stringify(proj[t.id])) err('propagation alone leaves ' + t.id + ' in ' + JSON.stringify(lv.dom[t.id]) + ' but solutions give ' + JSON.stringify(proj[t.id]) + ': branching needed (even one-step hypotheses and two cards read together do not finish it)');
  if (lv.deep) err('needs more than ' + LIMITS.l2Max + ' L2 actions (one-step hypotheses or two cards read together): too deep');
  if (lv.run > LIMITS.depth) err('inference depth ' + lv.run + ' > ' + LIMITS.depth);
  if (prop.forced < 1) err('no forced move in round 1: the first state needs a move that follows from one card');
  if (demo) return info;
  info.surface = surface(p, decl);
  if (info.surface.number) err('readable from surface cues: sorting the pieces by the numbers printed on them (and on the cards that name them) gives the solution; take the years off the cards and pieces so the order comes only from what the sources say');
  if (info.surface.roman) err('readable from surface cues: reading the Roman day counts off the anchors the cards give and dropping each piece on its own date gives the solution; the cards must also make the player decide which of those dates count');
  if (info.surface.keyword) err('readable from surface cues: matching the words of a piece with the slot words on the cards that name it gives the solution; the cards must make the player reason, not look up');
  yearCards(p, err);
  if (!stub) relationWarnings(p, warn);
  const exempt = l2Exemption(p);
  if ('l2Exempt' in p && !exempt) err('l2Exempt must be a sentence of at least 15 characters saying why this puzzle has no L2 step');
  info.l2Exempt = exempt;
  const need = opts.minL2 ?? requiredL2(p.id, p);
  info.needL2 = need;
  if (lv.l2 < need) err('too easy for this chapter: L1 plus ' + lv.l2 + ' L2 step(s) solve it, at least ' + need + ' needed (L1 = one card at a time, L2 = a one-step hypothesis or two cards read together)');
  selfDeclared(p, err);
  classTalk(p, err);
  classification(p, decl, sts, err, stub);
  const named = new Set(p.cards.flatMap((c) => arr(c.do).flatMap((d) => (d.op === 'expr' ? refsOf(d.e) : arr(d.t)))));
  if (stub) for (const t of p.tokens) if (!named.has(t.id)) err('piece ' + t.id + ' is named by no card: only the slot minimums place it, so it is no constraint and no labelled decoy; name it in a sourced card or make it a decoy a card leaves out');
  info.leaks = replyLeaks(p, reply, sts);
  for (const l of info.leaks) err('reply leaks: ' + l);
  if (stub) {
    if (full) {
      info.bots = bots(p, sts, decl);
      for (const k of ['random', 'mash', 'hill', 'tap', 'local', 'idle', 'hold']) if (info.bots[k] >= LIMITS.botP) err('bot ' + k + ' solves within ' + LIMITS.checks + ' checks with P=' + info.bots[k]);
    }
    return info;
  }

  for (const label of bankFlags(p, decl)) err('bank order fills a solution (' + label + '); reorder the tokens or set bankSeed');
  info.rho = bankRho(p, decl);
  if (info.rho !== null && info.rho >= LIMITS.rho) err('the shown bank order follows the solution (|Spearman ρ| ' + info.rho.toFixed(2) + ' >= ' + LIMITS.rho + '); change bankSeed');

  const wf = p.wrongFrame ?? {};
  if (wf.trap) {
    const inTrap = trapTest(p);
    const hit = sts.filter(inTrap);
    if (!hit.length) err('wrongFrame.trap matches no valid board');
    if (sols.some(inTrap)) err('wrongFrame.trap is part of a solution');
    if (hit.length && solutions(p, new Set(arr(wf.cards)), hit).length) err('wrongFrame.cards ' + arr(wf.cards).join(', ') + ' do not eliminate the trap board by themselves');
    if (wf.message && !/^chưa khớp\.?$/.test(flat(wf.message).trim())) {
      const msg = flat(wf.message);
      const slotWords = [...new Set(p.slots.flatMap((s) => flat(s.label ?? '').split(/[^\p{L}\p{M}\p{N}]+/u).filter((x) => x.length >= 3)))];
      const slotLeak = slotWords.filter((w) => new RegExp(L + w + R, 'u').test(msg));
      if (slotLeak.length || SLOT_RE.test(msg)) err('wrongFrame.message uses slot or ordinal wording (' + [...new Set([...slotLeak, SLOT_RE.test(msg) ? msg.match(SLOT_RE)[0] : []].flat())].join(', ') + '): it may only say "Chưa khớp" or name a card, never a place');
      const wordsOf = (s) => flat(s).split(/[^\p{L}\p{M}\p{N}]+/u).filter((x) => x.length >= 3);
      const count = {};
      for (const t of p.tokens) for (const w of new Set(wordsOf(t.text))) count[w] = (count[w] ?? 0) + 1;
      const leak = p.tokens.flatMap((t) => [t.id, ...wordsOf(t.text).filter((w) => count[w] === 1)]).filter((w) => w.length >= 3 && new RegExp(L + w.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&') + R, 'u').test(msg));
      if (leak.length) err('wrongFrame.message names ' + [...new Set(leak)].join(', ') + ': it must not leak which piece belongs where');
      if (/(?:^|[^\p{L}])(?:ô|mặt số|vị trí|chỗ|nấc|hàng|cột|ngăn|bậc)\s*\d/iu.test(wf.message)) err('wrongFrame.message points at a slot number');
    }
  }
  if (!wf.do && !(tutorial && typeof wf.exempt === 'string' && wf.exempt.trim().length >= 15)) err('wrongFrame.do is missing: state the wrong frame as constraints so the checker can prove the cards break it' + (tutorial ? ' (the intro may instead give wrongFrame.exempt, a sentence saying why it has none)' : ''));
  if (wf.do) {
    const frame = compileDo(p, wf.do);
    const open = sts.filter((v) => satisfies(compile(p, new Set()), v) && satisfies(frame, v));
    if (!open.length) err('wrongFrame.do is impossible even before any card');
    else if (solutions(p, new Set(arr(wf.cards)), open).length) err('wrongFrame.cards ' + arr(wf.cards).join(', ') + ' do not break wrongFrame.do');
  }

  const given = new Set();
  for (let k = 0; k < decl.length; k++) {
    let a;
    try { a = helpAnswer(p, given); } catch (e) { err('hint tier 5: ' + e.message); break; }
    const r = reply(p, a, given);
    const want = k + 1 < decl.length ? 'found' : 'solved';
    if (r.type !== want) { err('hint tier 5 (Nhờ Cúc Cu soi tỏ) step ' + (k + 1) + ' gives ' + JSON.stringify(r) + ', expected ' + want + ': it must yield a solution not found yet'); break; }
  }

  if (full) {
    info.bots = bots(p, sts, decl);
    for (const k of ['random', 'mash', 'hill', 'tap', 'local', 'bank', 'idle', 'hold']) if (info.bots[k] >= LIMITS.botP) err('bot ' + k + ' solves within ' + LIMITS.checks + ' checks with P=' + info.bots[k]);
  }
  return info;
}

function sources(p, errors) {
  const err = (m) => errors.push(p.id + ': ' + m);
  const verify = (x, name) => {
    const found = x.source.split(';').map((s) => join(root, s.trim().split(/[\s#]/)[0]));
    const missing = found.find((f) => !existsSync(f));
    if (missing) return err(name + ': source file missing ' + x.source);
    const raw = found.map((f) => readFileSync(f, 'utf8')).join('\n');
    const text = flat(raw);
    if (!arr(x.evidence).length) err(name + ' has no evidence quote');
    for (const q of arr(x.evidence)) if (!text.includes(flat(q))) err(name + ': evidence not found in ' + x.source + ': ' + q);
    if (!arr(x.url).length) err(name + ' has no url');
    for (const u of arr(x.url)) if (!raw.includes(u)) err(name + ': url not in ' + x.source + ': ' + u);
  };
  for (const [kind, xs] of [['card', p.cards], ['token', p.tokens]]) {
    for (const x of xs) {
      const rule = x.status === 'rule';
      if (rule && kind === 'token') continue;
      if (rule) { if (x.source !== 'game') err(kind + ' ' + x.id + ' is a rule and must have source "game"'); continue; }
      if (!x.source) { if (kind === 'token' && x.status !== 'legend') continue; err(kind + ' ' + x.id + ' has no source'); continue; }
      verify(x, kind + ' ' + x.id);
      if (kind === 'card' && x.status === 'legend' && !/người ta kể/i.test(x.text ?? '')) err(kind + ' ' + x.id + ': a legend must open with "người ta kể"');
    }
  }
  for (const [i, x] of arr(p.conclusion?.bank).entries()) {
    if (!x.source || x.source === 'game') err('conclusion.bank[' + i + '] has no source: every conclusion piece needs a source, a url and an evidence quote');
    else verify(x, 'conclusion.bank[' + i + ']');
  }
}

function texts(p, errors) {
  const err = (m) => errors.push(p.id + ': ' + m);
  const META = new Set(['source', 'url', 'evidence', 'format', 'input', 'goal', 'id', 'icon', 'status', 'kind', 'op', 'orientation', 'shows', 'label', 'who', 'when', 'card', 'history', 's', 't', 'e']);
  const VOICE = /^(question|predict\.(?:prompt|options\[\d+\])|cards\[\d+\]\.text|hints\[\d+\]\.text|conclusion\.(?:hints\[\d+\]\.text|bank\[\d+\]\.text)|reveal\.lines\[\d+\]|aha|tokens\[\d+\]\.text)$/;
  const CAP = [[/^cards\[\d+\]\.text$/, LIMITS.cardWords], [/^(question|predict\.(?:prompt|options\[\d+\])|rules\[\d+\]\.text|hints\[\d+\]\.text|reveal\.lines\[\d+\]|wrongFrame\.(text|message)|antiGuess\.rule|aha|tokens\[\d+\]\.text|conclusion\.template|conclusion\.bank\[\d+\]\.text|conclusion\.hints\[\d+\]\.text)$/, LIMITS.lineWords]];
  for (const [path, s] of strings(p)) {
    if (s !== nfc(s)) err(path + ' is not NFC');
    const key = path.replace(/\[\d+\]$/, '').split('.').pop().replace(/\[\d+\]/g, '');
    if (META.has(key)) continue;
    if (UI_PATH.test(path) && FAIL_WORDING.test(s)) err(path + ' implies a fail state: ' + s.match(FAIL_WORDING)[0]);
    if (TABOO.test(s)) err(path + ' has taboo wording: ' + s.match(TABOO)[0]);
    if (ADDRESS.test(s)) err(path + ' addresses the reader as "bạn": the voice never does');
    const cap = CAP.find(([re]) => re.test(path))?.[1];
    if (cap && words(s) > cap) err(path + ' has ' + words(s) + ' words (max ' + cap + ')');
    if (VOICE.test(path)) {
      for (const m of rhythm(s)) err(path + ' ' + m);
    }
  }
}

// Bible §8 rules 1-2 on one line of text: words between punctuation and commas in a sentence.
export function rhythm(s) {
  const out = [];
  for (const cl of String(s).split(/(?:[,;!?…—–()]|[.:](?!\d))+/)) {
    if (words(cl) > 12) out.push('has ' + words(cl) + ' words between punctuation (max 12)');
  }
  for (const sent of String(s).split(/(?:[!?…]|\.(?!\d))+/)) {
    const commas = (sent.match(/,/g) ?? []).length;
    if (commas > 2) out.push('has ' + commas + ' commas in a sentence (max 2)');
  }
  return out;
}

const chapterDir = join(root, 'story/chapters');
const ORDER = [...readFileSync(join(root, 'src/order.ts'), 'utf8').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
const NO_JOKE = [5, 6, 10];
const NO_CROW = [5];
const RESERVED = word(['đầu tiên', 'luôn', 'từ xưa', 'cổ xưa']);
const SAFE_PHRASE = /ghi chép đầu tiên được biết/giu;
const LIKE = word(['như']);
const NOT_COMPARISON = word(['như (?:thế|vậy|sau|nhau)']);
const SPEAKER = /^([^:[\]>@#\s][^:[\]]*?)(?:\s*\[([a-z]+)\])?:\s+(\S.*)$/u;

// Bible §8 voice rules that a script line can break measurably; returns "file:line: message" strings.
export function chapterProblems(id, source) {
  const out = [];
  const no = ORDER.indexOf(id) + 1;
  const err = (n, m) => out.push(id + '.md:' + n + ': ' + m);
  let scene = '';
  let likes = 0;
  let lineCount = 0;
  let jokes = 0;
  let asks = 0;
  let cardAt = 0;
  const dialog = [];
  const whyLines = [];
  const lines = source.split('\n');
  const body = lines.indexOf('---', 1);
  const sceneEnd = (n) => { if (likes > 2) err(n, 'scene "' + scene + '" has ' + likes + ' "như" (max 2 per scene)'); };
  lines.forEach((raw, i) => {
    if (i <= body) return;
    const n = i + 1;
    const line = nfc(raw).trim();
    const head = /^##\s+(.+)$/.exec(line);
    if (head) { sceneEnd(n - 1); scene = head[1]; likes = 0; return; }
    if (line === '@card') cardAt = n;
    if (!line || (line.startsWith('@') && !line.startsWith('@plate'))) return;
    const plate = /^@plate\s+(.*)$/.exec(line);
    let who = null;
    let text;
    if (plate) text = plate[1];
    else if (line.startsWith('>')) text = line.slice(1).trim();
    else { const m = SPEAKER.exec(line); if (!m) return; who = m[1].trim(); text = m[3]; }
    const dry = /^\[khô\]\s*/iu.test(text);
    text = text.replace(/^\[khô\]\s*/iu, '');
    if (!plate) {
      dialog.push(n);
      if (/^\[vì-sao\]\s*/iu.test(text)) { whyLines.push(n); text = text.replace(/^\[vì-sao\]\s*/iu, ''); }
      lineCount += 1;
    }
    if (dry) {
      jokes += 1;
      if (who && who !== 'Tèo') err(n, who + ' has a [khô] line: only Tèo or the narration may');
      if (NO_JOKE.includes(no)) err(n, 'chapter ' + no + ' allows no [khô] line');
    }
    if (who === 'Quạ Đồn' && NO_CROW.includes(no)) err(n, 'Quạ Đồn speaks in chapter ' + no + ': he is absent');
    if (!plate) {
      if (words(text) > 25) err(n, words(text) + ' words (max 25)');
      for (const m of rhythm(text)) err(n, m);
    }
    if (!who && text.includes('!')) err(n, 'narration has "!"');
    if (ADDRESS.test(text)) err(n, 'addresses the reader as "bạn"');
    const bare = text.replace(SAFE_PHRASE, '').replace(/"[^"]*"|“[^”]*”/gu, '');
    if (who !== 'Quạ Đồn' && RESERVED.test(bare)) err(n, '"' + bare.match(RESERVED)[0] + '" belongs to Quạ Đồn only');
    const like = (text.replace(NOT_COMPARISON, '').match(new RegExp(LIKE.source, 'giu')) ?? []).length;
    if (like && who) err(n, 'dialogue uses "như"');
    likes += like;
    if (text.includes('Nguồn đâu?')) {
      asks += 1;
      if (no === 5) err(n, '"Nguồn đâu?" is not allowed in chapter 5');
      else if (asks > 1) err(n, '"Nguồn đâu?" appears more than once in the chapter');
    }
    if (NO_CROW.includes(no) && !who && text.includes('Quạ Đồn')) err(n, 'narration names Quạ Đồn in chapter ' + no + ': he is absent');
  });
  sceneEnd(lines.length);
  if (lineCount > 40) err(lines.length, lineCount + ' dialogue lines (max 40)');
  if (jokes > 3) err(lines.length, jokes + ' [khô] lines (max 3)');
  const lastThree = (cardAt ? dialog.filter((d) => d < cardAt) : dialog).slice(-3);
  if (whyLines.length !== 1) err(lines.length, whyLines.length + ' [vì-sao] lines (need exactly one, among the last three dialogue lines before the card)');
  else if (!lastThree.includes(whyLines[0])) err(whyLines[0], 'the [vì-sao] line must be among the last three dialogue lines before the card');
  return out;
}

function claims(p, errors, pending, release) {
  const err = (m) => errors.push(p.id + ': ' + m);
  const f = ['id', 'format', 'input', 'goal', 'orientation', 'title', 'question', 'aha', 'history', 'rules', 'slots', 'tokens', 'cards', 'solutions', 'space', 'hints', 'wrongFrame', 'reveal', 'antiGuess'];
  for (const k of f) if (!(k in p)) err('missing ' + k);
  if ('space' in p && !(Number.isInteger(p.space) && p.space > 0)) err('space must be a positive integer');
  if (!FORMATS.includes(p.format)) err('format ' + p.format);
  if (!['portrait', 'landscape', 'both'].includes(p.orientation)) err('orientation');
  if (!STAMPS.includes(p.reveal?.label)) err('reveal.label must be one of the five stamps or —');
  if (sentences(arr(p.reveal?.lines).join(' ')) > 2) err('reveal has more than 2 sentences');
  const h = p.hints ?? [];
  if (h.length !== LIMITS.hintTiers || h.some((x, i) => x.tier !== i + 1)) err('hints must be tiers 1..' + LIMITS.hintTiers);
  const cardIds = new Set(p.cards.map((c) => c.id));
  if (h[1] && !cardIds.has(h[1].card)) err('hint tier 2 must point at a card');
  if (h[2] && POINTS.test(h[2].text)) err('hint tier 3 points at a card ("' + h[2].text.match(POINTS)[0] + '"): pointing is for tier 2, tier 3 names the assumption to question');
  for (const x of h) for (const m of String(x.text ?? '').matchAll(/thẻ\s+(\d+)/giu)) if (Number(m[1]) > p.cards.length) err('hint tier ' + x.tier + ' names thẻ ' + m[1] + ' but the puzzle has ' + p.cards.length + ' cards');
  const at = p.cards.findIndex((c) => c.id === h[1]?.card);
  const named = String(h[1]?.text ?? '').match(/thẻ\s+(\d+)/iu);
  if (at >= 0 && named && Number(named[1]) !== at + 1) err('hint tier 2 points at card ' + h[1].card + ' but its text names thẻ ' + named[1] + ' (that card is thẻ ' + (at + 1) + ')');
  const fills = h[3]?.fills;
  if (!fills || !Object.keys(fills).length) err('hint tier 4 must show a first inference (fills)');
  else {
    let prop;
    try { prop = propagate(p); } catch (e) { prop = { log: [] }; err('hint tier 4 cannot be checked: ' + e.message); }
    const slotNo = Object.fromEntries(p.slots.map((s, i) => [s.id, i + 1]));
    for (const [s, ts] of Object.entries(fills)) for (const t of arr(ts)) if (prop.log[0] && !prop.log.slice(0, LIMITS.fillRound).some((r) => r.newlyFixed.includes(t + '=' + slotNo[s]))) err('hint tier 4 fill ' + s + '=' + t + ' is not forced within ' + LIMITS.fillRound + ' rounds');
  }
  if (h[4]?.solves !== true) err('hint tier 5 must be the solving "Nhờ Cúc Cu soi tỏ" (solves: true)');
  for (const i of [0, 1, 2]) for (const t of p.tokens) if (h[i] && flat(h[i].text).includes(flat(t.text))) err('hint tier ' + (i + 1) + ' reveals token text "' + t.text + '"');
  const wf = p.wrongFrame ?? {};
  if (!arr(wf.cards).length || arr(wf.cards).some((c) => !cardIds.has(c))) err('wrongFrame.cards must name existing cards');
  if (wf.trap) for (const [s, ts] of Object.entries(wf.trap)) if (!p.slots.some((x) => x.id === s) || arr(ts).some((t) => !p.tokens.some((x) => x.id === t))) err('wrongFrame.trap names an unknown slot or token');
  if (!p.antiGuess?.rule) err('antiGuess.rule missing');
  if (release && p.id !== 'intro' && p.id !== 'ending') {
    const file = join(notebookDir, p.id + '.json');
    if (!existsSync(file)) err('RELEASE GATE: Sổ nguồn of ' + p.id + ' is not written yet (story/notebook/' + p.id + '.json)');
    else {
      try {
        const nb = JSON.parse(readFileSync(file, 'utf8'));
        for (const m of notebookProblems(nb)) err('RELEASE GATE: Sổ nguồn of ' + p.id + ' (story/notebook/' + p.id + '.json): ' + m);
      } catch (e) {
        err('RELEASE GATE: Sổ nguồn of ' + p.id + ' (story/notebook/' + p.id + '.json) cannot be read: ' + e.message);
      }
    }
  }
  conclusion(p, err, pending, release);
}

// The conclusion step: fill the blanks of the sentence with sourced pieces. Labels stay hidden from the player, so the
// player must tell fact, dispute and legend from the cards; the checker counts the fills that hold and the chance of a lucky guess.
export function conclusionCorrect(c, fills) {
  const picked = arr(fills);
  return arr(c.blanks).every((b, i) => Number.isInteger(picked[i]) && picked.indexOf(picked[i]) === i && c.bank[picked[i]]?.label === b.label);
}

const LABEL_TALK = word(['sự thật', 'chắc chắn', 'chưa chắc', 'chắc', 'tranh cãi', 'người ta kể(?: rằng)?', 'truyền thuyết', 'chưa có nguồn', 'lời đồn', 'giả thuyết']);

export function conclusionStats(p) {
  const bank = arr(p.conclusion?.bank);
  const want = arr(p.conclusion?.blanks);
  const n = bank.length;
  let N = 0;
  let K = 0;
  const pick = [];
  const go = (i) => {
    if (i === want.length) { N++; if (conclusionCorrect(p.conclusion, pick)) K++; return; }
    for (let j = 0; j < n; j++) if (!pick.includes(j)) { pick.push(j); go(i + 1); pick.pop(); }
  };
  if (n >= want.length) go(0);
  let miss = 1;
  if (K > 0 && N - K >= LIMITS.checks) for (let i = 0; i < LIMITS.checks; i++) miss *= (N - K - i) / (N - i);
  else if (K > 0) miss = 0;
  return { N, K, P: K > 0 ? 1 - miss : 0 };
}

const NOTEBOOK_LABEL = { fact: 'SỰ THẬT', dispute: 'TRANH CÃI', legend: 'TRUYỀN THUYẾT', card: 'CHƯA CÓ NGUỒN' };
const UNPROVEN = word(UNPROVEN_WORDS);

// The label of a conclusion piece is the status of the Sổ nguồn entry it rests on (declared in bank[].notebook as "<chapter>.<section>.<n>"; section fact, dispute,
// legend, or card for a line of the three-line card that says the claim has no source). A chapter whose Sổ nguồn is not written yet is pending, not an error: the release gate fails on it.
// Release gate on a written Sổ nguồn file: what the game would show of it. Mirrors sanitize() and safeUrl() in src/notebook.ts (a file without a usable card line, or not marked verified, shows the flagged placeholder;
// a point without text is dropped; a source needs a label and a url, and only an http(s) url becomes a link) and adds that every point carries a link, as the Sổ nguồn promises: an entry "x" with no source is not a verified Sổ nguồn.
const isText = (v) => typeof v === 'string' && v.length > 0;
const safeUrl = (u) => { try { return ['https:', 'http:'].includes(new URL(u).protocol); } catch { return false; } };
const SHOWN_SECTIONS = ['fact', 'legend', 'tradition', 'dispute'];
function notebookProblems(nb) {
  if (typeof nb !== 'object' || nb === null) return ['the file is not an object'];
  const bad = [];
  if (!Array.isArray(nb.card) || !nb.card.some(isText)) bad.push('no card line (the game shows the placeholder)');
  else if (!nb.card.every(isText)) bad.push('a card line is empty or not text (the game drops it)');
  if (nb.status !== 'verified') bad.push('status is "' + nb.status + '", not "verified" (the game shows it as not written)');
  if (typeof nb.full !== 'object' || nb.full === null || Array.isArray(nb.full)) {
    bad.push('full is not an object');
    return bad;
  }
  const full = nb.full;
  let total = 0;
  for (const key of SHOWN_SECTIONS) {
    if (full[key] === undefined) continue;
    if (!Array.isArray(full[key])) { bad.push('full.' + key + ' is not a list'); continue; }
    total += full[key].length;
    for (const [i, pt] of full[key].entries()) {
      const where = 'full.' + key + '[' + i + ']';
      if (typeof pt !== 'object' || pt === null || !isText(pt.text)) { bad.push(where + ' has no text (the game drops it)'); continue; }
      const src = Array.isArray(pt.sources) ? pt.sources : [];
      if (!src.length) bad.push(where + ' has no source');
      for (const s of src) if (typeof s !== 'object' || s === null || !isText(s.label) || !isText(s.url)) bad.push(where + ' has a source without label or url (the game drops it)');
        else if (!safeUrl(s.url)) bad.push(where + ' source ' + s.url + ' is not an http(s) link');
    }
  }
  if (!total) bad.push('full has no entries');
  return bad;
}

function notebookLink(b, at, err, pending, id, ctx) {
  const m = typeof b.notebook === 'string' ? b.notebook.match(/^([a-z0-9-]+)\.(fact|legend|dispute|tradition|card)\.(\d+)$/) : null;
  if (!m) return err(at + ' needs notebook "<chapter>.<fact|dispute|legend|card>.<n>": the Sổ nguồn entry it rests on, whose status is its label');
  const [, chapter, section, n] = m;
  const file = join(notebookDir, chapter + '.json');
  if (!existsSync(file)) {
    const msg = at + ' rests on the Sổ nguồn of ' + chapter + ', which is not written yet (story/notebook/' + chapter + '.json): its label ' + b.label + ' cannot be checked';
    pending.push(id + ': ' + msg);
    if (ctx.release) err('RELEASE GATE: ' + msg);
    return;
  }
  let nb;
  try { nb = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    if (ctx.seen.has(chapter)) return;
    ctx.seen.add(chapter);
    return err(at + ': the Sổ nguồn of ' + chapter + ' (story/notebook/' + chapter + '.json) cannot be read: ' + e.message);
  }
  if (ctx.release && !ctx.seen.has(chapter)) {
    ctx.seen.add(chapter);
    for (const m of notebookProblems(nb)) err('RELEASE GATE: the Sổ nguồn of ' + chapter + ' (story/notebook/' + chapter + '.json): ' + m);
  }
  const text = section === 'card' ? nb.card?.[n] : nb.full?.[section]?.[n]?.text;
  if (text === undefined) return err(at + ': the Sổ nguồn of ' + chapter + ' has no entry ' + section + '.' + n);
  if (!(section in NOTEBOOK_LABEL)) return err(at + ': the Sổ nguồn of ' + chapter + ' files ' + section + '.' + n + ' under "theo truyền thống", which no conclusion label means');
  if (NOTEBOOK_LABEL[section] !== b.label) return err(at + ': label ' + b.label + ' but the Sổ nguồn of ' + chapter + ' files it under ' + section + ' (' + NOTEBOOK_LABEL[section] + '): the label must be the status the Sổ nguồn gives it');
  if (section === 'card' && !UNPROVEN.test(tidy(text))) err(at + ': label ' + b.label + ' rests on a line of the ' + chapter + ' card that does not say the claim is unproven: "' + text + '"');
}

function conclusion(p, err, pending, release) {
  const ctx = { release, seen: new Set() };
  const c = p.conclusion;
  if (!c) { if (p.id === 'ending') err('the ending needs a conclusion step (conclusion)'); return; }
  const blanks = arr(c.blanks);
  const bank = arr(c.bank);
  if (typeof c.template !== 'string') err('conclusion.template missing');
  else if (c.template.split('___').length - 1 !== blanks.length) err('conclusion.template has ' + (c.template.split('___').length - 1) + ' blank(s) (___) but conclusion.blanks lists ' + blanks.length);
  if (blanks.length < 2) err('conclusion needs at least 2 blanks');
  for (const b of blanks) if (!['SỰ THẬT', 'TRANH CÃI', 'TRUYỀN THUYẾT'].includes(b.label)) err('conclusion blank label ' + b.label + ' must be SỰ THẬT, TRANH CÃI or TRUYỀN THUYẾT');
  const shown = new Map([...p.cards, ...p.tokens].map((x) => [x.id, x.status === 'decoy' ? (x.shows ?? 'fact') : x.status]));
  for (const [i, b] of bank.entries()) {
    const at = 'conclusion.bank[' + i + ']';
    if (typeof b.text !== 'string' || !b.text.trim()) err(at + ' has no text');
    else if (LABEL_TALK.test(tidy(b.text))) err(at + ' text carries its label ("' + tidy(b.text).match(LABEL_TALK)[0] + '"): the label is the player\'s answer; the sentence frame holds the label words and the piece does not');
    if (!(b.label in CONCLUSION)) err(at + ' label ' + b.label + ' must be one of ' + Object.keys(CONCLUSION).join(', '));
    else if (b.status !== CONCLUSION[b.label]) err(at + ': label ' + b.label + ' means status ' + CONCLUSION[b.label] + ' but the piece declares ' + (b.status ?? 'none'));
    notebookLink(b, at, err, pending, p.id, ctx);
    if (b.card !== undefined) {
      if (!shown.has(b.card)) err(at + ' card ' + b.card + ' does not exist');
      else if (shown.get(b.card) !== b.status) err(at + ': it rests on ' + b.card + ', shown as ' + shown.get(b.card) + ', but is declared ' + b.status);
    }
  }
  const hints = arr(c.hints);
  if (hints.length !== 3 || hints.some((x) => typeof x.text !== 'string' || !x.text.trim())) err('conclusion.hints must be 3 tiers with a text');
  else if (hints[2].solves !== true || hints.slice(0, 2).some((x) => x.solves)) err('conclusion.hints: only tier 3 solves (solves: true)');
  const { N, K, P } = conclusionStats(p);
  if (!N) err('conclusion needs at least as many pieces as blanks');
  else if (!K) err('conclusion has no correct fill: every blank needs a piece with its label');
  else if (P >= LIMITS.botP) err('conclusion: guessing wins within ' + LIMITS.checks + ' tries with P=' + (P * 100).toFixed(1) + '% (' + K + ' correct of ' + N + ' fills); needs a unique answer or P < ' + LIMITS.botP * 100 + '%');
}

export function checkOne(id, opts = { full: true }) {
  return checkData(load(id), id, opts);
}

export function checkFile(file) {
  const p = JSON.parse(readFileSync(/[\/]|\.json$/.test(file) ? resolve(file) : join(dir, file + '.json'), 'utf8'));
  return checkData(p, p.id, { full: true, stub: true });
}

// A stub is a logic-only puzzle: placeholder text, no sources, hints or reveal. Missing text, status and kind get defaults.
function stubify(p) {
  const some = (xs, f) => (Array.isArray(xs) ? xs.map(f) : xs);
  return {
    ...p,
    tokens: some(p.tokens, (t) => ({ text: t.id, status: 'fact', ...t })),
    slots: some(p.slots, (s) => ({ label: s.id, ...s })),
    cards: some(p.cards, (c) => ({ text: '', status: 'fact', ...c, kind: c.kind ?? (c.status === 'rule' ? 'rule' : 'record') })),
  };
}

export function checkData(p, id = p.id, opts = { full: true }) {
  const errors = [];
  const warnings = [];
  const pending = [];
  const stub = opts.stub ?? p.stub === true;
  if (stub) p = stubify(p);
  if (p.id !== id) errors.push(id + ': id does not match file name');
  if (stub) for (const k of ['id', 'input', 'slots', 'tokens', 'cards', 'solutions']) if (!(k in p)) errors.push(id + ': stub is missing ' + k);
  if (!stub) claims(p, errors, pending, opts.release);
  const info = core(p, id, errors, { ...opts, stub, warnings });
  if (!stub) {
    sources(p, errors);
    texts(p, errors);
    if (p.demo) core({ ...p.demo, wrongFrame: p.demo.wrongFrame ?? {}, solutions: p.demo.solutions }, id + ' demo', errors, { full: false, demo: true });
  }
  return { p, info, errors, warnings, pending };
}

const pct = (x) => (x * 100).toFixed(1) + '%';
function report(r) {
  const { p, info, errors } = r;
  const b = info.bots;
  console.log(p.id + (p.stub ? ' STUB' : '') + ' [' + (p.format ?? '?') + ' ' + p.input + ' ' + (p.goal ?? '?') + ']: ' + p.tokens.length + ' tokens, ' + p.slots.length + ' slots, ' + p.cards.length + ' cards, valid answer space ' + info.space + ' (declared ' + (p.space ?? 'none') + ')');
  console.log('  solutions: ' + info.count + ' (declared ' + p.solutions.length + ') ' + p.solutions.map((s) => answerText(p, s)).join(' | '));
  if (info.necessity) console.log('  clue necessity (solutions with the card removed): ' + info.necessity.join(' '));
  if (info.sourcedNeeded !== undefined) console.log('  history key: ' + info.sourcedNeeded + ' sourced card(s) needed; without all sourced cards ' + info.withoutHistory + ' solution(s)');
  if (info.prop) console.log('  propagation only: depth ' + info.prop.depth + ', forced moves in round 1: ' + info.prop.forced + ', ' + info.prop.log.filter((x) => x.newlyFixed.length).map((x) => 'r' + x.round + ' ' + x.newlyFixed.join(',')).join('; '));
  if (info.levels) console.log('  difficulty: L1 rounds ' + info.levels.l1 + ' (longest run ' + info.levels.run + '), L2 steps ' + (info.levels.deep ? '>' + LIMITS.l2Max : info.levels.l2) + (info.levels.path.length ? ' [' + info.levels.path.join(' ; ') + ']' : '') + (info.needL2 !== undefined ? ', required L2 >= ' + info.needL2 : '') + (info.rho != null ? '; bank |rho| ' + info.rho.toFixed(2) : ''));
  if (info.l2Exempt) console.log('  L2 gate EXEMPT: ' + info.l2Exempt);
  if (p.conclusion) { const s = conclusionStats(p); console.log('  conclusion: ' + s.K + ' correct fill(s) of ' + s.N + ', blind guess within ' + LIMITS.checks + ' tries ' + pct(s.P)); }
  if (b) console.log('  bots, P(solve within ' + LIMITS.checks + ' checks): random ' + pct(b.random) + ' (exact ' + pct(b.exactRandom) + '), mash ' + pct(b.mash) + ', hill-climber ' + pct(b.hill) + ', local-search ' + pct(b.local) + ', tap-everything ' + pct(b.tap) + ', bank order ' + (info.stub ? 'n/a (stub pieces are not shuffled)' : pct(b.bank)) + ', idle ' + pct(b.idle) + ', hold ' + pct(b.hold));
  if (info.surface) console.log('  surface cues: sort by numbers ' + (info.surface.number ? 'SOLVES' : 'no') + ', keyword match ' + (info.surface.keyword ? 'SOLVES' : 'no') + ', Roman dates ' + (info.surface.roman ? 'SOLVES' : 'no'));
  if (!p.stub) console.log('  sources: ' + p.cards.filter((c) => c.status !== 'rule').length + ' sourced cards, ' + p.tokens.filter((t) => t.source && t.source !== 'game').length + ' sourced tokens; label ' + p.reveal.label + (p.history === 'none' ? '; history key: none (tutorial)' : ''));
  for (const w of r.warnings ?? []) console.log('  warn: ' + w);
  for (const w of r.pending ?? []) console.log('  pending: ' + w);
  console.log(errors.length ? '  FAIL: ' + errors.length + ' error(s)' : p.stub ? '  OK (stub: the logic is buildable; text, sources and hints are not checked)' : '  OK');
}

// ---- paper prototype -----------------------------------------------------
function syntaxLines(p) {
  const n = p.slots.length;
  const multi = p.slots.some((s) => s.cap === 'any' || s.cap > 1);
  const lines = ['## Cách nộp đáp án', '- Gõ một dòng gồm đúng ' + n + ' mục cách nhau bằng dấu phẩy. Mục thứ k là mã của mảnh đặt vào ô ghi "mục k" ở phần "Ô trên bảng" (mã ghi ở "Mảnh để đặt"), viết đúng mã như in, chữ hoa hay chữ thường đều được, không dấu cách bên trong.', '- Dạng mẫu: mã1,mã2,...,mã' + n + '. Chưa chắc ô nào thì để trống mục đó (giữ dấu phẩy); máy báo còn bao nhiêu ô trống.'];
  if (multi) lines.push('- Ô nhận nhiều mảnh: nối các mã bằng dấu +, ví dụ mãA+mãB.');
  lines.push('- Nộp sai cú pháp (mã lạ, thiếu hoặc thừa mục, một mảnh dùng hai lần) thì máy báo "sai cú pháp"; lần đó không tính là một lần Kiểm tra.');
  if (p.solutions.length > 1) lines.push('- Bài này có ' + p.solutions.length + ' cách xếp khớp mọi thẻ. Mỗi lần Kiểm tra nộp một cách; máy báo "đã tìm được n/' + p.solutions.length + ' cách".');
  return lines;
}

export function view(p) {
  const lines = ['# ' + p.title + ' (bản giấy cho người chơi thử)', '', 'Mã câu đố: ' + p.id + ' (dùng mã này khi gõ lệnh reply hay hint)', '', p.question, ''];
  if (p.predict) lines.push('**Đoán trước (chạm một ô, chưa ai chấm):** ' + p.predict.prompt + ' ' + p.predict.options.map((o, i) => (i + 1) + '. ' + o).join('  '), '');
  lines.push('## Luật chơi', ...p.rules.map((r) => '- ' + r.text), '');
  if (p.demo) lines.push('## Ví dụ làm quen (không tính)', '', p.demo.question, '', ...p.demo.cards.map((c, i) => (i + 1) + '. ' + c.text), '', 'Mảnh: ' + p.demo.tokens.map((t) => '[' + t.text + '] (mã ' + t.id + ')').join(' '), 'Ô: ' + p.demo.slots.map((s) => '(' + s.label + ')').join(' '), '');
  lines.push('## Thẻ bằng chứng', ...p.cards.map((c, i) => (i + 1) + '. **' + SHOWN[c.status === 'decoy' ? c.shows : c.status] + '**' + (c.who ? ' · ' + c.who : '') + (c.when ? ' · ' + c.when : '') + (c.kind === 'rule' ? '' : ' · ' + KIND[c.kind]) + '\n   ' + c.text + (c.source && c.source !== 'game' ? '\n   Nguồn: ' + c.url : '')), '');
  lines.push('## Mảnh để đặt (thứ tự trộn cố định)', ...bankOrder(p).map((t) => '- mã ' + t.id + ' — [' + t.text + ']'), '');
  lines.push('## Ô trên bảng (mục k ở đây là mục k của dòng đáp án)', ...p.slots.map((s, i) => 'mục ' + (i + 1) + ' = ' + s.label + (s.cap === 'any' ? ' (nhận nhiều mảnh)' : s.cap > 1 ? ' (nhận tối đa ' + s.cap + ' mảnh)' : '')), '');
  lines.push(...syntaxLines(p), '');
  if (p.conclusion) lines.push('## Bước kết luận', p.conclusion.template, ...arr(p.conclusion.bank).map((b, i) => '- mã ' + (b.id ?? 'k' + (i + 1)) + ' — [' + b.text + ']'), 'Điền mỗi chỗ trống một mảnh; máy không cho biết mảnh nào thuộc nhãn nào, người chơi tự phân biệt bằng các thẻ.', '');
  lines.push('## Cách chơi', '- Chạm một mảnh, rồi chạm một ô để đặt; chạm lại để nhấc ra. Chưa ai bị trừ gì khi đặt.', '- Nút "Kiểm tra" chỉ chấm cả bảng: đúng, hoặc "chưa khớp". Không báo ô nào sai, không báo gần đúng.', '- Gợi ý có 5 bậc, bấm mới hiện, bậc cuối là "Nhờ Cúc Cu soi tỏ" và làm hộ. Không có đồng hồ, không thua.', '- Hãy nói to điều đang nghĩ trước mỗi lần bấm "Kiểm tra". Khi xong, hãy nói vì sao đáp án đúng, nó chắc đến đâu và điều gì còn chưa biết.');
  return lines.join('\n') + '\n';
}

export function hintText(p, tier, found = new Set()) {
  const h = p.hints[tier - 1];
  if (!h.solves) return h.text;
  const a = helpAnswer(p, found);
  return h.text + '\nTèo xếp: ' + answerText(p, a) + ' (' + a.map((e, i) => p.slots[i].label + ': ' + arr(e).map((id) => p.tokens.find((t) => t.id === id).text).join(' + ')).join('; ') + ')';
}

function facilitator(p) {
  const K = p.solutions.length;
  const lines = ['# ' + p.id + ': cho người điều hành (đừng đưa cho người chơi thử)', '', '## Đáp án', ...p.solutions.map((s) => '- ' + answerText(p, s) + '  (' + s.map((e) => arr(e).map((id) => p.tokens.find((t) => t.id === id).text).join(' + ')).join(' > ') + ')'), '', '## Trả lời khi bấm "Kiểm tra"', '- Sai cú pháp (mã lạ, thiếu/thừa mục, mảnh dùng hai lần, mảnh bị ô từ chối): "sai cú pháp" kèm lý do; không tính là một lần Kiểm tra', '- Còn ô dưới mức tối thiểu, hoặc bảng trống: "Còn N ô trống." (N chỉ phụ thuộc mức tối thiểu của các ô và số mảnh đã đặt, không phụ thuộc mảnh nào được đặt; không tính là một lần Kiểm tra)', '- Sai: "Chưa khớp." (không thêm gì, không nói ô nào, không chỉ thẻ nào; bảng rơi vào khung sai cũng chỉ nhận câu này, thẻ chỉ được chỉ ở bậc gợi ý người chơi tự bấm)'];
  if (K > 1) lines.push('- Khớp mà chưa đủ: "Khớp mọi thẻ. Đã tìm được n/' + K + ' cách. Còn cách nào khác cũng khớp không?"');
  if (p.conclusion) lines.push('- Bước kết luận: mỗi chỗ trống nhận một mảnh đúng nhãn. ' + arr(p.conclusion.blanks).map((b, i) => 'Chỗ ' + (i + 1) + ': ' + b.label + ' (' + arr(p.conclusion.bank).filter((x) => x.label === b.label).map((x) => x.text).join(' / ') + ')').join('; '));
  lines.push('- Xong: ' + p.reveal.lines.join(' ') + ' [' + p.reveal.label + ']', '', '## Gợi ý (đưa từng bậc khi người chơi bấm; bậc 5 làm hộ một cách chưa tìm ra)', ...p.hints.map((h) => h.tier + '. ' + h.text), '', 'Sau 3 lần "chưa khớp" liên tiếp: nói "Muốn mở bậc gợi ý kế tiếp không?" (đừng tự đưa).');
  return lines.join('\n') + '\n';
}

const args = process.argv.slice(2);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd = 'check', ...rest] = args;
  const files = () => readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  if (cmd === 'check') {
    const release = rest.includes('--release');
    const ids = rest.filter((a) => a !== '--release');
    const all = !ids.length;
    if (all) ids.push(...files());
    const hasPuzzle = (id) => existsSync(join(dir, id + '.json'));
    const hasChapter = (id) => existsSync(join(chapterDir, id + '.md'));
    if (!all) {
      const unknown = ids.filter((id) => !hasPuzzle(id) && !hasChapter(id));
      if (unknown.length) { console.error('error: unknown puzzle or chapter id: ' + unknown.join(', ')); process.exit(2); }
    }
    let bad = 0;
    let pending = 0;
    const chapters = all ? readdirSync(chapterDir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : ids.filter(hasChapter);
    const puzzleIds = all ? ids : ids.filter(hasPuzzle);
    for (const id of chapters) {
      for (const e of chapterProblems(id, readFileSync(join(chapterDir, id + '.md'), 'utf8'))) { console.error('  error: ' + e); bad += 1; }
    }
    for (const id of puzzleIds) {
      const r = checkOne(id, { full: true, release });
      report(r);
      for (const e of r.errors) console.error('  error: ' + e);
      bad += r.errors.length;
      pending += r.pending.length;
    }
    if (release && pending) { console.error('RELEASE GATE: ' + pending + ' conclusion piece(s) rest on a Sổ nguồn that is not written yet; write those chapters (story/notebook/<id>.json) before a release'); }
    if (bad) { console.error('FAIL: ' + bad + ' error(s)'); process.exit(1); }
    console.log('OK: ' + puzzleIds.length + ' puzzle(s), ' + chapters.length + ' chapter script(s)' + (pending ? ', ' + pending + ' pending (not a failure; the release gate "check --release" fails on them)' : ''));
  } else if (cmd === 'view') process.stdout.write(view(load(rest[0])));
  else if (cmd === 'facilitator') process.stdout.write(facilitator(load(rest[0])));
  else if (cmd === 'reply') {
    const p = load(rest[0]);
    const found = new Set();
    for (const b of rest.slice(1)) console.log(JSON.stringify(reply(p, b, found)));
  } else if (cmd === 'hint') {
    const p = load(rest[0]);
    const found = new Set();
    for (const b of rest.slice(2)) reply(p, b, found);
    console.log(hintText(p, Number(rest[1]), found));
  } else if (cmd === 'stub' && rest[0]) {
    const r = checkFile(rest[0]);
    report(r);
    for (const e of r.errors) console.error('  error: ' + e);
    if (r.errors.length) { console.error('FAIL: ' + r.errors.length + ' error(s)'); process.exit(1); }
  } else { console.error('usage: puzzles.mjs check|view|facilitator|reply|hint|stub <file|id>'); process.exit(2); }
}
