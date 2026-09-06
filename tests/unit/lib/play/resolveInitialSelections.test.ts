import { describe, it, expect } from 'vitest';
import { resolveInitialSelections } from '$lib/play/resolveInitialSelections';
import { enumerateLoadouts, loadoutEffectState } from '$lib/rules-engine/loadout';
import type { Rule, Facts } from '$lib/rules-view';
import type { RuleModule } from '$lib/rules-engine/types';

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

  describe('loadout control', () => {
    const spear: RuleModule = {
      id: 'spear',
      equip: {
        hands: 1,
        versatile: true,
        stackable: true,
        nameKey: 'rule.test.spear.name',
        state: { 'weapon.spear.equipped': 1 },
        twoHandedState: { 'weapon.spear.twoHanded': 1 }
      }
    };

    const loadoutRule: Rule = {
      id: 'set-loadout',
      activities: [],
      ui: { primaryControl: { type: 'loadout', var: 'loadout' } }
    };

    /**
     * The facts the sheet would carry while holding `id`, plus any hands spent by
     * something other than the loadout. Derived rather than hand-written: the
     * matcher compares against every fact a configuration can write, so a literal
     * fixture quietly stops matching (and falls back to `empty`, which looks like
     * a real answer) whenever that state gains a fact. The literal names are
     * pinned in tests/unit/rules-engine/loadout.test.ts, where they belong.
     */
    const heldFacts = (id: string, spentElsewhere = 0): Facts => {
      const config = enumerateLoadouts([spear]).find((c) => c.id === id);
      if (!config) throw new Error(`no such configuration: ${id}`);
      const state = loadoutEffectState(config);
      return { ...state, 'hands.spent': state['hands.spent'] + spentElsewhere };
    };

    it('captures what is already in the hands so the row starts on it', () => {
      // Without this the row would start on "empty hands" and its effect would
      // silently disarm the character the moment it is added to the plan.
      const selections = resolveInitialSelections(loadoutRule, heldFacts('spear'), [spear]);

      expect((selections.loadout as { id: string }).id).toBe('spear');
    });

    it('captures the two-handed grip when that is how the weapon is held', () => {
      const selections = resolveInitialSelections(loadoutRule, heldFacts('spear:2h'), [spear]);

      expect((selections.loadout as { id: string }).id).toBe('spear:2h');
    });

    /**
     * The harm the matcher collision actually did. One spear held plus a hand on a
     * grappled target presents the same aggregate hand count as a spear in each
     * hand, so the row pinned itself to the two-spear configuration — and merely
     * ADDING the row would then arm the character with a spear they do not have
     * and commit a third spent hand. An untouched row must never change what the
     * character is holding.
     */
    it('does not invent a second weapon from a hand spent elsewhere', () => {
      const selections = resolveInitialSelections(loadoutRule, heldFacts('spear', 1), [spear]);

      expect((selections.loadout as { id: string }).id).toBe('spear');
    });

    it('captures empty hands when nothing is held', () => {
      const selections = resolveInitialSelections(loadoutRule, {}, [spear]);

      expect((selections.loadout as { id: string }).id).toBe('empty');
    });

    it('leaves rules without a loadout control alone', () => {
      const rule: Rule = {
        id: 'other',
        activities: [],
        ui: { primaryControl: { type: 'slider', var: 'slotLevel' } }
      };

      expect(resolveInitialSelections(rule, {}, [spear])).toEqual({});
    });
  });
});
