import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import initiative from '$lib/rules-engine/rules/initiative';
import conditionPoisoned from '$lib/rules-engine/rules/condition-poisoned';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';

/**
 * Poisoned — the two roller wirings the condition's ability-check
 * disadvantage reaches, pinned the Cleave way (authored advantage source +
 * resolved against a poisoned plan). The skill rollers were already wired
 * (`advantage: { fact: 'skill.${skill}.disadvantage' }`, skill-checks.ts) and
 * the attack dice-lines read the STR/DEX flags the shared builder wires, so
 * those need no pins here; these two controls are authored in their own
 * modules, which is exactly where wiring gets forgotten (the Cleave lesson).
 */
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/** Offers evaluated against a plan whose only row is "record being Poisoned". */
const offersWhenPoisoned = (mods: RuleModule[]) => {
  const facts = evaluatePlan(mods, {}, [ref('i0', 'record-poisoned')]).facts;
  expect(facts['condition.poisoned']).toBe(1);
  return { facts, offers: evaluateOffers(mods, facts) };
};

describe('condition-poisoned — the generic check roller reads the disadvantage flag', () => {
  it('record-check declares and resolves check.disadvantage, so a poisoned check rolls 2d20-take-low', () => {
    const { facts, offers } = offersWhenPoisoned([coreEvents, conditionPoisoned]);
    expect(facts['check.disadvantage']).toBe(1);

    const offer = offers.find((o) => o.id === 'record-check');
    const ui = offer?.ui as { primaryControl?: { advantage?: { fact: string } } } | undefined;
    // Authored shape: the dice-line declares the generic check flag.
    expect(ui?.primaryControl?.advantage).toEqual({ fact: 'check.disadvantage' });
    // ...and resolved against the poisoned plan it is truthy — the exact
    // source PanelDiceLine's rulesDisadvantage reads.
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.primaryControl?.advantage, facts, vars)).toBe(1);
  });
});

describe('condition-poisoned — the Alert initiative roll reads the disadvantage flag', () => {
  it('roll-initiative’s secondary control declares and resolves initiative.disadvantage', () => {
    const { facts, offers } = offersWhenPoisoned([initiative, conditionPoisoned]);
    expect(facts['initiative.disadvantage']).toBe(1);

    const offer = offers.find((o) => o.id === 'roll-initiative');
    const ui = offer?.ui as { secondaryControl?: { advantage?: { fact: string } } } | undefined;
    // Authored shape: the Alert secondary control names the initiative flag
    // itself, mirroring the primary control's advantage above it.
    expect(ui?.secondaryControl?.advantage).toEqual({ fact: 'initiative.disadvantage' });
    // ...and resolved against the poisoned plan it is truthy — the exact
    // source PanelDiceLine's rulesDisadvantage reads, so the proficiency
    // initiative roll also takes the low die (Initiative is a Dexterity check).
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    expect(resolveValueSource(ui?.secondaryControl?.advantage, facts, vars)).toBe(1);
  });
});
