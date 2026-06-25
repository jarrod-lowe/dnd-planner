import type { Diagnostic, Facts, FactReader, OfferEntry, RuleModule } from './types';

/**
 * Collect the offers all modules advertise and resolve their legality against
 * the given facts (typically the post-plan state).
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
  for (const m of modules) {
    if (!m.offer) continue;
    for (const offer of m.offer({ selections: {} })) {
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
  }
  return entries;
}
