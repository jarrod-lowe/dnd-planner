import type {
  Diagnostic,
  EffectInstance,
  Facts,
  Offer,
  PlannedRef,
  RestKind,
  RuleModule
} from './types';
import { evaluateSheet } from './sheet';
import { collectOffers } from './offers';
import { plainReader } from './reader';
import { checkDeadline, DEFAULT_BUDGET_MS } from './watchdog';

/** Diagnostic for an action planned after a rest — a rest is terminal for the plan. */
const AFTER_REST = 'planner.after-rest';

export interface PlanResult {
  /** Projected turn facts after folding every planned action over the baseline. */
  facts: Facts;
  /** Per-planned-instance legality problems, keyed by instanceId. */
  planDiagnostics: Map<string, Diagnostic[]>;
  /**
   * Instance ids whose planned action is illegal — a `legalWhen` gate failed
   * (ANY severity, matching `evaluateOffers`) or its `apply` returned an error.
   * Tracked apart from `planDiagnostics` so a warning-severity gate failure (e.g.
   * donning a shield while not proficient — "a warning that still blocks") still
   * reads illegal, rather than being inferred back from diagnostic severity.
   */
  planIllegal: Set<string>;
  /** Effects advertised by the planned actions this turn (per-turn + durable). */
  advertised: EffectInstance[];
  /**
   * The offer each planned instance ran (captured at its step), keyed by
   * instanceId — so a row whose offer later drops out of the catalog because its
   * own apply closed the `when` gate still resolves. Only offers that actually
   * executed are recorded.
   */
  plannedOffers: Map<string, Offer>;
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
 * An action changes state only by advertising effects. Before each action the
 * sheet is re-derived from `committed + advertised-so-far`, so every prior
 * spend — whether a per-turn `endOfTurn` effect (an action/attack) or a durable
 * `untilLongRest` one (a spell slot) — is visible to the action's `legalWhen`
 * and `apply`. This is what makes "later actions see earlier results" hold for
 * effect-based spends, not just direct deltas.
 *
 * Legality for a planned action is the union of (a) its offer's `legalWhen`
 * against that re-derived state and (b) any diagnostics its `apply` returns; the
 * action still applies when illegal (illegal-but-visible extends to planned
 * items). Because `legalWhen` is data, the engine resolves it automatically.
 *
 * Plan order is significant by design; the sheet pass it builds on is not.
 *
 * Pure: same (modules, inputFacts, planned, committed) → same result.
 *
 * @param modules    All loaded rule modules.
 * @param inputFacts Player-set input facts (e.g. ability scores).
 * @param planned    Ordered planned action references.
 * @param committed  Effects persisted from prior turns (default none).
 * @param deadline   Optional wall-clock deadline (epoch ms); the fold throws
 *                   EngineTimeoutError if a step starts past it. Omit for no cap.
 * @param budgetMs   The budget the deadline came from, for the error message.
 */
export function evaluatePlan(
  modules: RuleModule[],
  inputFacts: Facts,
  planned: PlannedRef[],
  committed: EffectInstance[] = [],
  deadline?: number,
  budgetMs: number = DEFAULT_BUDGET_MS
): PlanResult {
  // Action registry: offer id -> Offer. collectOffers enforces globally-unique
  // offer ids, so the executed transition can never depend on module load order.
  const offerById = new Map<string, Offer>();
  for (const offer of collectOffers(modules)) offerById.set(offer.id, offer);

  const planDiagnostics = new Map<string, Diagnostic[]>();
  const planIllegal = new Set<string>();
  const plannedOffers = new Map<string, Offer>();
  const advertised: EffectInstance[] = [];

  for (const ref of planned) {
    checkDeadline(deadline, 'plan fold', budgetMs);
    // Re-derive the working state reflecting all spends so far this turn.
    const facts = evaluateSheet(modules, inputFacts, [...committed, ...advertised]);
    const reader = plainReader(facts);

    const offer = offerById.get(ref.ruleId);
    if (!offer) continue; // unknown offer (e.g. removed rule group)
    // a planned action whose structural `when` gate is closed does not
    // execute — e.g. an attack whose weapon an earlier plan step stowed. The offer
    // also vanishes from the catalog (evaluateOffers honors `when`), so the UI
    // shows the row as inapplicable rather than spending its resources.
    if (offer.when && !offer.when(reader)) continue;

    // A rest recorded at an EARLIER step is terminal for the plan: any later
    // action is illegal AND does not execute. Otherwise the post-fold rest hook
    // (onRest) and endTurn aging, which run against the final facts, would
    // recover/expire effects the post-rest action created — e.g. a short rest
    // then Divine Sense would refund the Channel Divinity use. This is the one
    // case where an illegal planned item is NOT applied (no spend), since a spend
    // after the rest is exactly what must not happen. Rest flags are endOfTurn, so
    // this only fires within the same plan, never on turns after a committed rest.
    if (reader.num('rest.short') > 0 || reader.num('rest.long') > 0) {
      plannedOffers.set(ref.instanceId, offer);
      planIllegal.add(ref.instanceId);
      planDiagnostics.set(ref.instanceId, [{ code: AFTER_REST, severity: 'error' }]);
      continue;
    }

    // The offer ran (its `when` held at this step). Record it so the row resolves
    // even if its own apply closes the gate (dropping it from the final catalog).
    plannedOffers.set(ref.instanceId, offer);

    // Legality mirrors the catalog: a failed `legalWhen` gate is illegal
    // regardless of its diagnostics' severity (a warning gate still blocks), and
    // an `apply` that returns an error is illegal too.
    let legal = true;
    const diagnostics: Diagnostic[] = [];
    for (const gate of offer.legalWhen ?? []) {
      if (!gate.condition(reader)) {
        legal = false;
        diagnostics.push(...gate.diagnostics);
      }
    }

    if (offer.apply) {
      const result = offer.apply(reader, ref.selections ?? {});
      if (result.diagnostics) {
        if (result.diagnostics.some((d) => d.severity === 'error')) legal = false;
        diagnostics.push(...result.diagnostics);
      }
      // Namespace advertised effect ids by the planned instance for uniqueness.
      (result.advertise ?? []).forEach((effect, i) =>
        advertised.push({ ...effect, id: `${ref.instanceId}#${i}#${effect.id}` })
      );
    }

    if (!legal) planIllegal.add(ref.instanceId);
    const deduped = dedupeDiagnostics(diagnostics);
    if (deduped.length > 0) planDiagnostics.set(ref.instanceId, deduped);
  }

  // After the plan settles, a rest recorded this turn lets passive modules emit
  // persistent effects (Channel Divinity recovery, Human Heroic Inspiration on a
  // long rest) — the one non-planned effect source. Detect the rest from the
  // settled facts, append each module's `onRest` effects to `advertised`, and
  // re-derive so they are visible this evaluation and commit at end of turn.
  checkDeadline(deadline, 'rest hooks', budgetMs);
  const settled = evaluateSheet(modules, inputFacts, [...committed, ...advertised]);
  const reader = plainReader(settled);
  const restKind: RestKind | null =
    reader.num('rest.long') > 0 ? 'long' : reader.num('rest.short') > 0 ? 'short' : null;
  if (restKind) {
    for (const m of modules) {
      if (!m.onRest) continue;
      for (const e of m.onRest(restKind, reader)) advertised.push(e);
    }
  }

  // Final projection includes every spend from the plan plus any rest effects.
  const facts = restKind
    ? evaluateSheet(modules, inputFacts, [...committed, ...advertised])
    : settled;
  return { facts, planDiagnostics, planIllegal, advertised, plannedOffers };
}
