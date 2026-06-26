import { describe, it, expect } from 'vitest';
import { evaluateSheet, endTurn } from '$lib/rules-engine-v2';
import type { EffectInstance } from '$lib/rules-engine-v2';
import hp from '$lib/rules-engine-v2/rules/hp';
import paladinLevel1 from '$lib/rules-engine-v2/rules/class-paladin-level1';

/**
 * M1 / W4 — effect-model completeness: replace-by-identity (logical `key`),
 * per-fact `stateCombine`, and the `permanent` expiry. These are engine
 * capabilities; the rules that use them (HP modifiers, prepared spells) port in
 * M3, so the tests drive the engine with synthetic effects plus the real `hp`
 * module as an integration check against the hp-modifier-no-stacking oracle.
 */
const untilLongRest = { kind: 'untilLongRest' } as const;
const permanent = { kind: 'permanent' } as const;

describe('v2 replace-by-identity (effect key)', () => {
  it('keyed effects do not stack — newest wins', () => {
    const effects: EffectInstance[] = [
      { id: 'a', key: 'mod', state: { x: 5 }, expiry: untilLongRest },
      { id: 'b', key: 'mod', state: { x: 10 }, expiry: untilLongRest }
    ];
    expect(evaluateSheet([], {}, effects).x).toBe(10);
  });

  it('keyless effects still stack (sum) — the per-turn spend case', () => {
    const effects: EffectInstance[] = [
      { id: 'a', state: { x: 5 }, expiry: untilLongRest },
      { id: 'b', state: { x: 10 }, expiry: untilLongRest }
    ];
    expect(evaluateSheet([], {}, effects).x).toBe(15);
  });

  it('integrates with the hp module: re-setting Max HP modifier replaces, not stacks', () => {
    const modules = [hp, paladinLevel1]; // hp.base.max = 10 (+con.mod 0)
    const set5: EffectInstance = {
      id: 'm1',
      key: 'hp-modifier-max',
      state: { 'hp.modifier.max': 5 },
      expiry: untilLongRest
    };
    expect(evaluateSheet(modules, {}, [set5])['hp.max']).toBe(15);

    // Re-applying (set to 10) while the +5 is still committed: 20, not 25.
    const set10: EffectInstance = { ...set5, id: 'm2', state: { 'hp.modifier.max': 10 } };
    expect(evaluateSheet(modules, {}, [set5, set10])['hp.max']).toBe(20);
  });
});

describe('v2 per-fact stateCombine', () => {
  it('takes the max across different-keyed effects when stateCombine is max', () => {
    const effects: EffectInstance[] = [
      {
        id: 'a',
        key: 'k1',
        state: { floor: 5 },
        stateCombine: { floor: 'max' },
        expiry: untilLongRest
      },
      {
        id: 'b',
        key: 'k2',
        state: { floor: 10 },
        stateCombine: { floor: 'max' },
        expiry: untilLongRest
      }
    ];
    expect(evaluateSheet([], {}, effects).floor).toBe(10);
  });

  it('defaults to sum when stateCombine is absent', () => {
    const effects: EffectInstance[] = [
      { id: 'a', key: 'k1', state: { n: 5 }, expiry: untilLongRest },
      { id: 'b', key: 'k2', state: { n: 10 }, expiry: untilLongRest }
    ];
    expect(evaluateSheet([], {}, effects).n).toBe(15);
  });
});

describe('v2 endTurn — key dedupe + permanent', () => {
  it('commits a single effect per key (newest), so the committed set does not grow', () => {
    const committed: EffectInstance[] = [
      { id: 'old', key: 'hp-modifier-max', state: { 'hp.modifier.max': 5 }, expiry: untilLongRest }
    ];
    const advertised: EffectInstance[] = [
      { id: 'new', key: 'hp-modifier-max', state: { 'hp.modifier.max': 10 }, expiry: untilLongRest }
    ];
    const next = endTurn(committed, advertised);
    expect(next).toHaveLength(1);
    expect(next[0].state).toEqual({ 'hp.modifier.max': 10 });
  });

  it('keeps permanent effects across a long rest; drops untilLongRest', () => {
    const committed: EffectInstance[] = [
      { id: 'prepared', key: 'prep:divine-smite', state: { prepared: 1 }, expiry: permanent },
      { id: 'slot', state: { 'spellcasting.slots.level1.spent': 1 }, expiry: untilLongRest }
    ];
    const next = endTurn(committed, [], { longRest: true });
    expect(next.map((e) => e.id)).toEqual(['prepared']);
  });
});
