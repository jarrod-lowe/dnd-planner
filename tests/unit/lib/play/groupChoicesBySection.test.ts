import { describe, it, expect } from 'vitest';
import { groupChoicesBySection } from '$lib/play/groupChoicesBySection';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const SECTION_ORDER = ['move', 'action-attack', 'bonus-action'];

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
  describe('showIllegal=true (backward compatible)', () => {
    it('returns all entries when showIllegal is true', () => {
      const legal = createMockEntry('a', { section: 'move', legal: true });
      const illegal = createMockEntry('b', { section: 'move', legal: false });

      const groups = groupChoicesBySection([legal, illegal], SECTION_ORDER, true);

      expect(groups).toHaveLength(1);
      expect(groups[0].packedGroups).toHaveLength(2);
    });

    it('includes illegal entries in packed groups when showIllegal is true', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: false });
      const follower = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });

      const groups = groupChoicesBySection([leader, follower], SECTION_ORDER, true);

      expect(groups).toHaveLength(1);
      expect(groups[0].packedGroups).toHaveLength(1);
      expect(groups[0].packedGroups[0].type).toBe('packed');
    });
  });

  describe('showIllegal=false — single entries', () => {
    it('filters out illegal single entries', () => {
      const legal = createMockEntry('a', { section: 'move', legal: true });
      const illegal = createMockEntry('b', { section: 'move', legal: false });

      const groups = groupChoicesBySection([legal, illegal], SECTION_ORDER, false);

      expect(groups).toHaveLength(1);
      const moveGroup = groups.find((g) => g.section === 'move')!;
      expect(moveGroup.packedGroups).toHaveLength(1);
      expect(moveGroup.packedGroups[0]).toEqual({ type: 'single', entry: legal });
    });

    it('removes section if all entries are illegal', () => {
      const illegal1 = createMockEntry('a', { section: 'move', legal: false });
      const illegal2 = createMockEntry('b', { section: 'move', legal: false });

      const groups = groupChoicesBySection([illegal1, illegal2], SECTION_ORDER, false);

      expect(groups).toHaveLength(0);
    });
  });

  describe('showIllegal=false — packed groups with illegal leader', () => {
    it('promotes first legal follower to leader when leader is illegal', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: false });
      const follower1 = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });
      const follower2 = createMockEntry('f2', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });

      const groups = groupChoicesBySection([leader, follower1, follower2], SECTION_ORDER, false);

      expect(groups).toHaveLength(1);
      const moveGroup = groups[0];
      expect(moveGroup.packedGroups).toHaveLength(1);
      expect(moveGroup.packedGroups[0].type).toBe('packed');
      const packed = moveGroup.packedGroups[0];
      if (packed.type === 'packed') {
        expect(packed.leader).toBe(follower1);
        expect(packed.followers).toEqual([follower2]);
      }
    });

    it('removes entire pack when all members are illegal', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: false });
      const follower = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });

      const groups = groupChoicesBySection([leader, follower], SECTION_ORDER, false);

      expect(groups).toHaveLength(0);
    });

    it('promotes first legal follower and removes illegal followers', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: false });
      const followerLegal = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });
      const followerIllegal = createMockEntry('f2', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });
      const followerLegal2 = createMockEntry('f3', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });

      const groups = groupChoicesBySection(
        [leader, followerLegal, followerIllegal, followerLegal2],
        SECTION_ORDER,
        false
      );

      expect(groups).toHaveLength(1);
      const packed = groups[0].packedGroups[0];
      expect(packed.type).toBe('packed');
      if (packed.type === 'packed') {
        expect(packed.leader).toBe(followerLegal);
        expect(packed.followers).toEqual([followerLegal2]);
      }
    });

    it('makes promoted leader a single when it is the only legal entry', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: false });
      const follower = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });
      const followerIllegal = createMockEntry('f2', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });

      const groups = groupChoicesBySection(
        [leader, follower, followerIllegal],
        SECTION_ORDER,
        false
      );

      expect(groups).toHaveLength(1);
      expect(groups[0].packedGroups).toHaveLength(1);
      expect(groups[0].packedGroups[0]).toEqual({ type: 'single', entry: follower });
    });
  });

  describe('showIllegal=false — packed groups with legal leader', () => {
    it('removes illegal followers from a legal-led pack', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: true });
      const followerLegal = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: true
      });
      const followerIllegal = createMockEntry('f2', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });

      const groups = groupChoicesBySection(
        [leader, followerLegal, followerIllegal],
        SECTION_ORDER,
        false
      );

      expect(groups).toHaveLength(1);
      const packed = groups[0].packedGroups[0];
      expect(packed.type).toBe('packed');
      if (packed.type === 'packed') {
        expect(packed.leader).toBe(leader);
        expect(packed.followers).toEqual([followerLegal]);
      }
    });

    it('keeps legal leader as single when all followers are illegal', () => {
      const leader = createMockEntry('leader', { section: 'move', legal: true });
      const followerIllegal = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });

      const groups = groupChoicesBySection([leader, followerIllegal], SECTION_ORDER, false);

      expect(groups).toHaveLength(1);
      expect(groups[0].packedGroups).toHaveLength(1);
      expect(groups[0].packedGroups[0]).toEqual({ type: 'single', entry: leader });
    });
  });

  describe('showIllegal=false — hasLegalEntries recalculation', () => {
    it('recalculates hasLegalEntries after filtering', () => {
      const legal = createMockEntry('a', { section: 'move', legal: true });
      const illegal = createMockEntry('b', { section: 'move', legal: false });

      const groups = groupChoicesBySection([legal, illegal], SECTION_ORDER, false);

      expect(groups[0].hasLegalEntries).toBe(true);
    });

    it('removes sections with no legal entries (hasLegalEntries would be false)', () => {
      const illegal = createMockEntry('a', { section: 'move', legal: false });

      const groups = groupChoicesBySection([illegal], SECTION_ORDER, false);

      expect(groups).toHaveLength(0);
    });
  });

  describe('showIllegal=false — mixed sections', () => {
    it('filters independently per section', () => {
      const moveLegal = createMockEntry('a', { section: 'move', legal: true });
      const moveIllegal = createMockEntry('b', { section: 'move', legal: false });
      const attackLegal = createMockEntry('c', { section: 'action-attack', legal: true });
      const attackLegal2 = createMockEntry('d', { section: 'action-attack', legal: true });

      const groups = groupChoicesBySection(
        [moveLegal, moveIllegal, attackLegal, attackLegal2],
        SECTION_ORDER,
        false
      );

      expect(groups).toHaveLength(2);
      const moveGroup = groups.find((g) => g.section === 'move')!;
      const attackGroup = groups.find((g) => g.section === 'action-attack')!;
      expect(moveGroup.packedGroups).toHaveLength(1);
      expect(attackGroup.packedGroups).toHaveLength(2);
    });

    it('handles mixed singles and packed groups in same section', () => {
      const single = createMockEntry('s1', { section: 'move', legal: true });
      const singleIllegal = createMockEntry('s2', { section: 'move', legal: false });
      const leader = createMockEntry('leader', { section: 'move', legal: true });
      const follower = createMockEntry('f1', {
        section: 'move',
        packBehind: 'leader',
        legal: false
      });

      const groups = groupChoicesBySection(
        [single, singleIllegal, leader, follower],
        SECTION_ORDER,
        false
      );

      const moveGroup = groups.find((g) => g.section === 'move')!;
      // single, and leader becomes single (follower filtered)
      expect(moveGroup.packedGroups).toHaveLength(2);
      expect(moveGroup.packedGroups[0]).toEqual({ type: 'single', entry: single });
      expect(moveGroup.packedGroups[1]).toEqual({ type: 'single', entry: leader });
    });
  });

  describe('section normalization', () => {
    it('merges undefined and "other" sections into a single group', () => {
      const withOther = createMockEntry('a', { section: 'other' });
      const withoutSection = createMockEntry('b'); // no section → undefined

      const groups = groupChoicesBySection([withOther, withoutSection], SECTION_ORDER);

      const otherGroups = groups.filter((g) => g.section === 'other' || g.section === undefined);
      expect(otherGroups).toHaveLength(1);
      expect(otherGroups[0].packedGroups).toHaveLength(2);
    });
  });
});
