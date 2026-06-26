import type { RuleModule } from './types';
import abilityScores from './rules/ability-scores';
import hp from './rules/hp';
import classPaladinLevel1 from './rules/class-paladin-level1';
import actionEconomy from './rules/action-economy';
import attacks from './rules/attacks';
import spellcasting from './rules/spellcasting';
import paladinSmite from './rules/paladin-smite';
import divineSmite from './rules/divine-smite';

/**
 * Static rule-group-id -> module registry.
 *
 * Keys are the full ruleGroup references the YAML scenarios use
 * (`<directory>/<group-id>`), so the parity harness (W5) can map a scenario's
 * `ruleGroups` list straight to v2 modules. M2 replaces this hand-written map
 * with `import.meta.glob` + lazy per-character chunks loaded by id; the lookup
 * surface (`getModule`/`resolveModules`) stays the same so callers don't change.
 */
const REGISTRY: Record<string, RuleModule> = {
  'dnd-5e-2024/ability-scores': abilityScores,
  'dnd-5e-2024/hp': hp,
  'dnd-5e-2024/action-economy': actionEconomy,
  'dnd-5e-2024/attacks': attacks,
  'dnd-5e-2024/spellcasting': spellcasting,
  'class-paladin/class-paladin-level1': classPaladinLevel1,
  'class-paladin/class-paladin-paladin-smite': paladinSmite,
  'spells/spell-divine-smite': divineSmite
};

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
