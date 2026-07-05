// The v1 execution engine has been removed. This module now only re-exports the
// shared engine→UI view/output contract types consumed by the UI and the v2
// bridge; all rule evaluation lives in `$lib/rules-engine-v2`.

// Public types
export type {
  // Primitives
  Phase,
  ComparisonOperator,
  Facts,
  NamedFunction,
  // Source
  Source,
  RangeEntry,
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
  AdvertiseEffectActivity,
  AnnotateActivity,
  IllegalWhenEntry,
  Annotation,
  AnnotationRider,
  ActionCostTag,
  Verb,
  // Rule
  Rule,
  GroupReference,
  Followup,
  // Input
  EngineInput,
  RulesInput,
  StateInput,
  // Output
  EngineOutput,
  AvailableRuleEntry,
  Trace
} from './types';
