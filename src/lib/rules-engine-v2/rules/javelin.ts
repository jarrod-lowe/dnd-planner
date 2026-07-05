import { defineRule, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.javelin';
const SLOW = 'rule.dnd-5e-2024.attacks.javelin-slow';

/** Slow is surfaced once the javelin-mastery group sets `attack.javelin.mastery`. */
const masteryCondition = { fact: 'attack.javelin.mastery', operator: 'equals', value: 1 };

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
  annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any'],
  // Slow (weapon mastery): on hit, a one-turn speed-reduction effect. The followup
  // rides the action panel gated on the javelin-mastery fact (like greataxe Cleave).
  actionUiExtra: {
    followups: [
      {
        type: 'effect',
        condition: masteryCondition,
        button: `${SLOW}.button`,
        addRule: {
          target: 'effect',
          // A one-turn Slow reminder committed when tapped (the target isn't modelled,
          // so it carries no player facts — just a duration-limited marker).
          effect: {
            id: 'effect-javelin-slow',
            key: 'javelin-slow',
            display: { name: `${SLOW}.effect-name`, section: 'mastery' },
            expiry: { kind: 'turns', remaining: 1 }
          }
        }
      }
    ]
  }
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
