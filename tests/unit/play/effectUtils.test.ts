import { describe, it, expect } from 'vitest';
import {
  getDurationState,
  getEffectKind,
  isConcentrationEffect,
  getConcentrationEffectName,
  getChipState
} from '$lib/play/effectUtils';
import type { Rule } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';

const concActivity = {
  id: 'conc-dec',
  type: 'numberIncrement' as const,
  target: { fact: 'concentration.remaining' },
  source: { number: 1 },
  subtract: true
};

const selfAdvertiseActivity = {
  id: 'self-adv',
  type: 'advertiseEffect' as const,
  self: true
};

describe('getDurationState', () => {
  it('returns null for rules without ui', () => {
    const rule: Rule = { id: 'test', activities: [] };
    expect(getDurationState(rule)).toBeNull();
  });

  it('returns null for rules without countDown/duration', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: { section: 'ongoing', name: 'test.name' }
    };
    expect(getDurationState(rule)).toBeNull();
  });

  it('returns duration state for timed effects', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [],
      ui: { countDown: 10, duration: 10 }
    };
    const state = getDurationState(rule);
    expect(state).toEqual({ remaining: 10, total: 10, nearExpiry: false });
  });

  it('detects near-expiry when countDown is 1', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [],
      ui: { countDown: 1, duration: 10 }
    };
    const state = getDurationState(rule);
    expect(state).toEqual({ remaining: 1, total: 10, nearExpiry: true });
  });

  it('returns null when only countDown is present', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: { countDown: 5 }
    };
    expect(getDurationState(rule)).toBeNull();
  });

  it('returns null when only duration is present', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: { duration: 10 }
    };
    expect(getDurationState(rule)).toBeNull();
  });
});

describe('getEffectKind', () => {
  it('returns SENSE for section senses', () => {
    const rule: Rule = {
      id: 'effect-divine-sense',
      activities: [],
      ui: { section: 'senses', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('SENSE');
  });

  it('returns ITEM for section configuration', () => {
    const rule: Rule = {
      id: 'effect-shield',
      activities: [],
      ui: { section: 'configuration', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('ITEM');
  });

  it('returns CONC for effect with concentration activity', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity],
      ui: { section: 'ongoing', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('CONC');
  });

  it('returns ONGOING for section ongoing without concentration', () => {
    const rule: Rule = {
      id: 'effect-divine-favour',
      activities: [selfAdvertiseActivity],
      ui: { section: 'ongoing', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('ONGOING');
  });

  it('returns ONGOING as default for unknown section', () => {
    const rule: Rule = {
      id: 'effect-unknown',
      activities: [],
      ui: { section: 'other', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('ONGOING');
  });

  it('returns ONGOING for rule without ui', () => {
    const rule: Rule = { id: 'test', activities: [] };
    expect(getEffectKind(rule)).toBe('ONGOING');
  });

  it('returns CONC for nested concentration in generateRule', () => {
    const rule: Rule = {
      id: 'effect-complex',
      activities: [
        {
          id: 'gen-rule',
          type: 'generateRule',
          rule: {
            id: 'nested-rule',
            activities: [concActivity]
          }
        }
      ],
      ui: { section: 'ongoing', name: 'test.name' }
    };
    expect(getEffectKind(rule)).toBe('CONC');
  });
});

describe('isConcentrationEffect', () => {
  it('returns true when activity decrements concentration.remaining', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity]
    };
    expect(isConcentrationEffect(rule)).toBe(true);
  });

  it('returns false for non-concentration effects', () => {
    const rule: Rule = {
      id: 'effect-divine-sense',
      activities: [selfAdvertiseActivity]
    };
    expect(isConcentrationEffect(rule)).toBe(false);
  });

  it('returns false for rule with no activities', () => {
    const rule: Rule = { id: 'test', activities: [] };
    expect(isConcentrationEffect(rule)).toBe(false);
  });
});

describe('getConcentrationEffectName', () => {
  it('returns i18n key of the concentration effect', () => {
    const effects: Rule[] = [
      {
        id: 'effect-divine-sense',
        activities: [],
        ui: { section: 'senses', name: 'test.sense' }
      },
      {
        id: 'effect-bless',
        activities: [concActivity],
        ui: { section: 'ongoing', name: 'test.bless' }
      }
    ];
    expect(getConcentrationEffectName(effects)).toBe('test.bless');
  });

  it('returns null when no concentration effect exists', () => {
    const effects: Rule[] = [
      {
        id: 'effect-divine-sense',
        activities: [],
        ui: { section: 'senses', name: 'test.sense' }
      }
    ];
    expect(getConcentrationEffectName(effects)).toBeNull();
  });

  it('returns null for empty effects array', () => {
    expect(getConcentrationEffectName([])).toBeNull();
  });
});

describe('getChipState', () => {
  it('returns expiring when nearExpiry is true', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity],
      ui: { countDown: 1, duration: 10, section: 'ongoing', name: 'test' }
    };
    const facts: Facts = {};
    expect(getChipState(rule, facts)).toBe('expiring');
  });

  it('returns pending when concentration effect and damage taken', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity],
      ui: { countDown: 8, duration: 10, section: 'ongoing', name: 'test' }
    };
    const facts: Facts = { 'concentration.damage-taken': 1 };
    expect(getChipState(rule, facts)).toBe('pending');
  });

  it('returns rest for normal ongoing effect', () => {
    const rule: Rule = {
      id: 'effect-divine-sense',
      activities: [],
      ui: { section: 'senses', name: 'test' }
    };
    const facts: Facts = {};
    expect(getChipState(rule, facts)).toBe('rest');
  });

  it('returns rest for concentration effect without damage', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity],
      ui: { countDown: 8, duration: 10, section: 'ongoing', name: 'test' }
    };
    const facts: Facts = {};
    expect(getChipState(rule, facts)).toBe('rest');
  });

  it('prefers expiring over pending when both conditions are true', () => {
    const rule: Rule = {
      id: 'effect-bless',
      activities: [concActivity],
      ui: { countDown: 1, duration: 10, section: 'ongoing', name: 'test' }
    };
    const facts: Facts = { 'concentration.damage-taken': 1 };
    expect(getChipState(rule, facts)).toBe('expiring');
  });
});
