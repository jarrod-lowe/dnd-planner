import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers } from '$lib/rules-engine-v2';
import type { PlannedRef, RuleModule } from '$lib/rules-engine-v2';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';

const NO_ACTION = 'rule.dnd-5e-2024.attacks.activation.no_action';

/**
 * M0 spike, increment 2 (+3 unified-effects rewrite) — the reducer + offers.
 *
 * Proves pain #2's timing half: the turn plan is a left fold that re-derives the
 * sheet with effects-so-far before each action, so each action sees the real
 * current state. Extra-attack's "extra charge vs. new action" decision is a plain
 * branch on current state — no `attackAction.wasExtra` / `actionsBefore`
 * snapshots. Offers stay illegal-but-visible.
 */
describe('v2 plan reducer — ordered fold, no snapshots', () => {
  const swing = (instanceId: string): PlannedRef => ({
    instanceId,
    ruleId: 'unarmed-strike-use-action'
  });

  it('extra-attack: spends follow-up charges before actions, from real current state', () => {
    const { facts, planDiagnostics } = evaluatePlan(
      [actionEconomy, attacks],
      { 'extraAttacks.max': 1 },
      [swing('a1'), swing('a2'), swing('a3')]
    );

    // a1 new action (refill extra=1); a2 free extra; a3 new action (over-commit).
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
    const { facts, planDiagnostics } = evaluatePlan([actionEconomy, attacks], {}, [
      swing('a1'),
      swing('a2')
    ]);
    expect(facts['actions.remaining']).toBe(-1);
    expect(planDiagnostics.get('a1')).toBeUndefined();
    expect(planDiagnostics.get('a2')?.[0].code).toBe(NO_ACTION);
  });

  it('is a pure fold: re-running the same plan gives the same result', () => {
    const plan = [swing('a1'), swing('a2')];
    const first = evaluatePlan([actionEconomy, attacks], { 'extraAttacks.max': 1 }, plan);
    const second = evaluatePlan([actionEconomy, attacks], { 'extraAttacks.max': 1 }, plan);
    expect(second.facts).toEqual(first.facts);
  });
});

describe('v2 offers — illegal-but-visible', () => {
  it('offers an action as legal when resources are available', () => {
    const baseline = evaluateSheet([actionEconomy, attacks], {});
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
  const m1: RuleModule = { id: 'm1', offer: () => [{ id: 'dup', apply: () => ({}) }] };
  const m2: RuleModule = { id: 'm2', offer: () => [{ id: 'dup', apply: () => ({}) }] };

  it('evaluateOffers rejects duplicate offer ids across modules', () => {
    expect(() => evaluateOffers([m1, m2], {})).toThrow(/duplicate offer id/i);
  });

  it('evaluatePlan rejects duplicate offer ids across modules', () => {
    expect(() => evaluatePlan([m1, m2], {}, [])).toThrow(/duplicate offer id/i);
  });
});

describe('v2 plan — legalWhen flags planned actions illegal (illegal-but-visible)', () => {
  // A cast whose apply only advertises the spend and does NOT re-check the gate.
  // With no slots it must still be flagged via legalWhen — and still apply.
  const caster: RuleModule = {
    id: 'caster',
    derive: () => [{ fact: 'spellcasting.slots.level1.remaining', value: () => 0 }],
    offer: () => [
      {
        id: 'cast-x',
        legalWhen: [
          {
            condition: (f) => f.num('spellcasting.slots.level1.remaining') > 0,
            diagnostics: [{ code: 'no_slot', severity: 'error' }]
          }
        ],
        apply: () => ({
          advertise: [
            {
              id: 'e',
              state: { 'spellcasting.slots.level1.spent': 1 },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        })
      }
    ]
  };

  it('flags a planned action illegal when legalWhen fails, even if apply does not self-check', () => {
    const { planDiagnostics, advertised } = evaluatePlan([caster], {}, [
      { instanceId: 'p1', ruleId: 'cast-x' }
    ]);
    expect(planDiagnostics.get('p1')?.[0].code).toBe('no_slot');
    expect(advertised).toHaveLength(1); // still applies — illegal-but-visible
  });

  it('does not duplicate a diagnostic raised by both legalWhen and apply', () => {
    const dupCaster: RuleModule = {
      id: 'dup-caster',
      offer: () => [
        {
          id: 'dup-cast',
          legalWhen: [
            { condition: () => false, diagnostics: [{ code: 'same', severity: 'error' }] }
          ],
          apply: () => ({ diagnostics: [{ code: 'same', severity: 'error' }] })
        }
      ]
    };
    const { planDiagnostics } = evaluatePlan([dupCaster], {}, [
      { instanceId: 'd1', ruleId: 'dup-cast' }
    ]);
    expect(planDiagnostics.get('d1')).toEqual([{ code: 'same', severity: 'error' }]);
  });
});

describe('v2 plan — effect-based spends are visible within the turn (Codex plan.ts:94 fix)', () => {
  const spellcasting: RuleModule = {
    id: 'spellcasting',
    derive: () => [
      { fact: 'spellcasting.slots.level1.max', value: () => 1 },
      {
        fact: 'spellcasting.slots.level1.remaining',
        value: (f) =>
          f.num('spellcasting.slots.level1.max') - f.num('spellcasting.slots.level1.spent')
      }
    ]
  };
  const cast: RuleModule = {
    id: 'cast',
    offer: () => [
      {
        id: 'cast-l1',
        legalWhen: [
          {
            condition: (f) => f.num('spellcasting.slots.level1.remaining') > 0,
            diagnostics: [{ code: 'no_slot', severity: 'error' }]
          }
        ],
        // Spends the slot SOLELY by advertising an effect (the path Codex flagged).
        apply: () => ({
          advertise: [
            {
              id: 's',
              state: { 'spellcasting.slots.level1.spent': 1 },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        })
      }
    ]
  };

  it('a second cast with one slot is illegal because the first already spent it', () => {
    const { facts, planDiagnostics } = evaluatePlan([spellcasting, cast], {}, [
      { instanceId: 'c1', ruleId: 'cast-l1' },
      { instanceId: 'c2', ruleId: 'cast-l1' }
    ]);
    expect(planDiagnostics.get('c1')).toBeUndefined(); // slot available
    expect(planDiagnostics.get('c2')?.[0].code).toBe('no_slot'); // first spend now visible
    expect(facts['spellcasting.slots.level1.remaining']).toBe(-1);
  });
});
