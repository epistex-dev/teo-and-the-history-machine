import { readFileSync } from 'node:fs';
import { parseChapter } from '../../src/story/parse.ts';
import type { Beat, ChapterScript } from '../../src/story/types.ts';

export const chapterOf = (id: string): ChapterScript => parseChapter(readFileSync(`story/chapters/${id}.md`, 'utf8'), `${id}.md`);

export const intro: ChapterScript = chapterOf('intro');

export const lineOf = (beat: Beat, name = 'người đã hỏi'): string | null => (beat.t === 'say' || beat.t === 'narr' ? beat.text.replaceAll('{ten}', name) : null);

/** The first spoken or narrated line after the @minigame directive. */
export function lineAfterMinigame(script: ChapterScript, name: string): { scene: string; text: string } {
  let played = false;
  for (const scene of script.scenes) {
    const at = played ? -1 : scene.beats.findIndex((b) => b.t === 'minigame');
    if (!played && at < 0) continue;
    played = true;
    for (const beat of scene.beats.slice(at + 1)) {
      const text = lineOf(beat, name);
      if (text !== null) return { scene: scene.id, text };
    }
  }
  throw new Error('chapter has no line after its mini game');
}

export const firstLine = (script: ChapterScript, name = 'người đã hỏi'): string => {
  for (const beat of script.scenes[0]?.beats ?? []) {
    const text = lineOf(beat, name);
    if (text !== null) return text;
  }
  throw new Error('no line');
};

/** The first line of the chapter that uses the player's name, as the player reads it. */
export const nameLine = (script: ChapterScript, name: string): string => {
  for (const scene of script.scenes) {
    for (const beat of scene.beats) {
      if ((beat.t === 'say' || beat.t === 'narr') && beat.text.includes('{ten}')) return lineOf(beat, name) as string;
    }
  }
  throw new Error('chapter never uses the name');
};
