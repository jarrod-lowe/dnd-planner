import { defineRule, type RuleModule } from '../builder';

/**
 * Armor Class: `ac.value = base (10) + dex bonus + armor + shield + misc`.
 *
 * v1 used an ac-calculation → ac-dex → ac-components → ac-total cascade of groups
 * to copy-then-sum; here the sum derive simply reads the component facts and the
 * engine orders them. The armor/shield/misc bonuses are contributed by other
 * groups (armor, shield, fighting styles) — 0 until those port. Worn-armor that
 * replaces the base or caps dex is handled when the armor groups port (the dex
 * derive will read an armor-provided cap then). Foundational, so no search meta.
 */
const ac: RuleModule = {
  id: 'ac',
  derive: () => [
    { fact: 'ac.base', value: () => 10 },
    { fact: 'ac.dexBonus', value: (f) => f.num('dex.modifier') },
    {
      fact: 'ac.value',
      value: (f) =>
        f.num('ac.base') +
        f.num('ac.dexBonus') +
        f.num('ac.armorBonus') +
        f.num('ac.shieldBonus') +
        f.num('ac.miscBonus')
    }
  ]
};

export default defineRule(ac);
