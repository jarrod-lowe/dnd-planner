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
  GRIP_ONE_HANDED_SHORT,
  GRIP_TWO_HANDED_SHORT,
  LOADOUT_HANDS_SPENT,
  loadoutEffectState,
  MAX_HANDS,
  type LoadoutConfig,
  type LoadoutItem
} from './loadout';
import { enumeratePreparableSpells, preparedEffectState } from './preparedSpells';

/** Pure, deterministic helpers that are part of the authoring toolkit. */
export { statToModifier } from './functions';

const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';
/**
 * A BUILD offer is illegal while the build is locked (the build-lock group).
 * Shared by the offer builders here and by rule modules that carry their own
 * build-time offers (e.g. prepared-spells' set picker).
 */
export const notLockedLegal: LegalWhen = {
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
 * The shared `key` every concentration spell's holding effect carries. Keyed,
 * so an EMPTY same-key effect advertised later (a failed concentration check's
 * eviction, the find-steed Dismiss pattern) REPLACES the holding effect rather
 * than stacking beside it: the spell's `concentration.spent` contribution
 * drops while the eviction is merely planned — remove the check row and the
 * spell folds back — and `endTurn` merges the replacement permanently. It is
 * also the SRD 5.2 recast mechanism: starting a second concentration spell is
 * legal ("Another Concentration Effect" — you lose Concentration the moment
 * you start casting), and the newest same-key effect dismisses the old hold —
 * in-plan, at commit, and carrying the old spell's side state (the Shield of
 * Faith AC bonus) with it. Lives in the builder (not concentration.ts)
 * because the spell modules must import it and may import only the builder.
 */
export const CONCENTRATION_SPELL_KEY = 'concentration-spell';

/**
 * The keyed clear of the concentration damage marker — the exact effect the
 * concentration check advertises to resolve a save. Exported so every
 * concentration spell's CAST advertises the same clear (newest wins in the
 * fold): SRD 5.2 — "You lose Concentration on an effect the moment you start
 * casting a spell that requires Concentration" — a save owed against the
 * PRE-CAST hold could only ever have ended that hold, so the replacement cast
 * moots the pending save rather than leaving it to evict the new spell.
 * Damage recorded AFTER the cast re-trips the marker normally (its row is
 * later in the fold). Lives in the builder (like CONCENTRATION_SPELL_KEY)
 * because the spell modules must import it and may import only the builder.
 */
export const concentrationDamageMarkerClear = (): EffectInstance => ({
  id: 'concentration-damage-taken',
  key: 'concentration-damage-taken',
  state: { 'concentration.damage-taken': 0, 'concentration.last-damage': 0 },
  expiry: { kind: 'endOfTurn' }
});

/**
 * The concentration BREAK a condition's recorder advertises while a hold is
 * live — the Incapacitated "No Concentration" clause (SRD 5.2), shared by
 * every condition whose SRD text includes Incapacitated: the composition
 * children (Paralyzed/Petrified/Stunned/Unconscious) invoke this same helper
 * from their own recorders, because writing `condition.incapacitated` does
 * NOT evict a held spell — the break is offer-side apply logic, not
 * fact-reactive.
 *
 * Returns NOTHING when no hold is live (`concentration.spent` 0/unset): an
 * unconditional eviction would commit a permanent "Concentration broken" chip
 * recording with nothing held. With a hold live it returns the pair the
 * failed concentration check and the replacement cast established:
 *  - the empty same-`CONCENTRATION_SPELL_KEY` eviction — while merely
 *    planned it REPLACES the hold in-fold (remove the record row and the
 *    spell folds back), and `expiry: permanent` keeps it broken once
 *    committed;
 *  - `concentrationDamageMarkerClear()` — a damage save owed against the now
 *    dead hold is moot (the recast precedent).
 *
 * The eviction's id is caller-neutral (every condition's break yields the
 * same chip, so the children's scenarios assert one id) and its display
 * REUSES `planner.concentration.broken` — it names the state, not the
 * breaker, so it is correct regardless of who broke the hold. Lives in the
 * builder (like the key and the clear) because rule modules may import only
 * the builder.
 */
