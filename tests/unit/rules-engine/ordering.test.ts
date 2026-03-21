import { describe, it, expect } from 'vitest';
import {
  isGroupSettled,
  areDependenciesSatisfied,
  markRuleExecuted,
  markRuleSkipped,
  buildGroupStates,
  validateOrdering,
  validateCrossPhaseOrdering
} from '$lib/rules-engine/ordering';
import type { GroupState, Rule } from '$lib/rules-engine/types';

describe('isGroupSettled', () => {
  it('returns true when settled flag is true', () => {
    const groupState: GroupState = {
      name: 'test-group',
      phase: 'normal',
      ruleIds: ['rule-1', 'rule-2'],
      settled: true,
      executedRuleIds: [],
      skippedRuleIds: []
    };

    expect(isGroupSettled(groupState)).toBe(true);
  });

  it('returns true when all rules have been executed', () => {
    const groupState: GroupState = {
      name: 'test-group',
      phase: 'normal',
      ruleIds: ['rule-1', 'rule-2'],
      settled: false,
      executedRuleIds: ['rule-1', 'rule-2'],
      skippedRuleIds: []
    };

    expect(isGroupSettled(groupState)).toBe(true);
  });

  it('returns true when all rules have been executed or skipped', () => {
    const groupState: GroupState = {
      name: 'test-group',
      phase: 'normal',
      ruleIds: ['rule-1', 'rule-2', 'rule-3'],
      settled: false,
      executedRuleIds: ['rule-1'],
      skippedRuleIds: ['rule-2', 'rule-3']
    };

    expect(isGroupSettled(groupState)).toBe(true);
  });

  it('returns false when some rules have not been processed', () => {
    const groupState: GroupState = {
      name: 'test-group',
      phase: 'normal',
      ruleIds: ['rule-1', 'rule-2', 'rule-3'],
      settled: false,
      executedRuleIds: ['rule-1'],
      skippedRuleIds: ['rule-2']
    };

    expect(isGroupSettled(groupState)).toBe(false);
  });

  it('returns true for empty group', () => {
    const groupState: GroupState = {
      name: 'empty-group',
      phase: 'normal',
      ruleIds: [],
      settled: false,
      executedRuleIds: [],
      skippedRuleIds: []
    };

    expect(isGroupSettled(groupState)).toBe(true);
  });
});

