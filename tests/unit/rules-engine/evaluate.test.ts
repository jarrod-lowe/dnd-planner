import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput, Rule } from '$lib/rules-engine/types';

describe('evaluate', () => {
  it('returns valid output structure for empty input', () => {
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.status).toBeDefined();
    expect(result.facts).toEqual({});
    expect(result.collections).toEqual({});
    expect(result.availableRules).toEqual([]);
    expect(result.diagnostics).toEqual({ errors: [], warnings: [], notices: [] });
    expect(result.trace).toBeDefined();
    expect(result.next).toBeDefined();
  });

  it('executes a simple rule and updates facts', () => {
    const rule: Rule = {
      id: 'test-rule',
      activities: [
        { id: 'act-1', type: 'numberSet', target: { fact: 'hp.current' }, source: { number: 30 } }
      ]
    };
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.facts['hp.current']).toBe(30);
    expect(result.trace.appliedRuleIds).toContain('test-rule');
  });

  it('executes phases in correct order', () => {
    const earlyRule: Rule = {
      id: 'early-1',
      phase: 'early',
      activities: [
        { id: 'a1', type: 'numberSet', target: { fact: 'order' }, source: { number: 1 } }
      ]
    };
    const normalRule: Rule = {
      id: 'normal-1',
      phase: 'normal',
      activities: [
        { id: 'a2', type: 'numberIncrement', target: { fact: 'order' }, source: { number: 10 } }
      ]
    };
    const safeguardRule: Rule = {
      id: 'safeguard-1',
      phase: 'safeguard',
      activities: [
        { id: 'a3', type: 'numberIncrement', target: { fact: 'order' }, source: { number: 100 } }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: {
        standing: [earlyRule, normalRule, safeguardRule],
        planned: [],
        effects: []
      },
      state: { facts: {} }
    };

    const result = evaluate(input);

    // 1 + 10 + 100 = 111 (proves order: early first, then normal, then safeguard)
    expect(result.facts['order']).toBe(111);
  });

  it('handles after dependencies within a phase', () => {
    const initRule: Rule = {
      id: 'init',
      group: ['init-group'],
      activities: [
        { id: 'a1', type: 'numberSet', target: { fact: 'initialized' }, source: { number: 1 } }
      ]
    };
    const dependentRule: Rule = {
      id: 'dependent',
      after: [{ group: 'init-group' }],
      activities: [
        { id: 'a2', type: 'numberSet', target: { fact: 'depends' }, source: { number: 2 } }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [dependentRule, initRule], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.facts['initialized']).toBe(1);
    expect(result.facts['depends']).toBe(2);
  });

  it('returns replayable next input', () => {
    const rule: Rule = {
      id: 'test-rule',
      activities: [
        { id: 'a1', type: 'numberSet', target: { fact: 'hp.current' }, source: { number: 30 } }
      ]
    };
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: { 'hp.max': 30 } }
    };

    const result = evaluate(input);

    expect(result.next.schemaVersion).toBe(1);
    expect(result.next.rules.standing).toContain(rule);
    expect(result.next.rules.planned).toEqual([]);
    expect(result.next.state.facts).toEqual({ 'hp.max': 30 });
  });

  it('preserves planned rules in next input', () => {
    const plannedRule: Rule = {
      id: 'planned-1',
      activities: [{ id: 'a1', type: 'numberSet', target: { fact: 'x' }, source: { number: 5 } }]
    };
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [], planned: [plannedRule], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    // Planned rule should execute
    expect(result.facts['x']).toBe(5);
    // Planned rule should persist in next input (evaluate is a calculation, not execution)
    expect(result.next.rules.planned).toEqual([plannedRule]);
  });

  it('preserves planned rules when re-evaluated with next', () => {
    const plannedRule: Rule = {
      id: 'planned-action',
      activities: [
        { id: 'a1', type: 'numberSet', target: { fact: 'planned_value' }, source: { number: 42 } }
      ]
    };
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [], planned: [plannedRule], effects: [] },
      state: { facts: {} }
    };

    const result1 = evaluate(input);

    // First evaluation: planned rule executes
    expect(result1.facts['planned_value']).toBe(42);
    expect(result1.next.rules.planned).toEqual([plannedRule]);

    // Re-evaluate using the next input
    const result2 = evaluate(result1.next);

    // Second evaluation: planned rule should still be there and produce same result
    expect(result2.facts['planned_value']).toBe(42);
    expect(result2.next.rules.planned).toEqual([plannedRule]);
  });

  it('includes generated rules in output', () => {
    const generatorRule: Rule = {
      id: 'generator',
      phase: 'early',
      activities: [
        {
          id: 'gen-1',
          type: 'generateRule',
          rule: {
            id: 'generated-rule',
            phase: 'normal',
            activities: [
              { id: 'a1', type: 'numberSet', target: { fact: 'generated' }, source: { number: 99 } }
            ]
          }
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [generatorRule], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.facts['generated']).toBe(99);
    expect(result.next.rules.effects).toHaveLength(1);
    expect(result.next.rules.effects[0].id).toBe('generated-rule');
  });

  it('includes offered rules in availableRules', () => {
    const offeredRule: Rule = {
      id: 'offered-1',
      activities: [{ id: 'a1', type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }]
    };
    const offerRule: Rule = {
      id: 'offer-source',
      activities: [
        {
          id: 'offer-1',
          type: 'offerRule',
          rule: offeredRule
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [offerRule], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.availableRules).toHaveLength(1);
    expect(result.availableRules[0].rule.id).toBe('offered-1');
    expect(result.availableRules[0].legal).toBe(true);
  });

  it('produces equivalent facts when re-evaluated with next', () => {
    const rule: Rule = {
      id: 'test-rule',
      activities: [
        { id: 'a1', type: 'numberSet', target: { fact: 'hp.current' }, source: { number: 30 } }
      ]
    };
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: { 'hp.max': 30 } }
    };

    const result1 = evaluate(input);

    // Re-evaluate using the next input
    const result2 = evaluate(result1.next);

    // Facts should be equivalent (same operations applied)
    expect(result2.facts['hp.current']).toBe(30);
    expect(result2.facts['hp.max']).toBe(30);
    // Standing rules still present
    expect(result2.next.rules.standing).toHaveLength(1);
  });

  it('computes half movement using multiply function', () => {
    const halfMovementRule: Rule = {
      id: 'compute-half-movement',
      phase: 'early',
      activities: [
        {
          id: 'half-1',
          type: 'numberFunction',
          function: 'multiply',
          sources: [{ fact: 'character.movement.current' }],
          target: { fact: 'character.movement.half' },
          args: { multiplier: 0.5 }
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [halfMovementRule], planned: [], effects: [] },
      state: { facts: { 'character.movement.current': 30 } }
    };

    const result = evaluate(input);

    expect(result.facts['character.movement.half']).toBe(15);
  });

  it('rough terrain walk consumes double movement', () => {
    // Rule that offers rough terrain walk
    const offerRoughTerrainRule: Rule = {
      id: 'offer-rough-terrain',
      activities: [
        {
          id: 'offer-1',
          type: 'offerRule',
          legalWhen: [
            {
              condition: {
                fact: 'character.movement.current',
                operator: 'greaterThan',
                value: 0
              },
              illegalDiagnostics: [{ code: 'out_of_movement', severity: 'error' }]
            }
          ],
          rule: {
            id: 'move-rough-terrain',
            vars: {
              distance: {
                capture: true,
                default: { fact: 'character.movement.half' }
              }
            },
            activities: [
              {
                id: 'consume-1',
                type: 'numberIncrement',
                target: { fact: 'character.movement.current' },
                source: { var: 'distance' },
                subtract: true
              },
              {
                id: 'consume-2',
                type: 'numberIncrement',
                target: { fact: 'character.movement.current' },
                source: { var: 'distance' },
                subtract: true
              }
            ]
          }
        }
      ]
    };

    // Half movement computation rule
    const halfMovementRule: Rule = {
      id: 'compute-half-movement',
      phase: 'early',
      activities: [
        {
          id: 'half-1',
          type: 'numberFunction',
          function: 'multiply',
          sources: [{ fact: 'character.movement.current' }],
          target: { fact: 'character.movement.half' },
          args: { multiplier: 0.5 }
        }
      ]
    };

    // Planned rough terrain walk with 10ft distance
    const plannedRoughTerrain: Rule = {
      id: 'move-rough-terrain',
      vars: {
        distance: {
          capture: true,
          default: { fact: 'character.movement.half' }
        }
      },
      selections: { distance: 10 },
      activities: [
        {
          id: 'consume-1',
          type: 'numberIncrement',
          target: { fact: 'character.movement.current' },
          source: { var: 'distance' },
          subtract: true
        },
        {
          id: 'consume-2',
          type: 'numberIncrement',
          target: { fact: 'character.movement.current' },
          source: { var: 'distance' },
          subtract: true
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: {
        standing: [halfMovementRule, offerRoughTerrainRule],
        planned: [plannedRoughTerrain],
        effects: []
      },
      state: { facts: { 'character.movement.current': 30 } }
    };

    const result = evaluate(input);

    // 30 - 10 - 10 = 10 (double consumption)
    expect(result.facts['character.movement.current']).toBe(10);
    // Half movement should be 15 (from early phase computation)
    expect(result.facts['character.movement.half']).toBe(15);
  });
});
