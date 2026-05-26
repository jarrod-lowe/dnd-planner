import { describe, it, expect } from 'vitest';
import enCommon from '$lib/i18n/en/common.json';

/**
 * Tests that the STAT and PROFICIENCY verbs have the required sub-bucket i18n keys
 * for the reorganized intent UI.
 */
describe('verb sub-bucket i18n keys', () => {
  const play = (enCommon as Record<string, unknown>).play as Record<string, unknown>;
  const verbBuckets = play.verbBuckets as Record<string, unknown>;

  describe('STAT', () => {
    const stat = verbBuckets.STAT as Record<string, unknown>;

    it('has "set" sub-bucket', () => {
      expect(stat['set']).toBeDefined();
    });

    it('has "increase" sub-bucket', () => {
      expect(stat['increase']).toBeDefined();
    });

    it('does not have "proficiencySave" sub-bucket', () => {
      expect(stat['proficiencySave']).toBeUndefined();
    });

    it('does not have "proficiencySkill" sub-bucket', () => {
      expect(stat['proficiencySkill']).toBeUndefined();
    });
  });

  describe('PROFICIENCY', () => {
    const proficiency = verbBuckets.PROFICIENCY as Record<string, unknown>;

    it('has "save" sub-bucket', () => {
      expect(proficiency['save']).toBeDefined();
    });

    it('has "skill" sub-bucket', () => {
      expect(proficiency['skill']).toBeDefined();
    });
  });

  describe('HEALTH', () => {
    const health = verbBuckets.HEALTH as Record<string, unknown>;

    it('has "hp" sub-bucket', () => {
      expect(health['hp']).toBeDefined();
    });
  });

  describe('DAMAGE and HEAL removed', () => {
    it('does not have DAMAGE verb bucket', () => {
      expect(verbBuckets['DAMAGE']).toBeUndefined();
    });

    it('does not have HEAL verb bucket', () => {
      expect(verbBuckets['HEAL']).toBeUndefined();
    });

    it('does not have DAMAGE verb label', () => {
      expect((play['verbs'] as Record<string, unknown>)['DAMAGE']).toBeUndefined();
    });

    it('does not have HEAL verb label', () => {
      expect((play['verbs'] as Record<string, unknown>)['HEAL']).toBeUndefined();
    });

    it('has HEALTH verb label', () => {
      expect((play['verbs'] as Record<string, unknown>)['HEALTH']).toBeDefined();
    });
  });
});
