import { describe, it, expect } from 'vitest';
import {
  executeActivity,
  executeNumberSet,
  executeNumberIncrement,
  executeNumberCopy,
  executeNumberSum,
  executeNumberFunction,
  executeEmitEvent,
  executeGenerateRule
} from '$lib/rules-engine/activities';
import type {
  WorkingState,
  NumberSetActivity,
  NumberIncrementActivity,
  NumberCopyActivity,
  NumberSumActivity,
  NumberFunctionActivity,
  EmitEventActivity,
  GenerateRuleActivity,
  RuleContext,
  Rule,
  SetClearActivity,
  SetAddActivity
} from '$lib/rules-engine/types';

function createEmptyState(): WorkingState {
  return {
    facts: {},
    events: new Set(),
    generatedRules: { early: [], normal: [], safeguard: [] },
    offeredRules: [],
    appliedRuleIds: [],
    appliedActivityIds: []
  };
}

function createEmptyContext(phase: 'early' | 'normal' | 'safeguard' = 'normal'): RuleContext {
  return {
    input: {} as never,
    workingState: createEmptyState(),
    groups: new Map(),
    currentPhase: phase,
    allRules: [],
    currentRule: { id: 'test-rule', activities: [] }
  };
}

describe('executeNumberSet', () => {
  it('sets a fact to a number value', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 }
    };

    const context = createEmptyContext();

    executeNumberSet(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(42);
  });

  it('overwrites an existing value', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 100 }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 50;

    executeNumberSet(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(100);
  });

  it('sets a fact from another fact', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { fact: 'hp.max' }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.max'] = 30;

    executeNumberSet(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(30);
  });

  it('sets a fact from a var with selection', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'distance' },
      source: { var: 'moveDistance' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      selections: { moveDistance: 15 }
    };

    executeNumberSet(activity, context);

    expect(context.workingState.facts['distance']).toBe(15);
  });

  it('sets a var target to a number value', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { var: 'legal' },
      source: { number: 1 }
    };

    const context = createEmptyContext();

    executeNumberSet(activity, context);

    expect(context.currentRule?.varsRuntime?.['legal']).toBe(1);
  });

  it('overwrites an existing var value', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { var: 'counter' },
      source: { number: 100 }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { counter: 50 }
    };

    executeNumberSet(activity, context);

    expect(context.currentRule?.varsRuntime?.['counter']).toBe(100);
  });

  it('sets a var from a condition source', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { var: 'legal' },
      source: {
        condition: {
          fact: 'movement.current',
          operator: 'greaterThanOrEqual',
          value: 5
        }
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['movement.current'] = 10;

    executeNumberSet(activity, context);

    expect(context.currentRule?.varsRuntime?.['legal']).toBe(1);
  });

  it('sets a var to 0 when condition is false', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { var: 'legal' },
      source: {
        condition: {
          fact: 'movement.current',
          operator: 'greaterThanOrEqual',
          value: 5
        }
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['movement.current'] = 2;

    executeNumberSet(activity, context);

    expect(context.currentRule?.varsRuntime?.['legal']).toBe(0);
  });
});

describe('executeNumberIncrement', () => {
  it('increments an existing fact by a positive number', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { number: 5 }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(15);
  });

  it('treats missing fact as 0 before incrementing', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { number: 5 }
    };

    const context = createEmptyContext();

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(5);
  });

  it('decrements with subtract flag', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { number: 3 },
      subtract: true
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(7);
  });

  it('caps result at max value when max is specified', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { number: 10 },
      max: 'hp.max'
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 5;
    context.workingState.facts['hp.max'] = 12;

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(12);
  });

  it('increments by a fact value', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { fact: 'healing.amount' }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;
    context.workingState.facts['healing.amount'] = 8;

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(18);
  });

  it('increments a var target', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { var: 'counter' },
      source: { number: 5 }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { counter: 10 }
    };

    executeNumberIncrement(activity, context);

    expect(context.currentRule?.varsRuntime?.['counter']).toBe(15);
  });

  it('treats missing var as 0 before incrementing', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { var: 'counter' },
      source: { number: 5 }
    };

    const context = createEmptyContext();

    executeNumberIncrement(activity, context);

    expect(context.currentRule?.varsRuntime?.['counter']).toBe(5);
  });
});