export const concentrationBreakEffects = (f: FactReader): EffectInstance[] =>
  f.num('concentration.spent') > 0
    ? [
        {
          id: 'concentration-broken-by-condition',
          key: CONCENTRATION_SPELL_KEY,
          display: { name: 'planner.concentration.broken', section: 'other' },
          expiry: { kind: 'permanent' }
        },
        concentrationDamageMarkerClear()
      ]
    : [];

/**
 * The keyed prone effect condition-prone's offers commit — and Unconscious's
 * Regain Consciousness end-offer commits FRESH (SRD 5.2 Unconscious, Inert:
 * "When this condition ends, you remain Prone" — the eviction that ends the
 * condition kills its own `condition.prone` write, so a fresh key-'prone'
 * writer must land beside it). `key: 'prone'` so a later clear (an empty
 * same-key effect — Get Up, Regain Consciousness) newest-wins evicts it,
 * holding `condition.prone` plus the STR/DEX attack-disadvantage flags the
 * weapon and unarmed dice-lines already read (so the rollers default to
 * 2d20-take-low with zero roller changes). The flags carry
 * `stateCombine: 'max'` (the armor idiom): the armor modules derive the same
 * facts with `combine: 'max'`, and the default `sum` on an effect write
 * would conflict-throw for any armored character.
 *
 * Lives in the builder (like CONCENTRATION_SPELL_KEY) because rule modules
 * may import only the builder — no rule imports another rule, so the prone
 * chassis and the unconscious end-offer share this one factory.
 */
export const proneEffect = (): EffectInstance => ({
  id: 'effect-prone',
  key: 'prone',
  state: {
    'condition.prone': 1,
    'attack.str.disadvantage': 1,
    'attack.dex.disadvantage': 1
  },
  stateCombine: {
    'attack.str.disadvantage': 'max',
    'attack.dex.disadvantage': 'max'
  },
  display: { name: 'rule.dnd-5e-2024.condition-prone.effect-prone.name' },
  expiry: { kind: 'untilShortRest' }
});

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
 * The live prepared-count contribution paired with the `prepare` declaration on
 * each spell module (the `prepared-spells` group's set picker writes the
 * prepared facts this reads). Contributes 1 to `spellcasting.prepared.count`
 * while the spell is prepared AND not always-prepared, else 0. Derived rather
 * than baked into the picker effect's state so an always-prepared grant releases
 * the slot a manual preparation consumed: the grant raises `alwaysPreparedFact`
 * and this contribution drops to 0, where a state delta would have kept counting.
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
  /**
   * Whether attacking in this band is a MELEE weapon attack. Set by
   * {@link rangesFor} for every band (melee bands true, thrown bands false), so a
   * rider that RAW only reaches melee weapon attacks — Great Weapon Fighting's
   * 1-2 → 3 damage floor — can be gated on the band the row is cycled to.
   *
   * It has to be stated on the BAND, not left to the rider's own annotation:
   * annotations are derived from facts for the whole row, and the selected band
   * is per-row UI state the engine never sees. Without this a spear gripped
   * two-handed floored its thrown damage as well as its melee damage.
   */
  meleeAttack?: boolean;
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
  /**
   * The fact toggling ADVANTAGE on the to-hit roll (Invisible writes the
   * STR/DEX flags). Parity with {@link WeaponDef.disadvantageFact}: the
   * builder wires it into every dice-line's `advantageUp` leg (the
   * honest-named counterpart of the historical `advantage` field, which
   * remains the disadvantage source).
   */
  advantageFact: string;
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
 * The var a versatile weapon's attack profiles capture the grip into. Both the
 * damage die and the melee band's label read it — see {@link attackVars}.
 */
const GRIP_VAR = 'twoHanded';

