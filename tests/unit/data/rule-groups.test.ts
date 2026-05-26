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
  translations: Record<SupportedLocale, Translation>;
  rules?: Rule[];
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
