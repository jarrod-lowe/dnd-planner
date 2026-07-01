import { defineRule, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.javelin';

const JAVELIN: WeaponDef = {
  id: 'javelin',
  hands: 1,
  damageDie: 6,
  damageType: 'piercing',
  disadvantageFact: 'attack.str.disadvantage',
  ranges: [
    { distance: 5, type: 'melee' },
    { distance: 30, type: 'thrown' },
    { distance: 120, type: 'thrown', disadvantage: true }
  ],
  annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any']
};

/**
 * Javelin — a Thrown simple weapon (1d6 piercing), STR-based like the dagger
 * (hit = STR modifier + proficiency, damage = STR modifier); not Light, so no
 * off-hand bonus swing. Derives + `weaponOffers`.
 */
const javelin: RuleModule = {
  id: 'javelin',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands']
  },
  derive: () => [
    { fact: 'attack.javelin.hitBonus', value: (f) => f.num('str.modifier') + f.num('proficiency.bonus') },
    { fact: 'attack.javelin.damageBonus', value: (f) => f.num('str.modifier') }
  ],
  offer: () => weaponOffers(JAVELIN)
};

export default defineRule(javelin);
