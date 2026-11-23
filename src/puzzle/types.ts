export type Status = 'fact' | 'legend' | 'disputed' | 'rule' | 'decoy';
export type Kind = 'record' | 'modern' | 'retelling' | 'hypothesis' | 'inference' | 'rule';
export type Cell = string | string[] | null;

export interface Token {
  id: string;
  text: string;
  status: Status;
  shows?: Status;
  required?: boolean;
}

export interface Slot {
  id: string;
  label: string;
  cap?: number | 'any';
  min?: number;
}

export interface Card {
  id: string;
  who?: string;
  when?: string;
  kind: Kind;
  status: Status;
  shows?: Status;
  text: string;
  source?: string;
  url?: string | string[];
}

export interface Hint {
  tier: number;
  text: string;
  card?: string;
  solves?: boolean;
}

export interface ConclusionPiece {
  text: string;
  label: string;
  url?: string | string[];
}

export interface Conclusion {
  template: string;
  blanks: { label: string }[];
  bank: ConclusionPiece[];
  hints: { text: string; solves?: boolean }[];
}

export interface Demo {
  question: string;
  slots: Slot[];
  tokens: Token[];
  cards: Card[];
  solutions: Cell[][];
}

export interface PuzzleData {
  id: string;
  title: string;
  question: string;
  orientation: 'portrait' | 'landscape' | 'both';
  input?: string;
  predict?: { prompt: string; options: string[] };
  rules: { text: string }[];
  demo?: Demo;
  slots: Slot[];
  tokens: Token[];
  cards: Card[];
  solutions: Cell[][];
  hints: Hint[];
  reveal: { lines: string[]; label: string };
  conclusion?: Conclusion;
}

export type Reply =
  | { type: 'format'; reason: string }
  | { type: 'incomplete'; empty: number }
  | { type: 'wrong' }
  | { type: 'found'; n: number; of: number }
  | { type: 'solved' };

export interface BoardModel {
  cap: number[];
}
