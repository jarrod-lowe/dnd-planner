import { defineRule, weaponOffers, type RuleModule, type WeaponDef } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.greataxe';
const CLEAVE = 'rule.dnd-5e-2024.attacks.greataxe-cleave.button';

/** Cleave is surfaced once the greataxe-mastery group sets `attack.greataxe.mastery`. */
const masteryCondition = { fact: 'attack.greataxe.mastery', operator: 'equals', value: 1 };

/** The greataxe as data, including its Cleave (mastery) action-panel extras. */
const GREATAXE: WeaponDef = {
  id: 'greataxe',
  hands: 2,
  damageDie: 12,
  damageType: 'slashing',
  disadvantageFact: 'attack.str.disadvantage',
  ranges: [{ distance: 5, type: 'melee' }],
  annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any', 'property.twoHanded'],
  actionUiExtra: {
    followups: [{ type: 'attack-line', condition: masteryCondition, button: CLEAVE }],
    secondaryControl: {
      type: 'dice-line',
      enabled: { condition: masteryCondition, button: CLEAVE },
      ranges: { var: 'ranges' },
      dice: [
        { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
        { sides: { var: 'damageDie' }, bonus: { var: 'damageBonus' }, purpose: 'damage', damageType: { string: 'slashing' } }
      ]
    }
  }
};

/**
 * Greataxe — a Heavy, Two-Handed martial melee weapon (1d12 slashing). Same shape
 * as the dagger module (derives + `weaponOffers`); being two-handed its don costs
 * both hands, and the Cleave followup/secondary control ride along on the action
 * panel, enabled by the greataxe-mastery group. Hit bonus is STR modifier +
 * proficiency; damage is STR modifier.
 */
const greataxe: RuleModule = {
  id: 'greataxe',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['attacks', 'hands']
  },
  derive: () => [
    { fact: 'attack.greataxe.hitBonus', value: (f) => f.num('str.modifier') + f.num('proficiency.bonus') },
    { fact: 'attack.greataxe.damageBonus', value: (f) => f.num('str.modifier') }
  ],
  offer: () => weaponOffers(GREATAXE)
};

export default defineRule(greataxe);
