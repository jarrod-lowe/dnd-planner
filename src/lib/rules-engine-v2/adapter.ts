import type { AvailableRuleEntry, EngineOutput, PlannedRef } from './types';

/**
 * M4 contract adapter (W1) — bridges the v2 `EngineOutput` to the shape the play
 * UI consumes, so the existing PanelRenderer/PlanStack keep working unchanged at
 * the cutover.
 *
 * Most of the output already matches: v2's `AvailableRuleEntry` is
 * `{ rule, legal, applicable, diagnostics }` — the same fields the UI reads
 * (`rule.id/ui/vars/description`, `legal`, `applicable`, `diagnostics`) — and the
 * top-level `facts`/`annotations`/`effects` carry over directly. The one thing v2
 * splits out is **per-planned-instance** legality: v1 folded it into each planned
 * item's own entry, whereas v2 returns it in `planDiagnostics` keyed by
 * `instanceId`. This module reunites them.
 */

/** A planned item's offer, resolved with its per-instance legality + selections. */
export interface PlannedEntry extends AvailableRuleEntry {
  /** The planned instance this entry is for. */
  instanceId: string;
  /** The captured selections (slider / dice / level) for this instance. */
  selections?: Record<string, unknown>;
}

/** True when no diagnostic is an error (warnings/notices stay legal-but-flagged). */
function isLegal(diagnostics: readonly { severity: string }[]): boolean {
  return !diagnostics.some((d) => d.severity === 'error');
}

/**
 * The per-instance entry for one planned ref: the offer whose id is the ref's
 * `ruleId`, carrying that instance's `planDiagnostics` (and the derived `legal`)
 * plus its captured `selections`. Returns `undefined` if the offer is not present
 * (e.g. a stale plan item whose `when` gate no longer holds).
 */
export function plannedEntry(output: EngineOutput, ref: PlannedRef): PlannedEntry | undefined {
  const offer = output.availableRules.find((e) => e.rule.id === ref.ruleId);
  if (!offer) return undefined;
  const diagnostics = output.planDiagnostics[ref.instanceId] ?? [];
  return {
    rule: ref.selections ? { ...offer.rule, vars: offer.rule.vars } : offer.rule,
    legal: isLegal(diagnostics),
    applicable: offer.applicable,
    diagnostics,
    instanceId: ref.instanceId,
    selections: ref.selections
  };
}

/** The per-instance entries for every planned ref, in plan order (skips missing offers). */
export function plannedEntries(output: EngineOutput, planned: readonly PlannedRef[]): PlannedEntry[] {
  const entries: PlannedEntry[] = [];
  for (const ref of planned) {
    const entry = plannedEntry(output, ref);
    if (entry) entries.push(entry);
  }
  return entries;
}
