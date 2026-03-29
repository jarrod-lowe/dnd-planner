import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

/**
 * Adapts effect rules into AvailableRuleEntry format so they can be grouped
 * by the same section/packing logic used for choices.
 */
export function adaptEffectsAsEntries(effects: Rule[]): AvailableRuleEntry[] {
  return effects.map((rule) => ({
    rule,
    legal: true,
    applicable: true,
    diagnostics: []
  }));
}
