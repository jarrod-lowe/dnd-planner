import { apiGet, apiPost, apiDelete } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import type { Rule, AvailableRuleEntry } from '$lib/rules-engine';
import type { PlannedItem, PlayState } from './types';
import { debounce } from './debounce';
import { resolveInitialSelections } from './resolveInitialSelections';
import { extractStats } from './extractStats';
import { decrementCountDowns } from './countDown';
import { deriveVerbFromRule } from './stepUtils';
import { locale, t } from '$lib/i18n';
import { get } from 'svelte/store';
import { getCache, ensureCached } from '$lib/rules/ruleGroupCache.svelte';
import { resolveDependencies } from '$lib/rules/resolveDependencies';
import { toast } from 'svelte-sonner';
import type { SettingDefinition } from '$lib/rules/settingsTypes';
import { resolveSettings } from '$lib/rules/resolveSettings';
import { evaluateRuleGroupConditions } from '$lib/rules/evaluateCondition';

const DEBOUNCE_MS = 300;
const BATCH_SIZE = 100;

const initialState: PlayState = {
  ruleGroups: [],
  ruleGroupIds: [],
  ruleGroupRulesMap: {},
  isLoadingRuleGroups: false,
  ruleGroupError: null,
  engineOutput: null,
  isEvaluating: false,
  plannedItems: [],
  facts: {},
  effects: [],
  currentCharacterId: null,
  stats: []
};

// Reactive state
let state = $state<PlayState>({ ...initialState });

function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function recalculateStats(): void {
  state = { ...state, stats: extractStats(state.ruleGroups) };
}

// Module-level, plain Map (not $state). Replaced entirely each performEvaluation().
let _hypotheticalEntriesMap = new Map<string, AvailableRuleEntry[]>();

function performEvaluation(): void {
  state = { ...state, isEvaluating: true };

  const input = {
    schemaVersion: 1 as const,
    rules: {
      standing: state.ruleGroups,
      planned: state.plannedItems.map((item) => item.rule),
      effects: state.effects
    },
    state: {
      facts: {}
    }
  };

  const output = evaluate(input);

  // Pre-compute hypothetical evaluations for each planned item.
  // Creates a brand-new Map each time — old map is GC'd, no stale entries.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive; replaced each evaluation
  const newMap = new Map<string, AvailableRuleEntry[]>();
  for (const item of state.plannedItems) {
    const filteredPlanned = state.plannedItems
      .filter((i) => i.instanceId !== item.instanceId)
      .map((i) => {
        const clone = JSON.parse(JSON.stringify(i.rule)) as Rule;
        delete clone.varsRuntime;
        return clone;
      });
    const hypInput = {
      schemaVersion: 1 as const,
      rules: { standing: state.ruleGroups, planned: filteredPlanned, effects: state.effects },
      state: { facts: {} }
    };
    newMap.set(item.instanceId, evaluate(hypInput).availableRules);
  }
  _hypotheticalEntriesMap = newMap;

  state = {
    ...state,
    engineOutput: output,
    isEvaluating: false,
    facts: output.facts
  };
}

function getAlternativeEntries(instanceId: string): AvailableRuleEntry[] {
  return _hypotheticalEntriesMap.get(instanceId) ?? [];
}

// Debounced evaluation for plan changes
const debouncedEvaluate = debounce(() => {
  performEvaluation();
}, DEBOUNCE_MS);

