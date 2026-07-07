import {
  defineRule,
  preparedSpellCount,
  preparedSpellOffers,
  statToModifier,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type Offer,
  type RuleModule,
  type Section
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
    // `active` is the raw summon flag; `summoned` is derived (active, not
    // dismissed, HP > 0) so a steed dropped to 0 HP vanishes on its own.
    'companion.steed.active': 1,
    'companion.steed.dismissed': 0,
    'companion.steed.creatureType': creatureType,
    'companion.steed.ac.value': 12 + (level - 2),
    'companion.steed.hp.base': hp,
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
    // Permanent, but a player-facing mount: `display` opts it onto the strip as a
    // MOUNT chip (effectUtils reads ui.section === 'mount').
    display: { name: 'rule.spell-find-steed.effect-steed.name', section: 'mount' },
    expiry: { kind: 'permanent' }
  };
}

const active = (f: FactReader): boolean => f.num('companion.steed.active') > 0;
const summoned = (f: FactReader): boolean => f.num('companion.steed.summoned') > 0;

// The steed's child HP effects, evicted (by key) when the steed is dismissed.
const STEED_CHILD_EFFECTS = [
  'effect-steed-hp-modifier-max',
  'effect-steed-hp-modifier-current',
  'effect-steed-hp-damage',
  'effect-steed-hp-heal'
] as const;

/** Per-turn spend on a steed resource (resets at end of turn). */
const steedSpend = (state: Record<string, number>): EffectInstance => ({
  id: 'steed-spend',
  state,
  expiry: { kind: 'endOfTurn' }
});

/** A steed action/bonus/reaction offer that spends its economy slot. */
function steedActivation(
  id: string,
  section: Section,
  costFact: string,
  remainingFact: string,
  intents: Record<string, string>,
  annotationLabels?: string[]
): Offer {
  const code = `${S}.${id}.no_actions`;
  return {
    id,
    when: summoned,
    ui: {
      section,
      subject: 'steed',
      name: `${S}.${id}.name`,
      description: `${S}.${id}.description`,
      intents,
      ...(annotationLabels ? { annotationLabels } : {}),
      actionCost: [section === 'bonus-action' ? 'bonus' : section]
    },
    legalWhen: [
      { condition: (f) => f.num(remainingFact) > 0, diagnostics: [{ code, severity: 'error' }] }
    ],
    apply: (f): ActionResult => ({
      advertise: [steedSpend({ [costFact]: 1 })],
      diagnostics: f.num(remainingFact) > 0 ? [] : [{ code, severity: 'error' }]
    })
  };
}

// creatureType → its special ability (bonus action, once per long rest), with
// the UI intent verb the ability files under (AID / MOVE / CONTROL).
const ABILITY_BY_TYPE: readonly (readonly [string, string, Record<string, string>])[] = [
  ['healing-touch', 'healingTouch', { AID: 'heal' }],
  ['fey-step', 'feyStep', { MOVE: 'travel' }],
  ['fell-glare', 'fellGlare', { CONTROL: 'single' }]
] as const;

/**
 * A creature-type special ability: a steed bonus action that spends the once-per-
 * long-rest pool, surfaced only for the matching creature type.
 */
