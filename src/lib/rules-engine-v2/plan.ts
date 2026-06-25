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

export interface PlanResult {
  /** Working turn facts after folding every planned action over the baseline. */
  facts: Facts;
  /** Per-planned-instance legality problems, keyed by instanceId. */
  planDiagnostics: Map<string, Diagnostic[]>;
  /** Persistent effects advertised by the planned actions this turn. */
  advertised: EffectInstance[];
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const d of diagnostics) {
    const key = `${d.severity}:${d.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(d);
    }
  }
  return out;
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
 * Legality for a planned action is the union of (a) its offer's `legalWhen`
 * evaluated against the state just before it applies, and (b) any diagnostics its
 * `apply` returns. This means a force-planned / stale-plan action is flagged
 * illegal even when its `apply` doesn't re-check the gate — and it still applies
 * (illegal-but-visible extends to planned items). Because `legalWhen` is data,
 * the engine resolves it automatically; authors don't re-encode the condition.
 *
 * Plan order is significant by design (a turn is an ordered sequence) — unlike
 * the order-independent sheet pass.
 *
 * Pure: same (initialFacts, planned, modules) → same result.
 *
 * @param initialFacts Baseline turn state (typically the sheet output).
 * @param planned      Ordered planned action references.
 * @param modules      Modules whose offers supply the transitions + legality.
 */
export function evaluatePlan(
  initialFacts: Facts,
  planned: PlannedRef[],
  modules: RuleModule[]
): PlanResult {
  // Action registry: offer id -> Offer. collectOffers enforces globally-unique
  // offer ids, so the executed transition can never depend on module load order.
  const offerById = new Map<string, Offer>();
  for (const offer of collectOffers(modules)) offerById.set(offer.id, offer);

  let facts: Facts = { ...initialFacts };
  const planDiagnostics = new Map<string, Diagnostic[]>();
  const advertised: EffectInstance[] = [];

  for (const ref of planned) {
    const offer = offerById.get(ref.ruleId);
    if (!offer) continue; // unknown offer (e.g. removed rule group)

    const reader: FactReader = {
      num: (name) => facts[name] ?? 0,
      has: (name) => Object.prototype.hasOwnProperty.call(facts, name)
    };

    const diagnostics: Diagnostic[] = [];
    // (a) legalWhen safety net, evaluated against the pre-apply state.
    for (const gate of offer.legalWhen ?? []) {
      if (!gate.condition(reader)) diagnostics.push(...gate.diagnostics);
    }

    // The action still applies even if illegal (illegal-but-visible).
    if (offer.apply) {
      const result = offer.apply(reader, ref.selections ?? {});
      facts = { ...facts, ...result.facts };
      if (result.diagnostics) diagnostics.push(...result.diagnostics); // (b)
      if (result.advertise) advertised.push(...result.advertise);
    }

    const deduped = dedupeDiagnostics(diagnostics);
    if (deduped.length > 0) planDiagnostics.set(ref.instanceId, deduped);
  }

  return { facts, planDiagnostics, advertised };
}