async function loadRuleGroups(characterId: string): Promise<void> {
  state = { ...state, isLoadingRuleGroups: true, ruleGroupError: null };

  try {
    // Get current locale for translations
    const currentLocale = get(locale);

    // Step 1: Get rule group IDs
    const idsResponse = await apiGet(`/api/characters/${characterId}/rule-groups`);

    if (!idsResponse.ok) {
      throw new Error(`Failed to fetch rule groups: ${idsResponse.status}`);
    }

    const { ruleGroups: groupIds } = await idsResponse.json();

    // Step 2: Batch fetch rule groups (max 100 per request)
    const allRules: Rule[] = [];
    const allGroupsMap: Record<string, Rule[]> = {};

    for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
      const batch = groupIds.slice(i, i + BATCH_SIZE);
      const batchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, {
        ids: batch
      });

      if (!batchResponse.ok) {
        throw new Error(`Failed to fetch rule group batch: ${batchResponse.status}`);
      }

      const { ruleGroups: batchGroups } = await batchResponse.json();
      const batchRules: Rule[] = batchGroups.flatMap(
        (rg: { ruleGroupId: string; rules: string; requires?: string[] }) => {
          const rules: Rule[] = JSON.parse(rg.rules);
          allGroupsMap[rg.ruleGroupId] = rules;
          return rules;
        }
      );
      allRules.push(...batchRules);
      const batchCache = getCache();
      for (const rg of batchGroups) {
        if (rg.ruleGroupId && !batchCache.has(rg.ruleGroupId)) {
          batchCache.set(rg.ruleGroupId, {
            name: rg.name ?? '',
            description: rg.description ?? '',
            requires: rg.requires ?? [],
            settings:
              typeof rg.settings === 'string' && rg.settings
                ? JSON.parse(rg.settings)
                : Array.isArray(rg.settings)
                  ? rg.settings
                  : [],
            condition:
              typeof rg.condition === 'string' && rg.condition
                ? JSON.parse(rg.condition)
                : Array.isArray(rg.condition)
                  ? rg.condition
                  : undefined
          });
        }
      }
    }

    // Self-heal missing requires dependencies
    const cache = getCache();
    for (const gid of groupIds) {
      await prefetchDepTree(gid, groupIds);
    }
    const missingDeps: string[] = [];
    const accumulated: string[] = [...groupIds];
    for (const gid of groupIds) {
      const deps = resolveDependencies(gid, cache, [...accumulated]);
      for (const dep of deps) {
        if (!accumulated.includes(dep)) {
          missingDeps.push(dep);
          accumulated.push(dep);
        }
      }
    }
    for (const depId of missingDeps) {
      try {
        const resp = await apiPost(`/api/characters/${characterId}/rule-groups`, {
          ruleGroupId: depId
        });
        if (resp.ok) {
          groupIds.push(depId);
          const depBatchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, {
            ids: [depId]
          });
          if (depBatchResponse.ok) {
            const { ruleGroups: depGroups } = await depBatchResponse.json();
            const depRules: Rule[] = depGroups.flatMap(
              (rg: { ruleGroupId: string; rules: string }) => {
                const rules: Rule[] = JSON.parse(rg.rules);
                allGroupsMap[rg.ruleGroupId] = rules;
                return rules;
              }
            );
            allRules.push(...depRules);
          }
        }
      } catch {
        // best-effort: skip failed dep assignments
      }
    }

    state = {
      ...state,
      ruleGroups: allRules,
      ruleGroupIds: groupIds,
      ruleGroupRulesMap: allGroupsMap,
      isLoadingRuleGroups: false,
      currentCharacterId: characterId
    };

    // Load persisted effects (graceful fallback on failure)
    try {
      const effectsResponse = await apiGet(`/api/characters/${characterId}/effects`);
      if (effectsResponse?.ok) {
        const { effects: effectsJson } = await effectsResponse.json();
        if (effectsJson) {
          state = { ...state, effects: JSON.parse(effectsJson) as Rule[] };
        }
      } else {
        toast.error(get(t)('play.error.loadEffects'));
      }
    } catch {
      toast.error(get(t)('play.error.loadEffects'));
    }

    // Initial evaluation
    performEvaluation();

    // Extract stats declarations from all standing rules
    recalculateStats();
  } catch (error) {
    console.error('[loadRuleGroups] Error:', error);
    state = {
      ...state,
      isLoadingRuleGroups: false,
      ruleGroupError: error instanceof Error ? error.message : 'Failed to load rule groups'
    };
  }
}

function addToPlan(rule: Rule): void {
  const instanceId = generateInstanceId();
  // Resolve capture vars from current facts
  const initialSelections = resolveInitialSelections(rule, state.facts);

  const newItem: PlannedItem = {
    instanceId,
    rule: {
      ...rule,
      id: instanceId, // Unique ID so engine processes each instance separately
      selections: { ...(rule.selections ?? {}), ...initialSelections }
    },
    order: state.plannedItems.length,
    originalRuleId: rule.id,
    verb: deriveVerbFromRule(rule)
  };

  state = {
    ...state,
    plannedItems: [...state.plannedItems, newItem]
  };

  debouncedEvaluate();
}

