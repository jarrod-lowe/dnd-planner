import { describe, it, expect } from 'vitest';
import { rollTypeKey } from '$lib/components/play/panel-renderer/rollType';

describe('rollTypeKey', () => {
  it('maps each authored purpose to its rollType label key', () => {
    expect(rollTypeKey('to-hit')).toBe('play.toast.rollType.to-hit');
    expect(rollTypeKey('damage')).toBe('play.toast.rollType.damage');
    expect(rollTypeKey('healing')).toBe('play.toast.rollType.healing');
    expect(rollTypeKey('save')).toBe('play.toast.rollType.save');
    expect(rollTypeKey('check')).toBe('play.toast.rollType.check');
  });

  it('falls back to inferring from die shape when no purpose is authored', () => {
    expect(rollTypeKey(undefined, { sides: 20 })).toBe('play.toast.rollType.check');
    expect(rollTypeKey(undefined, { sides: 8, damageType: 'fire' })).toBe(
      'play.toast.rollType.damage'
    );
    expect(rollTypeKey(undefined, { sides: 8 })).toBe('play.toast.rollType.roll');
  });

  it('prefers an authored purpose over the shape fallback', () => {
    // A to-hit attack roll is a d20 — without purpose it would infer "check",
    // but the authored purpose must win.
    expect(rollTypeKey('to-hit', { sides: 20 })).toBe('play.toast.rollType.to-hit');
  });
});
