import { defineRule, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.spear-plus1';
const MAGICAL = 'rule.dnd-5e-2024.spear-plus1.magical';

const SPEAR_PLUS1: WeaponDef = {
  id: 'spear-plus1',
  hands: 1,
  damageDie: 6,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  // Same Versatile/Thrown bands as the base spear; the +1 enhancement rides in
  // the hit/damage derives below, not the dice sizes.
  ranges: [
    { distance: 5, type: 'melee', label: '1H' },
    { distance: 5, type: 'melee', label: '2H', damageDie: 8, extraHands: 1 },
    { distance: 20, type: 'thrown' },
    { distance: 60, type: 'thrown', disadvantage: true }
  ],
  annotationLabels: [
    'attack.any',
    'attack.melee',
    'attack.weapon',
    'dice.any',
    'property.versatile',
    'property.magical'
  ]
};

/**
 * Spear +1 — the magical (Uncommon) variant of the spear. Identical shape to the
 * base `spear` module (`weaponOffers` over the same bands), with the +1
 * enhancement folded into the hit and damage derives and a `property.magical`
 * annotation on the weapon. This is what the v1 Python preprocessor produced as a
 * separate weapon group; in v2 it is one more self-contained `weaponOffers` call.
 */
const spearPlus1: RuleModule = {
  id: 'spear-plus1',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands']
  },
  derive: () => [
    {
      fact: 'attack.spear-plus1.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus') + 1
    },
    { fact: 'attack.spear-plus1.damageBonus', value: (f) => f.num('str.modifier') + 1 }
  ],
  offer: () => weaponOffers(SPEAR_PLUS1),
  // Unconditional magical mark on the weapon (mirrors v1 annotate-spear-plus1-magical).
  annotate: () => [{ key: MAGICAL, targets: ['property.magical'] }]
};

export default defineRule(spearPlus1);
