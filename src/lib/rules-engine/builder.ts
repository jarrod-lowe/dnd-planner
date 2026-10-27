import type {
  ActionResult,
  Annotation,
  Contribution,
  Diagnostic,
  EffectInstance,
  EquipDef,
  FactReader,
  LegalWhen,
  MappedLabelSource,
  Offer,
  OfferUI,
  RuleModule,
  Section
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
 * The var every damage recorder's [Use Threshold | Ignore Threshold] segmented
 * control captures the mode into: 0 = Use (the default), 1 = Ignore. Lives at
 * module scope so the apply and the control descriptor can never drift apart.
 */
const THRESHOLD_MODE_VAR = 'thresholdMode';

// === HP recorders ===
//
// The damage/heal recorder pair every damageable subject offers. Three modules
// hand-wrote this same offer (the player's core-events record-damage/record-heal,
// the steed's, and the Tormentor's) and the audit that followed the vehicle pass
// found them drifting copies — only the vehicle consulted the threshold gate.
// The factory is the ONE code path now; what differs between subjects stays
// per-module DATA (fact names, i18n keys, effect ids, the accumulation idiom,
// the lethal consequence, the threshold fact + bounce annotation, the
// opt-in mishap threshold + note).

/**
 * How a recorder's records accumulate — the one structural choice the caller
 * makes. Both idioms record the SAME amounts against the same derived pool
 * (`${facts.max}` / `${facts.modifier.current}` via `currentHp`); they differ
 * in what each advertised EFFECT carries:
 *
 * - `'keyless-stack'` (the player): every record its own KEYLESS effect holding
 *   a delta on the current-HP modifier (damage −amount, heal +effective), so
 *   each hit is an independently REMOVABLE chip carrying its own amount as a
 *   display literal (`value`, never `displayFact` — a shared fact would show
 *   the net on every chip). Keyless effects never dedupe, so records stack.
 * - `'keyed-total'` (the steed, the Tormentor): ONE keyed effect per direction
 *   holding the RUNNING total (`prior + amount` baked into `state`), so records
 *   ADD UP (a same-key effect carrying only its own amount would evict the
 *   prior record instead of adding to it) while the chip shows the live fact
 *   (`displayFact`) and a single removal — or a same-key eviction from the
 *   subject's lifecycle — clears the whole record.
 */
export type HpRecordAccumulation = 'keyless-stack' | 'keyed-total';

/**
 * The lethal consequence a damage record carries when it empties the pool
 * (`currentHp(max, modifier − amount) <= 0` — the same formula the pool's
 * derive floors with, evaluated at the amount being recorded). The recorder's
 * own behavior never changes at 0 HP; only what BESIDE the record changes:
 *
 * - `keepRecord: false` (the steed): the effects REPLACE the record entirely —
 *   the retire cascade's same-key child evictions would supersede a record
 *   advertised beside them anyway, so it is not advertised at all.
 * - `keepRecord: true` (the Tormentor): the record lands BESIDE the effects —
 *   the blow happened, and the wreck is written under its own permanent key.
 */
export interface HpRecorderLethal {
  /** The consequence's effects (a retire cascade, a destroyed wreck). */
  effects: () => EffectInstance[];
  /** Whether the damage record still lands beside them. */
  keepRecord: boolean;
}

/** The optional ui payload only some recorders carry (plain passthroughs). */
export interface HpRecorderOfferUi {
  /** Offer description key (the vehicle's recorders carry one; player/steed don't). */
  description?: string;
  /** Rules-mode detail link (the vehicle's damage detail — threshold semantics). */
  detailKey?: string;
  /** Panels the post-hoc reminders ride (the player's `damage.any`/`healing.any`). */
  annotationLabels?: string[];
}

/** One direction of the recorder pair: the offer row plus its record effect. */
export interface HpRecorderDirection extends HpRecorderOfferUi {
  /** i18n key for the offer row's name. */
  name: string;
  /** The record effect's id (and its replacement key in keyed-total mode when `effectKey` is omitted). */
  effectId: string;
  /** The keyed-total replacement key, when it differs from the effect id. */
  effectKey?: string;
  /** i18n key for the record chip's name. */
  effectName: string;
}

/**
 * The below-threshold BOUNCE note — what a Use-Threshold sub-threshold blow
 * tells the player instead of recording. Sub-threshold damage is LEGAL to
 * attempt (settled 2026-10-26): the GM tells the player an amount and the
 * player records it, and the APP is what knows it was under the limit —
 * requiring prior knowledge of the threshold would defeat the point of
 * recording it here. So the bounce is never an error and never an
 * illegality: the damage apply returns ONE `'notice'` diagnostic keyed to
 * this spec's i18n string, which the plan fold attaches to THAT planned row
 * alone (`planDiagnostics` is per-instance) — the bounced row carries the
 * note, every other row of the same offer never sees it, and the note lives
 * exactly as long as the row does (remove the row and it withdraws; commit
 * the turn and it leaves with the row, the records beside it unchanged).
 */
export interface HpRecorderBounce {
  /** i18n key for the informational note on the bounced row — the caller's own wording. */
  noteKey: string;
}

/**
 * The at-threshold MISHAP note — the high-damage mirror of the bounce: what
 * a recording that MEETS a second, higher threshold tells the player WHILE
 * recording. Like the bounce it is never an error and never an illegality
 * (the amount records in full — this note is not the bounce gate), and it
 * rides the recording row alone (`planDiagnostics` is per-instance) exactly
 * as long as the row does. The threshold is a FACT the caller names, never
 * a literal here: an UNSET or non-positive fact reads 0 and never notes (the
 * same unset-never-gates convention the bounce follows), so a subject that
 * configures no mishap — or whose fact is absent — sees zero behaviour
 * change. The amount and the live threshold travel as diagnostic `params`
 * for the locale's {{amount}}/{{threshold}} slots.
 */
export interface HpRecorderMishap {
  /** The fact carrying the subject's mishap threshold; a recording at/above it carries the note. */
  thresholdFact: string;
  /** i18n key for the informational note on the recording row — the caller's own wording. */
  noteKey: string;
}

/** The one spec every HP recorder is built from — data, not code. */
export interface HpRecorderSpec {
  /** Offer id stem: the damage offer is `<stem>-damage`, the heal `<stem>-heal`. */
  idStem: string;
  /**
   * The subject's HP facts. `max` is the slider's ceiling; `modifierCurrent`
   * carries the keyless deltas and the missing-HP heal cap;
   * `damageRecorded`/`healRecorded` are the keyed running totals
   * (keyed-total mode requires both); `damageThreshold` is the fact the damage
   * apply gates on generically — the subject's NATURAL name, unset (reads 0)
   * for the player and steed today, so their recorders never gate until
   * something bakes one.
   */
  facts: {
    max: string;
    modifierCurrent: string;
    damageRecorded?: string;
    healRecorded?: string;
    damageThreshold: string;
  };
  /** Structural gate (the subject exists); omit for the always-there player recorder. */
  when?: (f: FactReader) => boolean;
  /** Files the offers and keyed chips under a subject view; omit for the player's own. */
  subject?: string;
  /** The damage direction's offer row and record effect. */
  damage: HpRecorderDirection;
  /** The heal direction's offer row and record effect. */
  heal: HpRecorderDirection;
  /** The accumulation idiom — see {@link HpRecordAccumulation}. */
  accumulation: HpRecordAccumulation;
  /** The strip section the record chips file under ('health', or 'mount' for a subject view). */
  chipSection: Section;
  /** The below-threshold bounce — see {@link HpRecorderBounce}. */
  bounce: HpRecorderBounce;
  /**
   * The at-threshold mishap note — see {@link HpRecorderMishap}. OPT-IN and
   * generic: omit it (the player, the steed) and no note can ever fire.
   */
  mishap?: HpRecorderMishap;
  /**
   * Extra legality legs the HEAL direction carries — the caller's own
   * condition and diagnostics, exactly an offer's `legalWhen` entry (e.g. a
   * wrecked vehicle cannot be repaired). Appended to the heal offer's
   * `legalWhen` and re-checked in its apply (the dash idiom), so a
   * planned-anyway row still records — the missing-HP cap untouched — while
   * carrying its own diagnostics. OPT-IN and heal-only: the damage direction
   * never sees these legs (damage is bookkeeping on a subject in any state),
   * and a subject that configures none (the player, the steed) keeps a heal
   * offer with no legality at all, exactly as before.
   */
  healLegality?: LegalWhen[];
  /** What a pool-emptying blow does; omit when the subject has no lethal rule (the player). */
  lethal?: HpRecorderLethal;
  /**
   * Per-module extras advertised when a damage record LANDS (never on a bounced
   * blow — no damage was taken; and always on an Ignore-Threshold record — the
   * correction is damage taken). The player's concentration check trigger is
   * the one user today; it stays in core-events, not here.
   */
  onDamageRecorded?: (f: FactReader, amount: number) => EffectInstance[];
}

/**
 * The shared damage/heal recorder pair — the slider offer, its `amount` capture,
 * the apply transitions, and the record effects, from one spec. What every
 * recorder agrees on is here once:
 *
 * - the slider control (the plain `type: 'slider'` descriptor PanelRenderer
 *   already renders: `var: 'amount'`, 0..`facts.max`, 'hp') and its
 *   `{ amount: { capture: true, default: { number: 0 } } }` vars;
 * - the damage offer's [Use Threshold | Ignore Threshold] segmented SECONDARY
 *   control, gated `enabled.condition` on the threshold FACT > 0 (the
 *   Alert-leg precedent): offer ui is authored once with no facts, so the
 *   RENDERER is what follows the fact — no threshold fact, exactly the old
 *   single-slider look; a positive fact, the control renders directly;
 * - the damage apply's GENERIC threshold gate (threshold model v2): Use mode +
 *   sub-threshold records NOTHING and returns the informational bounce note
 *   as a `'notice'` diagnostic on that row alone (never a `legalWhen` error —
 *   the blow was legal to attempt); Ignore mode skips the gate and records
 *   the RAW amount (the GM correction); at/above the threshold Use mode
 *   records in full — the threshold is a floor, not a cap;
 * - the damage apply's OPT-IN mishap note (see {@link HpRecorderMishap}): a
 *   spec that names a mishap threshold fact gets ONE more informational
 *   `'notice'` diagnostic on any row whose recorded amount MEETS it — the
 *   amount still records in full (the note never gates), and the amount and
 *   the live threshold travel as params for the locale's
 *   {{amount}}/{{threshold}} slots. No option configured, no note can ever
 *   fire — the player's and the steed's recorders ride unchanged;
 * - the missing-HP heal cap (`min(amount, max(0, -modifierCurrent))` — regained
 *   HP cannot exceed the max, so surplus is lost rather than banked to
 *   pre-cancel a later blow);
 * - the record effects per accumulation idiom (see
 *   {@link HpRecordAccumulation}), both `untilLongRest`.
 *
 * The RAW damage amount is always recorded, never one clamped to the HP held:
 * a clamp would bake an order-dependent value into an independently removable
 * record (the `currentHp` derive floors the display at 0 instead — overkill
 * banking in the summed modifier is that known limitation, tracked separately).
 */
export function hpRecorders(spec: HpRecorderSpec): Offer[] {
  const { facts, subject } = spec;
  const keyed = spec.accumulation === 'keyed-total';
  // A keyed-total recorder lives in its running-total facts; naming neither is
  // a spec typo, not a runtime state — fail at module load, like defineRule.
  const requireTotal = (fact: string | undefined, what: string): string => {
    if (keyed && !fact)
      throw new Error(
        `hpRecorders: ${spec.idStem} (${what}): a keyed-total recorder must name its ${what} fact`
      );
    return fact ?? '';
  };
  const damageTotal = requireTotal(facts.damageRecorded, 'damageRecorded');
  const healTotal = requireTotal(facts.healRecorded, 'healRecorded');

  const slider = {
    type: 'slider',
    var: 'amount',
    min: { number: 0 },
    max: { fact: facts.max },
    unit: 'hp'
  };
  const amountVar = { amount: { capture: true, default: { number: 0 } } };
  // The threshold-mode segmented control, gated on the threshold FACT at
  // render time (the enabled-without-button form — renders directly while the
  // condition holds, hidden while it does not). 0 = Use Threshold (the
  // default), 1 = Ignore Threshold; the labels are shared builder machinery,
  // one wording for every subject.
  const thresholdControl = {
    type: 'segmented',
    var: THRESHOLD_MODE_VAR,
    prefix: 'planner.record.threshold.prefix',
    options: [
      { value: 0, label: 'planner.record.threshold.use' },
      { value: 1, label: 'planner.record.threshold.ignore' }
    ],
    enabled: { condition: { fact: facts.damageThreshold, operator: 'greaterThan', value: 0 } }
  };

  const damageRecord = (f: FactReader, amount: number): EffectInstance =>
    keyed
      ? {
          id: spec.damage.effectId,
          key: spec.damage.effectKey ?? spec.damage.effectId,
          state: { [damageTotal]: f.num(damageTotal) + amount },
          display: {
            name: spec.damage.effectName,
            section: spec.chipSection,
            ...(subject ? { subject } : {}),
            displayFact: damageTotal
          },
          expiry: { kind: 'untilLongRest' }
        }
      : {
          id: spec.damage.effectId,
          state: { [facts.modifierCurrent]: -amount },
          display: { name: spec.damage.effectName, section: spec.chipSection, value: amount },
          expiry: { kind: 'untilLongRest' }
        };

  const healRecord = (f: FactReader, effective: number): EffectInstance =>
    keyed
      ? {
          id: spec.heal.effectId,
          key: spec.heal.effectKey ?? spec.heal.effectId,
          state: { [healTotal]: f.num(healTotal) + effective },
          display: {
            name: spec.heal.effectName,
            section: spec.chipSection,
            ...(subject ? { subject } : {}),
            displayFact: healTotal
          },
          expiry: { kind: 'untilLongRest' }
        }
      : {
          id: spec.heal.effectId,
          state: { [facts.modifierCurrent]: effective },
          // The EFFECTIVE amount — the value the effect records (surplus lost).
          display: { name: spec.heal.effectName, section: spec.chipSection, value: effective },
          expiry: { kind: 'untilLongRest' }
        };

  const applyDamage = (f: FactReader, selections: Record<string, unknown>): ActionResult => {
    const amount = typeof selections.amount === 'number' ? selections.amount : 0;
    // Ignore Threshold (the GM-correction mode): the gate is skipped and the
    // RAW amount records in full — a correction is not a blow off the armor.
    const ignoreThreshold = selections[THRESHOLD_MODE_VAR] === 1;
    // Use Threshold (the default): a blow below the fact BOUNCES — no record,
    // no lethal consequence, no per-module extras — and the informational
    // bounce note returns as a `'notice'` diagnostic, which the plan fold
    // attaches to THIS row alone. An UNSET fact reads 0 and never gates, which
    // is also why the control renders only while the fact is positive.
    if (!ignoreThreshold && amount < f.num(facts.damageThreshold)) {
      return {
        diagnostics: [{ code: spec.bounce.noteKey, severity: 'notice' }]
      };
    }
    // The at-threshold MISHAP note (the opt-in mirror): when a configured
    // threshold fact is positive and this RECORDED amount meets it, ONE
    // informational notice rides the row BESIDE whatever the record does —
    // never blocking it (the note is not the bounce gate), on every path
    // where the damage is taken (a raw Ignore-Threshold correction and a
    // pool-emptying blow included — damage taken is damage taken). The
    // amount and the live fact travel as params; an unset/non-positive fact
    // never notes, so unconfigured subjects are untouched.
    const mishapDiagnostics: Diagnostic[] = [];
    if (spec.mishap) {
      const mishapThreshold = f.num(spec.mishap.thresholdFact);
      if (mishapThreshold > 0 && amount >= mishapThreshold)
        mishapDiagnostics.push({
          code: spec.mishap.noteKey,
          severity: 'notice',
          params: { amount, threshold: mishapThreshold }
        });
    }
    // The lethal check (the steed's placement): currentHp floors at 0, so a
    // pool-emptying blow — overkill included — takes the lethal branch.
    if (spec.lethal && currentHp(f.num(facts.max), f.num(facts.modifierCurrent) - amount) <= 0) {
      return spec.lethal.keepRecord
        ? {
            advertise: [damageRecord(f, amount), ...spec.lethal.effects()],
            diagnostics: mishapDiagnostics
          }
        : { advertise: spec.lethal.effects(), diagnostics: mishapDiagnostics };
    }
    const advertise = [damageRecord(f, amount)];
    if (spec.onDamageRecorded) advertise.push(...spec.onDamageRecorded(f, amount));
    return { advertise, diagnostics: mishapDiagnostics };
  };

  const applyHeal = (f: FactReader, selections: Record<string, unknown>): ActionResult => {
    const amount = typeof selections.amount === 'number' ? selections.amount : 0;
    // The heal caps at the net missing HP (recorded damage AND any manual
    // modifier fold into it) — the surplus is lost, never banked.
    const missing = Math.max(0, -f.num(facts.modifierCurrent));
    // The opt-in heal legs, re-checked (the dash idiom): a planned-anyway row
    // still records — the cap untouched — while carrying its own diagnostics
    // from the fold.
    const diagnostics: Diagnostic[] = [];
    for (const leg of spec.healLegality ?? [])
      if (!leg.condition(f)) diagnostics.push(...leg.diagnostics);
    return { advertise: [healRecord(f, Math.min(amount, missing))], diagnostics };
  };

  const ui = (d: HpRecorderDirection, withThresholdControl: boolean): OfferUI => ({
    section: 'free',
    ...(subject ? { subject } : {}),
    name: d.name,
    ...(d.description ? { description: d.description } : {}),
    ...(d.detailKey ? { detailKey: d.detailKey } : {}),
    ...(d.annotationLabels ? { annotationLabels: d.annotationLabels } : {}),
    primaryControl: slider,
    // The threshold-mode control is the DAMAGE direction's alone: repairs have
    // no threshold semantics and never bounce.
    ...(withThresholdControl ? { secondaryControl: thresholdControl } : {}),
    intents: { HEALTH: 'hp' },
    actionCost: []
  });

  return [
    {
      id: `${spec.idStem}-damage`,
      ...(spec.when ? { when: spec.when } : {}),
      ui: ui(spec.damage, true),
      vars: { ...amountVar, [THRESHOLD_MODE_VAR]: { capture: true, default: { number: 0 } } },
      apply: applyDamage
    },
    {
      id: `${spec.idStem}-heal`,
      ...(spec.when ? { when: spec.when } : {}),
      // The caller's opt-in heal legs, when any are configured (the player's
      // and the steed's recorders configure none and carry no legality).
      ...(spec.healLegality ? { legalWhen: spec.healLegality } : {}),
      ui: ui(spec.heal, false),
      vars: amountVar,
      apply: applyHeal
    }
  ];
}

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

/** i18n namespace for the shared untrained-armor attribution chip. */
const ARMOR_TRAINING = 'rule.dnd-5e-2024.armor-training';

/**
 * The attribution chips for armor worn without its training: while the given
 * armor is equipped and the proficiency fact is unset, VALUELESS riders (the
 * GWF idiom — no `value`, so text chips on the matched panels plus the toast
 * labels) name WHY those dice-lines default to 2d20-take-low. One chip per
 * D20 Test kind (the Exhaustion precedent), because appliesTo is
 * single-purpose; the targets are exactly the panels the penalty facts above
 * govern — the generic record-check reads no armor fact, so it gets no chip.
 * Shared by every armor module under one namespace (the `proneEffect`
 * builder-hosted-keys precedent); body armors share the `armor:body` effect
 * key, so only one can be live and the chips can never double-render.
 * Splint's unconditional proficient-worn Stealth disadvantage is a separate
 * source, deliberately not chipped here.
 */
export function armorTrainingPenaltyAnnotation(
  f: FactReader,
  armorId: string,
  proficiencyFact: string
): Annotation[] {
  return f.num(`armor.${armorId}.equipped`) === 1 && f.num(proficiencyFact) !== 1
    ? [
        {
          key: `${ARMOR_TRAINING}.disadvantage`,
          targets: ['attack.any'],
          rider: { label: `${ARMOR_TRAINING}.rider`, type: 'modifier', appliesTo: 'to-hit' }
        },
        {
          key: `${ARMOR_TRAINING}.disadvantage-checks`,
          targets: [
            'dice.initiative',
            'check.acrobatics',
            'check.athletics',
            'check.sleight-of-hand',
            'check.stealth'
          ],
          rider: { label: `${ARMOR_TRAINING}.rider`, type: 'modifier', appliesTo: 'check' }
        }
      ]
    : [];
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
export type { SubjectPanel, SubjectPanelGate, SubjectPanelDeclaration, UiEntry } from './panels';

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
