import { describe, it, expect } from 'vitest';
import {
  evaluate,
  evaluateSheet,
  type EffectInstance,
  type Facts,
  type RuleModule
} from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import ac from '$lib/rules-engine/rules/ac';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Cover — the PLAYER-level generic cover record (docs/plans/ideas/cover.md,
 * PR-1). SRD 5.2 (Rules Glossary, p.178): "Cover provides a degree of
 * protection to a target behind it. There are three degrees of cover, each of
 * which provides a different benefit to a target: Half Cover (+2 bonus to AC
 * and Dexterity saving throws), Three-Quarters Cover (+5 bonus to AC and
 * Dexterity saving throws), and Total Cover (can't be targeted directly). If
 * behind more than one degree of cover, a target benefits only from the most
 * protective degree." Total grants NO bonus — notice-only copy.
 *
 * One free-section RECORD (the tormentor AC-mode precedent) files the player's
 * asserted degree as ONE permanent KEYED effect on the DISTINCT
 * `cover.recorded` fact: immediate apply, re-apply replaces by key, raw chip
 * removal reverts. The derives normalize it (`current` = has(recorded) ?
 * recorded : 0; `effective` = current — PR-2's seam for max(manual, seat);
 * `bonus` = +2 at half, +5 at three-quarters, 0 at none/total). The EXISTING
 * ac derive reads `cover.bonus` (never a second writer to ac.value), a NOTICE
 * carries the standing state, and a flat RIDER chips the +2/+5 onto the Dex
 * save dice-line (the Aura of Protection precedent — the ROLL is modified, so
 * `dex.save` stays untouched; `save.dex` scopes it to the one save cover
 * touches, unlike Aura/Exhaustion's save.any).
 */
const ID = 'cover';
const C = 'rule.dnd-5e-2024.cover';

/** The module under test, via the registry (fails loud + clear before GREEN). */
function module(): RuleModule {
  const m = getModule(ID);
  if (!m) throw new Error(`${ID} is not registered in the registry`);
  return m;
}

/** The record a cover row at `degree` advertises (through the real plan fold). */
function coverEffect(degree: number, selections?: Record<string, unknown>): EffectInstance {
  const out = evaluate({
    modules: [module()],
    planned: [{ instanceId: 'i0', ruleId: 'set-cover', selections: selections ?? { degree } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-cover'));
  expect(advertised, `a cover row at ${degree} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

/** Settled facts with the given committed effects. */
const factsWith =
  (committed: EffectInstance[]) =>
  (...modules: RuleModule[]): Facts =>
    evaluate({ modules, committed }).facts;

const atDegree = (degree: number, ...modules: RuleModule[]) =>
  factsWith([coverEffect(degree)])(module(), ...modules);

describe('cover registration', () => {
  it('is registered in the registry AND the lazy chunk map', () => {
    expect(isRegistered(ID)).toBe(true);
    expect(lazyRuleGroupIds()).toContain(ID);
  });
});

describe('set-cover offer', () => {
  it('is an always-present player free-section record with the four-degree segmented control', () => {
    const out = evaluate({ modules: [module()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-cover');
    expect(offer, 'the player +ADD carries the cover record').toBeDefined();
    expect(offer!.legal, 'cover is a state, not an activity — ungated').toBe(true);
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.name).toBe(`${C}.record.name`);
    expect(ui.description).toBe(`${C}.record.description`);
    expect(ui.detailKey).toBe('rule/cover');
    expect(ui.actionCost).toEqual([]);
    // A DEFEND-class record (not a condition): its own sub-bucket.
    expect(ui.intents).toEqual({ DEFEND: 'cover' });
    expect(ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'degree',
      prefix: 'play.choices.cover.degree',
      options: [
        { value: 0, label: `${C}.degree.none` },
        { value: 1, label: `${C}.degree.half` },
        { value: 2, label: `${C}.degree.three-quarters` },
        { value: 3, label: `${C}.degree.total` }
      ]
    });
    expect(offer!.rule.vars).toEqual({
      degree: { capture: true, default: { fact: 'cover.current' } }
    });
  });

  it('apply is immediate (record-class): ONE permanent keyed effect on the DISTINCT recorded fact only', () => {
    const effect = coverEffect(1);
    // The plan fold namespaces advertised ids (`instance#index#effectId`).
    expect(effect.id.endsWith('#effect-cover')).toBe(true);
    expect(effect.key).toBe('cover');
    // The record writes ONLY its own fact — AC is derived, never baked here.
    expect(effect.state).toEqual({ 'cover.recorded': 1 });
    expect(effect.display).toEqual({ name: `${C}.effect.name`, detailKey: 'rule/cover' });
    expect(effect.expiry).toEqual({ kind: 'permanent' });
  });

  it('a row left at its default records None (degree 0), not the current cover', () => {
    expect(coverEffect(0).state).toEqual({ 'cover.recorded': 0 });
    const unset = evaluate({
      modules: [module()],
      planned: [{ instanceId: 'i0', ruleId: 'set-cover' }]
    });
    expect(unset.effects.filter((e) => e.id.endsWith('effect-cover'))).toHaveLength(1);
    expect(unset.facts['cover.recorded']).toBe(0);
  });
});

describe('cover derives', () => {
  it('no record: current/effective/bonus all read 0', () => {
    const facts = factsWith([])(module());
    expect(facts['cover.current']).toBe(0);
    expect(facts['cover.effective']).toBe(0);
    expect(facts['cover.bonus']).toBe(0);
  });

  it('current/effective mirror the recorded degree; bonus is +2 half, +5 three-quarters, 0 none AND total', () => {
    for (const [degree, bonus] of [
      [0, 0],
      [1, 2],
      [2, 5],
      [3, 0]
    ] as const) {
      const facts = atDegree(degree);
      expect(facts['cover.recorded']).toBe(degree);
      expect(facts['cover.current']).toBe(degree);
      expect(facts['cover.effective']).toBe(degree);
      // Total cover grants NO bonus — it is notice-only ("can't be targeted
      // directly"), so degree 3 must read exactly like degree 0 here.
      expect(facts['cover.bonus']).toBe(bonus);
    }
  });

  it('re-apply REPLACES by key — a later degree never stacks on an earlier one', () => {
    const facts = evaluate({
      modules: [module()],
      committed: [coverEffect(1), coverEffect(2)]
    }).facts;
    expect(facts['cover.recorded']).toBe(2);
    expect(facts['cover.effective']).toBe(2);
    expect(facts['cover.bonus']).toBe(5);
  });

  it('the record is the only writer: with the effect gone every fact reads 0 again', () => {
    // The removal path itself is pinned in the yaml scenario (removeEffect);
    // here: nothing else the effect wrote needs undoing — its state is exactly
    // one fact, so dismissing the chip is a total revert.
    expect(coverEffect(2).state).toEqual({ 'cover.recorded': 2 });
    expect(factsWith([])(module())['cover.effective']).toBe(0);
  });
});

describe('ac reads cover (no second writer to ac.value)', () => {
  it('the AC sum reads the cover fact — seeded cover.bonus moves AC with NO cover module loaded', () => {
    // The anti-hardcode pin: ac.value is fed by the FACT, so an AC module set
    // that cannot know cover still shifts when the fact does.
    expect(evaluateSheet([ac], {})['ac.value']).toBe(10);
    expect(evaluateSheet([ac], { 'cover.bonus': 2 })['ac.value']).toBe(12);
    expect(evaluateSheet([ac], { 'cover.bonus': 5 })['ac.value']).toBe(15);
    expect(evaluateSheet([ac], { 'cover.bonus': 0 })['ac.value']).toBe(10);
  });

  it('end-to-end per degree: +2 half, +5 three-quarters, +0 none AND total', () => {
    expect(atDegree(0, ac)['ac.value']).toBe(10);
    expect(atDegree(1, ac)['ac.value']).toBe(12);
    expect(atDegree(2, ac)['ac.value']).toBe(15);
    // Total cover adds NOTHING to AC.
    expect(atDegree(3, ac)['ac.value']).toBe(10);
  });

  it('composes with worn armor and Dex like every other AC component', () => {
    const armored = evaluateSheet([ac], {
      'ac.armorBase': 17,
      'ac.dexIgnored': 1,
      'dex.modifier': 2,
      'cover.bonus': 2
    });
    expect(armored['ac.value']).toBe(19); // 17 + 0 + 2, not 21
  });
});

describe('cover annotate — the standing notice', () => {
  it('no notice at degree 0 (and none unrecorded)', () => {
    for (const committed of [[], [coverEffect(0)]]) {
      const out = evaluate({ modules: [module()], committed });
      expect(out.annotations.find((a) => a.key === `${C}.notice`)).toBeUndefined();
    }
  });

  it('one notice per positive degree, body keyed per state, bonus interpolated from the fact', () => {
    const bodyAt = (degree: number) => {
      const out = evaluate({ modules: [module()], committed: [coverEffect(degree)] });
      const notices = out.annotations.filter((a) => a.key === `${C}.notice`);
      expect(notices, 'exactly one standing notice').toHaveLength(1);
      return notices[0]!;
    };
    const half = bodyAt(1);
    expect(half.targets).toEqual(['notice']);
    expect(half.source).toBe(`${C}.effect.name`);
    expect(half.body).toBe(`${C}.notice.body.half`);
    expect(half.values).toEqual({ bonus: 2 });
    const threeQuarters = bodyAt(2);
    expect(threeQuarters.body).toBe(`${C}.notice.body.three-quarters`);
    expect(threeQuarters.values).toEqual({ bonus: 5 });
    // Total: notice-only copy, no bonus to state.
    const total = bodyAt(3);
    expect(total.body).toBe(`${C}.notice.body.total`);
    expect(total.values).toEqual({ bonus: 0 });
  });
});

describe('cover annotate — the Dex-save rider', () => {
  const riderAt = (degree: number) => {
    const out = evaluate({ modules: [module()], committed: [coverEffect(degree)] });
    return out.annotations.find((a) => a.key === `${C}.rider`);
  };

  it('no rider unrecorded, at None, or at Total (total grants no save bonus)', () => {
    expect(
      evaluate({ modules: [module()] }).annotations.find((a) => a.key === `${C}.rider`)
    ).toBeUndefined();
    expect(riderAt(0)).toBeUndefined();
    expect(riderAt(3)).toBeUndefined();
  });

  it('a toggleable +2/+5 modifier chip on the DEX save dice-line only', () => {
    for (const [degree, bonus] of [
      [1, 2],
      [2, 5]
    ] as const) {
      const rider = riderAt(degree)!;
      expect(rider, `rider exists at degree ${degree}`).toBeDefined();
      // save.dex — the player's record-save-dex panel. NOT save.any (cover
      // touches Dex saves only, unlike Aura of Protection/Exhaustion), and the
      // steed/vehicle `.companion` labels are deliberately unreachable.
      expect(rider.targets).toEqual(['save.dex']);
      expect(rider.rider).toEqual({
        label: `${C}.rider`,
        type: 'modifier',
        value: { kind: 'flat', bonus },
        appliesTo: 'save',
        defaultOn: true
      });
    }
  });
});

describe('cover i18n', () => {
  it('carries every module key in en', () => {
    expect(en.rule['dnd-5e-2024'][ID]).toEqual({
      'record.name': 'Cover',
      'record.description': 'Record the degree of cover you are behind',
      'degree.none': 'None',
      'degree.half': 'Half',
      'degree.three-quarters': 'Three-Quarters',
      'degree.total': 'Total',
      'effect.name': 'Cover',
      notice: 'Cover',
      'notice.body.half': 'Half cover grants a +{{bonus}} bonus to AC and Dexterity saving throws.',
      'notice.body.three-quarters':
        'Three-quarters cover grants a +{{bonus}} bonus to AC and Dexterity saving throws.',
      'notice.body.total': "Total cover: you can't be targeted directly.",
      rider: 'Cover'
    });
  });

  it('carries every module key in en-x-tlh (plausible values, normal casing)', () => {
    const keys = Object.keys(en.rule['dnd-5e-2024'][ID] ?? {});
    const tlhGroup: Record<string, unknown> = tlh.rule['dnd-5e-2024'][ID] ?? {};
    for (const key of keys) expect(tlhGroup[key], `en-x-tlh cover.${key}`).toBeDefined();
    // The interpolated bodies keep the {{bonus}} param the en key carries.
    expect(String(tlhGroup['notice.body.half'])).toContain('{{bonus}}');
  });

  it('labels the picker sub-bucket and the segmented prefix in both locales', () => {
    expect(en.play.verbBuckets.DEFEND.cover).toBe('Cover');
    expect(tlh.play.verbBuckets.DEFEND.cover).toBeDefined();
    expect(en.play.choices.cover.degree).toBe('Cover');
    expect(tlh.play.choices.cover.degree).toBeDefined();
  });
});
