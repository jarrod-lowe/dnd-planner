import type {
  Rule,
  Activity,
  EngineOutput as ViewOutput,
  AvailableRuleEntry as ViewEntry
} from '$lib/rules-view';
import {
  plannedEntries,
  type EffectInstance,
  type EngineOutput,
  type ExpirySpec,
  type Expiry,
  type PlannedRef,
  type AvailableRuleEntry as EngineEntry
} from '$lib/rules-engine';

/**
 * Bridges the engine's output/effects back to the view-shaped objects the
 * play store + UI already consume, so the components render unchanged at the
 * cutover. Two directions:
 *  - `adaptEngineOutput` — engine `EngineOutput` → the view `EngineOutput` the store
 *    stores (offer catalog + per-instance planned entries as `availableRules`,
 *    facts/annotations/effects passed through, `collections`/`trace`/`next` stubbed).
 *  - `effectInstanceToRule` — a committed `EffectInstance` → the view effect `Rule`
 *    the active-effects strip + `effectUtils` inspect (duration from `expiry`, a
 *    synthesized concentration activity, the key as its group).
 */

/** Pull the turns-based duration out of an expiry (for the effect chip's pips). */
function durationFromExpiry(expiry: ExpirySpec): { countDown: number; duration: number } | null {
  const specs: Expiry[] = Array.isArray(expiry) ? expiry : [expiry];
  const turns = specs.find((e): e is Extract<Expiry, { kind: 'turns' }> => e.kind === 'turns');
  if (!turns) return null;
  // `total` is backfilled by endTurn aging; before any aging, remaining IS the total.
  return { countDown: turns.remaining, duration: turns.total ?? turns.remaining };
}

/**
 * Whether the effect should be hidden from the active-effects strip by default.
 * The `EffectDisplay` contract: `display` present → on the strip (unless it says
 * `hidden: true`, which keeps the name for the reveal toggle but stays off the
 * default view); no `display` → hidden bookkeeping. The concentration marker
 * always shows, display or not.
 */
function shouldHideFromStrip(effect: EffectInstance): boolean {
  if (effect.display) return effect.display.hidden === true;
  if (((effect.state ?? {})['concentration.spent'] ?? 0) > 0) return false;
  return true;
}

/**
 * Convert a committed `EffectInstance` into the view effect `Rule` shape the
 * active-effects UI consumes. The effect's `display` metadata (name / section /
 * displayFact) maps onto the chip's `ui`; a synthesized concentration activity lets
 * `effectUtils.getEffectKind` read `CONC`; build/economy effects (no `display`) are
 * flagged `ui.hidden`.
 */
export function effectInstanceToRule(effect: EffectInstance): Rule {
  const state = effect.state ?? {};
  const activities: Activity[] = [];
  // Reconstruct the concentration marker effectUtils.getEffectKind looks for.
  if ((state['concentration.spent'] ?? 0) > 0) {
    activities.push({
      id: `${effect.id}#conc`,
      type: 'numberIncrement',
      target: { fact: 'concentration.remaining' },
      source: { number: 1 },
      subtract: true
    } as Activity);
  }
  const ui: Record<string, unknown> = {};
  const dur = durationFromExpiry(effect.expiry);
  if (dur) {
    ui.countDown = dur.countDown;
    ui.duration = dur.duration;
  }
  if (effect.display?.name) ui.name = effect.display.name;
  if (effect.display?.section) ui.section = effect.display.section;
  if (effect.display?.displayFact) ui.displayFact = effect.display.displayFact;
  if (effect.display?.subject) ui.subject = effect.display.subject;
  if (shouldHideFromStrip(effect)) ui.hidden = true;
  return {
    id: effect.id,
    ...(effect.key ? { group: [effect.key] } : {}),
    ui,
    activities
  };
}

/** A planned instance rendered as a view availableRules entry, keyed by instanceId. */
function plannedAsViewEntry(
  rule: Rule,
  legal: boolean,
  applicable: boolean,
  diagnostics: ViewEntry['diagnostics'],
  instanceId: string,
  selections?: Record<string, unknown>
): ViewEntry {
  return {
    rule: {
      ...rule,
      id: instanceId,
      activities: rule.activities ?? [],
      ...(selections ? { selections } : {})
    },
    legal,
    applicable,
    diagnostics
  };
}

/** An offer entry → the view availableRules shape (descriptor gets an empty activities). */
function offerAsViewEntry(entry: EngineEntry): ViewEntry {
  return {
    rule: { ...(entry.rule as Rule), activities: (entry.rule as Rule).activities ?? [] },
    legal: entry.legal,
    applicable: entry.applicable,
    diagnostics: entry.diagnostics
  };
}

/**
 * Adapt a list of offer entries to the view `AvailableRuleEntry` shape the UI
 * consumes (the store uses this for the per-item "alternatives" hypotheticals).
 */
export function offersToViewEntries(entries: EngineEntry[]): ViewEntry[] {
  return entries.map(offerAsViewEntry);
}

/**
 * Adapt a engine `EngineOutput` (plus the plan) to the view `EngineOutput` the store
 * stores. `availableRules` carries the offer catalog AND one entry per planned
 * instance (id = instanceId, legality from `planDiagnostics`), so the store's
 * existing "look up by rule id" continues to find both offers and plan-item legality.
 */
export function adaptEngineOutput(output: EngineOutput, planned: PlannedRef[]): ViewOutput {
  const offers = output.availableRules.map(offerAsViewEntry);
  const instances = plannedEntries(output, planned).map((pe) =>
    plannedAsViewEntry(
      pe.rule as Rule,
      pe.legal,
      pe.applicable,
      pe.diagnostics,
      pe.instanceId,
      pe.selections
    )
  );
  return {
    status: output.status,
    facts: output.facts,
    collections: {},
    availableRules: [...offers, ...instances],
    // Annotations are structurally the view shape (costTags is a widened string[]).
    annotations: output.annotations as unknown as ViewOutput['annotations'],
    diagnostics: output.diagnostics,
    trace: {
      appliedRuleIds: [],
      appliedActivityIds: [],
      providedCapabilities: [],
      emittedEvents: []
    },
    effects: output.effects.map(effectInstanceToRule),
    next: {
      schemaVersion: 1,
      rules: { standing: [], planned: [], effects: [] },
      state: { facts: output.facts }
    }
  };
}
