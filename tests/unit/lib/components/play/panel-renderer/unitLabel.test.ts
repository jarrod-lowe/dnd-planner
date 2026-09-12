import { describe, it, expect } from 'vitest';
import { unitLabel } from '$lib/components/play/panel-renderer/unitLabel';

/**
 * `unitLabel` is exercised here against a hand-rolled translate function
 * (never the global `sveltekit-i18n` mock in `tests/setup.ts`) so a
 * regression that skips translation entirely cannot pass by coincidence: the
 * fake's "known" translations are deliberately spelled differently from the
 * raw tokens they translate (`hp` → `HIT_POINTS`, not `HP`) so an assertion
 * on the translated value would fail if the raw literal leaked through
 * untranslated.
 */
const fakeTranslate =
  (known: Record<string, string>) =>
  (key: string): string =>
    known[key] ?? key;

describe('unitLabel', () => {
  it('renders the translated value for a known token', () => {
    const t = fakeTranslate({ 'play.units.hp': 'HIT_POINTS' });
    expect(unitLabel(t, 'hp')).toBe('HIT_POINTS');
  });

  it('falls back to the raw token for an unknown token, never the dotted key', () => {
    // No 'play.units.lb' translation exists: the fake echoes the key back,
    // exactly as sveltekit-i18n does for a missing key.
    const t = fakeTranslate({ 'play.units.hp': 'HIT_POINTS' });
    const result = unitLabel(t, 'lb');
    expect(result).toBe('lb');
    expect(result).not.toBe('play.units.lb');
  });

  it('returns an empty string for an undefined token', () => {
    const t = fakeTranslate({ 'play.units.hp': 'HIT_POINTS' });
    expect(unitLabel(t, undefined)).toBe('');
  });
});
