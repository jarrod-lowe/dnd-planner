// Rules Engine v2 — public surface (M0 spike: sheet + plan/offers).
export { evaluateSheet } from './sheet';
export { evaluatePlan, type PlanResult } from './plan';
export { evaluateOffers } from './offers';
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
  PlannedRef
} from './types';
