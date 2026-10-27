import { describe, it, expect } from 'vitest';
import { evaluate, defineRule } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import { hpRecorders, type LegalWhen } from '$lib/rules-engine/builder';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hp from '$lib/rules-engine/rules/hp';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import tormentor, { tormentorAcquireEffect } from '$lib/rules-engine/rules/vehicle-tormentor';

/**
 * The HEAL direction's OPT-IN legality legs — the shared HP recorder's escape
 * hatch for a subject whose REPAIRS can be illegal in some state (the
 * Tormentor's wrecked vehicle: a destroyed war machine cannot be patched back
 * to life; the way out is people, not repairs). The spec field is the caller's
 * OWN legs — condition plus diagnostics, exactly an offer's `legalWhen` entry —
 * appended to the heal offer's legality and RE-CHECKED in its apply (the dash
 * idiom), so a planned-anyway row still records (the missing-HP cap untouched)
 * while carrying its own diagnostics. Subjects that configure no legs — the
 * player and the steed today — see zero behaviour change: their heal offers
 * carry no legality at all, exactly as before, and the DAMAGE direction never
 * carries the caller's heal legs (damage is bookkeeping on a subject in any
 * state — a wrecked vehicle still takes the blows that land on it).
 */

const WRECKED = 'rule.tormentor.wrecked';

const plan = (
  instanceId: string,
  ruleId: string,
  selections: Record<string, number>
): PlannedRef => ({
  instanceId,
  ruleId,
  selections
});

/**
 * A synthetic recorder module built straight from the factory — the factory's
 * own seam, independent of any caller's wiring. 100-HP subject, damage
 * threshold 10 seeded as an input fact (no module derives it), optional heal
 * legs reading `synth.wrecked`.
 */
const synthModule = (healLegality?: LegalWhen[]) =>
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
        ...(healLegality ? { healLegality } : {})
      })
  });

const wreckedLegs: LegalWhen[] = [
  {
    condition: (f) => f.num('synth.wrecked') === 0,
    diagnostics: [{ code: 'synth.wrecked', severity: 'error' }]
  }
];

describe('the factory healLegality option is opt-in data on the spec', () => {
  it('configured: the heal offer carries the legs and goes illegal when the condition fails', () => {
    const out = evaluate({
      modules: [synthModule(wreckedLegs)],
      inputFacts: { 'synth.damageThreshold': 10, 'synth.wrecked': 1 }
    });
    const heal = out.availableRules.find((r) => r.rule.id === 'record-synth-heal');
    expect(heal, 'the heal offer exists').toBeDefined();
    expect(heal!.legal, 'the heal is illegal while the caller condition fails').toBe(false);
    expect(heal!.diagnostics).toEqual([{ code: 'synth.wrecked', severity: 'error' }]);
  });

  it('configured: a planned-anyway heal still records — CAPPED at the missing HP — carrying its diagnostics', () => {
    // 90 damage committed first, so the cap (min(amount, missing)) is live
    // beside the new legs: the override row records at most what was missing.
    const damage: EffectInstance = {
      id: 'flag-synth-damage',
      state: { 'synth.hp.modifier.current': -90 },
      expiry: { kind: 'untilLongRest' }
    };
    const out = evaluate({
      modules: [synthModule(wreckedLegs)],
      inputFacts: { 'synth.damageThreshold': 10, 'synth.wrecked': 1 },
      committed: [damage],
      planned: [plan('h1', 'record-synth-heal', { amount: 200 })]
    });
    // The record lands at the cap (90 of the 200 asked), and the row carries
    // the caller's diagnostics from the apply re-check (the dash idiom).
    expect(out.effects).toHaveLength(1);
    expect(out.effects[0]!.state).toEqual({ 'synth.hp.modifier.current': 90 });
    expect(out.planDiagnostics['h1']).toEqual([{ code: 'synth.wrecked', severity: 'error' }]);
  });

  it('configured: the DAMAGE direction never carries the heal legs (damage records in any state)', () => {
    const out = evaluate({
      modules: [synthModule(wreckedLegs)],
      inputFacts: { 'synth.damageThreshold': 10, 'synth.wrecked': 1 }
    });
    const damage = out.availableRules.find((r) => r.rule.id === 'record-synth-damage');
    expect(damage, 'the damage offer exists').toBeDefined();
    expect(damage!.legal, 'damage stays legal while the heal condition fails').toBe(true);
    expect(damage!.diagnostics).toEqual([]);
  });

  it('omitted: the heal offer carries NO legality at all — zero behaviour change', () => {
    const out = evaluate({
      modules: [synthModule()],
      inputFacts: { 'synth.damageThreshold': 10, 'synth.wrecked': 1 }
    });
    const heal = out.availableRules.find((r) => r.rule.id === 'record-synth-heal');
    expect(heal, 'the heal offer exists').toBeDefined();
    expect(heal!.legal).toBe(true);
    expect(heal!.diagnostics).toEqual([]);
    // The RAW offer carries no legalWhen either — not legs that pass, NO legs.
    const raw = synthModule().offer!({ selections: {} }).find((o) => o.id === 'record-synth-heal')!;
    expect(raw.legalWhen).toBeUndefined();
  });
});

