import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput } from '$lib/rules-engine/types';

/**
 * Tests the save calculation pattern:
 * - Reset rule zeros str.value and str.save (group: str-base)
 * - Effect sets str.value from var, computes str.modifier (group: str-values, after: str-base)
 * - Standing rule increments str.save by str.modifier (after: str-values)
 *
 * Expected: str.value = 16, str.modifier = 3, str.save = 3
 */
describe('save modifier calculation', () => {
  it('adds modifier to save via standing rule after effect computes it', () => {
    const input: EngineInput = {
      schemaVersion: 1,
      rules: {
        standing: [
          {
            id: 'str-value-reset',
            phase: 'early',
            group: ['str-base'],
            activities: [
              { type: 'numberSet', target: { fact: 'str.value' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'str.save' }, source: { number: 0 } }
            ]
          },
          {
            id: 'str-save-modifier',
            phase: 'normal',
            activities: [
              {
                type: 'numberIncrement',
                target: { fact: 'str.save' },
                source: { fact: 'str.modifier' }
              }
            ]
          }
        ],
        planned: [],
        effects: [
          {
            id: 'effect-strength',
            phase: 'early',
            group: ['str-values'],
            after: [{ group: 'str-base' }],
            vars: {
              score: { default: { number: 16 } }
            },
            activities: [
              {
                type: 'numberSet',
                target: { fact: 'str.value' },
                source: { var: 'score' }
              },
              {
                type: 'numberFunction',
                function: 'statToModifier',
                sources: [{ var: 'score' }],
                target: { fact: 'str.modifier' }
              },
              { type: 'advertiseEffect', self: true }
            ]
          }
        ]
      },
      state: {
        facts: {}
      }
    };

    const output = evaluate(input);

    expect(output.facts['str.value']).toBe(16);
    expect(output.facts['str.modifier']).toBe(3);
    expect(output.facts['str.save']).toBe(3);
  });

  it('adds proficiency bonus to save on top of modifier', () => {
    const input: EngineInput = {
      schemaVersion: 1,
      rules: {
        standing: [
          {
            id: 'proficiency-reset',
            phase: 'early',
            group: ['proficiency-base'],
            activities: [
              { type: 'numberSet', target: { fact: 'proficiency.bonus' }, source: { number: 0 } }
            ]
          },
          {
            id: 'paladin-proficiency',
            phase: 'early',
            after: [{ group: 'proficiency-base' }],
            activities: [
              {
                type: 'numberIncrement',
                target: { fact: 'proficiency.bonus' },
                source: { number: 2 }
              }
            ]
          },
          {
            id: 'str-value-reset',
            phase: 'early',
            group: ['str-base'],
            activities: [
              { type: 'numberSet', target: { fact: 'str.value' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'str.save' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'str.save.proficient' }, source: { number: 0 } }
            ]
          },
          {
            id: 'str-save-modifier',
            phase: 'normal',
            activities: [
              {
                type: 'numberIncrement',
                target: { fact: 'str.save' },
                source: { fact: 'str.modifier' }
              }
            ]
          }
        ],
        planned: [],
        effects: [
          {
            id: 'effect-strength',
            phase: 'early',
            group: ['str-values'],
            after: [{ group: 'str-base' }],
            vars: {
              score: { default: { number: 16 } }
            },
            activities: [
              { type: 'numberSet', target: { fact: 'str.value' }, source: { var: 'score' } },
              {
                type: 'numberFunction',
                function: 'statToModifier',
                sources: [{ var: 'score' }],
                target: { fact: 'str.modifier' }
              },
              { type: 'advertiseEffect', self: true }
            ]
          },
          {
            id: 'effect-str-save-proficiency',
            phase: 'early',
            after: [{ group: 'str-base' }, { group: 'proficiency-base' }],
            activities: [
              { type: 'numberSet', target: { fact: 'str.save.proficient' }, source: { number: 1 } },
              {
                type: 'numberIncrement',
                target: { fact: 'str.save' },
                source: { fact: 'proficiency.bonus' }
              },
              { type: 'advertiseEffect', self: true }
            ]
          }
        ]
      },
      state: {
        facts: {}
      }
    };

    const output = evaluate(input);

    expect(output.facts['str.value']).toBe(16);
    expect(output.facts['str.modifier']).toBe(3);
    expect(output.facts['proficiency.bonus']).toBe(2);
    expect(output.facts['str.save']).toBe(5); // modifier(3) + proficiency(2)
    expect(output.facts['str.save.proficient']).toBe(1);
  });
});
