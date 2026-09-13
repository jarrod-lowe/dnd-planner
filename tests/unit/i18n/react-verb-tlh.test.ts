import { describe, it, expect } from 'vitest';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * en-x-tlh is the canary locale for hardcoded text: its values must read as
 * plausible Klingon, never leaked English. The REACT verb rail labels the
 * reaction bucket in the add-row picker, so a leaked English verb or bucket
 * heading renders mixed-language output. Casing is CSS (`text-transform`), so
 * tlh values use normal casing — an all-caps value is a leaked copy-paste.
 */
const BUCKET_KEYS = ['default', 'weapons', 'brawl', 'ward', 'steed'] as const;

describe('REACT verb i18n', () => {
  it('defines the verb label in both locales', () => {
    expect(en.play.verbs.REACT, 'en play.verbs.REACT').toBeTruthy();
    expect(tlh.play.verbs.REACT, 'en-x-tlh play.verbs.REACT').toBeTruthy();
  });

  it('defines every REACT bucket label in both locales', () => {
    for (const key of BUCKET_KEYS) {
      expect(en.play.verbBuckets.REACT[key], `en play.verbBuckets.REACT.${key}`).toBeTruthy();
      expect(
        tlh.play.verbBuckets.REACT[key],
        `en-x-tlh play.verbBuckets.REACT.${key}`
      ).toBeTruthy();
    }
  });

  it('reads as Klingon, not leaked English', () => {
    const pairs: Array<[string, string, string]> = [
      [tlh.play.verbs.REACT, en.play.verbs.REACT, 'play.verbs.REACT'],
      ...BUCKET_KEYS.map(
        (k) =>
          [
            tlh.play.verbBuckets.REACT[k],
            en.play.verbBuckets.REACT[k],
            `play.verbBuckets.REACT.${k}`
          ] as [string, string, string]
      )
    ];
    for (const [tlhValue, enValue, key] of pairs) {
      expect(
        tlhValue?.toLowerCase(),
        `en-x-tlh ${key} leaked the English label '${enValue}'`
      ).not.toBe(enValue?.toLowerCase());
    }
  });

  it('uses normal casing in tlh (casing is CSS)', () => {
    const values = [tlh.play.verbs.REACT, ...BUCKET_KEYS.map((k) => tlh.play.verbBuckets.REACT[k])];
    for (const value of values) {
      expect(value, `en-x-tlh REACT label '${value}' is all-caps English`).not.toBe(
        value.toUpperCase()
      );
    }
  });

  it('leaves no orphan DEFEND bucket behind in either locale', () => {
    // The weapon/brawl reaction offers moved to REACT; DEFEND keeps only the
    // evade and ward non-reactions. The old buckets must be gone from BOTH
    // locale files, or the parity story passes while orphan strings ship.
    // (The JSON module's inferred type already omits the keys — the cast keeps
    // this a runtime tripwire against re-introducing them.)
    const enDefend = en.play.verbBuckets.DEFEND as Record<string, string | undefined>;
    const tlhDefend = tlh.play.verbBuckets.DEFEND as Record<string, string | undefined>;
    for (const key of ['weapons', 'brawl'] as const) {
      expect(enDefend[key], `en play.verbBuckets.DEFEND.${key}`).toBeUndefined();
      expect(tlhDefend[key], `en-x-tlh play.verbBuckets.DEFEND.${key}`).toBeUndefined();
    }
  });
});
