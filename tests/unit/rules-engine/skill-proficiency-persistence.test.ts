import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput, Rule } from '$lib/rules-engine/types';

/**
 * Tests that skill proficiency effects persist across turns using the
 * app's replacement approach (output.effects replaces state.effects).
 *
 * Scenario:
 * 1. Set DEX=20 → Acrobatics=+5
 * 2. End Turn → Acrobatics=+5 (effects: [effect-dexterity-1])
 * 3. Select Acrobatics Proficiency → Acrobatics=+7 (planned)
 * 4. End Turn → Acrobatics=+7 (both effects persist)
 */
describe('Skill proficiency persistence with replacement endTurn', () => {
  const standingRules: Rule[] = [
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
        { type: 'numberIncrement', target: { fact: 'proficiency.bonus' }, source: { number: 2 } }
      ]
    },
    {
      id: 'dex-value-reset',
      phase: 'early',
      group: ['dex-base'],
      activities: [
        { type: 'numberSet', target: { fact: 'dex.value' }, source: { number: 0 } },
        { type: 'numberSet', target: { fact: 'dex.modifier' }, source: { number: 0 } }
      ]
    },
    {
      id: 'acrobatics-value-reset',
      phase: 'early',
      group: ['acrobatics-base'],
      activities: [
        { type: 'numberSet', target: { fact: 'skill.acrobatics.value' }, source: { number: 0 } },
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
  ];

  const setDexterityOffer: Rule = {
    id: 'set-dexterity',
    phase: 'early',
    group: ['dex-values'],
    after: [{ group: 'dex-base' }],
    vars: { score: { default: { number: 20 } } },
    activities: [
      { type: 'numberSet', target: { fact: 'dex.value' }, source: { var: 'score' } },
      {
        type: 'numberFunction',
        function: 'statToModifier',
        sources: [{ var: 'score' }],
        target: { fact: 'dex.modifier' }
      },
      {
        type: 'advertiseEffect',
        rule: {
          id: 'effect-dexterity',
          phase: 'early',
          group: ['dex-values'],
          after: [{ group: 'dex-base' }],
          vars: { score: { capture: true, default: { number: 10 } } },
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
      }
    ]
  };

  const proficiencyAcrobaticsOffer: Rule = {
    id: 'proficiency-acrobatics',
    phase: 'early',
    group: ['__planned__'],
    vars: { level: { default: { number: 1 } } },
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
      {
        type: 'advertiseEffect',
        rule: {
          id: 'effect-acrobatics-proficiency',
          phase: 'early',
          after: [{ group: 'acrobatics-base' }, { group: 'proficiency-base' }],
          vars: { level: { capture: true, default: { number: 1 } } },
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
        }
      }
    ]
  };

  function doEndTurn(
    currentEffects: Rule[],
    currentPlanned: Rule[],
    facts: Record<string, unknown>
  ): { effects: Rule[]; facts: Record<string, unknown> } {
    const input: EngineInput = {
      schemaVersion: 1,
      rules: { standing: standingRules, planned: currentPlanned, effects: currentEffects },
      state: { facts }
    };
    const output = evaluate(input);

    // App's endTurn: replace effects with output.effects, re-evaluate with no planned
    const nextInput: EngineInput = {
      schemaVersion: 1,
      rules: { standing: standingRules, planned: [], effects: output.effects },
      state: { facts }
    };
    const nextOutput = evaluate(nextInput);

    return { effects: output.effects, facts: nextOutput.facts };
  }

  it('persists both DEX and proficiency effects after two endTurns', () => {
    let effects: Rule[] = [];
    let facts: Record<string, unknown> = {};

    // Turn 1: Set DEX=20
    const turn1 = doEndTurn(
      effects,
      [{ ...setDexterityOffer, id: 'instance-0', selections: { score: 20 } }],
      facts
    );
    effects = turn1.effects;
    facts = turn1.facts;

    expect(facts['dex.modifier']).toBe(5);
    expect(facts['skill.acrobatics.value']).toBe(5);
    expect(effects).toHaveLength(1);
    expect(effects[0].id).toBe('effect-dexterity-1');

    // Turn 2: Add Acrobatics Proficiency
    const turn2 = doEndTurn(
      effects,
      [{ ...proficiencyAcrobaticsOffer, id: 'instance-1', selections: { level: 1 } }],
      facts
    );
    effects = turn2.effects;
    facts = turn2.facts;

    expect(facts['dex.modifier']).toBe(5);
    expect(facts['skill.acrobatics.proficiency']).toBe(1);
    expect(facts['skill.acrobatics.value']).toBe(7);
    expect(effects).toHaveLength(2);
    expect(effects.map((e) => e.id)).toContain('effect-dexterity-1');
    expect(effects.some((e) => e.id.startsWith('effect-acrobatics-proficiency'))).toBe(true);
  });
});
