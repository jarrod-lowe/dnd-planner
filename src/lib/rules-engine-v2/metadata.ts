import type { RuleMeta } from './types';
import { registeredRuleGroupIds, getModule } from './registry';

/**
 * One search-index entry for a rule group: its rule-group id plus the module's
 * discovery `meta`. `name`/`description`/`keywords` are still i18n keys here;
 * resolving them to indexed terms (and writing to DynamoDB) is W4's publish step,
 * which needs the env. This extraction is the pure, testable half.
 */
export interface MetadataEntry extends RuleMeta {
  ruleGroupId: string;
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
    if (meta) entries.push({ ruleGroupId, ...meta });
  }
  return entries;
}
