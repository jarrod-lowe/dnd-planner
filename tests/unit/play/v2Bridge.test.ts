import { describe, it, expect } from 'vitest';
import { effectInstanceToRule, adaptV2EngineOutput } from '$lib/play/v2Bridge';
import { getEffectKind, getDurationState, isHiddenEffect } from '$lib/play/effectUtils';
import type { EngineOutput as V2EngineOutput, PlannedRef } from '$lib/rules-engine-v2';

/**
 * M4/W4 — the v2→v1 bridges: committed EffectInstance → effect Rule (so the
 * active-effects UI reads it) and v2 EngineOutput → the v1 shape the store stores.
 */

describe('v2Bridge — effectInstanceToRule', () => {
  it('reconstructs a concentration effect the UI classifies as CONC, with duration pips', () => {
    const rule = effectInstanceToRule({
      id: 'effect-bless',
      key: 'bless',
      state: { 'concentration.spent': 1 },
      expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
    });
    expect(rule.id).toBe('effect-bless');
    expect(rule.group).toEqual(['bless']);
    expect(getEffectKind(rule)).toBe('CONC');
    // ui.countDown/duration → DurationState { remaining, total, … }
    const dur = getDurationState(rule);
    expect(dur?.remaining).toBe(10);
    expect(dur?.total).toBe(10);
    // A concentration effect is a real active effect — never hidden.
    expect(isHiddenEffect(rule)).toBe(false);
  });

  it('a permanent keyed build effect → no duration, keyed group, hidden from the strip', () => {
    const rule = effectInstanceToRule({
      id: 'effect-str',
      key: 'str-value-base',
      state: { 'str.value': 16 },
      expiry: { kind: 'permanent' }
    });
    expect(rule.group).toEqual(['str-value-base']);
    expect(getDurationState(rule)).toBeNull();
    // The v2 build lives as permanent committed effects — kept out of the strip.
    expect(isHiddenEffect(rule)).toBe(true);
  });

  it('hides a pure resource spend (a spent slot) but shows a durationless buff', () => {
    const slot = effectInstanceToRule({
      id: 'effect-bless-slot-l1',
      state: { 'spellcasting.slots.level1.spent': 1 },
      expiry: { kind: 'untilLongRest' }
    });
    expect(isHiddenEffect(slot)).toBe(true);

    const buff = effectInstanceToRule({
      id: 'effect-aid',
      key: 'aid',
      state: { 'hp.temp': 5 },
      expiry: { kind: 'untilLongRest' }
    });
    expect(isHiddenEffect(buff)).toBe(false);
  });

  it('maps display metadata to ui.name/section and shows it even when permanent', () => {
    // The steed: permanent (would be hidden), but its `display` opts it onto the
    // strip as a named MOUNT chip.
    const rule = effectInstanceToRule({
      id: 'effect-steed',
      key: 'steed',
      state: { 'companion.steed.active': 1 },
      display: { name: 'rule.spell-find-steed.effect-steed.name', section: 'mount' },
      expiry: { kind: 'permanent' }
    });
    expect(rule.ui?.name).toBe('rule.spell-find-steed.effect-steed.name');
    expect(rule.ui?.section).toBe('mount');
    expect(getEffectKind(rule)).toBe('MOUNT');
    expect(isHiddenEffect(rule)).toBe(false);
  });
});

const v2out = (overrides: Partial<V2EngineOutput> = {}): V2EngineOutput => ({
  status: { ok: true, legal: true, applicable: true },
  facts: { 'hp.max': 10 },
  availableRules: [
    { rule: { id: 'unarmed-strike-use-action', ui: {} }, legal: true, applicable: true, diagnostics: [] }
  ],
  planDiagnostics: {},
  annotations: [],
  effects: [{ id: 'effect-bless', key: 'bless', state: { 'bless.active': 1 }, expiry: { kind: 'permanent' } }],
  diagnostics: { errors: [], warnings: [], notices: [] },
  next: { modules: [] },
  ...overrides
});

describe('v2Bridge — adaptV2EngineOutput', () => {
  it('carries facts/effects and exposes offers + per-instance planned entries by id', () => {
    const planned: PlannedRef[] = [{ instanceId: 'i0', ruleId: 'unarmed-strike-use-action' }];
    const out = adaptV2EngineOutput(
      v2out({ planDiagnostics: { i0: [{ code: 'no_action', severity: 'error' }] } }),
      planned
    );
    expect(out.facts).toEqual({ 'hp.max': 10 });
    // The committed effect became a v1 effect Rule.
    expect(out.effects.map((e) => e.id)).toEqual(['effect-bless']);
    // availableRules has the offer plus the planned instance keyed by instanceId.
    const byId = Object.fromEntries(out.availableRules.map((e) => [e.rule.id, e]));
    expect(byId['unarmed-strike-use-action'].legal).toBe(true);
    expect(byId['i0'].legal).toBe(false); // the planned instance's own legality
    // v1-shape fields are present (stubbed).
    expect(out.collections).toEqual({});
    expect(Array.isArray(out.availableRules)).toBe(true);
  });
});
