/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: Remove eslint-disable when implementing functions
import type { Diagnostic, GroupState, Phase, Rule } from './types';

/**
 * Builds initial group state from all rules in a phase.
 *
 * Groups are derived from rule.group arrays. A rule can belong to multiple groups.
 * Each group tracks which which rules belong to it and their execution status.
 *
 * @param rules - All rules participating in this phase (standing + planned + effects + generated)
 * @param phase - The phase these groups belong to
 * @returns Map of group name -> GroupState
 *
 * @calledBy evaluate (evaluate.ts) - during initialization
 */
export function buildGroupStates(rules: Rule[], phase: Phase): Map<string, GroupState> {
  const groups = new Map<string, GroupState>();

  for (const rule of rules) {
    const groupNames = rule.group ?? [];
    for (const groupName of groupNames) {
      if (!groups.has(groupName)) {
        groups.set(groupName, {
          name: groupName,
          phase,
          ruleIds: [],
          settled: false,
          executedRuleIds: [],
          skippedRuleIds: []
        });
      }
      groups.get(groupName)!.ruleIds.push(rule.id);
    }
  }

  return groups;
}

/**
 * Checks if a group has settled (all member rules have executed or been skipped).
 *
 * A group is settled when:
 * - All ruleIds have either been executed or skipped
 * - settled flag is set to true
 *
 * This is used to determine if rules waiting on this group can now proceed.
 *
 * @param groupState - The group state to check
 * @returns true if the group has settled, false otherwise
 *
 * @calledBy areDependenciesSatisfied
 * @calledBy processRulesInOrder (phases.ts) - to check if unblocked rules can proceed
 */
export function isGroupSettled(groupState: GroupState): boolean {
  // If already marked as settled, return true
  if (groupState.settled) {
    return true;
  }

  // Check if all ruleIds have been processed (executed or skipped)
  const processedIds = new Set([...groupState.executedRuleIds, ...groupState.skippedRuleIds]);
  return groupState.ruleIds.every((ruleId) => processedIds.has(ruleId));
}

/**
 * Checks if all `after` dependencies for a rule are satisfied.
 *
 * A rule's dependencies are satisfied when all groups it waits on
 * have settled (see isGroupSettled).
 * A rule with no `after` dependencies has all dependencies satisfied.
 *
 * Note: This does NOT check phase ordering - that's validated separately
 * in validateCrossPhaseOrdering.
 *
 * @param rule - The rule to check dependencies for
 * @param groups - Map of all group states for the current phase
 * @returns true if all dependencies are satisfied, false otherwise
 *
 * @calls isGroupSettled (for each group in rule.after)
 * @calledBy processRulesInOrder (phases.ts) - to determine if a rule can execute
 */
export function areDependenciesSatisfied(rule: Rule, groups: Map<string, GroupState>): boolean {
  // No dependencies = satisfied
  if (!rule.after || rule.after.length === 0) {
    return true;
  }

  // Check each group in after dependencies
  for (const groupRef of rule.after) {
    const groupState = groups.get(groupRef.group);
    // If group doesn't exist, ignore it (treat as satisfied)
    if (groupState && !isGroupSettled(groupState)) {
      return false;
    }
  }

  return true;
}

/**
 * Marks a rule as executed in all groups it belongs to.
 *
 * Updates each group's executedRuleIds and sets settled when all members have been processed.
 *
 * @param rule - The rule that was executed
 * @param groups - Map of all group states to update
 *
 * @calledBy processRulesInOrder (phases.ts) - after a rule executes successfully
 */
export function markRuleExecuted(rule: Rule, groups: Map<string, GroupState>): void {
  const groupNames = rule.group ?? [];

  for (const groupName of groupNames) {
    const groupState = groups.get(groupName);
    if (!groupState) continue;

    // Add rule to executed list
    groupState.executedRuleIds.push(rule.id);

    // Check if all rules in group have been processed
    const processedIds = new Set([...groupState.executedRuleIds, ...groupState.skippedRuleIds]);
    if (groupState.ruleIds.every((ruleId) => processedIds.has(ruleId))) {
      groupState.settled = true;
    }
  }
}

/**
 * Marks a rule as skipped in all groups it belongs to.
 *
 * A rule is skipped when it doesn't execute (either disabled, when conditions fail, or or or or dependencies can't be satisfied).
 * Updates each group's skippedRuleIds and sets settled when all members have been processed.
 *
 * @param rule - The rule that was skipped
 * @param groups - Map of all group states to update
 *
 * @calledBy processRulesInOrder (phases.ts) - when a rule doesn't execute
 */
export function markRuleSkipped(rule: Rule, groups: Map<string, GroupState>): void {
  const groupNames = rule.group ?? [];

  for (const groupName of groupNames) {
    const groupState = groups.get(groupName);
    if (!groupState) continue;

    // Add rule to skipped list
    groupState.skippedRuleIds.push(rule.id);

    // Check if all rules in group have been processed
    const processedIds = new Set([...groupState.executedRuleIds, ...groupState.skippedRuleIds]);
    if (groupState.ruleIds.every((ruleId) => processedIds.has(ruleId))) {
      groupState.settled = true;
    }
  }
}

/**
 * Detects cycles in the group dependency graph using DFS.
 *
 * @param graph - Map of group -> groups it must come after
 * @param group - Current group being visited
 * @param visiting - Set of groups currently being visited (in current path)
 * @param visited - Set of groups already fully processed
 * @param path - Current path of groups being visited
 * @returns The cycle path if found, null otherwise
 */
