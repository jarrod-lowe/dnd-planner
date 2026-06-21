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
 * A rule module. The sheet pass only consumes `derive`; later passes add
 * `offer`/`apply`/`effects`/`annotate` to this interface.
 */
export interface RuleModule {
  id: string;
  derive?: (ctx: SheetCtx) => Contribution[];
}
