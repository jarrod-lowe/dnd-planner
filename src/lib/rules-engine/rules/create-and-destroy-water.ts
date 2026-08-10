import {
  defineRule,
  preparedSpellCount,
  preparedSpellOffers,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const C = 'rule.spell-create-and-destroy-water';
const O = `${C}.offer-create-and-destroy-water`;
const CAST = `${C}.cast-create-and-destroy-water`;

/**
 * Create and Destroy Water — a plain Level 1 action utility spell (no upcast, no
 * concentration). Prepare path + a cast that spends an action, the turn's spell,
 * and an L1 slot (persisted until a long rest). The simplest spell shape.
 */
const createAndDestroyWater: RuleModule = {
  id: 'spell-create-and-destroy-water',
  meta: {
    name: `${CAST}.name`,
    description: `${CAST}.description`,
    keywords: `${CAST}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => [
    preparedSpellCount({
      preparedFact: 'spell.l1.createAndDestroyWater.prepared',
      alwaysPreparedFact: 'spell.l1.createAndDestroyWater.alwaysPrepared'
    })
  ],
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'create-and-destroy-water',
      i18nPrefix: C,
      preparedFact: 'spell.l1.createAndDestroyWater.prepared',
      alwaysPreparedFact: 'spell.l1.createAndDestroyWater.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-create-and-destroy-water',
      when: (f) => f.num('spell.l1.createAndDestroyWater.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${CAST}.name`,
        description: `${CAST}.description`,
        detailKey: 'spell/create-and-destroy-water',
        intents: { HANDLE: 'consume' },
        actionCost: ['action', 'L1']
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${O}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${O}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.slots.level1.remaining') > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          {
            id: 'effect-create-and-destroy-water-l1',
            state: { 'spellcasting.slots.level1.spent': 1 },
            expiry: { kind: 'untilLongRest' }
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (f.num('spellcasting.slots.level1.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(createAndDestroyWater);
