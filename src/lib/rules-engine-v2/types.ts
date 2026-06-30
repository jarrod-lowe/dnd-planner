/**
 * Rules Engine v2 — builder-API types (M0 spike, dataflow subset).
 *
 * Rules are pure functions that RETURN data; they never mutate working state.
 * This file currently covers the "sheet" (derived character state) pass only.
 * `offer` / `apply` / `effects` / `annotate` arrive in later M0 increments.
 *
 * See docs/RULES_ENGINE_V2_PLAN.md.
 */

/** Flat fact store. Numeric in v1/v2; widened later if needed. */
export type Facts = Record<string, number>;

/**
 * Read-only view of facts handed to a contribution's `value`. Reading a fact
 * records a dependency, which is how the engine derives execution order — the
 * author never writes `after`/`group`. Unset facts read as 0 (v1 parity).
 */
export interface FactReader {
  num(fact: string): number;
  /**
   * Whether a fact is present (set). Distinguishes an unset fact from an explicit
   * 0 — mirrors v1, where statToModifierHandler returns 0 for an undefined score
   * but statToModifier(0) is -5.
   */
  has(fact: string): boolean;
}

/**
 * How multiple contributions to the same fact combine.
 * - `sum`: add all (e.g. HP from many class levels) — the common modifier case
 * - `max`: take the largest (e.g. unarmored AC variants)
 * - `override`: single authoritative writer (default)
 */
export type CombineMode = 'sum' | 'max' | 'override';

/**
 * One declarative contribution to a derived fact. `value` is a pure function of
 * other facts; the engine discovers its dependencies by tracking reads.
 */
export interface Contribution {
  fact: string;
  combine?: CombineMode;
  value: (f: FactReader) => number;
}

/** Context passed to `derive`. Minimal for the sheet pass (no time, no plan). */
export interface SheetCtx {
  selections: Record<string, unknown>;
}

/**
 * Search/discovery metadata for a rule group. This is the ONLY part of a module
 * the search index needs — logic stays in the (lazily-loaded) chunk. `name` /
 * `description` / `keywords` are i18n keys (keywords resolves to the existing
 * space-separated term string); `requires` lists prerequisite rule-group ids
 * (literal, like v1). Resolution of keys → indexed terms happens at publish time
 * (W4), keeping modules i18n-compliant.
 */
export interface RuleMeta {
  name: string;
  description: string;
  keywords: string;
  requires?: string[];
}

/**
 * A rule module. The sheet pass consumes `derive`; the plan/offer passes consume
 * `offer`. Later passes add `effects`/`annotate`. `meta` is the discovery surface
 * (search index); only user-facing "content" groups need it.
 */
export interface RuleModule {
  id: string;
  meta?: RuleMeta;
  derive?: (ctx: SheetCtx) => Contribution[];
  offer?: (ctx: SheetCtx) => Offer[];
  /**
   * Contributions an ACTIVE persistent effect makes to the sheet (e.g. a spent
   * spell slot adds +1 to `...spent`). The effect replaces v1's self-advertising
   * rule: it is just a value that contributes while it lives.
   */
  effectContributions?: (effect: EffectInstance) => Contribution[];
  /**
   * Related-info pass: pure function of the final post-plan facts, returning the
   * annotations to surface (illegal-but-visible riders, "+Nd8 radiant" chips,
   * etc.). Evaluated once against the settled sheet; the UI matches each
   * annotation's `targets` against panel `annotationLabels` (unchanged from v1).
   */
  annotate?: (f: FactReader) => Annotation[];
  /**
   * Passive reaction to a rest recorded THIS turn: return persistent effects to
   * emit. This is the ONLY way a non-planned module contributes effects — every
   * other effect comes from a planned offer's `apply`. The engine runs it after
   * the plan settles (so `facts` reflect the recorded rest), folds the returned
   * effects back into the sheet (so they are visible in the same evaluation), and
   * commits them at end of turn.
   *
   * It exists because some recoveries can't be aged per-effect: Channel Divinity
   * regains ONE use on a short rest (so `untilShortRest` spends can't simply age
   * out — that would refund every use), and a Human regains Heroic Inspiration on
   * a long rest. Emit a keyed effect to make the grant idempotent (a second rest
   * does not stack). Pure: a function of the rest kind and the post-plan facts.
   */
  onRest?: (kind: RestKind, facts: FactReader) => EffectInstance[];
}

