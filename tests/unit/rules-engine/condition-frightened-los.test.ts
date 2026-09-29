import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';

/**
 * Frightened line-of-sight — the unit pins the yaml grammar cannot express:
 * the per-row model's engine contract (Frightened contributes NONE of the
 * shared flags — the dice-line chip carries the disadvantage per row, so the
 * flags stay source-pure for Poisoned/Blinded/armor), the keyed seed's effect
 * shapes (what the chip commits through the follow-up channel), the
 * committed-array eviction round-trip, and the annotation/i18n contract of
 * the chip itself. The per-row capture and forcing live in the play-side
 * tests (playStore capture, PanelDiceLine roll-mode).
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

describe('condition-frightened — the shared flags stay source-pure (per-row model)', () => {
  it('contributes NONE of the flags in ANY state: recorded, hidden, or hidden alone', () => {
    for (const committed of [
      [conditionEffect()],
      [conditionEffect(), hiddenEffect()],
      [hiddenEffect()]
    ]) {
      const out = evaluate({ modules: M, committed });
      for (const flag of FLAGS) expect(out.facts[flag] ?? 0, JSON.stringify(committed)).toBe(0);
    }
  });
});

describe('condition-frightened — the recorder advertises only the condition fact', () => {
  it('the advertised effect carries dependents but no flag writes (no derives exist)', () => {
    const planned: PlannedRef[] = [{ instanceId: 'i0', ruleId: 'record-frightened' }];
    const out = evaluate({ modules: M, planned });
    const effect = out.effects.find((e) => e.id.split('#').includes('effect-frightened'));
    expect(effect).toBeDefined();
    expect(effect!.state).toEqual({ 'condition.frightened': 1 });
    // Chip dismissal of the Frightened condition takes the sight seed along.
    expect(effect!.dependents).toEqual(['frightened-source']);
  });
});

describe('condition-frightened — the sight seed flips through the keyed effects', () => {
  it('the empty same-key reveal evicts the hidden seed (round-trip)', () => {
    // The committed array's LATEST keyed effect wins — the direction
    // addFollowupEffect's replace-by-key produces on every chip tap.
    const out = evaluate({
      modules: M,
      committed: [conditionEffect(), hiddenEffect(), visibleEffect()]
    });
    expect(out.facts['frightened.sourceHidden'] ?? 0).toBe(0);
  });

  it('the chip mapping actually FLIPS the seed: committing the chip choice per pressed state changes the fact', () => {
    const toggle = losAnnotation([conditionEffect()]).toggle!;
    // What PanelDiceLine commits: pressed ? offEffect : onEffect.
    const chipCommits = (pressed: boolean) => (pressed ? toggle.offEffect : toggle.onEffect);

    // In sight (unset fact = onWhen → pressed): the tap's commit flips to hidden.
    const afterHide = evaluate({ modules: M, committed: [conditionEffect(), chipCommits(true)] });
    expect(afterHide.facts['frightened.sourceHidden']).toBe(1);

    // Hidden (fact 1 → not pressed): the tap's commit flips back to visible.
    const afterReveal = evaluate({
      modules: M,
      committed: [conditionEffect(), hiddenEffect(), chipCommits(false)]
    });
    expect(afterReveal.facts['frightened.sourceHidden'] ?? 0).toBe(0);
  });

  it('the notice body flips with the seed; the notice itself stays (can’t-approach survives)', () => {
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

describe('condition-frightened — the toggle annotation contract (the chip)', () => {
  it('carries the keyed effects the chip commits, with onWhen 0 (unset = pressed = in sight)', () => {
    const toggle = losAnnotation([conditionEffect()]).toggle!;
    expect(toggle.fact).toBe('frightened.sourceHidden');
    expect(toggle.onWhen).toBe(0);
    expect(toggle.appliesTo).toEqual(['to-hit', 'check']);

    // The direction contract (inverted once in review — pinned hard now):
    // onEffect takes the fact TO onWhen (the REVEAL — empty, display-less),
    // offEffect takes it away (the HIDE — writes the fact). Both carry the
    // DISTINCT key 'frightened-source' (never 'frightened', which would evict
    // the condition itself) and the authored group stamp (the follow-up
    // channel bypasses the fold's stamping).
    expect(toggle.onEffect.id).toBe('effect-frightened-source-visible');
    expect(toggle.onEffect.key).toBe('frightened-source');
    expect(toggle.onEffect.state).toBeUndefined();
    expect(toggle.onEffect.display).toBeUndefined();
    expect(toggle.onEffect.ruleGroupId).toBe('condition-frightened');
    expect(toggle.offEffect.id).toBe('effect-frightened-source-hidden');
    expect(toggle.offEffect.key).toBe('frightened-source');
    expect(toggle.offEffect.state).toEqual({ 'frightened.sourceHidden': 1 });
    expect(toggle.offEffect.ruleGroupId).toBe('condition-frightened');
  });

  it('the toggle annotation disappears with the condition (no chip to flip when un-frightened)', () => {
    const out = evaluate({ modules: M, committed: [] });
    expect(out.annotations.some((a) => a.key === `${CF}.los`)).toBe(false);
  });

  it('the chip renders the moment the condition is LIVE — a merely planned recorder included', () => {
    // Recording Frightened must show the disadvantage on THIS turn's rows, so
    // the annotation cannot wait for End Turn. The orphan case (the recorder
    // row removed before commit, stranding a seed the chip persisted) is
    // cleaned by the store's removeFromPlan, which evicts committed effects
    // keyed by the removed row's advertised dependents.
    const planned: PlannedRef[] = [{ instanceId: 'i0', ruleId: 'record-frightened' }];
    const out = evaluate({ modules: M, planned });
    expect(out.facts['condition.frightened']).toBe(1);
    expect(out.annotations.some((a) => a.key === `${CF}.los`)).toBe(true);
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
