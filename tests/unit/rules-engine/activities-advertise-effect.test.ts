import { describe, it, expect } from 'vitest';
import { executeActivity, executeAdvertiseEffect } from '$lib/rules-engine/activities';
import type {
  WorkingState,
  AdvertiseEffectActivity,
  RuleContext,
  Rule
} from '$lib/rules-engine/types';

function createEmptyState(): WorkingState {
  return {
    facts: {},
    events: new Set(),
    generatedRules: { early: [], normal: [], safeguard: [] },
    advertisedEffects: [],
    advertisedEffectCounter: 0,
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

describe('executeAdvertiseEffect', () => {
  describe('with rule template', () => {
    it('adds the rule to advertisedEffects with a unique ID suffix', () => {
      const effectRule: Rule = {
        id: 'effect-my-spell-l1',
        phase: 'normal',
        activities: [
          {
            id: 'consume-slot',
            type: 'numberIncrement',
            target: { fact: 'spellcasting.slots.level1.remaining' },
            source: { number: 1 },
            subtract: true
          }
        ]
      };

      const activity: AdvertiseEffectActivity = {
        id: 'advertise-1',
        type: 'advertiseEffect',
        rule: effectRule
      };

      const context = createEmptyContext();

      executeAdvertiseEffect(activity, context);

      expect(context.workingState.advertisedEffects).toHaveLength(1);
      expect(context.workingState.advertisedEffects[0].id).toBe('effect-my-spell-l1-1');
      expect(context.workingState.advertisedEffectCounter).toBe(1);
    });

    it('increments counter for each advertised effect producing unique IDs', () => {
      const effectRule: Rule = {
        id: 'effect-spell-l1',
        activities: []
      };

      const activity: AdvertiseEffectActivity = {
        id: 'advertise-1',
        type: 'advertiseEffect',
        rule: effectRule
      };

      const context = createEmptyContext();

      executeAdvertiseEffect(activity, context);
      executeAdvertiseEffect(activity, context);

      expect(context.workingState.advertisedEffects).toHaveLength(2);
      expect(context.workingState.advertisedEffects[0].id).toBe('effect-spell-l1-1');
      expect(context.workingState.advertisedEffects[1].id).toBe('effect-spell-l1-2');
    });

    it('deep clones the rule so mutations do not affect the original', () => {
      const effectRule: Rule = {
        id: 'effect-original',
        activities: []
      };

      const activity: AdvertiseEffectActivity = {
        id: 'advertise-1',
        type: 'advertiseEffect',
        rule: effectRule
      };

      const context = createEmptyContext();

      executeAdvertiseEffect(activity, context);

      // Mutate the advertised effect
      context.workingState.advertisedEffects[0].id = 'mutated';

      // Original should be unaffected
      expect(effectRule.id).toBe('effect-original');
    });
  });

  describe('with self: true', () => {
    it('copies the current rule to advertisedEffects preserving its ID', () => {
      const currentRule: Rule = {
        id: 'effect-spell-l1-1',
        phase: 'normal',
        activities: [
          {
            id: 'consume',
            type: 'numberIncrement',
            target: { fact: 'slots.remaining' },
            source: { number: 1 },
            subtract: true
          },
          {
            id: 'sustain',
            type: 'advertiseEffect',
            self: true
          }
        ]
      };

      const activity: AdvertiseEffectActivity = {
        id: 'sustain',
        type: 'advertiseEffect',
        self: true
      };

      const context = createEmptyContext();
      context.currentRule = currentRule;

      executeAdvertiseEffect(activity, context);

      expect(context.workingState.advertisedEffects).toHaveLength(1);
      expect(context.workingState.advertisedEffects[0].id).toBe('effect-spell-l1-1');
    });

    it('deep clones so the copy is independent', () => {
      const currentRule: Rule = {
        id: 'effect-abc',
        activities: []
      };

      const activity: AdvertiseEffectActivity = {
        id: 'sustain',
        type: 'advertiseEffect',
        self: true
      };

      const context = createEmptyContext();
      context.currentRule = currentRule;

      executeAdvertiseEffect(activity, context);

      // Mutate the copy
      context.workingState.advertisedEffects[0].id = 'mutated';

      // Original unaffected
      expect(currentRule.id).toBe('effect-abc');
    });

    it('does not increment the counter', () => {
      const activity: AdvertiseEffectActivity = {
        id: 'sustain',
        type: 'advertiseEffect',
        self: true
      };

      const context = createEmptyContext();
      context.currentRule = { id: 'effect-x', activities: [] };

      executeAdvertiseEffect(activity, context);

      expect(context.workingState.advertisedEffectCounter).toBe(0);
    });
  });

  describe('validation', () => {
    it('throws when neither rule nor self is provided', () => {
      const activity: AdvertiseEffectActivity = {
        id: 'bad-1',
        type: 'advertiseEffect'
      };

      const context = createEmptyContext();

      expect(() => executeAdvertiseEffect(activity, context)).toThrow();
    });

    it('throws when self is true but no currentRule in context', () => {
      const activity: AdvertiseEffectActivity = {
        id: 'bad-2',
        type: 'advertiseEffect',
        self: true
      };

      const context = createEmptyContext();
      context.currentRule = undefined;

      expect(() => executeAdvertiseEffect(activity, context)).toThrow();
    });
  });

  describe('via executeActivity dispatcher', () => {
    it('dispatches to executeAdvertiseEffect for type advertiseEffect', () => {
      const effectRule: Rule = {
        id: 'effect-dispatch',
        activities: []
      };

      const activity: AdvertiseEffectActivity = {
        id: 'adv-1',
        type: 'advertiseEffect',
        rule: effectRule
      };

      const context = createEmptyContext();

      executeActivity(activity, context);

      expect(context.workingState.advertisedEffects).toHaveLength(1);
    });

    it('respects when condition - skips when false', () => {
      const effectRule: Rule = {
        id: 'effect-conditional',
        activities: []
      };

      const activity: AdvertiseEffectActivity = {
        id: 'adv-1',
        type: 'advertiseEffect',
        rule: effectRule,
        when: {
          fact: 'some.fact',
          operator: 'equals',
          value: 1
        }
      };

      const context = createEmptyContext();

      executeActivity(activity, context);

      expect(context.workingState.advertisedEffects).toHaveLength(0);
    });
  });
});
