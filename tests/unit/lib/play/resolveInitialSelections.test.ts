import { describe, it, expect } from 'vitest';
import { resolveInitialSelections } from '$lib/play/resolveInitialSelections';
import type { Rule, Facts } from '$lib/rules-view';

describe('resolveInitialSelections', () => {
  describe('capture: true vars', () => {
    it('resolves fact default for capture var', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        }
      };
      const facts: Facts = {
        'character.movement.remaining': 25,
        'character.movement.total': 30
      };

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({ distance: 25 });
    });

    it('resolves number default for capture var', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          quantity: {
            default: { number: 5 },
            capture: true
          }
        }
      };
      const facts: Facts = {};

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({ quantity: 5 });
    });

    it('captures 0 when fact is undefined', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        }
      };
      const facts: Facts = {};

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({ distance: 0 });
    });

    it('captures 0 when fact is null', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        }
      };
      const facts = {
        'character.movement.remaining': null
      } as unknown as Facts;

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({ distance: 0 });
    });
  });

  describe('capture: false or missing vars', () => {
    it('ignores vars without capture property', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' }
          }
        }
      };
      const facts: Facts = {
        'character.movement.remaining': 25
      };

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({});
    });

    it('ignores vars with capture: false', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: false
          }
        }
      };
      const facts: Facts = {
        'character.movement.remaining': 25
      };

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({});
    });
  });

  describe('mixed vars', () => {
    it('resolves only capture vars when rule has mixed var types', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          },
          maxDistance: {
            default: { fact: 'character.movement.total' }
            // no capture - should be ignored
          },
          quantity: {
            default: { number: 3 },
            capture: true
          }
        }
      };
      const facts: Facts = {
        'character.movement.remaining': 20,
        'character.movement.total': 30
      };

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({
        distance: 20,
        quantity: 3
      });
    });
  });

  describe('edge cases', () => {
    it('returns empty object for rule with no vars', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: []
      };
      const facts: Facts = {};

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({});
    });

    it('returns empty object for rule with empty vars', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {}
      };
      const facts: Facts = {};

      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({});
    });

    it('preserves existing selections when rule already has them', () => {
      const rule: Rule = {
        id: 'test-rule',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        },
        selections: {
          distance: 10
        }
      };
      const facts: Facts = {
        'character.movement.remaining': 25
      };

      // The utility should capture from facts, not preserve existing selections
      // This is intentional: capture means "capture at add time"
      const selections = resolveInitialSelections(rule, facts);

      expect(selections).toEqual({ distance: 25 });
    });
  });
});
