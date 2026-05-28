import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EngineInput, Rule } from '$lib/rules-engine';
import { decrementCountDowns } from '$lib/play/countDown';
import { getDurationState } from '$lib/play/effectUtils';

/**
 * Simulates the effect lifecycle that playStore.endTurn performs:
 * 1. Evaluate with committed effects → get advertised effects
 * 2. decrementCountDowns on advertised effects → new committed effects
 * 3. Evaluate again with new committed effects
 *
 * This test verifies that ui.duration is preserved through the round-trip,
 * which is required for EffectChip to render countdown dots.
 */

function makeSelfSustainingEffect(id: string, countDown: number, duration: number): Rule {
  return {
    id,
    phase: 'early',
    activities: [
      {
        type: 'advertiseEffect',
        self: true
      }
    ],
    ui: {
      section: 'ongoing',
      name: 'test.effect',
      countDown,
      duration
    }
  };
}

function runEvaluation(standingRules: Rule[], effects: Rule[]) {
  const input: EngineInput = {
    schemaVersion: 1,
    rules: {
      standing: standingRules,
      planned: [],
      effects
    },
    state: { facts: {} }
  };
  return evaluate(input);
}

describe('countdown round-trip through engine', () => {
  const standingRules: Rule[] = [];

  it('preserves ui.duration through advertise → decrement → re-evaluate cycle', () => {
    // Step 1: Initial evaluation produces an advertised effect with countDown/duration
    const initialEffect = makeSelfSustainingEffect('effect-test-1', 10, 10);
    const output1 = runEvaluation(standingRules, [initialEffect]);

    // The engine should re-advertise the effect via self:true
    expect(output1.effects.length).toBeGreaterThanOrEqual(1);
    const advertised1 = output1.effects.find((e) => e.id === 'effect-test-1');
    expect(advertised1).toBeDefined();
    expect(advertised1!.ui?.countDown).toBe(10);
    expect(advertised1!.ui?.duration).toBe(10);

    // Step 2: decrementCountDowns (simulates endTurn)
    const committed = decrementCountDowns(output1.effects);
    const decremented = committed.find((e) => e.id === 'effect-test-1');
    expect(decremented).toBeDefined();
    expect(decremented!.ui?.countDown).toBe(9);
    expect(decremented!.ui?.duration).toBe(10);

    // Step 3: Re-evaluate with decremented committed effects
    const output2 = runEvaluation(standingRules, committed);
    const advertised2 = output2.effects.find((e) => e.id === 'effect-test-1');
    expect(advertised2).toBeDefined();

    // Both countDown (decremented) and duration must survive the round-trip
    expect(advertised2!.ui?.countDown).toBe(9);
    expect(advertised2!.ui?.duration).toBe(10);

    // getDurationState must return a valid result (this is what EffectChip checks)
    const durationState = getDurationState(advertised2!);
    expect(durationState).toEqual({
      remaining: 9,
      total: 10,
      nearExpiry: false
    });
  });

  it('preserves duration through multiple decrement cycles', () => {
    let effects: Rule[] = [makeSelfSustainingEffect('effect-test-1', 10, 10)];

    for (let turn = 9; turn >= 1; turn--) {
      const output = runEvaluation(standingRules, effects);
      effects = decrementCountDowns(output.effects);

      const effect = effects.find((e) => e.id === 'effect-test-1');
      expect(effect).toBeDefined();
      expect(effect!.ui?.countDown).toBe(turn);
      expect(effect!.ui?.duration).toBe(10);

      const durationState = getDurationState(effect!);
      expect(durationState).not.toBeNull();
      expect(durationState!.remaining).toBe(turn);
      expect(durationState!.total).toBe(10);
      expect(durationState!.nearExpiry).toBe(turn === 1);
    }
  });

  it('removes effect when countDown reaches 0', () => {
    const effect = makeSelfSustainingEffect('effect-test-1', 1, 10);
    const output = runEvaluation(standingRules, [effect]);
    const committed = decrementCountDowns(output.effects);

    expect(committed.find((e) => e.id === 'effect-test-1')).toBeUndefined();
  });

  it('getDurationState returns null when duration is missing from committed effect', () => {
    // Simulate a broken effect where duration was somehow stripped
    const brokenEffect: Rule = {
      id: 'effect-broken-1',
      phase: 'early',
      activities: [{ type: 'advertiseEffect', self: true }],
      ui: {
        section: 'ongoing',
        name: 'test.broken',
        countDown: 5
        // duration intentionally missing
      }
    };

    const output = runEvaluation(standingRules, [brokenEffect]);
    const advertised = output.effects.find((e) => e.id === 'effect-broken-1');

    if (advertised) {
      const durationState = getDurationState(advertised);
      expect(durationState).toBeNull();
    }
  });
});
