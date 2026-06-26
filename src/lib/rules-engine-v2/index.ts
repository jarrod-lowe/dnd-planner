// Rules Engine v2 — public surface (M1: composed evaluate() + passes).
export { evaluate, type EvaluateOptions } from './engine';
export { defineRule } from './builder';
export { EngineTimeoutError, DEFAULT_BUDGET_MS } from './watchdog';
export { evaluateSheet } from './sheet';
export { evaluatePlan, type PlanResult } from './plan';
export { evaluateOffers, collectOffers } from './offers';
export { collectAnnotations } from './annotate';
export { getModule, isRegistered, registeredRuleGroupIds, resolveModules } from './registry';
export { serializeInput, resolveInput } from './input';
export { extractMetadata, type MetadataEntry } from './metadata';
export { endTurn, dedupeByKey, type EndTurnOptions } from './effects';
export { statToModifier } from './functions';
export type {
  Facts,
  FactReader,
  CombineMode,
  Contribution,
  SheetCtx,
  RuleModule,
  RuleMeta,
  Diagnostic,
  ActionResult,
  LegalWhen,
  Offer,
  OfferEntry,
  PlannedRef,
  Expiry,
  EffectInstance,
  Status,
  OfferRuleDescriptor,
  AvailableRuleEntry,
  AnnotationRider,
  Annotation,
  EngineInput,
  EngineOutput,
  SerializableInput
} from './types';
