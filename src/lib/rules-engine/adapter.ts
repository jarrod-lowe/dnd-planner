import type { AvailableRuleEntry, EngineOutput, PlannedRef } from './types';

/**
 * M4 contract adapter (W1) — bridges the engine `EngineOutput` to the shape the play
 * UI consumes, so the existing PanelRenderer/PlanStack keep working unchanged at
 * the cutover.
 *
 * Most of the output already matches: the engine's `AvailableRuleEntry` is
 * `{ rule, legal, applicable, diagnostics }` — the same fields the UI reads
 * (`rule.id/ui/vars/description`, `legal`, `applicable`, `diagnostics`) — and the
 * top-level `facts`/`annotations`/`effects` carry over directly. The one thing the engine
 * splits out is **per-planned-instance** legality: the view contract folds it into
 * each planned item's own entry, whereas the engine returns it in `planDiagnostics` keyed by
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
 * The per-instance entry for one planned ref: the offer that RAN at this
 * instance's step (from `plannedOffers`), carrying that instance's
 * `planDiagnostics` (and the derived `legal`) plus its captured `selections`.
 *
 * Built from the step-time offer, not the final `availableRules` catalog, so a
 * self-gate-closing action (e.g. Dismiss Steed, whose own apply clears the
 * `summoned` gate it is offered under) keeps its row + diagnostics. Returns
 * `undefined` when the offer never ran — its `when` was already closed at its own
 * step (a genuinely stale row) — so that row falls back to inapplicable.
 */
export function plannedEntry(output: EngineOutput, ref: PlannedRef): PlannedEntry | undefined {
  const offer = output.plannedOffers?.[ref.instanceId];
  if (!offer) return undefined;
  const diagnostics = output.planDiagnostics[ref.instanceId] ?? [];
  return {
    rule: offer.rule,
    legal: isLegal(diagnostics),
    applicable: offer.applicable,
    diagnostics,
    instanceId: ref.instanceId,
    selections: ref.selections
  };
}

/** The per-instance entries for every planned ref, in plan order (skips missing offers). */
export function plannedEntries(
  output: EngineOutput,
  planned: readonly PlannedRef[]
): PlannedEntry[] {
  const entries: PlannedEntry[] = [];
  for (const ref of planned) {
    const entry = plannedEntry(output, ref);
    if (entry) entries.push(entry);
  }
  return entries;
}
