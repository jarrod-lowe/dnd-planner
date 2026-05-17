import type { Rule, EngineOutput, Facts, Verb } from '$lib/rules-engine';
import type { StatEntry } from '$lib/play/extractStats';

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
  /** ID of the currently loaded character, set during loadRuleGroups */
  currentCharacterId: string | null;
  /** Stats declarations extracted from standing rules for display in stats column */
  stats: StatEntry[];
}

/**
 * A uniform step in the intent-stack plan.
 * The verb is a UI grouping tag — which picker group, stripe label, and visual treatment.
 * Everything mechanical dispatches through the resolved rule's ui.model, not by verb.
 */
export interface Step {
  /** Stable unique identifier */
  id: string;
  /** UI grouping tag — determines picker group, stripe label, visual treatment */
  verb: Verb;
  /** References a rule (from standing, offered, or core-events) */
  ruleId: string;
  /** User input payload — shape determined by the resolved rule's ui.model */
  modelSelections: Record<string, unknown>;
  /** Attached modifier rule IDs (e.g., Cleave, Divine Smite on an ATTACK) */
  riderIds?: string[];
  /** ISO8601 timestamp */
  recordedAt: string;
}
