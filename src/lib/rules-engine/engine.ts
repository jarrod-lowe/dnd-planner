import type { AvailableRuleEntry, Diagnostic, EngineInput, EngineOutput } from './types';
import { evaluatePlan } from './plan';
import { evaluateOffers } from './offers';
import { collectAnnotations } from './annotate';
import { checkDeadline, deadlineFrom, DEFAULT_BUDGET_MS } from './watchdog';

/** Options for a single evaluation. */
export interface EvaluateOptions {
  /** Wall-clock budget for the whole evaluation (ms). Defaults to DEFAULT_BUDGET_MS. */
  budgetMs?: number;
}

/**
 * The engine entry point: a single pure function composing the passes into
 * the output contract.
 *
 *   sheet(committed) → plan fold (re-derives the sheet with effects-so-far) →
 *   offers(final facts) → annotate(final facts) → output
 *
 * `evaluatePlan` already runs the sheet (initial + per-step re-derive + final),
 * so the plan's `facts` are the projected post-plan facts; offers/annotations are
 * resolved against them.
 *
 * Pure: same input → same output. A wall-clock budget bounds pathological
 * inputs (see watchdog.ts); it never trips for real evaluations.
 */
export function evaluate(input: EngineInput, opts: EvaluateOptions = {}): EngineOutput {
  const { modules, ruleGroupIds, inputFacts = {}, planned = [], committed = [] } = input;
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const deadline = deadlineFrom(budgetMs);

  const plan = evaluatePlan(modules, inputFacts, planned, committed, deadline, budgetMs);
  checkDeadline(deadline, 'offers', budgetMs);
  const offers = evaluateOffers(modules, plan.facts);

  const availableRules: AvailableRuleEntry[] = offers.map((o) => ({
    rule: { id: o.id, ui: o.ui, vars: o.vars },
    legal: o.legal,
    applicable: true,
    diagnostics: o.diagnostics
  }));

  const planDiagnostics: Record<string, Diagnostic[]> = Object.fromEntries(plan.planDiagnostics);
  const planHasError = Object.values(planDiagnostics)
    .flat()
    .some((d) => d.severity === 'error');

  // The offer each planned instance ran, as a view entry — so the plan row
  // resolves from the step-time offer even when its own apply closed the `when`
  // gate (dropping it from `availableRules`). Legality is the fold's verdict
  // (`planIllegal`: a failed gate of any severity, or an apply error), NOT
  // inferred from diagnostic severity — matching the add catalog.
  const plannedOffers: Record<string, AvailableRuleEntry> = {};
  for (const [instanceId, o] of plan.plannedOffers) {
    plannedOffers[instanceId] = {
      rule: { id: o.id, ui: o.ui, vars: o.vars },
      legal: !plan.planIllegal.has(instanceId),
      applicable: true,
      diagnostics: planDiagnostics[instanceId] ?? []
    };
  }

  checkDeadline(deadline, 'annotate', budgetMs);
  const annotations = collectAnnotations(modules, plan.facts);
  // Final checkpoint so a slow annotate cannot overrun the budget silently.
  checkDeadline(deadline, 'done', budgetMs);

  return {
    status: { ok: true, legal: !planHasError, applicable: true },
    facts: plan.facts,
    availableRules,
    planDiagnostics,
    plannedOffers,
    annotations,
    effects: plan.advertised,
    diagnostics: { errors: [], warnings: [], notices: [] },
    // `next` echoes the input: modules for in-memory replay, ruleGroupIds for
    // serialize/replay-by-id (serializeInput projects to the JSON-safe form).
    next: { modules, ruleGroupIds, inputFacts, planned, committed }
  };
}
