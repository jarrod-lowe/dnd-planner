import { describe, it, expect } from 'vitest';
import type { Rule } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';

describe('isUiEntry', () => {
  it('rejects undefined', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry(undefined)).toBe(false);
  });

  it('rejects null', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry(null)).toBe(false);
  });

  it('accepts valid usedMax entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'usedMax',
        label: 'play.topBar.hp',
        total: 'hp.max',
        remaining: 'hp.current'
      })
    ).toBe(true);
  });

  it('rejects usedMax entry missing total', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'usedMax',
        label: 'play.topBar.hp',
        remaining: 'hp.current'
      })
    ).toBe(false);
  });

  it('rejects usedMax entry missing remaining', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'usedMax',
        label: 'play.topBar.hp',
        total: 'hp.max'
      })
    ).toBe(false);
  });

  it('accepts usedMax entry with nameParams', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'usedMax',
        label: 'play.stats.spellSlots',
        nameParams: { level: 3 },
        total: 'spellSlots.3.max',
        remaining: 'spellSlots.3.remaining'
      })
    ).toBe(true);
  });

  it('rejects old hp type', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'hp',
        label: 'play.topBar.hp',
        factCurrent: 'hp.current',
        factMax: 'hp.max'
      })
    ).toBe(false);
  });

  it('accepts valid value entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'value',
        label: 'play.topBar.ac',
        fact: 'ac.value'
      })
    ).toBe(true);
  });

  it('rejects value entry missing fact', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'value', label: 'play.topBar.ac' })).toBe(false);
  });

  it('accepts valid modifier entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'modifier',
        label: 'play.stats.initiative',
        fact: 'initiative.value'
      })
    ).toBe(true);
  });

  it('accepts modifier entry with proficiencyFact', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'modifier',
        label: 'play.stats.skills.athletics',
        fact: 'skill.athletics.value',
        proficiencyFact: 'skill.athletics.proficiency'
      })
    ).toBe(true);
  });

  it('rejects modifier entry missing fact', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'modifier', label: 'x' })).toBe(false);
  });

  it('accepts valid hitDie entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'hitDie',
        label: 'play.stats.hitDie',
        nameParams: { dieSize: 8 },
        total: 'hitDie.d8.total',
        remaining: 'hitDie.d8.remaining',
        dieSize: 8
      })
    ).toBe(true);
  });

  it('rejects hitDie entry missing dieSize', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'hitDie',
        label: 'play.stats.hitDie',
        total: 'hitDie.d8.total',
        remaining: 'hitDie.d8.remaining'
      })
    ).toBe(false);
  });

  it('accepts valid concentration entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'concentration',
        label: 'play.topBar.conc',
        activeLabel: 'play.topBar.concActive',
        noneLabel: 'play.topBar.concNone'
      })
    ).toBe(true);
  });

  it('accepts valid ability entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'ability',
        label: 'play.topBar.abilities',
        abilities: [
          { name: 'play.stats.str', fact: 'str.modifier' },
          { name: 'play.stats.dex', fact: 'dex.modifier', proficiencyFact: 'dex.save' }
        ]
      })
    ).toBe(true);
  });

  it('rejects entry with unknown type', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'unknown', label: 'x' })).toBe(false);
  });

  it('rejects entry missing type', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ label: 'x' })).toBe(false);
  });
});

describe('extractUiEntries — subject stamping', () => {
  it('stamps subject from rule ui.subject onto entries', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'steed-hp',
        activities: [],
        ui: {
          subject: 'steed',
          topBar: [
            {
              type: 'usedMax',
              label: 'play.stats.steed.hp',
              total: 'companion.steed.hp.max',
              remaining: 'companion.steed.hp.current'
            }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('steed');
  });

  it('leaves subject undefined when rule has no ui.subject', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'player-ac',
        activities: [],
        ui: {
          topBar: [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBeUndefined();
  });

  it('stamps correct subjects for mixed player and steed rules', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'player-hp',
        activities: [],
        ui: {
          topBar: [
            { type: 'usedMax', label: 'play.topBar.hp', total: 'hp.max', remaining: 'hp.current' }
          ]
        }
      },
      {
        id: 'steed-hp',
        activities: [],
        ui: {
          subject: 'steed',
          topBar: [
            {
              type: 'usedMax',
              label: 'play.stats.steed.hp',
              total: 'companion.steed.hp.max',
              remaining: 'companion.steed.hp.current'
            }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(2);
    const playerEntry = result.find((e) => e.label === 'play.topBar.hp');
    const steedEntry = result.find((e) => e.label === 'play.stats.steed.hp');
    expect(playerEntry?.subject).toBeUndefined();
    expect(steedEntry?.subject).toBe('steed');
  });

  it('stamps subject onto resources entries', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'steed-resources',
        activities: [],
        ui: {
          subject: 'steed',
          resources: [
            {
              type: 'usedMax',
              label: 'play.stats.steed.hp',
              total: 'companion.steed.hp.max',
              remaining: 'companion.steed.hp.current'
            }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'resources');
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('steed');
  });
});

describe('extractUiEntries', () => {
  it('returns empty array when no rules have the section', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      { id: 'r1', activities: [] },
      { id: 'r2', activities: [], ui: { section: 'move' } }
    ];
    expect(extractUiEntries(rules, 'topBar')).toEqual([]);
    expect(extractUiEntries(rules, 'resources')).toEqual([]);
  });

  it('collects entries from rules with ui.topBar', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          topBar: [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('value');
  });

  it('collects entries from rules with ui.resources', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          resources: [
            { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'resources');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('usedMax');
  });

  it('skips invalid entries silently', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          topBar: [{ bad: 'entry' }, { type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(1);
  });

  it('sorts topBar entries by canonical type order', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          topBar: [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }]
        }
      },
      {
        id: 'r2',
        activities: [],
        ui: {
          topBar: [
            {
              type: 'usedMax',
              label: 'play.topBar.hp',
              total: 'hp.max',
              remaining: 'hp.current'
            }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result[0].type).toBe('usedMax');
    expect(result[1].type).toBe('value');
  });

  it('preserves within-type declaration order', async () => {
    const { extractUiEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          topBar: [
            { type: 'value', label: 'play.topBar.ac', fact: 'ac.value' },
            { type: 'value', label: 'play.topBar.speed', fact: 'movement.remaining' }
          ]
        }
      }
    ];
    const result = extractUiEntries(rules, 'topBar');
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('play.topBar.ac');
    expect(result[1].label).toBe('play.topBar.speed');
  });
});

