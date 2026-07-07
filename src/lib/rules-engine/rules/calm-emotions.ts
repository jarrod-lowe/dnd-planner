import {
  defineRule,
  preparedSpellCount,
  preparedSpellOffers,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [2, 3, 4, 5] as const;
const P = 'rule.spell-calm-emotions.offer-calm-emotions';
const SLOTS = 'calm-emotions';

/**
 * Calm Emotions — a Level 2 action concentration spell. The sleep/protection
 * shape, but level 2: the slot cascade starts at L2, so `intentLevel` is L2 and
 * the prepared fact is `spell.l2.calmEmotions.*`. Holds concentration via
 * `effect-calm-emotions` (`[turns 10, untilShortRest]`).
 */
const calmEmotions: RuleModule = {
  id: 'spell-calm-emotions',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['spellcasting', 'concentration']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l2.calmEmotions.prepared',
        alwaysPreparedFact: 'spell.l2.calmEmotions.alwaysPrepared'
      }),
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
      spellId: 'calm-emotions',
      i18nPrefix: 'rule.spell-calm-emotions',
      preparedFact: 'spell.l2.calmEmotions.prepared',
      alwaysPreparedFact: 'spell.l2.calmEmotions.alwaysPrepared',
      intentLevel: 'L2'
    }),
    {
      id: 'cast-calm-emotions',
      when: (f) => f.num('spell.l2.calmEmotions.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${P}.name`,
        description: `${P}.description`,
        detailKey: 'spell/calm-emotions',
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
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          notches: LEVELS.map((n) => ({
            value: n,
            enabled: { fact: `spellcasting.slots.level${n}.total` }
          })),
          valueFormat: 'spellLevel'
        },
        intents: { CONTROL: 'area' },
        actionCost: ['action', 'conc', 'L2']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${P}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${P}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('concentration.remaining') > 0,
          diagnostics: [{ code: `${P}.already_concentrating`, severity: 'error' }]
        },
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${P}.no_slots`, severity: 'error' }]
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
          },
          {
            id: 'effect-calm-emotions',
            state: { 'concentration.spent': 1 },
            display: { name: 'rule.spell-calm-emotions.effect-calm-emotions.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_spellcasting`, severity: 'error' });
        if (f.num('concentration.remaining') <= 0)
          diagnostics.push({ code: `${P}.already_concentrating`, severity: 'error' });
        if (level >= 2 && level <= 5) {
          advertise.push({
            id: `effect-calm-emotions-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${P}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${P}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(calmEmotions);
