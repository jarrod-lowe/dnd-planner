import {
  defineRule,
  preparedSpellOffers,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [1, 2, 3, 4, 5] as const;
const S = 'rule.spell-sanctuary.offer-sanctuary';

/**
 * Sanctuary — a Level 1 bonus-action ward (10 rounds, dismissed on a rest). Not
 * modelled as concentration here (the legacy rules had no concentration gate). Prepare path +
 * an L1–5 slot cascade + a cast that spends a bonus action, the turn's spell, and
 * a slot, raising `effect-sanctuary` — a pure duration marker that ages out after
 * 10 rounds OR on any rest (`[turns, untilShortRest]`).
 */
const sanctuary: RuleModule = {
  id: 'spell-sanctuary',
  meta: {
    name: `${S}.name`,
    description: `${S}.description`,
    keywords: `${S}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => {
    const c: Contribution[] = [
      {
        fact: 'sanctuary.eligibleSlotsRemaining',
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: 'sanctuary.lowestAvailableSlotLevel',
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      }
    ];
    return c;
  },
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'sanctuary',
      i18nPrefix: 'rule.spell-sanctuary',
      preparedFact: 'spell.l1.sanctuary.prepared',
      alwaysPreparedFact: 'spell.l1.sanctuary.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-sanctuary',
      when: (f) => f.num('spell.l1.sanctuary.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${S}.name`,
        description: `${S}.description`,
        detailKey: 'spell/sanctuary',
        showDC: true,
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: {
              saveType: { fact: 'spellcasting.saveAbility' },
              dc: { fact: 'spellcasting.saveDC' }
            }
          }
        ],
        intents: { DEFEND: 'ward' },
        actionCost: ['bonus', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: 'sanctuary.lowestAvailableSlotLevel' } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${S}.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('sanctuary.eligibleSlotsRemaining') > 0,
          diagnostics: [{ code: `${S}.no_slots`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${S}.no_spellcasting`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('sanctuary.lowestAvailableSlotLevel');
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // The ward: a pure duration marker; ends after 10 rounds or on any rest.
          {
            id: 'effect-sanctuary',
            display: { name: 'rule.spell-sanctuary.effect-sanctuary.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_bonus_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-sanctuary-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${S}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${S}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(sanctuary);
