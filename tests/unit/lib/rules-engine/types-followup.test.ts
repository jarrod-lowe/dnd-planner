import { describe, it, expect } from 'vitest';
import type { Followup } from '$lib/rules-engine';

describe('Followup type', () => {
  it('accepts effect followup with addRule', () => {
    const followup: Followup = {
      type: 'effect',
      condition: { fact: 'test', operator: 'equals', value: 1 },
      button: 'test.button',
      addRule: {
        target: 'effect',
        rule: { id: 'test-effect', phase: 'normal', activities: [] }
      }
    };
    expect(followup.type).toBe('effect');
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
