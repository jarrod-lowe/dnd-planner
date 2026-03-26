import { describe, it, expect } from 'vitest';
import { executeActivity } from '$lib/rules-engine/activities';
import type {
  RuleContext,
  NumberSetActivity,
  NumberIncrementActivity,
  NumberCopyActivity,
  NumberSumActivity,
  NumberFunctionActivity,
  EmitEventActivity,
  GenerateRuleActivity,
  OfferRuleActivity,
  Rule
} from '$lib/rules-engine/types';

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
    allRules: [],
    currentRule: { id: 'test-rule', activities: [] }
  };
}

describe('executeActivity', () => {
  it('dispatches number_set activity to executeNumberSet', () => {
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

  it('dispatches number_increment activity', () => {
    const activity: NumberIncrementActivity = {
      id: 'test-1',
      type: 'numberIncrement',
      target: { fact: 'hp.current' },
      source: { number: 5 }
    };
    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.current']).toBe(15);
  });

  it('dispatches number_copy activity', () => {
    const activity: NumberCopyActivity = {
      id: 'test-1',
      type: 'numberCopy',
      target: { fact: 'hp.temp' },
      source: { fact: 'hp.current' }
    };
    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 25;

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.temp']).toBe(25);
  });

  it('dispatches number_sum activity', () => {
    const activity: NumberSumActivity = {
      id: 'test-1',
      type: 'numberSum',
      target: { fact: 'hp.max' },
      sources: [{ fact: 'hp.base' }, { fact: 'hp.bonus' }]
    };
    const context = createEmptyContext();
    context.workingState.facts['hp.base'] = 10;
    context.workingState.facts['hp.bonus'] = 3;

    executeActivity(activity, context);

    expect(context.workingState.facts['hp.max']).toBe(13);
  });

  it('dispatches number_function activity', () => {
    const activity: NumberFunctionActivity = {
      id: 'test-1',
      type: 'numberFunction',
      target: { fact: 'str.modifier' },
      function: 'statToModifier',
      sources: [{ fact: 'str.value' }]
    };
    const context = createEmptyContext();
    context.workingState.facts['str.value'] = 18;

    executeActivity(activity, context);

    expect(context.workingState.facts['str.modifier']).toBe(4);
  });

  it('dispatches emit_event activity', () => {
    const activity: EmitEventActivity = {
      id: 'test-1',
      type: 'emitEvent',
      event: 'attack'
    };
    const context = createEmptyContext();

    executeActivity(activity, context);

    expect(context.workingState.events.has('attack')).toBe(true);
  });

  it('dispatches generate_rule activity', () => {
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
    const context = createEmptyContext();
    context.currentPhase = 'normal';

    executeActivity(activity, context);

    expect(context.workingState.generatedRules.safeguard).toContain(generatedRule);
  });

  it('dispatches offer_rule activity', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };
    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offerRule',
      rule
    };
    const context = createEmptyContext();

    executeActivity(activity, context);

    expect(context.workingState.offeredRules).toHaveLength(1);
    expect(context.workingState.offeredRules[0].rule).toBe(rule);
  });
});
