import { describe, it, expect } from 'vitest';
import { getSubject } from '$lib/play/subjectUtils';
import type { Rule } from '$lib/rules-view';

describe('getSubject', () => {
  it('returns undefined when ui is absent', () => {
    const rule = { id: 'test', activities: [] } as Rule;
    expect(getSubject(rule)).toBeUndefined();
  });

  it('returns undefined when ui.subject is absent', () => {
    const rule = { id: 'test', activities: [], ui: { section: 'action' } } as Rule;
    expect(getSubject(rule)).toBeUndefined();
  });

  it('returns the subject string when present', () => {
    const rule = {
      id: 'test',
      activities: [],
      ui: { section: 'action', subject: 'steed' }
    } as Rule;
    expect(getSubject(rule)).toBe('steed');
  });
});
