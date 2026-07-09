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
    // The slot level the steed was summoned at — persisted on the permanent
    // steed state so the slam / healing-touch damage-and-heal rollers can read it
    // on later turns (the cast's `find-steed.selectedLevel` is endOfTurn).
    'companion.steed.summonLevel': level,
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

// The distance slider both steed-move offers share, mirroring the player's own
// movement offers: record the actual feet moved rather than a fixed 30, so a
// 5- or 10-ft step doesn't consume half the 60-ft pool.
const STEED_MOVE_CONTROL = {
  type: 'slider',
  var: 'distance',
  max: { fact: 'companion.steed.movement.total' },
  step: 5,
  unit: 'ft'
} as const;
const STEED_MOVE_VARS = {
  distance: { capture: true, default: { fact: 'companion.steed.movement.remaining' } }
} as const;
/** Feet to spend for a steed move: the captured distance, else all remaining. */
const steedMoveDistance = (f: FactReader, selections: Record<string, unknown>): number =>
  typeof selections.distance === 'number'
    ? selections.distance
    : f.num('companion.steed.movement.remaining');

// Otherworldly Slam's rollable dice panel, shared by the action and reaction
// copies: d20 + the steed's slam hit bonus to hit; 1d8 + spell level damage,
// typed by the steed's creature type (the string label is synthesized view-side
// from the numeric creatureType, since engine facts are numeric).
const STEED_SLAM_CONTROL = {
  type: 'dice-line',
  ranges: [{ distance: 5, type: 'melee' }],
  dice: [
    { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
    {
      sides: { var: 'damageDie' },
      bonus: { var: 'damageBonus' },
      purpose: 'damage',
      damageType: { fact: 'companion.steed.damageType' }
    }
  ]
} as const;
const STEED_SLAM_VARS = {
  hitBonus: { capture: true, default: { fact: 'companion.steed.slam.hitBonus' } },
  damageDie: { default: { number: 8 } },
  // The persistent summon level (not the endOfTurn cast fact) so slam damage is
  // 1d8 + level on every turn, not +0 after the cast turn.
  damageBonus: { capture: true, default: { fact: 'companion.steed.summonLevel' } }
} as const;

/**
 * The Otherworldly Slam offer (action or reaction). A rollable attack panel, not
 * the bare `steedActivation` row: both copies reuse the `steed-slam.*` i18n keys
 * (the reaction must not reference unauthored `steed-slam-reaction.*`), carry the
 * shared dice-line + vars, and fill the description's `{{damageType}}` from the
 * synthesized damage-type fact. `legalCode` is `no_actions` / `no_reaction`.
 */
function steedSlamOffer(
  id: string,
  section: Section,
  costFact: string,
  remainingFact: string,
  intents: Record<string, string>,
  legalCode: string
): Offer {
  const code = `${S}.steed-slam.${legalCode}`;
  return {
    id,
    when: summoned,
    ui: {
      section,
      subject: 'steed',
      name: `${S}.steed-slam.name`,
      description: `${S}.steed-slam.description`,
      descriptionValues: { damageType: { fact: 'companion.steed.damageType' } },
      detailKey: 'action/otherworldly-slam',
      intents,
      actionCost: [section === 'reaction' ? 'reaction' : section],
      annotationLabels: ['attack.any', 'attack.melee'],
      primaryControl: STEED_SLAM_CONTROL
    },
    vars: STEED_SLAM_VARS,
    legalWhen: [
      { condition: (f) => f.num(remainingFact) > 0, diagnostics: [{ code, severity: 'error' }] }
    ],
    apply: (f): ActionResult => ({
      advertise: [steedSpend({ [costFact]: 1 })],
      diagnostics: f.num(remainingFact) > 0 ? [] : [{ code, severity: 'error' }]
    })
  };
}

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

// Healing Touch heals 2d8 + spell level; the roller reads the persistent summon
// level. Fey Step (teleport) and Fell Glare (a WIS save) carry no roller here.
const HEAL_TOUCH_CONTROL = {
  type: 'dice-line',
  dice: [{ sides: 8, count: 2, bonus: { var: 'spellLevel' }, purpose: 'healing' }]
} as const;
const HEAL_TOUCH_VARS = {
  spellLevel: { capture: true, default: { fact: 'companion.steed.summonLevel' } }
};

/** A creature-type special ability (bonus action, once per long rest). */
interface AbilityConfig {
  id: string;
  /** The once-per-long-rest pool fact stem, e.g. `healingTouch`. */
  pool: string;
  intents: Record<string, string>;
  /** Optional roll control + vars (Healing Touch's 2d8 + level heal line). */
  primaryControl?: Record<string, unknown>;
  vars?: Record<string, unknown>;
}
// creatureType → its special ability, with the UI intent verb it files under.
const ABILITY_BY_TYPE: readonly AbilityConfig[] = [
  {
    id: 'healing-touch',
    pool: 'healingTouch',
    intents: { AID: 'heal' },
    primaryControl: HEAL_TOUCH_CONTROL,
    vars: HEAL_TOUCH_VARS
  },
  { id: 'fey-step', pool: 'feyStep', intents: { MOVE: 'travel' } },
  { id: 'fell-glare', pool: 'fellGlare', intents: { CONTROL: 'single' } }
];

/**
 * A creature-type special ability: a steed bonus action that spends the once-per-
 * long-rest pool, surfaced only for the matching creature type.
 */
function steedAbilityOffer(creatureType: number): Offer {
  const { id, pool, intents, primaryControl, vars } = ABILITY_BY_TYPE[creatureType];
  const offerId = `steed-${id}`;
  const noBonus = `${S}.${offerId}.no_bonus_action`;
  const noUses = `${S}.${offerId}.no_uses`;
  return {
    id: offerId,
    when: (f) => summoned(f) && f.num('companion.steed.creatureType') === creatureType,
    ...(vars ? { vars } : {}),
    ui: {
      section: 'bonus-action',
      subject: 'steed',
      name: `${S}.${offerId}.name`,
      description: `${S}.${offerId}.description`,
      ...(primaryControl ? { primaryControl } : {}),
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

// The outcome picker shared by every recorded save (none / passed / failed).
const SAVE_OUTCOME_CONTROL = {
  type: 'segmented',
  var: 'passed',
  options: [
    { value: -1, label: 'planner.record.outcome.none' },
    { value: 1, label: 'planner.record.passed' },
    { value: 0, label: 'planner.record.failed' }
  ]
} as const;

/**
 * A steed save recorder: a d20 + the steed's save bonus, with a pass/fail
 * outcome — the same shape as the player's `record-save-*`, reusing the shared
 * `planner.record.save.*` name key (a bare row exposed no roller). UI-only (no
 * spend), like the player's check/note recorders.
 */
const steedSaveOffer = (a: (typeof ABILITIES)[number]): Offer => ({
  id: `steed-save-${a}`,
  when: summoned,
  ui: {
    section: 'free',
    subject: 'steed',
    name: `planner.record.save.${a}`,
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'save' }]
    },
    secondaryControl: SAVE_OUTCOME_CONTROL,
    intents: { SAVE: 'steed' },
    actionCost: []
  },
  vars: {
    rollBonus: { capture: true, default: { fact: `companion.steed.${a}.save` } },
    passed: { capture: true, default: { number: -1 } }
  }
});

// Each steed skill rolls its governing ability's modifier (steeds have no skill
// proficiencies), reusing the shared `play.stats.skills.*` name key.
const SKILL_ABILITY: Record<(typeof STEED_SKILLS)[number], (typeof ABILITIES)[number]> = {
  acrobatics: 'dex',
  'animal-handling': 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  'sleight-of-hand': 'dex',
  stealth: 'dex',
  survival: 'wis'
};

/** A steed skill-check recorder: a d20 + the governing ability modifier. */
const steedSkillOffer = (skill: (typeof STEED_SKILLS)[number]): Offer => ({
  id: `steed-skill-${skill}`,
  when: summoned,
  ui: {
    section: 'free',
    subject: 'steed',
    name: `play.stats.skills.${skill}`,
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }]
    },
    intents: { CHECK: 'steed' },
    actionCost: []
  },
  vars: {
    rollBonus: {
      capture: true,
      default: { fact: `companion.steed.${SKILL_ABILITY[skill]}.modifier` }
    }
  }
});

