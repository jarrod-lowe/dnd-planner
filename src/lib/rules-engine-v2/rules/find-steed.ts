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
const O = 'rule.spell-find-steed.offer-find-steed';

/**
 * Find Steed — a Level 2 action spell that summons a companion steed. The steed
 * lives as `companion.steed.*` facts (a namespaced sub-entity in the same store),
 * summoned by a PERMANENT `effect-steed`. Casting spends an action and the turn's
 * spell, plus either the once-per-long-rest free use (level 0, from the paladin
 * feature) or an L2–5 slot; the free use summons an L2 steed.
 *
 * Only the L2 summon (25 HP, AC 12) is exercised by a runnable scenario; the full
 * per-level / per-creature-type stat block and the steed's own action economy are
 * initialEffects-only in v1, so they are not modelled here.
 */
const findSteed: RuleModule = {
  id: 'spell-find-steed',
  meta: {
    name: `${O}.name`,
    description: `${O}.description`,
    keywords: `${O}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => {
    const c: Contribution[] = [
      {
        fact: 'find-steed.eligibleSlotsRemaining',
        value: (f) => LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: 'find-steed.lowestAvailableSlotLevel',
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      },
      {
        fact: 'find-steed.anyResourceRemaining',
        value: (f) => f.num('find-steed.eligibleSlotsRemaining') + f.num('paladinFindSteed.remaining')
      },
      {
        // Default to the free use when available, else the lowest slot.
        fact: 'find-steed.defaultLevel',
        value: (f) =>
          f.num('paladinFindSteed.remaining') > 0 ? 0 : f.num('find-steed.lowestAvailableSlotLevel')
      }
    ];
    return c;
  },
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'find-steed',
      i18nPrefix: 'rule.spell-find-steed',
      preparedFact: 'spell.l2.findSteed.prepared',
      alwaysPreparedFact: 'spell.l2.findSteed.alwaysPrepared',
      intentLevel: 'L2'
    }),
    {
      id: 'cast-find-steed',
      when: (f) => f.num('spell.l2.findSteed.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${O}.name`,
        description: `${O}.description`,
        detailKey: 'spell/find-steed',
        intents: { AID: 'ally' },
        actionCost: ['action', 'L2']
      },
      vars: { slotLevel: { capture: true, default: { fact: 'find-steed.defaultLevel' } } },
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
          condition: (f) => f.num('find-steed.anyResourceRemaining') > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number' ? selections.slotLevel : f.num('find-steed.defaultLevel');
        const isFree = level === 0;
        const summonLevel = isFree ? 2 : level; // the free use summons an L2 steed
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: {
              'actions.spent': 1,
              'spellcasting.spent': 1,
              'find-steed.selectedLevel': summonLevel,
              'find-steed.wasFreeUse': isFree ? 1 : 0
            },
            expiry: { kind: 'endOfTurn' }
          },
          // The steed: a permanent summon with L2 stats.
          {
            id: 'effect-steed',
            key: 'steed',
            state: {
              'companion.steed.summoned': 1,
              'companion.steed.ac.value': 12,
              'companion.steed.hp.max': 25,
              'companion.steed.hp.current': 25
            },
            expiry: { kind: 'permanent' }
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0) diagnostics.push({ code: `${O}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (isFree) {
          advertise.push({ id: 'free', state: { 'paladinFindSteed.spent': 1 }, expiry: { kind: 'untilLongRest' } });
          if (f.num('paladinFindSteed.remaining') <= 0) diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        } else if (level >= 2 && level <= 5) {
          advertise.push({
            id: `effect-find-steed-slot-l${level}`,
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

export default defineRule(findSteed);
