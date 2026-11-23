type Json = Record<string, unknown>;

const SLOT = ['id', 'label', 'cap', 'min', 'value', 'accepts'];
const TOKEN = ['id', 'text', 'status', 'shows', 'required', 'value'];
const CARD = ['id', 'who', 'when', 'kind', 'status', 'shows', 'text', 'source', 'url', 'do'];
const HINT = ['tier', 'text', 'card', 'solves'];
const WRONG_FRAME = ['trap', 'exact', 'do', 'cards'];
const TOP = ['id', 'title', 'question', 'orientation', 'input', 'bankSeed', 'predict', 'rules', 'demo', 'slots', 'tokens', 'cards', 'solutions', 'hints', 'wrongFrame', 'reveal', 'conclusion', 'minPlaced'];
const DEMO = ['question', 'slots', 'tokens', 'cards', 'solutions'];

const pick = (o: unknown, keys: readonly string[]): Json => Object.fromEntries(keys.filter((k) => o !== null && typeof o === 'object' && k in (o as Json)).map((k) => [k, (o as Json)[k]]));
const each = (list: unknown, keys: readonly string[]): Json[] => (Array.isArray(list) ? list.map((x) => pick(x, keys)) : []);

function board(p: Json, keys: readonly string[]): Json {
  const out = pick(p, keys);
  for (const [name, fields] of [['slots', SLOT], ['tokens', TOKEN], ['cards', CARD]] as const) if (name in out) out[name] = each(out[name], fields);
  return out;
}

/** The fields of a puzzle file the player reads at run time. The authoring notes, the checker's declarations and the evidence quotes stay in the file and never reach the page. */
export function slimPuzzle(p: Json): Json {
  const out = board(p, TOP);
  if ('rules' in out) out.rules = each(out.rules, ['text', 'do']);
  if ('hints' in out) out.hints = each(out.hints, HINT);
  if ('wrongFrame' in out) out.wrongFrame = pick(out.wrongFrame, WRONG_FRAME);
  if ('reveal' in out) out.reveal = pick(out.reveal, ['lines', 'label']);
  if ('predict' in out) out.predict = pick(out.predict, ['prompt', 'options']);
  if (out.demo) out.demo = board(out.demo as Json, DEMO);
  const c = out.conclusion as Json | undefined;
  if (c) out.conclusion = { template: c.template, blanks: each(c.blanks, ['label']), bank: each(c.bank, ['text', 'label', 'status', 'url']), thesis: pick(c.thesis, ['url']), hints: each(c.hints, ['text', 'solves']) };
  return out;
}
