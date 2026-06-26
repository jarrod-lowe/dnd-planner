import { defineRule, type RuleModule } from '../builder';

/**
 * HP derivation. In v1 this needs the hp-reset → (class contributions) → hp-copy
 * three-group ordering dance (hp-total / hp-set / hp-copied). Here it is two
 * plain definitions: `hp.max` reads the settled `hp.base.max` total, and
 * `hp.current` reads `hp.max`. The engine derives the order.
 *
 * `hp.base.max` is contributed by class levels (combine: sum). `hp.modifier.*`
 * are persistent player adjustments (added by the effects pass later); they read
 * as 0 here.
 */
const hp: RuleModule = {
  id: 'hp',
  derive: () => [
    { fact: 'hp.max', value: (f) => f.num('hp.base.max') + f.num('hp.modifier.max') },
    { fact: 'hp.current', value: (f) => f.num('hp.max') + f.num('hp.modifier.current') }
  ]
};

export default defineRule(hp);
