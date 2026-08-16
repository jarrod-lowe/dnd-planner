import { describe, it, expect } from 'vitest';
import { resolveCostTags } from '$lib/play/costTags';
import type { Rule } from '$lib/rules-view';

const makeRule = (overrides: Partial<Rule> & { id: string }): Rule => ({
  activities: [],
  ...overrides
});

describe('resolveCostTags', () => {
  it('passes authored tags through unchanged without a slotLevel selection', () => {
    const rule = makeRule({
      id: 'cast-sanctuary',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: {}
    });
    expect(resolveCostTags(rule)).toEqual({ tags: ['bonus', 'L1'] });
  });

  it('re-labels the authored L tag to the selected level', () => {
    const rule = makeRule({
      id: 'cast-sanctuary',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: { slotLevel: 2 }
    });
    expect(resolveCostTags(rule).tags).toEqual(['bonus', 'L2']);
  });

  it('re-labels the L tag to free for a zero (class-feature) slotLevel', () => {
    const rule = makeRule({
      id: 'cast-x',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: { slotLevel: 0 }
    });
    expect(resolveCostTags(rule).tags).toEqual(['bonus', 'free']);
    expect(resolveCostTags(rule).upcast).toBeUndefined();
  });

  it('flags the upcast when no slider could have chosen the level', () => {
    const rule = makeRule({
      id: 'cast-sanctuary',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: { slotLevel: 3 }
    });
    expect(resolveCostTags(rule)).toEqual({
      tags: ['bonus', 'L3'],
      upcast: { base: 1, level: 3 }
    });
  });

  it('does not flag the upcast when a primary slider is bound to slotLevel', () => {
    const rule = makeRule({
      id: 'cast-find-steed',
      ui: {
        actionCost: ['action', 'L2'],
        primaryControl: { type: 'slider', var: 'slotLevel' }
      },
      selections: { slotLevel: 4 }
    });
    expect(resolveCostTags(rule)).toEqual({ tags: ['action', 'L4'] });
  });

  it('does not flag the upcast when a secondary slider is bound to slotLevel', () => {
    const rule = makeRule({
      id: 'cast-x',
      ui: {
        actionCost: ['action', 'L1'],
        secondaryControl: { type: 'slider', var: 'slotLevel' }
      },
      selections: { slotLevel: 2 }
    });
    expect(resolveCostTags(rule).upcast).toBeUndefined();
  });

  it('flags the upcast when a slider is bound to a different var', () => {
    const rule = makeRule({
      id: 'cast-x',
      ui: {
        actionCost: ['action', 'L1'],
        primaryControl: { type: 'slider', var: 'targets' }
      },
      selections: { slotLevel: 2 }
    });
    expect(resolveCostTags(rule).upcast).toEqual({ base: 1, level: 2 });
  });

  it('does not flag the upcast when the level equals the authored base', () => {
    const rule = makeRule({
      id: 'cast-sanctuary',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: { slotLevel: 1 }
    });
    expect(resolveCostTags(rule)).toEqual({ tags: ['bonus', 'L1'] });
  });

  it('keeps the authored tag and flags nothing for out-of-range levels', () => {
    const rule = makeRule({
      id: 'cast-x',
      ui: { actionCost: ['bonus', 'L1'] },
      selections: { slotLevel: 6 }
    });
    expect(resolveCostTags(rule)).toEqual({ tags: ['bonus', 'L1'] });
  });

  it('flags nothing without an authored L tag (LoH/CD/free-use offers)', () => {
    const rule = makeRule({
      id: 'cast-divine-smite',
      ui: { actionCost: ['bonus'] },
      selections: { slotLevel: 0 }
    });
    expect(resolveCostTags(rule)).toEqual({ tags: ['bonus'] });
  });
});
