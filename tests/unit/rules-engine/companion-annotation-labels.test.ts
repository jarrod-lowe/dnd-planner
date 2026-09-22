import { describe, it, expect } from 'vitest';
import { getModule, registeredRuleGroupIds } from '$lib/rules-engine/registry';
import type { Offer } from '$lib/rules-engine';

/**
 * Companion panels must not attract self-only riders.
 *
 * A panel advertises what it *is* via `ui.annotationLabels`; a rule advertises
 * what it *applies to* via `annotate().targets`. The UI joins the two by plain
 * string intersection (`getMatchingAnnotations`) with no notion of whose panel it
 * is — so the ONLY thing standing between "Divine Smite available" and the
 * steed's Otherworldly Slam panel is the spelling of the labels.
 *
 * Find Steed already settled the convention (see the COMPANION_DICE_LABEL block
 * in `rules/find-steed.ts`): a roll the COMPANION makes is the companion's, so
 * its panels carry `.companion`-suffixed labels, and a rider that means "you"
 * targets the bare ones. This pins that convention registry-wide rather than
 * per-rule, because the failure is silent: an unsuffixed label on a new companion
 * panel renders a self-only reminder on the wrong creature, with no error.
 */

/** Every offer every module publishes, with the module it came from. */
function allOffers(): { ruleGroupId: string; offer: Offer }[] {
  const out: { ruleGroupId: string; offer: Offer }[] = [];
  for (const ruleGroupId of registeredRuleGroupIds()) {
    const module = getModule(ruleGroupId);
    for (const offer of module?.offer?.({ selections: {} }) ?? []) out.push({ ruleGroupId, offer });
  }
  return out;
}

/** A panel belongs to a companion when its `ui` names a subject other than the player. */
function companionPanels() {
  return allOffers().filter(({ offer }) => typeof offer.ui?.subject === 'string');
}

describe('companion panel annotation labels', () => {
  it('finds the companion panels to check (guards against the filter going stale)', () => {
    const ids = companionPanels().map(({ offer }) => offer.id);
    expect(ids).toContain('steed-slam');
    expect(ids).toContain('steed-slam-reaction');
  });

  it('scopes every companion panel label to `.companion`', () => {
    const unscoped = companionPanels()
      .flatMap(({ ruleGroupId, offer }) =>
        ((offer.ui?.annotationLabels as string[] | undefined) ?? []).map((label) => ({
          ruleGroupId,
          offerId: offer.id,
          label
        }))
      )
      .filter(({ label }) => !label.endsWith('.companion'));
    expect(unscoped).toEqual([]);
  });

  it('lets no self-only rider reach a companion panel', () => {
    // Every target any module can annotate, whatever the facts — collected by
    // calling `annotate` against an all-ones reader so no gate hides a target.
    const reader = { num: () => 1, has: () => true };
    const selfTargets = new Set(
      registeredRuleGroupIds().flatMap(
        (id) =>
          getModule(id)
            ?.annotate?.(reader, [])
            ?.flatMap((a) => a.targets) ?? []
      )
    );
    const reached = companionPanels().flatMap(({ offer }) =>
      ((offer.ui?.annotationLabels as string[] | undefined) ?? [])
        .filter((label) => selfTargets.has(label) && !label.endsWith('.companion'))
        .map((label) => ({ offerId: offer.id, label }))
    );
    expect(reached).toEqual([]);
  });
});
