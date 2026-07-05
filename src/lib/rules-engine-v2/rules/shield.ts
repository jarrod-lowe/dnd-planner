import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.shield';
const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';

/**
 * Shield — +2 AC, one hand. Donning advertises a permanent keyed effect adding
 * `ac.shieldBonus` (additive, distinct from the worn-armor base) and consuming a
 * hand from the equip budget. The offer is illegal without shield training (a
 * warning that still blocks) or with no free hand. Foundational equip group, so
 * no search meta.
 */
const shield: RuleModule = {
  id: 'shield',
  offer: () => [
    {
      id: 'don-shield',
      ui: {
        section: 'equip',
        name: `${S}.don-shield.name`,
        detailKey: 'equipment/shield',
        intents: { EQUIP: 'armor' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('build.locked') === 0,
          diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
        },
        {
          condition: (f) => f.num('armor.shield.equipped') !== 1,
          diagnostics: [{ code: `${S}.don-shield-offer.already-equipped`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('armor.shield.proficient') === 1,
          diagnostics: [{ code: `${S}.don-shield-offer.not-proficient`, severity: 'warning' }]
        },
        {
          condition: (f) => f.num('hands.remaining') >= 1,
          diagnostics: [{ code: `${S}.don-shield-offer.no-hands`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('build.locked') !== 0)
          diagnostics.push({ code: BUILD_LOCKED, severity: 'error' });
        if (f.num('armor.shield.equipped') === 1)
          diagnostics.push({ code: `${S}.don-shield-offer.already-equipped`, severity: 'error' });
        if (f.num('armor.shield.proficient') !== 1)
          diagnostics.push({ code: `${S}.don-shield-offer.not-proficient`, severity: 'warning' });
        if (f.num('hands.remaining') < 1)
          diagnostics.push({ code: `${S}.don-shield-offer.no-hands`, severity: 'error' });
        return {
          advertise: [
            {
              id: 'effect-shield',
              key: 'armor:shield',
              state: { 'ac.shieldBonus': 2, 'armor.shield.equipped': 1, 'hands.spent': 1 },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(shield);
