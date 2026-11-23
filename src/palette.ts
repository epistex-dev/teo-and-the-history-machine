/** Colour tokens of the story stage, the name card and the mini games. */
export const palette = {
  ink: '#1b1f2e',
  night: '#27406b',
  snow: '#fff6e3',
  paper: '#eadcc0',
  holly: '#c9343b',
  berry: '#7e1f33',
  pine: '#2f7a55',
  pinedeep: '#1d4a3d',
  gold: '#f2b640',
  ember: '#e8782f',
  ice: '#9fd3e6',
  skin: '#f0b48f',
  skinsh: '#d98c6b',
  teal: '#3aa5a0',
} as const;

export type Token = keyof typeof palette;

export const css = (token: Token): string => palette[token];
export const hex = (token: Token): number => Number.parseInt(palette[token].slice(1), 16);
