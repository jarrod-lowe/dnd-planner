import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Supported locales for rule group translations.
 * This must match the schema.json supportedLocale enum.
 */
const SUPPORTED_LOCALES = ['en', 'en-x-tlh'] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface Translation {
  name: string;
  description: string;
  keywords: string[];
}

interface Rule {
  id: string;
  activities?: { type: string; rule?: Rule }[];
  ui?: Record<string, unknown>;
}

interface RuleGroup {
  id: string;
  requires?: string[];
  translations: Record<SupportedLocale, Translation>;
  rules?: Rule[];
  detail?: {
    key: string;
    source: string;
    translations: Record<string, { meta?: string; body: string }>;
  };
}

interface RuleGroupsFile {
  ruleGroups: RuleGroup[];
  refs?: unknown;
}

/**
 * Find all YAML files recursively in a directory, excluding _shared directories
 */
function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === '_shared') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load shared anchor definitions from _shared/definitions.yaml
 */
function loadSharedDefinitions(dataDir: string): string {
  const sharedFile = path.join(dataDir, '_shared', 'definitions.yaml');
  if (fs.existsSync(sharedFile)) {
    return fs.readFileSync(sharedFile, 'utf-8');
  }
  return '';
}

/**
 * Load and parse a YAML file, prepending shared definitions for anchor resolution
 */
function loadYamlFile(filePath: string, sharedDefs: string): RuleGroupsFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const combined = sharedDefs ? sharedDefs + '\n' + content : content;
  return yaml.load(combined) as RuleGroupsFile;
}