/**
 * Which rest was recorded this turn. A long rest also confers a short rest's
 * benefits, but the engine reports the single highest kind that occurred; a
 * module that recovers on a short rest handles the long-rest case itself (often
 * for free, when its spends are `untilLongRest` and simply age out).
 */
export type RestKind = 'short' | 'long';

/** One condition under which a persistent effect ends. */
export type Expiry =
  | { kind: 'untilLongRest' }
  /**
   * Ends on the next short rest. A long rest grants a short rest's benefits too,
   * so it also ends an `untilShortRest` effect (whereas `untilLongRest` ends only
   * on a long rest).
   */
  | { kind: 'untilShortRest' }
  | { kind: 'endOfTurn' }
  | { kind: 'turns'; remaining: number }
  /**
   * Never aged by `endTurn` — survives turns and long rests. For prepared spells
   * / conditions that persist until explicitly removed (the UI's removeEffect),
   * not by the clock.
   */
  | { kind: 'permanent' };

/**
 * When an effect ends: a single condition, or several — in which case it ends as
 * soon as the EARLIEST fires. A duration buff that also ends on a rest is
 * `[{ kind: 'turns', remaining }, { kind: 'untilShortRest' }]` (v1 modelled this
 * with a `when rest.short == 0 && rest.long == 0` guard on the buff's
 * re-advertise). A single condition stays a single object — no array churn.
 */
export type ExpirySpec = Expiry | Expiry[];

/**
 * A persistent or per-turn effect: a serializable value (not a self-replicating
 * rule), aged/expired at end of turn.
 *
 * While active it contributes to the sheet. By default `state` is read as fact
 * deltas (each `fact: amount` is summed into that fact) — so a spent L1 slot is
 * `state: { 'spellcasting.slots.level1.spent': 1 }`. For parameterized effects
 * an owning module (`ruleId`) may instead provide `effectContributions`.
 */
export interface EffectInstance {
  id: string;
  ruleId?: string;
  /**
   * Logical identity for replacement effects. Two effects sharing a `key` do NOT
   * stack: the newest (advertised-after-committed) evicts the older, both when
   * the sheet is built and when effects are committed at end of turn — so a
   * re-applied modifier (set Max HP to +5, then +10) replaces rather than sums.
   * Keyless effects (the common per-turn spend) never dedupe.
   */
  key?: string;
  /** Fact deltas contributed while active (summed by default), unless the owning module overrides via effectContributions. */
  state?: Record<string, number>;
  /**
   * Per-fact combine override for `state` deltas (default `sum`). Lets an effect
   * contribute `override`/`max` to a fact — e.g. two different floors taking the
   * `max` rather than summing. Combine conflicts are rejected by the sheet.
   */
  stateCombine?: Record<string, CombineMode>;
  expiry: ExpirySpec;
}

// === ENGINE I/O (M1) ===

/** Overall evaluation status (mirrors the v1 contract). */
export interface Status {
  ok: boolean;
  legal: boolean;
  applicable: boolean;
}

/** The serializable, UI-renderable subset of an offered rule (what PanelRenderer reads). */
export interface OfferRuleDescriptor {
  id: string;
  ui?: Record<string, unknown>;
  vars?: Record<string, unknown>;
  description?: string;
}

/** An offered rule with legality metadata (mirrors v1 AvailableRuleEntry). */
export interface AvailableRuleEntry {
  rule: OfferRuleDescriptor;
  legal: boolean;
  applicable: boolean;
  diagnostics: Diagnostic[];
}

/** Rider chip data on an annotation (mirrors v1). */
export interface AnnotationRider {
  label: string;
  type: 'dice' | 'modifier' | 'effect';
  costTags?: string[];
  legal?: boolean;
  illegalReason?: string;
}

