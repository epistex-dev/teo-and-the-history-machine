import { readFileSync } from 'node:fs';
import { parseAst, type Plugin } from 'vite';

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const ID = 'virtual:puzzle-core';
const SOURCE = new URL('./puzzles.mjs', import.meta.url).pathname;

/** What the player takes from the checker: board model, bank order, reply semantics and the hint answer. */
export const PLAYER_EXPORTS = ['bankOrder', 'pieceIds', 'model', 'reply', 'helpAnswer', 'answerOf', 'toState', 'KIND', 'SHOWN', 'conclusionCorrect'];

const isNode = (x: unknown): x is Node => typeof x === 'object' && x !== null && typeof (x as Node).type === 'string';

function referenced(node: Node, into: Set<string>): void {
  const visit = (x: unknown, skipKey?: string): void => {
    if (Array.isArray(x)) {
      for (const item of x) visit(item);
      return;
    }
    if (!isNode(x)) return;
    if (x.type === 'Identifier') {
      into.add(x.name as string);
      return;
    }
    for (const [key, value] of Object.entries(x)) {
      if (key === skipKey) continue;
      const plain = !x.computed;
      if ((x.type === 'MemberExpression' && key === 'property' && plain) || ((x.type === 'Property' || x.type === 'MethodDefinition') && key === 'key' && plain && !x.shorthand)) continue;
      visit(value);
    }
  };
  visit(node);
}

/**
 * The part of scripts/puzzles.mjs the player needs: the named exports and every top-level declaration they reach.
 * The solver, the bots and the command line are never reached, so they cannot ship, and the player cannot drift from the checker.
 */
export function puzzleCoreSource(code: string, want: readonly string[] = PLAYER_EXPORTS): string {
  const body = (parseAst(code) as unknown as { body: Node[] }).body;
  const declared = new Map<string, Node>();
  const imported = new Set<string>();
  for (const node of body) {
    if (node.type === 'ImportDeclaration') {
      for (const s of node.specifiers as { local: { name: string } }[]) imported.add(s.local.name);
      continue;
    }
    const d = node.type === 'ExportNamedDeclaration' && isNode(node.declaration) ? node.declaration : node;
    if (d.type === 'FunctionDeclaration') declared.set((d.id as { name: string }).name, node);
    else if (d.type === 'VariableDeclaration') for (const v of d.declarations as { id: Node & { name: string } }[]) declared.set(v.id.name, node);
  }
  const needed = new Set<Node>();
  const queue = [...want];
  const seen = new Set<string>();
  while (queue.length) {
    const name = queue.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const node = declared.get(name);
    if (!node) {
      if (imported.has(name)) throw new Error(`puzzle core reaches the imported binding ${name} of scripts/puzzles.mjs`);
      continue;
    }
    needed.add(node);
    const names = new Set<string>();
    referenced(node, names);
    for (const n of names) if (declared.has(n) || imported.has(n)) queue.push(n);
  }
  for (const name of want) if (!declared.has(name)) throw new Error(`scripts/puzzles.mjs no longer declares ${name}`);
  const parts = [...needed].sort((a, b) => a.start - b.start).map((node) => {
    const d = node.type === 'ExportNamedDeclaration' && isNode(node.declaration) ? node.declaration : node;
    return code.slice(d.start, node.end);
  });
  return `${parts.join('\n')}\nexport { ${want.join(', ')} };\n`;
}

export function puzzleCore(): Plugin {
  return {
    name: 'puzzle-core',
    resolveId: (id) => (id === ID ? `\0${ID}` : null),
    load(id) {
      if (id !== `\0${ID}`) return null;
      this.addWatchFile(SOURCE);
      return puzzleCoreSource(readFileSync(SOURCE, 'utf8'));
    },
  };
}
