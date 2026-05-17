import { describe, it, expect } from 'vitest';
import { getDurationState } from '$lib/play/effectUtils';
import type { Rule } from '$lib/rules-engine';

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
