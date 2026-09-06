import { defineRule, weaponEquip, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.dagger';

/** The dagger as data — the def `weaponOffers` crosses with the equip/attack profiles. */
const DAGGER: WeaponDef = {
  id: 'dagger',
  hands: 1,
  light: true,
  damageDie: 4,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  ranges: [
    { distance: 5, type: 'melee' },
    { distance: 20, type: 'thrown' },
    { distance: 60, type: 'thrown', disadvantage: true }
  ],
  annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any']
};

/**
 * Dagger — a Light, Finesse simple melee weapon (1d4 piercing). One self-contained
 * module: the to-hit/damage derives plus every offer (`weaponOffers`) the legacy engine split
 * across the `dagger` group and the preprocessor-generated don/activation groups.
 * Hit bonus is STR modifier + proficiency; damage is STR modifier (the
 * Finesse DEX option is not yet modelled).
 */
const dagger: RuleModule = {
  id: 'dagger',
  equip: weaponEquip(DAGGER),
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands', 'loadout']
  },
  derive: () => [
    {
      fact: 'attack.dagger.hitBonus',
      value: (f) => f.num('str.modifier') + f.num('proficiency.bonus')
    },
    { fact: 'attack.dagger.damageBonus', value: (f) => f.num('str.modifier') }
  ],
  offer: () => weaponOffers(DAGGER)
};

export default defineRule(dagger);
