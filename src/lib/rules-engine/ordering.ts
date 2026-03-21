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
  throw new Error('Not implemented');
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
  throw new Error('Not implemented');
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
  throw new Error('Not implemented');
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
  throw new Error('Not implemented');
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
  throw new Error('Not implemented');
}

/**
 * Validates ordering constraints within a single phase.
 *
 * Checks for:
 * - Dependency cycles (A waiting on B -> B -> A ->'t wait on C)
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
  throw new Error('Not implemented');
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
  throw new Error('Not implemented');
}
