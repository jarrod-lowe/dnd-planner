import type { Rule, Verb } from '$lib/rules-engine';
import type { PlannedItem, Step } from './types';

/**
 * Derives the primary verb from a rule's ui.intents.
 * Returns the first intent key, or falls back to a section-based heuristic.
 */
export function deriveVerbFromRule(rule: Rule): Verb {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (ui?.intents && typeof ui.intents === 'object') {
    const keys = Object.keys(ui.intents as Record<string, unknown>);
    if (keys.length > 0) {
      return keys[0] as Verb;
    }
  }
  return deriveVerbFromSection(rule);
}

function deriveVerbFromSection(rule: Rule): Verb {
  const ui = rule.ui as Record<string, unknown> | undefined;
  const section = ui?.section as string | undefined;
  switch (section) {
    case 'action-attack':
    case 'bonus-action-spell':
      return 'ATTACK';
    case 'action-spell':
    case 'action-other':
      return 'ATTACK';
    case 'bonus-action-other':
      return 'AID';
    case 'reaction':
      return 'DEFEND';
    case 'move':
      return 'MOVE';
    case 'free':
      return 'INSPECT';
    case 'configuration':
      return 'HANDLE';
    case 'rest':
      return 'REST';
    case 'senses':
      return 'INSPECT';
    default:
      return 'HANDLE';
  }
}

/**
 * Converts a PlannedItem to a Step.
 * Used for migrating legacy plan data to the new Step format.
 */
export function plannedItemToStep(item: PlannedItem): Step {
  return {
    id: item.instanceId,
    verb: deriveVerbFromRule(item.rule),
    ruleId: item.rule.id,
    modelSelections: { ...(item.rule.selections ?? {}) },
    recordedAt: new Date().toISOString()
  };
}

/**
 * Resolves a Step to a Rule by looking up the ruleId in the provided map,
 * then applying the step's modelSelections as the rule's selections.
 */
export function stepToRule(step: Step, lookup: Map<string, Rule>): Rule | null {
  const rule = lookup.get(step.ruleId);
  if (!rule) return null;
  return {
    ...rule,
    selections: { ...rule.selections, ...step.modelSelections }
  };
}

/**
 * Converts an array of Steps to Rules for engine evaluation.
 * Returns the rules in order, skipping any steps whose ruleId cannot be resolved.
 */
export function stepsToRules(steps: Step[], lookup: Map<string, Rule>): Rule[] {
  const rules: Rule[] = [];
  for (const step of steps) {
    const rule = stepToRule(step, lookup);
    if (rule) {
      rules.push(rule);
    }
  }
  return rules;
}
