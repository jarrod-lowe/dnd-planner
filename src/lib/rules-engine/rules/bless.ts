import {
  CONCENTRATION_SPELL_KEY,
  defineRule,
  preparedSpellCount,
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
 * 10 rounds). Prepared via the prepared-spells set picker; cast as an action
 * that spends a slot (L1–5 by the chosen level) and takes concentration.
 *
 * Concentration is held by the persistent `effect-bless` (`concentration.spent`
 * = 1), so it lights the same turn (the fold). SRD 5.2 ("Another Concentration
 * Effect"): a second concentration spell is LEGAL — you lose Concentration on
 * an effect the moment you start casting a spell that requires Concentration —
 * and the shared CONCENTRATION_SPELL_KEY makes the recast REPLACE this hold
 * instead of stacking beside it. The hold ends after 10 rounds OR on any rest
 * (`[turns, untilShortRest]`), releasing concentration. The +1d4 itself is a
 * UI rider (M4); this models the resource mechanics.
 */
const bless: RuleModule = {
  id: 'spell-bless',
  prepare: {
    spellId: 'bless',
    level: 1,
    nameKey: `${B}.name`,
    preparedFact: 'spell.l1.bless.prepared',
    alwaysPreparedFact: 'spell.l1.bless.alwaysPrepared'
  },
  meta: {
    name: `${B}.name`,
    description: `${B}.description`,
    keywords: `${B}.keywords`,
    requires: ['spellcasting', 'concentration', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.bless.prepared',
        alwaysPreparedFact: 'spell.l1.bless.alwaysPrepared'
      }),
      {
        fact: 'bless.eligibleSlotsRemaining',
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
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
    {
      id: 'cast-bless',
      when: (f) => f.num('spell.l1.bless.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${B}.name`,
        description: `${B}.description`,
        detailKey: 'spell/bless',
        // No save DC line: Bless forces no saving throw (it adds 1d4 to the
        // target's own attack rolls and saves).
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
        // No concentration gate: SRD 5.2 makes the recast legal — it dismisses
        // the current hold via the shared CONCENTRATION_SPELL_KEY (newest wins).
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
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // Concentration held for the duration or until a rest. Keyed so a
          // failed concentration check's eviction (an empty same-key effect)
          // replaces it, releasing the slot (see CONCENTRATION_SPELL_KEY).
          {
            id: 'effect-bless',
            key: CONCENTRATION_SPELL_KEY,
            state: { 'concentration.spent': 1 },
            display: { name: 'rule.spell-bless.effect-bless.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${B}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${B}.no_spellcasting`, severity: 'error' });
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
