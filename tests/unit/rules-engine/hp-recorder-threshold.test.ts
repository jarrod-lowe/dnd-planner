import { describe, it, expect } from 'vitest';
import { evaluatePlan } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * The GENERIC threshold adaptation of the shared HP recorder (the follow-up to
 * the audit that found three hand-written recorder copies): every recorder
 * consults the builder's `damageThresholdGate` on its subject's NATURAL fact
 * name — `hp.damageThreshold` for the player,
 * `companion.steed.damageThreshold` for the steed (the vehicle bakes
 * `${F}.damageThreshold` on its board effect already). No module derives either
 * player/steed fact, so today it is UNSET, reads 0, and never gates — the
 * existing corpus is the zero-behavior-change pin. These are the NEW pins: a
 * THRESHOLD FACT SEEDED as a committed effect (the shape a future stat block
 * bake would take) makes each recorder adapt on its own, with its own module's
 * below-threshold diagnostic — no code change beyond the seeding.
 */

const PLAYER_BELOW = 'rule.dnd-5e-2024.core-events.record-damage.below_threshold';
const STEED_BELOW = 'rule.spell-find-steed.steed-record-damage.below_threshold';

/** A committed effect baking a fact nothing derives (the seeding idiom). */
const flag = (fact: string, value: number): EffectInstance => ({
  id: `flag-${fact}`,
  state: { [fact]: value },
  expiry: { kind: 'permanent' }
});

const plan = (instanceId: string, ruleId: string, amount: number): PlannedRef => ({
  instanceId,
  ruleId,
  selections: { amount }
});

describe('player record-damage adapts to a seeded hp.damageThreshold', () => {
  // hp.max 10 via the genuine input the hp group reads; threshold 5 seeded as a
  // committed effect exactly the way a future stat-block bake would.
  const input = { 'hp.base.max': 10, 'hp.damageThreshold': 5 };

  it('a sub-threshold blow records NOTHING and flags the row with the core-events diagnostic', () => {
    const out = evaluatePlan([coreEvents, hp], input, [plan('d1', 'record-damage', 4)]);
    expect(out.advertised.filter((e) => e.id.includes('effect-hp-damage'))).toHaveLength(0);
    expect(out.facts['hp.current']).toBe(10);
    expect(out.facts['hp.modifier.current'] ?? 0).toBe(0);
    expect(out.planDiagnostics.get('d1')).toEqual([{ code: PLAYER_BELOW, severity: 'error' }]);
  });

  it('a threshold blow records in FULL (the threshold is a floor, not a cap)', () => {
    const out = evaluatePlan([coreEvents, hp], input, [plan('d1', 'record-damage', 5)]);
    expect(out.planDiagnostics.get('d1') ?? []).toEqual([]);
    expect(out.facts['hp.current']).toBe(5);
  });

  it('the gate covers damage only — record-heal never consults the threshold', () => {
    const out = evaluatePlan([coreEvents, hp], input, [
      plan('d1', 'record-damage', 5),
      plan('h1', 'record-heal', 4)
    ]);
    expect(out.facts['hp.current']).toBe(9);
    expect(out.planDiagnostics.get('h1') ?? []).toEqual([]);
  });
});

describe('steed record-damage adapts to a seeded companion.steed.damageThreshold', () => {
  // An L2 celestial steed (25 HP) with the threshold seeded beside the summon.
  const committed = (): EffectInstance[] => [
    steedEffect(2, 0),
    flag('companion.steed.damageThreshold', 10)
  ];

  it('a sub-threshold blow records NOTHING and flags the row with the find-steed diagnostic', () => {
    const out = evaluatePlan([findSteed], {}, [plan('d1', 'steed-record-damage', 9)], committed());
    expect(out.advertised.filter((e) => e.id.includes('effect-steed-hp-damage'))).toHaveLength(0);
    expect(out.facts['companion.steed.hp.current']).toBe(25);
    expect(out.facts['companion.steed.hp.damageRecorded'] ?? 0).toBe(0);
    expect(out.planDiagnostics.get('d1')).toEqual([{ code: STEED_BELOW, severity: 'error' }]);
  });

  it('a threshold blow records the running total like an ungated recorder', () => {
    const out = evaluatePlan([findSteed], {}, [plan('d1', 'steed-record-damage', 10)], committed());
    expect(out.planDiagnostics.get('d1') ?? []).toEqual([]);
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(10);
    expect(out.facts['companion.steed.hp.current']).toBe(15);
  });

  it('a LETHAL blow at/above the threshold still retires the steed (gate first, then lethal)', () => {
    const out = evaluatePlan([findSteed], {}, [plan('d1', 'steed-record-damage', 25)], committed());
    expect(out.planDiagnostics.get('d1') ?? []).toEqual([]);
    expect(out.facts['companion.steed.summoned']).toBe(0);
    expect(out.facts['companion.steed.dismissed']).toBe(1);
  });
});

describe('the threshold diagnostics exist in BOTH locales (tlh is the canary)', () => {
  it('player and steed below-threshold codes resolve in en and en-x-tlh', () => {
    const strings: Record<string, string | undefined> = {
      'en player below_threshold':
        en.rule['dnd-5e-2024']['core-events']['record-damage'].below_threshold,
      'en-x-tlh player below_threshold':
        tlh.rule['dnd-5e-2024']['core-events']['record-damage'].below_threshold,
      'en steed below_threshold':
        en.rule['spell-find-steed']['steed-record-damage'].below_threshold,
      'en-x-tlh steed below_threshold':
        tlh.rule['spell-find-steed']['steed-record-damage'].below_threshold
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});
