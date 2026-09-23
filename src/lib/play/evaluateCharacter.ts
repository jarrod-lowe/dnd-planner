import { evaluate, plannedEntries, type PlannedEntry } from '$lib/rules-engine';
import type {
  AvailableRuleEntry,
  EffectInstance,
  EngineOutput,
  Facts,
  PlannedRef,
  RuleModule
} from '$lib/rules-engine';
import type { Facts as ViewFacts } from '$lib/rules-view';
import { adaptEngineOutput } from './engineBridge';
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

/**
 * The facts at a row's POSITION in the fold — `committed` plus the refs ahead
 * of `index`, nothing later: the same state `evaluatePlan` re-derives before
 * each row (`plan.ts` fold), so what a row OPENED on and how the eventual fold
 * judges it cannot disagree by construction.
 *
 * This is the pure seam a row's capture-var defaults are read from (the store's
 * `captureSelections`): the plan and committed set are the synchronous source
 * of truth, so the debounced display cache (`state.facts`) never enters the
 * capture path. Returned through `adaptEngineOutput` — the same bridge
 * `performEvaluation` stores — because capture vars read VIEW facts (a loadout
 * or spell-prepare capture reads facts the bridge synthesizes). `inputFacts`
 * is `{}` for the same reason `performEvaluation` passes none.
 *
 * Pure: same (modules, committed, refs, index) → same facts.
 */
export function factsBeforeRow(
  modules: RuleModule[],
  committed: EffectInstance[],
  refs: PlannedRef[],
  index: number
): ViewFacts {
  const output = evaluate({ modules, inputFacts: {}, planned: refs.slice(0, index), committed });
  return adaptEngineOutput(output).facts;
}
