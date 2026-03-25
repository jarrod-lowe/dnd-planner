import { describe, it, expect } from 'vitest';
import {
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
  Rule
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
      target: 'hp.current',
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
      target: 'hp.current',
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
      target: 'hp.current',
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
      target: 'distance',
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
});

describe('executeNumberIncrement', () => {
  it('increments an existing fact by a positive number', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: 'hp.current',
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
      target: 'hp.current',
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
      target: 'hp.current',
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
      target: 'hp.current',
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
      target: 'hp.current',
      source: { fact: 'healing.amount' }
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;
    context.workingState.facts['healing.amount'] = 8;

    executeNumberIncrement(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(18);
  });
});

describe('executeNumberCopy', () => {
  it('copies a value from source fact to target', () => {
    const activity: NumberCopyActivity = {
      id: 'test-1',
      type: 'numberCopy',
      target: 'hp.temp',
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
      target: 'counter',
      source: { number: 42 }
    };

    const context = createEmptyContext();

    executeNumberCopy(activity, context);

    expect(context.workingState.facts['counter']).toBe(42);
  });
});

describe('executeNumberSum', () => {
  it('sums multiple facts into target', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: 'hp.max',
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
      target: 'hp.max',
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
      target: 'total',
      sources: [{ fact: 'base' }, { number: 5 }]
    };

    const context = createEmptyContext();
    context.workingState.facts['base'] = 10;

    executeNumberSum(activity, context);

    expect(context.workingState.facts['total']).toBe(15);
  });
});

describe('executeNumberFunction', () => {
  it('calls statToModifier and stores result in target', () => {
    const activity: NumberFunctionActivity = {
      id: 'test-1',
      type: 'numberFunction',
      target: 'str.modifier',
      function: 'statToModifier',
      sources: [{ fact: 'str.value' }]
    };

    const context = createEmptyContext();
    context.workingState.facts['str.value'] = 18;

    executeNumberFunction(activity, context);

    expect(context.workingState.facts['str.modifier']).toBe(4);
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
