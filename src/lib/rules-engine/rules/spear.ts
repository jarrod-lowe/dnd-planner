import { defineRule, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.spear';

const SPEAR: WeaponDef = {
  id: 'spear',
  hands: 1,
  damageDie: 6,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  // Versatile: a two-handed melee band (1d8, needs a free hand) sits alongside the
  // one-handed and thrown bands. weaponOffers carries these as dice-line data; the
  // two-handed free-hand check itself is not yet modelled (see the skip-list).
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
    'property.versatile'
  ]
};

/**
 * Spear — a Versatile, Thrown simple weapon (1d6 piercing, 1d8 two-handed),
 * STR-based like the dagger. Derives + `weaponOffers`.
 */
const spear: RuleModule = {
  id: 'spear',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands']
  },
  derive: () => [
    {
      fact: 'attack.spear.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus')
    },
    { fact: 'attack.spear.damageBonus', value: (f) => f.num('str.modifier') }
  ],
  offer: () => weaponOffers(SPEAR)
};

export default defineRule(spear);
