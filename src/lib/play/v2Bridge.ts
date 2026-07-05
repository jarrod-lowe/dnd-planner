import type {
  Rule,
  Activity,
  EngineOutput as V1EngineOutput,
  AvailableRuleEntry as V1Entry
} from '$lib/rules-engine';
import {
  plannedEntries,
  type EffectInstance,
  type EngineOutput as V2EngineOutput,
  type ExpirySpec,
  type Expiry,
  type PlannedRef,
  type AvailableRuleEntry as V2Entry
} from '$lib/rules-engine-v2';

/**
 * M4/W4 — bridges the v2 engine's output/effects back to the v1-shaped objects the
 * play store + UI already consume, so the components render unchanged at the
 * cutover. Two directions:
 *  - `adaptV2EngineOutput` — v2 `EngineOutput` → the v1 `EngineOutput` the store
 *    stores (offer catalog + per-instance planned entries as `availableRules`,
 *    facts/annotations/effects passed through, `collections`/`trace`/`next` stubbed).
 *  - `effectInstanceToRule` — a committed `EffectInstance` → the v1 effect `Rule`
 *    the active-effects strip + `effectUtils` inspect (duration from `expiry`, a
 *    synthesized concentration activity, the key as its group).
 */

/** Pull the turns-based duration out of an expiry (for the effect chip's pips). */
function durationFromExpiry(expiry: ExpirySpec): { countDown: number; duration: number } | null {
  const specs: Expiry[] = Array.isArray(expiry) ? expiry : [expiry];
  const turns = specs.find((e): e is Extract<Expiry, { kind: 'turns' }> => e.kind === 'turns');
  if (!turns) return null;
  // The EffectInstance keeps only the remaining count, so total = remaining here.
  return { countDown: turns.remaining, duration: turns.remaining };
}

/** True when every expiry condition is `permanent`. */
function isPermanent(expiry: ExpirySpec): boolean {
  const specs: Expiry[] = Array.isArray(expiry) ? expiry : [expiry];
  return specs.every((e) => e.kind === 'permanent');
}

/**
 * Whether an effect is pure resource/economy bookkeeping — a spend the ledger
 * already shows, not a player-facing "active effect". True when it has state and
 * every fact it touches is a `*.spent` economy fact (actions/spellcasting/slots/
 * smite/…) or movement — but NOT `concentration.spent`, which is the concentration
 * marker and belongs on the strip.
 */
function isResourceOnly(state: Record<string, number>): boolean {
  const keys = Object.keys(state);
  if (keys.length === 0) return false;
  return keys.every(
    (k) =>
      (k.endsWith('.spent') && k !== 'concentration.spent') || k.startsWith('character.movement')
  );
}

/**
 * Whether the effect should be hidden from the active-effects strip by default.
 * A module opts an effect INTO the strip by giving it `display` metadata; the v2
 * build (abilities, equipment, prepared spells, proficiencies), settings, and
 * slot/economy spends carry no `display` and are `permanent`/resource, so they stay
 * hidden (still revealable via the strip's eye toggle). Concentration always shows.
 */
function shouldHideFromStrip(effect: EffectInstance): boolean {
  if (effect.display) return false;
  const state = effect.state ?? {};
  if ((state['concentration.spent'] ?? 0) > 0) return false;
  return isPermanent(effect.expiry) || isResourceOnly(state);
}

/**
 * Convert a v2 committed `EffectInstance` into the v1 effect `Rule` shape the
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
  if (shouldHideFromStrip(effect)) ui.hidden = true;
  return {
    id: effect.id,
    ...(effect.key ? { group: [effect.key] } : {}),
    ui,
    activities
  };
}

/** A planned instance rendered as a v1 availableRules entry, keyed by instanceId. */
function plannedAsV1Entry(rule: Rule, legal: boolean, applicable: boolean, diagnostics: V1Entry['diagnostics'], instanceId: string, selections?: Record<string, unknown>): V1Entry {
  return {
    rule: { ...rule, id: instanceId, activities: rule.activities ?? [], ...(selections ? { selections } : {}) },
    legal,
    applicable,
    diagnostics
  };
}

/** A v2 offer entry → the v1 availableRules shape (descriptor gets an empty activities). */
function offerAsV1Entry(entry: V2Entry): V1Entry {
  return {
    rule: { ...(entry.rule as Rule), activities: (entry.rule as Rule).activities ?? [] },
    legal: entry.legal,
    applicable: entry.applicable,
    diagnostics: entry.diagnostics
  };
}

/**
 * Adapt a list of v2 offer entries to the v1 `AvailableRuleEntry` shape the UI
 * consumes (the store uses this for the per-item "alternatives" hypotheticals).
 */
export function offersToV1Entries(entries: V2Entry[]): V1Entry[] {
  return entries.map(offerAsV1Entry);
}

/**
 * Adapt a v2 `EngineOutput` (plus the plan) to the v1 `EngineOutput` the store
 * stores. `availableRules` carries the offer catalog AND one entry per planned
 * instance (id = instanceId, legality from `planDiagnostics`), so the store's
 * existing "look up by rule id" continues to find both offers and plan-item legality.
 */
export function adaptV2EngineOutput(output: V2EngineOutput, planned: PlannedRef[]): V1EngineOutput {
  const offers = output.availableRules.map(offerAsV1Entry);
  const instances = plannedEntries(output, planned).map((pe) =>
    plannedAsV1Entry(pe.rule as Rule, pe.legal, pe.applicable, pe.diagnostics, pe.instanceId, pe.selections)
  );
  return {
    status: output.status,
    facts: output.facts,
    collections: {},
    availableRules: [...offers, ...instances],
    // v2 annotations are structurally the v1 shape (costTags is a widened string[]).
    annotations: output.annotations as unknown as V1EngineOutput['annotations'],
    diagnostics: output.diagnostics,
    trace: { appliedRuleIds: [], appliedActivityIds: [], providedCapabilities: [], emittedEvents: [] },
    effects: output.effects.map(effectInstanceToRule),
    next: { schemaVersion: 1, rules: { standing: [], planned: [], effects: [] }, state: { facts: output.facts } }
  };
}
