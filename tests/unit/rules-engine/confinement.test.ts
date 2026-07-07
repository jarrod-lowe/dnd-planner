import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M1 / W3 — confinement (belt-and-suspenders over the ESLint config).
 *
 * A source scan of every authored rule module asserting the security invariant
 * directly: modules import ONLY the builder API, and reference none of the banned
 * ambient globals. ESLint enforces this at author/CI time; this test makes the
 * invariant a hard, self-contained gate in `make test` too.
 */
const RULES_DIR = join(process.cwd(), 'src/lib/rules-engine/rules');
const files = readdirSync(RULES_DIR).filter((f) => f.endsWith('.ts'));

// Compound forms avoid false positives on benign substrings (Math.min, etc.).
const BANNED_TOKENS = [
  'fetch(',
  'window.',
  'document.',
  'localStorage',
  'sessionStorage',
  'XMLHttpRequest',
  'globalThis',
  'Math.random',
  'Date.now',
  'new Date',
  'setTimeout',
  'setInterval',
  'process.',
  'requestAnimationFrame'
];

describe('confinement (source scan)', () => {
  it('finds rule modules to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('every rule module imports only the builder API', () => {
    // Capture every module specifier: `import ... from 'x'`, side-effect
    // `import 'x'`, re-export `export ... from 'x'`, and dynamic `import('x')`.
    // A side-effect import has no `from`, so matching only `from` would let
    // `import '../engine'` smuggle engine internals past both lint and test.
    const SPECIFIER = /(?:(?:import|export)\b[^'"]*?\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
    for (const file of files) {
      const src = readFileSync(join(RULES_DIR, file), 'utf8');
      const sources = [...src.matchAll(SPECIFIER)].map((m) => m[1]);
      for (const s of sources) {
        expect(s, `${file} must import only ../builder, found ${s}`).toBe('../builder');
      }
    }
  });

  it('no rule module references a banned ambient global', () => {
    for (const file of files) {
      const src = readFileSync(join(RULES_DIR, file), 'utf8');
      for (const token of BANNED_TOKENS) {
        expect(src.includes(token), `${file} must not reference ${token}`).toBe(false);
      }
    }
  });
});
