// The engine→UI view/output contract: the shapes the play UI renders and the
// bridge produces. All rule evaluation lives in `$lib/rules-engine`.

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
