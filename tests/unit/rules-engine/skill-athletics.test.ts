import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput } from '$lib/rules-engine/types';

/**
 * Tests for the Athletics (STR) skill calculation:
 * - Reset rule zeros skill.athletics.value and skill.athletics.proficiency
 * - Modifier rule adds str.modifier to skill.athletics.value
 * - Proficiency effect adds proficiency.bonus * level to skill.athletics.value
 *
 * Expected behavior:
 * - Without proficiency: Athletics = STR modifier
 * - Half proficiency: Athletics = STR mod + (proficiency * 0.5)
 * - Full proficiency: Athletics = STR mod + proficiency
 * - Double proficiency: Athletics = STR mod + (proficiency * 2)
 */
describe('Athletics skill calculation', () => {
  // Helper to build the base input with STR 16 (+3 mod) and proficiency bonus +2
  function buildBaseInput(): EngineInput {
    return {
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
            id: 'proficiency-set',
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
              { type: 'numberSet', target: { fact: 'str.modifier' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'str.save' }, source: { number: 0 } }
            ]
          },
          {
            id: 'athletics-value-reset',
            phase: 'early',
            group: ['athletics-base'],
            activities: [
              {
                type: 'numberSet',
                target: { fact: 'skill.athletics.value' },
                source: { number: 0 }
              },
              {
                type: 'numberSet',
                target: { fact: 'skill.athletics.proficiency' },
                source: { number: 0 }
              }
            ]
          },
          {
            id: 'athletics-modifier',
            phase: 'normal',
            activities: [
              {
                type: 'numberIncrement',
                target: { fact: 'skill.athletics.value' },
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
          }
        ]
      },
      state: {
        facts: {}
      }
    };
  }

  it('equals STR modifier when not proficient', () => {
    const output = evaluate(buildBaseInput());

    expect(output.facts['str.modifier']).toBe(3);
    expect(output.facts['skill.athletics.value']).toBe(3);
    expect(output.facts['skill.athletics.proficiency']).toBe(0);
  });

  it('adds full proficiency bonus when proficient (x1)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-athletics-proficiency',
      phase: 'early',
      after: [{ group: 'athletics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 1 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.athletics.proficiency' },
          source: { var: 'level' }
        },
        {
          type: 'numberFunction',
          function: 'multiply',
          sources: [{ fact: 'proficiency.bonus' }, { var: 'level' }],
          target: { var: 'profContribution' }
        },
        {
          type: 'numberIncrement',
          target: { fact: 'skill.athletics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['str.modifier']).toBe(3);
    expect(output.facts['proficiency.bonus']).toBe(2);
    expect(output.facts['skill.athletics.value']).toBe(5); // 3 + 2
    expect(output.facts['skill.athletics.proficiency']).toBe(1);
  });

  it('adds half proficiency bonus (x0.5)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-athletics-proficiency',
      phase: 'early',
      after: [{ group: 'athletics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 0.5 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.athletics.proficiency' },
          source: { var: 'level' }
        },
        {
          type: 'numberFunction',
          function: 'multiply',
          sources: [{ fact: 'proficiency.bonus' }, { var: 'level' }],
          target: { var: 'profContribution' }
        },
        {
          type: 'numberIncrement',
          target: { fact: 'skill.athletics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['skill.athletics.value']).toBe(4); // 3 + (2 * 0.5) = 3 + 1
    expect(output.facts['skill.athletics.proficiency']).toBe(0.5);
  });

  it('adds double proficiency bonus (x2)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-athletics-proficiency',
      phase: 'early',
      after: [{ group: 'athletics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 2 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.athletics.proficiency' },
          source: { var: 'level' }
        },
        {
          type: 'numberFunction',
          function: 'multiply',
          sources: [{ fact: 'proficiency.bonus' }, { var: 'level' }],
          target: { var: 'profContribution' }
        },
        {
          type: 'numberIncrement',
          target: { fact: 'skill.athletics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['skill.athletics.value']).toBe(7); // 3 + (2 * 2) = 3 + 4
    expect(output.facts['skill.athletics.proficiency']).toBe(2);
  });
});
