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
          sources: [{ fact: 'character.movement.remaining' }],
          target: { fact: 'character.movement.half' },
          args: { multiplier: 0.5 }
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [halfMovementRule], planned: [], effects: [] },
      state: { facts: { 'character.movement.remaining': 30 } }
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
                fact: 'character.movement.remaining',
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
                target: { fact: 'character.movement.remaining' },
                source: { var: 'distance' },
                subtract: true
              },
              {
                id: 'consume-2',
                type: 'numberIncrement',
                target: { fact: 'character.movement.remaining' },
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
          sources: [{ fact: 'character.movement.remaining' }],
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
          target: { fact: 'character.movement.remaining' },
          source: { var: 'distance' },
          subtract: true
        },
        {
          id: 'consume-2',
          type: 'numberIncrement',
          target: { fact: 'character.movement.remaining' },
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
      state: { facts: { 'character.movement.remaining': 30 } }
    };

    const result = evaluate(input);

    // 30 - 10 - 10 = 10 (double consumption)
    expect(result.facts['character.movement.remaining']).toBe(10);
    // Half movement should be 15 (from early phase computation)
    expect(result.facts['character.movement.half']).toBe(15);
  });

  describe('effects system', () => {
    it('processes effects from input.rules.effects', () => {
      const effectRule: Rule = {
        id: 'effect-consume-slot',
        phase: 'normal',
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          }
        ]
      };

      const input: EngineInput = {
        schemaVersion: 1,
        rules: { standing: [], planned: [], effects: [effectRule] },
        state: { facts: { 'slots.remaining': 3 } }
      };

      const result = evaluate(input);

      expect(result.facts['slots.remaining']).toBe(2);
    });

    it('spell advertises an effect that appears in output.effects', () => {
      const spellRule: Rule = {
        id: 'cast-spell',
        activities: [
          {
            id: 'consume-slot',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          {
            id: 'advertise',
            type: 'advertiseEffect',
            rule: {
              id: 'effect-slot-consumed',
              phase: 'normal',
              activities: [
                {
                  id: 'reconsume',
                  type: 'numberIncrement',
                  target: { fact: 'slots.remaining' },
                  source: { number: 1 },
                  subtract: true
                },
                { id: 'sustain', type: 'advertiseEffect', self: true }
              ]
            }
          }
        ]
      };

      const input: EngineInput = {
        schemaVersion: 1,
        rules: { standing: [], planned: [spellRule], effects: [] },
        state: { facts: { 'slots.remaining': 3 } }
      };

      const result = evaluate(input);

      // Spell consumed 1 slot
      expect(result.facts['slots.remaining']).toBe(2);
      // Effect was advertised
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].id).toBe('effect-slot-consumed-1');
    });

    it('new effects get unique IDs across turns (counter seeded from existing)', () => {
      // Regression: advertisedEffectCounter used to reset to 0 each evaluation,
      // causing new effects to get the same ID as committed effects from prior turns.
      // The fix seeds the counter from the max numeric suffix in input.effects.

      const spellRule: Rule = {
        id: 'cast-spell',
        activities: [
          {
            id: 'advertise',
            type: 'advertiseEffect',
            rule: {
              id: 'effect-slot',
              phase: 'normal',
              activities: [{ id: 'sustain', type: 'advertiseEffect', self: true }]
            }
          }
        ]
      };

      // === Turn 1: Cast spell → get effect with id effect-slot-1 ===
      const result1 = evaluate({
        schemaVersion: 1,
        rules: { standing: [], planned: [spellRule], effects: [] },
        state: { facts: {} }
      });
      expect(result1.effects).toHaveLength(1);
      expect(result1.effects[0].id).toBe('effect-slot-1');

      // === Turn 2: Cast spell again → should get a NEW effect with unique ID ===
      const result2 = evaluate({
        schemaVersion: 1,
        rules: { standing: [], planned: [spellRule], effects: result1.effects },
        state: { facts: result1.facts }
      });

      // Self-sustaining old effect + newly advertised effect = 2
      expect(result2.effects).toHaveLength(2);
      // New effect gets a unique ID (not colliding with existing -1)
      const effectIds = result2.effects.map((e) => e.id).sort();
      expect(effectIds).toContain('effect-slot-1');
      expect(effectIds).toContain('effect-slot-2');
    });

    it('self-sustaining effect re-advertises itself in output.effects', () => {
      const effectRule: Rule = {
        id: 'effect-slot-1',
        phase: 'normal',
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          { id: 'sustain', type: 'advertiseEffect', self: true }
        ]
      };

      const input: EngineInput = {
        schemaVersion: 1,
        rules: { standing: [], planned: [], effects: [effectRule] },
        state: { facts: { 'slots.remaining': 3 } }
      };

      const result = evaluate(input);

      // Effect consumed 1 slot
      expect(result.facts['slots.remaining']).toBe(2);
      // Effect re-advertised itself
      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].id).toBe('effect-slot-1');
    });

    it('simulates multi-turn spell slot consumption', () => {
      // Turn 1: Spell with effect advertisement
      const spellRule: Rule = {
        id: 'cast-spell',
        activities: [
          {
            id: 'consume-slot',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          {
            id: 'advertise',
            type: 'advertiseEffect',
            rule: {
              id: 'effect-slot',
              phase: 'normal',
              activities: [
                {
                  id: 'consume',
                  type: 'numberIncrement',
                  target: { fact: 'slots.remaining' },
                  source: { number: 1 },
                  subtract: true
                },
                { id: 'sustain', type: 'advertiseEffect', self: true }
              ]
            }
          }
        ]
      };

      // Early phase: reset slots to total
      const resetRule: Rule = {
        id: 'reset-slots',
        phase: 'early',
        activities: [
          {
            id: 'copy',
            type: 'numberCopy',
            target: { fact: 'slots.remaining' },
            source: { fact: 'slots.total' }
          }
        ]
      };

      // === Turn 1 ===
      const turn1: EngineInput = {
        schemaVersion: 1,
        rules: { standing: [resetRule], planned: [spellRule], effects: [] },
        state: { facts: { 'slots.total': 4, 'slots.remaining': 4 } }
      };

      const result1 = evaluate(turn1);

      // Spell consumed 1 slot: reset to 4, then spell -1 = 3
      expect(result1.facts['slots.remaining']).toBe(3);
      expect(result1.effects).toHaveLength(1);

      // === Turn 2: commit effects, clear plan ===
      const turn2: EngineInput = {
        schemaVersion: 1,
        rules: {
          standing: [resetRule],
          planned: [],
          effects: result1.effects
        },
        state: { facts: result1.facts }
      };

      const result2 = evaluate(turn2);

      // Reset to total (4), then effect -1 = 3
      // Wait - the state.facts are the projected facts from turn 1 (slots.remaining = 3)
      // But the early phase reset copies total (4) to remaining
      // Then the effect consumes 1: 4 - 1 = 3
      expect(result2.facts['slots.remaining']).toBe(3);
      // Effect re-advertised itself
      expect(result2.effects).toHaveLength(1);
      expect(result2.effects[0].id).toBe('effect-slot-1');

      // === Turn 3: cast another spell ===
      const turn3: EngineInput = {
        schemaVersion: 1,
        rules: {
          standing: [resetRule],
          planned: [spellRule],
          effects: result2.effects
        },
        state: { facts: result2.facts }
      };

      const result3 = evaluate(turn3);

      // Reset to total (4), effect -1, spell -1 = 2
      expect(result3.facts['slots.remaining']).toBe(2);
      // Old effect re-advertised + new effect advertised = 2
      expect(result3.effects).toHaveLength(2);
    });

    it('early-phase effects consume slots before normal-phase offer checks legality', () => {
      // Regression: effects in normal phase ran concurrently with offer rules,
      // so the offer saw pre-consumption slot values and incorrectly marked
      // the spell as legal. Moving effects to early phase (after slot reset)
      // ensures offers see the actual remaining slots.

      // Early phase: reset remaining = total
      const resetRule: Rule = {
        id: 'reset-slots',
        phase: 'early',
        group: ['slots-set'],
        activities: [
          {
            id: 'copy',
            type: 'numberCopy',
            target: { fact: 'slots.remaining' },
            source: { fact: 'slots.total' }
          }
        ]
      };

      // Normal phase: offer checks if slots available
      const offerRule: Rule = {
        id: 'offer-spell',
        after: [{ group: 'slots-set' }],
        activities: [
          {
            id: 'offer',
            type: 'offerRule',
            legalWhen: [
              {
                condition: { fact: 'slots.remaining', operator: 'greaterThan', value: 0 },
                illegalDiagnostics: [{ code: 'no_slots', severity: 'error' }]
              }
            ],
            rule: {
              id: 'cast-spell',
              activities: [
                {
                  id: 'consume',
                  type: 'numberIncrement',
                  target: { fact: 'slots.remaining' },
                  source: { number: 1 },
                  subtract: true
                }
              ]
            }
          }
        ]
      };

      // Two committed effects, each consuming 1 slot — must run in early phase
      // after the reset so the offer sees post-consumption values.
      const effect1: Rule = {
        id: 'effect-slot-1',
        phase: 'early',
        after: [{ group: 'slots-set' }],
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          { id: 'sustain', type: 'advertiseEffect', self: true }
        ]
      };
      const effect2: Rule = {
        id: 'effect-slot-2',
        phase: 'early',
        after: [{ group: 'slots-set' }],
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          { id: 'sustain', type: 'advertiseEffect', self: true }
        ]
      };

      const result = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, offerRule],
          planned: [],
          effects: [effect1, effect2]
        },
        state: { facts: { 'slots.total': 2, 'slots.remaining': 0 } }
      });

      // After reset: remaining = total = 2
      // After effects: remaining = 2 - 1 - 1 = 0
      expect(result.facts['slots.remaining']).toBe(0);

      // Offer should see 0 remaining and mark spell as ILLEGAL
      expect(result.availableRules).toHaveLength(1);
      expect(result.availableRules[0].legal).toBe(false);
    });

    it('self-sustaining effect expires when long rest is planned', () => {
      // Early phase: reset rest.long to 0
      const restResetRule: Rule = {
        id: 'rest-long-reset',
        phase: 'early',
        group: ['rest-reset'],
        activities: [
          {
            id: 'reset-rest',
            type: 'numberSet',
            target: { fact: 'rest.long' },
            source: { number: 0 }
          }
        ]
      };

      // Early phase: long rest action sets rest.long to 1 (when planned)
      const longRestRule: Rule = {
        id: 'long-rest',
        phase: 'early',
        after: [{ group: 'rest-reset' }],
        activities: [
          {
            id: 'set-rest',
            type: 'numberSet',
            target: { fact: 'rest.long' },
            source: { number: 1 }
          }
        ]
      };

      // Early phase: self-sustaining effect that only re-advertises if NOT long resting
      const effect: Rule = {
        id: 'effect-slot',
        phase: 'early',
        after: [{ group: 'slots-set' }],
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          {
            id: 'sustain',
            type: 'advertiseEffect',
            self: true,
            when: { fact: 'rest.long', operator: 'equals', value: 0 }
          }
        ]
      };

      // Early phase: reset slots
      const resetRule: Rule = {
        id: 'reset-slots',
        phase: 'early',
        group: ['slots-set'],
        activities: [
          {
            id: 'copy',
            type: 'numberCopy',
            target: { fact: 'slots.remaining' },
            source: { fact: 'slots.total' }
          }
        ]
      };

      // Long rest turn: effect should NOT re-advertise
      const result = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, restResetRule],
          planned: [longRestRule],
          effects: [effect]
        },
        state: { facts: { 'slots.total': 4, 'slots.remaining': 3 } }
      });

      // Effect ran (subtracted 1 from slots) but did NOT re-advertise
      expect(result.effects).toHaveLength(0);
    });

    it('multi-turn long rest restores spell slots', () => {
      // Simulates: cast spell → effect persists → long rest → slots restored

      // --- Shared rules ---
      const resetRule: Rule = {
        id: 'reset-slots',
        phase: 'early',
        group: ['slots-set'],
        activities: [
          {
            id: 'copy',
            type: 'numberCopy',
            target: { fact: 'slots.remaining' },
            source: { fact: 'slots.total' }
          }
        ]
      };

      const restResetRule: Rule = {
        id: 'rest-long-reset',
        phase: 'early',
        group: ['rest-reset'],
        activities: [
          {
            id: 'reset-rest',
            type: 'numberSet',
            target: { fact: 'rest.long' },
            source: { number: 0 }
          }
        ]
      };

      const longRestRule: Rule = {
        id: 'long-rest',
        phase: 'early',
        after: [{ group: 'rest-reset' }],
        activities: [
          {
            id: 'set-rest',
            type: 'numberSet',
            target: { fact: 'rest.long' },
            source: { number: 1 }
          }
        ]
      };

      const spellRule: Rule = {
        id: 'cast-spell',
        activities: [
          {
            id: 'consume-slot',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          {
            id: 'advertise',
            type: 'advertiseEffect',
            rule: {
              id: 'effect-slot',
              phase: 'early',
              after: [{ group: 'slots-set' }],
              activities: [
                {
                  id: 'consume',
                  type: 'numberIncrement',
                  target: { fact: 'slots.remaining' },
                  source: { number: 1 },
                  subtract: true
                },
                {
                  id: 'sustain',
                  type: 'advertiseEffect',
                  self: true,
                  when: { fact: 'rest.long', operator: 'equals', value: 0 }
                }
              ]
            }
          }
        ]
      };

      // === Turn 1: Cast spell ===
      const result1 = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, restResetRule],
          planned: [spellRule],
          effects: []
        },
        state: { facts: { 'slots.total': 2, 'slots.remaining': 2 } }
      });

      // Reset to 2, spell -1 = 1
      expect(result1.facts['slots.remaining']).toBe(1);
      expect(result1.effects).toHaveLength(1);

      // === Turn 2: Effect persists ===
      const result2 = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, restResetRule],
          planned: [],
          effects: result1.effects
        },
        state: { facts: result1.facts }
      });

      // Reset to 2, effect -1 = 1
      expect(result2.facts['slots.remaining']).toBe(1);
      expect(result2.effects).toHaveLength(1);

      // === Turn 3: Long Rest — effect should NOT re-advertise ===
      const result3 = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, restResetRule],
          planned: [longRestRule],
          effects: result2.effects
        },
        state: { facts: result2.facts }
      });

      // Reset to 2, effect -1 = 1 (effect still ran this turn)
      expect(result3.facts['slots.remaining']).toBe(1);
      // But effect did NOT re-advertise
      expect(result3.effects).toHaveLength(0);

      // === Turn 4: After long rest — slots fully restored ===
      const result4 = evaluate({
        schemaVersion: 1,
        rules: {
          standing: [resetRule, restResetRule],
          planned: [],
          effects: result3.effects
        },
        state: { facts: result3.facts }
      });

      // Reset to 2, no effects to subtract = 2
      expect(result4.facts['slots.remaining']).toBe(2);
      expect(result4.effects).toHaveLength(0);
    });
  });
});