/**
 * The grip a versatile weapon's melee band announces, reusing the LOADOUT's own
 * grip vocabulary so the attack row and the loadout chip say the same thing. The
 * grip is no longer a per-attack choice, so without this the only thing that moved
 * with it was the damage die — d6 or d8 with nothing on the row saying which grip
 * you are in, and it is easy to forget.
 *
 * Reads the CAPTURED `twoHanded` var, not `weapon.<id>.twoHanded` directly, so the
 * label freezes with the die it sits beside (see {@link attackVars}). On an offer
 * that is not yet planned there is no selection, so the var falls through to its
 * own default — the live fact — and the picker still shows the current grip.
 *
 * The ABBREVIATED keys, because this label shares the dice line's range button with
 * the distance ("5ft 1H"): the full words made that button change width as the grip
 * changed. The picker, a vertical list, keeps the words.
 */
function gripLabel(): MappedLabelSource {
  return {
    var: GRIP_VAR,
    map: { 0: GRIP_ONE_HANDED_SHORT, 1: GRIP_TWO_HANDED_SHORT }
  };
}

/**
 * The dice-line bands for a weapon. Every band states whether it is a melee
 * weapon attack (`meleeAttack`), which is what melee-only riders are gated on —
 * the dice line knows which band it is cycled to, the rules engine does not.
 *
 * A versatile weapon's grip lives in the LOADOUT, not in the attack, so its melee
 * band carries no die of its own (it follows the `damageDie` var, which follows
 * the grip fact) and instead names the grip, while its thrown bands pin the
 * one-handed die and stay unlabelled — the grip changes what you swing with, not
 * what you throw. For the same reason a thrown band is never a melee attack: a
 * two-handed grip earns Great Weapon Fighting on the swing, not on the throw.
 */
