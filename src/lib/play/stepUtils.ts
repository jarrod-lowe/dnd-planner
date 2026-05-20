import type { Rule, Verb } from '$lib/rules-engine';

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
