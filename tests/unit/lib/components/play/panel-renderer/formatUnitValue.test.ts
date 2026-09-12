import { describe, it, expect } from 'vitest';
import { formatUnitValue } from '$lib/components/play/panel-renderer/unitLabel';

/**
 * `formatUnitValue` is exercised here against a hand-rolled translate
 * function that actually performs `{{value}}` interpolation (never the
 * global `sveltekit-i18n` mock in `tests/setup.ts`, and never a mock that
 * just echoes its key) — a regression that skips substitution, or that
 * leaks the raw token/dotted key, must fail these assertions rather than
 * pass by coincidence.
 */
const fakeTranslate =
  (known: Record<string, string>) =>
  (key: string, params?: Record<string, string>): string => {
    const template = known[key] ?? key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (text, [k, v]) => text.replaceAll(`{{${k}}}`, v),
      template
    );
  };

describe('formatUnitValue', () => {
  it('substitutes the value into the default pattern (spaced English form)', () => {
    const t = fakeTranslate({ 'play.units.hp': '{{value}} HIT_POINTS' });
    expect(formatUnitValue(t, 'hp', 5)).toBe('5 HIT_POINTS');
  });

  it('keeps the English compact form closed up, e.g. a dice-line distance', () => {
    const t = fakeTranslate({
      'play.units.ft': '{{value}} ft',
      'play.units.compact.ft': '{{value}}ft'
    });
    expect(formatUnitValue(t, 'ft', 5, { compact: true })).toBe('5ft');
  });

  it('spaces the compact form for a locale where the unit is a standalone word', () => {
    // en-x-tlh's `ft` -> `qam` is a real standalone word elsewhere in that
    // locale, so unlike English it authors the SAME (spaced) pattern under
    // both the default and compact keys — this is the shape of the actual
    // fix for the reported "5qam" defect.
    const t = fakeTranslate({
      'play.units.ft': '{{value}} qam',
      'play.units.compact.ft': '{{value}} qam'
    });
    expect(formatUnitValue(t, 'ft', 5, { compact: true })).toBe('5 qam');
    expect(formatUnitValue(t, 'ft', 5, { compact: true })).not.toBe('5qam');
  });

  it('falls back to the default pattern when no compact override is authored', () => {
    const t = fakeTranslate({ 'play.units.ft': '{{value}} ft' });
    expect(formatUnitValue(t, 'ft', 5, { compact: true })).toBe('5 ft');
  });

  it('falls back to a plain concatenation for an unknown token, never the dotted key', () => {
    const t = fakeTranslate({ 'play.units.hp': '{{value}} HIT_POINTS' });
    const result = formatUnitValue(t, 'lb', 3);
    expect(result).toBe('3 lb');
    expect(result).not.toBe('play.units.lb');
    expect(result).not.toContain('{{value}}');
  });

  it('returns the bare value when no token is given', () => {
    const t = fakeTranslate({ 'play.units.hp': '{{value}} HIT_POINTS' });
    expect(formatUnitValue(t, undefined, 7)).toBe('7');
  });
});
