import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EffectInstance, EngineInput, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import tormentor, { tormentorAcquireEffect } from '$lib/rules-engine/rules/vehicle-tormentor';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Threshold model v2 (user correction 2026-10-26): sub-threshold damage is
 * LEGAL to attempt. The GM TELLS the player an amount and the player records
 * it — the app is what knows it was under the limit, so the feedback must
 * arrive AFTER the record, never as a prior-knowledge gate. The shared HP
 * recorder therefore:
 *
 * - carries a [Use Threshold | Ignore Threshold] segmented SECONDARY control on
 *   the damage offer, gated `enabled.condition` on the subject's threshold fact
 *   > 0 (PanelRenderer hides a false-gated control — no threshold fact, exactly
 *   the old look);
 * - Use mode (default) + sub-threshold: records NOTHING and returns ONE
 *   `'notice'` diagnostic, which the plan fold keys to THAT planned row alone
 *   (`planDiagnostics` is per-instance) — never an error, never an
 *   illegality, never a panel annotation (a per-commit bounce is not a
 *   standing panel truth). With TWO damage rows planned the note rides the
 *   bounced row only;
 * - Ignore mode + any amount: records the RAW amount in full (the GM
 *   correction, "last round should have taken 1 more") — no bounce, no note;
 * - Use mode + threshold amount: records in full as ever (a floor, not a cap).
 *
 * Every subject rides the one factory, so the player (threshold seeded as a
 * committed effect, the shape a future stat-block bake would take) and the
 * steed (seeded beside the summon) adapt exactly like the vehicle, whose board
 * effect has always baked the fact.
 */

const PLAYER_BELOW = 'rule.dnd-5e-2024.core-events.record-damage.below_threshold';
const STEED_BELOW = 'rule.spell-find-steed.steed-record-damage.below_threshold';
const VEHICLE_BELOW = 'rule.tormentor.record-damage.below_threshold';

/** The shared segmented control descriptor every damage offer carries. */
const THRESHOLD_CONTROL = (fact: string) => ({
  type: 'segmented',
  var: 'thresholdMode',
  prefix: 'planner.record.threshold.prefix',
  options: [
    { value: 0, label: 'planner.record.threshold.use' },
    { value: 1, label: 'planner.record.threshold.ignore' }
  ],
  enabled: { condition: { fact, operator: 'greaterThan', value: 0 } }
});

/** A committed effect baking a fact nothing derives (the seeding idiom). */
const flag = (fact: string, value: number): EffectInstance => ({
  id: `flag-${fact}`,
  state: { [fact]: value },
  expiry: { kind: 'permanent' }
});

const plan = (
  instanceId: string,
  ruleId: string,
  selections: Record<string, number>
): PlannedRef => ({
  instanceId,
  ruleId,
  selections
});

describe('player record-damage adapts to a seeded hp.damageThreshold', () => {
  // hp.max 10 via the genuine input the hp group reads; threshold 5 seeded as a
  // committed effect exactly the way a future stat-block bake would.
  const input = { 'hp.base.max': 10, 'hp.damageThreshold': 5 };

  it('a sub-threshold Use-mode blow records NOTHING and advertises NOTHING — the feedback is a per-row notice diagnostic', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [plan('d1', 'record-damage', { amount: 4 })]
    });
    expect(out.effects).toHaveLength(0);
    expect(out.facts['hp.current']).toBe(10);
    expect(out.facts['hp.modifier.current'] ?? 0).toBe(0);
    // The note: ONE informational notice on THIS row — never an error, and the
    // row (and the plan) stay legal.
    expect(out.planDiagnostics['d1']).toEqual([{ code: PLAYER_BELOW, severity: 'notice' }]);
    expect(out.plannedOffers['d1']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
    // No annotation exists — a per-commit bounce is not a standing panel truth.
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
  });

  it('THE USER REPRO: with a landing row and a bounced row planned, the note rides the bounced row ONLY', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [
        plan('d1', 'record-damage', { amount: 5 }),
        plan('d2', 'record-damage', { amount: 4 })
      ]
    });
    // The landing row records in full; the bounced row adds nothing.
    expect(out.facts['hp.current']).toBe(5);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.planDiagnostics['d2']).toEqual([{ code: PLAYER_BELOW, severity: 'notice' }]);
    expect(out.plannedOffers['d1']!.legal).toBe(true);
    expect(out.plannedOffers['d2']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
  });

  it('Ignore Threshold records the RAW amount in full (the GM-correction mode)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [plan('d1', 'record-damage', { amount: 4, thresholdMode: 1 })]
    });
    expect(out.facts['hp.current']).toBe(6);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
  });

  it('a threshold blow records in FULL in Use mode (the threshold is a floor, not a cap)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [plan('d1', 'record-damage', { amount: 5 })]
    });
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.facts['hp.current']).toBe(5);
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
  });

  it('the gate covers damage only — record-heal never consults the threshold', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [
        plan('d1', 'record-damage', { amount: 5 }),
        plan('h1', 'record-heal', { amount: 4 })
      ]
    });
    expect(out.facts['hp.current']).toBe(9);
    expect(out.planDiagnostics['h1'] ?? []).toEqual([]);
  });

  it('an UNSEEDED threshold never gates and never notes (zero behavior change)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: { 'hp.base.max': 10 },
      planned: [plan('d1', 'record-damage', { amount: 4 })]
    });
    expect(out.facts['hp.current']).toBe(6);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
  });
});

