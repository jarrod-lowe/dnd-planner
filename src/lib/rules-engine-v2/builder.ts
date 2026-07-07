import type {
  ActionResult,
  Contribution,
  Diagnostic,
  EffectInstance,
  FactReader,
  LegalWhen,
  Offer,
  RuleModule
} from './types';

/** Pure, deterministic helpers that are part of the authoring toolkit. */
export { statToModifier } from './functions';

const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';
/** A BUILD offer is illegal while the build is locked (the build-lock group). */
const notLockedLegal: LegalWhen = {
  condition: (f) => f.num('build.locked') === 0,
  diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
};

/**
 * The prepare / unprepare offer pair shared by every prepared spell.
 *
 * - prepare: legal while not locked, not already prepared, and under the prepared
 *   limit (`spellcasting.prepared.remaining > 0`). It advertises a PERMANENT keyed
 *   effect setting the spell's `prepared` fact (via `max`, so it composes with a
 *   class always-prepared grant) and `spellcasting.prepared.count += 1` — except
 *   an always-prepared spell is free, so it adds 0 to the count.
 * - unprepare: legal while not locked, prepared, and NOT always-prepared. It
 *   advertises a same-key empty PERMANENT effect that evicts the prepare effect
 *   (newest-wins dedupe), dropping `prepared` and the count contribution.
 *
 * `alwaysPreparedFact` is read for the count gate / unprepare legality; for a
 * spell no feature ever grants, it is simply absent (0).
 */
