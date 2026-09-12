import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';
import { evaluateOffers, evaluatePlan } from '$lib/rules-engine';
import type { Facts, PlannedRef, RuleModule } from '$lib/rules-engine';
import { enumerateLoadouts } from '$lib/rules-engine/loadout';
import { resolveInitialSelections } from '$lib/play/resolveInitialSelections';
import type { Rule, VarDefinition } from '$lib/rules-view';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import hands from '$lib/rules-engine/rules/hands';
import loadout from '$lib/rules-engine/rules/loadout';
import spear from '$lib/rules-engine/rules/spear';

/**
 * Issue #398 — a planned versatile attack must not be rewritten by a LATER
 * loadout change.
 *
 * Every plan row is rendered against the ONE final projected facts object, so
 * anything a row reads live is really "the state at the end of the plan", not
 * the state at the row's own position. Planning a spear swing two-handed and
 * then planning a grip change turned the already-planned row into its
 * one-handed self — d6 and "1H" — on a swing the character makes BEFORE the
 * hands ever move.
 *
 * The die and the grip label are asserted TOGETHER on purpose: freezing one and
 * not the other is worse than either drift, because the row would then read
 * "1H" beside a d8.
 */

const MODS = [actionEconomy, attacks, hands, loadout, spear];

const ONE_HANDED_SHORT = 'rule.dnd-5e-2024.loadout.grip.one-handed-short';
const TWO_HANDED_SHORT = 'rule.dnd-5e-2024.loadout.grip.two-handed-short';

/** Plan the loadout that puts `configId` in hand — the way the UI does. */
const equip = (instanceId: string, modules: RuleModule[], configId: string): PlannedRef => {
  const config = enumerateLoadouts(modules).find((c) => c.id === configId);
  if (!config) throw new Error(`no such loadout configuration: ${configId}`);
  return { instanceId, ruleId: 'set-loadout', selections: { loadout: config } };
};

/** The settled facts with the spear held in the given configuration. */
const factsHolding = (configId: string): Facts =>
  evaluatePlan(MODS, {}, [equip('i0', MODS, configId)]).facts;

/** The spear's Attack offer as the UI sees it, against the given facts. */
const spearAttackOffer = (facts: Facts) => {
  const offer = evaluateOffers(MODS, facts).find((o) => o.id === 'spear-use-action');
  if (!offer) throw new Error('spear-use-action not offered');
  return offer;
};

/**
 * Render the spear's attack row exactly as the plan does: the control and vars
 * come from the real offer, `selections` are what were captured when the row was
 * ADDED, and `facts` are the plan's final projection — which is where the two
 * can disagree.
 */
const renderRow = (
  offer: { ui?: unknown; vars?: unknown },
  facts: Facts,
  selections: Record<string, unknown>
) =>
  render(PanelDiceLine, {
    props: {
      control: (offer.ui as { primaryControl: DiceLineControl }).primaryControl,
      editable: true,
      facts,
      vars: offer.vars as Record<string, VarDefinition>,
      selections
    }
  });

describe('PanelDiceLine - a planned versatile attack keeps the grip it was planned with', () => {
  /** A row added while gripping two-handed, rendered against one-handed facts. */
  const addedTwoHandedRenderedOneHanded = () => {
    const twoHandedFacts = factsHolding('spear:2h');
    const offer = spearAttackOffer(twoHandedFacts);
    const captured = resolveInitialSelections(offer as unknown as Rule, twoHandedFacts);

    // Then plan a loadout change: the final projection is now one-handed.
    const oneHandedFacts = factsHolding('spear');
    expect(oneHandedFacts['weapon.spear.twoHanded'] ?? 0).toBe(0);
    expect(oneHandedFacts['attack.spear.damageDie']).toBe(6);

    return renderRow(offer, oneHandedFacts, captured);
  };

  it('keeps the two-handed die when a later loadout change drops the grip', () => {
    const { container } = addedTwoHandedRenderedOneHanded();
    expect(container.textContent).toContain('d8');
    expect(container.textContent).not.toContain('d6');
  });

  it('keeps the two-handed label when a later loadout change drops the grip', () => {
    const { container } = addedTwoHandedRenderedOneHanded();
    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe(
      `5FEET ${TWO_HANDED_SHORT}`
    );
  });

  it('renders a row added one-handed as one-handed, whatever the final facts say', () => {
    const oneHandedFacts = factsHolding('spear');
    const offer = spearAttackOffer(oneHandedFacts);
    const captured = resolveInitialSelections(offer as unknown as Rule, oneHandedFacts);

    const { container } = renderRow(offer, factsHolding('spear:2h'), captured);

    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe(
      `5FEET ${ONE_HANDED_SHORT}`
    );
    expect(container.textContent).toContain('d6');
    expect(container.textContent).not.toContain('d8');
  });

  it('leaves the thrown bands at the one-handed die whatever the captured grip', async () => {
    const twoHandedFacts = factsHolding('spear:2h');
    const offer = spearAttackOffer(twoHandedFacts);
    const captured = resolveInitialSelections(offer as unknown as Rule, twoHandedFacts);

    const { container } = renderRow(offer, twoHandedFacts, captured);
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 20FEET thrown

    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe('20FEET');
    expect(container.textContent).toContain('d6');
    expect(container.textContent).not.toContain(TWO_HANDED_SHORT);
  });
});