function steedAbilityOffer(creatureType: number): Offer {
  const [id, pool, intents] = ABILITY_BY_TYPE[creatureType];
  const offerId = `steed-${id}`;
  const noBonus = `${S}.${offerId}.no_bonus_action`;
  const noUses = `${S}.${offerId}.no_uses`;
  return {
    id: offerId,
    when: (f) => summoned(f) && f.num('companion.steed.creatureType') === creatureType,
    ui: {
      section: 'bonus-action',
      subject: 'steed',
      name: `${S}.${offerId}.name`,
      description: `${S}.${offerId}.description`,
      intents,
      actionCost: ['bonus']
    },
    legalWhen: [
      {
        condition: (f) => f.num('companion.steed.bonusActions.remaining') > 0,
        diagnostics: [{ code: noBonus, severity: 'error' }]
      },
      {
        condition: (f) => f.num(`companion.steed.${pool}.remaining`) > 0,
        diagnostics: [{ code: noUses, severity: 'error' }]
      }
    ],
    apply: (f): ActionResult => {
      const diagnostics: Diagnostic[] = [];
      if (f.num('companion.steed.bonusActions.remaining') <= 0)
        diagnostics.push({ code: noBonus, severity: 'error' });
      if (f.num(`companion.steed.${pool}.remaining`) <= 0)
        diagnostics.push({ code: noUses, severity: 'error' });
      return {
        advertise: [
          steedSpend({ 'companion.steed.bonusActions.spent': 1 }),
          {
            id: `steed-${pool}-used`,
            state: { [`companion.steed.${pool}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          }
        ],
        diagnostics
      };
    }
  };
}

const STEED_SKILLS = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival'
] as const;

/** A free record/config offer the steed always has while summoned (no spend). */
const steedFreeOffer = (id: string, intent: Record<string, string>): Offer => ({
  id,
  when: summoned,
  ui: {
    section: 'free',
    subject: 'steed',
    name: `${S}.${id}.name`,
    intents: intent,
    actionCost: []
  }
});

/** Steed HP-modifier setter (keyed permanent — re-use replaces, matching the character's). */
function steedHpModifier(
  fact: string,
  effectId: string,
  id: string,
  min: number,
  max: number
): Offer {
  return {
    id,
    when: summoned,
    ui: {
      section: 'free',
      subject: 'steed',
      name: `${S}.${id}.name`,
      primaryControl: {
        type: 'slider',
        var: 'modifier',
        min: { number: min },
        max: { number: max }
      },
      intents: { HEALTH: 'hp' },
      actionCost: []
    },
    vars: { modifier: { capture: true, default: { number: 0 } } },
    apply: (_f, selections): ActionResult => ({
      advertise: [
        {
          id: effectId,
          key: effectId,
          state: { [fact]: typeof selections.modifier === 'number' ? selections.modifier : 0 },
          // Key shape: effect-steed-hp-* is named steed-effect-hp-* in i18n.
          display: {
            name: `${S}.${effectId.replace('effect-steed-', 'steed-effect-')}.name`,
            section: 'health',
            subject: 'steed'
          },
          expiry: { kind: 'permanent' }
        }
      ]
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
      preparedSpellCount({
        preparedFact: 'spell.l2.findSteed.prepared',
        alwaysPreparedFact: 'spell.l2.findSteed.alwaysPrepared'
      }),
      {
        fact: 'find-steed.eligibleSlotsRemaining',
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
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
          for (let n = 5; n >= 2; n--)
            if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      },
      {
        fact: 'find-steed.anyResourceRemaining',
        value: (f) =>
          f.num('find-steed.eligibleSlotsRemaining') + f.num('paladinFindSteed.remaining')
      },
      {
        fact: 'find-steed.defaultLevel',
        value: (f) =>
          f.num('paladinFindSteed.remaining') > 0 ? 0 : f.num('find-steed.lowestAvailableSlotLevel')
      }
    ];
    // Steed derives — only meaningful while active (all read 0 otherwise).
    for (const a of ABILITIES) {
      c.push({
        fact: `companion.steed.${a}.modifier`,
        value: (f) => (active(f) ? statToModifier(f.num(`companion.steed.${a}`)) : 0)
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
      value: (f) =>
        f.num('companion.steed.movement.base') * (f.num('companion.steed.dashed') > 0 ? 2 : 1)
    });
    c.push({
      fact: 'companion.steed.movement.remaining',
      value: (f) =>
        f.num('companion.steed.movement.total') - f.num('companion.steed.movement.spent')
    });
    // Ability pools: remaining = total − spent (spent persists until a long rest).
    for (const ability of ['healingTouch', 'feyStep', 'fellGlare'] as const) {
      c.push({
        fact: `companion.steed.${ability}.remaining`,
        value: (f) =>
          f.num(`companion.steed.${ability}.total`) - f.num(`companion.steed.${ability}.spent`)
      });
    }
    // HP: max = base + max-modifier; current = base + (negative) damage, capped at
    // base. A steed at 0 HP is no longer summoned (see below).
    c.push({
      fact: 'companion.steed.hp.max',
      value: (f) =>
        active(f) ? f.num('companion.steed.hp.base') + f.num('companion.steed.hp.modifier.max') : 0
    });
    c.push({
      fact: 'companion.steed.hp.current',
      value: (f) =>
        active(f)
          ? f.num('companion.steed.hp.base') +
            Math.min(0, f.num('companion.steed.hp.modifier.current'))
          : 0
    });
    // The damage/heal RECORDS accumulate in their own facts (each new record
    // bakes prior-total + amount into its ONE keyed effect — see
    // steed-record-damage below); their net feeds the current-HP modifier
    // alongside the manual setter effect (both combine by sum).
    c.push({
      fact: 'companion.steed.hp.modifier.current',
      combine: 'sum',
      value: (f) =>
        f.num('companion.steed.hp.healRecorded') - f.num('companion.steed.hp.damageRecorded')
    });
    c.push({
      fact: 'companion.steed.summoned',
      value: (f) =>
        active(f) &&
        f.num('companion.steed.dismissed') === 0 &&
        f.num('companion.steed.hp.current') > 0
          ? 1
          : 0
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
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('find-steed.defaultLevel');
        const creatureType =
          typeof selections.creatureType === 'number' ? selections.creatureType : 0;
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
          steedEffect(summonLevel, creatureType)
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (isFree) {
          advertise.push({
            id: 'free',
            state: { 'paladinFindSteed.spent': 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num('paladinFindSteed.remaining') <= 0)
            diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
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
      ui: {
        section: 'move',
        subject: 'steed',
        name: `${S}.steed-move-walk.name`,
        intents: { MOVE: 'travel' },
        actionCost: ['move']
      },
      legalWhen: [
        {
          condition: (f) => f.num('companion.steed.movement.remaining') >= 5,
          diagnostics: [{ code: `${S}.steed-move-walk.out_of_movement`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => ({
        advertise: [steedSpend({ 'companion.steed.movement.spent': 30 })],
        diagnostics:
          f.num('companion.steed.movement.remaining') >= 5
            ? []
            : [{ code: `${S}.steed-move-walk.out_of_movement`, severity: 'error' }]
      })
    },
    {
      id: 'steed-move-fly',
      when: summoned,
      ui: {
        section: 'move',
        subject: 'steed',
        name: `${S}.steed-move-fly.name`,
        intents: { MOVE: 'travel' },
        actionCost: ['move']
      },
      legalWhen: [
        {
          condition: (f) => f.num('companion.steed.fly.can') === 1,
          diagnostics: [{ code: `${S}.steed-move-fly.cannot_fly`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('companion.steed.movement.remaining') >= 5,
          diagnostics: [{ code: `${S}.steed-move-fly.out_of_movement`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('companion.steed.fly.can') !== 1)
          diagnostics.push({ code: `${S}.steed-move-fly.cannot_fly`, severity: 'error' });
        if (f.num('companion.steed.movement.remaining') < 5)
          diagnostics.push({ code: `${S}.steed-move-fly.out_of_movement`, severity: 'error' });
        return { advertise: [steedSpend({ 'companion.steed.movement.spent': 30 })], diagnostics };
      }
    },
    // Dash — spends the steed's action and doubles its movement this turn.
    {
      id: 'steed-dash',
      when: summoned,
      ui: {
        section: 'action',
        subject: 'steed',
        name: `${S}.steed-dash.name`,
        intents: { MOVE: 'dash' },
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) => f.num('companion.steed.actions.remaining') > 0,
          diagnostics: [{ code: `${S}.steed-dash.no_actions`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => ({
        advertise: [
          steedSpend({ 'companion.steed.actions.spent': 1, 'companion.steed.dashed': 1 })
        ],
        diagnostics:
          f.num('companion.steed.actions.remaining') > 0
            ? []
            : [{ code: `${S}.steed-dash.no_actions`, severity: 'error' }]
      })
    },
    steedActivation(
      'steed-dodge',
      'action',
      'companion.steed.actions.spent',
      'companion.steed.actions.remaining',
      { DEFEND: 'evade' }
    ),
    steedActivation(
      'steed-disengage',
      'action',
      'companion.steed.actions.spent',
      'companion.steed.actions.remaining',
      { DEFEND: 'evade' }
    ),
    // Slam — the steed's melee attack, as an action or a reaction.
    steedActivation(
      'steed-slam',
      'action',
      'companion.steed.actions.spent',
      'companion.steed.actions.remaining',
      { ATTACK: 'brawl' },
      ['attack.any', 'attack.melee']
    ),
    steedActivation(
      'steed-slam-reaction',
      'reaction',
      'companion.steed.reactions.spent',
      'companion.steed.reactions.remaining',
      { DEFEND: 'brawl' },
      ['attack.any', 'attack.melee']
    ),
    // Creature-type special abilities (only the matching type surfaces).
    steedAbilityOffer(0),
    steedAbilityOffer(1),
    steedAbilityOffer(2),
    // Saving throws, skill checks, and a note — the steed's record offers.
    ...ABILITIES.map((a) => steedFreeOffer(`steed-save-${a}`, { SAVE: 'steed' })),
    ...STEED_SKILLS.map((s) => steedFreeOffer(`steed-skill-${s}`, { CHECK: 'steed' })),
    steedFreeOffer('steed-note', { NOTE: 'freeform' }),
    // HP: manual max/current modifiers and a damage recorder.
    steedHpModifier(
      'companion.steed.hp.modifier.max',
      'effect-steed-hp-modifier-max',
      'steed-set-hp-modifier-max',
      -10,
      30
    ),
    steedHpModifier(
      'companion.steed.hp.modifier.current',
      'effect-steed-hp-modifier-current',
      'steed-set-hp-modifier-current',
      -30,
      30
    ),
    {
      id: 'steed-record-damage',
      when: summoned,
      ui: {
        section: 'free',
        subject: 'steed',
        name: `${S}.steed-record-damage.name`,
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: 'companion.steed.hp.max' },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      // Each record REPLACES the one keyed effect with the accumulated running
      // total (prior total + this amount) — records add up, while the dismiss
      // cascade still evicts by key and removing the single chip clears the
      // whole damage record. A same-key effect that merely carried its own
      // amount would evict the previous record instead of adding to it.
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        return {
          advertise: [
            {
              id: 'effect-steed-hp-damage',
              key: 'effect-steed-hp-damage',
              state: {
                'companion.steed.hp.damageRecorded':
                  f.num('companion.steed.hp.damageRecorded') + amount
              },
              display: {
                name: `${S}.steed-record-damage.effect.name`,
                section: 'health',
                subject: 'steed',
                displayFact: 'companion.steed.hp.damageRecorded'
              },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        };
      }
    },
    {
      id: 'steed-record-heal',
      when: summoned,
      ui: {
        section: 'free',
        subject: 'steed',
        name: `${S}.steed-record-heal.name`,
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: 'companion.steed.hp.max' },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      // Accumulates exactly like steed-record-damage above (one keyed effect
      // carrying the running heal total), but the total caps at the damage
      // recorded so far: healing beyond the missing HP is lost, never banked
      // against damage taken later (the modifier clamp only hides a surplus).
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        return {
          advertise: [
            {
              id: 'effect-steed-hp-heal',
              key: 'effect-steed-hp-heal',
              state: {
                'companion.steed.hp.healRecorded': Math.min(
                  f.num('companion.steed.hp.healRecorded') + amount,
                  f.num('companion.steed.hp.damageRecorded')
                )
              },
              display: {
                name: `${S}.steed-record-heal.effect.name`,
                section: 'health',
                subject: 'steed',
                displayFact: 'companion.steed.hp.healRecorded'
              },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        };
      }
    },
    // Dismiss — the steed vanishes (replaces the summon effect).
    {
      id: 'offer-dismiss-steed',
      when: summoned,
      ui: {
        section: 'other',
        subject: 'steed',
        name: `${S}.offer-dismiss-steed.name`,
        intents: { ACTION: 'steed' },
        actionCost: []
      },
      // Replaces the summon effect (same key) with a bare dismissed marker: `active`
      // drops, so `summoned` derives to 0 while `dismissed` reads 1. Also evicts the
      // steed's child HP effects via same-key empty effects.
      apply: (): ActionResult => ({
        advertise: [
          {
            id: 'effect-steed-dismissed',
            key: 'steed',
            state: { 'companion.steed.dismissed': 1 },
            expiry: { kind: 'permanent' }
          },
          ...STEED_CHILD_EFFECTS.map(
            (k): EffectInstance => ({ id: `evict-${k}`, key: k, expiry: { kind: 'permanent' } })
          )
        ]
      })
    }
  ],
  // The Life Bond feature — surfaced as an informational annotation while the
  // steed is summoned (damage the steed takes can be shared with the paladin).
  annotate: (f) =>
    // Rides the Record Healing panel: spell healing within 5 ft also
    // heals the steed, so the reminder targets `healing.any`, not a steed label.
    summoned(f) ? [{ key: `${S}.annotate-life-bond.text`, targets: ['healing.any'] }] : []
};

export default defineRule(findSteed);
