import type { EngineInput, RuleModule, SerializableInput } from './types';
import abilityScores from './rules/ability-scores';
import proficiency from './rules/proficiency';
import ac from './rules/ac';
import hp from './rules/hp';
import classPaladinLevel1 from './rules/class-paladin-level1';
import layOnHands from './rules/lay-on-hands';
import actionEconomy from './rules/action-economy';
import freeActions from './rules/free-actions';
import coreEvents from './rules/core-events';
import heroicInspiration from './rules/heroic-inspiration';
import attacks from './rules/attacks';
import spellcasting from './rules/spellcasting';
import paladinSmite from './rules/paladin-smite';
import divineSmite from './rules/divine-smite';
import divineFavour from './rules/divine-favour';
import speciesHuman from './rules/species-human';

/**
 * Static ruleGroupId -> module registry, keyed by each module's own `id` — which
 * is the **canonical** rule-group id the backend uses everywhere (DynamoDB
 * `ruleGroupId`, `requires`, persisted character assignments, the search index).
 * Keeping the key === `module.id` means published metadata, lazy loading by id,
 * and persisted assignments all share one id namespace.
 *
 * Note the scenarios reference groups as `<directory>/<id>` (a file-location
 * convention); the parity harness strips that prefix to the canonical id before
 * resolving here. M2 keeps this hand-written; the lazy chunk loader (lazy.ts)
 * mirrors these keys.
 */
const MODULES: RuleModule[] = [
  abilityScores,
  proficiency,
  ac,
  hp,
  actionEconomy,
  freeActions,
  coreEvents,
  heroicInspiration,
  attacks,
  spellcasting,
  classPaladinLevel1,
  layOnHands,
  paladinSmite,
  divineSmite,
  divineFavour,
  speciesHuman
];

const REGISTRY: Record<string, RuleModule> = Object.fromEntries(MODULES.map((m) => [m.id, m]));

/** The module for a rule-group id, or undefined if not (yet) ported. */
export function getModule(ruleGroupId: string): RuleModule | undefined {
  return REGISTRY[ruleGroupId];
}

/** Whether a rule-group id has a v2 module. */
export function isRegistered(ruleGroupId: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, ruleGroupId);
}

/** Every registered rule-group id (the ported set). */
export function registeredRuleGroupIds(): string[] {
  return Object.keys(REGISTRY);
}

/**
 * Resolve a list of rule-group ids to modules, preserving order. Ids without a
 * v2 module are returned in `missing` (the harness uses this to skip-list
 * scenarios whose groups aren't all ported yet) rather than throwing — the app
 * never reaches here with an unported group, but the harness deliberately does.
 */
export function resolveModules(ruleGroupIds: string[]): {
  modules: RuleModule[];
  missing: string[];
} {
  const modules: RuleModule[] = [];
  const missing: string[] = [];
  for (const id of ruleGroupIds) {
    const m = REGISTRY[id];
    if (m) modules.push(m);
    else missing.push(id);
  }
  return { modules, missing };
}

/** A rehydrated input plus any ids that had no module (surfaced, not swallowed). */
export interface ResolvedInput {
  input: EngineInput;
  /** Ids with no registered module — stale or not-yet-ported. */
  missing: string[];
}

/**
 * Rehydrate a serialized input into a runnable `EngineInput` via the static
 * registry. Unported/stale ids are returned in `missing` rather than silently
 * dropped: the engine would otherwise compute facts/offers from only the resolved
 * subset (while `next` still echoes the full id list), yielding wrong resources.
 * The caller decides — fall back to v1, warn, or proceed.
 *
 * Lives here (not in the registry-free `input.ts`) because it needs the eager
 * registry; the runtime rehydration path uses the async chunk loader instead.
 */
export function resolveInput(serialized: SerializableInput): ResolvedInput {
  const { modules, missing } = resolveModules(serialized.ruleGroupIds);
  return {
    input: {
      modules,
      ruleGroupIds: serialized.ruleGroupIds,
      inputFacts: serialized.inputFacts,
      planned: serialized.planned,
      committed: serialized.committed
    },
    missing
  };
}
