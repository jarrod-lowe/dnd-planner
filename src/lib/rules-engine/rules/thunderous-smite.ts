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

const LEVELS = [1, 2, 3, 4, 5] as const;
const T = 'rule.spell-thunderous-smite.offer-thunderous-smite';

/**
 * Thunderous Smite — a Level 1 bonus-action smite cast after a melee hit (+2d6
 * thunder, STR save or pushed/prone). Like Divine Smite but with no free use and
 * no concentration: prepare path + a L1–5 slot cascade, then a bonus-action cast
 * that spends a slot. The damage/push is a UI rider (M4); this models the
 * resource mechanics and legality.
 */
const thunderousSmite: RuleModule = {
  id: 'spell-thunderous-smite',
  meta: {
    name: `${T}.name`,
    description: `${T}.description`,
    keywords: `${T}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.thunderousSmite.prepared',
        alwaysPreparedFact: 'spell.l1.thunderousSmite.alwaysPrepared'
      }),
      {
        fact: 'tsmite.eligibleSlotsRemaining',
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: 'tsmite.lowestAvailableSlotLevel',
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      },
      // Smite handles L1-5 even for a multiclass full caster.
      {
        fact: 'tsmite.maxCastLevel',
        value: (f) => Math.min(f.num('spellcasting.maxSlotLevel'), 5)
      },
      {
        // 2d6 at L1, +1 die per level above 1 (so lowest-slot + 1); 0 if none.
        fact: 'tsmite.defaultDieCount',
        value: (f) => {
          const slot = f.num('tsmite.lowestAvailableSlotLevel');
          return slot > 0 ? slot + 1 : 0;
        }
      }
    ];
    return c;
  },
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'thunderous-smite',
      i18nPrefix: 'rule.spell-thunderous-smite',
      preparedFact: 'spell.l1.thunderousSmite.prepared',
      alwaysPreparedFact: 'spell.l1.thunderousSmite.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-thunderous-smite',
      when: (f) => f.num('spell.l1.thunderousSmite.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${T}.name`,
        description: `${T}.description`,
        detailKey: 'spell/thunderous-smite',
        dieSides: 6,
        showDC: true,
        saveType: 'STR',
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          min: { number: 1 },
          max: { fact: 'tsmite.maxCastLevel' },
          valueFormat: 'spellLevel'
        },
        information: [
          {
            type: 'text',
            // The target makes a STR save (the ui.saveType flag above); the
            // DC value is the spell save DC.
            label: 'play.information.saveDcStr',
            labelValues: { dc: { fact: 'spellcasting.saveDC' } }
          }
        ],
        intents: { ATTACK: 'spells' },
        actionCost: ['bonus', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: 'tsmite.lowestAvailableSlotLevel' } },
        dieCount: { capture: true, default: { fact: 'tsmite.defaultDieCount' } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${T}.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('attack.last.activation.action') >= 1,
          diagnostics: [{ code: `${T}.no_attack`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('tsmite.eligibleSlotsRemaining') > 0,
          diagnostics: [{ code: `${T}.no_slots`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${T}.no_spellcasting`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('tsmite.lowestAvailableSlotLevel');
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${T}.no_bonus_action`, severity: 'error' });
        if (f.num('attack.last.activation.action') < 1)
          diagnostics.push({ code: `${T}.no_attack`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${T}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-thunderous-smite-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${T}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${T}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(thunderousSmite);