describe('areDependenciesSatisfied', () => {
  it('returns true when rule has no after dependencies', () => {
    const rule: Rule = {
      id: 'rule-1',
      activities: []
    };
    const groups = new Map<string, GroupState>();

    expect(areDependenciesSatisfied(rule, groups)).toBe(true);
  });

  it('returns true when all after groups are settled', () => {
    const rule: Rule = {
      id: 'rule-1',
      after: [{ group: 'init' }],
      activities: []
    };
    const groups = new Map<string, GroupState>([
      [
        'init',
        {
          name: 'init',
          phase: 'normal',
          ruleIds: ['a'],
          settled: true,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ]
    ]);

    expect(areDependenciesSatisfied(rule, groups)).toBe(true);
  });

  it('returns false when an after group is not settled', () => {
    const rule: Rule = {
      id: 'rule-1',
      after: [{ group: 'init' }],
      activities: []
    };
    const groups = new Map<string, GroupState>([
      [
        'init',
        {
          name: 'init',
          phase: 'normal',
          ruleIds: ['a', 'b'],
          settled: false,
          executedRuleIds: ['a'],
          skippedRuleIds: []
        }
      ]
    ]);

    expect(areDependenciesSatisfied(rule, groups)).toBe(false);
  });

  it('returns false when an after group does not exist', () => {
    const rule: Rule = {
      id: 'rule-1',
      after: [{ group: 'nonexistent' }],
      activities: []
    };
    const groups = new Map<string, GroupState>();

    expect(areDependenciesSatisfied(rule, groups)).toBe(false);
  });

  it('returns true when all multiple after groups are settled', () => {
    const rule: Rule = {
      id: 'rule-1',
      after: [{ group: 'init' }, { group: 'setup' }],
      activities: []
    };
    const groups = new Map<string, GroupState>([
      [
        'init',
        {
          name: 'init',
          phase: 'normal',
          ruleIds: [],
          settled: true,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ],
      [
        'setup',
        {
          name: 'setup',
          phase: 'normal',
          ruleIds: [],
          settled: true,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ]
    ]);

    expect(areDependenciesSatisfied(rule, groups)).toBe(true);
  });
});

describe('markRuleExecuted', () => {
  it('adds rule id to executedRuleIds for each group the rule belongs to', () => {
    const rule: Rule = {
      id: 'rule-1',
      group: ['group-a', 'group-b'],
      activities: []
    };

    const groups = new Map<string, GroupState>([
      [
        'group-a',
        {
          name: 'group-a',
          phase: 'normal',
          ruleIds: ['rule-1'],
          settled: false,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ],
      [
        'group-b',
        {
          name: 'group-b',
          phase: 'normal',
          ruleIds: ['rule-1'],
          settled: false,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ]
    ]);

    markRuleExecuted(rule, groups);

    expect(groups.get('group-a')?.executedRuleIds).toContain('rule-1');
    expect(groups.get('group-b')?.executedRuleIds).toContain('rule-1');
  });

  it('sets settled to true when all rules in group have been executed', () => {
    const rule: Rule = {
      id: 'rule-2',
      group: ['group-a'],
      activities: []
    };

    const groups = new Map<string, GroupState>([
      [
        'group-a',
        {
          name: 'group-a',
          phase: 'normal',
          ruleIds: ['rule-1', 'rule-2'],
          settled: false,
          executedRuleIds: ['rule-1'],
          skippedRuleIds: []
        }
      ]
    ]);

    markRuleExecuted(rule, groups);

    expect(groups.get('group-a')?.settled).toBe(true);
  });

  it('does not set settled if some rules not yet processed', () => {
    const rule: Rule = {
      id: 'rule-1',
      group: ['group-a'],
      activities: []
    };

    const groups = new Map<string, GroupState>([
      [
        'group-a',
        {
          name: 'group-a',
          phase: 'normal',
          ruleIds: ['rule-1', 'rule-2'],
          settled: false,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ]
    ]);

    markRuleExecuted(rule, groups);

    expect(groups.get('group-a')?.settled).toBe(false);
  });

  it('handles rule with no groups', () => {
    const rule: Rule = {
      id: 'rule-1',
      activities: []
    };

    const groups = new Map<string, GroupState>();

    // Should not throw
    expect(() => markRuleExecuted(rule, groups)).not.toThrow();
  });
});

describe('markRuleSkipped', () => {
  it('adds rule id to skippedRuleIds for each group the rule belongs to', () => {
    const rule: Rule = {
      id: 'rule-1',
      group: ['group-a'],
      activities: []
    };

    const groups = new Map<string, GroupState>([
      [
        'group-a',
        {
          name: 'group-a',
          phase: 'normal',
          ruleIds: ['rule-1'],
          settled: false,
          executedRuleIds: [],
          skippedRuleIds: []
        }
      ]
    ]);

    markRuleSkipped(rule, groups);

    expect(groups.get('group-a')?.skippedRuleIds).toContain('rule-1');
  });

  it('sets settled to true when all rules have been executed or skipped', () => {
    const rule: Rule = {
      id: 'rule-2',
      group: ['group-a'],
      activities: []
    };

    const groups = new Map<string, GroupState>([
      [
        'group-a',
        {
          name: 'group-a',
          phase: 'normal',
          ruleIds: ['rule-1', 'rule-2'],
          settled: false,
          executedRuleIds: ['rule-1'],
          skippedRuleIds: []
        }
      ]
    ]);

    markRuleSkipped(rule, groups);

    expect(groups.get('group-a')?.settled).toBe(true);
  });

  it('handles rule with no groups', () => {
    const rule: Rule = {
      id: 'rule-1',
      activities: []
    };

    const groups = new Map<string, GroupState>();

    expect(() => markRuleSkipped(rule, groups)).not.toThrow();
  });
});

describe('buildGroupStates', () => {
  it('returns empty map when no rules have groups', () => {
    const rules: Rule[] = [
      { id: 'rule-1', activities: [] },
      { id: 'rule-2', activities: [] }
    ];

    const groups = buildGroupStates(rules, 'normal');

    expect(groups.size).toBe(0);
  });

  it('creates groups from rule.group arrays', () => {
    const rules: Rule[] = [
      { id: 'rule-1', group: ['init'], activities: [] },
      { id: 'rule-2', group: ['init', 'setup'], activities: [] }
    ];

    const groups = buildGroupStates(rules, 'normal');

    expect(groups.size).toBe(2);
    expect(groups.has('init')).toBe(true);
    expect(groups.has('setup')).toBe(true);
  });

  it('collects ruleIds into each group', () => {
    const rules: Rule[] = [
      { id: 'rule-1', group: ['init'], activities: [] },
      { id: 'rule-2', group: ['init', 'setup'], activities: [] }
    ];

    const groups = buildGroupStates(rules, 'normal');

    expect(groups.get('init')?.ruleIds).toContain('rule-1');
    expect(groups.get('init')?.ruleIds).toContain('rule-2');
    expect(groups.get('setup')?.ruleIds).toContain('rule-2');
  });

  it('initializes groups with settled=false and empty tracking arrays', () => {
    const rules: Rule[] = [{ id: 'rule-1', group: ['init'], activities: [] }];

    const groups = buildGroupStates(rules, 'normal');
    const group = groups.get('init');

    expect(group?.settled).toBe(false);
    expect(group?.executedRuleIds).toEqual([]);
    expect(group?.skippedRuleIds).toEqual([]);
  });
});

describe('validateOrdering', () => {
  it('returns empty array for valid ordering', () => {
    const rules: Rule[] = [
      { id: 'rule-1', group: ['init'], activities: [] },
      { id: 'rule-2', after: [{ group: 'init' }], activities: [] }
    ];

    const diagnostics = validateOrdering(rules, 'normal');

    expect(diagnostics).toHaveLength(0);
  });

  it('returns error for dependency on non-existent group', () => {
    const rules: Rule[] = [{ id: 'rule-1', after: [{ group: 'nonexistent' }], activities: [] }];

    const diagnostics = validateOrdering(rules, 'normal');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('MISSING_GROUP');
  });

  it('returns error for self-dependency in same group', () => {
    const rules: Rule[] = [
      { id: 'rule-1', group: ['init'], after: [{ group: 'init' }], activities: [] }
    ];

    const diagnostics = validateOrdering(rules, 'normal');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('CYCLE');
  });
});

describe('validateCrossPhaseOrdering', () => {
  it('returns empty array when no cross-phase violations', () => {
    const rules: Rule[] = [
      { id: 'rule-1', phase: 'early', activities: [] },
      { id: 'rule-2', phase: 'normal', activities: [] }
    ];

    const diagnostics = validateCrossPhaseOrdering(rules, 'normal');

    expect(diagnostics).toHaveLength(0);
  });

  it('returns error when early rule waits on normal group', () => {
    const rules: Rule[] = [
      { id: 'rule-1', phase: 'early', after: [{ group: 'normal-group' }], activities: [] },
      { id: 'rule-2', phase: 'normal', group: ['normal-group'], activities: [] }
    ];

    const diagnostics = validateCrossPhaseOrdering(rules, 'early');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('CROSS_PHASE_DEPENDENCY');
  });

  it('returns error when normal rule waits on safeguard group', () => {
    const rules: Rule[] = [
      { id: 'rule-1', phase: 'normal', after: [{ group: 'safeguard-group' }], activities: [] },
      { id: 'rule-2', phase: 'safeguard', group: ['safeguard-group'], activities: [] }
    ];

    const diagnostics = validateCrossPhaseOrdering(rules, 'normal');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe('CROSS_PHASE_DEPENDENCY');
  });
});
