import { describe, it, expect } from 'vitest';
import type { Rule } from '$lib/rules-engine';

describe('isStatEntry', () => {
  it('rejects undefined', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry(undefined)).toBe(false);
  });

  it('rejects null', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry(null)).toBe(false);
  });

  it('rejects object missing type', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry({ name: 'x', section: 'y' })).toBe(false);
  });

  it('accepts value type with name, fact, and section', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.turnCounter',
        type: 'value',
        fact: 'turn.counter',
        section: 'turn'
      })
    ).toBe(true);
  });

  it('rejects value type without fact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry({ name: 'play.stats.turn', type: 'value', section: 'turn' })).toBe(false);
  });

  it('accepts modifier type with name, fact, and section', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.proficiency',
        type: 'modifier',
        fact: 'proficiency.bonus',
        section: 'abilities'
      })
    ).toBe(true);
  });

  it('rejects modifier type without fact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry({ name: 'play.stats.prof', type: 'modifier', section: 'abilities' })).toBe(
      false
    );
  });

  it('accepts usedMax type with name, total, remaining, and section', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.actions',
        type: 'usedMax',
        total: 'actions.max',
        remaining: 'actions.remaining',
        section: 'resources'
      })
    ).toBe(true);
  });

  it('rejects usedMax type without total', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.actions',
        type: 'usedMax',
        remaining: 'actions.remaining',
        section: 'resources'
      })
    ).toBe(false);
  });

  it('rejects usedMax type without remaining', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.actions',
        type: 'usedMax',
        total: 'actions.max',
        section: 'resources'
      })
    ).toBe(false);
  });

  it('rejects unknown type value', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(isStatEntry({ name: 'x', type: 'unknown', fact: 'y', section: 'z' })).toBe(false);
  });

  it('accepts value type with modifierFact and saveFact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.str',
        type: 'value',
        fact: 'str.value',
        modifierFact: 'str.modifier',
        saveFact: 'str.save',
        section: 'stats'
      })
    ).toBe(true);
  });

  it('rejects value type with non-string modifierFact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.str',
        type: 'value',
        fact: 'str.value',
        modifierFact: 42,
        section: 'stats'
      })
    ).toBe(false);
  });

  it('rejects value type with non-string saveFact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.str',
        type: 'value',
        fact: 'str.value',
        saveFact: true,
        section: 'stats'
      })
    ).toBe(false);
  });

  it('accepts modifier type with proficiencyFact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.skills.athletics',
        type: 'modifier',
        fact: 'skill.athletics.value',
        proficiencyFact: 'skill.athletics.proficiency',
        section: 'skills'
      })
    ).toBe(true);
  });

  it('rejects modifier type with non-string proficiencyFact', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.skills.athletics',
        type: 'modifier',
        fact: 'skill.athletics.value',
        proficiencyFact: 42,
        section: 'skills'
      })
    ).toBe(false);
  });

  it('accepts hitDie type with name, total, remaining, dieSize, and section', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.hitDie',
        type: 'hitDie',
        total: 'hitDie.d12.total',
        remaining: 'hitDie.d12.remaining',
        dieSize: 12,
        section: 'resources'
      })
    ).toBe(true);
  });

  it('rejects hitDie type without dieSize', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.hitDie',
        type: 'hitDie',
        total: 'hitDie.d12.total',
        remaining: 'hitDie.d12.remaining',
        section: 'resources'
      })
    ).toBe(false);
  });

  it('rejects hitDie type without total', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.hitDie',
        type: 'hitDie',
        remaining: 'hitDie.d12.remaining',
        dieSize: 12,
        section: 'resources'
      })
    ).toBe(false);
  });

  it('rejects hitDie type without remaining', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.hitDie',
        type: 'hitDie',
        total: 'hitDie.d12.total',
        dieSize: 12,
        section: 'resources'
      })
    ).toBe(false);
  });

  it('rejects hitDie type with non-number dieSize', async () => {
    const { isStatEntry } = await import('$lib/play/extractStats');
    expect(
      isStatEntry({
        name: 'play.stats.hitDie',
        type: 'hitDie',
        total: 'hitDie.d12.total',
        remaining: 'hitDie.d12.remaining',
        dieSize: '12',
        section: 'resources'
      })
    ).toBe(false);
  });
});

describe('extractStats', () => {
  it('returns empty array when no rules have stats', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      { id: 'r1', activities: [] },
      { id: 'r2', activities: [], ui: { section: 'move' } }
    ];
    expect(extractStats(rules)).toEqual([]);
  });

  it('collects stats from multiple rules', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [{ name: 'a', type: 'value', fact: 'x', section: 'turn' }]
        }
      },
      {
        id: 'r2',
        activities: [],
        ui: {
          stats: [{ name: 'b', type: 'modifier', fact: 'y', section: 'abilities' }]
        }
      }
    ];
    expect(extractStats(rules)).toHaveLength(2);
  });

  it('skips rules without ui', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      { id: 'r1', activities: [] },
      {
        id: 'r2',
        activities: [],
        ui: { stats: [{ name: 'a', type: 'value', fact: 'x', section: 'turn' }] }
      }
    ];
    expect(extractStats(rules)).toHaveLength(1);
  });

  it('skips invalid stat entries silently', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [{ bad: 'entry' }, { name: 'valid', type: 'value', fact: 'x', section: 'turn' }]
        }
      }
    ];
    const result = extractStats(rules);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('valid');
  });

  it('flattens stats from all rules into one array', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [
            { name: 'a', type: 'value', fact: 'x', section: 'turn' },
            { name: 'b', type: 'modifier', fact: 'y', section: 'abilities' }
          ]
        }
      }
    ];
    expect(extractStats(rules)).toHaveLength(2);
  });

  it('preserves modifierFact and saveFact from rule UI declarations', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [
            {
              name: 'play.stats.str',
              type: 'value',
              fact: 'str.value',
              modifierFact: 'str.modifier',
              saveFact: 'str.save',
              section: 'stats'
            }
          ]
        }
      }
    ];
    const result = extractStats(rules);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('value');
    if (result[0].type === 'value') {
      expect(result[0].modifierFact).toBe('str.modifier');
      expect(result[0].saveFact).toBe('str.save');
    }
  });

  it('preserves proficiencyFact from rule UI declarations', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [
            {
              name: 'play.stats.skills.athletics',
              type: 'modifier',
              fact: 'skill.athletics.value',
              proficiencyFact: 'skill.athletics.proficiency',
              section: 'skills'
            }
          ]
        }
      }
    ];
    const result = extractStats(rules);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('modifier');
    if (result[0].type === 'modifier') {
      expect(result[0].proficiencyFact).toBe('skill.athletics.proficiency');
    }
  });

  it('preserves hitDie entry with dieSize from rule UI declarations', async () => {
    const { extractStats } = await import('$lib/play/extractStats');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          stats: [
            {
              name: 'play.stats.hitDie',
              type: 'hitDie',
              total: 'hitDie.d12.total',
              remaining: 'hitDie.d12.remaining',
              dieSize: 12,
              section: 'resources'
            }
          ]
        }
      }
    ];
    const result = extractStats(rules);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('hitDie');
    if (result[0].type === 'hitDie') {
      expect(result[0].dieSize).toBe(12);
      expect(result[0].total).toBe('hitDie.d12.total');
      expect(result[0].remaining).toBe('hitDie.d12.remaining');
    }
  });
});
