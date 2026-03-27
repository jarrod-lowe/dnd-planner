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

interface RuleGroup {
  id: string;
  translations: Record<SupportedLocale, Translation>;
  rules?: unknown[];
}

interface RuleGroupsFile {
  ruleGroups: RuleGroup[];
}

/**
 * Find all YAML files recursively in a directory
 */
function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
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
 * Load and parse a YAML file
 */
function loadYamlFile(filePath: string): RuleGroupsFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(content) as RuleGroupsFile;
}

describe('rule groups translations', () => {
  const dataDir = path.resolve(process.cwd(), 'data/rule-groups');
  let yamlFiles: string[];
  const allRuleGroups: { file: string; ruleGroup: RuleGroup }[] = [];

  beforeAll(() => {
    yamlFiles = findYamlFiles(dataDir);

    for (const file of yamlFiles) {
      const data = loadYamlFile(file);
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
});
