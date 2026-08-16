import { describe, it, expect } from 'vitest';
import type { Rule } from '$lib/rules-view';
import type { Facts } from '$lib/rules-view';
import type { UiEntrySlotLevels } from '$lib/play/extractTopBar';

const slotLevelsEntry = (levels: number[]): UiEntrySlotLevels => ({
  type: 'slotLevels',
  label: 'play.stats.spellSlots',
  levels
});

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

  it('accepts valid slotLevels entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'slotLevels',
        label: 'play.stats.spellSlots',
        levels: [1, 2]
      })
    ).toBe(true);
  });

  it('accepts a slotLevels entry with an empty levels array', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'slotLevels', label: 'play.stats.spellSlots', levels: [] })).toBe(
      true
    );
  });

  it('rejects slotLevels entry missing levels', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'slotLevels', label: 'play.stats.spellSlots' })).toBe(false);
  });

  it('rejects slotLevels entry whose levels is not an array', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'slotLevels', label: 'play.stats.spellSlots', levels: 3 })).toBe(
      false
    );
  });

  it('rejects slotLevels entry with non-numeric level entries', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({ type: 'slotLevels', label: 'play.stats.spellSlots', levels: [1, '2'] })
    ).toBe(false);
  });

  it('rejects slotLevels entry missing label', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(isUiEntry({ type: 'slotLevels', levels: [1] })).toBe(false);
  });

  it('accepts valid actionPools entry', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: [
          {
            key: 'actions',
            label: 'play.stats.actions',
            shortLabel: 'play.ledger.short.actions',
            tile: 'play.economy.tile.actions'
          },
          {
            key: 'bonusActions',
            label: 'play.stats.bonusActions',
            shortLabel: 'play.ledger.short.bonusActions',
            tile: 'play.economy.tile.bonusActions'
          },
          {
            key: 'reactions',
            label: 'play.stats.reactions',
            shortLabel: 'play.ledger.short.reactions',
            tile: 'play.economy.tile.reactions'
          }
        ]
      })
    ).toBe(true);
  });

  it('rejects actionPools entry missing label', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        factPrefix: '',
        pools: [
          { key: 'actions', label: 'play.stats.actions', shortLabel: 'play.ledger.short.actions' }
        ]
      })
    ).toBe(false);
  });

  it('rejects actionPools entry with non-string factPrefix', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: 123,
        pools: [
          { key: 'actions', label: 'play.stats.actions', shortLabel: 'play.ledger.short.actions' }
        ]
      })
    ).toBe(false);
  });

  it('rejects actionPools entry with pools not an array', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: 'not-an-array'
      })
    ).toBe(false);
  });

  it('rejects actionPools entry with pool element missing shortLabel', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: [{ key: 'actions', label: 'play.stats.actions' }]
      })
    ).toBe(false);
  });

  it('rejects actionPools entry with pool element missing tile', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: [
          { key: 'actions', label: 'play.stats.actions', shortLabel: 'play.ledger.short.actions' }
        ]
      })
    ).toBe(false);
  });

  it('rejects actionPools entry with pool element having non-string tile', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: [
          {
            key: 'actions',
            label: 'play.stats.actions',
            shortLabel: 'play.ledger.short.actions',
            tile: 123
          }
        ]
      })
    ).toBe(false);
  });

  it('accepts valid actionPools entry with tile field', async () => {
    const { isUiEntry } = await import('$lib/play/extractTopBar');
    expect(
      isUiEntry({
        type: 'actionPools',
        label: 'play.stats.actions',
        factPrefix: '',
        pools: [
          {
            key: 'actions',
            label: 'play.stats.actions',
            shortLabel: 'play.ledger.short.actions',
            tile: 'play.economy.tile.actions'
          },
          {
            key: 'bonusActions',
            label: 'play.stats.bonusActions',
            shortLabel: 'play.ledger.short.bonusActions',
            tile: 'play.economy.tile.bonusActions'
          },
          {
            key: 'reactions',
            label: 'play.stats.reactions',
            shortLabel: 'play.ledger.short.reactions',
            tile: 'play.economy.tile.reactions'
          }
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

  it('sums open/total across the levels of a slotLevels entry', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    // Level 1: 4 total, 1 already spent ⇒ 3 open. Level 2: 3 total, none spent.
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 1,
      'spellcasting.slots.level2.total': 3,
      'spellcasting.slots.level2.spent': 0
    };
    expect(resolveEntryValue(slotLevelsEntry([1, 2]), facts)).toBe('6/7');
  });

  it('returns 0/0 for a slotLevels entry with no slot facts', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    expect(resolveEntryValue(slotLevelsEntry([1]), {})).toBe('0/0');
  });

  it('sums open/total across the pools of an actionPools entry (player 1/1/1)', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    // Default 1 action, 1 bonus action, 1 reaction, none spent yet.
    const facts: Facts = {
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.actions',
      factPrefix: '',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.actions',
          shortLabel: 'play.ledger.short.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.bonusActions',
          shortLabel: 'play.ledger.short.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        },
        {
          key: 'reactions',
          label: 'play.stats.reactions',
          shortLabel: 'play.ledger.short.reactions',
          tile: 'play.economy.tile.reactions'
        }
      ]
    };
    expect(resolveEntryValue(actionPoolsEntry, facts)).toBe('3/3');
  });

  it('sums open/total with heterogeneous spent values (one action spent)', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    // actions.max: 1, actions.spent: 1 → open: 0; bonusActions and reactions fresh.
    const facts: Facts = {
      'actions.max': 1,
      'actions.spent': 1,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.actions',
      factPrefix: '',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.actions',
          shortLabel: 'play.ledger.short.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.bonusActions',
          shortLabel: 'play.ledger.short.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        },
        {
          key: 'reactions',
          label: 'play.stats.reactions',
          shortLabel: 'play.ledger.short.reactions',
          tile: 'play.economy.tile.reactions'
        }
      ]
    };
    // (0 + 1 + 1) / (1 + 1 + 1) = 2/3
    expect(resolveEntryValue(actionPoolsEntry, facts)).toBe('2/3');
  });

  it('sums open/total for steed actionPools (2 pools)', async () => {
    const { resolveEntryValue } = await import('$lib/play/extractTopBar');
    // Steed with 1 action, 1 bonus action, 0 reactions (no reaction pool).
    const facts: Facts = {
      'companion.steed.actions.max': 1,
      'companion.steed.actions.spent': 0,
      'companion.steed.bonusActions.max': 1,
      'companion.steed.bonusActions.spent': 0
    };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.steed.actions',
      factPrefix: 'companion.steed.',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.steed.actions',
          shortLabel: 'play.ledger.short.steed.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.steed.bonusActions',
          shortLabel: 'play.ledger.short.steed.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        }
      ]
    };
    expect(resolveEntryValue(actionPoolsEntry, facts)).toBe('2/2');
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

  it('returns true for slotLevels when any level has a non-zero total', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 0,
      'spellcasting.slots.level2.total': 3
    };
    expect(isEntryVisible(slotLevelsEntry([1, 2]), facts)).toBe(true);
  });

  it('returns false for slotLevels when every level total is 0', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 0,
      'spellcasting.slots.level2.total': 0
    };
    expect(isEntryVisible(slotLevelsEntry([1, 2]), facts)).toBe(false);
  });

  it('returns false for slotLevels when the total facts are missing', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    expect(isEntryVisible(slotLevelsEntry([1, 2]), {})).toBe(false);
  });

  it('returns true for actionPools when one pool has max > 0', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'actions.max': 1, 'actions.spent': 0 };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.actions',
      factPrefix: '',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.actions',
          shortLabel: 'play.ledger.short.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.bonusActions',
          shortLabel: 'play.ledger.short.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        },
        {
          key: 'reactions',
          label: 'play.stats.reactions',
          shortLabel: 'play.ledger.short.reactions',
          tile: 'play.economy.tile.reactions'
        }
      ]
    };
    expect(isEntryVisible(actionPoolsEntry, facts)).toBe(true);
  });

  it('returns false for actionPools when all pools have max 0 or missing', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'actions.max': 0, 'bonusActions.max': 0 };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.actions',
      factPrefix: '',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.actions',
          shortLabel: 'play.ledger.short.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.bonusActions',
          shortLabel: 'play.ledger.short.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        }
      ]
    };
    expect(isEntryVisible(actionPoolsEntry, facts)).toBe(false);
  });

  it('returns true for actionPools with steed prefix when steed pool has max > 0', async () => {
    const { isEntryVisible } = await import('$lib/play/extractTopBar');
    const facts: Facts = { 'companion.steed.actions.max': 1, 'companion.steed.actions.spent': 0 };
    const actionPoolsEntry = {
      type: 'actionPools' as const,
      label: 'play.stats.steed.actions',
      factPrefix: 'companion.steed.',
      pools: [
        {
          key: 'actions',
          label: 'play.stats.steed.actions',
          shortLabel: 'play.ledger.short.steed.actions',
          tile: 'play.economy.tile.actions'
        },
        {
          key: 'bonusActions',
          label: 'play.stats.steed.bonusActions',
          shortLabel: 'play.ledger.short.steed.bonusActions',
          tile: 'play.economy.tile.bonusActions'
        }
      ]
    };
    expect(isEntryVisible(actionPoolsEntry, facts)).toBe(true);
  });
});

