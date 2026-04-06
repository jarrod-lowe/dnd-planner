import { describe, test, expect } from 'vitest';
import { mapErrorsToPositions } from '$lib/rules/errorPositionMapper';

const SAMPLE_YAML = `- id: good-rule
  activities:
    - type: numberSet
      target:
        fact: resources.hp
      source:
        number: 10
- id: bad-rule
  activities:
    - type: notAType`;

describe('mapErrorsToPositions', () => {
  test('maps rules[0] path to first rule line', () => {
    const errors = [{ message: 'test error', path: 'rules[0]' }];
    const positions = mapErrorsToPositions(SAMPLE_YAML, errors);
    expect(positions).toHaveLength(1);
    expect(positions[0].line).toBe(0); // "- id: good-rule" is line 0
  });

  test('maps rules[1] path to second rule line', () => {
    const errors = [{ message: 'test error', path: 'rules[1]' }];
    const positions = mapErrorsToPositions(SAMPLE_YAML, errors);
    expect(positions).toHaveLength(1);
    expect(positions[0].line).toBe(7); // "- id: bad-rule" is line 7
  });

  test('maps nested path rules[0].activities[0].type to correct line', () => {
    const errors = [{ message: 'invalid type', path: 'rules[0]/activities/0/type' }];
    const positions = mapErrorsToPositions(SAMPLE_YAML, errors);
    expect(positions).toHaveLength(1);
    expect(positions[0].line).toBe(2); // "    - type: numberSet" is line 2
  });

  test('returns line 0 for empty path', () => {
    const errors = [{ message: 'parse error', path: '' }];
    const positions = mapErrorsToPositions(SAMPLE_YAML, errors);
    expect(positions).toHaveLength(1);
    expect(positions[0].line).toBe(0);
  });

  test('handles multiple errors with correct positions', () => {
    const errors = [
      { message: 'error 1', path: 'rules[0]/activities/0/type' },
      { message: 'error 2', path: 'rules[1]' }
    ];
    const positions = mapErrorsToPositions(SAMPLE_YAML, errors);
    expect(positions).toHaveLength(2);
    expect(positions[0].line).toBe(2);
    expect(positions[1].line).toBe(7);
  });
});
