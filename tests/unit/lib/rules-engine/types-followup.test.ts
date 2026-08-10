import { describe, it, expect } from 'vitest';
import type { Followup } from '$lib/rules-view';

describe('Followup type', () => {
  it('accepts effect followup with addRule', () => {
    const followup: Followup = {
      type: 'effect',
      condition: { fact: 'test', operator: 'equals', value: 1 },
      button: 'test.button',
      addRule: {
        target: 'effect',
        effect: { id: 'test-effect', expiry: { kind: 'endOfTurn' } }
      }
    };
    expect(followup.type).toBe('effect');
    expect(followup.type === 'effect' && followup.addRule.effect.expiry).toEqual({
      kind: 'endOfTurn'
    });
  });

  it('accepts attack-line followup without addRule', () => {
    const followup: Followup = {
      type: 'attack-line',
      condition: { fact: 'test', operator: 'equals', value: 1 },
      button: 'test.button'
    };
    expect(followup.type).toBe('attack-line');
  });
});
