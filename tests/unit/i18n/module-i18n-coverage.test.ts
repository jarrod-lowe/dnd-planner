import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every `rule.*` i18n key a v2 module references must resolve in every locale.
 *
 * v2 modules carry their offer names, descriptions, diagnostic codes, effect
 * display names and annotation keys as `rule.*` strings — a missing translation
 * surfaces to the player as a raw key. The v1 equivalent walked the YAML rules
 * (deleted with them); this walks the module SOURCE: plain `'rule.…'` literals,
 * plus template keys built from a file's `const X = 'rule.…'` prefixes
 * (`` `${X}.suffix` ``, including one level of prefix nesting). Keys built from
 * TWO template vars (e.g. `${AS}.effect-${FULL[a]}.name`) cannot be expanded
 * statically and are not checked here.
 *
 * Resolution mirrors sveltekit-i18n, which FLATTENS nested JSON — so a key
 * matches either a nested path or a flat dotted key (e.g. `rules` containing
 * `"settings.paladin-skill.athletics"`). A referenced prefix (a const used only
 * as a base) resolves as long as some translation key extends it.
 */

const ROOT = process.cwd();
const ENGINE_DIR = join(ROOT, 'src/lib/rules-engine-v2');
const LOCALES = ['en', 'en-x-tlh'] as const;

/** Flatten a locale dict exactly as sveltekit-i18n does (dot-joined leaves). */
function flattenKeys(node: unknown, prefix: string, out: Set<string>): void {
  if (typeof node === 'string') {
    out.add(prefix);
    return;
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      flattenKeys(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
}

function localeFlatKeys(locale: string): Set<string> {
  const dict = JSON.parse(readFileSync(join(ROOT, `src/lib/i18n/${locale}/common.json`), 'utf8'));
  const out = new Set<string>();
  flattenKeys(dict, '', out);
  return out;
}

/** Every .ts file under the engine dir (rules/, builder, …). */
function engineSources(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) files.push(p);
    }
  };
  walk(ENGINE_DIR);
  return files;
}

/** All statically-resolvable rule.* keys referenced by one source file. */
function keysInSource(source: string): string[] {
  const keys: string[] = [];

  // const NAME = 'rule....'
  const prefixes = new Map<string, string>();
  for (const m of source.matchAll(/const ([A-Z_]+) = ['`](rule\.[a-zA-Z0-9._-]+)['`]/g)) {
    prefixes.set(m[1], m[2]);
  }
  // const NAME = `${OTHER}.suffix` (one level of nesting)
  for (const m of source.matchAll(/const ([A-Z_]+) = `\$\{([A-Z_]+)\}\.([a-zA-Z0-9._-]+)`/g)) {
    const base = prefixes.get(m[2]);
    if (base) prefixes.set(m[1], `${base}.${m[3]}`);
  }

  // Plain literals.
  for (const m of source.matchAll(/'(rule\.[a-zA-Z0-9._-]+)'/g)) keys.push(m[1]);
  // `${NAME}.suffix` template usages (suffix must be literal — no inner ${…}).
  for (const m of source.matchAll(/`\$\{([A-Z_]+)\}\.([a-zA-Z0-9._-]+)`/g)) {
    const base = prefixes.get(m[1]);
    if (base) keys.push(`${base}.${m[2]}`);
  }
  return keys;
}

describe('v2 module i18n coverage', () => {
  const referenced = new Set<string>();
  for (const file of engineSources()) {
    for (const key of keysInSource(readFileSync(file, 'utf8'))) referenced.add(key);
  }

  it('collects a meaningful key set (the extractor is not silently broken)', () => {
    expect(referenced.size).toBeGreaterThan(100);
  });

  for (const locale of LOCALES) {
    it(`every referenced rule.* key resolves in ${locale}`, () => {
      const flat = localeFlatKeys(locale);
      const missing = [...referenced].filter((key) => {
        if (flat.has(key)) return false;
        // A prefix (const used as a base) is fine if any translation extends it.
        for (const k of flat) if (k.startsWith(key + '.')) return false;
        return true;
      });
      expect(missing.sort(), `unresolved i18n keys in ${locale}`).toEqual([]);
    });
  }
});
