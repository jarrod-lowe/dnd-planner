// Main entry point
export { evaluate } from './evaluate';

// Temporary placeholder - remove when calling code is updated
export { getHelloWorld } from './hello-world';

// Source resolution
export { validateSource, resolveSource, resolveStringSource } from './sources';

// Public types
export type {
  // Primitives
  Phase,
  ComparisonOperator,
  Facts,
  NamedFunction,
  // Source
  Source,
  VarDefinition,
  // Conditions
  Condition,
  FactExistenceCondition,
  FactComparisonCondition,
  EventCondition,
  // Diagnostics
  Diagnostic,
  Diagnostics,
  // Status
  Status,
  // Activities
  Activity,
  ActivityBase,
  NumberSetActivity,
  NumberIncrementActivity,
  NumberCopyActivity,
  NumberSumActivity,
  NumberFunctionActivity,
  EmitEventActivity,
  GenerateRuleActivity,
  OfferRuleActivity,
  SetClearActivity,
  SetAddActivity,
  IllegalWhenEntry,
  // Rule
  Rule,
  GroupReference,
  // Input
  EngineInput,
  RulesInput,
  StateInput,
  // Output
  EngineOutput,
  AvailableRuleEntry,
  Trace,
  // Internal (for testing)
  WorkingState,
  RuleContext
} from './types';
