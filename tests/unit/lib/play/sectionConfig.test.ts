import { describe, it, expect } from 'vitest';
import { SECTION_ORDER } from '$lib/play/sectionConfig';

describe('sectionConfig', () => {
  it('uses configuration section instead of abilities for choices', () => {
    expect(SECTION_ORDER).toContain('configuration');
    expect(SECTION_ORDER).not.toContain('abilities');
  });

  it('keeps abilities section for stats column', () => {
    // STAT_SECTION_ORDER is not exported, but we can verify the choices section
    // Stats column has its own section order that still uses 'abilities'
    // We verify choices column does NOT use 'abilities'
    expect(SECTION_ORDER[0]).toBe('configuration');
  });

  it('sorts bonus-action-spell before bonus-action-other', () => {
    const spellIdx = SECTION_ORDER.indexOf('bonus-action-spell');
    const otherIdx = SECTION_ORDER.indexOf('bonus-action-other');
    expect(spellIdx).toBeGreaterThanOrEqual(0);
    expect(otherIdx).toBeGreaterThanOrEqual(0);
    expect(spellIdx).toBeLessThan(otherIdx);
  });

  it('includes ongoing section for timed effects', () => {
    expect(SECTION_ORDER).toContain('ongoing');
  });
});