export function preparedSpellOffers(opts: {
  /** The spell id used in offer ids / i18n keys, e.g. `divine-smite`. */
  spellId: string;
  /** i18n prefix for the offers, e.g. `rule.spell-divine-smite`. */
  i18nPrefix: string;
  /** The spell's prepared fact, e.g. `spell.l1.divineSmite.prepared`. */
  preparedFact: string;
  /** The always-prepared fact, e.g. `spell.l1.divineSmite.alwaysPrepared`. */
  alwaysPreparedFact: string;
  /** The PREPARE intent level shown in the UI, e.g. `L1`. */
  intentLevel: string;
}): Offer[] {
  const { spellId, i18nPrefix, preparedFact, alwaysPreparedFact, intentLevel } = opts;
  const prepareId = `prepare-${spellId}`;
  const unprepareId = `unprepare-${spellId}`;
  const key = `prep:${spellId}`;
  const alreadyPrepared = `${i18nPrefix}.${prepareId}-offer.already_prepared`;
  const maxPrepared = `${i18nPrefix}.${prepareId}-offer.max_prepared`;
  const notPrepared = `${i18nPrefix}.${unprepareId}-offer.not_prepared`;
  const alwaysPreparedCode = `${i18nPrefix}.${unprepareId}-offer.always_prepared`;

  return [
    {
      id: prepareId,
      ui: {
        section: 'configuration',
        name: `${i18nPrefix}.${prepareId}-offer.name`,
        intents: { PREPARE: intentLevel },
        actionCost: []
      },
      legalWhen: [
        notLockedLegal,
        {
          condition: (f) => f.num(preparedFact) !== 1,
          diagnostics: [{ code: alreadyPrepared, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.prepared.remaining') > 0,
          diagnostics: [{ code: maxPrepared, severity: 'error' }]
        }
      ],
      apply: (f) => {
        const diagnostics: Diagnostic[] = [];
        if (f.num(preparedFact) === 1)
          diagnostics.push({ code: alreadyPrepared, severity: 'error' });
        if (f.num('spellcasting.prepared.remaining') <= 0)
          diagnostics.push({ code: maxPrepared, severity: 'error' });
        // An always-prepared spell is free — it doesn't count against the limit.
        const count = f.num(alwaysPreparedFact) > 0 ? 0 : 1;
        return {
          advertise: [
            {
              id: 'prepared',
              key,
              state: { [preparedFact]: 1, 'spellcasting.prepared.count': count },
              stateCombine: { [preparedFact]: 'max' },
              // Named for the strip's reveal toggle, hidden from the default view
              // (v1 parity: effect-<spell>-prepared carried ui.name + hidden).
              display: { name: `${i18nPrefix}.effect-${spellId}-prepared.name`, hidden: true },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    },
    {
      id: unprepareId,
      ui: {
        section: 'configuration',
        name: `${i18nPrefix}.${unprepareId}-offer.name`,
        intents: { PREPARE: intentLevel },
        actionCost: []
      },
      legalWhen: [
        notLockedLegal,
        {
          condition: (f) => f.num(preparedFact) === 1,
          diagnostics: [{ code: notPrepared, severity: 'error' }]
        },
        {
          condition: (f) => f.num(alwaysPreparedFact) !== 1,
          diagnostics: [{ code: alwaysPreparedCode, severity: 'error' }]
        }
      ],
      apply: (f) => {
        const diagnostics: Diagnostic[] = [];
        if (f.num(preparedFact) !== 1) diagnostics.push({ code: notPrepared, severity: 'error' });
        if (f.num(alwaysPreparedFact) === 1)
          diagnostics.push({ code: alwaysPreparedCode, severity: 'error' });
        // Same key, no state → evicts the prepare effect (prepared & count drop).
        return {
          advertise: [{ id: 'unprepared', key, expiry: { kind: 'permanent' } }],
          diagnostics
        };
      }
    }
  ];
}

// === Weapons ===
//
// v1 generated a weapon's rules by a Python preprocessor that crossed weapon
// *definitions* (dagger, greataxe, …) with reusable *profiles* (don, use as an
// action / reaction / bonus-action) into per-weapon rule groups. In v2 a weapon
// is one self-contained module whose `offer` calls `weaponOffers(def)` — the
// cross-product is a plain function over data, so the preprocessor's job (and the
// `$(definition.id)` string interpolation it needed) collapses into types and
// template literals here. The shared i18n prefix is the same one v1 used.

const ATTACKS = 'rule.dnd-5e-2024.attacks';
const WEAPON_DON = 'rule.dnd-5e-2024.weapon-don';
const NO_ACTION = `${ATTACKS}.activation.no_action`;
const NO_REACTION = `${ATTACKS}.activation.no_reaction`;
const NO_BONUS_ACTION = `${ATTACKS}.activation.no_bonus_action`;
const VERSATILE_NO_FREE_HAND = `${ATTACKS}.versatile.no-free-hand`;

/** A versatile weapon has a two-handed band that costs an extra hand. */
const isVersatile = (def: WeaponDef): boolean => def.ranges.some((r) => (r.extraHands ?? 0) > 0);
// BUILD_LOCKED is declared above (shared with the prepared-spell offers).

/** One reach/throw band shown on a weapon's dice line. */
export interface WeaponRange {
  distance: number;
  type: 'melee' | 'thrown';
  label?: string;
  damageDie?: number;
  extraHands?: number;
  disadvantage?: boolean;
}

/** The data describing a single weapon — everything `weaponOffers` needs. */
export interface WeaponDef {
  /** Weapon id; drives offer ids, `attack.<id>.*` / `weapon.<id>.*` facts, i18n. */
  id: string;
  /** Hands needed to wield (1 or 2) — the don's hands-budget cost. */
  hands: number;
  /** Light property → adds the off-hand bonus-action swing offer. */
  light?: boolean;
  /** Damage die size, e.g. 4 for 1d4. */
  damageDie: number;
  /** Damage type string for the damage die (e.g. `piercing`). */
  damageType: string;
  /** The fact toggling disadvantage on the to-hit roll. */
  disadvantageFact: string;
  /** Reach/throw bands for the dice-line control. */
  ranges: WeaponRange[];
  /** Panel annotation labels shared by the weapon's attack profiles. */
  annotationLabels: string[];
  /** Extra action-panel UI (e.g. greataxe Cleave followups / secondary control). */
  actionUiExtra?: Record<string, unknown>;
}

/** A per-turn spend effect: the given fact deltas, expiring at end of turn. */
const turnSpend = (state: Record<string, number>): EffectInstance => ({
  id: 'spend',
  state,
  expiry: { kind: 'endOfTurn' }
});

/** The vars block (dice config) carried by every attack profile of a weapon. */
function attackVars(def: WeaponDef): Record<string, unknown> {
  const vars: Record<string, unknown> = {
    ranges: { default: { array: def.ranges } },
    hitBonus: { capture: true, default: { fact: `attack.${def.id}.hitBonus` } },
    damageDie: { default: { number: def.damageDie } },
    damageBonus: { capture: true, default: { fact: `attack.${def.id}.damageBonus` } }
  };
  // Versatile weapons expose the two-hand grip as a captured selection so the
  // apply can reject it when no hand is free (see withVersatile).
  if (isVersatile(def)) vars.extraHands = { capture: true, default: { number: 0 } };
  return vars;
}

/**
 * Wrap an attack's base apply so a versatile weapon gripped two-handed
 * (`extraHands > 0`) errors when no hand is free (`hands.remaining < 1`) — v1's
 * `extraHandsNeeded` / `versatile.no-free-hand` check. Non-versatile weapons are
 * returned unchanged, so their offers keep exactly their prior shape.
 */
function withVersatile(
  def: WeaponDef,
  base: (f: FactReader) => ActionResult
): (f: FactReader, selections: Record<string, unknown>) => ActionResult {
  if (!isVersatile(def)) return base;
  return (f, selections) => {
    const r = base(f);
    const extra = typeof selections?.extraHands === 'number' ? selections.extraHands : 0;
    const diagnostics: Diagnostic[] = [...(r.diagnostics ?? [])];
    if (extra > 0 && f.num('hands.remaining') < 1) {
      diagnostics.push({ code: VERSATILE_NO_FREE_HAND, severity: 'error' });
    }
    return { ...r, diagnostics };
  };
}

/** The dice-line primary control shared by every attack profile of a weapon. */
function diceControl(def: WeaponDef): Record<string, unknown> {
  return {
    type: 'dice-line',
    ranges: { var: 'ranges' },
    advantage: { fact: def.disadvantageFact },
    dice: [
      { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
      {
        sides: { var: 'damageDie' },
        bonus: { var: 'damageBonus' },
        purpose: 'damage',
        damageType: { string: def.damageType }
      }
    ]
  };
}

/**
 * Attack-action transition (Attack action or a free Extra Attack follow-up).
 * Mirrors the unarmed strike: re-derive `extraRemaining` from the live turn state
 * and branch — a follow-up spends a charge, a new Attack action spends the action
 * and (re)grants the follow-up budget. Over-committing flags `no_action` on the
 * offending swing rather than the whole plan.
 */
/**
 * The Attack-action spend shared by every attack that participates in the Extra
 * Attack budget (weapon/unarmed swings, Grapple, Shove). A free follow-up spends
 * an `extraRemaining` charge; otherwise it spends the action and (re)grants the
 * follow-up budget. `attack.activation.count` drives the extra-attack flag; pass
 * `extra` for attack-kind markers (e.g. `attack.last.weapon`). `overCommitted` is
 * true when a new Attack action had no action to spend (the caller flags it).
 */
export function attackActionSpend(
  s: FactReader,
  extra: Record<string, number> = {}
): { effect: EffectInstance; overCommitted: boolean } {
  if (s.num('attackAction.extraRemaining') > 0) {
    return {
      effect: turnSpend({ 'attackAction.extraSpent': 1, 'attack.activation.count': 1, ...extra }),
      overCommitted: false
    };
  }
  const granted = s.num('actions.remaining') > 0 ? s.num('extraAttacks.max') : 0;
  return {
    effect: turnSpend({
      'actions.spent': 1,
      'attackAction.extraGranted': granted,
      'attack.activation.count': 1,
      ...extra
    }),
    overCommitted: s.num('actions.remaining') <= 0
  };
}

function attackActionApply() {
  return (s: FactReader): ActionResult => {
    // `attack.last.weapon` marks the swing as a weapon attack (feat annotations).
    const { effect, overCommitted } = attackActionSpend(s, { 'attack.last.weapon': 1 });
    return {
      advertise: [effect],
      diagnostics: overCommitted ? [{ code: NO_ACTION, severity: 'error' }] : []
    };
  };
}

/** A simple cost transition (reaction / bonus action) with an over-spend guard. */
function costApply(costFact: string, remainingFact: string, code: string) {
  return (s: FactReader): ActionResult => {
    const diagnostics: Diagnostic[] = s.num(remainingFact) > 0 ? [] : [{ code, severity: 'error' }];
    return { advertise: [turnSpend({ [costFact]: 1, 'attack.last.weapon': 1 })], diagnostics };
  };
}

/** The equip (don) transition: a permanent keyed effect holding the weapon equipped. */
function donApply(def: WeaponDef) {
  return (f: FactReader): ActionResult => {
    const diagnostics: Diagnostic[] = [];
    if (f.num('build.locked') !== 0) diagnostics.push({ code: BUILD_LOCKED, severity: 'error' });
    if (f.num(`weapon.${def.id}.equipped`) === 1)
      diagnostics.push({ code: `${WEAPON_DON}.${def.id}.already-equipped`, severity: 'error' });
    if (f.num('hands.remaining') < def.hands)
      diagnostics.push({ code: `${WEAPON_DON}.${def.id}.no-hands`, severity: 'error' });
    // Equipping is a permanent, keyed fact: one effect per weapon (the key stops a
    // re-don stacking) that sets `equipped` and consumes its hands from the budget.
    // Shown on the strip (v1 parity): removing the chip is how the weapon is stowed.
    return {
      advertise: [
        {
          id: `effect-${def.id}`,
          key: `equip:${def.id}`,
          state: { [`weapon.${def.id}.equipped`]: 1, 'hands.spent': def.hands },
          display: { name: `${WEAPON_DON}.effect-${def.id}.name` },
          expiry: { kind: 'permanent' }
        }
      ],
      diagnostics
    };
  };
}

/**
 * Every offer a weapon advertises: the don (EQUIP) plus the attack activations
 * (Attack action, melee reaction, and — Light only — an off-hand bonus-action
 * swing). The attack offers are *structurally* gated on the weapon being equipped
 * (`when`), so they vanish when it is stowed; legality (`legalWhen`) then gates on
 * the relevant resource. This is the v1 don-offer + use-action / use-reaction /
 * use-bonus-followup-light profiles, expressed directly.
 */
export function weaponOffers(def: WeaponDef): Offer[] {
  const equipped = (f: FactReader): boolean => f.num(`weapon.${def.id}.equipped`) === 1;
  const name = `${ATTACKS}.${def.id}.name`;
  const description = `${ATTACKS}.${def.id}.description`;
  const detailKey = `weapon/${def.id}`;

  const don: Offer = {
    id: `don-${def.id}`,
    ui: {
      section: 'equip',
      detailKey,
      name: `${WEAPON_DON}.don-${def.id}.name`,
      intents: { EQUIP: 'weapons' },
      actionCost: []
    },
    legalWhen: [
      // Build lock inlined (not a shared anchor): hides EQUIP once the build locks.
      {
        condition: (f) => f.num('build.locked') === 0,
        diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
      },
      {
        condition: (f) => f.num(`weapon.${def.id}.equipped`) !== 1,
        diagnostics: [{ code: `${WEAPON_DON}.${def.id}.already-equipped`, severity: 'error' }]
      },
      {
        condition: (f) => f.num('hands.remaining') >= def.hands,
        diagnostics: [{ code: `${WEAPON_DON}.${def.id}.no-hands`, severity: 'error' }]
      }
    ],
    apply: donApply(def)
  };

  const useAction: Offer = {
    id: `${def.id}-use-action`,
    when: equipped,
    ui: {
      section: 'action-attack',
      name,
      description,
      detailKey,
      intents: { ATTACK: 'weapons' },
      actionCost: ['action'],
      disadvantageFact: def.disadvantageFact,
      annotationLabels: [...def.annotationLabels, 'attack.action'],
      primaryControl: diceControl(def),
      ...def.actionUiExtra
    },
    vars: attackVars(def),
    legalWhen: [
      {
        condition: (f) =>
          f.num('actions.remaining') > 0 || f.num('attackAction.extraRemaining') > 0,
        diagnostics: [{ code: NO_ACTION, severity: 'error' }]
      }
    ],
    apply: withVersatile(def, attackActionApply())
  };

  const useReaction: Offer = {
    id: `${def.id}-use-reaction-weapon`,
    when: (f) => f.num('capability.attack.reaction.weapon') === 1 && equipped(f),
    ui: {
      section: 'reaction',
      name,
      description,
      detailKey,
      intents: { DEFEND: 'weapons' },
      actionCost: ['reaction'],
      annotationLabels: [...def.annotationLabels, 'attack.reaction'],
      primaryControl: diceControl(def)
    },
    vars: attackVars(def),
    legalWhen: [
      {
        condition: (f) => f.num('reactions.remaining') > 0,
        diagnostics: [{ code: NO_REACTION, severity: 'error' }]
      }
    ],
    apply: withVersatile(def, costApply('reactions.spent', 'reactions.remaining', NO_REACTION))
  };

  const offers: Offer[] = [don, useAction, useReaction];

  if (def.light) {
    offers.push({
      id: `${def.id}-use-bonus-followup-light`,
      // Gated on the (currently ungranted) Light off-hand capability, matching v1:
      // the offer exists in the module but only surfaces once a feature grants it.
      when: (f) => f.num('capability.attack.bonus.light') === 1 && equipped(f),
      ui: {
        section: 'bonus-action',
        name,
        description,
        detailKey,
        intents: { ATTACK: 'weapons' },
        actionCost: ['bonus'],
        annotationLabels: def.annotationLabels,
        primaryControl: diceControl(def)
      },
      vars: attackVars(def),
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: NO_BONUS_ACTION, severity: 'error' }]
        }
      ],
      apply: costApply('bonusActions.spent', 'bonusActions.remaining', NO_BONUS_ACTION)
    });
  }

  return offers;
}

// === Armor ===

/**
 * The d20 tests that suffer disadvantage when you wear armor you lack training
 * with, plus the spellcasting block (2024 rules). Heavy/medium/light all share
 * the same penalty set; only the proficiency fact differs.
 */
const ARMOR_PENALTY_FACTS = [
  'attack.str.disadvantage',
  'attack.dex.disadvantage',
  'initiative.disadvantage',
  'skill.acrobatics.disadvantage',
  'skill.athletics.disadvantage',
  'skill.sleight-of-hand.disadvantage',
  'skill.stealth.disadvantage',
  // Read by spellcasting: a non-zero value zeroes the spell-per-turn budget.
  'spellcasting.disabled'
] as const;

/**
 * Derives that raise the untrained-armor penalties while the given armor is worn
 * without its proficiency. Each is a flag derived from `armor.<id>.equipped` and
 * the proficiency fact (so it is conditional on live state, which effect `state`
 * can't be), combined with `max` so multiple armor sources don't conflict.
 */
export function armorTrainingPenalties(armorId: string, proficiencyFact: string): Contribution[] {
  return ARMOR_PENALTY_FACTS.map((fact) => ({
    fact,
    combine: 'max' as const,
    value: (f: FactReader) =>
      f.num(`armor.${armorId}.equipped`) === 1 && f.num(proficiencyFact) !== 1 ? 1 : 0
  }));
}

/**
 * The rules-authoring surface.
 *
 * Rule modules import ONLY from here — enforced by the confinement lint
 * (eslint.config.js, scoped to `rules/**`) and the confinement test. A single
 * authored entry point means:
 *  - the sandbox boundary (and the M2 chunk build) has exactly one import to
 *    allow;
 *  - authors get a stable API independent of the engine's internal file layout;
 *  - banned ambient globals (fetch/window/Date/Math.random/...) have no legal
 *    path into a module, keeping every rule a pure function of its facts.
 */

export type {
  RuleModule,
  RuleMeta,
  Contribution,
  FactReader,
  SheetCtx,
  Offer,
  OfferUI,
  Section,
  LegalWhen,
  ActionResult,
  EffectInstance,
  Expiry,
  RestKind,
  Annotation,
  AnnotationRider,
  Diagnostic
} from './types';

/**
 * Define a rule module. Currently an identity-with-type-anchor: its value is the
 * stable authored surface and the single import the confinement rules allow. A
 * dev-time guard rejects a module with no id so a copy-paste slip fails fast at
 * load rather than silently colliding (or vanishing) in the registry.
 */
export function defineRule(rule: RuleModule): RuleModule {
  if (!rule.id) {
    throw new Error('defineRule: a rule module must have a non-empty id');
  }
  return rule;
}
