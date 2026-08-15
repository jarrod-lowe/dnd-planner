import { describe, it, expect } from 'vitest';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * en-x-tlh is the canary locale for hardcoded text: its values must read as
 * plausible Klingon, never leaked English. The spell-slot tray composes counts
 * into aria templates, so a leaked English clause reads as mixed-language
 * output to screen-reader users of the locale.
 *
 * sveltekit-i18n interpolates DOUBLE braces ({{param}}); a single-brace
 * {param} renders literally and is a latent bug, so both locales are checked.
 */
const SLOT_KEYS = [
  'toggle',
  'title',
  'tilesLabel',
  'levelSummary',
  'levelName',
  'summarySeparator',
  'noneOpen',
  'levelRow',
  'levelTile',
  'legendTitle'
] as const;

/**
 * Keys the tray used to carry and no longer does. They must be gone from BOTH
 * locale files, or the parity test passes while an orphan string ships.
 */
const REMOVED_SLOT_KEYS = ['legendHint'] as const;

const LEGEND_KEYS = ['open', 'thisTurn', 'spent'] as const;

const { legend: enLegend, ...enSlotsRest } = en.play.slots;
const { legend: tlhLegend, ...tlhSlotsRest } = tlh.play.slots;
const enSlots: Record<string, string> = enSlotsRest;
const tlhSlots: Record<string, string> = tlhSlotsRest;

/** Matches `{param}` but not `{{param}}` — the sveltekit-i18n footgun. */
const SINGLE_BRACE = /(?<!\{)\{\w+\}(?!\})/;

/** Param placeholders are locale-agnostic, so exclude them from leak checks. */
function withoutParams(value: string): string {
  return value.replace(/\{\{\w+\}\}/g, ' ');
}

describe('spell-slot i18n templates', () => {
  it('defines every tray key in both locales', () => {
    for (const key of SLOT_KEYS) {
      expect(enSlots[key], `en play.slots.${key}`).toBeTruthy();
      expect(tlhSlots[key], `en-x-tlh play.slots.${key}`).toBeTruthy();
    }
    for (const key of LEGEND_KEYS) {
      expect(enLegend[key], `en play.slots.legend.${key}`).toBeTruthy();
      expect(tlhLegend[key], `en-x-tlh play.slots.legend.${key}`).toBeTruthy();
    }
  });

  it('leaves no orphan key behind in either locale', () => {
    for (const key of REMOVED_SLOT_KEYS) {
      expect(Object.keys(enSlots), `en play.slots.${key}`).not.toContain(key);
      expect(Object.keys(tlhSlots), `en-x-tlh play.slots.${key}`).not.toContain(key);
    }
  });

  it('keeps every {{param}} the en template carries', () => {
    for (const key of SLOT_KEYS) {
      const enParams = (enSlots[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      const tlhParams = (tlhSlots[key].match(/\{\{\w+\}\}/g) ?? []).sort();
      expect(tlhParams, `play.slots.${key}`).toEqual(enParams);
    }
  });

  it('uses double-brace interpolation only', () => {
    for (const key of SLOT_KEYS) {
      expect(enSlots[key], `en play.slots.${key}`).not.toMatch(SINGLE_BRACE);
      expect(tlhSlots[key], `en-x-tlh play.slots.${key}`).not.toMatch(SINGLE_BRACE);
    }
  });

  it('carries the aria params the tray builds its labels from', () => {
    expect(enSlots.tilesLabel).toContain('{{summary}}');
    expect(enSlots.levelSummary).toContain('{{open}}');
    expect(enSlots.levelSummary).toContain('{{level}}');
    expect(enSlots.levelTile).toContain('{{level}}');
    for (const param of ['level', 'open', 'thisTurn', 'spent', 'total']) {
      expect(enSlots.levelRow, `play.slots.levelRow {{${param}}}`).toContain(`{{${param}}}`);
    }
  });

  it('leaks no English into the tlh tray copy', () => {
    const english = /\b(open|spent|slot|slots|level|turn|total|show|key)\b/i;
    for (const key of SLOT_KEYS) {
      expect(withoutParams(tlhSlots[key]), `en-x-tlh play.slots.${key}`).not.toMatch(english);
    }
    for (const key of LEGEND_KEYS) {
      expect(tlhLegend[key], `en-x-tlh play.slots.legend.${key}`).not.toMatch(english);
    }
    expect(tlh.play.stats.spellSlots).not.toMatch(english);
    expect(tlh.play.ledger.short.spellSlots).not.toMatch(english);
    expect(tlh.play.ledger.short.spellcasting).not.toMatch(/\b(magic|weave)\b/i);
  });
});
