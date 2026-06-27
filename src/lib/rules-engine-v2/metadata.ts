import type { RuleMeta } from './types';
import { registeredRuleGroupIds, getModule } from './registry';
import { ENGINE_API_VERSION } from './version';

/**
 * One search-index entry for a rule group: its rule-group id, the module's
 * discovery `meta`, and the engine version the chunk was built against (so a
 * client can gate on compatibility before loading). `name`/`description`/
 * `keywords` are still i18n keys here; resolving them to indexed terms (and
 * writing to DynamoDB) is W4's publish step, which needs the env. This extraction
 * is the pure, testable half.
 */
export interface MetadataEntry extends RuleMeta {
  ruleGroupId: string;
  engineApiVersion: number;
}

/**
 * Build the metadata index from the registered modules. Only modules that carry
 * `meta` (user-facing "content" groups) are included; foundational engine modules
 * (action economy, hp, …) have no search presence and are skipped.
 *
 * Pure: depends only on the static registry.
 */
export function extractMetadata(): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  for (const ruleGroupId of registeredRuleGroupIds()) {
    const meta = getModule(ruleGroupId)?.meta;
    if (meta) entries.push({ ruleGroupId, ...meta, engineApiVersion: ENGINE_API_VERSION });
  }
  return entries;
}

/** A locale dictionary (nested i18n JSON, e.g. the parsed en/common.json). */
export type LocaleDict = Record<string, unknown>;

/** One resolved locale's searchable text for a rule group (index shape). */
export interface LocaleTranslation {
  name: string;
  description: string;
  /** Split from the space-separated keyword string the index indexes as a list. */
  keywords: string[];
}

/**
 * A rule group in the exact shape the sync pipeline indexes
 * (`build_rule_group_item` / `build_search_index_entries`): id + requires +
 * per-locale `{ name, description, keywords[] }`. v2 modules have no `rules`
 * here — logic lives in the chunk; only this metadata reaches the search index.
 */
export interface ModuleRuleGroup {
  id: string;
  requires: string[];
  /** Engine version the chunk was built for, so the client can gate before loading. */
  engineApiVersion: number;
  translations: Record<string, LocaleTranslation>;
}

/** Resolve a dotted i18n key against a nested locale dict, or undefined. */
function resolveKey(dict: LocaleDict | undefined, key: string): unknown {
  if (!dict) return undefined;
  return key.split('.').reduce<unknown>((node, seg) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[seg];
    return undefined;
  }, dict);
}

/**
 * W4 transform: resolve each module's `meta` i18n keys against the given locale
 * dictionaries into the rule-group shape the search-index sync consumes. Keywords
 * (a space-separated i18n string) are split into the list the index expects;
 * `requires` carries through. A locale missing a key falls back to `en` so an
 * entry is never half-populated.
 *
 * Pure: (extractMetadata registry, locales) → entries. The artifact emit + the
 * DynamoDB write via `make sync-rule-groups` are the env/CI half.
 *
 * @param locales Locale name → parsed i18n dict (must include `en` for fallback).
 */
export function buildModuleRuleGroups(locales: Record<string, LocaleDict>): ModuleRuleGroup[] {
  const en = locales['en'];
  return extractMetadata().map((e) => {
    const translations: Record<string, LocaleTranslation> = {};
    for (const [locale, dict] of Object.entries(locales)) {
      const name = resolveKey(dict, e.name) ?? resolveKey(en, e.name);
      if (typeof name !== 'string') continue; // no usable text in this locale
      const description = resolveKey(dict, e.description) ?? resolveKey(en, e.description);
      const kw = resolveKey(dict, e.keywords) ?? resolveKey(en, e.keywords);
      translations[locale] = {
        name,
        description: typeof description === 'string' ? description : '',
        keywords: typeof kw === 'string' ? kw.split(/\s+/).filter(Boolean) : []
      };
    }
    return {
      id: e.ruleGroupId,
      requires: e.requires ?? [],
      engineApiVersion: e.engineApiVersion,
      translations
    };
  });
}

/**
 * Engine version for EVERY lazy-loadable chunk, keyed by canonical ruleGroupId —
 * not just the searchable ones (only those carry `meta`/translations). The
 * loader's skew gate treats an absent version as current, so foundational chunks
 * (`spellcasting`, `hp`, `action-economy`, …) would bypass the gate if they had
 * no published version. This manifest covers them; the client feeds it to
 * `loadModules(ids, builtForVersion)`.
 *
 * Pure: every registered group → ENGINE_API_VERSION (all chunks build from one
 * engine).
 */
export function buildVersionManifest(): Record<string, number> {
  return Object.fromEntries(registeredRuleGroupIds().map((id) => [id, ENGINE_API_VERSION]));
}
