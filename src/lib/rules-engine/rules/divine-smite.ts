import {
  defineRule,
  preparedSpellOffers,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const SMITE_LEVELS = [1, 2, 3, 4, 5] as const;
const RADIANT = 'radiant';
const D = 'rule.spell-divine-smite.offer-divine-smite';

/**
 * Divine Smite — an 832-line legacy rule group as one module on the unified engine.
 *
 * - `when` gates the cast offer on the spell being prepared (structural).
 * - Derives the slot cascade (lowest available L1-5), the free-use option as
 *   "level 0", the slider bounds, and the default level — all as plain dataflow.
 * - `apply` spends a bonus action + the one-spell-per-turn resource (endOfTurn)
 *   and either the free use (level 0) or a slot (untilLongRest), as effects the
 *   fold makes visible to later actions and that persist across turns.
 * - Upcast dice scale with the chosen level purely in the `ui` descriptor
 *   (UI-rendered), not engine logic.
 */
const divineSmite: RuleModule = {
  id: 'spell-divine-smite',
  // Discovery metadata for the search index (i18n keys reused from the offer; no
  // new translations). `requires` mirrors the published group prerequisite.
  meta: {
    name: `${D}.name`,
    description: `${D}.description`,
    keywords: `${D}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => [
    {
      fact: 'smite.eligibleSlotsRemaining',
      value: (f) =>
        SMITE_LEVELS.reduce((sum, n) => sum + f.num(`spellcasting.slots.level${n}.remaining`), 0)
    },
    {
      // Lowest slot level with a slot remaining (0 if none).
      fact: 'smite.lowestAvailableSlotLevel',
      value: (f) => {
        for (const n of SMITE_LEVELS)
          if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
        return 0;
      }
    },
    {
      fact: 'smite.anyResourceRemaining',
      value: (f) => f.num('smite.eligibleSlotsRemaining') + f.num('paladinSmite.remaining')
    },
    {
      // Slider floor: 0 (the free-use notch) only if the character owns the feature.
      fact: 'smite.minSlotLevel',
      value: (f) => (f.num('paladinSmite.total') > 0 ? 0 : 1)
    },
    {
      // Default to the free use when one is available, else the lowest slot.
      fact: 'smite.defaultLevel',
      value: (f) =>
        f.num('paladinSmite.remaining') > 0 ? 0 : f.num('smite.lowestAvailableSlotLevel')
    },
    {
      // Smite handles L1-5 only, even for a multiclass full caster.
      fact: 'smite.maxCastLevel',
      value: (f) => Math.min(f.num('spellcasting.maxSlotLevel'), 5)
    },
    {
      // Damage dice for the default cast: 2d8 for a free use (level 0) or L1,
      // then +1 per level above 1 (L2 -> 3, ... L5 -> 6). Zero when nothing is
      // castable — defaultLevel is also 0 there (no slots, no free use), so it
      // must not be mistaken for a free-use 2d8.
      fact: 'smite.defaultDieCount',
      value: (f) => {
        if (f.num('paladinSmite.remaining') > 0) return 2; // free use
        const slot = f.num('smite.lowestAvailableSlotLevel');
        return slot > 0 ? slot + 1 : 0; // a slot, else no resource
      }
    }
  ],
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'divine-smite',
      i18nPrefix: 'rule.spell-divine-smite',
      preparedFact: 'spell.l1.divineSmite.prepared',
      alwaysPreparedFact: 'spell.l1.divineSmite.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-divine-smite',
      when: (f) => f.num('spell.l1.divineSmite.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${D}.name`,
        description: `${D}.description`,
        detailKey: 'spell/divine-smite',
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          min: { fact: 'smite.minSlotLevel' },
          max: { fact: 'smite.maxCastLevel' },
          valueFormat: 'spellLevel'
        },
        secondaryControl: {
          type: 'dice-line',
          dice: [
            {
              sides: 8,
              count: { var: 'slotLevel', offset: 1, min: 2 },
              damageType: { string: RADIANT },
              purpose: 'damage'
            },
            {
              sides: 8,
              count: { var: 'slotLevel', offset: 2, min: 3 },
              label: `${D}.fiendUndeadLabel`,
              damageType: { string: RADIANT },
              purpose: 'damage'
            }
          ]
        },
        intents: { ATTACK: 'spells' },
        actionCost: ['bonus']
      },
      vars: { slotLevel: { capture: true, default: { fact: 'smite.defaultLevel' } } },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${D}.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('attack.last.activation.action') >= 1,
          diagnostics: [{ code: `${D}.no_attack`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('smite.anyResourceRemaining') > 0,
          diagnostics: [{ code: `${D}.no_resource`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${D}.no_spellcasting`, severity: 'error' }]
        }
      ],
      apply: (f: FactReader, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('smite.defaultLevel');

        // Bonus action + one-spell-per-turn are per-turn spends.
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          }
        ];
        const diagnostics: Diagnostic[] = [];

        if (level < 0 || level > 5) {
          // Divine Smite only handles levels 0 (free use) through 5; reject a
          // stale/tampered selection rather than consuming an out-of-range slot
          // (a multiclass full caster can own L6-9 slots).
          diagnostics.push({ code: `${D}.wrong_level`, severity: 'error' });
        } else if (level === 0) {
          // Free use: spend the once-per-long-rest charge, no slot.
          advertise.push({
            id: 'free',
            state: { 'paladinSmite.spent': 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num('paladinSmite.remaining') <= 0)
            diagnostics.push({ code: `${D}.no_free_use`, severity: 'error' });
        } else {
          advertise.push({
            id: `slot${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${D}.no_l${level}_slots`, severity: 'error' });
        }

        return { advertise, diagnostics };
      }
    }
  ],
  // Surface the "Divine Smite available" related-info on melee/unarmed attacks,
  // but only while it is actually castable this turn — prepared, an attack has
  // been taken, and a bonus action, the one-spell-per-turn, and a resource all
  // remain. Mirrors the legacy annotate-divine-smite gate exactly.
  annotate: (f: FactReader) =>
    f.num('spell.l1.divineSmite.prepared') === 1 &&
    f.num('bonusActions.remaining') > 0 &&
    f.num('attack.last.activation.action') >= 1 &&
    f.num('smite.anyResourceRemaining') > 0 &&
    f.num('spellcasting.remaining') > 0
      ? [{ key: 'rule.spell-divine-smite.annotation', targets: ['attack.melee', 'attack.unarmed'] }]
      : []
};

export default defineRule(divineSmite);
