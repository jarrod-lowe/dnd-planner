import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_API_VERSION } from '$lib/rules-engine';
import { extractMetadata, buildVersionManifest } from '$lib/rules-engine/metadata';
import { lazyRuleGroupIds } from '$lib/rules-engine';

const en = JSON.parse(
  readFileSync(join(process.cwd(), 'src/lib/i18n/en/common.json'), 'utf8')
) as Record<string, unknown>;

/** Resolve a dotted i18n key against the nested locale object, or undefined. */
function resolveKey(key: string): unknown {
  return key.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg];
    return undefined;
  }, en);
}

/**
 * M2 / W2 — module metadata extraction.
 *
 * The search index needs only a module's `meta` (name/description/keywords as
 * i18n keys + requires); logic stays in the chunk. `extractMetadata` builds the
 * index from the registry, including only "content" groups that carry meta.
 */
describe('metadata extraction', () => {
  it('emits an entry for a content group with its meta + rule-group id', () => {
    const entry = extractMetadata().find((e) => e.ruleGroupId === 'spell-divine-smite');
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      ruleGroupId: 'spell-divine-smite',
      name: 'rule.spell-divine-smite.offer-divine-smite.name',
      description: 'rule.spell-divine-smite.offer-divine-smite.description',
      keywords: 'rule.spell-divine-smite.offer-divine-smite.keywords',
      requires: ['spellcasting']
    });
  });

  it('stamps the engine API version on every entry (for the client version gate)', () => {
    for (const e of extractMetadata()) {
      expect(e.engineApiVersion).toBe(ENGINE_API_VERSION);
    }
  });

  it('omits foundational modules that carry no meta', () => {
    const ids = extractMetadata().map((e) => e.ruleGroupId);
    // action-economy / hp are engine plumbing, not searchable content.
    expect(ids).not.toContain('action-economy');
    expect(ids).not.toContain('hp');
  });

  it('references i18n keys, never literal display text (i18n compliance)', () => {
    for (const e of extractMetadata()) {
      expect(e.name.startsWith('rule.'), `${e.ruleGroupId} name is an i18n key`).toBe(true);
      expect(e.description.startsWith('rule.'), `${e.ruleGroupId} description is an i18n key`).toBe(
        true
      );
    }
  });

  it('version manifest covers EVERY lazy chunk, including meta-less foundational ones', () => {
    const manifest = buildVersionManifest();
    // Foundational chunks have no meta but are lazy-loadable — they must still
    // have a published version, or they'd bypass the loader's skew gate.
    for (const id of [
      'spellcasting',
      'hp',
      'action-economy',
      'ability-scores',
      'spell-divine-smite'
    ]) {
      expect(manifest[id]).toBe(ENGINE_API_VERSION);
    }
    // One entry per lazy chunk — the gate covers the full loadable set.
    expect(Object.keys(manifest).sort()).toEqual(lazyRuleGroupIds().slice().sort());
  });

  it('every meta i18n key resolves in en/common.json (no dangling keys)', () => {
    for (const e of extractMetadata()) {
      for (const key of [e.name, e.description, e.keywords]) {
        expect(typeof resolveKey(key), `${e.ruleGroupId}: "${key}" must resolve`).toBe('string');
      }
    }
  });
});
