/**
 * Rule group metadata cache.
 * Stores name + description keyed by rule group ID to avoid redundant batch API calls.
 */

import { apiPost } from '$lib/api/client';
import { SvelteMap } from 'svelte/reactivity';

export interface RuleGroupMeta {
  name: string;
  description: string;
  requires: string[];
}

let cache = new SvelteMap<string, RuleGroupMeta>();

export function clearCache(): void {
  cache = new SvelteMap();
}

export function seedCache(entries: Record<string, RuleGroupMeta>): void {
  for (const [id, meta] of Object.entries(entries)) {
    cache.set(id, meta);
  }
}

export function getCache(): Map<string, RuleGroupMeta> {
  return cache;
}

export async function ensureCached(
  ids: string[],
  locale: string
): Promise<Map<string, RuleGroupMeta>> {
  const result = new SvelteMap<string, RuleGroupMeta>();

  const uncachedIds: string[] = [];
  for (const id of ids) {
    const cached = cache.get(id);
    if (cached) {
      result.set(id, cached);
    } else {
      uncachedIds.push(id);
    }
  }

  if (uncachedIds.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
      const batch = uncachedIds.slice(i, i + BATCH_SIZE);
      const response = await apiPost(`/api/rule-groups/batch?lang=${locale}`, {
        ids: batch
      });

      if (response.ok) {
        const data = await response.json();
        for (const rg of data.ruleGroups) {
          const meta: RuleGroupMeta = {
            name: rg.name,
            description: rg.description,
            requires: rg.requires ?? []
          };
          cache.set(rg.ruleGroupId, meta);
          result.set(rg.ruleGroupId, meta);
        }
      }
    }
  }

  return result;
}