describe('rule groups translations', () => {
  const dataDir = path.resolve(process.cwd(), 'data/rule-groups');
  let yamlFiles: string[];
  const allRuleGroups: { file: string; ruleGroup: RuleGroup }[] = [];

  let sharedDefs: string;

  beforeAll(() => {
    yamlFiles = findYamlFiles(dataDir);
    sharedDefs = loadSharedDefinitions(dataDir);

    for (const file of yamlFiles) {
      const data = loadYamlFile(file, sharedDefs);
      if (data.ruleGroups) {
        for (const ruleGroup of data.ruleGroups) {
          allRuleGroups.push({ file: path.relative(process.cwd(), file), ruleGroup });
        }
      }
    }
  });

  it('all rule groups have translations object', () => {
    const missing: string[] = [];

    for (const { file, ruleGroup } of allRuleGroups) {
      if (!ruleGroup.translations || typeof ruleGroup.translations !== 'object') {
        missing.push(`${ruleGroup.id} (in ${file})`);
      }
    }

    expect(missing, `Rule groups missing translations object: ${missing.join(', ')}`).toEqual([]);
  });

  it('all rule groups have translations for all supported locales', () => {
    const missing: string[] = [];

    for (const { file, ruleGroup } of allRuleGroups) {
      if (!ruleGroup.translations) continue;

      for (const locale of SUPPORTED_LOCALES) {
        if (!ruleGroup.translations[locale]) {
          missing.push(`${ruleGroup.id} missing ${locale} (in ${file})`);
        }
      }
    }

    expect(missing, `Rule groups missing locale translations: ${missing.join(', ')}`).toEqual([]);
  });

  it('all translations have required fields (name, description, keywords)', () => {
    const missing: string[] = [];
    const requiredFields = ['name', 'description', 'keywords'] as const;

    for (const { file, ruleGroup } of allRuleGroups) {
      if (!ruleGroup.translations) continue;

      for (const locale of SUPPORTED_LOCALES) {
        const translation = ruleGroup.translations[locale];
        if (!translation) continue;

        for (const field of requiredFields) {
          if (translation[field] === undefined) {
            missing.push(`${ruleGroup.id}.${locale}.${field} (in ${file})`);
          }
        }
      }
    }

    expect(missing, `Translations missing required fields: ${missing.join(', ')}`).toEqual([]);
  });

  it('keywords are arrays of strings', () => {
    const invalid: string[] = [];

    for (const { file, ruleGroup } of allRuleGroups) {
      if (!ruleGroup.translations) continue;

      for (const locale of SUPPORTED_LOCALES) {
        const translation = ruleGroup.translations[locale];
        if (!translation) continue;

        if (!Array.isArray(translation.keywords)) {
          invalid.push(`${ruleGroup.id}.${locale}.keywords is not an array (in ${file})`);
        } else if (!translation.keywords.every((k) => typeof k === 'string')) {
          invalid.push(`${ruleGroup.id}.${locale}.keywords contains non-strings (in ${file})`);
        }
      }
    }

    expect(invalid, `Invalid keywords: ${invalid.join(', ')}`).toEqual([]);
  });

  it('all advertiseEffect rules have ui.name', () => {
    const missing: string[] = [];

    function findAdvertisedEffects(activities: Rule['activities'], file: string): void {
      if (!activities) return;
      for (const activity of activities) {
        if (activity.type === 'advertiseEffect' && activity.rule) {
          const ui = activity.rule.ui;
          if (!ui?.name) {
            missing.push(`${activity.rule.id} (in ${file})`);
          }
          // recurse into nested activities
          findAdvertisedEffects(activity.rule.activities, file);
        } else if (activity.rule) {
          // recurse into offerRule and other nested rules
          findAdvertisedEffects(activity.rule.activities, file);
        }
      }
    }

    for (const { file, ruleGroup } of allRuleGroups) {
      if (!ruleGroup.rules) continue;
      for (const rule of ruleGroup.rules) {
        findAdvertisedEffects(rule.activities, file);
      }
    }

    expect(missing, `Effects missing ui.name: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('rule group dependencies', () => {
  const dataDir = path.resolve(process.cwd(), 'data/rule-groups');
  const requiresById = new Map<string, string[]>();

  beforeAll(() => {
    const sharedDefs = loadSharedDefinitions(dataDir);
    for (const file of findYamlFiles(dataDir)) {
      const data = loadYamlFile(file, sharedDefs);
      if (!data.ruleGroups) continue;
      for (const rg of data.ruleGroups) {
        requiresById.set(rg.id, rg.requires ?? []);
      }
    }
  });

  // A `requires` cycle makes getDependents() report mutually-required groups as
  // each other's dependents, which blocks removal of either in Manage Rules.
  it('has no cycles in the requires graph', () => {
    const cycles: string[] = [];
    const VISITING = 1;
    const DONE = 2;
    const state = new Map<string, number>();

    const visit = (id: string, stack: string[]): void => {
      const cycleStart = stack.indexOf(id);
      if (cycleStart !== -1) {
        cycles.push([...stack.slice(cycleStart), id].join(' -> '));
        return;
      }
      if (state.get(id) === DONE) return;
      state.set(id, VISITING);
      for (const dep of requiresById.get(id) ?? []) {
        // Only follow edges to groups we actually loaded.
        if (requiresById.has(dep)) visit(dep, [...stack, id]);
      }
      state.set(id, DONE);
    };

    for (const id of requiresById.keys()) {
      if (state.get(id) !== DONE) visit(id, []);
    }

    expect(cycles, `requires cycles detected: ${cycles.join('; ')}`).toEqual([]);
  });

  // Thunderous Smite is a 2024-PHB general paladin L1 spell that is absent from
  // SRD 5.2 (its detail source is `custom`, not `srd52`) — the one deliberate
  // non-SRD member of the list. Without this requires edge it is reachable only
  // via manual rule-group assignment, so fresh paladins never see it.
  it('pulls Thunderous Smite into the paladin L1 spell list', () => {
    expect(requiresById.get('paladin-spells-l1')).toContain('spell-thunderous-smite');
  });
});

/** Phrases that would read as app meta in a tormentor detail body. */
const BANNED_APP_META = [
  'not modeled',
  'modeled',
  'modelled',
  'later pass',
  'later update',
  'this pass',
  'this app',
  'the app',
  'implemented',
  'placeholder',
  'seat',
  'pseudo',
  'update'
];

/** The en body of a detail block carried anywhere in vehicles/tormentor.yaml. */
function tormentorDetailBody(detailKey: string): string | undefined {
  const sharedDefs = loadSharedDefinitions(path.resolve(process.cwd(), 'data/rule-groups'));
  const data = loadYamlFile(
    path.resolve(process.cwd(), 'data/rule-groups/vehicles/tormentor.yaml'),
    sharedDefs
  );
  return data.ruleGroups!.find((rg) => rg.detail?.key === detailKey)?.detail?.translations.en?.body;
}

describe('tormentor detail body', () => {
  // The board-flip detail is the VEHICLE's stat block, in our own words (the
  // Tormentor is not SRD: numbers and short factual phrases only, never trait
  // prose). It must read in-world: no app meta (what is or is not "modeled",
  // which pass something arrives in) — a player flipping the chip wants the
  // war machine, not release notes.
  const body = tormentorDetailBody('vehicle/tormentor-damage-control');

  it('carries no app-meta phrasing', () => {
    const found = BANNED_APP_META.filter((phrase) => body?.toLowerCase().includes(phrase));
    expect(found, `app-meta phrases in the tormentor detail body: ${found.join(', ')}`).toEqual([]);
  });

  it('states the vehicle numbers a rider needs', () => {
    for (const fact of [
      '21',
      '19',
      '60',
      '100',
      '500',
      '3,000',
      '4 Medium',
      '16',
      '14',
      '+7',
      '120 ft.',
      '2d8',
      'Juke'
    ]) {
      expect(body, `the detail body states "${fact}"`).toContain(fact);
    }
  });
});

describe('tormentor prone detail body', () => {
  // The prone flips (both offers + the chip) land on the vehicle's OWN
  // condition text, not the player's condition/prone detail: a war machine
  // cannot crawl or spend movement to rise, so the PC prose would lie. Same
  // discipline as the stat block — our own words (not SRD), in-world voice,
  // no app meta.
  const body = tormentorDetailBody('vehicle/tormentor-prone');

  it('exists as a detail block in tormentor.yaml', () => {
    expect(body, 'a catalog group in vehicles/tormentor.yaml carries the prone detail').toEqual(
      expect.any(String)
    );
  });

  it('carries no app-meta phrasing', () => {
    const found = BANNED_APP_META.filter((phrase) => body?.toLowerCase().includes(phrase));
    expect(found, `app-meta phrases in the prone detail body: ${found.join(', ')}`).toEqual([]);
  });

  it('states the deficiency and the way clear of it', () => {
    for (const notion of ['prone', 'Prone Deficiency', 'cannot right itself', 'upright']) {
      expect(body, `the prone detail body states "${notion}"`).toContain(notion);
    }
  });
});

describe('tormentor damage detail body', () => {
  // The damage recorder carries the stat block's damage semantics — threshold,
  // immunities, mishap — as its flip detail. Nothing here BEHAVES differently
  // in the engine (the threshold aside, which the apply gates); the detail is
  // the settled home for the explanation, so it must state the three notions
  // plainly. Same discipline: our own words (the Tormentor is not SRD),
  // in-world voice, no app meta.
  const body = tormentorDetailBody('vehicle/tormentor-damage');

  it('exists as a detail block in tormentor.yaml', () => {
    expect(body, 'a catalog group in vehicles/tormentor.yaml carries the damage detail').toEqual(
      expect.any(String)
    );
  });

  it('carries no app-meta phrasing', () => {
    const found = BANNED_APP_META.filter((phrase) => body?.toLowerCase().includes(phrase));
    expect(found, `app-meta phrases in the damage detail body: ${found.join(', ')}`).toEqual([]);
  });

  it('states the threshold, the immunities and the mishap trigger', () => {
    for (const notion of [
      'Damage Threshold 10',
      'less than ten',
      'Fire',
      'poison',
      'psychic',
      'Mishap Threshold 20',
      'twenty',
      'mishap table'
    ]) {
      expect(body, `the damage detail body states "${notion}"`).toContain(notion);
    }
  });
});
