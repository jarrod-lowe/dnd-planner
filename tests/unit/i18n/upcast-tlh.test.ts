import { describe, it, expect } from 'vitest';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * en-x-tlh is the canary locale for hardcoded text: its values must read as
 * plausible Klingon, never leaked English. The upcast tag builds its aria
 * label from this template, so a leaked English clause reads as
 * mixed-language output to screen-reader users of the locale.
 *
 * sveltekit-i18n interpolates DOUBLE braces ({{param}}); a single-brace
 * {param} renders literally and is a latent bug, so both locales are checked.
 */
const enCostTags = en.play.costTags as Record<string, string>;
const tlhCostTags = tlh.play.costTags as Record<string, string>;
const KEY = 'upcastAria';

describe('upcast tag i18n', () => {
  it('defines the aria key in both locales', () => {
    expect(typeof enCostTags[KEY]).toBe('string');
    expect(typeof tlhCostTags[KEY]).toBe('string');
  });

  it('keeps both {{param}} placeholders in each locale', () => {
    for (const value of [enCostTags[KEY], tlhCostTags[KEY]]) {
      expect(value).toContain('{{level}}');
      expect(value).toContain('{{base}}');
    }
  });

  it('uses double-brace interpolation only', () => {
    for (const value of [enCostTags[KEY], tlhCostTags[KEY]]) {
      // This regex matches single-brace interpolation like {param}
      // but NOT double-brace like {{param}}, using negative lookaheads
      expect(value).not.toMatch(/\{(?!\{)[^}]*\}(?!\})/);
    }
  });

  it('leaks no English into the tlh value', () => {
    expect(tlhCostTags[KEY]).not.toMatch(/casting/i);
  });
});
