import { describe, it, expect } from 'vitest';
import { executeOfferRule } from '$lib/rules-engine/activities';
import type { RuleContext, OfferRuleActivity, Rule } from '$lib/rules-engine/types';

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

describe('executeOfferRule', () => {
  it('adds offered rule to offeredRules array', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule
    };

    const context = createEmptyContext();

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules).toHaveLength(1);
    expect(context.workingState.offeredRules[0].rule).toBe(rule);
  });

  it('sets legal to true when no legalWhen conditions', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule
    };

    const context = createEmptyContext();

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].legal).toBe(true);
  });

  it('sets legal to false when legalWhen condition passes', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule,
      legalWhen: [
        {
          condition: { fact: 'hp.current' },
          illegalDiagnostics: [{ code: 'HP_EXISTS', severity: 'error', message: 'HP exists' }]
        }
      ]
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].legal).toBe(false);
  });

  it('sets legal to true when legalWhen condition fails', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule,
      legalWhen: [
        {
          condition: { fact: 'hp.current' },
          illegalDiagnostics: [{ code: 'HP_EXISTS', severity: 'error', message: 'HP exists' }]
        }
      ]
    };

    const context = createEmptyContext();
    // hp.current does not exist, so condition fails

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].legal).toBe(true);
  });

  it('collects diagnostics from illegal conditions', () => {
    const rule: Rule = {
      id: 'offered-rule',
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule,
      legalWhen: [
        {
          condition: { fact: 'hp.current' },
          illegalDiagnostics: [{ code: 'HP_EXISTS', severity: 'error', message: 'HP exists' }]
        }
      ]
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].diagnostics).toHaveLength(1);
    expect(context.workingState.offeredRules[0].diagnostics[0].code).toBe('HP_EXISTS');
  });

  it('sets applicable to true when rule when conditions pass', () => {
    const rule: Rule = {
      id: 'offered-rule',
      when: [{ fact: 'hp.current' }],
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].applicable).toBe(true);
  });

  it('sets applicable to false when rule when conditions fail', () => {
    const rule: Rule = {
      id: 'offered-rule',
      when: [{ fact: 'hp.current', operator: 'greaterThan', value: 100 }],
      activities: []
    };

    const activity: OfferRuleActivity = {
      id: 'test-1',
      type: 'offer_rule',
      rule
    };

    const context = createEmptyContext();
    context.workingState.facts['hp.current'] = 10;

    executeOfferRule(activity, context);

    expect(context.workingState.offeredRules[0].applicable).toBe(false);
  });
});