describe('the player and steed heal recorders are untouched (no legs configured)', () => {
  it('player: a heal is legal with no diagnostics while the same-named fact would fail a leg', () => {
    const out = evaluate({
      modules: [coreEvents, hp],
      inputFacts: { 'hp.base.max': 10 },
      planned: [plan('h1', 'record-heal', { amount: 4 })]
    });
    expect(out.planDiagnostics['h1'] ?? []).toEqual([]);
  });

  it('steed: a heal is legal with no diagnostics', () => {
    const out = evaluate({
      modules: [findSteed],
      committed: [steedEffect(2, 0)],
      planned: [plan('h1', 'steed-record-heal', { amount: 4 })]
    });
    expect(out.planDiagnostics['h1'] ?? []).toEqual([]);
  });
});

describe('the Tormentor wires the wrecked leg into its HEAL recorder alone', () => {
  /** Acquired, 60 damage committed (hp 0, the permanent wreck standing). */
  const wreckedVehicle = (): EffectInstance[] => {
    const out = evaluate({
      modules: [tormentor],
      committed: [tormentorAcquireEffect()],
      planned: [plan('d1', 'record-tormentor-damage', { amount: 60 })]
    });
    expect(out.facts['companion.tormentor.destroyed']).toBe(1);
    return [tormentorAcquireEffect(), ...out.effects];
  };

  it('the repair offer is illegal with the ONE shared wrecked diagnostic while wrecked', () => {
    const out = evaluate({ modules: [tormentor], committed: wreckedVehicle() });
    const heal = out.availableRules.find((r) => r.rule.id === 'record-tormentor-heal');
    expect(heal, 'the repair offer stays visible on the wreck').toBeDefined();
    expect(heal!.legal).toBe(false);
    expect(heal!.diagnostics).toEqual([{ code: WRECKED, severity: 'error' }]);
    // …and the damage recorder stays LEGAL on the same wreck (the boundary).
    const damage = out.availableRules.find((r) => r.rule.id === 'record-tormentor-damage');
    expect(damage, 'the damage offer stays visible on the wreck').toBeDefined();
    expect(damage!.legal).toBe(true);
    expect(damage!.diagnostics).toEqual([]);
  });

  it('a planned-anyway repair on the wreck still records (capped at the missing HP), carrying the diagnostic', () => {
    const out = evaluate({
      modules: [tormentor],
      committed: wreckedVehicle(),
      planned: [plan('h1', 'record-tormentor-heal', { amount: 25 })]
    });
    expect(out.facts['companion.tormentor.hp.healRecorded']).toBe(25);
    expect(out.facts['companion.tormentor.hp.current']).toBe(25);
    expect(out.planDiagnostics['h1']).toEqual([{ code: WRECKED, severity: 'error' }]);
  });
});
