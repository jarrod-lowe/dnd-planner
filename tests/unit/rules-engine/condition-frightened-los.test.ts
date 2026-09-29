import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';

/**
 * Frightened line-of-sight — the unit pins the yaml grammar cannot express:
 * the keyed sub-state's effect shapes (what the dice-line chip commits through
 * the follow-up channel), the committed-array eviction round-trip (the yaml
 * harness has no mid-scenario commit step — INITIAL_EFFECTS only seeds
 * terminal states), and the annotation/i18n contract of the chip itself.
 */

const CF = 'rule.dnd-5e-2024.condition-frightened';
const M = [conditionFrightened];

const conditionEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  state: { 'condition.frightened': 1 },
  expiry: { kind: 'untilShortRest' }
});
const hiddenEffect = (): EffectInstance => ({
  id: 'effect-frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  expiry: { kind: 'untilShortRest' }
});
const visibleEffect = (): EffectInstance => ({
  id: 'effect-frightened-source-visible',
  key: 'frightened-source',
  expiry: { kind: 'untilShortRest' }
});

const FLAGS = [
  'attack.str.disadvantage',
  'attack.dex.disadvantage',
  'initiative.disadvantage',
  'check.disadvantage',
  'skill.perception.disadvantage'
];

/** The annotation carrying the toggle, from any evaluation while frightened. */
const losAnnotation = (committed: EffectInstance[]) => {
  const out = evaluate({ modules: M, committed });
  const ann = out.annotations.find((a) => a.key === `${CF}.los`);
  expect(ann, 'the LoS toggle annotation exists while frightened').toBeDefined();
  return ann!;
};

describe('condition-frightened — the LoS derives gate on condition AND sight', () => {
  it('committed condition, source in sight (unset fact): flags on', () => {
    const out = evaluate({ modules: M, committed: [conditionEffect()] });
    expect(out.facts['condition.frightened']).toBe(1);
    for (const flag of FLAGS) expect(out.facts[flag]).toBe(1);
  });

  it('committed condition + hidden source: every flag 0 (flags-off-is-OFF)', () => {
    const out = evaluate({ modules: M, committed: [conditionEffect(), hiddenEffect()] });
    expect(out.facts['frightened.sourceHidden']).toBe(1);
    for (const flag of FLAGS) expect(out.facts[flag] ?? 0).toBe(0);
  });

  it('hidden source without the condition: flags stay 0 (the gate needs both)', () => {
    const out = evaluate({ modules: M, committed: [hiddenEffect()] });
    for (const flag of FLAGS) expect(out.facts[flag] ?? 0).toBe(0);
  });

  it('the empty same-key reveal evicts the hidden effect: flags return (round-trip)', () => {
    // The committed array's LATEST keyed effect wins — the direction
    // addFollowupEffect's replace-by-key produces on every chip tap.
    const out = evaluate({
      modules: M,
      committed: [conditionEffect(), hiddenEffect(), visibleEffect()]
    });
    expect(out.facts['frightened.sourceHidden'] ?? 0).toBe(0);
    for (const flag of FLAGS) expect(out.facts[flag]).toBe(1);
  });
});

describe('condition-frightened — the recorder advertises only the condition fact', () => {
  it('the advertised effect carries dependents but no flag writes (flags are derives)', () => {
    const planned: PlannedRef[] = [{ instanceId: 'i0', ruleId: 'record-frightened' }];
    const out = evaluate({ modules: M, planned });
    const effect = out.effects.find((e) => e.id.split('#').includes('effect-frightened'));
    expect(effect).toBeDefined();
    expect(effect!.state).toEqual({ 'condition.frightened': 1 });
    // Chip dismissal of the Frightened condition takes the toggle along.
    expect(effect!.dependents).toEqual(['frightened-source']);
  });
});

describe('condition-frightened — the toggle annotation contract (the chip)', () => {
  it('carries the keyed effects the chip commits, with onWhen 0 (unset = pressed = in sight)', () => {
    const toggle = losAnnotation([conditionEffect()]).toggle!;
    expect(toggle.fact).toBe('frightened.sourceHidden');
    expect(toggle.onWhen).toBe(0);
    expect(toggle.appliesTo).toEqual(['to-hit', 'check']);

    // What a tap commits — both carry the DISTINCT key (never 'frightened',
    // which would evict the condition itself) and the authored group stamp
    // (the follow-up channel bypasses the fold's stamping).
    expect(toggle.onEffect.id).toBe('effect-frightened-source-hidden');
    expect(toggle.onEffect.key).toBe('frightened-source');
    expect(toggle.onEffect.state).toEqual({ 'frightened.sourceHidden': 1 });
    expect(toggle.onEffect.ruleGroupId).toBe('condition-frightened');
    expect(toggle.offEffect.id).toBe('effect-frightened-source-visible');
    expect(toggle.offEffect.key).toBe('frightened-source');
    expect(toggle.offEffect.state).toBeUndefined();
    expect(toggle.offEffect.display).toBeUndefined();
    expect(toggle.offEffect.ruleGroupId).toBe('condition-frightened');
  });

  it('the toggle annotation disappears with the condition (no chip to flip when un-frightened)', () => {
    const out = evaluate({ modules: M, committed: [] });
    expect(out.annotations.some((a) => a.key === `${CF}.los`)).toBe(false);
  });

  it('the notice body flips with sight; the notice itself stays (can’t-approach survives)', () => {
    const visible = evaluate({ modules: M, committed: [conditionEffect()] }).annotations;
    const hidden = evaluate({
      modules: M,
      committed: [conditionEffect(), hiddenEffect()]
    }).annotations;
    const noticeOf = (anns: typeof visible) => anns.find((a) => a.key === `${CF}.notice`)!;
    expect(noticeOf(visible).body).toBe(`${CF}.notice.body`);
    expect(noticeOf(hidden).body).toBe(`${CF}.notice.body-hidden`);
  });
});

describe('condition-frightened — the LoS i18n contract', () => {
  /** The condition's i18n bucket in a locale file (flat dotted keys + one nested name). */
  const bucket = (json: unknown): Record<string, unknown> =>
    (json as Record<string, Record<string, Record<string, Record<string, unknown>>>>)['rule'][
      'dnd-5e-2024'
    ]['condition-frightened'];
  const en = bucket(enCommon);
  const tlh = bucket(tlhCommon);

  it('both chip labels exist in BOTH locales and are distinct (a11y: the two states must name differently)', () => {
    for (const locale of [en, tlh]) {
      expect(locale['los.in-sight']).toBeTruthy();
      expect(locale['los.out-of-sight']).toBeTruthy();
      expect(locale['los.in-sight']).not.toBe(locale['los.out-of-sight']);
      expect(locale['notice.body-hidden']).toBeTruthy();
      expect((locale['effect-source-hidden'] as { name?: string }).name).toBeTruthy();
    }
  });
});
