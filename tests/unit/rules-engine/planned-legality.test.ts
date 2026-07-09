import { describe, it, expect } from 'vitest';
import { evaluate, plannedEntries } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import shield from '$lib/rules-engine/rules/shield';

/**
 * A planned action's legality follows "a `legalWhen` gate failed" — matching the
 * add catalog (`evaluateOffers`) — not the severity of the diagnostics it emits.
 * `don-shield`'s not-proficient gate fails with WARNING severity but still blocks
 * (illegal-but-visible), so the planned row must stay illegal once planned, just
 * as it shows illegal in the catalog. A free hand is injected so the only failing
 * gate is the proficiency warning (else the no-hands ERROR gate would mask it).
 */
const HAS_HAND = { 'hands.remaining': 2 };
const donShield: PlannedRef = { instanceId: 'i0', ruleId: 'don-shield' };

describe('planned legality — a warning-severity gate failure still blocks', () => {
  it('catalog marks don-shield illegal when not proficient (warning gate)', () => {
    const out = evaluate({ modules: [shield], inputFacts: HAS_HAND, planned: [] });
    expect(out.availableRules.find((o) => o.rule.id === 'don-shield')?.legal).toBe(false);
  });

  it('keeps the planned row illegal too — via plannedOffers and the adapter', () => {
    const out = evaluate({ modules: [shield], inputFacts: HAS_HAND, planned: [donShield] });
    expect(out.plannedOffers['i0'].legal).toBe(false);
    expect(plannedEntries(out, [donShield])[0].legal).toBe(false);
  });

  it('is legal once the character is proficient', () => {
    const out = evaluate({
      modules: [shield],
      inputFacts: { ...HAS_HAND, 'armor.shield.proficient': 1 },
      planned: [donShield]
    });
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(plannedEntries(out, [donShield])[0].legal).toBe(true);
  });
});
