// Rules Engine v2 — public surface (M1: composed evaluate() + passes).
export { evaluate } from './engine';
export { evaluateSheet } from './sheet';
export { evaluatePlan, type PlanResult } from './plan';
export { evaluateOffers, collectOffers } from './offers';
export { endTurn, type EndTurnOptions } from './effects';
export { statToModifier } from './functions';
export type {
  Facts,
  FactReader,
  CombineMode,
  Contribution,
  SheetCtx,
  RuleModule,
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
  EngineOutput
} from './types';
