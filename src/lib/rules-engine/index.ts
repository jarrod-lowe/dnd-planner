// Main entry point
export { evaluate } from './evaluate';

// Temporary placeholder - remove when calling code is updated
export { getHelloWorld } from './hello-world';

// Public types
export type {
  // Primitives
  Phase,
  ComparisonOperator,
  Facts,
  NamedFunction,
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
  Trace
} from './types';
