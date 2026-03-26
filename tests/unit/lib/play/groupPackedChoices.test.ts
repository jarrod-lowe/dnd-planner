import { describe, it, expect } from 'vitest';
import { groupPackedChoices } from '$lib/play/groupPackedChoices';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

/**
 * Helper to create mock AvailableRuleEntry for testing
 */
const createMockEntry = (
  id: string,
  options?: {
    packBehind?: string;
    legal?: boolean;
    applicable?: boolean;
  }
): AvailableRuleEntry => {
  const rule: Rule = {
    id,
    activities: [],
    ui: options?.packBehind ? { packBehind: options.packBehind } : undefined
  };
  return {
    rule,
    legal: options?.legal ?? true,
    applicable: options?.applicable ?? true,
    diagnostics: []
  };
};

describe('groupPackedChoices', () => {
  describe('no packing', () => {
    it('returns all entries as single groups when no packBehind is set', () => {
      const entries = [
        createMockEntry('attack-1'),
        createMockEntry('attack-2'),
        createMockEntry('move-walk')
      ];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual({ type: 'single', entry: entries[0] });
      expect(groups[1]).toEqual({ type: 'single', entry: entries[1] });
      expect(groups[2]).toEqual({ type: 'single', entry: entries[2] });
    });
  });

  describe('grouping followers behind leader', () => {
    it('groups entries with packBehind behind their leader', () => {
      const walk = createMockEntry('move-walk');
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });
      const fly = createMockEntry('move-fly', { packBehind: 'move-walk' });

      const entries = [walk, swim, fly];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim, fly]
      });
    });

    it('includes leader even when leader is illegal', () => {
      const walk = createMockEntry('move-walk', { legal: false });
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });

      const entries = [walk, swim];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim]
      });
    });
  });

  describe('missing leader fallback', () => {
    it('renders follower as single when leader does not exist in entries', () => {
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });

      const entries = [swim];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual({ type: 'single', entry: swim });
    });
  });

  describe('order preservation', () => {
    it('places packed group at leaders original position', () => {
      const attack = createMockEntry('attack-1');
      const walk = createMockEntry('move-walk');
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });
      const bonus = createMockEntry('bonus-1');

      const entries = [attack, walk, swim, bonus];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual({ type: 'single', entry: attack });
      expect(groups[1]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim]
      });
      expect(groups[2]).toEqual({ type: 'single', entry: bonus });
    });

    it('maintains follower order within a group', () => {
      const walk = createMockEntry('move-walk');
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });
      const fly = createMockEntry('move-fly', { packBehind: 'move-walk' });
      const rough = createMockEntry('move-rough', { packBehind: 'move-walk' });

      const entries = [walk, swim, fly, rough];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim, fly, rough]
      });
    });
  });

  describe('mixed scenarios', () => {
    it('handles multiple independent groups and singles', () => {
      const walk = createMockEntry('move-walk');
      const swim = createMockEntry('move-swim', { packBehind: 'move-walk' });
      const attack = createMockEntry('attack-1');
      const bonus = createMockEntry('bonus-1');
      const bonus2 = createMockEntry('bonus-2', { packBehind: 'bonus-1' });

      const entries = [walk, swim, attack, bonus, bonus2];

      const groups = groupPackedChoices(entries);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual({
        type: 'packed',
        leader: walk,
        followers: [swim]
      });
      expect(groups[1]).toEqual({ type: 'single', entry: attack });
      expect(groups[2]).toEqual({
        type: 'packed',
        leader: bonus,
        followers: [bonus2]
      });
    });
  });
});
