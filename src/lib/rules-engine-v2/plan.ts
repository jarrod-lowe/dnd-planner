import type {
  Diagnostic,
  EffectInstance,
  Facts,
  FactReader,
  Offer,
  PlannedRef,
  RuleModule
} from './types';
import { collectOffers } from './offers';

type ApplyFn = NonNullable<Offer['apply']>;

export interface PlanResult {
  /** Working turn facts after folding every planned action over the baseline. */
  facts: Facts;
  /** Per-planned-instance legality problems, keyed by instanceId. */
  planDiagnostics: Map<string, Diagnostic[]>;
  /** Persistent effects advertised by the planned actions this turn. */
  advertised: EffectInstance[];
}

/**
 * Evaluate the turn plan as a pure **left fold** over the planned actions.
 *
 * Each action's `apply(state, selections)` reads the *current* working state —
 * i.e. the result of all earlier actions — and returns fact deltas plus any
 * legality problems. Because "later actions see earlier results" is the
 * definition of a left fold, decisions like extra-attack's "spend a follow-up
 * charge vs. a new action" are a plain branch on current state, with none of
 * v1's snapshot facts.
 *
 * Plan order is significant by design (a turn is an ordered sequence) — unlike
 * the order-independent sheet pass.
 *
 * Pure: same (initialFacts, planned, modules) → same result.
 *
 * @param initialFacts Baseline turn state (typically the sheet output).
 * @param planned      Ordered planned action references.
 * @param modules      Modules whose offers supply the `apply` transitions.
 */
export function evaluatePlan(
  initialFacts: Facts,
  planned: PlannedRef[],
  modules: RuleModule[]
): PlanResult {
  // Build the action registry: offer id -> apply transition. collectOffers
  // enforces globally-unique offer ids, so the executed transition can never
  // depend on module load order.
  const applyById = new Map<string, ApplyFn>();
  for (const offer of collectOffers(modules)) {
    if (offer.apply) applyById.set(offer.id, offer.apply);
  }

  let facts: Facts = { ...initialFacts };
  const planDiagnostics = new Map<string, Diagnostic[]>();
  const advertised: EffectInstance[] = [];

  for (const ref of planned) {
    const apply = applyById.get(ref.ruleId);
    if (!apply) continue; // no transition for this offer (e.g. config-only)
    const reader: FactReader = {
      num: (name) => facts[name] ?? 0,
      has: (name) => Object.prototype.hasOwnProperty.call(facts, name)
    };
    const result = apply(reader, ref.selections ?? {});
    facts = { ...facts, ...result.facts };
    if (result.diagnostics && result.diagnostics.length > 0) {
      planDiagnostics.set(ref.instanceId, result.diagnostics);
    }
    if (result.advertise && result.advertise.length > 0) {
      advertised.push(...result.advertise);
    }
  }

  return { facts, planDiagnostics, advertised };
}
