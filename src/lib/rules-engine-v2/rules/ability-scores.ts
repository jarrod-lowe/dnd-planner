import { defineRule, statToModifier, type RuleModule } from '../builder';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/**
 * Each ability's modifier is derived from its score. Six near-identical
 * `numberFunction` rules in the v1 YAML collapse to one loop here — and there is
 * no `early`/`after: str-base-set` ordering: the engine sees that `{a}.modifier`
 * reads `{a}.value` and orders accordingly.
 */
const abilityScores: RuleModule = {
  id: 'ability-scores',
  derive: () =>
    ABILITIES.map((a) => ({
      fact: `${a}.modifier`,
      // v1 parity: an unset score (absent fact) yields modifier 0, not
      // statToModifier(0) = -5. v1's statToModifierHandler returns 0 for an
      // undefined input, and the ability-score-set scenario asserts
      // str.modifier: 0 before a score is chosen.
      value: (f) => (f.has(`${a}.value`) ? statToModifier(f.num(`${a}.value`)) : 0)
    }))
};

export default defineRule(abilityScores);
