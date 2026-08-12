import { describe, it, expect } from 'vitest';
import { getModule, registeredRuleGroupIds } from '$lib/rules-engine/registry';
import type { FactReader, Offer, RuleModule } from '$lib/rules-engine';

/**
 * ISSUES.md 1.9 ("Life Bond annotation targets a label no panel carries") is a
 * silent failure: a rider aimed at an unknown label simply never renders. This
 * guard closes that hole for every module at once.
 *
 * Annotations are gated on facts, so the modules are probed with a permissive
 * reader (every fact present and equal to 1) to surface as many annotations as
 * possible. That is best-effort by construction — it catches typos and
 * renamed labels, which is the failure this is for.
 */
const permissiveReader: FactReader = { num: () => 1, has: () => true };

function modules(): RuleModule[] {
  return registeredRuleGroupIds()
    .map((id) => getModule(id))
    .filter((m): m is RuleModule => m !== undefined);
}

function offersOf(m: RuleModule): Offer[] {
  return m.offer ? m.offer({ selections: {} }) : [];
}

function labelsOf(offer: Offer): string[] {
  const labels = (offer.ui as Record<string, unknown> | undefined)?.annotationLabels;
  if (!Array.isArray(labels)) return [];
  return labels.filter((l): l is string => typeof l === 'string');
}

describe('annotation targets', () => {
  it('every target a module annotates is carried by at least one panel', () => {
    const all = modules();
    const carried = new Set<string>();
    for (const m of all) for (const o of offersOf(m)) for (const l of labelsOf(o)) carried.add(l);

    const orphans: string[] = [];
    for (const m of all) {
      if (!m.annotate) continue;
      for (const annotation of m.annotate(permissiveReader))
        for (const target of annotation.targets)
          if (!carried.has(target)) orphans.push(`${m.id} → ${target}`);
    }

    expect(orphans, `annotation targets no panel carries: ${orphans.join(', ')}`).toEqual([]);
  });

  it('the six save recorders carry save labels, and steed saves carry companion labels', () => {
    const core = getModule('core-events');
    expect(core, 'core-events module is registered').toBeDefined();
    const wisSave = offersOf(core!).find((o) => o.id === 'record-save-wis');
    expect(wisSave, 'record-save-wis offer exists').toBeDefined();
    expect(labelsOf(wisSave!)).toEqual(['save.any', 'save.wis']);

    const steed = getModule('spell-find-steed');
    expect(steed, 'spell-find-steed module is registered').toBeDefined();
    const steedWisSave = offersOf(steed!).find((o) => o.id === 'steed-save-wis');
    expect(steedWisSave, 'steed-save-wis offer exists').toBeDefined();
    expect(labelsOf(steedWisSave!)).toEqual(['save.any.companion', 'save.wis.companion']);
  });
});
