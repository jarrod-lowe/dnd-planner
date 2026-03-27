import { describe, it, expect } from 'vitest';
import { groupChoicesBySection } from '$lib/play/groupChoicesBySection';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

/**
 * Helper to create mock AvailableRuleEntry for testing
 */
const createMockEntry = (
  id: string,
  options?: {
    section?: string;
    packBehind?: string;
    legal?: boolean;
    applicable?: boolean;
  }
): AvailableRuleEntry => {
  const rule: Rule = {
    id,
    activities: [],
    ui: {
      ...(options?.section ? { section: options.section } : {}),
      ...(options?.packBehind ? { packBehind: options.packBehind } : {})
    }
  };
  return {
    rule,
    legal: options?.legal ?? true,
    applicable: options?.applicable ?? true,
    diagnostics: []
  };
};

describe('groupChoicesBySection', () => {
  const sectionOrder = ['move', 'free'];

  describe('grouping by section', () => {
    it('groups entries by their section', () => {
      const walk = createMockEntry('move-walk', { section: 'move' });
      const attack = createMockEntry('attack-1', { section: 'free' });
      const bonus = createMockEntry('bonus-1', { section: 'free' });

      const entries = [walk, attack, bonus];

      const sections = groupChoicesBySection(entries, sectionOrder);

      expect(sections).toHaveLength(2);
      expect(sections[0].section).toBe('move');
      expect(sections[0].packedGroups).toHaveLength(1);
      expect(sections[1].section).toBe('free');
      expect(sections[1].packedGroups).toHaveLength(2);
    });

    it('places entries without section in "Other" group', () => {
      const walk = createMockEntry('move-walk', { section: 'move' });
      const unknown = createMockEntry('unknown-1');

      const entries = [walk, unknown];

      const sections = groupChoicesBySection(entries, sectionOrder);

      expect(sections).toHaveLength(2);
      expect(sections[0].section).toBe('move');
      expect(sections[1].section).toBeUndefined(); // "Other"
    });
  });

  describe('section ordering', () => {
    it('orders sections according to sectionOrder', () => {
      const free1 = createMockEntry('free-1', { section: 'free' });
      const move1 = createMockEntry('move-1', { section: 'move' });

      const entries = [free1, move1]; // free comes first in data

      const sections = groupChoicesBySection(entries, sectionOrder);

      // move should come first per sectionOrder
      expect(sections[0].section).toBe('move');
      expect(sections[1].section).toBe('free');
    });

    it('places unknown sections after known sections', () => {
      const move1 = createMockEntry('move-1', { section: 'move' });
      const custom = createMockEntry('custom-1', { section: 'custom' });

      const entries = [custom, move1];

      const sections = groupChoicesBySection(entries, sectionOrder);

      expect(sections[0].section).toBe('move');
      expect(sections[1].section).toBe('custom');
    });

    it('places "Other" (undefined section) last', () => {
      const move1 = createMockEntry('move-1', { section: 'move' });
      const other = createMockEntry('other-1');
      const custom = createMockEntry('custom-1', { section: 'custom' });

      const entries = [other, move1, custom];

      const sections = groupChoicesBySection(entries, sectionOrder);

      const lastSection = sections[sections.length - 1];
      expect(lastSection.section).toBeUndefined();
    });
  });

  describe('hasLegalEntries', () => {
    it('sets hasLegalEntries to true when section has legal entries', () => {
      const walk = createMockEntry('move-walk', { section: 'move', legal: true });

      const sections = groupChoicesBySection([walk], sectionOrder);

      expect(sections[0].hasLegalEntries).toBe(true);
    });

    it('sets hasLegalEntries to false when section has no legal entries', () => {
      const walk = createMockEntry('move-walk', { section: 'move', legal: false });

      const sections = groupChoicesBySection([walk], sectionOrder);

      expect(sections[0].hasLegalEntries).toBe(false);
    });

    it('sets hasLegalEntries to true when at least one entry is legal', () => {
      const walk = createMockEntry('move-walk', { section: 'move', legal: true });
      const swim = createMockEntry('move-swim', { section: 'move', legal: false });

      const sections = groupChoicesBySection([walk, swim], sectionOrder);

      expect(sections[0].hasLegalEntries).toBe(true);
    });
  });

  describe('integration with packed grouping', () => {
    it('applies packed grouping within each section', () => {
      const walk = createMockEntry('move-walk', { section: 'move' });
      const swim = createMockEntry('move-swim', { section: 'move', packBehind: 'move-walk' });
      const fly = createMockEntry('move-fly', { section: 'move', packBehind: 'move-walk' });

      const entries = [walk, swim, fly];

      const sections = groupChoicesBySection(entries, sectionOrder);

      expect(sections[0].packedGroups).toHaveLength(1);
      expect(sections[0].packedGroups[0]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim, fly]
      });
    });

    it('separates packed groups by section', () => {
      const walk = createMockEntry('move-walk', { section: 'move' });
      const swim = createMockEntry('move-swim', { section: 'move', packBehind: 'move-walk' });
      const dodge = createMockEntry('dodge', { section: 'free' });
      const hide = createMockEntry('hide', { section: 'free', packBehind: 'dodge' });

      const entries = [walk, swim, dodge, hide];

      const sections = groupChoicesBySection(entries, sectionOrder);

      expect(sections).toHaveLength(2);

      // Move section
      expect(sections[0].section).toBe('move');
      expect(sections[0].packedGroups).toHaveLength(1);
      expect(sections[0].packedGroups[0].type).toBe('packed');

      // Free section
      expect(sections[1].section).toBe('free');
      expect(sections[1].packedGroups).toHaveLength(1);
      expect(sections[1].packedGroups[0].type).toBe('packed');
    });
  });

  describe('empty input', () => {
    it('returns empty array when no entries', () => {
      const sections = groupChoicesBySection([], sectionOrder);
      expect(sections).toHaveLength(0);
    });
  });
});
