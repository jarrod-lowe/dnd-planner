import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';

/**
 * Guardrails for "flip" detail text wiring.
 *
 * A flip is produced when a rule group declares a `detail:` block (key/source/
 * translations) and a rule carries `ui.detailKey` pointing at that key. The
 * publish step turns the block into static/details/<locale>/<key>.json which
 * the UI renders. These tests verify the wiring is consistent and that the
 * combat-facing features we add flips to are actually wired up.
 */

interface RuleLike {
  id?: string;
  ui?: Record<string, unknown>;
  activities?: { type?: string; rule?: RuleLike }[];
}

interface DetailBlock {
  key: string;
  source: string;
  translations: Record<
    string,
    { meta?: string; fields?: { labelKey: string; value: string }[]; body?: string }
  >;
}

interface RuleGroup {
  id: string;
  detail?: DetailBlock;
  rules?: RuleLike[];
}

interface RuleGroupsFile {
  ruleGroups?: RuleGroup[];
}

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_shared') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findYamlFiles(full));
    else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')))
      files.push(full);
  }
  return files;
}

/** Recursively collect every ui.detailKey referenced by a rule and its nested offered/advertised rules. */
function collectDetailKeys(rule: RuleLike | undefined, out: string[]): void {
  if (!rule) return;
  const key = rule.ui?.detailKey;
  if (typeof key === 'string') out.push(key);
  for (const activity of rule.activities ?? []) {
    collectDetailKeys(activity.rule, out);
  }
}

/** Resolve a dotted i18n key (e.g. "rules.field.armorClass") against a parsed common.json object. */
function hasI18nKey(root: unknown, dotted: string): boolean {
  let node: unknown = root;
  for (const segment of dotted.split('.')) {
    if (
      typeof node !== 'object' ||
      node === null ||
      !(segment in (node as Record<string, unknown>))
    ) {
      return false;
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'string';
}

/** Combat-facing features that should expose SRD flip text in this pass. */
const EXPECTED_FLIPS = [
  'class-feature/lay-on-hands',
  'class-feature/divine-sense',
  'equipment/leather-armor',
  'equipment/shield',
  'equipment/splint-armor'
] as const;

describe('detail flip wiring', () => {
  const dataDir = path.resolve(process.cwd(), 'data/rule-groups');
  const sharedFile = path.join(dataDir, '_shared', 'definitions.yaml');
  const sharedDefs = fs.existsSync(sharedFile) ? fs.readFileSync(sharedFile, 'utf-8') : '';

  const definedKeys = new Map<string, DetailBlock>(); // detail.key -> block
  const referencedKeys = new Set<string>(); // ui.detailKey references

  beforeAll(() => {
    for (const file of findYamlFiles(dataDir)) {
      const content = fs.readFileSync(file, 'utf-8');
      const combined = sharedDefs ? sharedDefs + '\n' + content : content;
      const data = yaml.load(combined) as RuleGroupsFile;
      for (const rg of data.ruleGroups ?? []) {
        if (rg.detail) definedKeys.set(rg.detail.key, rg.detail);
        const keys: string[] = [];
        for (const rule of rg.rules ?? []) collectDetailKeys(rule, keys);
        keys.forEach((k) => referencedKeys.add(k));
      }
    }
  });

  it('every referenced detailKey resolves to a defined detail block', () => {
    const dangling = [...referencedKeys].filter((k) => !definedKeys.has(k));
    expect(dangling, `detailKeys with no detail block: ${dangling.join(', ')}`).toEqual([]);
  });

  it('expected combat-facing features each have a detail block', () => {
    const missing = EXPECTED_FLIPS.filter((k) => !definedKeys.has(k));
    expect(missing, `missing detail blocks: ${missing.join(', ')}`).toEqual([]);
  });

  it('expected combat-facing features are each referenced by a rule', () => {
    const unwired = EXPECTED_FLIPS.filter((k) => !referencedKeys.has(k));
    expect(
      unwired,
      `detail blocks defined but no rule carries the detailKey: ${unwired.join(', ')}`
    ).toEqual([]);
  });

  it('every detail block has en body text', () => {
    // Detail bodies are SRD reference text authored in English; the tlh
    // pseudo-locale falls back to en (no detail block carries en-x-tlh).
    const bad: string[] = [];
    for (const [key, block] of definedKeys) {
      if (!block.translations?.en?.body) bad.push(`${key} missing en body`);
    }
    expect(bad, bad.join(', ')).toEqual([]);
  });

  it('every field labelKey used in a detail block exists in both locales', () => {
    const missing: string[] = [];
    for (const [key, block] of definedKeys) {
      for (const locale of Object.keys(block.translations ?? {})) {
        for (const field of block.translations[locale]?.fields ?? []) {
          if (!hasI18nKey(enCommon, field.labelKey))
            missing.push(`${key}: ${field.labelKey} missing in en`);
          if (!hasI18nKey(tlhCommon, field.labelKey))
            missing.push(`${key}: ${field.labelKey} missing in en-x-tlh`);
        }
      }
    }
    expect([...new Set(missing)], missing.join(', ')).toEqual([]);
  });
});
