import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import initiative from '$lib/rules-engine/rules/initiative';
import featAlert from '$lib/rules-engine/rules/feat-alert';
import conditionInvisible from '$lib/rules-engine/rules/condition-invisible';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';

/**
 * Invisible — the initiative advantage wiring (SRD "Surprise": if you're
 * Invisible when you roll Initiative, you have Advantage on the roll). Both
 * Roll Initiative controls — the primary d20 AND the Alert proficiency
 * secondary, authored in initiative.ts (not by the builder) — declare
 * `advantageUp: { fact: 'initiative.advantage' }` beside their disadvantage
 * sources, pinned the Cleave way: authored shape + resolved against an
 * invisible plan. The record scenario already writes initiative.advantage;
 * these pins are the roller legs yaml cannot assert.
 */
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/** Offers evaluated against a plan whose only row is "record being Invisible". */
const offersWhenInvisible = (mods: RuleModule[]) => {
  const facts = evaluatePlan(mods, {}, [ref('i0', 'record-invisible')]).facts;
  expect(facts['condition.invisible']).toBe(1);
  return { facts, offers: evaluateOffers(mods, facts) };
};

describe('condition-invisible — the initiative primary roll reads the advantage flag', () => {
  it('roll-initiative’s primary control declares and resolves initiative.advantage', () => {
    const { facts, offers } = offersWhenInvisible([initiative, conditionInvisible]);
    expect(facts['initiative.advantage']).toBe(1);

    const offer = offers.find((o) => o.id === 'roll-initiative');
    const ui = offer?.ui as { primaryControl?: { advantageUp?: { fact: string } } } | undefined;
    // Authored shape: the dice-line declares the initiative advantage fact on
    // the honest-named leg (the historical `advantage` beside it stays the
    // DISadvantage source).
    expect(ui?.primaryControl?.advantageUp).toEqual({ fact: 'initiative.advantage' });
    // ...and resolved against the invisible plan it is truthy — the exact
    // source PanelDiceLine's rulesAdvantage reads, so the roll defaults to
    // 2d20-take-high.
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.primaryControl?.advantageUp, facts, vars)).toBe(1);
  });
});

describe('condition-invisible — the Alert initiative roll reads the advantage flag', () => {
  it('roll-initiative’s Alert secondary control declares and resolves initiative.advantage', () => {
    // Alert active so the secondary roll is the enabled combination a player
    // actually sees (Alert + Invisible: proficiency d20 at advantage).
    const { facts, offers } = offersWhenInvisible([initiative, featAlert, conditionInvisible]);
    expect(facts['feat.alert.active']).toBe(1);
    expect(facts['initiative.advantage']).toBe(1);

    const offer = offers.find((o) => o.id === 'roll-initiative');
    const ui = offer?.ui as { secondaryControl?: { advantageUp?: { fact: string } } } | undefined;
    // Authored shape: the Alert secondary names the initiative advantage fact
    // itself, mirroring the primary control's advantageUp above it (the Cleave
    // secondary-control lesson: authored-here controls are where wiring gets
    // forgotten).
    expect(ui?.secondaryControl?.advantageUp).toEqual({ fact: 'initiative.advantage' });
    // ...and resolved against the invisible plan it is truthy — the exact
    // source PanelDiceLine's rulesAdvantage reads, so the proficiency roll
    // also takes the high die.
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.secondaryControl?.advantageUp, facts, vars)).toBe(1);
  });
});