/** A steed freeform note recorder: a multiline text box (player note shape). */
const steedNoteOffer = (): Offer => ({
  id: 'steed-note',
  when: summoned,
  ui: {
    section: 'free',
    subject: 'steed',
    name: `${S}.steed-note.name`,
    primaryControl: { type: 'text', var: 'text', multiline: true },
    intents: { NOTE: 'freeform' },
    actionCost: []
  },
  vars: { text: { capture: true, default: { string: '' } } }
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
    // Otherworldly Slam is a spell attack: to-hit = the caster's CHA modifier +
    // proficiency bonus (the steed's slam dice-line reads this).
    c.push({
      fact: 'companion.steed.slam.hitBonus',
      value: (f) => f.num('cha.modifier') + f.num('proficiency.bonus')
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
      // base + (negative) damage, CLAMPED at the derived max (legacy clamped the
      // same way): a negative max-HP modifier caps current so the steed is never
      // healthier than its maximum (no impossible 25/15), while a positive max
      // modifier doesn't auto-heal it above its base.
      value: (f) =>
        active(f)
          ? Math.min(
              f.num('companion.steed.hp.max'),
              f.num('companion.steed.hp.base') +
                Math.min(0, f.num('companion.steed.hp.modifier.current'))
            )
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
        // Slot-level slider (the free use, if the paladin has it, plus each owned
        // L2–5 slot) and the creature-type picker — without these the cast always
        // committed the captured defaults (free/lowest slot, celestial).
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          // `notches` (PanelSlider's key for explicit choices — NOT `values`, which
          // it ignores) so the slider offers the free use + each owned L2–5 slot;
          // `spellLevel` renders 0 as "Free Use".
          notches: [
            { value: 0, enabled: { fact: 'paladinFindSteed.total' } },
            { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
            { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
            { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } },
            { value: 5, enabled: { fact: 'spellcasting.slots.level5.total' } }
          ],
          valueFormat: 'spellLevel'
        },
        secondaryControl: {
          type: 'segmented',
          var: 'creatureType',
          options: [
            { value: 0, label: `${O}.creature-type.celestial` },
            { value: 1, label: `${O}.creature-type.fey` },
            { value: 2, label: `${O}.creature-type.fiend` }
          ]
        },
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
          steedEffect(summonLevel, creatureType),
          // Evict any previous steed's keyed child HP effects (damage/heal/
          // modifiers persist untilLongRest) so a recast starts fresh rather than
          // inheriting the old steed's damage — the same keys dismissing evicts.
          ...STEED_CHILD_EFFECTS.map(
            (k): EffectInstance => ({ id: `evict-${k}`, key: k, expiry: { kind: 'permanent' } })
          )
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
    // Movement — walk always; fly only if the steed can fly. Each records the
    // captured distance (defaulting to all remaining) via the shared slider.
    {
      id: 'steed-move-walk',
      when: summoned,
      ui: {
        section: 'move',
        subject: 'steed',
        name: `${S}.steed-move-walk.name`,
        primaryControl: STEED_MOVE_CONTROL,
        intents: { MOVE: 'travel' },
        actionCost: ['move']
      },
      vars: STEED_MOVE_VARS,
      legalWhen: [
        {
          condition: (f) => f.num('companion.steed.movement.remaining') >= 5,
          diagnostics: [{ code: `${S}.steed-move-walk.out_of_movement`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => ({
        advertise: [
          steedSpend({ 'companion.steed.movement.spent': steedMoveDistance(f, selections) })
        ],
        // Validate the SELECTED distance, not a fixed 5 ft — selecting more than
        // remains must error rather than drive movement negative.
        diagnostics:
          f.num('companion.steed.movement.remaining') >= steedMoveDistance(f, selections)
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
        primaryControl: STEED_MOVE_CONTROL,
        intents: { MOVE: 'travel' },
        actionCost: ['move']
      },
      vars: STEED_MOVE_VARS,
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
      apply: (f, selections): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('companion.steed.fly.can') !== 1)
          diagnostics.push({ code: `${S}.steed-move-fly.cannot_fly`, severity: 'error' });
        // Validate the SELECTED distance (see steed-move-walk).
        if (f.num('companion.steed.movement.remaining') < steedMoveDistance(f, selections))
          diagnostics.push({ code: `${S}.steed-move-fly.out_of_movement`, severity: 'error' });
        return {
          advertise: [
            steedSpend({ 'companion.steed.movement.spent': steedMoveDistance(f, selections) })
          ],
          diagnostics
        };
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
    // Slam — the steed's rollable melee attack, as an action or a reaction.
    steedSlamOffer(
      'steed-slam',
      'action-attack',
      'companion.steed.actions.spent',
      'companion.steed.actions.remaining',
      { ATTACK: 'brawl' },
      'no_actions'
    ),
    steedSlamOffer(
      'steed-slam-reaction',
      'reaction',
      'companion.steed.reactions.spent',
      'companion.steed.reactions.remaining',
      { DEFEND: 'brawl' },
      'no_reaction'
    ),
    // Creature-type special abilities (only the matching type surfaces).
    steedAbilityOffer(0),
    steedAbilityOffer(1),
    steedAbilityOffer(2),
    // Saving throws, skill checks, and a note — the steed's record offers.
    ...ABILITIES.map(steedSaveOffer),
    ...STEED_SKILLS.map(steedSkillOffer),
    steedNoteOffer(),
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
    // Dismiss — the steed vanishes (replaces the summon effect). Costs the
    // caster's action (as legacy did).
    {
      id: 'offer-dismiss-steed',
      when: summoned,
      ui: {
        section: 'action',
        subject: 'steed',
        name: `${S}.offer-dismiss-steed.name`,
        // HANDLE (a valid Verb): the add picker drops offers whose intent verb
        // isn't in the Verb union — `ACTION` isn't, so Dismiss vanished from it.
        intents: { HANDLE: 'steed' },
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${S}.offer-dismiss-steed.no_action`, severity: 'error' }]
        }
      ],
      // Replaces the summon effect (same key) with a bare dismissed marker: `active`
      // drops, so `summoned` derives to 0 while `dismissed` reads 1. Also evicts the
      // steed's child HP effects via same-key empty effects. Spends the action.
      apply: (f): ActionResult => ({
        advertise: [
          { id: 'cost', state: { 'actions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          {
            id: 'effect-steed-dismissed',
            key: 'steed',
            state: { 'companion.steed.dismissed': 1 },
            expiry: { kind: 'permanent' }
          },
          ...STEED_CHILD_EFFECTS.map(
            (k): EffectInstance => ({ id: `evict-${k}`, key: k, expiry: { kind: 'permanent' } })
          )
        ],
        diagnostics:
          f.num('actions.remaining') > 0
            ? []
            : [{ code: `${S}.offer-dismiss-steed.no_action`, severity: 'error' }]
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
