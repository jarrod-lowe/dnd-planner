import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { locales } from '$lib/i18n';
import fs from 'fs';
import path from 'path';

// Import all translation files dynamically
const translations = import.meta.glob('$lib/i18n/*/common.json', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

/**
 * Flattens a nested object into dot-notation keys
 * e.g., { app: { title: 'x' } } => ['app.title']
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('translation parity', () => {
  it('all locales have the same translation keys', () => {
    const localeKeys = new Map<string, string[]>();

    for (const locale of locales) {
      const localePath = `/src/lib/i18n/${locale}/common.json`;
      const translation = translations[localePath];
      expect(translation, `Missing translation file for locale: ${locale}`).toBeDefined();
      localeKeys.set(locale, flattenKeys(translation));
    }

    // Get the reference keys from the first locale
    const referenceLocale = locales[0];
    const referenceKeys = localeKeys.get(referenceLocale)!;

    // Compare all other locales to the reference
    for (const locale of locales.slice(1)) {
      const keys = localeKeys.get(locale)!;

      const missing = referenceKeys.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !referenceKeys.includes(k));

      expect(missing, `Locale ${locale} is missing keys: ${missing.join(', ')}`).toEqual([]);
      expect(extra, `Locale ${locale} has extra keys: ${extra.join(', ')}`).toEqual([]);
      expect(keys, `Locale ${locale} keys don't match ${referenceLocale}`).toEqual(referenceKeys);
    }
  });
});

describe('translation completeness', () => {
  it('all $t() calls reference existing translation keys', () => {
    // Get all available keys from en locale (reference)
    const enPath = '/src/lib/i18n/en/common.json';
    const availableKeys = new Set(flattenKeys(translations[enPath]));

    // Find all source files with potential $t() calls
    const srcDir = path.resolve(process.cwd(), 'src');
    const sourceFiles: string[] = [];

    function findSourceFiles(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findSourceFiles(fullPath);
        } else if (entry.isFile() && /\.(svelte|ts)$/.test(entry.name)) {
          sourceFiles.push(fullPath);
        }
      }
    }
    findSourceFiles(srcDir);

    // Match $t('key') and $t("key") patterns
    const tCallPattern = /\$t\(['"]([^'"]+)['"]\)/g;
    const missingKeys: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = tCallPattern.exec(content)) !== null) {
        if (!availableKeys.has(match[1])) {
          const relativePath = path.relative(process.cwd(), file);
          missingKeys.push(`${match[1]} (in ${relativePath})`);
        }
      }
    }

    expect(
      missingKeys,
      `Missing translation keys: ${missingKeys.join(', ')}`
    ).toEqual([]);
  });
});

describe('i18n detectLocale', () => {
  beforeEach(() => {
    // Reset navigator for each test
    vi.stubGlobal('navigator', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns en when navigator is undefined (SSR case)', async () => {
    // Import fresh module with navigator undefined
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('en');
  });

  it('returns en for exact match with en-US, en', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-US', 'en'],
      language: 'en-US'
    });

    // Clear module cache to get fresh import with new navigator
    vi.resetModules();
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('en');
  });

  it('returns tlh for Klingon match', async () => {
    vi.stubGlobal('navigator', {
      languages: ['tlh'],
      language: 'tlh'
    });

    vi.resetModules();
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('tlh');
  });

  it('returns en for unsupported languages (fallback)', async () => {
    vi.stubGlobal('navigator', {
      languages: ['fr', 'de'],
      language: 'fr'
    });

    vi.resetModules();
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('en');
  });

  it('extracts primary language code from en-GB', async () => {
    vi.stubGlobal('navigator', {
      languages: ['en-GB'],
      language: 'en-GB'
    });

    vi.resetModules();
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('en');
  });

  it('uses navigator.language when navigator.languages is undefined', async () => {
    vi.stubGlobal('navigator', {
      languages: undefined,
      language: 'tlh'
    });

    vi.resetModules();
    const { detectLocale } = await import('$lib/i18n');
    expect(detectLocale()).toBe('tlh');
  });

  it('locales constant contains en and tlh', async () => {
    vi.resetModules();
    const { locales } = await import('$lib/i18n');
    expect(locales).toEqual(['en', 'tlh']);
  });
});