function rangesFor(def: WeaponDef): WeaponRange[] {
  return def.ranges.map((r) => {
    const band: WeaponRange = { ...r, meleeAttack: r.type === 'melee' };
    if (!isVersatile(def)) return band;
    return r.type === 'thrown'
      ? { ...band, damageDie: def.damageDie }
      : { ...band, label: gripLabel() };
  });
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

/**
 * The vars block (dice config) carried by every attack profile of a weapon.
 *
 * A versatile weapon's grip is a fact the LOADOUT sets, and both the damage die
 * (`weaponGripDerives`) and the melee band's label follow it. Both are CAPTURED,
 * for two different reasons:
 *
 *  - Every plan row is rendered against the ONE final projected facts object —
 *    there is no per-step projection — so a live read is really "the state at the
 *    end of the plan". Planning a spear swing two-handed and then planning a grip
 *    change rewrote the already-planned swing as one-handed (#398).
 *  - They must freeze at the SAME moment. A captured die beside a live label reads
 *    "1H" next to a d8, which is worse than either drifting alone.
 *
 * Be clear about what this buys: capture freezes at ADD time, which is still not
 * the row's position in the plan. Add the swing one-handed and then insert a grip
 * change ABOVE it and the captured values are stale in the other direction. That is
 * exactly the trade-off `hitBonus` and `damageBonus` already live with, so the
 * argument here is consistency with them, not correctness. Making a row read its
 * own step's facts needs per-step facts projection — an engine change, not this.
 *
 * The `twoHanded` var exists only to be captured: `gripLabel` maps it onto the
 * loadout's grip keys. A weapon with one grip carries neither var and is untouched.
 */
function attackVars(def: WeaponDef): Record<string, unknown> {
  return {
    ranges: { default: { array: rangesFor(def) } },
    hitBonus: { capture: true, default: { fact: `attack.${def.id}.hitBonus` } },
    ...(isVersatile(def)
      ? {
          [GRIP_VAR]: { capture: true, default: { fact: `weapon.${def.id}.twoHanded` } },
          damageDie: { capture: true, default: { fact: `attack.${def.id}.damageDie` } }
        }
      : { damageDie: { default: { number: def.damageDie } } }),
    damageBonus: { capture: true, default: { fact: `attack.${def.id}.damageBonus` } }
  };
}

/** The dice-line primary control shared by every attack profile of a weapon. */
function diceControl(def: WeaponDef): Record<string, unknown> {
  return {
    type: 'dice-line',
    ranges: { var: 'ranges' },
    advantage: { fact: def.disadvantageFact },
    advantageUp: { fact: def.advantageFact },
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

/**
 * The attack-kind markers a weapon swing writes, given the range band the row is
 * cycled to.
 *
 * `attack.last.weapon` is unconditional — throwing a dagger is still an attack
 * with a weapon. `attack.last.melee` is not: a thrown hit at 20ft is a RANGED
 * attack, so it must not unlock the melee-only riders (the smites), while the
 * melee band of the same weapon must.
 *
 * Which band a row is on is a per-row choice the engine cannot derive from facts
 * — but it is not invisible either. The dice line persists the tapped band as the
 * `rangeIndex` SELECTION (PanelDiceLine → playStore.updateSelections →
 * `PlannedRef.selections`), and {@link rangesFor} already stamps `meleeAttack` on
 * every band for the renderer's sake. So the apply reads the same selection the
 * renderer does and looks the band up in the same array, which is why this takes
 * the `def` the offer was built from: the reaction is built from a melee-only
 * `def`, so its band indices are its own.
 *
 * No selection means band 0 — the band the panel opens on and the one the player
 * is looking at when they add the row without touching the range chip. Every
 * weapon today declares its melee band first, so the default is "melee", and a
 * weapon with no melee band would default to its own first (ranged) band rather
 * than to a melee attack it cannot make.
 */
function attackKindState(
  def: WeaponDef,
  selections: Record<string, unknown>
): Record<string, number> {
  const state: Record<string, number> = { 'attack.last.weapon': 1 };
  const bands = rangesFor(def);
  if (bands.length === 0) return state;
  const picked = selections.rangeIndex;
  const index =
    typeof picked === 'number' && Number.isInteger(picked) && picked >= 0
      ? picked % bands.length
      : 0;
  if (bands[index].meleeAttack === true) state['attack.last.melee'] = 1;
  return state;
}

function attackActionApply(def: WeaponDef) {
  return (s: FactReader, selections: Record<string, unknown>): ActionResult => {
    // `attack.last.weapon` marks the swing as a weapon attack (feat annotations);
    // `attack.last.melee` marks it as a MELEE one (the smites) — see attackKindState.
    const { effect, overCommitted } = attackActionSpend(s, attackKindState(def, selections));
    return {
      advertise: [effect],
      diagnostics: overCommitted ? [{ code: NO_ACTION, severity: 'error' }] : []
    };
  };
}

/** A simple cost transition (reaction / bonus action) with an over-spend guard. */
function costApply(def: WeaponDef, costFact: string, remainingFact: string, code: string) {
  return (s: FactReader, selections: Record<string, unknown>): ActionResult => {
    const diagnostics: Diagnostic[] = s.num(remainingFact) > 0 ? [] : [{ code, severity: 'error' }];
    return {
      advertise: [turnSpend({ [costFact]: 1, ...attackKindState(def, selections) })],
      diagnostics
    };
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
      advantageFact: def.advantageFact,
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
    apply: attackActionApply(def)
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
      intents: { REACT: 'weapons' },
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
    // Built from `meleeDef`, so its band list is the melee-only one: an
    // opportunity attack is always a melee attack, whatever the weapon can throw.
    apply: costApply(meleeDef, 'reactions.spent', 'reactions.remaining', NO_REACTION)
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
      // The off-hand swing keeps the weapon's full band list — a Light thrown
      // weapon can be thrown with it, and a thrown hit is not a melee attack.
      apply: costApply(def, 'bonusActions.spent', 'bonusActions.remaining', NO_BONUS_ACTION)
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

/** The prepared-spells combinator surface a rule module may use (see preparedSpells.ts). */
export { enumeratePreparableSpells, preparedEffectState };

export type {
  RuleModule,
  RuleMeta,
  EquipDef,
  PrepareDef,
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
