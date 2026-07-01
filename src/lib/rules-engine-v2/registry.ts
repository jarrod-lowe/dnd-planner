import type { EngineInput, RuleModule, SerializableInput } from './types';
import abilityScores from './rules/ability-scores';
import proficiency from './rules/proficiency';
import ac from './rules/ac';
import hp from './rules/hp';
import classPaladinLevel1 from './rules/class-paladin-level1';
import classPaladinLevel2 from './rules/class-paladin-level2';
import classPaladinLevel3 from './rules/class-paladin-level3';
import classPaladinLevel4 from './rules/class-paladin-level4';
import classPaladinLevel5 from './rules/class-paladin-level5';
import classPaladinDivinity from './rules/class-paladin-divinity';
import classPaladinOathRedemptionLevel3 from './rules/class-paladin-oath-redemption-level3';
import layOnHands from './rules/lay-on-hands';
import actionEconomy from './rules/action-economy';
import freeActions from './rules/free-actions';
import coreEvents from './rules/core-events';
import concentration from './rules/concentration';
import heroicInspiration from './rules/heroic-inspiration';
import attacks from './rules/attacks';
import spellcasting from './rules/spellcasting';
import paladinSmite from './rules/paladin-smite';
import divineSmite from './rules/divine-smite';
import divineFavour from './rules/divine-favour';
import bless from './rules/bless';
import thunderousSmite from './rules/thunderous-smite';
import createAndDestroyWater from './rules/create-and-destroy-water';
import sanctuary from './rules/sanctuary';
import protectionFromEvilAndGood from './rules/protection-from-evil-and-good';
import sleep from './rules/sleep';
import command from './rules/command';
import paladinSpellsL1 from './rules/paladin-spells-l1';
import buildLock from './rules/build-lock';
import initiative from './rules/initiative';
import passiveSkills from './rules/passive-skills';
import simpleActions from './rules/simple-actions';
import dash from './rules/dash';
import grapple from './rules/grapple';
import shove from './rules/shove';
import featAlert from './rules/feat-alert';
import hitDie from './rules/hit-die';
import speciesHuman from './rules/species-human';
import movement from './rules/movement';
import leatherArmor from './rules/leather-armor';
import splintArmor from './rules/splint-armor';
import shield from './rules/shield';
import hands from './rules/hands';
import dagger from './rules/dagger';
import daggerMastery from './rules/dagger-mastery';
import greataxe from './rules/greataxe';
import greataxeMastery from './rules/greataxe-mastery';

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
  concentration,
  heroicInspiration,
  attacks,
  spellcasting,
  classPaladinLevel1,
  classPaladinLevel2,
  classPaladinLevel3,
  classPaladinLevel4,
  classPaladinLevel5,
  classPaladinDivinity,
  classPaladinOathRedemptionLevel3,
  layOnHands,
  paladinSmite,
  divineSmite,
  divineFavour,
  bless,
  thunderousSmite,
  createAndDestroyWater,
  sanctuary,
  protectionFromEvilAndGood,
  sleep,
  command,
  paladinSpellsL1,
  buildLock,
  initiative,
  passiveSkills,
  simpleActions,
  dash,
  grapple,
  shove,
  featAlert,
  hitDie,
  speciesHuman,
  movement,
  leatherArmor,
  splintArmor,
  shield,
  hands,
  dagger,
  daggerMastery,
  greataxe,
  greataxeMastery
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
