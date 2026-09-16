import {
  defineRule,
  preparedSpellCount,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [1, 2, 3, 4, 5] as const;
const C = 'rule.spell-cure-wounds.offer-cure-wounds';
const SLOTS = 'cureWounds';

/**
 * Cure Wounds — a Level 1 action heal (2d8 + spellcasting ability modifier,
 * +2d8 per slot level above 1). The Prayer of Healing resource shape — prepare
 * path + an L1–5 slot cascade + a cast that spends an action, the turn spell,
 * and a slot — with the Lay on Hands heal-offer conventions on the panel (hp
 * unit, captured values) and a healing dice-line whose die count tracks the
 * slot-level slider (2 × slotLevel d8) with the spellcasting modifier as the
 * roll's bonus (the natural-roll + modifier display every roller uses).
 *
 * The healing lands on the touched CREATURE, world state the app does not track
 * (the Prayer of Healing precedent), so the cast advertises no HP effect; a
 * self-heal is recorded separately through the core-events heal recorder.
 */
const cureWounds: RuleModule = {
  id: 'spell-cure-wounds',
  prepare: {
    spellId: 'cure-wounds',
    level: 1,
    nameKey: `${C}.name`,
    preparedFact: 'spell.l1.cureWounds.prepared',
    alwaysPreparedFact: 'spell.l1.cureWounds.alwaysPrepared'
  },
  meta: {
    name: `${C}.name`,
    description: `${C}.description`,
    keywords: `${C}.keywords`,
    requires: ['spellcasting', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.cureWounds.prepared',
        alwaysPreparedFact: 'spell.l1.cureWounds.alwaysPrepared'
      }),
      {
        fact: `${SLOTS}.eligibleSlotsRemaining`,
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: `${SLOTS}.lowestAvailableSlotLevel`,
        // Floors at the spell's base level (1) when no slot remains, so the
        // slider default / healing-dice count stay at 2d8 after the slot is
        // spent (otherwise the dice count collapses to nothing).
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return LEVELS[0];
        }
      },
      {
        // Cure Wounds handles L1-5 even for a multiclass full caster.
        fact: `${SLOTS}.maxCastLevel`,
        value: (f) => Math.min(f.num('spellcasting.maxSlotLevel'), 5)
      }
    ];
    return c;
  },
  offer: () => [
    {
      id: 'cast-cure-wounds',
      when: (f) => f.num('spell.l1.cureWounds.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${C}.name`,
        description: `${C}.description`,
        detailKey: 'spell/cure-wounds',
        // The secondary control rolls the healing dice — "any die" includes them.
        annotationLabels: ['dice.any'],
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          min: { number: 1 },
          max: { fact: `${SLOTS}.maxCastLevel` },
          valueFormat: 'spellLevel'
        },
        secondaryControl: {
          type: 'dice-line',
          label: `${C}.healLabel`,
          dice: [
            {
              sides: 8,
              // 2d8 at L1, +2d8 per slot level above 1 (so 2 × N d8 at slot N),
              // plus the spellcasting ability modifier as the roll's bonus.
              count: { var: 'slotLevel', scale: 2 },
              bonus: { fact: 'spellcasting.modifier' },
              unit: 'hp',
              purpose: 'healing'
            }
          ]
        },
        intents: { AID: 'ally' },
        actionCost: ['action', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${C}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${C}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${C}.no_slots`, severity: 'error' }]
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
          diagnostics.push({ code: `${C}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${C}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-cure-wounds-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${C}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${C}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(cureWounds);