/** Related-info annotation produced for action panels (mirrors v1). */
export interface Annotation {
  key: string;
  targets: string[];
  rider?: AnnotationRider;
}

/**
 * Complete input to the v2 engine. `evaluate` runs `modules` directly and stays
 * pure/sync (it never touches the registry, so it doesn't eagerly bundle every
 * module). `ruleGroupIds` records where those modules came from, when known, so a
 * turn can be persisted and replayed by id — modules carry functions and do not
 * survive JSON. Resolution id → modules is an explicit step (`resolveInput`, or
 * the M2 lazy loader), not something `evaluate` does.
 */
export interface EngineInput {
  modules: RuleModule[];
  /** The rule-group ids `modules` were resolved from (provenance for serialize/replay). */
  ruleGroupIds?: string[];
  inputFacts?: Facts;
  planned?: PlannedRef[];
  committed?: EffectInstance[];
}

/**
 * The JSON-safe projection of an `EngineInput`: rule-group ids instead of module
 * objects. Persist this; rehydrate with `resolveInput` (sync) or the lazy loader.
 */
export interface SerializableInput {
  ruleGroupIds: string[];
  inputFacts?: Facts;
  planned?: PlannedRef[];
  committed?: EffectInstance[];
}

/** Complete output of the v2 engine, composing all passes. */
export interface EngineOutput {
  status: Status;
  facts: Facts;
  availableRules: AvailableRuleEntry[];
  /** Per-planned-instance legality problems, keyed by instanceId. */
  planDiagnostics: Record<string, Diagnostic[]>;
  annotations: Annotation[];
  /** Effects advertised this turn (the UI commits these at end of turn). */
  effects: EffectInstance[];
  diagnostics: { errors: Diagnostic[]; warnings: Diagnostic[]; notices: Diagnostic[] };
  /** Replayable input — re-running it yields an equivalent result. */
  next: EngineInput;
}

/** A legality/diagnostic message (mirrors the v1 contract shape). */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning' | 'notice';
}

/**
 * The result of applying a planned action: fact deltas to merge into the working
 * turn state, plus any per-action legality problems (which drive
 * illegal-but-visible on planned items).
 */
export interface ActionResult {
  /**
   * Effects this action contributes — the ONLY way an action changes state.
   * Per-turn spends use `endOfTurn`, durable ones `untilLongRest`. The fold
   * re-derives the sheet with effects-so-far before each subsequent action, so
   * every spend is visible to later actions in the same turn.
   */
  advertise?: EffectInstance[];
  diagnostics?: Diagnostic[];
}

/**
 * A legality gate on an offer. If `condition` is false the offer is still shown
 * but marked illegal, with `diagnostics` attached (illegal-but-visible).
 */
export interface LegalWhen {
  condition: (f: FactReader) => boolean;
  diagnostics: Diagnostic[];
}

/**
 * What a module advertises to the UI. `id`/`ui`/`vars` are plain data so the
 * existing PanelRenderer keeps working; `apply` is the pure transition run when
 * this offer is added to the plan.
 */
export interface Offer {
  id: string;
  ui?: Record<string, unknown>;
  vars?: Record<string, unknown>;
  /**
   * Structural gate (v1's `when`): when it returns false the offer is OMITTED
   * from availableRules entirely — e.g. only offer Divine Smite when it is
   * prepared. Distinct from `legalWhen`, which keeps the offer visible but marks
   * it illegal. The apply registry still sees every offer, so a force-planned /
   * stale action whose `when` now fails can still be evaluated.
   */
  when?: (f: FactReader) => boolean;
  legalWhen?: LegalWhen[];
  apply?: (state: FactReader, selections: Record<string, unknown>) => ActionResult;
}

/** UI-facing offer entry (the `apply` is stripped; legality is resolved). */
export interface OfferEntry {
  id: string;
  ui?: Record<string, unknown>;
  vars?: Record<string, unknown>;
  legal: boolean;
  diagnostics: Diagnostic[];
}

/** A planned action instance: a reference to an offer id plus its selections. */
export interface PlannedRef {
  instanceId: string;
  ruleId: string;
  selections?: Record<string, unknown>;
}
