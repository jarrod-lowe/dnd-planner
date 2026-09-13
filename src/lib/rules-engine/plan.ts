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
import { collectOffersWithModule } from './offers';
import { plainReader } from './reader';
import { checkDeadline, DEFAULT_BUDGET_MS } from './watchdog';

/**
 * Diagnostic for an action planned after a rest. The row is illegal but still
 * executes, like every other illegal planned row — see the fold for why. Its
 * wording is deliberately a WARNING, not a prohibition: the action does happen,
 * and what the player is being told is that its projection may be inaccurate
 * (see the KNOWN REMAINING GAP note below for exactly how).
 */
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
  // Action registry: offer id -> Offer (+ owning module id). collectOffers
  // enforces globally-unique offer ids, so the executed transition can never
  // depend on module load order. `offerModuleId` lets the fold stamp each
  // advertised effect with its owning rule group (for unassign cleanup).
  const offerById = new Map<string, Offer>();
  const offerModuleId = new Map<string, string>();
  for (const { offer, moduleId } of collectOffersWithModule(modules)) {
    offerById.set(offer.id, offer);
    offerModuleId.set(offer.id, moduleId);
  }

  const planDiagnostics = new Map<string, Diagnostic[]>();
  const planIllegal = new Set<string>();
  const plannedOffers = new Map<string, Offer>();
  const advertised: EffectInstance[] = [];
  // How much of `advertised` existed at the moment a rest flag first read true —
  // i.e. everything up to and including the rest row's own apply. The rest hook
  // reads the state at that boundary, never the post-plan state. Null until a
  // rest is seen (and stays null on a plan with no rest).
  let restBoundary: number | null = null;
  // The KIND of that same first rest, captured at the same moment as the
  // boundary so the two can never describe DIFFERENT rests. Deriving the kind
  // afterwards from the settled facts was incoherent on a mixed plan (short rest
  // → … → long rest): the settled facts carry BOTH flags and long wins, so the
  // LATER rest's hooks ran at the EARLIER rest's position — the worst of both.
  let restKindAtBoundary: RestKind | null = null;

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

    // A rest recorded at an EARLIER step makes this action illegal (you can't act
    // out of a rest you already took), but — like every other illegal planned row
    // — it STILL EXECUTES. The planner projects over-commitment; it does not
    // prevent it, and a row that silently did nothing would make the projection
    // lie. Rest flags are endOfTurn, so this only fires within the same plan,
    // never on turns after a committed rest.
    //
    // What keeps the projection honest is the boundary below: the rest hook
    // (onRest) reads the state as it stood AT the rest, so a spend made after it
    // is invisible to the recovery — a short rest then Divine Sense no longer
    // refunds the Channel Divinity use.
    //
    // KNOWN REMAINING GAP (see ISSUES.md §1.41). The boundary fixes what the rest
    // HOOK sees; it does not fix rest-scoped effect EXPIRY, which is still
    // set-wise and has no notion of before/after:
    //   - `sheet.ts` drops every `endsOnRest` effect on each re-derive, so a
    //     long rest then a spell still loses that spell's `untilLongRest` slot
    //     spend, and a concentration spell's `untilShortRest` buff still vanishes
    //     behind a short rest planned earlier in the same turn.
    //   - `effects.ts` `endTurn` ages the same set the same way at commit.
    //   - `slotLevels.ts` / `actionPools.ts` mirror the predicate for the UI.
    // Two more accepted imperfections, both downstream of `onRest` running ONCE,
    // post-settle (the contract RULES_ENGINE.md documents):
    //   - ONLY THE FIRST rest boundary is taken, and the hooks run once. A plan
    //     with two short rests therefore yields ONE recovery, not two. The KIND
    //     is captured with the boundary (below) so both always describe that
    //     same first rest; the consequence is that in `short rest → … → long
    //     rest` only the SHORT rest's hooks fire, so a Human gets no long-rest
    //     Heroic Inspiration. That is the once-only limitation applied honestly
    //     — running the later rest's hooks at the earlier rest's position was
    //     not a better answer, it was an incoherent one.
    //   - A post-rest row cannot SEE the hook's own effects at its own step, so
    //     e.g. `use-hi` after a long rest reports "no inspiration" even though
    //     the splice below makes it spend correctly.
    // Both are knowingly accepted rather than fixed: post-rest plans are a rare
    // corner, and making hooks run per-rest inside the fold would complicate the
    // engine for every other plan. `planner.after-rest` warns the player that a
    // post-rest row's projection may be inaccurate instead.
    //
    // Fixing any of this needs a per-effect "advertised after the rest" marker
    // that survives into persisted state — a separate change. Until then,
    // post-rest execution is honest about spends the hook sees, not about
    // rest-scoped effects expiring.
    const afterRest = reader.num('rest.short') > 0 || reader.num('rest.long') > 0;
    if (afterRest && restBoundary === null) {
      restBoundary = advertised.length;
      // Read from THIS reader (the state at the boundary), not from the settled
      // facts: at this point only the first rest's flag is set, so the kind and
      // the position are guaranteed to be the same rest's.
      restKindAtBoundary = reader.num('rest.long') > 0 ? 'long' : 'short';
    }

    // The offer ran (its `when` held at this step). Record it so the row resolves
    // even if its own apply closes the gate (dropping it from the final catalog).
    plannedOffers.set(ref.instanceId, offer);

    // Legality mirrors the catalog: a failed `legalWhen` gate is illegal
    // regardless of its diagnostics' severity (a warning gate still blocks), and
    // an `apply` that returns an error is illegal too.
    let legal = !afterRest;
    const diagnostics: Diagnostic[] = afterRest ? [{ code: AFTER_REST, severity: 'error' }] : [];
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
      // Namespace advertised effect ids by the planned instance for uniqueness,
      // and stamp the owning rule group so the store can drop the group's
      // committed effects on unassign. An effect that names its own owner keeps it.
      const owningGroup = offerModuleId.get(offer.id);
      (result.advertise ?? []).forEach((effect, i) =>
        advertised.push({
          ...effect,
          id: `${ref.instanceId}#${i}#${effect.id}`,
          ruleGroupId: effect.ruleGroupId ?? owningGroup
        })
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
  // The kind of the rest the boundary points at, captured in the fold. FALLBACK:
  // a rest row that is the plan's LAST step never trips the in-fold check (the
  // flag only reads true at the NEXT step's top), so neither the boundary nor
  // the kind was captured. That plan necessarily has exactly one rest — a second
  // one would have been a step after the first — so the settled facts describe
  // it unambiguously and reading the kind from them is exact.
  const restKind: RestKind | null =
    restKindAtBoundary ??
    (() => {
      const r = plainReader(settled);
      return r.num('rest.long') > 0 ? 'long' : r.num('rest.short') > 0 ? 'short' : null;
    })();
  if (restKind) {
    // The hook must see the state AT the rest, not the post-plan state: a spend
    // planned after the rest has not happened yet as far as the rest is
    // concerned, and a recovery gated on "is a spend outstanding?" (Channel
    // Divinity) would otherwise hand that later spend straight back. `advertised`
    // is append-ordered, so the prefix up to `restBoundary` is exactly
    // "committed + everything through the rest row's own apply". A rest row that
    // was the plan's last step never tripped the check inside the fold, so its
    // boundary is the whole of `advertised` — which is the same window.
    const boundary = restBoundary ?? advertised.length;
    const preRest = evaluateSheet(modules, inputFacts, [
      ...committed,
      ...advertised.slice(0, boundary)
    ]);
    const reader = plainReader(preRest);
    const hookEffects: EffectInstance[] = [];
    for (const m of modules) {
      if (!m.onRest) continue;
      // Rest-recovery effects (Channel Divinity, Heroic Inspiration) carry the
      // same owning-group stamp so unassign drops them too. Collected first, so
      // no hook's output feeds back into the pre-rest reader another hook sees.
      for (const e of m.onRest(restKind, reader))
        hookEffects.push({ ...e, ruleGroupId: e.ruleGroupId ?? m.id });
    }
    // SPLICE at the boundary rather than append. `advertised` is chronological
    // and keyed effects dedupe newest-wins (`dedupeByKey`), so a hook effect
    // appended last would outrank a planned row that came AFTER the rest and
    // shares its key. Heroic Inspiration is exactly that: the Human long-rest
    // grant and `use-hi` share a key so the use replaces the grant — append it
    // last and the player spends HI and still has it. The rest happened at the
    // boundary, so its effects belong there and everything planned after it
    // stays chronologically newer.
    advertised.splice(boundary, 0, ...hookEffects);
  }

  // Final projection includes every spend from the plan plus any rest effects.
  const facts = restKind
    ? evaluateSheet(modules, inputFacts, [...committed, ...advertised])
    : settled;
  return { facts, planDiagnostics, planIllegal, advertised, plannedOffers };
}
