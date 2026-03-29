import { describe, test, expect, vi, beforeEach } from 'vitest';
import schema from '../../../../data/rule-groups/schema.json';

function mockSchemaFetch(): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(schema)
  });
}

describe('validateRules', () => {
  beforeEach(() => {
    mockSchemaFetch();
    // Reset module-level cache between tests
    vi.resetModules();
  });

  test('valid rules pass schema validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'valid-rule',
        activities: [
          { type: 'numberSet', target: { fact: 'resources.hp' }, source: { number: 10 } }
        ]
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rule missing id fails validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }]
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('id'))).toBe(true);
  });

  test('rule missing activities fails validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [{ id: 'no-activities' }];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('activities'))).toBe(true);
  });

  test('invalid activity type fails validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'bad-type',
        activities: [{ type: 'invalidType' }]
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
  });

  test('empty rules array is valid', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const result = await validateRules([]);
    expect(result.valid).toBe(true);
  });

  test('reports path to error location', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'good-rule',
        activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }]
      },
      {
        id: 'bad-rule',
        activities: [{ type: 'notAType' }]
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('1'))).toBe(true);
  });
});
