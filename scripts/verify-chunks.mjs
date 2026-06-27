// M2 / W5 — verify the lazy-loading **mechanism** (NOT deployment readiness).
//
// Builds the v2 lazy loader (src/lib/rules-engine-v2/lazy.ts) with Vite and
// asserts every rule module becomes its OWN chunk via its dynamic import() —
// i.e. the split points exist and nothing eager-bundles the registry into the
// loader. Tree-shaking is disabled so the split points show without a consumer.
//
// SCOPE / what this does NOT prove: it builds the loader as a standalone entry,
// so a green run does NOT mean the deployed SvelteKit app ships these chunks. It
// won't until the app actually imports `loadModules` (M4 wiring) — until then
// `build/_app/immutable` contains no rule chunks. So do not gate a test deploy on
// this as "chunks are shipped"; the real shipping check is the SvelteKit build
// output once v2 is wired in. Runs anywhere Vite runs — no AWS, no deploy.
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
console.log('✓ Every rule module code-splits into its own lazy chunk (mechanism only).');
console.log('  Note: does not prove the SvelteKit app ships them — that needs M4 wiring.');