describe('executeNumberCopy', () => {
  it('copies a value from source fact to target', () => {
    const activity: NumberCopyActivity = {
      id: 'test-1',
      type: 'numberCopy',
      target: { fact: 'hp.temp' },
      source: { fact: 'hp.current' }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 25;

    executeNumberCopy(activity, context);

    expect(context.workingState.facts['hp.temp']).toBe(25);
  });

  it('copies a literal number', () => {
    const activity: NumberCopyActivity = {
      id: 'test-1',
      type: 'numberCopy',
      target: { fact: 'counter' },
      source: { number: 42 }
    };

    const context = createEmptyContext();

    executeNumberCopy(activity, context);

    expect(context.workingState.facts['counter']).toBe(42);
  });

  it('copies a value to a var target', () => {
    const activity: NumberCopyActivity = {
      id: 'test-1',
      type: 'numberCopy',
      target: { var: 'copied' },
      source: { fact: 'hp.current' }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 25;

    executeNumberCopy(activity, context);

    expect(context.currentRule?.varsRuntime?.['copied']).toBe(25);
  });
});

describe('executeNumberSum', () => {
  it('sums multiple facts into target', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: { fact: 'hp.max' },
      sources: [{ fact: 'hp.base' }, { fact: 'hp.bonus' }]
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.base'] = 10;
    context.workingState.facts['hp.bonus'] = 3;

    executeNumberSum(activity, context);

    expect(context.workingState.facts['hp.max']).toBe(13);
  });

  it('treats missing facts as 0', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: { fact: 'hp.max' },
      sources: [{ fact: 'hp.base' }, { fact: 'hp.bonus' }]
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.base'] = 10;
    // hp.bonus is missing

    executeNumberSum(activity, context);

    expect(context.workingState.facts['hp.max']).toBe(10);
  });

  it('can mix facts and literal numbers', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: { fact: 'total' },
      sources: [{ fact: 'base' }, { number: 5 }]
    };

    const context = createEmptyContext();
    context.workingState.facts['base'] = 10;

    executeNumberSum(activity, context);

    expect(context.workingState.facts['total']).toBe(15);
  });

  it('sums into a var target', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: { var: 'total' },
      sources: [{ number: 10 }, { number: 5 }]
    };

    const context = createEmptyContext();

    executeNumberSum(activity, context);

    expect(context.currentRule?.varsRuntime?.['total']).toBe(15);
  });
});

describe('executeNumberFunction', () => {
  it('calls statToModifier and stores result in target', () => {
    const activity: NumberFunctionActivity = {
      id: 'test-1',
      type: 'numberFunction',
      target: { fact: 'str.modifier' },
      function: 'statToModifier',
      sources: [{ fact: 'str.value' }]
    };

    const context = createEmptyContext();
    context.workingState.facts['str.value'] = 18;

    executeNumberFunction(activity, context);

    expect(context.workingState.facts['str.modifier']).toBe(4);
  });

  it('calls multiply with args and stores result in target', () => {
    const activity: NumberFunctionActivity = {
      id: 'test-1',
      type: 'numberFunction',
      target: { fact: 'movement.half' },
      function: 'multiply',
      sources: [{ fact: 'movement.current' }],
      args: { multiplier: 0.5 }
    };

    const context = createEmptyContext();
    context.workingState.facts['movement.current'] = 30;

    executeNumberFunction(activity, context);

    expect(context.workingState.facts['movement.half']).toBe(15);
  });

  it('stores result in a var target', () => {
    const activity: NumberFunctionActivity = {
      id: 'test-1',
      type: 'numberFunction',
      target: { var: 'modifier' },
      function: 'statToModifier',
      sources: [{ fact: 'str.value' }]
    };

    const context = createEmptyContext();
    context.workingState.facts['str.value'] = 18;

    executeNumberFunction(activity, context);

    expect(context.currentRule?.varsRuntime?.['modifier']).toBe(4);
  });
});

describe('executeEmitEvent', () => {
  it('adds event to state events set', () => {
    const activity: EmitEventActivity = {
      id: 'test-1',
      type: 'emitEvent',
      event: 'attack'
    };

    const context = createEmptyContext();

    executeEmitEvent(activity, context);

    expect(context.workingState.events.has('attack')).toBe(true);
  });

  it('can add multiple different events', () => {
    const activity1: EmitEventActivity = {
      id: 'test-1',
      type: 'emitEvent',
      event: 'attack'
    };
    const activity2: EmitEventActivity = {
      id: 'test-2',
      type: 'emitEvent',
      event: 'damage'
    };

    const context = createEmptyContext();

    executeEmitEvent(activity1, context);
    executeEmitEvent(activity2, context);

    expect(context.workingState.events.has('attack')).toBe(true);
    expect(context.workingState.events.has('damage')).toBe(true);
    expect(context.workingState.events.size).toBe(2);
  });
});

