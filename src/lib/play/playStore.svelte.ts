import { apiGet, apiPost } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import type { Rule } from '$lib/rules-engine';
import type { PlannedItem, PlayState } from './types';
import { debounce } from './debounce';
import { resolveInitialSelections } from './resolveInitialSelections';
import { locale } from '$lib/i18n';
import { get } from 'svelte/store';

const DEBOUNCE_MS = 300;
const BATCH_SIZE = 100;

const initialState: PlayState = {
  ruleGroups: [],
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

    for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
      const batch = groupIds.slice(i, i + BATCH_SIZE);
      const batchResponse = await apiPost(`/api/rule-groups/batch?lang=${currentLocale}`, { ids: batch });

      if (!batchResponse.ok) {
        throw new Error(`Failed to fetch rule group batch: ${batchResponse.status}`);
      }

      const { ruleGroups: batchGroups } = await batchResponse.json();
      const batchRules: Rule[] = batchGroups.flatMap((rg: { rules: string }) =>
        JSON.parse(rg.rules)
      );
      allRules.push(...batchRules);
    }

    state = {
      ...state,
      ruleGroups: allRules,
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

function reset(): void {
  state = { ...initialState };
}

export const playStore = {
  get state() {
    return state;
  },
  loadRuleGroups,
  addToPlan,
  removeFromPlan,
  movePlanItem,
  updateSelections,
  reset
};
