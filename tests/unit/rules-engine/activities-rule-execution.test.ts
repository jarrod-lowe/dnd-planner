import { describe, it, expect } from 'vitest';
import { executeRuleActivities } from '$lib/rules-engine/activities';
import type { RuleContext, Activity } from '$lib/rules-engine/types';

function createEmptyContext(): RuleContext {
  return {
    input: {} as never,
    workingState: {
      facts: {},
      events: new Set(),
      generatedRules: { early: [], normal: [], safeguard: [] },
      offeredRules: [],
      appliedRuleIds: [],
      appliedActivityIds: []
    },
    groups: new Map(),
    currentPhase: 'normal',
    allRules: []
  };
}

describe('executeRuleActivities', () => {
  it('executes activities in order', () => {
    const activities: Activity[] = [
      { id: 'act-1', type: 'numberSet', target: 'hp.current', number: 10 },
      { id: 'act-2', type: 'numberIncrement', target: 'hp.current', number: 5 }
    ];

    const context = createEmptyContext();

    executeRuleActivities(activities, context);

    expect(context.workingState.facts['hp.current']).toBe(15);
  });

  it('each activity sees state mutations from previous activities', () => {
    const activities: Activity[] = [
      { id: 'act-1', type: 'numberSet', target: 'hp.base', number: 10 },
      { id: 'act-2', type: 'numberCopy', target: 'hp.current', source: 'hp.base' }
    ];

    const context = createEmptyContext();

    executeRuleActivities(activities, context);

    expect(context.workingState.facts['hp.base']).toBe(10);
    expect(context.workingState.facts['hp.current']).toBe(10);
  });

  it('handles empty activities array', () => {
    const activities: Activity[] = [];
    const context = createEmptyContext();

    executeRuleActivities(activities, context);

    // No mutations - should still have empty state
    expect(Object.keys(context.workingState.facts)).toHaveLength(0);
  });
});
