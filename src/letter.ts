import type { ChapterScript } from './story/types.ts';

export const LETTER_FILE = 'thu-tra-loi.png';

export type ClaimStatus = 'fact' | 'disputed' | 'legend';

/** Every claim line of the letter opens with its label; the label picks the status of the pieces the source line comes from. */
const CLAIMS: [RegExp, ClaimStatus][] = [
  [/^Chắc:/, 'fact'],
  [/^Còn tranh cãi:/, 'disputed'],
  [/^Người ta kể rằng\b/, 'legend'],
];
const HEADING = /^(.*?)\s*\{ten\}\.?$/;

export interface Letter {
  /** The heading without the name: "Thư trả lời gửi". */
  lead: string;
  /** claim is null for the line without a label: the opening thesis. */
  body: { text: string; claim: ClaimStatus | null }[];
  signature: string;
}

export interface SourcePiece {
  status?: string;
  url?: string | string[];
}

/** What the letter needs of the conclusion of the ending puzzle: the pieces behind the three labelled claims and the source of the opening thesis. */
export interface LetterSources {
  bank: SourcePiece[];
  thesis: SourcePiece;
}

export interface LetterPart {
  text: string;
  sources: { host: string; url: string }[];
}

/** The letter is what Tèo says in the script: the line "Thư trả lời gửi {ten}." gives the heading and the signer, the lines after it up to @name-card are the body. */
export function letterOf(script: ChapterScript): Letter {
  const beats = script.scenes.flatMap((scene) => scene.beats);
  const end = beats.findIndex((beat) => beat.t === 'name-card');
  const said = (end < 0 ? beats : beats.slice(0, end)).flatMap((beat) => (beat.t === 'say' ? [beat] : []));
  const at = said.findIndex((beat) => HEADING.test(beat.text));
  const head = said[at];
  const lead = head && HEADING.exec(head.text)?.[1];
  if (!head || !lead) throw new Error(`${script.id}: no line "<lead> {ten}." before @name-card`);
  const body = said.slice(at + 1).filter((beat) => beat.who === head.who);
  return { lead, body: body.map((beat) => ({ text: beat.text, claim: CLAIMS.find(([label]) => label.test(beat.text))?.[1] ?? null })), signature: head.who };
}

const hostOf = (url: string): string => new URL(url).hostname.replace(/^www\./, '');

/** The sources of one line: for a claim the links of the conclusion pieces with its status, for the line without a label (the opening thesis) the links of the thesis; one entry per host. */
export function sourcesOf({ bank, thesis }: LetterSources, claim: ClaimStatus | null): { host: string; url: string }[] {
  const seen = new Map<string, string>();
  for (const piece of claim ? bank.filter((p) => p.status === claim) : [thesis]) for (const url of [piece.url ?? []].flat()) if (!seen.has(hostOf(url))) seen.set(hostOf(url), url);
  return [...seen].map(([host, url]) => ({ host, url }));
}

export const letterParts = (letter: Letter, conclusion: LetterSources): LetterPart[] =>
  letter.body.map(({ text, claim }) => ({ text, sources: sourcesOf(conclusion, claim) }));

export const SOURCE_LEAD = 'Nguồn:';
export const sourceLine = (part: LetterPart): string | null => (part.sources.length ? `${SOURCE_LEAD} ${part.sources.map((s) => s.host).join(', ')}` : null);

export const letterTitle = (letter: Letter, name: string): string => `${letter.lead} ${name}`;

/** The whole letter as one text: the alt of the image and the line a screen reader gets. */
export const letterText = (letter: Letter, conclusion: LetterSources, name: string): string =>
  [`${letterTitle(letter, name)}.`, ...letterParts(letter, conclusion).flatMap((part) => [part.text, sourceLine(part)]), letter.signature].filter((line): line is string => line !== null).join(' ');
