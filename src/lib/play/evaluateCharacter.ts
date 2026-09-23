import { evaluate, plannedEntries, type PlannedEntry } from '$lib/rules-engine';
import type {
  AvailableRuleEntry,
  EffectInstance,
  EngineOutput,
  Facts,
  PlannedRef,
  RuleModule
} from '$lib/rules-engine';
import { deriveTopBarEntries, deriveResourceEntries } from './derivePanels';
import type { UiEntry } from './extractTopBar';

/**
 * The evaluation entry point for the play store.
 *
 * The store loads a character's modules once (async `loadModules`, at character
 * load), then re-evaluates synchronously on every plan change. `evaluate` is
 * sync, so this helper is the single sync call the store makes each tick: it runs
 * the engine and returns everything the UI consumes, already adapted —
 *  - `availableRules` (the offer catalog — already view-shaped),
 *  - `plannedEntries` (per-instance legality folded on, via the W1 adapter),
 *  - `topBarEntries` / `resourceEntries` (the facts-driven panels, `derivePanels`),
 *  - `advertised` (the effects to commit at end of turn),
 *  - `facts`.
 * Pure given the modules; unit-tested with the real rule modules.
 */
export interface CharacterEvaluation {
  facts: Facts;
  /** The full offer catalog (section-gated offers), view-shaped for the UI. */
  availableRules: AvailableRuleEntry[];
  /** Per-planned-instance entries with legality + selections folded in. */
  plannedEntries: PlannedEntry[];
  topBarEntries: UiEntry[];
  resourceEntries: UiEntry[];
  /** Effects advertised this turn — the store commits these on End Turn. */
  advertised: EffectInstance[];
  /** The raw engine output — the store adapts this to the view `EngineOutput`. */
  raw: EngineOutput;
}

export function evaluateCharacter(
  modules: RuleModule[],
  committed: EffectInstance[],
  planned: PlannedRef[],
  inputFacts: Facts = {}
): CharacterEvaluation {
  const output = evaluate({ modules, inputFacts, planned, committed });
  return {
    facts: output.facts,
    availableRules: output.availableRules,
    plannedEntries: plannedEntries(output, planned),
    topBarEntries: deriveTopBarEntries(output.facts),
    resourceEntries: deriveResourceEntries(output.facts),
    advertised: output.effects,
    raw: output
  };
}

/**
 * The per-planned-item "alternatives" map (one hypothetical evaluation per
 * planned item, for the OR INSTEAD picker): the offer catalog evaluated over
 * the plan PREFIX ahead of that item — the state at the moment of the row's
 * choice. An alternative replaces the row's current option, so the gates it
 * must pass are the ones at the row's position in the fold: `evaluatePlan`
 * judges each row's own legality against exactly this state (committed +
 * earlier rows), and a later row's spend happens after this row's choice.
 * Keyed by the row's instance id.
 */
export function hypotheticalOffers(
  modules: RuleModule[],
  committed: EffectInstance[],
  planned: PlannedRef[],
  inputFacts: Facts = {}
): Map<string, AvailableRuleEntry[]> {
  const map = new Map<string, AvailableRuleEntry[]>();
  for (const [index, item] of planned.entries()) {
    map.set(
      item.instanceId,
      evaluate({ modules, inputFacts, planned: planned.slice(0, index), committed }).availableRules
    );
  }
  return map;
}