function removeFromPlan(instanceId: string): void {
  const filtered = state.plannedItems.filter((item) => item.instanceId !== instanceId);

  // Re-index order values
  const reindexed = filtered.map((item, index) => ({
    ...item,
    order: index
  }));

  state = {
    ...state,
    plannedItems: reindexed
  };

  debouncedEvaluate();
}

function movePlanItem(instanceId: string, direction: 'up' | 'down'): void {
  const items = [...state.plannedItems];
  const currentIndex = items.findIndex((item) => item.instanceId === instanceId);

  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= items.length) return;

  // Swap
  [items[currentIndex], items[targetIndex]] = [items[targetIndex], items[currentIndex]];

  // Re-index
  const reindexed = items.map((item, index) => ({
    ...item,
    order: index
  }));

  state = {
    ...state,
    plannedItems: reindexed
  };

  debouncedEvaluate();
}

function updateSelections(instanceId: string, selections: Record<string, unknown>): void {
  const itemIndex = state.plannedItems.findIndex((item) => item.instanceId === instanceId);

  if (itemIndex === -1) return;

  const updatedItems = [...state.plannedItems];
  updatedItems[itemIndex] = {
    ...updatedItems[itemIndex],
    rule: {
      ...updatedItems[itemIndex].rule,
      selections: { ...updatedItems[itemIndex].rule.selections, ...selections }
    }
  };

  state = {
    ...state,
    plannedItems: updatedItems
  };

  debouncedEvaluate();
}

function swapPlanItemRule(instanceId: string, entry: AvailableRuleEntry): void {
  const index = state.plannedItems.findIndex((i) => i.instanceId === instanceId);
  if (index === -1) return;

  const initialSelections = resolveInitialSelections(entry.rule, state.facts);
  const updated = [...state.plannedItems];
  updated[index] = {
    ...updated[index],
    verb: deriveVerbFromRule(entry.rule),
    rule: {
      ...entry.rule,
      id: instanceId,
      selections: { ...(entry.rule.selections ?? {}), ...initialSelections }
    },
    originalRuleId: entry.rule.id
  };

  state = {
    ...state,
    plannedItems: updated
  };

  debouncedEvaluate();
}

/**
 * Recursively fetch metadata for all transitive dependencies.
 * resolveDependencies can only walk cached entries, so we must ensure
 * all intermediate deps are in the cache before calling it.
 */
async function prefetchDepTree(ruleGroupId: string, assignedIds: string[]): Promise<void> {
  const cache = getCache();
  const assigned = [...assignedIds, ruleGroupId];
  const visited: string[] = [];
  const toFetch: string[] = [];

  // First pass: collect all dep IDs reachable from the target
  function collect(id: string): void {
    if (visited.includes(id)) return;
    visited.push(id);
    const meta = cache.get(id);
    if (!meta) {
      // Not in cache — queue for fetch
      if (!assignedIds.includes(id)) {
        toFetch.push(id);
      }
      return;
    }
    for (const depId of meta.requires) {
      if (!assigned.includes(depId)) {
        collect(depId);
      }
    }
  }

  collect(ruleGroupId);

  // Iteratively fetch missing metadata and discover further deps
  const currentLocale = get(locale);
  while (toFetch.length > 0) {
    const batch = [...toFetch];
    toFetch.length = 0;
    try {
      await ensureCached(batch, currentLocale);
    } catch (e) {
      console.error('[prefetchDepTree] ensureCached failed:', e);
      break;
    }
    for (const id of batch) {
      const meta = cache.get(id);
      if (meta) {
        for (const depId of meta.requires) {
          if (!assigned.includes(depId) && !visited.includes(depId)) {
            toFetch.push(depId);
          }
        }
      }
    }
  }
}

