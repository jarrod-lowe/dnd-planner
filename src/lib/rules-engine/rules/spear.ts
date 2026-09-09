import {
  defineRule,
  weaponEquip,
  weaponGripDerives,
  weaponOffers,
  type RuleModule,
  type WeaponDef
} from '../builder';

const P = 'rule.dnd-5e-2024.attacks.spear';

const SPEAR: WeaponDef = {
  id: 'spear',
  hands: 1,
  versatile: true,
  versatileDamageDie: 8,
  damageDie: 6,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  // Versatile: the grip is part of the LOADOUT (a two-handed spear costs the
  // second hand up front), so there is one melee band whose die follows
  // `weapon.spear.twoHanded` — d6 one-handed, d8 two-handed — and the thrown bands
  // stay at d6 whatever the grip.
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
    'property.versatile'
  ]
};

/**
 * Spear — a Versatile, Thrown simple weapon (1d6 piercing, 1d8 two-handed),
 * STR-based like the dagger. Derives + `weaponOffers`.
 */
const spear: RuleModule = {
  id: 'spear',
  equip: weaponEquip(SPEAR),
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands', 'loadout']
  },
  derive: () => [
    {
      fact: 'attack.spear.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus')
    },
    { fact: 'attack.spear.damageBonus', value: (f) => f.num('str.modifier') },
    ...weaponGripDerives(SPEAR)
  ],
  offer: () => weaponOffers(SPEAR)
};

export default defineRule(spear);
