import { defineRule, MAX_HANDS, type RuleModule } from '../builder';

/**
 * Hands — the equip budget. `remaining = max - spent`, where `max` is
 * {@link MAX_HANDS} (shared with the loadout enumerator, so the picker can never
 * offer a configuration this rule would then reject) and `spent` is an AGGREGATE
 * summed from every effect that ties a hand up: the loadout, and Grapple while a
 * target is held. Anything gating on the budget must read `hands.remaining` (or
 * subtract its own share of `hands.spent`), never `hands.max` alone.
 *
 * Foundational (every character has hands) and so carries no search `meta`; previously
 * this is the hands-max set + hands-reset copy.
 */
const hands: RuleModule = {
  id: 'hands',
  derive: () => [
    { fact: 'hands.max', value: () => MAX_HANDS },
    { fact: 'hands.remaining', value: (f) => f.num('hands.max') - f.num('hands.spent') }
  ]
};

export default defineRule(hands);
