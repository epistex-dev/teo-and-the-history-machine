import { defineConfig } from 'vite';
import { chapters } from './scripts/chapters-plugin.ts';
import { puzzleCore } from './scripts/puzzle-core-plugin.ts';
import { slimPuzzle } from './src/puzzle/slim.ts';

export default defineConfig({
  plugins: [
    chapters(),
    puzzleCore(),
    {
      name: 'puzzle-slim',
      enforce: 'pre',
      transform: (code, id) => (/\/story\/puzzles\/[^/]+\.json$/.test(id.split('?')[0] ?? '') ? JSON.stringify(slimPuzzle(JSON.parse(code))) : null),
    },
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
    modulePreload: { resolveDependencies: (filename, deps) => deps.filter((dep) => dep !== filename) },
    rolldownOptions: {
      output: {
        chunkFileNames: (chunk) => {
          if (chunk.facadeModuleId?.includes('/story/chapters/')) return 'assets/chapter-[name]-[hash].js';
          return chunk.facadeModuleId?.includes('/story/puzzles/') ? 'assets/pz-[name]-[hash].js' : 'assets/[name]-[hash].js';
        },
        codeSplitting: {
          groups: [
            { name: 'shared', test: /vite[\\/]preload-helper|src[\\/](?:storage|audio)\.ts/ },
            { name: 'puzzle', test: /src[\\/]puzzle[\\/]|puzzle-core/ },
            { name: 'notebook', test: /story[\\/]notebook[\\/]/ },
          ],
        },
      },
    },
  },
});
