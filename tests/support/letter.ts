import { readFileSync } from 'node:fs';
import { letterOf, letterParts, letterText as textOf, letterTitle as titleOf, sourceLine, type SourcePiece } from '../../src/letter.ts';
import { chapterOf } from './script.ts';

/** The final letter the way the game derives it: the ending script plus the conclusion (bank and thesis) of story/puzzles/ending.json. */
export const LETTER = letterOf(chapterOf('ending'));
export const LETTER_CONCLUSION = (JSON.parse(readFileSync('story/puzzles/ending.json', 'utf8')) as { conclusion: { bank: (SourcePiece & { label: string })[]; thesis: SourcePiece & { source: string; evidence: string[] } } }).conclusion;
export const LETTER_BANK = LETTER_CONCLUSION.bank;
export const LETTER_LEAD = LETTER.lead;
export const LETTER_BODY = LETTER.body.map((line) => line.text);
export const LETTER_SIGNATURE = LETTER.signature;
export const LETTER_PARTS = letterParts(LETTER, LETTER_CONCLUSION);
export const LETTER_SOURCES = LETTER_PARTS.map(sourceLine);
export const letterTitle = (name: string): string => titleOf(LETTER, name);
export const letterText = (name: string): string => textOf(LETTER, LETTER_CONCLUSION, name);
