import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput, Rule } from '$lib/rules-engine/types';

describe('annotate activity', () => {
  it('adds annotation to engine output', () => {
    const rule: Rule = {
      id: 'test-annotate',
      activities: [
        {
          id: 'ann-1',
          type: 'annotate',
          key: 'test.annotation',
          targets: ['attack.melee', 'attack.unarmed']
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toEqual({
      key: 'test.annotation',
      targets: ['attack.melee', 'attack.unarmed']
    });
  });

  it('skips annotate when when conditions are not met', () => {
    const rule: Rule = {
      id: 'test-annotate-gated',
      activities: [
        {
          id: 'ann-1',
          type: 'annotate',
          key: 'test.annotation',
          targets: ['attack.melee'],
          when: [
            { fact: 'bonusActions.remaining', operator: 'greaterThan', value: 0 }
          ]
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: { 'bonusActions.remaining': 0 } }
    };

    const result = evaluate(input);

    expect(result.annotations).toHaveLength(0);
  });

  it('adds annotation when when conditions are met', () => {
    const rule: Rule = {
      id: 'test-annotate-pass',
      activities: [
        {
          id: 'ann-1',
          type: 'annotate',
          key: 'test.annotation',
          targets: ['attack.melee'],
          when: [
            { fact: 'bonusActions.remaining', operator: 'greaterThan', value: 0 },
            { fact: 'attack.last.activation.action', operator: 'equals', value: 1 }
          ]
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule], planned: [], effects: [] },
      state: { facts: { 'bonusActions.remaining': 1, 'attack.last.activation.action': 1 } }
    };

    const result = evaluate(input);

    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0].key).toBe('test.annotation');
  });

  it('collects annotations from multiple rules', () => {
    const rule1: Rule = {
      id: 'annotate-a',
      activities: [
        {
          id: 'ann-a',
          type: 'annotate',
          key: 'a.annotation',
          targets: ['attack.melee']
        }
      ]
    };
    const rule2: Rule = {
      id: 'annotate-b',
      activities: [
        {
          id: 'ann-b',
          type: 'annotate',
          key: 'b.annotation',
          targets: ['attack.unarmed']
        }
      ]
    };

    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: [rule1, rule2], planned: [], effects: [] },
      state: { facts: {} }
    };

    const result = evaluate(input);

    expect(result.annotations).toHaveLength(2);
    expect(result.annotations.map((a) => a.key)).toEqual(['a.annotation', 'b.annotation']);
  });
});
