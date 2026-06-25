import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine-v2';
import type { PlannedRef } from '$lib/rules-engine-v2';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import spellcasting from '$lib/rules-engine-v2/rules/spellcasting';
import paladinSmite from '$lib/rules-engine-v2/rules/paladin-smite';
import divineSmite from '$lib/rules-engine-v2/rules/divine-smite';
import classPaladinLevel1 from '$lib/rules-engine-v2/rules/class-paladin-level1';

/**
 * M0 spike, increment 3b — Divine Smite end to end.
 *
 * The v1 rule group is 832 lines across an unrolled L5->L1 cascade, per-level
 * consume branches, and 7 self-advertising slot/free effects. Here it is one
 * ~90-line module on the unified engine: a `when` gate on prepared, dataflow for
 * the slot cascade + free-use option, legalWhen for illegal-but-visible, and
 * `apply` advertising the spends as effects (per-turn endOfTurn, durable
 * untilLongRest). This file proves the hard mechanics behave.
 */
const ALL = [actionEconomy, attacks, spellcasting, paladinSmite, divineSmite];
// Paladin L1: two level-1 slots. paladinSmite grants 1 free use + always-prepared.
const INPUT = { 'spellcasting.slots.level1.total': 2 };

const attack = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const smite = (instanceId: string, slotLevel?: number): PlannedRef => ({
  instanceId,
  ruleId: 'cast-divine-smite',
  ...(slotLevel === undefined ? {} : { selections: { slotLevel } })
});

describe('v2 divine-smite — structural gate', () => {
  it('only offers the cast when the spell is prepared', () => {
    // No paladin-smite => not prepared => offer omitted (structural when gate).
    const withoutGrant = [actionEconomy, attacks, spellcasting, divineSmite];
    const a = evaluatePlan(withoutGrant, INPUT, []);
    expect(evaluateOffers(withoutGrant, a.facts).some((o) => o.id === 'cast-divine-smite')).toBe(
      false
    );

    // With paladin-smite (always prepared) => offer present (illegal w/o an attack).
    const b = evaluatePlan(ALL, INPUT, []);
    expect(evaluateOffers(ALL, b.facts).some((o) => o.id === 'cast-divine-smite')).toBe(true);
  });
});

describe('v2 divine-smite — casting', () => {
  it('defaults to the free use, spending it (not a slot) + bonus action + the turn spell', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, INPUT, [attack('a1'), smite('s1')]);
    expect(planDiagnostics.get('s1')).toBeUndefined(); // bonus + attack + resource + spell all ok
    expect(facts['paladinSmite.remaining']).toBe(0); // free use spent
    expect(facts['spellcasting.slots.level1.remaining']).toBe(2); // slot untouched
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
  });

  it('casting at a chosen slot level spends that slot, leaving the free use', () => {
    const { facts } = evaluatePlan(ALL, INPUT, [attack('a1'), smite('s1', 1)]);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    expect(facts['paladinSmite.remaining']).toBe(1); // free use untouched
  });

  it('a spent slot/free use persists across a turn and restores on a long rest', () => {
    const { advertised } = evaluatePlan(ALL, INPUT, [attack('a1'), smite('s1')]);

    const afterTurn = endTurn([], advertised, { longRest: false });
    expect(evaluateSheet(ALL, INPUT, afterTurn)['paladinSmite.remaining']).toBe(0);

    const afterRest = endTurn([], advertised, { longRest: true });
    expect(evaluateSheet(ALL, INPUT, afterRest)['paladinSmite.remaining']).toBe(1);
  });
});

describe('v2 divine-smite — illegal-but-visible', () => {
  it('flags a planned smite illegal when no attack was made this turn', () => {
    const { planDiagnostics } = evaluatePlan(ALL, INPUT, [smite('s1')]);
    expect(planDiagnostics.get('s1')?.some((d) => d.code.endsWith('no_attack'))).toBe(true);
  });
});

describe('v2 divine-smite — slot cascade / slider bounds (no free-use feature)', () => {
  it('defaults to the lowest available slot and floors the slider at level 1', () => {
    // Prepared but no paladin-smite; only L2 slots exist.
    const facts = evaluateSheet([spellcasting, divineSmite], {
      'spell.l1.divineSmite.prepared': 1,
      'spellcasting.slots.level2.total': 3
    });
    expect(facts['smite.lowestAvailableSlotLevel']).toBe(2);
    expect(facts['smite.defaultLevel']).toBe(2);
    expect(facts['smite.minSlotLevel']).toBe(1); // no free-use feature -> no level-0 notch
    expect(facts['smite.maxCastLevel']).toBe(2);
    expect(facts['smite.defaultDieCount']).toBe(3); // L2 default -> 3d8
  });

  it('default die count tracks the default level (free use / L1 = 2d8)', () => {
    expect(evaluateSheet(ALL, INPUT)['smite.defaultDieCount']).toBe(2); // free use default
  });

  it('reports zero default dice when no slot or free use remains', () => {
    // Prepared, but no free-use feature and no slots: nothing castable.
    const facts = evaluateSheet([spellcasting, divineSmite], {
      'spell.l1.divineSmite.prepared': 1
    });
    expect(facts['smite.anyResourceRemaining']).toBe(0);
    expect(facts['smite.defaultDieCount']).toBe(0);
  });
});

describe('v2 divine-smite — paladin slots + level bounds', () => {
  it('class-paladin-level1 grants two level-1 spell slots', () => {
    const facts = evaluateSheet([spellcasting, classPaladinLevel1], {});
    expect(facts['spellcasting.slots.level1.total']).toBe(2);
    expect(facts['spellcasting.maxSlotLevel']).toBe(1);
  });

  it('rejects a smite selection above level 5 without consuming a high slot', () => {
    const { facts, planDiagnostics } = evaluatePlan(
      ALL,
      { 'spellcasting.slots.level1.total': 2, 'spellcasting.slots.level6.total': 1 },
      [attack('a1'), smite('s1', 6)]
    );
    expect(planDiagnostics.get('s1')?.some((d) => d.code.endsWith('wrong_level'))).toBe(true);
    expect(facts['spellcasting.slots.level6.remaining']).toBe(1); // untouched
  });
});
