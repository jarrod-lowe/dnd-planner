import { defineRule, type RuleModule } from '../builder';

/**
 * Armor Class: `ac.value = base + dex bonus + armor + shield + misc`.
 *
 * v1 used an ac-calculation → ac-dex → ac-components → ac-total cascade of groups
 * to copy-then-sum; here the sum derive simply reads the component facts and the
 * engine orders them.
 *
 * Worn armor REPLACES the unarmored base (10) and may CAP the dex bonus — both via
 * facts only the armor groups set, so there is no second writer to `ac.base` /
 * `ac.dexBonus` (which would be a combine conflict):
 *  - `ac.base` = the worn armor's `ac.armorBase` (leather 11, splint 17) if any,
 *    else 10.
 *  - `ac.dexBonus` = dex modifier, capped at `ac.dexCap` when an armor sets one
 *    (heavy armor → 0; there is no `min` combine, so the cap is applied here).
 * Shield/misc bonuses stay additive. Foundational, so no search meta.
 */
const ac: RuleModule = {
  id: 'ac',
  derive: () => [
    { fact: 'ac.base', value: (f) => (f.has('ac.armorBase') ? f.num('ac.armorBase') : 10) },
    {
      fact: 'ac.dexBonus',
      value: (f) =>
        f.has('ac.dexCap')
          ? Math.min(f.num('dex.modifier'), f.num('ac.dexCap'))
          : f.num('dex.modifier')
    },
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
