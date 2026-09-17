import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import concentration from '$lib/rules-engine/rules/concentration';
import coreEvents from '$lib/rules-engine/rules/core-events';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';

/**
 * Notices batch 2, review follow-up — the concentration reminder as a PANEL
 * annotation on the damage recorder.
 *
 * The reminder is post-hoc: it matters when the player records damage, so it
 * rides the record-damage panel via its `damage.any` annotationLabel (the
 * recorder idiom — record-heal carries `healing.any`). It is no longer a
 * standing strip notice, so no annotation this module emits may target the
 * reserved 'notice' label.
 *
 * Engine annotations derive from the FINAL post-plan facts and render on every
 * matching plan row, so the annotation is gated on the step-time marker
 * `concentration.damage-taken` — record-damage trips it only when the slot was
 * held AT RECORD TIME. Ungated, planning damage-then-cast shows the save
 * instruction on the earlier damage row for a save that is not owed (SRD 5.2:
 * a save is owed only for damage taken while concentrating). Gated, the
 * annotation coincides with the concentration-check offer; the standing
 * heads-up on the recorder while concentrating-but-undamaged is gone by design.
 *
 * The label carries the COMPUTED save DC, not the min/max prose: the damage
 * amount is known from the record-damage selector, so the marker carries it
 * (`concentration.last-damage`) and the annotation interpolates DC = half the
 * damage (round down), clamped 10..30 — SRD 5.2: "The DC equals 10 or half the
 * damage taken (round down), whichever number is higher, up to a maximum DC
 * of 30." Panels interpolate `$t(annotation.key, annotation.values)`, the same
 * double-brace pattern the notices strip uses for bodies. The rule module
 * cannot import constants (rule modules import only the builder), so this test
 * pins its 'damage.any' literal to the recorder's declared annotationLabels.
 */
const KEY = 'planner.concentration.annotation';

/** The annotationLabel the record-damage panel declares. */
const DAMAGE_PANEL_LABEL = 'damage.any';