describe('executeGenerateRule', () => {
  it('adds generated rule to the appropriate phase array', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'safeguard',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('normal');

    executeGenerateRule(activity, context);

    expect(context.workingState.generatedRules.safeguard).toContain(generatedRule);
  });

  it('defaults phase to normal when not specified', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      // phase not specified
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('early');

    executeGenerateRule(activity, context);

    expect(context.workingState.generatedRules.normal).toContain(generatedRule);
  });

  it('can add to normal phase from early', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'normal',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('early');

    executeGenerateRule(activity, context);

    expect(context.workingState.generatedRules.normal).toContain(generatedRule);
  });

  it('can add to safeguard phase from normal', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'safeguard',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('normal');

    executeGenerateRule(activity, context);

    expect(context.workingState.generatedRules.safeguard).toContain(generatedRule);
  });

  it('throws when safeguard phase tries to generate any rule', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'safeguard',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('safeguard');

    expect(() => executeGenerateRule(activity, context)).toThrow(
      'Cannot generate rule for earlier or same phase'
    );
  });

  it('throws when normal phase tries to generate early rule', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'early',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('normal');

    expect(() => executeGenerateRule(activity, context)).toThrow(
      'Cannot generate rule for earlier or same phase'
    );
  });

  it('throws when normal phase tries to generate normal rule', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'normal',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('normal');

    expect(() => executeGenerateRule(activity, context)).toThrow(
      'Cannot generate rule for earlier or same phase'
    );
  });

  it('throws when early phase tries to generate early rule', () => {
    const generatedRule: Rule = {
      id: 'generated-1',
      phase: 'early',
      activities: []
    };

    const activity: GenerateRuleActivity = {
      id: 'test-1',
      type: 'generateRule',
      rule: generatedRule
    };

    const context = createEmptyContext('early');

    expect(() => executeGenerateRule(activity, context)).toThrow(
      'Cannot generate rule for earlier or same phase'
    );
  });
});

describe('activity when condition', () => {
  it('executes activity when when condition is true', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 },
      when: {
        fact: 'hp.max',
        operator: 'greaterThan',
        value: 0
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.max'] = 10;

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(42);
  });

  it('skips activity when when condition is false', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 },
      when: {
        fact: 'hp.max',
        operator: 'greaterThan',
        value: 100
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.max'] = 10;

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBeUndefined();
  });

  it('executes activity without when condition (backward compatible)', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 }
    };

    const context = createEmptyContext();

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(42);
  });

  it('skips activity when event condition in when is not met', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 },
      when: {
        event: 'attack'
      }
    };

    const context = createEmptyContext();
    // No event emitted

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBeUndefined();
  });

  it('executes activity when event condition in when is met', () => {
    const activity: NumberSetActivity = {
      id: 'test-1',
      type: 'numberSet',
      target: { fact: 'hp.current' },
      source: { number: 42 },
      when: {
        event: 'attack'
      }
    };

    const context = createEmptyContext();
    context.workingState.events.add('attack');

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(42);
  });
});

describe('executeSetClear', () => {
  it('initializes a var to an empty array', () => {
    const activity: SetClearActivity = {
      id: 'test-1',
      type: 'setClear',
      target: { var: 'errors' }
    };

    const context = createEmptyContext();

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual([]);
  });

  it('clears an existing array to empty', () => {
    const activity: SetClearActivity = {
      id: 'test-1',
      type: 'setClear',
      target: { var: 'errors' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: ['error1', 'error2'] }
    };

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual([]);
  });

  it('skips when when condition is false', () => {
    const activity: SetClearActivity = {
      id: 'test-1',
      type: 'setClear',
      target: { var: 'errors' },
      when: {
        fact: 'some.fact',
        operator: 'equals',
        value: 1
      }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: ['existing-error'] }
    };

    executeActivity(activity, context);

    // Should not clear because when condition is false
    expect(context.currentRule?.varsRuntime?.['errors']).toEqual(['existing-error']);
  });
});

describe('executeSetAdd', () => {
  it('adds a string to an empty array', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.movement' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: [] }
    };

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual(['play.choices.illegal.movement']);
  });

  it('adds a string to an existing array', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.action' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: ['play.choices.illegal.movement'] }
    };

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual([
      'play.choices.illegal.movement',
      'play.choices.illegal.action'
    ]);
  });

  it('deduplicates same string', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.movement' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: ['play.choices.illegal.movement'] }
    };

    executeActivity(activity, context);

    // Should not add duplicate
    expect(context.currentRule?.varsRuntime?.['errors']).toEqual(['play.choices.illegal.movement']);
  });

  it('initializes array if it does not exist', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.movement' }
    };

    const context = createEmptyContext();
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: {}
    };

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual(['play.choices.illegal.movement']);
  });

  it('skips when when condition is false', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.movement' },
      when: {
        fact: 'movement.current',
        operator: 'lessThan',
        value: 0
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['movement.current'] = 10; // condition is false
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: [] }
    };

    executeActivity(activity, context);

    // Should not add because when condition is false
    expect(context.currentRule?.varsRuntime?.['errors']).toEqual([]);
  });

  it('adds when when condition is true', () => {
    const activity: SetAddActivity = {
      id: 'test-1',
      type: 'setAdd',
      target: { var: 'errors' },
      source: { string: 'play.choices.illegal.movement' },
      when: {
        fact: 'movement.current',
        operator: 'lessThan',
        value: 0
      }
    };

    const context = createEmptyContext();
    context.workingState.facts['movement.current'] = -5; // condition is true
    context.currentRule = {
      id: 'test-rule',
      activities: [],
      varsRuntime: { errors: [] }
    };

    executeActivity(activity, context);

    expect(context.currentRule?.varsRuntime?.['errors']).toEqual(['play.choices.illegal.movement']);
  });
});
