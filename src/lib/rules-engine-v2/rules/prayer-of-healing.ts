import {
  defineRule,
  preparedSpellOffers,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
const O = 'rule.spell-prayer-of-healing.offer-prayer-of-healing';
const SLOTS = 'prayerOfHealing';

/**
 * Prayer of Healing — a Level 2 action spell: up to five allies regain 2d8 HP
 * (+1d8 per slot level above 2, i.e. N d8 at slot level N). On the caster's sheet
 * it is the same self-less shape as Aid, but with the full L2–9 slot cascade a
 * full caster could reach (a paladin only ever owns L2–5). Casting spends an
 * action, the turn's spell, and one slot; the healing lands on the targets.
 */
const prayerOfHealing: RuleModule = {
  id: 'spell-prayer-of-healing',
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
        // Floors at the spell's base level (2) when no slot remains, so the
        // slider default / healing-dice count stay at L2 after the slot is spent
        // (v1 parity — otherwise the dice count collapses to 1d8).
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return LEVELS[0];
        }
      }
    ];
    return c;
  },
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'prayer-of-healing',
      i18nPrefix: 'rule.spell-prayer-of-healing',
      preparedFact: 'spell.l2.prayerOfHealing.prepared',
      alwaysPreparedFact: 'spell.l2.prayerOfHealing.alwaysPrepared',
      intentLevel: 'L2'
    }),
    {
      id: 'cast-prayer-of-healing',
      when: (f) => f.num('spell.l2.prayerOfHealing.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${O}.name`,
        description: `${O}.description`,
        detailKey: 'spell/prayer-of-healing',
        // Slot-level slider (opens at L2, grows with owned slots) and a healing
        // dice line whose die count tracks the slider (N d8 at slot level N).
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          notches: LEVELS.map((n) => ({
            value: n,
            enabled: { fact: `spellcasting.slots.level${n}.total` }
          })),
          valueFormat: 'spellLevel'
        },
        secondaryControl: {
          type: 'dice-line',
          label: `${O}.healLabel`,
          dice: [{ sides: 8, count: { var: 'slotLevel' }, unit: 'hp', purpose: 'healing' }]
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
        if (level >= 2 && level <= 9) {
          advertise.push({
            id: `effect-prayer-of-healing-slot-l${level}`,
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

export default defineRule(prayerOfHealing);
