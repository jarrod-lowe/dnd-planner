import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildModuleRuleGroups } from '$lib/rules-engine/metadata';
import type { LocaleDict } from '$lib/rules-engine';

/**
 * M2 / W4 — the metadata → search-index transform (the testable half).
 *
 * Resolves each module's `meta` i18n keys against the real locale files into the
 * exact rule-group shape the sync pipeline indexes
 * (`{ id, requires, translations: { <locale>: { name, description, keywords[] } } }`).
 * The artifact emit + the DynamoDB write are the env/CI half (not run here).
 */
function locale(name: string): LocaleDict {
  return JSON.parse(readFileSync(join(process.cwd(), `src/lib/i18n/${name}/common.json`), 'utf8'));
}
const LOCALES = { en: locale('en'), 'en-x-tlh': locale('en-x-tlh') };

describe('W4 metadata publish transform', () => {
  it('resolves divine-smite into the index shape, keyed by the canonical bare id', () => {
    const groups = buildModuleRuleGroups(LOCALES);
    // Canonical id (matches the backend / requires), NOT a path-qualified key.
    const ds = groups.find((g) => g.id === 'spell-divine-smite');
    expect(ds).toBeDefined();
    expect(ds!.requires).toEqual(['spellcasting']);
    expect(ds!.engineApiVersion).toBeGreaterThanOrEqual(1); // carried through for the version gate
    expect(ds!.translations.en).toEqual({
      name: 'Divine Smite',
      description: 'After a melee hit | +2d8 radiant (+1d8 per extra slot level)',
      keywords: ['smite', 'radiant', 'damage', 'burst', 'nova']
    });
  });

  it('emits literal strings, not i18n keys (resolution happened)', () => {
    for (const g of buildModuleRuleGroups(LOCALES)) {
      for (const t of Object.values(g.translations)) {
        expect(t.name.startsWith('rule.'), `${g.id} name resolved`).toBe(false);
        expect(Array.isArray(t.keywords)).toBe(true);
      }
    }
  });

  it('falls back to en when a locale lacks the key (no half-populated entry)', () => {
    // A locale dict missing everything should still yield en-resolved text.
    const groups = buildModuleRuleGroups({ en: LOCALES.en, fr: {} });
    const ds = groups.find((g) => g.id === 'spell-divine-smite')!;
    expect(ds.translations.fr.name).toBe('Divine Smite'); // en fallback
    expect(ds.translations.fr.keywords).toContain('smite');
  });

  it('produces no entries for modules without meta', () => {
    const ids = buildModuleRuleGroups(LOCALES).map((g) => g.id);
    expect(ids).not.toContain('action-economy');
  });
});
