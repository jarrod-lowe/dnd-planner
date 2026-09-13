import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { buildModuleRuleGroups } from '$lib/rules-engine/metadata';
import { getModule, registeredRuleGroupIds } from '$lib/rules-engine/registry';
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
    expect(ds!.requires).toEqual(['spellcasting', 'prepared-spells']);
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

/** Find all YAML files under a directory, excluding _shared (as rule-groups.test.ts). */
function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_shared' || entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findYamlFiles(fullPath));
    else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) files.push(fullPath);
  }
  return files;
}

/**
 * Parity contract: a module's `meta.requires` mirrors the published YAML group's
 * `requires` (see the divine-smite module comment). `buildModuleRuleGroups`
 * publishes the module list, so any drift ships a different prerequisite than
 * the live YAML catalog. Checked for every group that has BOTH sides.
 */
describe('module ↔ YAML requires parity', () => {
  it("every module's meta.requires equals the YAML group's requires", () => {
    const dataDir = resolve(process.cwd(), 'data/rule-groups');
    const sharedFile = join(dataDir, '_shared', 'definitions.yaml');
    const sharedDefs = existsSync(sharedFile) ? readFileSync(sharedFile, 'utf-8') : '';
    const yamlRequires = new Map<string, string[]>();
    for (const file of findYamlFiles(dataDir)) {
      const data = yaml.load(
        sharedDefs ? sharedDefs + '\n' + readFileSync(file, 'utf-8') : readFileSync(file, 'utf-8')
      ) as { ruleGroups?: { id: string; requires?: string[] }[] };
      for (const rg of data.ruleGroups ?? []) {
        if (rg.requires) yamlRequires.set(rg.id, rg.requires);
      }
    }

    const mismatches: string[] = [];
    for (const id of registeredRuleGroupIds()) {
      const moduleRequires = getModule(id)?.meta?.requires;
      const published = yamlRequires.get(id);
      if (!moduleRequires || !published) continue; // only groups with both sides
      if (JSON.stringify(moduleRequires) !== JSON.stringify(published)) {
        mismatches.push(
          `${id}: module [${moduleRequires.join(', ')}] != yaml [${published.join(', ')}]`
        );
      }
    }

    expect(
      mismatches,
      `requires drift between modules and YAML: \n${mismatches.join('\n')}`
    ).toEqual([]);
  });
});
