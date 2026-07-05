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
const B = 'rule.spell-bless.offer-bless';

/**
 * Bless — a Level 1 concentration buff (+1d4 to allies' attacks and saves for
 * 10 rounds). Prepared via the shared prepare offers; cast as an action that
 * spends a slot (L1–5 by the chosen level) and takes concentration.
 *
 * Concentration is held by the persistent `effect-bless` (`concentration.spent`
 * = 1), so it lights the same turn (the fold) and a second concentration spell
 * is illegal while it lives; it ends after 10 rounds OR on any rest
 * (`[turns, untilShortRest]`), releasing concentration. The +1d4 itself is a
 * UI rider (M4); this models the resource mechanics.
 */
const bless: RuleModule = {
  id: 'spell-bless',
  meta: {
    name: `${B}.name`,
    description: `${B}.description`,
    keywords: `${B}.keywords`,
    requires: ['spellcasting', 'concentration']
  },
  derive: () => {
    const c: Contribution[] = [
      {
        fact: 'bless.eligibleSlotsRemaining',
        value: (f) => LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        // Lowest slot level with a slot remaining (0 if none).
        fact: 'bless.lowestAvailableSlotLevel',
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
      spellId: 'bless',
      i18nPrefix: 'rule.spell-bless',
      preparedFact: 'spell.l1.bless.prepared',
      alwaysPreparedFact: 'spell.l1.bless.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-bless',
      when: (f) => f.num('spell.l1.bless.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${B}.name`,
        description: `${B}.description`,
        detailKey: 'spell/bless',
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: { saveType: { fact: 'spellcasting.saveAbility' }, dc: { fact: 'spellcasting.saveDC' } }
          }
        ],
        intents: { AID: 'ally' },
        actionCost: ['action', 'conc', 'L1']
      },
      vars: { slotLevel: { capture: true, default: { fact: 'bless.lowestAvailableSlotLevel' } } },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${B}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${B}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('concentration.remaining') > 0,
          diagnostics: [{ code: `${B}.already_concentrating`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('bless.eligibleSlotsRemaining') > 0,
          diagnostics: [{ code: `${B}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('bless.lowestAvailableSlotLevel');
        const advertise: EffectInstance[] = [
          { id: 'cost', state: { 'actions.spent': 1, 'spellcasting.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          // Concentration held for the duration or until a rest.
          {
            id: 'effect-bless',
            state: { 'concentration.spent': 1 },
            display: { name: 'rule.spell-bless.effect-bless.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0) diagnostics.push({ code: `${B}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${B}.no_spellcasting`, severity: 'error' });
        if (f.num('concentration.remaining') <= 0)
          diagnostics.push({ code: `${B}.already_concentrating`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-bless-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${B}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${B}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(bless);
