import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput } from '$lib/rules-engine/types';

/**
 * Tests for the Acrobatics (DEX) skill calculation:
 * - Reset rule zeros skill.acrobatics.value and skill.acrobatics.proficiency
 * - Modifier rule adds dex.modifier to skill.acrobatics.value
 * - Proficiency effect adds proficiency.bonus * level to skill.acrobatics.value
 *
 * Expected behavior:
 * - Without proficiency: Acrobatics = DEX modifier
 * - Half proficiency: Acrobatics = DEX mod + (proficiency * 0.5)
 * - Full proficiency: Acrobatics = DEX mod + proficiency
 * - Double proficiency: Acrobatics = DEX mod + (proficiency * 2)
 */
describe('Acrobatics skill calculation', () => {
  // Helper to build the base input with DEX 14 (+2 mod) and proficiency bonus +2
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
            id: 'dex-value-reset',
            phase: 'early',
            group: ['dex-base'],
            activities: [
              { type: 'numberSet', target: { fact: 'dex.value' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'dex.modifier' }, source: { number: 0 } },
              { type: 'numberSet', target: { fact: 'dex.save' }, source: { number: 0 } }
            ]
          },
          {
            id: 'acrobatics-value-reset',
            phase: 'early',
            group: ['acrobatics-base'],
            activities: [
              {
                type: 'numberSet',
                target: { fact: 'skill.acrobatics.value' },
                source: { number: 0 }
              },
              {
                type: 'numberSet',
                target: { fact: 'skill.acrobatics.proficiency' },
                source: { number: 0 }
              }
            ]
          },
          {
            id: 'acrobatics-modifier',
            phase: 'normal',
            activities: [
              {
                type: 'numberIncrement',
                target: { fact: 'skill.acrobatics.value' },
                source: { fact: 'dex.modifier' }
              }
            ]
          }
        ],
        planned: [],
        effects: [
          {
            id: 'effect-dexterity',
            phase: 'early',
            group: ['dex-values'],
            after: [{ group: 'dex-base' }],
            vars: {
              score: { default: { number: 14 } }
            },
            activities: [
              { type: 'numberSet', target: { fact: 'dex.value' }, source: { var: 'score' } },
              {
                type: 'numberFunction',
                function: 'statToModifier',
                sources: [{ var: 'score' }],
                target: { fact: 'dex.modifier' }
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

  it('equals DEX modifier when not proficient', () => {
    const output = evaluate(buildBaseInput());

    expect(output.facts['dex.modifier']).toBe(2);
    expect(output.facts['skill.acrobatics.value']).toBe(2);
    expect(output.facts['skill.acrobatics.proficiency']).toBe(0);
  });

  it('adds full proficiency bonus when proficient (x1)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-acrobatics-proficiency',
      phase: 'early',
      after: [{ group: 'acrobatics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 1 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.acrobatics.proficiency' },
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
          target: { fact: 'skill.acrobatics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['dex.modifier']).toBe(2);
    expect(output.facts['proficiency.bonus']).toBe(2);
    expect(output.facts['skill.acrobatics.value']).toBe(4); // 2 + 2
    expect(output.facts['skill.acrobatics.proficiency']).toBe(1);
  });

  it('adds half proficiency bonus (x0.5)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-acrobatics-proficiency',
      phase: 'early',
      after: [{ group: 'acrobatics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 0.5 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.acrobatics.proficiency' },
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
          target: { fact: 'skill.acrobatics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['skill.acrobatics.value']).toBe(3); // 2 + (2 * 0.5) = 2 + 1
    expect(output.facts['skill.acrobatics.proficiency']).toBe(0.5);
  });

  it('adds double proficiency bonus (x2)', () => {
    const input = buildBaseInput();
    input.rules.effects.push({
      id: 'effect-acrobatics-proficiency',
      phase: 'early',
      after: [{ group: 'acrobatics-base' }, { group: 'proficiency-base' }],
      vars: {
        level: { default: { number: 2 } }
      },
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.acrobatics.proficiency' },
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
          target: { fact: 'skill.acrobatics.value' },
          source: { var: 'profContribution' }
        },
        { type: 'advertiseEffect', self: true }
      ]
    });

    const output = evaluate(input);

    expect(output.facts['skill.acrobatics.value']).toBe(6); // 2 + (2 * 2) = 2 + 4
    expect(output.facts['skill.acrobatics.proficiency']).toBe(2);
  });
});
