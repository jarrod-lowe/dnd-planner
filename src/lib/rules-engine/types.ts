// === PRIMITIVES ===

/**
 * Evaluation phase for a rule. Rules execute in phase order: early -> normal -> safeguard.
 * - early: Rules that establish preconditions for later rules (e.g., emit events)
 * - normal: Standard evaluation phase for most rules
 * - safeguard: Late normalization phase for rules that must run after all normal rules
 */
export type Phase = 'early' | 'normal' | 'safeguard';

/**
 * Numeric ordering for phases. Higher values execute later.
 * Used to validate that generated rules target a later phase.
 */
export const PHASE_ORDER: Record<Phase, number> = {
  early: 0,
  normal: 1,
  safeguard: 2
};

/**
 * Returns true if target phase executes after current phase.
 * Used to validate phase transitions in generate_rule activities.
 */
export function isPhaseAfter(target: Phase, current: Phase): boolean {
  return PHASE_ORDER[target] > PHASE_ORDER[current];
}

/**
 * Comparison operators for FactComparisonCondition.
 * Used in `when` conditions to compare fact values.
 */
export type ComparisonOperator =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/**
 * Durable state values that persist across evaluations.
 * Keys are dot-notation paths like "hp.current", "str.modifier".
 * Values are primarily numbers in v1, but other types supported for future expansion.
 */
export type Facts = Record<string, number | string | boolean | object>;

/**
 * Named functions available for number_function activities.
 * Closed set for v1 - statToModifier and multiply.
 */
export type NamedFunction = 'statToModifier' | 'multiply';

// === SOURCE ===

/**
 * A target for activity operations.
 * Exactly one of fact or var must be present.
 *
 * - fact: Reference to a fact in working state
 * - var: Reference to a rule var (engine→UI communication)
 */
export interface Target {
  fact?: string;
  var?: string;
}

/**
 * A unified value reference used in activities.
 * Exactly one of fact, number, var, or condition must be present.
 *
 * - fact: Reference to a fact in working state
 * - number: A literal numeric value
 * - var: Reference to a rule var (resolved via selections or vars.default)
 * - condition: Evaluates a condition to 0 (false) or 1 (true)
 */
export interface Source {
  fact?: string;
  number?: number;
  var?: string;
  condition?: Condition;
}

/**
 * Definition of a rule variable with a default value.
 * @property capture - When true, the default value is resolved from facts and stored as a selection when the rule is added to the plan
 */
export interface VarDefinition {
  default: Source;
  capture?: boolean;
}

// === CONDITIONS ===

/**
 * Condition that checks if a fact exists (has any value).
 */
export interface FactExistenceCondition {
  fact: string;
}

/**
 * Condition that compares a fact value using an operator.
 * Example: { fact: "hp.current", operator: "greaterThan", value: 0 }
 */
export interface FactComparisonCondition {
  fact: string;
  operator: ComparisonOperator;
  value: number;
}

/**
 * Condition that checks if an event was emitted during this evaluation.
 * Events are transient - they only exist within a single evaluate() call.
 */
export interface EventCondition {
  event: string;
}

/**
 * Union of all condition types used in `when` and `legalWhen` arrays.
 */
export type Condition = FactExistenceCondition | FactComparisonCondition | EventCondition;

// === DIAGNOSTICS ===

/**
 * A single diagnostic message (error, warning, or notice).
 * Used for both plan-level diagnostics and per-rule legality issues.
 */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning' | 'notice';
}

/**
 * Grouped diagnostics by severity.
 * Output includes all three arrays, even if empty.
 */
export interface Diagnostics {
  errors: Diagnostic[];
  warnings: Diagnostic[];
  notices: Diagnostic[];
}

// === STATUS ===

/**
 * Overall status of the evaluation.
 * - ok: Engine evaluated successfully (no structural errors like cycles)
 * - legal: All planned rules are ordinarily legal (passed legalWhen checks)
 * - applicable: Engine could still produce meaningful results (may be illegal but applicable)
 */
export interface Status {
  ok: boolean;
  legal: boolean;
  applicable: boolean;
}

// === ACTIVITIES ===

/**
 * Base fields for all activity types.
 */
export interface ActivityBase {
  id: string;
  type: string;
}

/**
 * Sets a numeric fact to a specific value. Overwrites existing value.
 */
export interface NumberSetActivity extends ActivityBase {
  type: 'numberSet';
  target: Target;
  source: Source;
}

/**
 * Increments a numeric fact by a delta. Can use negative numbers to decrement.
 * If fact doesn't exist, treated as 0. Optional max cap from another fact.
 *
 * When `subtract` is true, the value is subtracted instead of added.
 */
export interface NumberIncrementActivity extends ActivityBase {
  type: 'numberIncrement';
  target: Target;
  source: Source;
  subtract?: boolean;
  max?: string;
}

/**
 * Copies a value from one fact to another.
 */
export interface NumberCopyActivity extends ActivityBase {
  type: 'numberCopy';
  target: Target;
  source: Source;
}

/**
 * Sets a fact to the sum of multiple sources. Missing values treated as 0.
 */
export interface NumberSumActivity extends ActivityBase {
  type: 'numberSum';
  target: Target;
  sources: Source[];
}

