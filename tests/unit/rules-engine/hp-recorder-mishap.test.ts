import { describe, it, expect } from 'vitest';
import { evaluate, defineRule } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import { hpRecorders } from '$lib/rules-engine/builder';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import tormentor, { tormentorAcquireEffect } from '$lib/rules-engine/rules/vehicle-tormentor';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * The MISHAP threshold — the high-damage mirror of the below-threshold
 * bounce (the Tormentor's stat block: one source dealing 20 or more triggers
 * a mishap). Like the damage threshold it is a FACT the acquire bakes, never
 * a literal in the factory: the shared HP recorder takes an OPT-IN mishap
 * option (a threshold fact + the caller's own note key), and when a
 * RECORDED amount meets the fact the damage row's apply returns ONE
 * `'notice'` diagnostic beside the record — informational only (the amount
 * lands in full exactly as before; the note is never the bounce gate), riding
 * THAT planned row alone (planDiagnostics is per-instance), with the amount
 * and the threshold as interpolation params so a re-baked stat block moves
 * the numbers with no other edit. Subjects that configure no option — the
 * player and the steed today — see zero behaviour change at any amount.
 */

const VEHICLE_MISHAP = 'rule.tormentor.record-damage.mishap_threshold';
const VEHICLE_BELOW = 'rule.tormentor.record-damage.below_threshold';

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

/** Plan ONE vehicle damage row on a committed acquire (the real plan fold). */
const planVehicleDamage = (amount: number, thresholdMode?: number) =>
  evaluate({
    modules: [tormentor],
    committed: [tormentorAcquireEffect()],
    planned: [
      plan('d1', 'record-tormentor-damage', {
        amount,
        ...(thresholdMode === undefined ? {} : { thresholdMode })
      })
    ]
  });

// --- the wiring: the acquire bakes the fact, the recorder carries the note ---

describe('the Tormentor acquire bakes the mishap threshold beside the damage threshold', () => {
  it('mishapThreshold 20 and damageThreshold 10 are both data on the acquire effect', () => {
    const out = evaluate({ modules: [tormentor], committed: [tormentorAcquireEffect()] });
    expect(out.facts['companion.tormentor.damageThreshold']).toBe(10);
    expect(out.facts['companion.tormentor.mishapThreshold']).toBe(20);
  });
});

describe('a vehicle recording that meets the mishap threshold carries the per-row note', () => {
  it('exactly 20: the FULL amount records AND the note rides the row with both params', () => {
    const out = planVehicleDamage(20);
    // The note never blocks recording: the hp math is unchanged.
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(20);
    expect(out.facts['companion.tormentor.hp.current']).toBe(40);
    // ONE informational notice on THIS row — the amount and the threshold
    // travel as params, so the locale's {{amount}}/{{threshold}} slots fill
    // from the facts and a re-baked stat block moves the numbers.
    expect(out.planDiagnostics['d1']).toEqual([
      { code: VEHICLE_MISHAP, severity: 'notice', params: { amount: 20, threshold: 20 } }
    ]);
    expect(out.plannedOffers['d1']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
    // No annotation exists — a per-row consequence is not a standing panel truth.
    expect(out.annotations.some((a) => a.key === VEHICLE_MISHAP)).toBe(false);
  });

  it('above it (25) the same note carries the amount of its own row', () => {
    const out = planVehicleDamage(25);
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(25);
    expect(out.planDiagnostics['d1']).toEqual([
      { code: VEHICLE_MISHAP, severity: 'notice', params: { amount: 25, threshold: 20 } }
    ]);
  });

  it('a destroying blow carries the note BESIDE the wreck (the damage was taken)', () => {
    const out = planVehicleDamage(60);
    expect(out.facts['companion.tormentor.destroyed']).toBe(1);
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(60);
    expect(out.planDiagnostics['d1']).toEqual([
      { code: VEHICLE_MISHAP, severity: 'notice', params: { amount: 60, threshold: 20 } }
    ]);
  });

  it('Ignore Threshold records the raw amount AND notes it (a correction is still damage taken)', () => {
    const out = planVehicleDamage(25, 1);
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(25);
    expect(out.planDiagnostics['d1']).toEqual([
      { code: VEHICLE_MISHAP, severity: 'notice', params: { amount: 25, threshold: 20 } }
    ]);
  });

  it('two rows: the note rides the meeting row only (planDiagnostics is per-instance)', () => {
    const out = evaluate({
      modules: [tormentor],
      committed: [tormentorAcquireEffect()],
      planned: [
        plan('d1', 'record-tormentor-damage', { amount: 15 }),
        plan('d2', 'record-tormentor-damage', { amount: 20 })
      ]
    });
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(35);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
    expect(out.planDiagnostics['d2']).toEqual([
      { code: VEHICLE_MISHAP, severity: 'notice', params: { amount: 20, threshold: 20 } }
    ]);
  });
});

describe('below the mishap threshold the recorder behaves exactly as before', () => {
  it('10-19 (the band between the thresholds): records in full, NO note of either kind', () => {
    expect(planVehicleDamage(10).planDiagnostics['d1'] ?? []).toEqual([]);
    expect(planVehicleDamage(15).planDiagnostics['d1'] ?? []).toEqual([]);
    expect(planVehicleDamage(19).planDiagnostics['d1'] ?? []).toEqual([]);
  });

  it('below the damage threshold: the bounce note fires ALONE (nothing was taken)', () => {
    const out = planVehicleDamage(5);
    expect(out.effects).toHaveLength(0);
    expect(out.facts['companion.tormentor.hp.current']).toBe(60);
    expect(out.planDiagnostics['d1']).toEqual([{ code: VEHICLE_BELOW, severity: 'notice' }]);
  });

  it('Ignore Threshold below the mishap threshold: records raw, no note', () => {
    const out = planVehicleDamage(9, 1);
    expect(out.facts['companion.tormentor.hp.damageRecorded']).toBe(9);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });
});

// --- the factory option is GENERIC but strictly opt-in ---

/**
 * A synthetic recorder module built straight from the factory — the factory's
 * own seam, independent of any caller's wiring. 100-HP subject, damage
 * threshold 10 seeded as an input fact (no module derives it), optional
 * mishap option naming `synth.mishapThreshold`.
 */
const synthModule = (mishap?: { thresholdFact: string; noteKey: string }) =>
  defineRule({
    id: 'synth',
    derive: () => [
      { fact: 'synth.hp.max', value: () => 100 },
      {
        fact: 'synth.hp.current',
        value: (f) =>
          Math.max(0, f.num('synth.hp.max') + Math.min(0, f.num('synth.hp.modifier.current')))
      }
    ],
    offer: () =>
      hpRecorders({
        idStem: 'record-synth',
        facts: {
          max: 'synth.hp.max',
          modifierCurrent: 'synth.hp.modifier.current',
          damageThreshold: 'synth.damageThreshold'
        },
        damage: {
          name: 'synth.record-damage.name',
          effectId: 'effect-synth-damage',
          effectName: 'synth.hp-damage-effect.name'
        },
        heal: {
          name: 'synth.record-heal.name',
          effectId: 'effect-synth-heal',
          effectName: 'synth.hp-heal-effect.name'
        },
        accumulation: 'keyless-stack',
        chipSection: 'health',
        bounce: { noteKey: 'synth.record-damage.below_threshold' },
        ...(mishap ? { mishap } : {})
      })
  });

describe('the factory mishap option is opt-in data on the spec', () => {
  it('configured: a meeting amount carries the note with params (the factory seam)', () => {
    const out = evaluate({
      modules: [
        synthModule({
          thresholdFact: 'synth.mishapThreshold',
          noteKey: 'synth.record-damage.mishap'
        })
      ],
      inputFacts: { 'synth.damageThreshold': 10, 'synth.mishapThreshold': 20 },
      planned: [plan('d1', 'record-synth-damage', { amount: 20 })]
    });
    expect(out.facts['synth.hp.current']).toBe(80);
    expect(out.planDiagnostics['d1']).toEqual([
      {
        code: 'synth.record-damage.mishap',
        severity: 'notice',
        params: { amount: 20, threshold: 20 }
      }
    ]);
  });

  it('omitted: NO note at any amount — the player/steed shape, zero behaviour change', () => {
    const out = evaluate({
      modules: [synthModule()],
      inputFacts: { 'synth.damageThreshold': 10 },
      planned: [plan('d1', 'record-synth-damage', { amount: 90 })]
    });
    expect(out.facts['synth.hp.current']).toBe(10);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });

  it('configured but the fact is UNBAKED (reads 0): never notes — unset never gates, like the bounce', () => {
    const out = evaluate({
      modules: [
        synthModule({
          thresholdFact: 'synth.mishapThreshold',
          noteKey: 'synth.record-damage.mishap'
        })
      ],
      inputFacts: { 'synth.damageThreshold': 10 },
      planned: [plan('d1', 'record-synth-damage', { amount: 90 })]
    });
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });
});

describe('the player and steed recorders are untouched (no option configured)', () => {
  it('player: a recording above its seeded threshold carries no mishap note', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: { 'hp.base.max': 10, 'hp.damageThreshold': 5 },
      planned: [plan('d1', 'record-damage', { amount: 6 })]
    });
    expect(out.facts['hp.current']).toBe(4);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });

  it('steed: a recording above the seeded threshold carries no mishap note', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: [steedEffect(2, 0), flag('companion.steed.damageThreshold', 10)],
      planned: [plan('d1', 'steed-record-damage', { amount: 15 })]
    });
    expect(out.facts['companion.steed.hp.damageRecorded']).toBe(15);
    expect(out.planDiagnostics['d1'] ?? []).toEqual([]);
  });
});

