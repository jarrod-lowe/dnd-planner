import { apiGet, apiPost, apiDelete } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import type { Rule } from '$lib/rules-engine';
import type { PlannedItem, PlayState } from './types';
import { debounce } from './debounce';
import { resolveInitialSelections } from './resolveInitialSelections';
import { locale } from '$lib/i18n';
import { get } from 'svelte/store';
import { getCache } from '$lib/rules/ruleGroupCache.svelte';
import { resolveDependencies } from '$lib/rules/resolveDependencies';

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
  facts: {}
};

// Reactive state
let state = $state<PlayState>({ ...initialState });

function generateInstanceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function performEvaluation(): void {
  state = { ...state, isEvaluating: true };

  const input = {
    schemaVersion: 1 as const,
    rules: {
      standing: state.ruleGroups,
      planned: state.plannedItems.map((item) => item.rule),
      effects: []
    },
    state: {
      facts: state.facts
    }
  };

  const output = evaluate(input);

  state = {
    ...state,
    engineOutput: output,
    isEvaluating: false,
    facts: output.facts
  };
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
        (rg: { ruleGroupId: string; rules: string }) => {
          const rules: Rule[] = JSON.parse(rg.rules);
          allGroupsMap[rg.ruleGroupId] = rules;
          return rules;
        }
      );
      allRules.push(...batchRules);
    }

    state = {
      ...state,
      ruleGroups: allRules,
      ruleGroupIds: groupIds,
      ruleGroupRulesMap: allGroupsMap,
      isLoadingRuleGroups: false
    };

    // Initial evaluation
    performEvaluation();
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
      // Only set selections if there are any to set
      ...(Object.keys(initialSelections).length > 0 && { selections: initialSelections })
    },
    order: state.plannedItems.length
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
      selections
    }
  };

  state = {
    ...state,
    plannedItems: updatedItems
  };

  debouncedEvaluate();
}

async function assignRuleGroup(characterId: string, ruleGroupId: string): Promise<void> {
  // Resolve transitive dependencies
  const cache = getCache();
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

    const { ruleGroups: batchGroups } = await batchResponse.json();
    const newRules: Rule[] = batchGroups.flatMap((rg: { rules: string }) => JSON.parse(rg.rules));

    state = {
      ...state,
      ruleGroups: [...state.ruleGroups, ...newRules],
      ruleGroupRulesMap: {
        ...state.ruleGroupRulesMap,
        [ruleGroupId]: newRules
      }
    };

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
  const rulesToRemove = state.ruleGroupRulesMap[ruleGroupId] ?? [];
  const ruleIdsToRemove = new Set(rulesToRemove.map((r) => r.id));

  // Optimistic: remove ID, rules, and map entry
  state = {
    ...state,
    ruleGroupIds: state.ruleGroupIds.filter((id) => id !== ruleGroupId),
    ruleGroups: state.ruleGroups.filter((r) => !ruleIdsToRemove.has(r.id)),
    ruleGroupRulesMap: Object.fromEntries(
      Object.entries(state.ruleGroupRulesMap).filter(([id]) => id !== ruleGroupId)
    )
  };

  // Re-evaluate immediately for responsive UI
  performEvaluation();

  try {
    const response = await apiDelete(`/api/characters/${characterId}/rule-groups/${ruleGroupId}`);

    if (!response.ok && response.status !== 204) {
      throw new Error(`Unassign failed: ${response.status}`);
    }
  } catch (error) {
    console.error('[unassignRuleGroup] Error:', error);
    // Revert
    state = {
      ...state,
      ruleGroupIds: prevIds,
      ruleGroups: prevRules,
      ruleGroupRulesMap: prevMap
    };
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

function reset(): void {
  state = { ...initialState };
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
  reset
};
