import { describe, it, expect } from 'vitest';
import { evaluate, evaluateOffers, NOTICE_TARGET } from '$lib/rules-engine';
import type { EffectInstance, Facts } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';

/**
 * The Frightened LoS interaction, v2 (user-directed 2026-09-29, the walkthrough
 * decision — "Reading 2: persistent global toggle, chip-styled, immediate"):
 * ONE annotation while frightened carries BOTH the standing notice (text only)
 * and a `toggle` — the persistent committed-state control the dice lines
 * render as a chip. The toggle is authored here, pinned end to end: the two
 * effects (the keyed hide + the empty same-key reveal eviction), the two state
 * label keys (the SRD's phrase, so "source" is named), the governing flag
 * facts (which dice lines render the chip), and the state-resolving fact. The
 * old picker offers and the notice's addsToPlan button are GONE — the tap
 * commits through the store's follow-up channel, not the plan.
 */
const CF = 'rule.dnd-5e-2024.condition-frightened';
const ALL = [conditionFrightened];
const FACTS: Facts = {};

/** The 22 d20-test facts the SRD disadvantage touches (the module's own list). */
const FLAG_FACTS = [
  'attack.str.disadvantage',
  'attack.dex.disadvantage',
  'initiative.disadvantage',
  'check.disadvantage',
  'skill.acrobatics.disadvantage',
  'skill.animal-handling.disadvantage',
  'skill.arcana.disadvantage',
  'skill.athletics.disadvantage',
  'skill.deception.disadvantage',
  'skill.history.disadvantage',
  'skill.insight.disadvantage',
  'skill.intimidation.disadvantage',
  'skill.investigation.disadvantage',
  'skill.medicine.disadvantage',
  'skill.nature.disadvantage',
  'skill.perception.disadvantage',
  'skill.performance.disadvantage',
  'skill.persuasion.disadvantage',
  'skill.religion.disadvantage',
  'skill.sleight-of-hand.disadvantage',
  'skill.stealth.disadvantage',
  'skill.survival.disadvantage'
];

/** The one annotation the module emits while frightened (whatever the LoS state). */
const annotationOf = (committed: EffectInstance[]) => {
  const out = evaluate({ modules: ALL, inputFacts: FACTS, committed });
  return out.annotations.find((a) => a.key === `${CF}.notice`);
};

const conditionEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  dependents: ['frightened-source'],
  state: { 'condition.frightened': 1 },
  expiry: { kind: 'untilShortRest' }
});

const hiddenToggle = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  expiry: { kind: 'untilShortRest' }
});

type GroupNode = Record<string, string | undefined>;
type CategoryNode = Record<string, GroupNode>;

const node = (catalog: unknown, key: string): string | undefined =>
  ((catalog as { rule: Record<string, CategoryNode> }).rule['dnd-5e-2024'] ?? {})[
    'condition-frightened'
  ]?.[key];

describe('condition-frightened annotate — the notice and its LoS toggle', () => {
  it('visible: the standing notice body names the sight-scoped disadvantage', () => {
    const notice = annotationOf([conditionEffect()])!;
    expect(notice, 'notice exists while frightened').toBeDefined();
    expect(notice.targets).toEqual([NOTICE_TARGET, 'dice.any']);
    expect(notice.source).toBe(`${CF}.effect-frightened.name`);
    expect(notice.body).toBe(`${CF}.notice.body`);
    expect(notice.addsToPlan, 'no planned action — the tap commits, never plans').toBeUndefined();
  });

  it('hidden: the body flips to the hidden variant; the notice still stands', () => {
    const notice = annotationOf([conditionEffect(), hiddenToggle()])!;
    expect(notice, "the notice stands on the can't-approach channel").toBeDefined();
    expect(notice.body).toBe(`${CF}.notice.body-hidden`);
  });

  it('no notice while not frightened', () => {
    expect(annotationOf([])).toBeUndefined();
    expect(annotationOf([hiddenToggle()])).toBeUndefined();
  });

  describe('the toggle — authored data, both directions on one control', () => {
    it('carries the two state labels, the state-resolving fact, and the governed flags', () => {
      const toggle = annotationOf([conditionEffect()])!.toggle!;
      expect(toggle).toBeDefined();
      expect(toggle.offFact).toBe('frightened.sourceHidden');
      expect(toggle.onLabelKey).toBe(`${CF}.fear-source-in-sight`);
      expect(toggle.offLabelKey).toBe(`${CF}.fear-source-out-of-sight`);
      expect([...toggle.governs].sort()).toEqual([...FLAG_FACTS].sort());
      expect(toggle.governs).toHaveLength(22);
    });

    it('onEffect is the keyed hide; offEffect is the empty same-key reveal eviction', () => {
      const toggle = annotationOf([conditionEffect()])!.toggle!;

      // Tapping while in sight (on) commits the hide: key 'frightened-source',
      // DISTINCT from the condition's 'frightened', writing sourceHidden 1.
      expect(toggle.onEffect.id).toBe('frightened-source-hidden');
      expect(toggle.onEffect.key).toBe('frightened-source');
      expect(toggle.onEffect.state).toEqual({ 'frightened.sourceHidden': 1 });

      // Tapping while hidden (off) commits the reveal: an EMPTY same-key effect
      // — the keyed eviction, exactly as the store's follow-up channel commits it.
      expect(toggle.offEffect.id).toBe('frightened-source-visible');
      expect(toggle.offEffect.key).toBe('frightened-source');
      expect(toggle.offEffect.state).toBeUndefined();
    });

    it('the authored toggle is the same data in both states (state lives in the facts)', () => {
      const visible = annotationOf([conditionEffect()])!.toggle!;
      const hidden = annotationOf([conditionEffect(), hiddenToggle()])!.toggle!;
      expect(hidden).toEqual(visible);
    });
  });

  it('both body templates and both chip labels exist — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      for (const key of ['notice.body', 'notice.body-hidden']) {
        const body = node(catalog, key);
        expect(body, `${key} template exists`).toBeDefined();
        expect(body?.length, `${key} is non-empty`).toBeGreaterThan(0);
      }
      for (const key of ['fear-source-in-sight', 'fear-source-out-of-sight']) {
        const label = node(catalog, key);
        expect(label, `${key} chip label exists`).toBeDefined();
        expect(label?.length, `${key} is non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('the module offers only the recorder — the two picker toggles are gone', () => {
    const offers = evaluateOffers(ALL, FACTS).map((o) => o.id);
    expect(offers).toContain('record-frightened');
    expect(offers).not.toContain('source-out-of-sight');
    expect(offers).not.toContain('source-back-in-sight');
    expect(offers).toHaveLength(1);
  });
});
