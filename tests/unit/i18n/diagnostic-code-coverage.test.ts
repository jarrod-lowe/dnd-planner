import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Every diagnostic `code` referenced by a rule group (e.g. illegalDiagnostics)
 * is an i18n key resolved at render time (e.g. in QuickSearch / PlanRow via
 * $t(d.code)). A code with no translation logs a runtime "No translation nor
 * fallback found" warning and shows the raw key to the user. This guards that
 * every such code has a translation in every supported locale.
 */
const SUPPORTED_LOCALES = ['en', 'en-x-tlh'] as const;

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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

/** Recursively collect every string `code` property that looks like a rule key. */
function collectCodes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectCodes(item, out);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'code' && typeof value === 'string' && value.startsWith('rule.')) {
        out.add(value);
      } else {
        collectCodes(value, out);
      }
    }
  }
}

/** Resolve a dotted i18n key against a loaded locale object. */
function resolveKey(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, locale);
}

describe('rule group diagnostic codes have translations', () => {
  const codes = new Set<string>();
  const locales: Record<string, Record<string, unknown>> = {};

  beforeAll(() => {
    const dataDir = path.resolve(process.cwd(), 'data/rule-groups');
    const sharedFile = path.join(dataDir, '_shared', 'definitions.yaml');
    const sharedDefs = fs.existsSync(sharedFile) ? fs.readFileSync(sharedFile, 'utf-8') : '';

    for (const file of findYamlFiles(dataDir)) {
      const content = fs.readFileSync(file, 'utf-8');
      const data = yaml.load(sharedDefs ? sharedDefs + '\n' + content : content);
      collectCodes((data as { ruleGroups?: unknown })?.ruleGroups, codes);
    }

    for (const locale of SUPPORTED_LOCALES) {
      const file = path.resolve(process.cwd(), `src/lib/i18n/${locale}/common.json`);
      locales[locale] = JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  });

  it('collects diagnostic codes from the rule group yaml', () => {
    expect(codes.size).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LOCALES)('every diagnostic code resolves in %s', (locale) => {
    const missing = [...codes].filter((code) => {
      const value = resolveKey(locales[locale], code);
      return typeof value !== 'string' || value.length === 0;
    });
    expect(missing, `Missing ${locale} translations for: ${missing.join(', ')}`).toEqual([]);
  });
});
