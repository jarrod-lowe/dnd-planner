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

  describe('ui.stats', () => {
    test('valid ui.stats value entry passes validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.initiative',
                type: 'value',
                fact: 'initiative.value',
                section: 'stats'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(true);
    });

    test('valid ui.stats modifier entry passes validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.proficiency',
                type: 'modifier',
                fact: 'proficiency.bonus',
                section: 'abilities'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(true);
    });

    test('valid ui.stats usedMax entry passes validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.actions',
                type: 'usedMax',
                total: 'actions.max',
                remaining: 'actions.remaining',
                section: 'resources'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(true);
    });

    test('ui.stats value entry without fact fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [{ name: 'play.stats.initiative', type: 'value', section: 'stats' }]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats usedMax entry without total fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.actions',
                type: 'usedMax',
                remaining: 'actions.remaining',
                section: 'resources'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats usedMax entry without remaining fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.actions',
                type: 'usedMax',
                total: 'actions.max',
                section: 'resources'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats with invalid type value fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [{ name: 'x', type: 'badType', fact: 'y', section: 'z' }]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats entry without section fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [{ name: 'x', type: 'value', fact: 'y' }]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats entry without name fails validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [{ type: 'value', fact: 'y', section: 'stats' }]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(false);
    });

    test('ui.stats with nameParams passes validation', async () => {
      const { validateRules } = await import('$lib/rules/validateRules');
      const rules = [
        {
          id: 'stat-rule',
          activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
          ui: {
            stats: [
              {
                name: 'play.stats.spellLevel',
                nameParams: { level: 1 },
                type: 'usedMax',
                total: 'spellcasting.slots.level1.total',
                remaining: 'spellcasting.slots.level1.remaining',
                section: 'magic'
              }
            ]
          }
        }
      ];
      const result = await validateRules(rules);
      expect(result.valid).toBe(true);
    });
  });

  test('dice-line die without purpose fails validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'no-purpose',
        activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
        ui: {
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          }
        }
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('purpose'))).toBe(true);
  });

  test('dice-line die with an invalid purpose value fails validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'bad-purpose',
        activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
        ui: {
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, purpose: 'totally-hit' }]
          }
        }
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(false);
  });

  test('dice-line die with a valid purpose passes validation', async () => {
    const { validateRules } = await import('$lib/rules/validateRules');
    const rules = [
      {
        id: 'good-purpose',
        activities: [{ type: 'numberSet', target: { fact: 'x' }, source: { number: 1 } }],
        ui: {
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 8, count: 2, purpose: 'healing' }]
          }
        }
      }
    ];
    const result = await validateRules(rules);
    expect(result.valid).toBe(true);
  });
});
