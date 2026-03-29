import type { Rule, EngineOutput, Facts } from '$lib/rules-engine';

/**
 * Represents a single item in the user's plan.
 * Each instance has a unique ID to allow duplicates of the same rule.
 */
export interface PlannedItem {
  /** Unique identifier for this specific instance */
  instanceId: string;
  /** The rule being planned */
  rule: Rule;
  /** Position in the plan (0-indexed) */
  order: number;
}

/**
 * State for play mode, managing rules engine and plan.
 */
export interface PlayState {
  /** Standing rules loaded from API */
  ruleGroups: Rule[];
  /** Rule group IDs assigned to the character */
  ruleGroupIds: string[];
  /** Rules organized by rule group ID for selective removal */
  ruleGroupRulesMap: Record<string, Rule[]>;
  /** Loading state for rule groups */
  isLoadingRuleGroups: boolean;
  /** Error message if rule group loading failed */
  ruleGroupError: string | null;
  /** Output from the rules engine */
  engineOutput: EngineOutput | null;
  /** Whether the engine is currently evaluating */
  isEvaluating: boolean;
  /** Items the user has added to their plan */
  plannedItems: PlannedItem[];
  /** Current facts from engine evaluation */
  facts: Facts;
  /** Committed effects from previous turns. Passed to engine as rules.effects. */
  effects: Rule[];
}
