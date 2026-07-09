import { describe, it, expect } from 'vitest';
import { evaluateSheet } from '$lib/rules-engine';
import ac from '$lib/rules-engine/rules/ac';

/**
 * Armor Class dex handling. The dex bonus is capped differently by armor category:
 *  - none / light: full Dex modifier (including a negative one);
 *  - medium (`ac.dexCap` +2): the POSITIVE side is capped, a negative Dex still
 *    lowers AC;
 *  - heavy (`ac.dexIgnored`): Dex is ignored entirely — even a negative modifier
 *    does not lower AC.
 * The armor facts are injected directly (armor effects, not derived here).
 */
describe('ac — armor class dex handling', () => {
  const facts = (input: Record<string, number>) => evaluateSheet([ac], input);

  it('unarmored: base 10 + full Dex modifier, including negative', () => {
    expect(facts({ 'dex.modifier': 3 })['ac.value']).toBe(13);
    expect(facts({ 'dex.modifier': -1 })['ac.value']).toBe(9);
  });

  it('light armor (no cap): armor base + full Dex', () => {
    expect(facts({ 'ac.armorBase': 11, 'dex.modifier': 3 })['ac.value']).toBe(14);
  });

  it('medium armor (dexCap +2): caps the positive Dex but keeps a negative one', () => {
    expect(facts({ 'ac.armorBase': 14, 'ac.dexCap': 2, 'dex.modifier': 3 })['ac.dexBonus']).toBe(2);
    expect(facts({ 'ac.armorBase': 14, 'ac.dexCap': 2, 'dex.modifier': -1 })['ac.dexBonus']).toBe(
      -1
    );
  });

  it('heavy armor (dexIgnored): ignores Dex entirely, even a negative modifier', () => {
    // Regression: a Dex 8 (modifier -1) splint wearer is AC 17, not 16.
    const dex8 = facts({ 'ac.armorBase': 17, 'ac.dexIgnored': 1, 'dex.modifier': -1 });
    expect(dex8['ac.dexBonus']).toBe(0);
    expect(dex8['ac.value']).toBe(17);
    const dex14 = facts({ 'ac.armorBase': 17, 'ac.dexIgnored': 1, 'dex.modifier': 2 });
    expect(dex14['ac.dexBonus']).toBe(0);
    expect(dex14['ac.value']).toBe(17);
  });
});