describe('the mishap strings exist in BOTH locales with both params (tlh is the canary)', () => {
  it('the vehicle mishap note carries {{amount}} and {{threshold}} in en and en-x-tlh', () => {
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      const value = dict.rule.tormentor['record-damage'].mishap_threshold;
      expect(value, `${locale} mishap_threshold`).toEqual(expect.any(String));
      expect(value, `${locale} {{amount}}`).toContain('{{amount}}');
      expect(value, `${locale} {{threshold}}`).toContain('{{threshold}}');
    }
  });

  it('the rendered 20/threshold-20 case: the params fill the slots, none survive raw', () => {
    // The render sites forward d.params to $t; pin the interpolation itself
    // with the case the yaml scenario drives (amount 20, threshold 20).
    const interpolate = (template: string, params: Record<string, number>): string =>
      template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? `{{${key}}}`));
    const enRendered = interpolate(en.rule.tormentor['record-damage'].mishap_threshold, {
      amount: 20,
      threshold: 20
    });
    expect(enRendered).toContain('20');
    expect(enRendered).not.toContain('{{');
    const tlhRendered = interpolate(tlh.rule.tormentor['record-damage'].mishap_threshold, {
      amount: 20,
      threshold: 20
    });
    expect(tlhRendered).toContain('20');
    expect(tlhRendered).not.toContain('{{');
  });
});