async function assignRuleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  // Validate conditions
  const cache = getCache();
  const meta = cache.get(ruleGroupId);
  if (meta?.condition && !evaluateRuleGroupConditions(meta.condition, state.facts)) {
    throw new Error(`Prerequisites not met for ${ruleGroupId}`);
  }

  // Pre-fetch metadata for the full transitive dependency tree
  // resolveDependencies can only walk cached entries, so we must ensure
  // all intermediate deps are in the cache before resolving.
  await prefetchDepTree(ruleGroupId, state.ruleGroupIds);

  // Resolve transitive dependencies
  const deps = resolveDependencies(ruleGroupId, cache, state.ruleGroupIds);

  // Assign dependencies first (deepest-first order)
  const assignedDeps: string[] = [];
  for (const depId of deps) {
    try {
      await assignSingleGroup(characterId, depId);
      assignedDeps.push(depId);
    } catch (error) {
      // Roll back any deps already assigned on API
      await rollbackDeps(characterId, assignedDeps);
      throw error;
    }
  }

  // Assign the target group
  try {
    await assignSingleGroup(characterId, ruleGroupId);
  } catch (error) {
    // Roll back all deps on API
    await rollbackDeps(characterId, assignedDeps);
    throw error;
  }
}

async function updateCustomRules(characterId: string, newRules: Rule[]): Promise<void> {
  const customGroupId = `custom-${characterId}`;
  const prevRules = [...state.ruleGroups];
  const prevMap = { ...state.ruleGroupRulesMap };
  const oldCustomRules = state.ruleGroupRulesMap[customGroupId] ?? [];
  const oldRuleIds = new Set(oldCustomRules.map((r) => r.id));

  // Optimistic: replace custom rules in state
  state = {
    ...state,
    ruleGroups: [...state.ruleGroups.filter((r) => !oldRuleIds.has(r.id)), ...newRules],
    ruleGroupRulesMap: {
      ...state.ruleGroupRulesMap,
      [customGroupId]: newRules
    }
  };

  recalculateStats();
  performEvaluation();

  try {
    const response = await apiPost(`/api/rule-groups/${customGroupId}`, {
      rules: newRules
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
  } catch (error) {
    // Rollback
    state = { ...state, ruleGroups: prevRules, ruleGroupRulesMap: prevMap };
    recalculateStats();
    performEvaluation();
    throw error;
  }
}

async function rollbackDeps(characterId: string, depIds: string[]): Promise<void> {
  for (const depId of [...depIds].reverse()) {
    const rulesToRemove = state.ruleGroupRulesMap[depId] ?? [];
    const ruleIdsToRemove = new Set(rulesToRemove.map((r) => r.id));

    // Remove from local state
    state = {
      ...state,
      ruleGroupIds: state.ruleGroupIds.filter((id) => id !== depId),
      ruleGroups: state.ruleGroups.filter((r) => !ruleIdsToRemove.has(r.id)),
      ruleGroupRulesMap: Object.fromEntries(
        Object.entries(state.ruleGroupRulesMap).filter(([id]) => id !== depId)
      )
    };

    // Remove from API
    try {
      await apiDelete(`/api/characters/${characterId}/rule-groups/${depId}`);
    } catch {
      // Best-effort API cleanup
    }
  }
}

async function assignSingleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  if (state.ruleGroupIds.includes(ruleGroupId)) return;

  // Snapshot for revert
  const prevIds = [...state.ruleGroupIds];

  // Optimistic: add ID
  state = {
    ...state,
    ruleGroupIds: [...state.ruleGroupIds, ruleGroupId]
  };

  try {
    const response = await apiPost(`/api/characters/${characterId}/rule-groups`, {
      ruleGroupId
    });

    if (!response.ok) {
      throw new Error(`Assign failed: ${response.status}`);
    }

    // Fetch rules for the newly assigned group
    const currentLocale = get(locale);
    const batchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, {
      ids: [ruleGroupId]
    });

    if (!batchResponse.ok) {
      throw new Error(`Fetch rules failed: ${batchResponse.status}`);
    }

    let batchGroups: {
      ruleGroupId: string;
      rules: string;
      name?: string;
      description?: string;
      requires?: string[];
      settings?: string | unknown[];
    }[] = [];
    try {
      const data = await batchResponse.json();
      batchGroups = data.ruleGroups ?? [];
    } catch {
      // Empty body - group assigned but rules unavailable
    }
    // Also cache metadata from batch response so resolveDependencies can use it
    const cache = getCache();
    for (const rg of batchGroups) {
      if (rg.ruleGroupId && !cache.has(rg.ruleGroupId)) {
        cache.set(rg.ruleGroupId, {
          name: rg.name ?? '',
          description: rg.description ?? '',
          requires: rg.requires ?? [],
          settings:
            typeof rg.settings === 'string' && rg.settings
              ? JSON.parse(rg.settings)
              : Array.isArray(rg.settings)
                ? rg.settings
                : []
        });
      }
    }
    const fetchedRules: Rule[] = batchGroups.flatMap((rg) => {
      const rulesStr = typeof rg.rules === 'string' ? rg.rules : '[]';
      return JSON.parse(rulesStr);
    });
    const newRules: Rule[] = fetchedRules.map((rule) => {
      const initialSelections = resolveInitialSelections(rule, state.facts);
      if (Object.keys(initialSelections).length === 0) {
        return rule;
      }
      return {
        ...rule,
        selections: { ...initialSelections, ...rule.selections }
      };
    });

    state = {
      ...state,
      ruleGroups: [...state.ruleGroups, ...newRules],
      ruleGroupRulesMap: {
        ...state.ruleGroupRulesMap,
        [ruleGroupId]: newRules
      }
    };

    recalculateStats();
    debouncedEvaluate();
  } catch (error) {
    console.error('[assignRuleGroup] Error:', error);
    // Revert
    state = {
      ...state,
      ruleGroupIds: prevIds
    };
    throw error;
  }
}

