import { describe, it, expect } from 'vitest';
import { evaluate, endTurn } from '$lib/rules-engine';
import type { EffectInstance, EngineInput, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import tormentor, { tormentorBoardEffect } from '$lib/rules-engine/rules/vehicle-tormentor';
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
 * - Use mode (default) + sub-threshold: records NOTHING and commits ONE hidden
 *   keyed marker effect, which the recorder's annotate contribution reads out
 *   of the committed list to emit the caller-worded INFORMATIONAL annotation on
 *   the damage panel — never a planErrors diagnostic, never an illegality;
 * - Ignore mode + any amount: records the RAW amount in full (the GM
 *   correction, "last round should have taken 1 more") — no bounce, no marker;
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

/** The one marker effect a sub-threshold Use-mode blow advertised, or undefined. */
function markerOf(
  out: { effects: EffectInstance[] },
  effectId: string
): EffectInstance | undefined {
  return out.effects.find((e) => e.id.endsWith(`#${effectId}`));
}

describe('player record-damage adapts to a seeded hp.damageThreshold', () => {
  // hp.max 10 via the genuine input the hp group reads; threshold 5 seeded as a
  // committed effect exactly the way a future stat-block bake would.
  const input = { 'hp.base.max': 10, 'hp.damageThreshold': 5 };

  it('a sub-threshold Use-mode blow records NOTHING — and the feedback is the panel ANNOTATION, never a diagnostic', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [plan('d1', 'record-damage', { amount: 4 })]
    });
    expect(out.effects.filter((e) => e.id.includes('effect-hp-damage'))).toHaveLength(0);
    expect(out.facts['hp.current']).toBe(10);
    expect(out.facts['hp.modifier.current'] ?? 0).toBe(0);
    // Legal to attempt: the row carries NO diagnostic (the error model is gone).
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    // …and the bounce commits the hidden keyed marker the annotate pass reads.
    const marker = markerOf(out, 'effect-hp-bounce');
    expect(marker).toBeDefined();
    expect(marker!.key).toBe('effect-hp-bounce');
    expect(marker!.expiry).toEqual({ kind: 'untilLongRest' });
    // Hidden and stateless: the marker's whole meaning is the annotation.
    expect(marker!.state).toBeUndefined();
    expect(marker!.display).toBeUndefined();
    // The ANNOTATION on the damage panel — informational (no rider, no action).
    const annotation = out.annotations.find((a) => a.key === PLAYER_BELOW);
    expect(annotation).toBeDefined();
    expect(annotation!.targets).toEqual(['damage.any']);
    expect(annotation!.rider).toBeUndefined();
    expect(annotation!.addsToPlan).toBeUndefined();
  });

  it('Ignore Threshold records the RAW amount in full (the GM-correction mode)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: input,
      planned: [plan('d1', 'record-damage', { amount: 4, thresholdMode: 1 })]
    });
    expect(out.facts['hp.current']).toBe(6);
    expect(markerOf(out, 'effect-hp-bounce')).toBeUndefined();
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
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

  it('an UNSEEDED threshold never gates and never annotates (zero behavior change)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: { 'hp.base.max': 10 },
      planned: [plan('d1', 'record-damage', { amount: 4 })]
    });
    expect(out.facts['hp.current']).toBe(6);
    expect(markerOf(out, 'effect-hp-bounce')).toBeUndefined();
    expect(out.annotations.some((a) => a.key === PLAYER_BELOW)).toBe(false);
  });
});

describe('steed record-damage adapts to a seeded companion.steed.damageThreshold', () => {
  // An L2 celestial steed (25 HP) with the threshold seeded beside the summon.
  const committed = (): EffectInstance[] => [
    steedEffect(2, 0),
    flag('companion.steed.damageThreshold', 10)
  ];

  it('a sub-threshold Use-mode blow records NOTHING and annotates the STEED damage panel', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 9 })]
    });
    expect(out.effects.filter((e) => e.id.includes('effect-steed-hp-damage'))).toHaveLength(0);
    expect(out.facts['companion.steed.hp.current']).toBe(25);
    expect(out.facts['companion.steed.hp.damageRecorded'] ?? 0).toBe(0);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(markerOf(out, 'effect-steed-hp-bounce')).toBeDefined();
    // The steed-scoped label (the .companion convention), so the annotation can
    // never leak onto another subject's damage panel.
    const annotation = out.annotations.find((a) => a.key === STEED_BELOW);
    expect(annotation).toBeDefined();
    expect(annotation!.targets).toEqual(['damage.steed.companion']);
  });

  it('Ignore Threshold records the RAW amount in full', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: committed(),
      planned: [plan('d1', 'steed-record-damage', { amount: 9, thresholdMode: 1 })]
    });
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(9);
    expect(out.facts['companion.steed.hp.current']).toBe(16);
    expect(markerOf(out, 'effect-steed-hp-bounce')).toBeUndefined();
    expect(out.annotations.some((a) => a.key === STEED_BELOW)).toBe(false);
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
    committed: [tormentorBoardEffect()]
  });

  it('sub-threshold Use-mode: no record, the marker, and the vehicle-worded annotation', () => {
    const out = evaluate({
      ...boarded(),
      planned: [plan('d1', 'record-tormentor-damage', { amount: 9 })]
    });
    expect(out.effects.filter((e) => e.id.includes('effect-tormentor-hp-damage'))).toHaveLength(0);
    expect(out.facts['companion.tormentorDamageControl.hp.current']).toBe(60);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(markerOf(out, 'effect-tormentor-hp-bounce')).toBeDefined();
    const annotation = out.annotations.find((a) => a.key === VEHICLE_BELOW);
    expect(annotation).toBeDefined();
    expect(annotation!.targets).toEqual(['damage.tormentor.companion']);
  });

  it('Ignore Threshold records the RAW amount in full', () => {
    const out = evaluate({
      ...boarded(),
      planned: [plan('d1', 'record-tormentor-damage', { amount: 9, thresholdMode: 1 })]
    });
    expect(out.facts['companion.tormentorDamageControl.hp.damageRecorded']).toBe(9);
    expect(out.facts['companion.tormentorDamageControl.hp.current']).toBe(51);
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
      THRESHOLD_CONTROL('companion.tormentorDamageControl.damageThreshold')
    );
    // The damage panel also declares the label the bounce annotation targets.
    expect((damage.ui as Record<string, unknown>).annotationLabels).toEqual([
      'damage.tormentor.companion'
    ]);
  });
});

describe('the bounce marker clears like the records it stands beside', () => {
  it('survives a plain end of turn and ages out on a long rest (untilLongRest)', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: { 'hp.base.max': 10, 'hp.damageThreshold': 5 },
      planned: [plan('d1', 'record-damage', { amount: 4 })]
    });
    const marker = markerOf(out, 'effect-hp-bounce')!;
    expect(endTurn([], [marker], {})).toHaveLength(1);
    expect(endTurn([], [marker], { longRest: true })).toHaveLength(0);
  });
});

describe('the threshold strings exist in BOTH locales (tlh is the canary)', () => {
  it('the three below-threshold annotations resolve in en and en-x-tlh', () => {
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