describe('steed record-damage adapts to a seeded companion.steed.damageThreshold', () => {
  // An L2 celestial steed (25 HP) with the threshold seeded beside the summon.
  const committed = (): EffectInstance[] => [
    steedEffect(2, 0),
    flag('companion.steed.damageThreshold', 10)
  ];

  it('a sub-threshold Use-mode blow records NOTHING — the note is the steed-worded notice on the row', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 9 })]
    });
    expect(out.effects).toHaveLength(0);
    expect(out.facts['companion.steed.hp.current']).toBe(25);
    expect(out.facts['companion.steed.hp.damageRecorded'] ?? 0).toBe(0);
    expect(out.planDiagnostics['d1']).toEqual([{ code: STEED_BELOW, severity: 'notice' }]);
    expect(out.plannedOffers['d1']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
    expect(out.annotations.some((a) => a.key === STEED_BELOW)).toBe(false);
  });

  it('two rows: the note rides the bounced row only', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [
        plan('d1', 'steed-record-damage', { amount: 10 }),
        plan('d2', 'steed-record-damage', { amount: 9 })
      ]
    });
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(10);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.planDiagnostics['d2']).toEqual([{ code: STEED_BELOW, severity: 'notice' }]);
    expect(out.status.legal).toBe(true);
  });

  it('Ignore Threshold records the RAW amount in full', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 9, thresholdMode: 1 })]
    });
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(9);
    expect(out.facts['companion.steed.hp.current']).toBe(16);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });

  it('a threshold blow records the running total like an ungated recorder', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 10 })]
    });
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(10);
    expect(out.facts['companion.steed.hp.current']).toBe(15);
  });

  it('a LETHAL blow at/above the threshold still retires the steed (bounce only below it)', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 25 })]
    });
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.facts['companion.steed.summoned']).toBe(0);
    expect(out.facts['companion.steed.dismissed']).toBe(1);
  });
});

describe('the vehicle bounces on its baked threshold (the first real caller)', () => {
  const boarded = (): EngineInput => ({
    modules: [tormentor],
    committed: [tormentorAcquireEffect()]
  });

  it('sub-threshold Use-mode: no record, no effect — the vehicle-worded notice on the row', () => {
    const out = evaluate({
      ...boarded(),
      planned: [plan('d1', 'record-tormentor-damage', { amount: 9 })]
    });
    expect(out.effects).toHaveLength(0);
    expect(out.facts['companion.tormentor.hp.current']).toBe(60);
    expect(out.planDiagnostics['d1']).toEqual([{ code: VEHICLE_BELOW, severity: 'notice' }]);
    expect(out.plannedOffers['d1']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
    expect(out.annotations.some((a) => a.key === VEHICLE_BELOW)).toBe(false);
  });

  it('Ignore Threshold records the RAW amount in full', () => {
    const out = evaluate({
      ...boarded(),
      planned: [plan('d1', 'record-tormentor-damage', { amount: 9, thresholdMode: 1 })]
    });
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(9);
    expect(out.facts['companion.tormentor.hp.current']).toBe(51);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.annotations.some((a) => a.key === VEHICLE_BELOW)).toBe(false);
  });
});

describe('the segmented control is generic factory data on every damage offer', () => {
  it("player: gated on the player's threshold fact; the heal offer carries none", () => {
    const offers = coreEvents.offer!({ selections: {} });
    const damage = offers.find((o) => o.id === 'record-damage')!;
    expect((damage.ui as Record<string, unknown>).secondaryControl).toEqual(
      THRESHOLD_CONTROL('hp.damageThreshold')
    );
    expect(damage.vars).toEqual({
      amount: { capture: true, default: { number: 0 } },
      thresholdMode: { capture: true, default: { number: 0 } }
    });
    const heal = offers.find((o) => o.id === 'record-heal')!;
    expect((heal.ui as Record<string, unknown>).secondaryControl).toBeUndefined();
    expect(heal.vars).toEqual({ amount: { capture: true, default: { number: 0 } } });
  });

  it("steed: gated on the steed's threshold fact", () => {
    const damage = findSteed.offer!({ selections: {} }).find(
      (o) => o.id === 'steed-record-damage'
    )!;
    expect((damage.ui as Record<string, unknown>).secondaryControl).toEqual(
      THRESHOLD_CONTROL('companion.steed.damageThreshold')
    );
  });

  it("vehicle: gated on the vehicle's baked threshold fact", () => {
    const damage = tormentor.offer!({ selections: {} }).find(
      (o) => o.id === 'record-tormentor-damage'
    )!;
    expect((damage.ui as Record<string, unknown>).secondaryControl).toEqual(
      THRESHOLD_CONTROL('companion.tormentor.damageThreshold')
    );
  });
});

describe('the threshold strings exist in BOTH locales (tlh is the canary)', () => {
  it('the three below-threshold notes resolve in en and en-x-tlh', () => {
    const strings: Record<string, string | undefined> = {
      'en player below_threshold':
        en.rule['dnd-5e-2024']['core-events']['record-damage'].below_threshold,
      'en-x-tlh player below_threshold':
        tlh.rule['dnd-5e-2024']['core-events']['record-damage'].below_threshold,
      'en steed below_threshold':
        en.rule['spell-find-steed']['steed-record-damage'].below_threshold,
      'en-x-tlh steed below_threshold':
        tlh.rule['spell-find-steed']['steed-record-damage'].below_threshold,
      'en vehicle below_threshold': en.rule.tormentor['record-damage'].below_threshold,
      'en-x-tlh vehicle below_threshold': tlh.rule.tormentor['record-damage'].below_threshold
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });

  it('the shared segmented control labels resolve in en and en-x-tlh', () => {
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      const threshold = (
        dict.planner as unknown as { record: { threshold?: Record<string, string> } }
      ).record.threshold;
      expect(threshold?.prefix, `${locale} prefix`).toEqual(expect.any(String));
      expect(threshold?.use, `${locale} use`).toEqual(expect.any(String));
      expect(threshold?.ignore, `${locale} ignore`).toEqual(expect.any(String));
    }
  });
});