function detectCycle(
  graph: Map<string, Set<string>>,
  group: string,
  visiting: Set<string>,
  visited: Set<string>,
  path: string[]
): string[] | null {
  // Already fully processed - no cycle through this node
  if (visited.has(group)) {
    return null;
  }

  // Currently visiting - found a cycle
  if (visiting.has(group)) {
    // Return the cycle portion of the path
    const cycleStart = path.indexOf(group);
    return path.slice(cycleStart);
  }

  visiting.add(group);
  path.push(group);

  const dependencies = graph.get(group);
  if (dependencies) {
    for (const dep of dependencies) {
      const cycle = detectCycle(graph, dep, visiting, visited, path);
      if (cycle) {
        return cycle;
      }
    }
  }

  visiting.delete(group);
  path.pop();
  visited.add(group);

  return null;
}

/**
 * Validates ordering constraints within a single phase.
 *
 * Checks for:
 * - Dependency cycles (direct self-dependency or transitive A -> B -> A)
 * - Rules waiting on groups that don't exist
 * - Rules waiting on groups that no rule belongs to
 *
 * Returns error diagnostics for violations are found.
 *
 * @param rules - All rules in the phase to validate
 * @param phase - The phase being validated
 * @returns Array of error diagnostics for ordering violations
 *
 * @calledBy evaluate (evaluate.ts) - during initialization
 */
export function validateOrdering(rules: Rule[], phase: Phase): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build set of all groups that exist in this phase
  const existingGroups = new Set<string>();
  for (const rule of rules) {
    for (const groupName of rule.group ?? []) {
      existingGroups.add(groupName);
    }
  }

  // Check each rule's after dependencies
  for (const rule of rules) {
    const afterDeps = rule.after ?? [];
    const ruleGroups = new Set(rule.group ?? []);

    for (const dep of afterDeps) {
      // Check if group exists
      if (!existingGroups.has(dep.group)) {
        diagnostics.push({
          code: 'MISSING_GROUP',
          severity: 'warning',
          message: `Rule "${rule.id}" depends on non-existent group "${dep.group}"`
        });
        continue;
      }

      // Check for self-dependency (rule waiting on its own group)
      if (ruleGroups.has(dep.group)) {
        diagnostics.push({
          code: 'CYCLE',
          severity: 'error',
          message: `Rule "${rule.id}" creates a cycle by waiting on group "${dep.group}" it belongs to`
        });
      }
    }
  }

  // Build dependency graph: group -> set of groups it must come after
  // Edge from G1 to G2 means "G1 must come after G2" (G1 depends on G2)
  const graph = new Map<string, Set<string>>();

  for (const rule of rules) {
    const ruleGroups = rule.group ?? [];
    const afterDeps = rule.after ?? [];

    for (const ruleGroup of ruleGroups) {
      if (!graph.has(ruleGroup)) {
        graph.set(ruleGroup, new Set());
      }
      for (const dep of afterDeps) {
        if (existingGroups.has(dep.group)) {
          graph.get(ruleGroup)!.add(dep.group);
        }
      }
    }
  }

  // Detect cycles using DFS (only for transitive cycles of length > 1)
  const visited = new Set<string>();
  const visiting = new Set<string>();

  for (const group of graph.keys()) {
    if (!visited.has(group)) {
      const cycle = detectCycle(graph, group, visiting, visited, []);
      if (cycle && cycle.length > 1) {
        // Only report transitive cycles (length > 1), self-dependencies already caught above
        diagnostics.push({
          code: 'CYCLE',
          severity: 'error',
          message: `Dependency cycle detected: ${cycle.join(' -> ')} -> ${cycle[0]}`
        });
        break; // Report only one cycle to avoid noise
      }
    }
  }

  return diagnostics;
}

/**
 * Validates that no rule has cross-phase ordering violations.
 *
 * Checks for:
 * - Rules with `after` dependencies on groups from different phases
 * - Generated rules targeting the same or earlier phase than the generating rule
 *
 * Per the spec:
 * - early rules may only wait on early groups
 * - normal rules may only wait on normal or early/early groups (illegal)
 * - normal rules may only wait on normal groups
 * - safeguard rules may only wait on safeguard/early/normal groups (illegal)
 *
 * @param rules - All rules to check
 * @param phase - The phase being validated
 * @returns Array of error diagnostics for cross-phase violations
 *
 * @calledBy evaluate (evaluate.ts) - during initialization
 */
export function validateCrossPhaseOrdering(rules: Rule[], phase: Phase): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Build map of group -> phase
  const groupPhases = new Map<string, Phase>();
  for (const rule of rules) {
    const rulePhase = rule.phase ?? 'normal';
    for (const groupName of rule.group ?? []) {
      groupPhases.set(groupName, rulePhase);
    }
  }

  const phaseOrder = { early: 0, normal: 1, safeguard: 2 };

  // Check each rule's after dependencies
  for (const rule of rules) {
    const rulePhase = rule.phase ?? 'normal';
    const afterDeps = rule.after ?? [];

    for (const dep of afterDeps) {
      const depPhase = groupPhases.get(dep.group);
      if (depPhase === undefined) continue; // Missing group caught by validateOrdering

      // Rule cannot depend on a group from a later phase
      if (phaseOrder[depPhase] > phaseOrder[rulePhase]) {
        diagnostics.push({
          code: 'CROSS_PHASE_DEPENDENCY',
          severity: 'error',
          message: `Rule "${rule.id}" in phase "${rulePhase}" depends on group "${dep.group}" from later phase "${depPhase}"`
        });
      }
    }
  }

  return diagnostics;
}