describe('extractTopBarEntries (backward compat)', () => {
  it('delegates to extractUiEntries with topBar section', async () => {
    const { extractTopBarEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          topBar: [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }]
        }
      }
    ];
    expect(extractTopBarEntries(rules)).toHaveLength(1);
  });
});

describe('extractResourceEntries', () => {
  it('delegates to extractUiEntries with resources section', async () => {
    const { extractResourceEntries } = await import('$lib/play/extractTopBar');
    const rules: Rule[] = [
      {
        id: 'r1',
        activities: [],
        ui: {
          resources: [
            {
              type: 'usedMax',
              label: 'play.stats.actions',
              total: 'actions.max',
              remaining: 'actions.remaining'
            }
          ]
        }
      }
    ];
    expect(extractResourceEntries(rules)).toHaveLength(1);
  });
});

describe('resolveEntryValue', () => {
  it('returns remaining/total for usedMax', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hp.max': 35, 'hp.current': 28 };
    expect(
      resolveEntryValue(
        { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
        facts
      )
    ).toBe('28/35');
  });

  it('returns 0/total for usedMax with no remaining fact', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hp.max': 35 };
    expect(
      resolveEntryValue(
        { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
        facts
      )
    ).toBe('0/35');
  });

  it('returns value as string for value type', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'ac.value': 16 };
    expect(
      resolveEntryValue({ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' }, facts)
    ).toBe('16');
  });

  it('returns signed modifier for modifier type', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'initiative.value': 3 };
    expect(
      resolveEntryValue(
        { type: 'modifier', label: 'play.stats.initiative', fact: 'initiative.value' },
        facts
      )
    ).toBe('+3');
  });

  it('returns negative signed modifier', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'skill.value': -2 };
    expect(resolveEntryValue({ type: 'modifier', label: 'x', fact: 'skill.value' }, facts)).toBe(
      '-2'
    );
  });

  it('returns remaining/total dX for hitDie', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hitDie.d8.total': 5, 'hitDie.d8.remaining': 3 };
    expect(
      resolveEntryValue(
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 8 },
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        },
        facts
      )
    ).toBe('3/5 d8');
  });
});

describe('isEntryVisible', () => {
  it('returns true for usedMax when total fact exists and is non-zero', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hp.max': 35, 'hp.current': 28 };
    expect(
      isEntryVisible(
        { type: 'usedMax', label: 'x', total: 'hp.max', remaining: 'hp.current' },
        facts
      )
    ).toBe(true);
  });

  it('returns false for usedMax when total is 0', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hp.max': 0, 'hp.current': 0 };
    expect(
      isEntryVisible(
        { type: 'usedMax', label: 'x', total: 'hp.max', remaining: 'hp.current' },
        facts
      )
    ).toBe(false);
  });

  it('returns false for usedMax when total fact missing', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = {};
    expect(
      isEntryVisible(
        { type: 'usedMax', label: 'x', total: 'hp.max', remaining: 'hp.current' },
        facts
      )
    ).toBe(false);
  });

  it('returns true for value when fact exists', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'ac.value': 16 };
    expect(isEntryVisible({ type: 'value', label: 'x', fact: 'ac.value' }, facts)).toBe(true);
  });

  it('returns false for value when fact missing', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = {};
    expect(isEntryVisible({ type: 'value', label: 'x', fact: 'ac.value' }, facts)).toBe(false);
  });

  it('returns true for modifier when fact exists', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'skill.value': 5 };
    expect(isEntryVisible({ type: 'modifier', label: 'x', fact: 'skill.value' }, facts)).toBe(true);
  });

  it('returns true for hitDie when total fact exists and is non-zero', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hitDie.d8.total': 5, 'hitDie.d8.remaining': 3 };
    expect(
      isEntryVisible(
        {
          type: 'hitDie',
          label: 'x',
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        },
        facts
      )
    ).toBe(true);
  });

  it('returns false for hitDie when total is 0', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'hitDie.d8.total': 0, 'hitDie.d8.remaining': 0 };
    expect(
      isEntryVisible(
        {
          type: 'hitDie',
          label: 'x',
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        },
        facts
      )
    ).toBe(false);
  });
});