async function unassignRuleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  // Snapshot for revert
  const prevIds = [...state.ruleGroupIds];
  const prevRules = [...state.ruleGroups];
  const prevMap = { ...state.ruleGroupRulesMap };
  const prevEffects = [...state.effects];
  const rulesToRemove = state.ruleGroupRulesMap[ruleGroupId] ?? [];
  const ruleIdsToRemove = new Set(rulesToRemove.map((r) => r.id));

  // Optimistic: remove ID, rules, map entry, and settings effects
  state = {
    ...state,
    ruleGroupIds: state.ruleGroupIds.filter((id) => id !== ruleGroupId),
    ruleGroups: state.ruleGroups.filter((r) => !ruleIdsToRemove.has(r.id)),
    ruleGroupRulesMap: Object.fromEntries(
      Object.entries(state.ruleGroupRulesMap).filter(([id]) => id !== ruleGroupId)
    ),
    effects: state.effects.filter((e) => !e.id.startsWith(`${ruleGroupId}::`))
  };

  // Re-evaluate immediately for responsive UI
  recalculateStats();
  performEvaluation();

  try {
    const response = await apiDelete(`/api/characters/${characterId}/rule-groups/${ruleGroupId}`);

    if (!response.ok && response.status !== 204) {
      throw new Error(`Unassign failed: ${response.status}`);
    }

    // Persist updated effects (settings-derived effects removed above)
    if (state.currentCharacterId) {
      apiPost(`/api/characters/${state.currentCharacterId}/effects`, {
        effects: JSON.stringify(state.effects)
      })
        .then((res) => {
          if (!res.ok) {
            toast.error(get(t)('play.error.saveEffects'));
          }
        })
        .catch(() => {
          toast.error(get(t)('play.error.saveEffects'));
        });
    }
  } catch (error) {
    console.error('[unassignRuleGroup] Error:', error);
    // Revert
    state = {
      ...state,
      ruleGroupIds: prevIds,
      ruleGroups: prevRules,
      ruleGroupRulesMap: prevMap,
      effects: prevEffects
    };
    recalculateStats();
    performEvaluation();
    throw error;
  }
}

function isLocked(ruleGroupId: string): boolean {
  return getDependents(ruleGroupId).length > 0;
}

function getDependents(ruleGroupId: string): string[] {
  const cache = getCache();
  const assigned = new Set(state.ruleGroupIds);
  const dependents: string[] = [];

  for (const assignedId of assigned) {
    const meta = cache.get(assignedId);
    if (meta?.requires?.includes(ruleGroupId)) {
      dependents.push(assignedId);
    }
  }

  return dependents;
}

function removeEffect(ruleId: string): void {
  const updated = state.effects.filter((rule) => rule.id !== ruleId);
  state = { ...state, effects: updated };
  performEvaluation();

  if (state.currentCharacterId) {
    apiPost(`/api/characters/${state.currentCharacterId}/effects`, {
      effects: JSON.stringify(updated)
    })
      .then((response) => {
        if (!response.ok) {
          toast.error(get(t)('play.error.saveEffects'));
        }
      })
      .catch(() => {
        toast.error(get(t)('play.error.saveEffects'));
      });
  }
}