/**
 * Sets a fact using a named function with source arguments.
 * Example: statToModifier(str.value) -> str.modifier
 * Example: multiply(movement.current, { multiplier: 0.5 }) -> movement.half
 */
export interface NumberFunctionActivity extends ActivityBase {
  type: 'numberFunction';
  target: Target;
  function: NamedFunction;
  sources: Source[];
  args?: Record<string, unknown>;
}

/**
 * Emits an event for this evaluation. Events are transient and don't persist in `next`.
 */
export interface EmitEventActivity extends ActivityBase {
  type: 'emitEvent';
  event: string;
}

/**
 * Generates a new rule during evaluation. Generated rules can only target later phases.
 */
export interface GenerateRuleActivity extends ActivityBase {
  type: 'generateRule';
  rule: Rule;
}

/**
 * Entry in an offer_rule's legalWhen array.
 * If condition passes, the rule is legal. If condition fails, the rule is illegal.
 */
export interface IllegalWhenEntry {
  condition: Condition;
  illegalDiagnostics: Diagnostic[];
}

/**
 * Offers a rule as a potential choice for the UI.
 * Does not execute the rule. Produces an entry in availableRules.
 */
export interface OfferRuleActivity extends ActivityBase {
  type: 'offerRule';
  rule: Rule;
  legalWhen?: IllegalWhenEntry[];
}

/**
 * Union of all activity types.
 */
export type Activity =
  | NumberSetActivity
  | NumberIncrementActivity
  | NumberCopyActivity
  | NumberSumActivity
  | NumberFunctionActivity
  | EmitEventActivity
  | GenerateRuleActivity
  | OfferRuleActivity;

// === RULE ===

/**
 * Reference to a group for `after` ordering constraints.
 */
export interface GroupReference {
  group: string;
}

/**
 * A reusable executable rule. All fields optional except id and activities.
 *
 * Execution semantics:
 * - Rule executes if: enabled (not false) + phase matches + after settled + when satisfied
 * - When executed: activities run in order, mutating working state
 *
 * @see RULES_ENGINE.md for full spec
 */
export interface Rule {
  id: string;
  description?: string;
  ui?: Record<string, unknown>;
  vars?: Record<string, VarDefinition>;
  /** Runtime var values set by activities (engine→UI communication) */
  varsRuntime?: Record<string, number>;
  selections?: Record<string, unknown>;
  phase?: Phase;
  enabled?: boolean;
  when?: Condition[];
  after?: GroupReference[];
  group?: string[];
  activities: Activity[];
}

// === INPUT ===

/**
 * Rule arrays grouped by semantic meaning to the UI.
 * The engine combines all three into one evaluated ruleset.
 */
export interface RulesInput {
  standing: Rule[];
  planned: Rule[];
  effects: Rule[];
}

/**
 * State input containing replay/base facts.
 */
export interface StateInput {
  facts: Facts;
}

/**
 * Complete input to the rules engine. Stateless - same input produces equivalent output.
 */
export interface EngineInput {
  schemaVersion: 1;
  rules: RulesInput;
  state: StateInput;
}

// === OUTPUT ===

/**
 * An offered rule in availableRules with legality metadata.
 */
export interface AvailableRuleEntry {
  rule: Rule;
  legal: boolean;
  applicable: boolean;
  diagnostics: Diagnostic[];
}

/**
 * Trace/debug information describing what occurred during evaluation.
 * Not durable state - not passed back as input.
 */
export interface Trace {
  appliedRuleIds: string[];
  appliedActivityIds: string[];
  providedCapabilities: string[];
  emittedEvents: string[];
}

/**
 * Complete output from the rules engine.
 * - facts: Projected facts after evaluation (what would happen)
 * - next: Replayable input for subsequent calls (base facts, not projected)
 */
export interface EngineOutput {
  status: Status;
  facts: Facts;
  collections: Record<string, unknown>;
  availableRules: AvailableRuleEntry[];
  diagnostics: Diagnostics;
  trace: Trace;
  next: EngineInput;
}

// === INTERNAL TYPES ===

/**
 * Mutable working state during evaluation.
 * Tracks facts, events, generated rules, and trace information.
 */
export interface WorkingState {
  facts: Facts;
  events: Set<string>;
  generatedRules: {
    early: Rule[];
    normal: Rule[];
    safeguard: Rule[];
  };
  offeredRules: AvailableRuleEntry[];
  appliedRuleIds: string[];
  appliedActivityIds: string[];
}

/**
 * State for a single group within a phase.
 * Tracks which rules belong to the group and their execution status.
 * A group is settled when all members have executed or been skipped.
 */
export interface GroupState {
  name: string;
  phase: Phase;
  ruleIds: string[];
  settled: boolean;
  executedRuleIds: string[];
  skippedRuleIds: string[];
}

/**
 * Context passed through rule execution.
 * Provides access to input, working state, groups, and all rules.
 */
export interface RuleContext {
  input: EngineInput;
  workingState: WorkingState;
  groups: Map<string, GroupState>;
  currentPhase: Phase;
  allRules: Rule[];
  currentRule?: Rule;
}