describe('concentration annotate — damage-recorder annotation', () => {
  it('emits nothing while the slot is held but no damage was recorded — no save is owed', () => {
    // `concentration.spent` is written by concentration spells' committed
    // effects, not derived here — a genuine input fact for this module set.
    // The slot is held, but `concentration.damage-taken` never tripped: the
    // reminder must stay off until a save is actually owed.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.spent': 1 },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)).toBeUndefined();
  });

  it('annotates the damage recorder when damage was recorded while the slot is held', () => {
    // `concentration.damage-taken` and `concentration.last-damage` are written
    // by record-damage's committed effect (core-events), not derived here —
    // genuine input facts here.
    const out = evaluate({
      modules: [concentration],
      inputFacts: {
        'concentration.spent': 1,
        'concentration.damage-taken': 1,
        'concentration.last-damage': 25
      },
      planned: []
    });
    const ann = out.annotations.find((a) => a.key === KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual([DAMAGE_PANEL_LABEL]);
    // Panel annotations render label-only, so no body key rides along.
    expect(ann!.body).toBeUndefined();
    // The label interpolates the computed DC: half of 25, rounded down.
    expect(ann!.values).toEqual({ dc: 12 });
  });

  it('interpolates the DC at its floor — small damage still demands DC 10', () => {
    const out = evaluate({
      modules: [concentration],
      inputFacts: {
        'concentration.spent': 1,
        'concentration.damage-taken': 1,
        'concentration.last-damage': 5
      },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)!.values).toEqual({ dc: 10 });
  });

  it('caps the DC at 30 — massive damage demands no more', () => {
    const out = evaluate({
      modules: [concentration],
      inputFacts: {
        'concentration.spent': 1,
        'concentration.damage-taken': 1,
        'concentration.last-damage': 100
      },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)!.values).toEqual({ dc: 30 });
  });

  it('falls back to the DC 10 floor when no damage figure survived', () => {
    // The marker is keyed (newest wins) and the check's clearing effect zeroes
    // the amount with it; a stale damage-taken without an amount must still
    // render a sane label, not an undefined DC.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.spent': 1, 'concentration.damage-taken': 1 },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)!.values).toEqual({ dc: 10 });
  });

  it("carries the recorded amount on record-damage's marker and clears it with the check", () => {
    // Drive the recorder's apply through the engine: the amount rides the SAME
    // keyed marker as the damage-taken flag (newest wins), so the annotation
    // interpolates the DC of the damage just recorded.
    const damage = (instanceId: string, amount: number): PlannedRef => ({
      instanceId,
      ruleId: 'record-damage',
      selections: { amount }
    });
    const out = evaluate({
      modules: [concentration, coreEvents],
      inputFacts: { 'concentration.spent': 1 },
      planned: [damage('d1', 25)]
    });
    expect(out.facts['concentration.damage-taken']).toBe(1);
    expect(out.facts['concentration.last-damage']).toBe(25);
    expect(out.annotations.find((a) => a.key === KEY)!.values).toEqual({ dc: 12 });

    // A later record replaces the amount (keyed marker, newest wins), so the
    // DC follows the LATEST damage recorded this turn.
    const replanned = evaluate({
      modules: [concentration, coreEvents],
      inputFacts: { 'concentration.spent': 1 },
      planned: [damage('d1', 25), damage('d2', 5)]
    });
    expect(replanned.facts['concentration.last-damage']).toBe(5);
    expect(replanned.annotations.find((a) => a.key === KEY)!.values).toEqual({ dc: 10 });
    // Planning the check clears the marker AND its carried amount (newest
    // wins again), so no later reminder quotes stale damage.
    const checked = evaluate({
      modules: [concentration, coreEvents],
      inputFacts: { 'concentration.spent': 1 },
      planned: [
        damage('d1', 25),
        { instanceId: 'c1', ruleId: 'concentration-check', selections: { passed: 1 } }
      ]
    });
    expect(checked.facts['concentration.damage-taken']).toBe(0);
    expect(checked.facts['concentration.last-damage']).toBe(0);
    expect(checked.annotations.find((a) => a.key === KEY)).toBeUndefined();
  });

  it('emits no annotation for a damage marker with the slot free', () => {
    // Damage recorded before the cast trips no marker in real play, but the
    // module must not offer a save to keep a spell that is not being held.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.damage-taken': 1 },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)).toBeUndefined();
  });

  it('emits no annotation while the slot is free', () => {
    const out = evaluate({ modules: [concentration], inputFacts: {}, planned: [] });
    expect(out.annotations.find((a) => a.key === KEY)).toBeUndefined();
  });

  it("targets the label the record-damage panel's ui declares", () => {
    const damage = coreEvents.offer!({ selections: {} }).find((o) => o.id === 'record-damage');
    expect(damage, 'record-damage offer exists').toBeDefined();
    const labels = (damage!.ui as Record<string, unknown> | undefined)?.annotationLabels;
    expect(labels, 'record-damage carries annotationLabels').toBeDefined();
    expect(labels).toContain(DAMAGE_PANEL_LABEL);
  });

  it('emits no notice-targeted annotation — the strip no longer carries it', () => {
    // Slot held and damage recorded: the annotation IS live, so this pins
    // where it lands rather than passing on an absent annotation.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.spent': 1, 'concentration.damage-taken': 1 },
      planned: []
    });
    expect(out.annotations.find((a) => a.key === KEY)).toBeDefined();
    const notices = out.annotations.filter((a) => a.targets.includes(NOTICE_TARGET));
    expect(notices).toEqual([]);
  });

  it('the label template interpolates only the DC — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const ns = (catalog.planner as unknown as Record<string, Record<string, string | undefined>>)[
        'concentration'
      ];
      const label = ns?.['annotation'];
      expect(label, 'label template exists').toBeDefined();
      // {{dc}} double-brace (sveltekit-i18n), and it is the ONLY param.
      expect(label?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{dc}}']);
    }
  });
});
