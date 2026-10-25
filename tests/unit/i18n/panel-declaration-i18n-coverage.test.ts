import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registeredRuleGroupIds, resolveModules } from '$lib/rules-engine/registry';
import type { SubjectPanelDeclaration } from '$lib/rules-engine/builder';
import type { UiEntry } from '$lib/rules-engine/panels';

/**
 * Every i18n key a module's `panels` declarations carry must resolve in every
 * locale — the same contract `module-i18n-coverage` enforces for `rule.*`
 * keys, extended to the subject-panel surface.
 *
 * A panel declaration is pure data handed straight to the renderer: nothing
 * between the declaration and the chip checks that `label` (or an ability's
 * `name`, a pool's `shortLabel`/`tile`, a concentration entry's
 * `activeLabel`/`noneLabel`) exists, so a key that landed in the wrong pocket
 * of the locale files (e.g. `play.ledger.short.*` while the declaration reads
 * `play.stats.*`) renders as the raw key on the chip. This walk of every
 * registered module's declarations is the tripwire.
 */

const ROOT = process.cwd();
const LOCALES = ['en', 'en-x-tlh'] as const;

/** Flatten a locale dict exactly as sveltekit-i18n does (dot-joined leaves). */
function localeFlatKeys(locale: string): Set<string> {
  const dict = JSON.parse(readFileSync(join(ROOT, `src/lib/i18n/${locale}/common.json`), 'utf8'));
  const out = new Set<string>();
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === 'string') {
      out.add(prefix);
      return;
    }
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node)) walk(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  walk(dict, '');
  return out;
}

/** Every i18n key one declared entry renders. */
function keysOfEntry(entry: UiEntry): string[] {
  const keys = [entry.label];
  if (entry.type === 'ability') keys.push(...entry.abilities.map((a) => a.name));
  if (entry.type === 'actionPools')
    for (const p of entry.pools) keys.push(p.label, p.shortLabel, p.tile);
  if (entry.type === 'concentration') keys.push(entry.activeLabel, entry.noneLabel);
  return keys;
}

function declaredEntries(): Array<{ moduleId: string; declaration: SubjectPanelDeclaration }> {
  const { modules } = resolveModules(registeredRuleGroupIds());
  const out: Array<{ moduleId: string; declaration: SubjectPanelDeclaration }> = [];
  for (const m of modules)
    for (const d of m.panels ?? []) out.push({ moduleId: m.id, declaration: d });
  return out;
}

describe('panel declaration i18n coverage', () => {
  const entries = declaredEntries();

  it('collects a meaningful declaration set (the walk is not silently broken)', () => {
    expect(entries.length).toBeGreaterThan(4);
  });

  for (const locale of LOCALES) {
    it(`every declared panel label resolves in ${locale}`, () => {
      const flat = localeFlatKeys(locale);
      const missing = entries.flatMap(({ moduleId, declaration }) =>
        keysOfEntry(declaration.entry)
          .filter((key) => !flat.has(key))
          .map((key) => `${moduleId} › ${declaration.subject} › ${key}`)
      );
      expect(missing.sort(), `unresolved panel label keys in ${locale}`).toEqual([]);
    });
  }
});
