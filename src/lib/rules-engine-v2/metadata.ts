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
