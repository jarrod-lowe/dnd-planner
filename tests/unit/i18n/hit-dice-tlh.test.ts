import { describe, it, expect } from 'vitest';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * en-x-tlh is the canary locale for hardcoded text: its values must read as
 * plausible Klingon, never leaked English. The hit-dice labels compose counts
 * with connectors ("4 of 6"); tlh renders "of" as "vo'" (play.stats.valueLabel
 * already does). A leaked English connector reads as mixed-language output to
 * screen-reader users of the locale.
 */
const LABEL_KEYS = [
  'groupLabel',
  'poolLabel',
  'slotLabel',
  'slotSpentLabel',
  'slotRolledLabel',
  'slotSpentRolledLabel'
] as const;

describe('en-x-tlh hit-dice labels', () => {
  it('leaks no English connector "of"', () => {
    for (const key of LABEL_KEYS) {
      expect(tlh.play.hitDice[key], `play.hitDice.${key}`).not.toMatch(/\bof\b/i);
    }
  });

  it('keeps every {{param}} the en template carries', () => {
    for (const key of LABEL_KEYS) {
      const enParams = (en.play.hitDice[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      const tlhParams = (tlh.play.hitDice[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      expect(tlhParams, `play.hitDice.${key}`).toEqual(enParams);
    }
  });
});
