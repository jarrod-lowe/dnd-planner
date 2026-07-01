import {
  defineRule,
  preparedSpellOffers,
  statToModifier,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type Offer,
  type RuleModule
} from '../builder';

const LEVELS = [2, 3, 4, 5] as const;
const O = 'rule.spell-find-steed.offer-find-steed';
const S = 'rule.spell-find-steed';
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

// The Otherworldly Steed's physical stat block is the same for every creature
// type; only the damage type, the granted special ability, and (at higher levels)
// flight differ. HP and AC scale with the slot level the spell was cast at.
const SCORES: Record<(typeof ABILITIES)[number], number> = {
  str: 18,
  dex: 12,
  con: 14,
  int: 6,
  wis: 12,
  cha: 8
};
/** The steed's baked stats for a summon at slot `level` and `creatureType`. */
function steedStats(level: number, creatureType: number): Record<string, number> {
  const hp = 25 + (level - 2) * 10;
  const canFly = level >= 4 ? 1 : 0;
  const state: Record<string, number> = {
    'companion.steed.summoned': 1,
    'companion.steed.dismissed': 0,
    'companion.steed.creatureType': creatureType,
    'companion.steed.ac.value': 12 + (level - 2),
    'companion.steed.hp.max': hp,
    'companion.steed.speed': 60,
    'companion.steed.movement.base': 60,
    'companion.steed.actions.max': 1,
    'companion.steed.bonusActions.max': 1,
    'companion.steed.reactions.max': 1,
    'companion.steed.fly.can': canFly,
    'companion.steed.speed.fly': canFly ? 60 : 0,
    // All ability pools are baked; only the matching creature-type offer surfaces.
    'companion.steed.healingTouch.total': 1,
    'companion.steed.feyStep.total': 1,
    'companion.steed.fellGlare.total': 1
  };
  for (const a of ABILITIES) state[`companion.steed.${a}`] = SCORES[a];
  return state;
}

/**
 * The steed's summon effect (permanent, keyed so a re-cast/dismiss replaces it).
 * Exported so the parity harness can reproduce an "already-summoned" steed.
 */
export function steedEffect(level: number, creatureType: number): EffectInstance {
  return {
    id: 'effect-steed',
    key: 'steed',
    state: steedStats(level, creatureType),
    expiry: { kind: 'permanent' }
  };
}

const summoned = (f: FactReader): boolean => f.num('companion.steed.summoned') > 0;

/** Per-turn spend on a steed resource (resets at end of turn). */
const steedSpend = (state: Record<string, number>): EffectInstance => ({
  id: 'steed-spend',
  state,
  expiry: { kind: 'endOfTurn' }
});

/** A steed action/bonus/reaction offer that spends its economy slot. */
function steedActivation(id: string, section: string, costFact: string, remainingFact: string): Offer {
  const code = `${S}.${id}.no_actions`;
  return {
    id,
    when: summoned,
    ui: { section, subject: 'steed', name: `${S}.${id}.name`, description: `${S}.${id}.description`, intents: { ACTION: 'steed' }, actionCost: [section === 'bonus-action' ? 'bonus' : section] },
    legalWhen: [{ condition: (f) => f.num(remainingFact) > 0, diagnostics: [{ code, severity: 'error' }] }],
    apply: (f): ActionResult => ({
      advertise: [steedSpend({ [costFact]: 1 })],
      diagnostics: f.num(remainingFact) > 0 ? [] : [{ code, severity: 'error' }]
    })
  };
}