function endTurn(): void {
  // Commit effects from the last evaluation output before clearing the plan.
  // This moves advertised effects into the committed effects array so they
  // persist across turns.
  const preDecrement = state.engineOutput?.effects ?? state.effects;
  const effects = decrementCountDowns(preDecrement);
  const characterId = state.currentCharacterId;

  state = {
    ...state,
    plannedItems: [],
    effects
  };
  performEvaluation();

  // Fire-and-forget save to backend
  if (characterId) {
    apiPost(`/api/characters/${characterId}/effects`, {
      effects: JSON.stringify(effects)
    })
      .then((response) => {
        if (!response.ok) {
          toast.error(get(t)('play.error.saveEffects'));
        }
      })
      .catch(() => {
        toast.error(get(t)('play.error.saveEffects'));
      });
  }
}

function addFollowupEffect(rule: Rule): void {
  // JSON round-trip strips Svelte reactive proxies that structuredClone can't handle
  const plainRule = JSON.parse(JSON.stringify(rule));
  state = {
    ...state,
    effects: [...state.effects, plainRule]
  };
  performEvaluation();
}

function reset(): void {
  _hypotheticalEntriesMap = new Map();
  state = { ...initialState };
}

interface SettingsGroup {
  ruleGroupId: string;
  name: string;
  settings: SettingDefinition[];
}

async function getSettingsForRuleGroup(ruleGroupId: string): Promise<SettingsGroup[] | null> {
  await prefetchDepTree(ruleGroupId, state.ruleGroupIds);
  const cache = getCache();
  const deps = resolveDependencies(ruleGroupId, cache, state.ruleGroupIds);
  const allIds = [...deps, ruleGroupId];
  const groups: SettingsGroup[] = [];

  for (const id of allIds) {
    const meta = cache.get(id);
    if (meta && meta.settings.length > 0) {
      groups.push({
        ruleGroupId: id,
        name: meta.name,
        settings: meta.settings
      });
    }
  }

  return groups.length > 0 ? groups : null;
}

async function assignRuleGroupWithSettings(
  characterId: string,
  ruleGroupId: string,
  settingsValues: Map<string, Record<string, string>>
): Promise<void> {
  await assignRuleGroup(characterId, ruleGroupId);

  const cache = getCache();

  const groups = Array.from(settingsValues.entries()).map(([groupId, values]) => {
    const meta = cache.get(groupId);
    return { ruleGroupId: groupId, settings: meta?.settings ?? [], values };
  });

  const { additionalRuleGroupIds, effects } = resolveSettings(groups, (id) => {
    const meta = cache.get(id);
    return meta ? { requires: meta.requires } : undefined;
  });

  for (const additionalId of additionalRuleGroupIds) {
    if (!state.ruleGroupIds.includes(additionalId)) {
      await assignRuleGroup(characterId, additionalId);
    }
  }

  if (effects.length > 0) {
    state = { ...state, effects: [...state.effects, ...effects] };
    performEvaluation();

    apiPost(`/api/characters/${characterId}/effects`, {
      effects: JSON.stringify(state.effects)
    })
      .then((response) => {
        if (!response.ok) {
          toast.error(get(t)('play.error.saveEffects'));
        }
      })
      .catch(() => {
        toast.error(get(t)('play.error.saveEffects'));
      });
  }
}

function checkCondition(ruleGroupId: string): boolean {
  const cache = getCache();
  const meta = cache.get(ruleGroupId);
  if (!meta?.condition) return true;
  return evaluateRuleGroupConditions(meta.condition, state.facts);
}

export const playStore = {
  get state() {
    return state;
  },
  loadRuleGroups,
  assignRuleGroup,
  unassignRuleGroup,
  isLocked,
  getDependents,
  addToPlan,
  removeFromPlan,
  movePlanItem,
  updateSelections,
  swapPlanItemRule,
  getAlternativeEntries,
  updateCustomRules,
  removeEffect,
  addFollowupEffect,
  getSettingsForRuleGroup,
  checkCondition,
  assignRuleGroupWithSettings,
  endTurn,
  reset
};
