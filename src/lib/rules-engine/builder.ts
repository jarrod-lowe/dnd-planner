import type {
  ActionResult,
  Contribution,
  Diagnostic,
  EffectInstance,
  EquipDef,
  FactReader,
  LegalWhen,
  MappedLabelSource,
  Offer,
  RuleModule
} from './types';
import {
  GRIP_ONE_HANDED,
  GRIP_TWO_HANDED,
  LOADOUT_HANDS_SPENT,
  loadoutEffectState,
  MAX_HANDS,
  type LoadoutConfig,
  type LoadoutItem
} from './loadout';

/** Pure, deterministic helpers that are part of the authoring toolkit. */
export { statToModifier } from './functions';

const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';
/** A BUILD offer is illegal while the build is locked (the build-lock group). */
const notLockedLegal: LegalWhen = {
  condition: (f) => f.num('build.locked') === 0,
  diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
};

/**
 * The hit-die die sizes, ascending. Shared by `hit-die` (which derives
 * `remaining` for each) and `core-events` (whose short rest spends them), so
 * the two can never disagree on what a hit die can be.
 */
export const HIT_DIE_SIZES = [6, 8, 10, 12] as const;

/**
 * Current HP from a max and the NET current-HP modifier. Damage drives the
 * modifier negative and healing carries it back toward 0, so:
 *  - `min(0, …)` clamps a positive modifier — current never exceeds the max;
 *  - `max(0, …)` floors the result — HP bottoms out at 0 and is never negative.
 *    You can absorb more damage than you have hit points, but the sheet still
 *    reads 0/60, not −8/60.
 *
 * Shared by the player's `hp.current` and the steed's, so the two can never
 * disagree on what "current HP" means. It is a pure read over the settled facts
 * and stores NOTHING, which is why it is safe: a damage record that baked a
 * clamped amount into its own effect would be an order-dependent value inside an
 * independently removable chip (delete an earlier chip and the later one is
 * suddenly wrong). Overkill therefore banks in `hp.modifier.current`; that is a
 * known limitation of a summed fact over removable effects, tracked separately.
 */
export const currentHp = (hpMax: number, modifierCurrent: number): number =>
  Math.max(0, hpMax + Math.min(0, modifierCurrent));

/**
 * The prepare / unprepare offer pair shared by every prepared spell. PAIRED with
 * `preparedSpellCount` below — a module using these offers must also include
 * that contribution in its `derive`, or its manual preparations never count
 * against the prepared limit.
 *
 * - prepare: legal while not locked, not already prepared, and under the prepared
 *   limit (`spellcasting.prepared.remaining > 0`). It advertises a PERMANENT keyed
 *   effect setting the spell's `prepared` fact (via `max`, so it composes with a
 *   class always-prepared grant). The count against the prepared limit is NOT in
 *   the effect's state — it is derived live by `preparedSpellCount`, so a later
 *   always-prepared grant releases the slot (effect state is an unconditional
 *   delta, and unprepare is illegal once granted, so a baked count could never
 *   be evicted).
 * - unprepare: legal while not locked, prepared, and NOT always-prepared. It
 *   advertises a same-key empty PERMANENT effect that evicts the prepare effect
 *   (newest-wins dedupe), dropping `prepared` (and with it the derived count).
 *
 * `alwaysPreparedFact` is read for the unprepare legality (and the count
 * derive); for a spell no feature ever grants, it is simply absent (0).
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
        return {
          advertise: [
            {
              id: 'prepared',
              key,
              // Only the prepared flag persists; the count is derived live by
              // `preparedSpellCount` (see the pair's doc above).
              state: { [preparedFact]: 1 },
              stateCombine: { [preparedFact]: 'max' },
              // Named for the strip's reveal toggle, hidden from the default view
              // (effect-<spell>-prepared carried ui.name + hidden).
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

/**
 * The live prepared-count contribution paired with `preparedSpellOffers` — a
 * module using the offers must also include this in its `derive`. Contributes 1
 * to `spellcasting.prepared.count` while the spell is prepared AND not
 * always-prepared, else 0. Derived rather than baked into the prepare effect's
 * state so a later always-prepared grant releases the slot a manual preparation
 * consumed: the grant raises `alwaysPreparedFact` and this contribution drops to
 * 0, where a state delta would have kept counting (and unprepare — the only
 * eviction — is illegal once granted).
 */
