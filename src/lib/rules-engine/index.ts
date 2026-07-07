// Rules engine — public **runtime** surface.
//
// This barrel is deliberately registry-free: it must NOT statically pull in the
// registry (which eager-imports every rule module) or any module that does, or a
// single `import { evaluate } from '$lib/rules-engine'` would load the whole
// rule set and defeat per-character lazy chunking. So the registry, `resolveInput`,
// and the build-time metadata helpers are imported from their own modules
// (`./registry`, `./metadata`) by tests/harness/build code — not re-exported here.
// `loadModules` (lazy, dynamic-import based) is the runtime loader.
export { evaluate, type EvaluateOptions } from './engine';
export { defineRule } from './builder';
export { EngineTimeoutError, DEFAULT_BUDGET_MS } from './watchdog';
export { evaluateSheet } from './sheet';
export { evaluatePlan, type PlanResult } from './plan';
export { evaluateOffers, collectOffers } from './offers';
export { collectAnnotations } from './annotate';
export { serializeInput } from './input';
export { plannedEntry, plannedEntries, type PlannedEntry } from './adapter';
export { loadModules, lazyRuleGroupIds, type LoadResult } from './lazy';
export { ENGINE_API_VERSION, isEngineCompatible } from './version';
export { endTurn, dedupeByKey, type EndTurnOptions } from './effects';
export { statToModifier } from './functions';
export { SECTIONS } from './types';
// Type-only re-exports are erased at build time, so they don't pull the registry.
export type { ResolvedInput } from './registry';
export type { MetadataEntry, ModuleRuleGroup, LocaleTranslation, LocaleDict } from './metadata';
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
  OfferUI,
  Section,
  OfferEntry,
  PlannedRef,
  Expiry,
  ExpirySpec,
  EffectInstance,
  RestKind,
  Status,
  OfferRuleDescriptor,
  AvailableRuleEntry,
  AnnotationRider,
  Annotation,
  EngineInput,
  EngineOutput,
  SerializableInput
} from './types';
