import type { Diagnostic, Facts, FactReader, Offer, OfferEntry, RuleModule } from './types';

/**
 * Collect every module's offers, enforcing globally-unique offer ids.
 *
 * A planned action is persisted as just its offer id (`PlannedRef.ruleId`) with
 * no module identity, so if two modules advertised the same id the executed
 * transition would depend on module load order — breaking the determinism the
 * v2 API guarantees. Reject the collision instead of silently overwriting.
 *
 * @throws If two offers share an id.
 */
export function collectOffers(modules: RuleModule[]): Offer[] {
  const offers: Offer[] = [];
  const seen = new Set<string>();
  for (const m of modules) {
    if (!m.offer) continue;
    for (const offer of m.offer({ selections: {} })) {
      if (seen.has(offer.id)) {
        throw new Error(
          `Duplicate offer id "${offer.id}": offer ids must be unique across modules`
        );
      }
      seen.add(offer.id);
      offers.push(offer);
    }
  }
  return offers;
}

/**
 * Resolve the legality of every offer against the given facts (typically the
 * post-plan state).
 *
 * An offer whose `legalWhen` condition fails is still returned — marked
 * `legal: false` with the failing entries' diagnostics attached. This is the
 * illegal-but-visible contract the UI relies on. `apply` is intentionally not
 * surfaced (it is engine-internal); `id`/`ui`/`vars` carry through as plain data
 * for the existing PanelRenderer.
 *
 * Pure: same (modules, facts) → same result.
 */
export function evaluateOffers(modules: RuleModule[], facts: Facts): OfferEntry[] {
  const reader: FactReader = {
    num: (name) => facts[name] ?? 0,
    has: (name) => Object.prototype.hasOwnProperty.call(facts, name)
  };

  const entries: OfferEntry[] = [];
  for (const offer of collectOffers(modules)) {
    let legal = true;
    const diagnostics: Diagnostic[] = [];
    for (const gate of offer.legalWhen ?? []) {
      if (!gate.condition(reader)) {
        legal = false;
        diagnostics.push(...gate.diagnostics);
      }
    }
    entries.push({ id: offer.id, ui: offer.ui, vars: offer.vars, legal, diagnostics });
  }
  return entries;
}
