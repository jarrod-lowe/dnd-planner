import type { RuleGroupMeta } from '$lib/rules/ruleGroupCache.svelte';

/**
 * Resolve all transitive dependencies for a rule group.
 * Returns ordered list of deps to add (deepest first).
 * Skips already-assigned deps and handles cycles.
 */
export function resolveDependencies(
  ruleGroupId: string,
  cache: Map<string, RuleGroupMeta>,
  assignedIds: string[]
): string[] {
  // Treat the target as "will be assigned" so cycles don't include it
  const assigned = new Set([...assignedIds, ruleGroupId]);
  const result: string[] = [];
  const visited = new Set<string>();

  function walk(id: string): void {
    if (visited.has(id)) return;
    visited.add(id);

    const meta = cache.get(id);
    if (!meta) return;

    for (const depId of meta.requires) {
      if (assigned.has(depId)) continue;
      walk(depId);
      // Only add if not already in result (diamond dedup)
      if (!result.includes(depId)) {
        result.push(depId);
      }
    }
  }

  walk(ruleGroupId);
  return result;
}