/**
 * Find Steed — a Level 2 conjuration that summons an Otherworldly Steed companion
 * (`companion.steed.*`, a namespaced sub-entity). The cast bakes the steed's whole
 * stat block — scaled by slot level, flavoured by a chosen creature type
 * (celestial / fey / fiend) — into a permanent `effect-steed`; its per-turn action
 * economy, movement, saves and modifiers are then derived (so they reset each
 * turn) and its actions surface as offers gated on the steed being summoned.
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
          return LEVELS[0];
        }
      },
      {
        fact: 'find-steed.highestSlotLevel',
        value: (f) => {
          for (let n = 5; n >= 2; n--) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      },
      {
        fact: 'find-steed.anyResourceRemaining',
        value: (f) => f.num('find-steed.eligibleSlotsRemaining') + f.num('paladinFindSteed.remaining')
      },
      {
        fact: 'find-steed.defaultLevel',
        value: (f) =>
          f.num('paladinFindSteed.remaining') > 0 ? 0 : f.num('find-steed.lowestAvailableSlotLevel')
      }
    ];
    // Steed derives — only meaningful while summoned (all read 0 otherwise).
    for (const a of ABILITIES) {
      c.push({
        fact: `companion.steed.${a}.modifier`,
        value: (f) => (summoned(f) ? statToModifier(f.num(`companion.steed.${a}`)) : 0)
      });
      c.push({
        fact: `companion.steed.${a}.save`,
        value: (f) => f.num(`companion.steed.${a}.modifier`)
      });
    }
    // Action economy resets each turn: remaining = max − spent.
    for (const r of ['actions', 'bonusActions', 'reactions'] as const) {
      c.push({
        fact: `companion.steed.${r}.remaining`,
        value: (f) => f.num(`companion.steed.${r}.max`) - f.num(`companion.steed.${r}.spent`)
      });
    }
    // Movement: Dash doubles the base; remaining = total − spent.
    c.push({
      fact: 'companion.steed.movement.total',
      value: (f) => f.num('companion.steed.movement.base') * (f.num('companion.steed.dashed') > 0 ? 2 : 1)
    });
    c.push({
      fact: 'companion.steed.movement.remaining',
      value: (f) => f.num('companion.steed.movement.total') - f.num('companion.steed.movement.spent')
    });
    // Ability pools: remaining = total − spent (spent persists until a long rest).
    for (const ability of ['healingTouch', 'feyStep', 'fellGlare'] as const) {
      c.push({
        fact: `companion.steed.${ability}.remaining`,
        value: (f) => f.num(`companion.steed.${ability}.total`) - f.num(`companion.steed.${ability}.spent`)
      });
    }
    // Current HP tracks the max plus any (negative) damage modifier, capped at max.
    c.push({
      fact: 'companion.steed.hp.current',
      value: (f) =>
        summoned(f) ? f.num('companion.steed.hp.max') + Math.min(0, f.num('companion.steed.hp.modifier.current')) : 0
    });
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
      vars: {
        slotLevel: { capture: true, default: { fact: 'find-steed.defaultLevel' } },
        creatureType: { capture: true, default: { number: 0 } }
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
          condition: (f) => f.num('find-steed.anyResourceRemaining') > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number' ? selections.slotLevel : f.num('find-steed.defaultLevel');
        const creatureType = typeof selections.creatureType === 'number' ? selections.creatureType : 0;
        const isFree = level === 0;
        const summonLevel = isFree ? 2 : level; // the free use summons an L2 steed
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1, 'find-steed.selectedLevel': summonLevel, 'find-steed.wasFreeUse': isFree ? 1 : 0 },
            expiry: { kind: 'endOfTurn' }
          },
          steedEffect(summonLevel, creatureType)
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
            id: `effect-steed-slot-l${level}`,
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
    },
    // Movement — walk always; fly only if the steed can fly. Each spends 30 ft.
    {
      id: 'steed-move-walk',
      when: summoned,
      ui: { section: 'move', subject: 'steed', name: `${S}.steed-move-walk.name`, intents: { MOVE: 'travel' }, actionCost: ['move'] },
      legalWhen: [{ condition: (f) => f.num('companion.steed.movement.remaining') >= 5, diagnostics: [{ code: `${S}.steed-move-walk.out_of_movement`, severity: 'error' }] }],
      apply: (f): ActionResult => ({ advertise: [steedSpend({ 'companion.steed.movement.spent': 30 })], diagnostics: f.num('companion.steed.movement.remaining') >= 5 ? [] : [{ code: `${S}.steed-move-walk.out_of_movement`, severity: 'error' }] })
    },
    {
      id: 'steed-move-fly',
      when: summoned,
      ui: { section: 'move', subject: 'steed', name: `${S}.steed-move-fly.name`, intents: { MOVE: 'travel' }, actionCost: ['move'] },
      legalWhen: [
        { condition: (f) => f.num('companion.steed.fly.can') === 1, diagnostics: [{ code: `${S}.steed-move-fly.cannot_fly`, severity: 'error' }] },
        { condition: (f) => f.num('companion.steed.movement.remaining') >= 5, diagnostics: [{ code: `${S}.steed-move-fly.out_of_movement`, severity: 'error' }] }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('companion.steed.fly.can') !== 1) diagnostics.push({ code: `${S}.steed-move-fly.cannot_fly`, severity: 'error' });
        if (f.num('companion.steed.movement.remaining') < 5) diagnostics.push({ code: `${S}.steed-move-fly.out_of_movement`, severity: 'error' });
        return { advertise: [steedSpend({ 'companion.steed.movement.spent': 30 })], diagnostics };
      }
    },
    // Dash — spends the steed's action and doubles its movement this turn.
    {
      id: 'steed-dash',
      when: summoned,
      ui: { section: 'action', subject: 'steed', name: `${S}.steed-dash.name`, intents: { ACTION: 'steed' }, actionCost: ['action'] },
      legalWhen: [{ condition: (f) => f.num('companion.steed.actions.remaining') > 0, diagnostics: [{ code: `${S}.steed-dash.no_action`, severity: 'error' }] }],
      apply: (f): ActionResult => ({ advertise: [steedSpend({ 'companion.steed.actions.spent': 1, 'companion.steed.dashed': 1 })], diagnostics: f.num('companion.steed.actions.remaining') > 0 ? [] : [{ code: `${S}.steed-dash.no_action`, severity: 'error' }] })
    },
    steedActivation('steed-dodge', 'action', 'companion.steed.actions.spent', 'companion.steed.actions.remaining'),
    steedActivation('steed-disengage', 'action', 'companion.steed.actions.spent', 'companion.steed.actions.remaining'),
    // Dismiss — the steed vanishes (replaces the summon effect).
    {
      id: 'offer-dismiss-steed',
      when: summoned,
      ui: { section: 'other', subject: 'steed', name: `${S}.offer-dismiss-steed.name`, intents: { ACTION: 'steed' }, actionCost: [] },
      apply: (): ActionResult => ({
        advertise: [{ id: 'effect-steed-dismissed', key: 'steed', state: { 'companion.steed.summoned': 0, 'companion.steed.dismissed': 1 }, expiry: { kind: 'permanent' } }]
      })
    }
  ]
};

export default defineRule(findSteed);
