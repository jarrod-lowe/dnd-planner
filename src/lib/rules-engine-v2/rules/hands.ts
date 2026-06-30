import { defineRule, type RuleModule } from '../builder';

/**
 * Hands — the equip budget. A character has 2 hands; `remaining = max - spent`,
 * where `spent` is summed from the per-weapon equip effects each don advertises
 * (`hands.spent: <weapon.hands>`). The don offers gate on `hands.remaining`, so a
 * two-handed weapon (or a shield already worn) blocks a second pick.
 *
 * Foundational (every character has hands) and so carries no search `meta`; in v1
 * this is the hands-max set + hands-reset copy.
 */
const hands: RuleModule = {
  id: 'hands',
  derive: () => [
    { fact: 'hands.max', value: () => 2 },
    { fact: 'hands.remaining', value: (f) => f.num('hands.max') - f.num('hands.spent') }
  ]
};

export default defineRule(hands);
