import { describe, it, expect } from 'vitest';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * en-x-tlh is the canary locale for hardcoded text: its values must read as
 * plausible Klingon, never leaked English. The action-economy tray composes
 * pool summaries and row labels from templates, so a leaked English clause
 * reads as mixed-language output to screen-reader users of the locale.
 *
 * sveltekit-i18n interpolates DOUBLE braces ({{param}}); a single-brace
 * {param} renders literally and is a latent bug, so both locales are checked.
 */
const ECONOMY_KEYS = ['toggle', 'tilesLabel', 'summarySeparator', 'poolOpen', 'noneOpen'] as const;

const TRAY_KEYS = ['row'] as const;

const { economy: enEconomy, tray: enTray } = en.play;
const { economy: tlhEconomy, tray: tlhTray } = tlh.play;

/** Matches `{param}` but not `{{param}}` — the sveltekit-i18n footgun. */
const SINGLE_BRACE = /(?<!\{)\{\w+\}(?!\})/;

/** Param placeholders are locale-agnostic, so exclude them from leak checks. */
function withoutParams(value: string): string {
  return value.replace(/\{\{\w+\}\}/g, ' ');
}

describe('action-economy i18n templates', () => {
  it('defines every economy key in both locales', () => {
    for (const key of ECONOMY_KEYS) {
      expect(enEconomy[key], `en play.economy.${key}`).toBeTruthy();
      expect(tlhEconomy[key], `en-x-tlh play.economy.${key}`).toBeTruthy();
    }
    for (const key of TRAY_KEYS) {
      expect(enTray[key], `en play.tray.${key}`).toBeTruthy();
      expect(tlhTray[key], `en-x-tlh play.tray.${key}`).toBeTruthy();
    }
  });

  it('keeps every {{param}} the en template carries', () => {
    for (const key of ECONOMY_KEYS) {
      const enParams = (enEconomy[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      const tlhParams = (tlhEconomy[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      expect(tlhParams, `play.economy.${key}`).toEqual(enParams);
    }
    for (const key of TRAY_KEYS) {
      const enParams = (enTray[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      const tlhParams = (tlhTray[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      expect(tlhParams, `play.tray.${key}`).toEqual(enParams);
    }
  });

  it('uses double-brace interpolation only', () => {
    for (const key of ECONOMY_KEYS) {
      expect(enEconomy[key], `en play.economy.${key}`).not.toMatch(SINGLE_BRACE);
      expect(tlhEconomy[key], `en-x-tlh play.economy.${key}`).not.toMatch(SINGLE_BRACE);
    }
    for (const key of TRAY_KEYS) {
      expect(enTray[key], `en play.tray.${key}`).not.toMatch(SINGLE_BRACE);
      expect(tlhTray[key], `en-x-tlh play.tray.${key}`).not.toMatch(SINGLE_BRACE);
    }
  });

  it('carries the params the tray builds its labels from', () => {
    expect(enEconomy.tilesLabel).toContain('{{summary}}');
    expect(enEconomy.poolOpen).toContain('{{name}}');
    expect(enEconomy.poolOpen).toContain('{{open}}');
    for (const param of ['name', 'open', 'thisTurn', 'spent', 'total']) {
      expect(enTray.row, `play.tray.row {{${param}}}`).toContain(`{{${param}}}`);
    }
  });

  it('leaks no English into the tlh economy copy', () => {
    const english = /\b(open|spent|level|turn|total|show|none|action|breakdown|economy)\b/i;
    for (const key of ECONOMY_KEYS) {
      expect(withoutParams(tlhEconomy[key]), `en-x-tlh play.economy.${key}`).not.toMatch(english);
    }
    for (const key of TRAY_KEYS) {
      expect(withoutParams(tlhTray[key]), `en-x-tlh play.tray.${key}`).not.toMatch(english);
    }
  });
});
