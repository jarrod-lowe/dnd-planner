import { defineRule, weaponEquip, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.scimitar';

const SCIMITAR: WeaponDef = {
  id: 'scimitar',
  hands: 1,
  light: true,
  damageDie: 6,
  damageType: 'slashing',
  disadvantageFact: 'attack.dex.disadvantage',
  ranges: [{ distance: 5, type: 'melee' }],
  annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any']
};

/**
 * Scimitar — a Light, Finesse simple melee weapon (1d6 slashing). Finesse: the
 * hit and damage bonuses use the HIGHER of STR or DEX modifier. Otherwise the
 * dagger shape (derives + `weaponOffers`).
 */
const scimitar: RuleModule = {
  id: 'scimitar',
  equip: weaponEquip(SCIMITAR),
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands', 'loadout']
  },
  derive: () => [
    {
      fact: 'attack.scimitar.finesseBonus',
      value: (f) => Math.max(f.num('str.modifier'), f.num('dex.modifier'))
    },
    {
      fact: 'attack.scimitar.hitBonus',
      value: (f) => f.num('attack.scimitar.finesseBonus') + f.num('proficiency.bonus')
    },
    { fact: 'attack.scimitar.damageBonus', value: (f) => f.num('attack.scimitar.finesseBonus') }
  ],
  offer: () => weaponOffers(SCIMITAR)
};

export default defineRule(scimitar);
