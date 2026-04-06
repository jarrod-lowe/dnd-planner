import { describe, test, expect } from 'vitest';
import { getYamlCompletions } from '$lib/rules/yamlContext';

describe('getYamlCompletions', () => {
  test('suggests rule-level keys at new rule position', () => {
    const yaml = `- `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('id');
    expect(labels).toContain('phase');
    expect(labels).toContain('enabled');
    expect(labels).toContain('when');
    expect(labels).toContain('activities');
    expect(labels).toContain('vars');
    expect(labels).toContain('group');
    expect(labels).toContain('after');
    expect(labels).toContain('description');
    expect(labels).toContain('ui');
  });

  test('suggests phase values after phase key', () => {
    const yaml = `- id: test\n  phase: `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('early');
    expect(labels).toContain('normal');
    expect(labels).toContain('safeguard');
  });

  test('suggests activity types after type key in activity', () => {
    const yaml = `- id: test
  activities:
    - type: `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('numberSet');
    expect(labels).toContain('numberIncrement');
    expect(labels).toContain('numberCopy');
    expect(labels).toContain('numberSum');
    expect(labels).toContain('numberFunction');
    expect(labels).toContain('emitEvent');
    expect(labels).toContain('generateRule');
    expect(labels).toContain('offerRule');
    expect(labels).toContain('setClear');
    expect(labels).toContain('setAdd');
  });

  test('suggests comparison operators after operator key', () => {
    const yaml = `- id: test
  activities:
    - type: numberSet
      when:
        operator: `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('equals');
    expect(labels).toContain('notEquals');
    expect(labels).toContain('greaterThan');
    expect(labels).toContain('greaterThanOrEqual');
    expect(labels).toContain('lessThan');
    expect(labels).toContain('lessThanOrEqual');
  });

  test('suggests function names after function key', () => {
    const yaml = `- id: test
  activities:
    - type: numberFunction
      function: `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('statToModifier');
    expect(labels).toContain('multiply');
  });

  test('suggests activity snippet at new activity item', () => {
    const yaml = `- id: test
  activities:
    - `;
    const completions = getYamlCompletions(yaml, yaml.length);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('type');
    expect(labels).toContain('id');
    expect(labels).toContain('when');
    expect(labels).toContain('target');
    expect(labels).toContain('source');
  });

  test('returns empty completions for unrecognized context', () => {
    const yaml = `- id: test\n  activities:\n    - type: numberSet\n      target:\n        fact: resources.hp`;
    const completions = getYamlCompletions(yaml, yaml.length);
    expect(completions).toEqual([]);
  });
});
