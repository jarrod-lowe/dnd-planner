import { evaluate, plannedEntries, type PlannedEntry } from '$lib/rules-engine-v2';
import type {
  AvailableRuleEntry,
  EffectInstance,
  Facts,
  PlannedRef,
  RuleModule
} from '$lib/rules-engine-v2';
import { deriveTopBarEntries, deriveResourceEntries } from './derivePanels';
import type { UiEntry } from './extractTopBar';

/**
 * M4/W4 — the v2 evaluation entry point for the play store.
 *
 * The store loads a character's modules once (async `loadModules`, at character
 * load), then re-evaluates synchronously on every plan change. v2 `evaluate` is
 * sync, so this helper is the single sync call the store makes each tick: it runs
 * the engine and returns everything the UI consumes, already adapted —
 *  - `availableRules` (the offer catalog — already v1-shaped),
 *  - `plannedEntries` (per-instance legality folded on, via the W1 adapter),
 *  - `topBarEntries` / `resourceEntries` (the facts-driven panels, `derivePanels`),
 *  - `advertised` (the effects to commit at end of turn),
 *  - `facts`.
 * Pure given the modules; unit-tested with the real rule modules.
 */
export interface V2PlayOutput {
  facts: Facts;
  /** The full offer catalog (section-gated offers), v1-shaped for the UI. */
  availableRules: AvailableRuleEntry[];
  /** Per-planned-instance entries with legality + selections folded in. */
  plannedEntries: PlannedEntry[];
  topBarEntries: UiEntry[];
  resourceEntries: UiEntry[];
  /** Effects advertised this turn — the store commits these on End Turn. */
  advertised: EffectInstance[];
}

export function evaluateCharacterV2(
  modules: RuleModule[],
  committed: EffectInstance[],
  planned: PlannedRef[],
  inputFacts: Facts = {}
): V2PlayOutput {
  const output = evaluate({ modules, inputFacts, planned, committed });
  return {
    facts: output.facts,
    availableRules: output.availableRules,
    plannedEntries: plannedEntries(output, planned),
    topBarEntries: deriveTopBarEntries(output.facts),
    resourceEntries: deriveResourceEntries(output.facts),
    advertised: output.effects
  };
}

/**
 * The per-planned-item "alternatives" map (v1 pre-computed one hypothetical
 * evaluation per planned item, with that item removed, for the picker). In v2 this
 * is the same offer catalog evaluated over the plan minus one ref — cheaper (no
 * rule re-parse). Keyed by the removed instance's id.
 */
export function hypotheticalOffers(
  modules: RuleModule[],
  committed: EffectInstance[],
  planned: PlannedRef[],
  inputFacts: Facts = {}
): Map<string, AvailableRuleEntry[]> {
  const map = new Map<string, AvailableRuleEntry[]>();
  for (const item of planned) {
    const others = planned.filter((p) => p.instanceId !== item.instanceId);
    map.set(item.instanceId, evaluate({ modules, inputFacts, planned: others, committed }).availableRules);
  }
  return map;
}
