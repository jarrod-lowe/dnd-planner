// M2 / W5 — verify the co-bundled lazy-loading delivery mechanism.
//
// Builds the v2 lazy loader (src/lib/rules-engine-v2/lazy.ts) with Vite and
// asserts every rule module becomes its OWN chunk via its dynamic import(). This
// is what makes per-character lazy loading real: a character pulls only its
// groups' chunks, not the whole rule set. Guards against accidental
// eager-bundling (e.g. a static import sneaking the registry into the loader).
//
// Runs anywhere Vite runs — no AWS, no deploy. Tree-shaking is disabled so the
// split points are exposed without a consumer keeping them alive.
import { build } from 'vite';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RULES_DIR = 'src/lib/rules-engine-v2/rules';
const OUT = join(tmpdir(), 'rev2-chunk-verify');

const expected = readdirSync(RULES_DIR)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''));

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    write: true,
    outDir: OUT,
    emptyOutDir: true,
    minify: false,
    target: 'esnext',
    rollupOptions: {
      treeshake: false,
      preserveEntrySignatures: 'strict',
      input: { lazy: `${RULES_DIR}/../lazy.ts` },
      output: { format: 'es', entryFileNames: '[name].js', chunkFileNames: 'chunk-[name].js' }
    }
  }
});

const emitted = new Set(readdirSync(OUT));
const missing = expected.filter((name) => !emitted.has(`chunk-${name}.js`));

console.log(`Rule modules: ${expected.length}`);
console.log(`Chunks emitted: ${[...emitted].filter((f) => f.startsWith('chunk-')).length}`);
if (missing.length) {
  console.error('✗ Missing per-module chunks (eager-bundling regression?):', missing.join(', '));
  process.exit(1);
}
console.log('✓ Every rule module code-splits into its own lazy chunk.');
