import type { RuleModule } from '../types';
import { statToModifier } from '../functions';

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
      value: (f) => statToModifier(f.num(`${a}.value`))
    }))
};

export default abilityScores;
