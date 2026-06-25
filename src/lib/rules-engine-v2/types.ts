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
 * A rule module. The sheet pass consumes `derive`; the plan/offer passes consume
 * `offer`. Later passes add `effects`/`annotate`.
 */
export interface RuleModule {
  id: string;
  derive?: (ctx: SheetCtx) => Contribution[];
  offer?: (ctx: SheetCtx) => Offer[];
  /**
   * Contributions an ACTIVE persistent effect makes to the sheet (e.g. a spent
   * spell slot adds +1 to `...spent`). The effect replaces v1's self-advertising
   * rule: it is just a value that contributes while it lives.
   */
  effectContributions?: (effect: EffectInstance) => Contribution[];
}

/** When a persistent effect ends. */
export type Expiry =
  | { kind: 'untilLongRest' }
  | { kind: 'endOfTurn' }
  | { kind: 'turns'; remaining: number };

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
  /** Fact deltas contributed while active (summed), unless the owning module overrides via effectContributions. */
  state?: Record<string, number>;
  expiry: Expiry;
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
