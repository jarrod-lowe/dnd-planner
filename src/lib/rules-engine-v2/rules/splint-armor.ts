import {
  armorTrainingPenalties,
  defineRule,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type RuleModule
} from '../builder';

const S = 'rule.dnd-5e-2024.splint-armor';
const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';

/**
 * Splint Armor — Heavy armor, AC 17, no Dex bonus, and a 10-ft speed penalty if
 * your Strength is below 15. Donning advertises a permanent keyed effect that
 * sets `ac.armorBase` to 17 and `ac.dexCap` to 0 (so the ac group floors the dex
 * bonus). Worn without Heavy-armor training it raises the untrained penalties
 * (disadvantage + no spellcasting); a proficient paladin keeps casting.
 *
 * The speed penalty is a `combine: sum` contribution to `character.movement.spent`
 * (movement derives `remaining = total − spent`), gated on the live equipped +
 * STR facts — so it persists while worn and lifts if STR reaches 15, with no
 * change to the movement group. Foundational equip group, so no search meta.
 */
const speedPenalty: Contribution = {
  fact: 'character.movement.spent',
  combine: 'sum',
  value: (f) => (f.num('armor.splint.equipped') === 1 && f.num('str.value') < 15 ? 10 : 0)
};

const splintArmor: RuleModule = {
  id: 'splint-armor',
  derive: () => [...armorTrainingPenalties('splint', 'armor.heavy.proficient'), speedPenalty],
  offer: () => [
    {
      id: 'don-splint-armor',
      ui: {
        section: 'equip',
        name: `${S}.don-splint-armor.name`,
        detailKey: 'equipment/splint-armor',
        intents: { EQUIP: 'armor' },
        actionCost: []
      },
      legalWhen: [
        { condition: (f) => f.num('build.locked') === 0, diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }] },
        {
          condition: (f) => f.num('armor.splint.equipped') !== 1,
          diagnostics: [{ code: `${S}.don-splint-armor-offer.already-equipped`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('build.locked') !== 0) diagnostics.push({ code: BUILD_LOCKED, severity: 'error' });
        if (f.num('armor.splint.equipped') === 1)
          diagnostics.push({ code: `${S}.don-splint-armor-offer.already-equipped`, severity: 'error' });
        return {
          advertise: [
            {
              id: 'effect-splint-armor',
              key: 'armor:body',
              state: { 'ac.armorBase': 17, 'ac.dexCap': 0, 'armor.splint.equipped': 1 },
              stateCombine: { 'ac.armorBase': 'max' },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(splintArmor);
