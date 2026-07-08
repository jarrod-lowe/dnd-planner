import type {
  Rule,
  Activity,
  EngineOutput as ViewOutput,
  AvailableRuleEntry as ViewEntry
} from '$lib/rules-view';
import {
  type EffectInstance,
  type EngineOutput,
  type ExpirySpec,
  type Expiry,
  type AvailableRuleEntry as EngineEntry
} from '$lib/rules-engine';
import type { PlannedEntry } from '$lib/rules-engine';

/**
 * Bridges the engine's output/effects back to the view-shaped objects the
 * play store + UI already consume, so the components render unchanged at the
 * cutover. Two directions:
 *  - `adaptEngineOutput` — engine `EngineOutput` → the view `EngineOutput` the store
 *    stores (`availableRules` is the ADDABLE offer catalog only; per-instance
 *    planned legality flows to the plan rows via the store's plannedEntries map,
 *    never mixed into the catalog — mixed entries leaked into the add/search
 *    pickers as unresolvable duplicates).
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

/**
 * An engine per-instance planned entry → the view entry the plan row consumes.
 * Keeps the OFFER rule id (the row is identified by its item, not this entry);
 * legality/diagnostics are the instance's own (from `planDiagnostics`).
 */
export function plannedEntryToViewEntry(pe: PlannedEntry): ViewEntry {
  return {
    rule: {
      ...(pe.rule as Rule),
      activities: (pe.rule as Rule).activities ?? [],
      ...(pe.selections ? { selections: pe.selections } : {})
    },
    legal: pe.legal,
    applicable: pe.applicable,
    diagnostics: pe.diagnostics
  };
}

/** The class flags the bridge may turn into the saveAbility label, in ability order. */
const SAVE_ABILITY_FLAGS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
/** The steed's damage type by numeric creatureType (celestial / fey / fiend). */
const STEED_DAMAGE_TYPES = ['radiant', 'psychic', 'necrotic'] as const;

/**
 * Engine facts → view facts: adds the STRING facts the numeric engine can't
 * hold but the panels read, synthesized from numeric facts —
 *  - `spellcasting.saveAbility` ('CHA', …), from the class flag
 *    `spellcasting.saveAbility.<ability>` = 1 (the spell saveDc label reads it;
 *    with several set the LAST in ability order wins — moot while single-ability);
 *  - `companion.steed.damageType` ('radiant'/'psychic'/'necrotic'), from the
 *    numeric `companion.steed.creatureType`, only while a steed is summoned (so
 *    creatureType 0 doesn't read as radiant with no steed). The slam dice-line
 *    and description read it.
 * Returns the facts untouched when nothing is synthesized.
 */
function toViewFacts(facts: EngineOutput['facts']): ViewOutput['facts'] {
  const overlay: Record<string, string> = {};

  for (const ability of SAVE_ABILITY_FLAGS) {
    if ((facts[`spellcasting.saveAbility.${ability}`] ?? 0) === 1)
      overlay['spellcasting.saveAbility'] = ability.toUpperCase();
  }

  if ((facts['companion.steed.summoned'] ?? 0) === 1) {
    const label = STEED_DAMAGE_TYPES[facts['companion.steed.creatureType'] ?? -1];
    if (label) overlay['companion.steed.damageType'] = label;
  }

  return Object.keys(overlay).length > 0 ? { ...facts, ...overlay } : facts;
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
 * Adapt an engine `EngineOutput` to the view `EngineOutput` the store stores.
 * `availableRules` is the addable offer catalog only — per-instance planned
 * legality reaches the plan rows through the store's plannedEntries map.
 */
export function adaptEngineOutput(output: EngineOutput): ViewOutput {
  const offers = output.availableRules.map(offerAsViewEntry);
  return {
    status: output.status,
    facts: toViewFacts(output.facts),
    collections: {},
    availableRules: offers,
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
