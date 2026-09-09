import {
  defineRule,
  weaponEquip,
  weaponGripDerives,
  weaponOffers,
  type RuleModule,
  type WeaponDef
} from '../builder';

const P = 'rule.dnd-5e-2024.attacks.spear-plus1';
const MAGICAL = 'rule.dnd-5e-2024.spear-plus1.magical';

const SPEAR_PLUS1: WeaponDef = {
  id: 'spear-plus1',
  hands: 1,
  versatile: true,
  versatileDamageDie: 8,
  damageDie: 6,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  // Same Versatile/Thrown bands as the base spear (the grip lives in the loadout,
  // so the melee band's die follows `weapon.spear-plus1.twoHanded`); the +1
  // enhancement rides in the hit/damage derives below, not the dice sizes.
  ranges: [
    { distance: 5, type: 'melee' },
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
 * annotation on the weapon. The legacy Python preprocessor produced this as a
 * separate weapon group; here it is one more self-contained `weaponOffers` call.
 */
const spearPlus1: RuleModule = {
  id: 'spear-plus1',
  equip: weaponEquip(SPEAR_PLUS1),
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands', 'loadout']
  },
  derive: () => [
    {
      fact: 'attack.spear-plus1.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus') + 1
    },
    { fact: 'attack.spear-plus1.damageBonus', value: (f) => f.num('str.modifier') + 1 },
    ...weaponGripDerives(SPEAR_PLUS1)
  ],
  offer: () => weaponOffers(SPEAR_PLUS1),
  // Unconditional magical mark on the weapon (the legacy annotate-spear-plus1-magical).
  annotate: () => [{ key: MAGICAL, targets: ['property.magical'] }]
};

export default defineRule(spearPlus1);