export function preparedSpellCount(opts: {
  /** The spell's prepared fact, e.g. `spell.l1.divineSmite.prepared`. */
  preparedFact: string;
  /** The always-prepared fact, e.g. `spell.l1.divineSmite.alwaysPrepared`. */
  alwaysPreparedFact: string;
}): Contribution {
  const { preparedFact, alwaysPreparedFact } = opts;
  return {
    fact: 'spellcasting.prepared.count',
    combine: 'sum',
    value: (f) => (f.num(preparedFact) === 1 && f.num(alwaysPreparedFact) !== 1 ? 1 : 0)
  };
}

// === Weapons ===
//
// The legacy engine generated a weapon's rules by a Python preprocessor that crossed weapon
// *definitions* (dagger, greataxe, …) with reusable *profiles* (use as an
// action / reaction / bonus-action) into per-weapon rule groups. Here a weapon
// is one self-contained module whose `offer` calls `weaponOffers(def)` — the
// cross-product is a plain function over data, so the preprocessor's job (and the
// `$(definition.id)` string interpolation it needed) collapses into types and
// template literals here. The shared i18n prefix is unchanged.

const ATTACKS = 'rule.dnd-5e-2024.attacks';
const NO_ACTION = `${ATTACKS}.activation.no_action`;
const NO_REACTION = `${ATTACKS}.activation.no_reaction`;
const NO_BONUS_ACTION = `${ATTACKS}.activation.no_bonus_action`;

/** A versatile weapon may be gripped two-handed for a bigger damage die. */
const isVersatile = (def: WeaponDef): boolean => def.versatile === true;
// BUILD_LOCKED is declared above (shared with the prepared-spell offers).

/** One reach/throw band shown on a weapon's dice line. */
export interface WeaponRange {
  distance: number;
  type: 'melee' | 'thrown';
  /**
   * i18n KEY appended to the distance ("5ft Two-handed"). A `MappedLabelSource`
   * picks the key from a fact at render time — see {@link gripLabel}. Never
   * display text: the dice line translates whatever lands here.
   */
  label?: string | MappedLabelSource;
  /**
   * Pins this band's damage die, overriding the `damageDie` var. Used to hold a
   * versatile weapon's THROWN bands at the one-handed die: the grip changes what
   * you swing with, not what you throw.
   */
  damageDie?: number;
  disadvantage?: boolean;
}

