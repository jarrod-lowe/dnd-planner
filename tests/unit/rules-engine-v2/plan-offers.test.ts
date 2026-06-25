import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers } from '$lib/rules-engine-v2';
import type { PlannedRef, RuleModule } from '$lib/rules-engine-v2';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';

const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';

/**
 * M0 spike, increment 2 — the reducer (plan) pass + offers.
 *
 * Proves pain #2's timing half: the turn plan is a left fold, so each action
 * reads the REAL current state left by earlier actions. The extra-attack
 * "spend an extra charge vs. a new action" decision is a plain branch on current
 * state — no `attackAction.wasExtra` / `actionsBefore` snapshot facts (which v1
 * needs in attacks.yaml). And offers stay illegal-but-visible.
 */
describe('v2 plan reducer — ordered fold, no snapshots', () => {
  const swing = (instanceId: string): PlannedRef => ({
    instanceId,
    ruleId: 'unarmed-strike-use-action'
  });

  it('extra-attack: spends follow-up charges before actions, from real current state', () => {
    const baseline = evaluateSheet([actionEconomy], { 'extraAttacks.max': 1 });
    const { facts, planDiagnostics } = evaluatePlan(
      baseline,
      [swing('a1'), swing('a2'), swing('a3')],
      [attacks]
    );

    // a1 new action (1->0, refill extra=1); a2 free extra (1->0); a3 new action
    // (0->-1, over-commit).
    expect(facts['actions.remaining']).toBe(-1);
    expect(facts['attackAction.extraRemaining']).toBe(0);
    expect(planDiagnostics.get('a1')).toBeUndefined();
    expect(planDiagnostics.get('a2')).toBeUndefined();
    expect(planDiagnostics.get('a3')?.[0].code).toBe(NO_ACTION);

    // The win over v1: no snapshot facts are needed or produced.
    expect('attackAction.wasExtra' in facts).toBe(false);
    expect('attackAction.actionsBefore' in facts).toBe(false);
  });

  it('without Extra Attack, each swing costs an action (second over-commits)', () => {
    const baseline = evaluateSheet([actionEconomy], {}); // extraAttacks.max absent -> 0
    const { facts, planDiagnostics } = evaluatePlan(
      baseline,
      [swing('a1'), swing('a2')],
      [attacks]
    );
    expect(facts['actions.remaining']).toBe(-1);
    expect(planDiagnostics.get('a1')).toBeUndefined();
    expect(planDiagnostics.get('a2')?.[0].code).toBe(NO_ACTION);
  });

  it('is a pure fold: re-running the same plan gives the same result', () => {
    const baseline = evaluateSheet([actionEconomy], { 'extraAttacks.max': 1 });
    const plan = [swing('a1'), swing('a2')];
    const first = evaluatePlan(baseline, plan, [attacks]);
    const second = evaluatePlan(baseline, plan, [attacks]);
    expect(second.facts).toEqual(first.facts);
  });
});

describe('v2 offers — illegal-but-visible', () => {
  it('offers an action as legal when resources are available', () => {
    const baseline = evaluateSheet([actionEconomy], {});
    const entry = evaluateOffers([attacks], baseline).find(
      (o) => o.id === 'unarmed-strike-use-action'
    );
    expect(entry).toBeDefined();
    expect(entry!.legal).toBe(true);
    expect(entry!.diagnostics).toEqual([]);
    expect(entry!.ui?.name).toBe('rule.dnd-5e-2024.attacks.unarmed-strike.name');
  });

  it('keeps the offer visible but marks it illegal with diagnostics when out of actions', () => {
    const entry = evaluateOffers([attacks], {
      'actions.remaining': 0,
      'attackAction.extraRemaining': 0
    }).find((o) => o.id === 'unarmed-strike-use-action');
    expect(entry).toBeDefined(); // still visible
    expect(entry!.legal).toBe(false); // but illegal
    expect(entry!.diagnostics[0].code).toBe(NO_ACTION);
  });
});

describe('v2 offers — unique ids (determinism)', () => {
  // Two modules advertising the same offer id would make the executed transition
  // depend on module load order, since a PlannedRef stores only the offer id.
  const m1: RuleModule = { id: 'm1', offer: () => [{ id: 'dup', apply: () => ({ facts: {} }) }] };
  const m2: RuleModule = { id: 'm2', offer: () => [{ id: 'dup', apply: () => ({ facts: {} }) }] };

  it('evaluateOffers rejects duplicate offer ids across modules', () => {
    expect(() => evaluateOffers([m1, m2], {})).toThrow(/duplicate offer id/i);
  });

  it('evaluatePlan rejects duplicate offer ids across modules', () => {
    expect(() => evaluatePlan({}, [], [m1, m2])).toThrow(/duplicate offer id/i);
  });
});
