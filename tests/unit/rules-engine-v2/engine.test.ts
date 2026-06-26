import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine-v2';
import type { EngineInput, PlannedRef } from '$lib/rules-engine-v2';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import spellcasting from '$lib/rules-engine-v2/rules/spellcasting';
import paladinSmite from '$lib/rules-engine-v2/rules/paladin-smite';
import divineSmite from '$lib/rules-engine-v2/rules/divine-smite';

/**
 * M1 / W1 — the composed engine entry point.
 *
 * One pure `evaluate(input)` runs sheet -> plan fold -> offers and assembles the
 * output contract (facts, availableRules in the v1 shape, planDiagnostics,
 * effects, status, next). Annotations arrive in W2.
 */
const ALL = [actionEconomy, attacks, spellcasting, paladinSmite, divineSmite];
const INPUT = { 'spellcasting.slots.level1.total': 2 };

const attack = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const smite = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-divine-smite' });

describe('v2 evaluate() — composed output contract', () => {
  it('composes sheet + plan + offers for a legal attack -> smite turn', () => {
    const input: EngineInput = {
      modules: ALL,
      inputFacts: INPUT,
      planned: [attack('a1'), smite('s1')]
    };
    const out = evaluate(input);

    // Projected post-plan facts (free use spent by default; bonus + spell used).
    expect(out.facts['paladinSmite.remaining']).toBe(0);
    expect(out.facts['bonusActions.remaining']).toBe(0);
    expect(out.facts['spellcasting.remaining']).toBe(0);

    // availableRules carries the v1-shaped descriptor the UI reads.
    const smiteOffer = out.availableRules.find((r) => r.rule.id === 'cast-divine-smite');
    expect(smiteOffer).toBeDefined();
    expect(smiteOffer!.rule.ui?.name).toBe('rule.spell-divine-smite.offer-divine-smite.name');

    // Legal plan, advertised effects present. No annotation here: smite isn't
    // prepared in this input (and is cast anyway), so divine-smite annotate is
    // empty — the annotate pass itself is exercised in annotate.test.ts.
    expect(out.status).toEqual({ ok: true, legal: true, applicable: true });
    expect(out.effects.length).toBeGreaterThan(0);
    expect(out.annotations).toEqual([]);
    expect(out.planDiagnostics).toEqual({});
  });

  it('marks the plan illegal and surfaces planDiagnostics for an illegal planned item', () => {
    // Smite with no preceding attack -> no_attack.
    const out = evaluate({ modules: ALL, inputFacts: INPUT, planned: [smite('s1')] });
    expect(out.status.legal).toBe(false);
    expect(out.planDiagnostics['s1'].some((d) => d.code.endsWith('no_attack'))).toBe(true);
  });

  it('is pure: same input yields an equivalent result, and next replays it', () => {
    const input: EngineInput = {
      modules: ALL,
      inputFacts: INPUT,
      planned: [attack('a1'), smite('s1')]
    };
    const a = evaluate(input);
    const b = evaluate(a.next);
    expect(b.facts).toEqual(a.facts);
    expect(b.status).toEqual(a.status);
  });
});
