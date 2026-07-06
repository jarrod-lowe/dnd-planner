import {
  armorTrainingPenalties,
  defineRule,
  type ActionResult,
  type Diagnostic,
  type RuleModule
} from '../builder';

const L = 'rule.dnd-5e-2024.leather-armor';
const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';

/**
 * Leather Armor — Light armor, AC 11 + full Dex. Donning advertises a permanent
 * keyed effect that sets `ac.armorBase` to 11 (the ac group reads it as the base)
 * and marks it equipped; light armor caps no Dex. Worn without Light-armor
 * training it raises the untrained penalties (disadvantage on STR/DEX d20 tests +
 * no spellcasting), derived from the equipped + proficiency facts. Foundational
 * equip group, so no search meta.
 */
const leatherArmor: RuleModule = {
  id: 'leather-armor',
  derive: () => armorTrainingPenalties('leather', 'armor.light.proficient'),
  offer: () => [
    {
      id: 'don-leather-armor',
      ui: {
        section: 'equip',
        name: `${L}.don-leather-armor.name`,
        detailKey: 'equipment/leather-armor',
        intents: { EQUIP: 'armor' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('build.locked') === 0,
          diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
        },
        {
          condition: (f) => f.num('armor.leather.equipped') !== 1,
          diagnostics: [
            { code: `${L}.don-leather-armor-offer.already-equipped`, severity: 'error' }
          ]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('build.locked') !== 0)
          diagnostics.push({ code: BUILD_LOCKED, severity: 'error' });
        if (f.num('armor.leather.equipped') === 1)
          diagnostics.push({
            code: `${L}.don-leather-armor-offer.already-equipped`,
            severity: 'error'
          });
        return {
          advertise: [
            {
              id: 'effect-leather-armor',
              key: 'armor:body',
              state: { 'ac.armorBase': 11, 'armor.leather.equipped': 1 },
              stateCombine: { 'ac.armorBase': 'max' },
              // On the strip (v1 parity): removing the chip is how the armor is doffed.
              display: { name: 'rule.dnd-5e-2024.leather-armor.effect-leather-armor.name' },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(leatherArmor);
