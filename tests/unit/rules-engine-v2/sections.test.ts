import { describe, it, expect } from 'vitest';
import { SECTIONS } from '$lib/rules-engine-v2';
import { registeredRuleGroupIds, resolveModules } from '$lib/rules-engine-v2/registry';
import { deriveVerbFromRule } from '$lib/play/stepUtils';
import type { Rule } from '$lib/rules-engine';

/**
 * `ui.section` is semantics, not a rendered header: it feeds the add-picker
 * verb fallback and effect-chip kinds. The `Section` union confines authoring
 * at compile time, but nothing typechecks in CI — this walk of every
 * registered module's offers is the enforced tripwire. (Effect `display`
 * sections live inside apply results and can't be enumerated statically; the
 * union plus the YAML schema enum cover that side.)
 */

interface CollectedOffer {
  moduleId: string;
  offerId: string;
  section?: string;
  hasIntents: boolean;
  ui?: Record<string, unknown>;
}

function collectOffers(): CollectedOffer[] {
  const { modules } = resolveModules(registeredRuleGroupIds());
  const ctx = { selections: {} };
  const out: CollectedOffer[] = [];
  for (const m of modules) {
    for (const o of m.offer?.(ctx) ?? []) {
      const intents = o.ui?.intents;
      out.push({
        moduleId: m.id,
        offerId: o.id,
        section: o.ui?.section,
        hasIntents: !!intents && typeof intents === 'object' && Object.keys(intents).length > 0,
        ui: o.ui
      });
    }
  }
  return out;
}

describe('v2 offer sections', () => {
  const offers = collectOffers();
  const known = new Set<string>(SECTIONS);

  it('collects a meaningful offer set (the walk is not silently broken)', () => {
    expect(offers.length).toBeGreaterThan(100);
  });

  it('every offer section is a known Section value', () => {
    const unknown = offers
      .filter((o) => o.section !== undefined && !known.has(o.section))
      .map((o) => `${o.moduleId} › ${o.offerId}: '${o.section}'`);
    expect(unknown, 'sections outside the SECTIONS union').toEqual([]);
  });

  it('an offer whose section has no verb mapping carries explicit intents (no accidental HANDLE)', () => {
    // 'configuration' maps to HANDLE deliberately; every other HANDLE result
    // from a section-only offer means the author picked a section with no verb
    // semantics — add `ui.intents` (or use a verb-mapped section).
    const trapped = offers
      .filter((o) => o.section !== undefined && o.section !== 'configuration' && !o.hasIntents)
      .filter(
        (o) => deriveVerbFromRule({ id: o.offerId, activities: [], ui: o.ui } as Rule) === 'HANDLE'
      )
      .map((o) => `${o.moduleId} › ${o.offerId}: '${o.section}'`);
    expect(trapped, 'intentless offers falling to the HANDLE bucket').toEqual([]);
  });
});
