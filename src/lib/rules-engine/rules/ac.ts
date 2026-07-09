import { defineRule, type RuleModule } from '../builder';

/**
 * Armor Class: `ac.value = base + dex bonus + armor + shield + misc`.
 *
 * The legacy engine used an ac-calculation → ac-dex → ac-components → ac-total cascade of groups
 * to copy-then-sum; here the sum derive simply reads the component facts and the
 * engine orders them.
 *
 * Worn armor REPLACES the unarmored base (10) and constrains the dex bonus — both
 * via facts only the armor groups set, so there is no second writer to `ac.base` /
 * `ac.dexBonus` (which would be a combine conflict):
 *  - `ac.base` = the worn armor's `ac.armorBase` (leather 11, splint 17) if any,
 *    else 10.
 *  - `ac.dexBonus` = the dex modifier, constrained by the worn armor's category:
 *    heavy armor (`ac.dexIgnored`) ignores Dex entirely — even a negative modifier
 *    does not lower AC; medium armor (`ac.dexCap` +2) caps only the POSITIVE side,
 *    so a negative Dex still applies; light/unarmored take the full modifier.
 * Shield/misc bonuses stay additive. Foundational, so no search meta.
 */
const ac: RuleModule = {
  id: 'ac',
  derive: () => [
    { fact: 'ac.base', value: (f) => (f.has('ac.armorBase') ? f.num('ac.armorBase') : 10) },
    {
      fact: 'ac.dexBonus',
      value: (f) =>
        f.num('ac.dexIgnored') > 0
          ? 0 // heavy armor: ignore Dex entirely, negatives included
          : f.has('ac.dexCap')
            ? Math.min(f.num('dex.modifier'), f.num('ac.dexCap')) // medium: cap the positive side
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
