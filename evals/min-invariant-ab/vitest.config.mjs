import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Isolated config (root pinned to this dir) so this eval's "designed-to-fail"
// arm (min vs broken) does not pollute the engine's own green suite. Run:
//   pnpm exec vitest run --config evals/min-invariant-ab/vitest.config.mjs
export default defineConfig({
  root: here,
  test: {
    include: ['*.test.mjs'],
    reporters: ['default', 'json'],
    outputFile: { json: './results.json' },
  },
});
