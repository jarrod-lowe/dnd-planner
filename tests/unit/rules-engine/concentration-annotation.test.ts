import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import concentration from '$lib/rules-engine/rules/concentration';
import coreEvents from '$lib/rules-engine/rules/core-events';

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
 * Panels render the label only (`$t(annotation.key)` in PanelRenderer — no
 * values), so the DC 10 rule text (DC 10, or half the damage taken, whichever
 * is higher) is baked into the label copy. The rule module cannot import
 * constants (rule modules import only the builder), so this test pins its
 * 'damage.any' literal to the recorder's declared annotationLabels.
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
    // `concentration.damage-taken` is written by record-damage's committed
    // effect (core-events), not derived here — a genuine input fact here.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.spent': 1, 'concentration.damage-taken': 1 },
      planned: []
    });
    const ann = out.annotations.find((a) => a.key === KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual([DAMAGE_PANEL_LABEL]);
    // Panel annotations render label-only, so no body key rides along.
    expect(ann!.body).toBeUndefined();
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
});
