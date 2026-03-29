import { describe, test, expect } from 'vitest';
import { yamlToRules, rulesToYaml } from '$lib/rules/yamlConverter';

describe('yamlToRules', () => {
  test('parses valid YAML into rules array', () => {
    const yaml = `- id: test-rule
  activities:
    - type: numberSet
      target:
        fact: resources.hp
      source:
        number: 10`;
    const result = yamlToRules(yaml);
    expect(result.error).toBeNull();
    expect(result.rules).toHaveLength(1);
    expect(result.rules![0].id).toBe('test-rule');
  });

  test('returns error for invalid YAML syntax', () => {
    const yaml = `- id: broken\n  bad: [\n  unclosed`;
    const result = yamlToRules(yaml);
    expect(result.rules).toBeNull();
    expect(result.error).toBeTruthy();
  });

  test('returns empty array for empty string', () => {
    const result = yamlToRules('');
    expect(result.error).toBeNull();
    expect(result.rules).toEqual([]);
  });
});

describe('rulesToYaml', () => {
  test('converts rules array to YAML string', () => {
    const rules = [
      {
        id: 'test-rule',
        activities: [
          { type: 'numberSet', target: { fact: 'resources.hp' }, source: { number: 10 } }
        ]
      }
    ];
    const yaml = rulesToYaml(rules);
    expect(yaml).toContain('id: test-rule');
    expect(yaml).toContain('type: numberSet');
  });

  test('returns placeholder for empty rules', () => {
    const yaml = rulesToYaml([]);
    expect(yaml).toContain('#');
  });

  test('round-trip preserves rule structure', () => {
    const rules = [
      {
        id: 'round-trip-test',
        phase: 'early' as const,
        activities: [
          {
            type: 'numberSet' as const,
            target: { fact: 'stat.armor' },
            source: { number: 14 }
          }
        ]
      }
    ];
    const yaml = rulesToYaml(rules);
    const result = yamlToRules(yaml);
    expect(result.error).toBeNull();
    expect(result.rules).toEqual(rules);
  });
});