/** The data describing a single weapon — everything `weaponOffers` needs. */
export interface WeaponDef {
  /** Weapon id; drives offer ids, `attack.<id>.*` / `weapon.<id>.*` facts, i18n. */
  id: string;
  /** Hands needed to wield (1 or 2) — the loadout's hands-budget cost. */
  hands: 1 | 2;
  /** Versatile: it may also be gripped two-handed, for `versatileDamageDie`. */
  versatile?: boolean;
  /** Damage die size when gripped two-handed (versatile weapons only). */
  versatileDamageDie?: number;
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

/**
 * The weapon's hand-slot declaration — what the loadout enumerator reads to offer
 * it as part of a hand configuration. Derived from the same `def` as the offers so
 * the two can never disagree on hands or grip. Every weapon is `stackable`: a
 * second copy may fill the other hand (the hands budget still bounds it, so a
 * two-handed weapon is unreachable in pairs).
 */
export function weaponEquip(def: WeaponDef): EquipDef {
  return {
    hands: def.hands,
    stackable: true,
    nameKey: `${ATTACKS}.${def.id}.name`,
    state: { [`weapon.${def.id}.equipped`]: 1 },
    ...(isVersatile(def)
      ? { versatile: true, twoHandedState: { [`weapon.${def.id}.twoHanded`]: 1 } }
      : {})
  };
}

/** A per-turn spend effect: the given fact deltas, expiring at end of turn. */
const turnSpend = (state: Record<string, number>): EffectInstance => ({
  id: 'spend',
  state,
  expiry: { kind: 'endOfTurn' }
});

/**
 * The grip a versatile weapon's melee band announces, reusing the LOADOUT's own
 * grip keys so the attack row and the loadout chip say the same word. The grip is
 * no longer a per-attack choice, so without this the only thing that moved with it
 * was the damage die — d6 or d8 with nothing on the row saying which grip you are
 * in, and it is easy to forget.
 */
function gripLabel(def: WeaponDef): MappedLabelSource {
  return {
    fact: `weapon.${def.id}.twoHanded`,
    map: { 0: GRIP_ONE_HANDED, 1: GRIP_TWO_HANDED }
  };
}

/**
 * The dice-line bands for a weapon. A versatile weapon's grip lives in the
 * LOADOUT, not in the attack, so its melee band carries no die of its own (it
 * follows the `damageDie` var, which follows the grip fact) and instead names the
 * grip, while its thrown bands pin the one-handed die and stay unlabelled — the
 * grip changes what you swing with, not what you throw.
 */
function rangesFor(def: WeaponDef): WeaponRange[] {
  if (!isVersatile(def)) return def.ranges;
  return def.ranges.map((r) =>
    r.type === 'thrown' ? { ...r, damageDie: def.damageDie } : { ...r, label: gripLabel(def) }
  );
}

/**
 * The damage-die contribution of a versatile weapon: the die follows the grip the
 * loadout set (`weapon.<id>.twoHanded`), which is why the dice line needs no
 * two-handed band and no `extraHands` selection. Empty for a weapon with one grip.
 *
 * PAIRED with `weaponOffers` — a versatile weapon's module must spread this into
 * its `derive`, or its `damageDie` var reads an unset fact (0).
 */
export function weaponGripDerives(def: WeaponDef): Contribution[] {
  if (!isVersatile(def)) return [];
  const twoHanded = def.versatileDamageDie ?? def.damageDie;
  return [
    {
      fact: `attack.${def.id}.damageDie`,
      value: (f) => (f.num(`weapon.${def.id}.twoHanded`) === 1 ? twoHanded : def.damageDie)
    }
  ];
}

/** The vars block (dice config) carried by every attack profile of a weapon. */
function attackVars(def: WeaponDef): Record<string, unknown> {
  return {
    ranges: { default: { array: rangesFor(def) } },
    hitBonus: { capture: true, default: { fact: `attack.${def.id}.hitBonus` } },
    // Versatile: the die is a live fact of the equipped grip (weaponGripDerives).
    damageDie: isVersatile(def)
      ? { default: { fact: `attack.${def.id}.damageDie` } }
      : { default: { number: def.damageDie } },
    damageBonus: { capture: true, default: { fact: `attack.${def.id}.damageBonus` } }
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

/**
 * Every offer a weapon advertises: the attack activations (Attack action, melee
 * reaction, and — Light only — an off-hand bonus-action swing). The attack offers
 * are *structurally* gated on the weapon being equipped (`when`), so they vanish
 * when it is stowed; legality (`legalWhen`) then gates on the relevant resource.
 *
 * There is no per-weapon don offer any more: what a character holds is set as a
 * whole configuration by the `loadout` group's `set-loadout` (which is why every
 * weapon also declares `equip: weaponEquip(def)`), so this file no longer writes
 * `weapon.<id>.equipped` — it only reads it.
 */
export function weaponOffers(def: WeaponDef): Offer[] {
  const equipped = (f: FactReader): boolean => f.num(`weapon.${def.id}.equipped`) === 1;
  const name = `${ATTACKS}.${def.id}.name`;
  const description = `${ATTACKS}.${def.id}.description`;
  const detailKey = `weapon/${def.id}`;

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
    apply: attackActionApply()
  };

  // An opportunity attack is melee-only: drop the thrown range bands so a
  // throwable weapon (dagger/javelin/spear) can't be "reacted" at 20/60 or
  // 30/120 ft. A versatile weapon's melee band survives (its die follows the grip).
  const meleeDef: WeaponDef = { ...def, ranges: def.ranges.filter((r) => r.type === 'melee') };

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
      primaryControl: diceControl(meleeDef)
    },
    vars: attackVars(meleeDef),
    legalWhen: [
      {
        condition: (f) => f.num('reactions.remaining') > 0,
        diagnostics: [{ code: NO_REACTION, severity: 'error' }]
      }
    ],
    apply: costApply('reactions.spent', 'reactions.remaining', NO_REACTION)
  };

  const offers: Offer[] = [useAction, useReaction];

  if (def.light) {
    offers.push({
      id: `${def.id}-use-bonus-followup-light`,
      // Gated on the (currently ungranted) Light off-hand capability:
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

/** The loadout combinator surface a rule module may use (see loadout.ts). */
export { loadoutEffectState, LOADOUT_HANDS_SPENT, MAX_HANDS };
export type { LoadoutConfig, LoadoutItem };

export type {
  RuleModule,
  RuleMeta,
  EquipDef,
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