describe('resourceShortLabelKey', () => {
  it('maps player action-economy and core resources to short keys', async () => {
    const { resourceShortLabelKey } = await import('$lib/play/extractTopBar');
    expect(resourceShortLabelKey('play.stats.actions')).toBe('play.ledger.short.actions');
    expect(resourceShortLabelKey('play.stats.bonusActions')).toBe('play.ledger.short.bonusActions');
    expect(resourceShortLabelKey('play.stats.reactions')).toBe('play.ledger.short.reactions');
    expect(resourceShortLabelKey('play.stats.hp')).toBe('play.ledger.short.hp');
    expect(resourceShortLabelKey('play.stats.movement')).toBe('play.ledger.short.movement');
    expect(resourceShortLabelKey('play.stats.hands')).toBe('play.ledger.short.hands');
    expect(resourceShortLabelKey('play.stats.hitDie')).toBe('play.ledger.short.hitDie');
  });

  it('maps class and feat resources to short keys', async () => {
    const { resourceShortLabelKey } = await import('$lib/play/extractTopBar');
    expect(resourceShortLabelKey('play.stats.spellcasting')).toBe('play.ledger.short.spellcasting');
    expect(resourceShortLabelKey('play.stats.divinity')).toBe('play.ledger.short.divinity');
    expect(resourceShortLabelKey('play.stats.layOnHands')).toBe('play.ledger.short.layOnHands');
    expect(resourceShortLabelKey('play.stats.paladinSmite')).toBe('play.ledger.short.paladinSmite');
    expect(resourceShortLabelKey('play.stats.paladinFindSteed')).toBe(
      'play.ledger.short.paladinFindSteed'
    );
    expect(resourceShortLabelKey('play.stats.savageAttacker')).toBe(
      'play.ledger.short.savageAttacker'
    );
    expect(resourceShortLabelKey('play.stats.spellSlots')).toBe('play.ledger.short.spellSlots');
  });

  it('maps steed (companion) resources to short keys', async () => {
    const { resourceShortLabelKey } = await import('$lib/play/extractTopBar');
    expect(resourceShortLabelKey('play.stats.steed.hp')).toBe('play.ledger.short.steed.hp');
    expect(resourceShortLabelKey('play.stats.steed.movement')).toBe(
      'play.ledger.short.steed.movement'
    );
    expect(resourceShortLabelKey('play.stats.steed.actions')).toBe(
      'play.ledger.short.steed.actions'
    );
    expect(resourceShortLabelKey('play.stats.steed.bonusActions')).toBe(
      'play.ledger.short.steed.bonusActions'
    );
    expect(resourceShortLabelKey('play.stats.steed.healingTouch')).toBe(
      'play.ledger.short.steed.healingTouch'
    );
    expect(resourceShortLabelKey('play.stats.steed.feyStep')).toBe(
      'play.ledger.short.steed.feyStep'
    );
    expect(resourceShortLabelKey('play.stats.steed.fellGlare')).toBe(
      'play.ledger.short.steed.fellGlare'
    );
  });

  it('returns undefined for labels that have no short form', async () => {
    const { resourceShortLabelKey } = await import('$lib/play/extractTopBar');
    // Non-resource / top-bar stat labels must fall back to the long label.
    expect(resourceShortLabelKey('play.stats.spellLevel')).toBeUndefined();
    expect(resourceShortLabelKey('play.stats.spellSaveDC')).toBeUndefined();
    expect(resourceShortLabelKey('play.stats.steed.ac')).toBeUndefined();
    expect(resourceShortLabelKey('play.stats.steed.speed')).toBeUndefined();
    expect(resourceShortLabelKey('something.unrelated')).toBeUndefined();
  });
});
