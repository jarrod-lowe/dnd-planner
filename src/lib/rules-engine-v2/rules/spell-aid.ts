import {
  defineRule,
  preparedSpellOffers,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [2, 3, 4, 5] as const;
const O = 'rule.spell-aid.offer-aid';
const SLOTS = 'aid';

/**
 * Aid — a Level 2 action spell that raises three allies' HP maximum by +5 (per
 * slot level above 2) for 8 hours. On the caster's own sheet it is the same shape
 * as Command (no concentration, no self effect), just at L2 with an L2–5 slot
 * cascade: casting spends an action, the turn's spell, and one slot. The +5 HP
 * lands on the *targets*, so nothing lingers on the caster — the buff is surfaced
 * as informational text, not a fact change here.
 */
const aid: RuleModule = {
  id: 'spell-aid',
  meta: {
    name: `${O}.name`,
    description: `${O}.description`,
    keywords: `${O}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => {
    const c: Contribution[] = [
      {
        fact: `${SLOTS}.eligibleSlotsRemaining`,
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: `${SLOTS}.lowestAvailableSlotLevel`,
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
      spellId: 'aid',
      i18nPrefix: 'rule.spell-aid',
      preparedFact: 'spell.l2.aid.prepared',
      alwaysPreparedFact: 'spell.l2.aid.alwaysPrepared',
      intentLevel: 'L2'
    }),
    {
      id: 'cast-aid',
      when: (f) => f.num('spell.l2.aid.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${O}.name`,
        description: `${O}.description`,
        detailKey: 'spell/aid',
        information: [
          {
            type: 'text',
            label: 'play.information.aidBonus',
            labelValues: { hp: { var: 'slotLevel', scale: 5, offset: -5 } }
          }
        ],
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          notches: [
            { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
            { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
            { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } },
            { value: 5, enabled: { fact: 'spellcasting.slots.level5.total' } }
          ],
          valueFormat: 'spellLevel'
        },
        intents: { AID: 'ally' },
        actionCost: ['action', 'L2']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
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
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num(`${SLOTS}.lowestAvailableSlotLevel`);
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (level >= 2 && level <= 5) {
          advertise.push({
            id: `effect-aid-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(aid);
