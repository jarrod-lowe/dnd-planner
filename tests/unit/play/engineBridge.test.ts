import { describe, it, expect } from 'vitest';
import { effectInstanceToRule, adaptEngineOutput } from '$lib/play/engineBridge';
import {
  getEffectKind,
  getDurationState,
  isHiddenEffect,
  mergeActiveEffects
} from '$lib/play/effectUtils';
import { evaluate, endTurn, type EngineOutput } from '$lib/rules-engine';
import concentration from '$lib/rules-engine/rules/concentration';
import coreEvents from '$lib/rules-engine/rules/core-events';
import bless from '$lib/rules-engine/rules/bless';

/**
 * The engine→view bridges: committed EffectInstance → effect Rule (so the
 * active-effects UI reads it) and engine output → the view shape the store stores.
 */

describe('engineBridge — effectInstanceToRule', () => {
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

  it('an aged timed effect shows elapsed pips: total survives aging, remaining counts down', () => {
    const rule = effectInstanceToRule({
      id: 'effect-bless',
      key: 'bless',
      state: { 'concentration.spent': 1 },
      expiry: [{ kind: 'turns', remaining: 7, total: 10 }, { kind: 'untilShortRest' }]
    });
    const dur = getDurationState(rule);
    expect(dur?.remaining).toBe(7);
    expect(dur?.total).toBe(10); // 10 pips, 7 filled — not 7/7
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
    // The build lives as permanent committed effects — kept out of the strip.
    expect(isHiddenEffect(rule)).toBe(true);
  });

  it('display presence is the strip contract: no display → hidden, display → shown, display.hidden → named but hidden', () => {
    // A pure resource spend (no display) is bookkeeping — hidden.
    const slot = effectInstanceToRule({
      id: 'effect-bless-slot-l1',
      state: { 'spellcasting.slots.level1.spent': 1 },
      expiry: { kind: 'untilLongRest' }
    });
    expect(isHiddenEffect(slot)).toBe(true);

    // ANY display-less effect is hidden, whatever facts it touches (the old
    // fact-name heuristic let bookkeeping like attackAction.extraGranted leak
    // onto the strip as raw-id chips).
    const bookkeeping = effectInstanceToRule({
      id: 'spend',
      state: { 'actions.spent': 1, 'attackAction.extraGranted': 1 },
      expiry: { kind: 'endOfTurn' }
    });
    expect(isHiddenEffect(bookkeeping)).toBe(true);

    // A buff opts in via display.
    const buff = effectInstanceToRule({
      id: 'effect-aid',
      key: 'aid',
      state: { 'hp.temp': 5 },
      display: { name: 'rule.spell-aid.effect-aid.name' },
      expiry: { kind: 'untilLongRest' }
    });
    expect(isHiddenEffect(buff)).toBe(false);
    expect(buff.ui?.name).toBe('rule.spell-aid.effect-aid.name');

    // display.hidden keeps the name (for the reveal toggle) but stays off the strip.
    const named = effectInstanceToRule({
      id: 'effect-prepared-spells',
      key: 'prepared-spells',
      state: { 'spell.l1.bless.prepared': 1 },
      display: {
        name: 'rule.dnd-5e-2024.prepared-spells.effect-prepared-spells.name',
        hidden: true
      },
      expiry: { kind: 'permanent' }
    });
    expect(isHiddenEffect(named)).toBe(true);
    expect(named.ui?.name).toBe('rule.dnd-5e-2024.prepared-spells.effect-prepared-spells.name');

    // display.subject flows to ui.subject (steed view filtering).
    const steedChip = effectInstanceToRule({
      id: 'effect-steed-hp-damage',
      state: { 'companion.steed.hp.modifier.current': -3 },
      display: { name: 'rule.spell-find-steed.steed-record-damage.effect.name', subject: 'steed' },
      expiry: { kind: 'untilLongRest' }
    });
    expect(steedChip.ui?.subject).toBe('steed');
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

  it("maps display.value to ui.displayValue (a record chip's own amount)", () => {
    // A player damage record: keyless, stacking — each chip carries its OWN
    // literal amount (a shared displayFact would show the net on every chip).
    const rule = effectInstanceToRule({
      id: 'i1#0#effect-hp-damage',
      state: { 'hp.modifier.current': -7 },
      display: { name: 'rule.dnd-5e-2024.core-events.effect-hp-damage.name', value: 7 },
      expiry: { kind: 'untilLongRest' }
    });
    expect(rule.ui?.displayValue).toBe(7);
  });
});

const makeOutput = (overrides: Partial<EngineOutput> = {}): EngineOutput => ({
  status: { ok: true, legal: true, applicable: true },
  facts: { 'hp.max': 10 },
  availableRules: [
    {
      rule: { id: 'unarmed-strike-use-action', ui: {} },
      legal: true,
      applicable: true,
      diagnostics: []
    }
  ],
  planDiagnostics: {},
  plannedOffers: {},
  annotations: [],
  effects: [
    {
      id: 'effect-bless',
      key: 'bless',
      state: { 'bless.active': 1 },
      expiry: { kind: 'permanent' }
    }
  ],
  diagnostics: { errors: [], warnings: [], notices: [] },
  next: { modules: [] },
  ...overrides
});

describe('engineBridge — adaptEngineOutput', () => {
  it('carries facts/effects; availableRules is the offer catalog ONLY (no instance entries)', () => {
    const out = adaptEngineOutput(
      makeOutput({ planDiagnostics: { i0: [{ code: 'no_action', severity: 'error' }] } })
    );
    expect(out.facts).toEqual({ 'hp.max': 10 });
    // The committed effect became a view effect Rule.
    expect(out.effects.map((e) => e.id)).toEqual(['effect-bless']);
    // Planned-instance legality is NOT mixed into availableRules — it flows to the
    // plan rows via the store's plannedEntries map. Mixing instance entries here
    // leaked them into the add/search pickers as unresolvable duplicates.
    expect(out.availableRules.map((e) => e.rule.id)).toEqual(['unarmed-strike-use-action']);
    // View-shape fields are present (stubbed).
    expect(out.collections).toEqual({});
  });

  it('synthesizes the spellcasting.saveAbility label from the class flag fact', () => {
    // Engine facts are numeric-only; the class contributes a flag
    // (spellcasting.saveAbility.cha = 1) and the bridge synthesizes the 'CHA'
    // string the spell panels' saveDc label reads (legacy set it via stringSet).
    const out = adaptEngineOutput(
      makeOutput({ facts: { 'hp.max': 10, 'spellcasting.saveAbility.cha': 1 } })
    );
    expect(out.facts['spellcasting.saveAbility']).toBe('CHA');
    // Numeric flag survives too; nothing is synthesized without a flag.
    expect(out.facts['spellcasting.saveAbility.cha']).toBe(1);
    expect(adaptEngineOutput(makeOutput()).facts['spellcasting.saveAbility']).toBeUndefined();
  });

  it('synthesizes companion.steed.damageType from the numeric creatureType', () => {
    // The steed's slam damage-type label is a string the numeric engine can't
    // hold; the bridge maps the numeric creatureType (0/1/2) to the label the
    // dice-line + description read, but only while a steed is summoned.
    const dt = (creatureType: number) =>
      adaptEngineOutput(
        makeOutput({
          facts: { 'companion.steed.summoned': 1, 'companion.steed.creatureType': creatureType }
        })
      ).facts['companion.steed.damageType'];
    expect(dt(0)).toBe('radiant'); // celestial
    expect(dt(1)).toBe('psychic'); // fey
    expect(dt(2)).toBe('necrotic'); // fiend
    // No steed summoned → no label synthesized (creatureType 0 must not read as radiant).
    expect(
      adaptEngineOutput(makeOutput({ facts: { 'companion.steed.creatureType': 0 } })).facts[
        'companion.steed.damageType'
      ]
    ).toBeUndefined();
  });
});

/**
 * The concentration-eviction strip behavior, through the REAL shapes the app
 * runs: PlayCharacterMode derives the strip as `mergeActiveEffects(
 * committed.map(effectInstanceToRule), engineOutput.effects)` — and the engine
 * side of that chain is the actual concentration-check fold (cast committed,
 * damage recorded, failed roll advertising the empty same-key eviction).
 * mergeActiveEffects' same-key suppression is already pinned generically
 * (Dismiss Steed); this pins that the concentration pair survives the bridge:
 * the committed spell chip drops, and the eviction's own chip — an EMPTY
 * effect whose only payload is `display` — renders visible under section
 * 'other'.
 */
describe('engineBridge — the concentration-broken eviction on the strip', () => {
  it('a failed check drops the committed spell chip and shows the broken chip', () => {
    const modules = [concentration, coreEvents, bless];
    const inputFacts = { 'spell.l1.bless.prepared': 1, 'con.save': 2 };
    // Turn 1: cast Bless, commit it.
    const cast = evaluate({
      modules,
      inputFacts,
      planned: [{ instanceId: 'b1', ruleId: 'cast-bless' }]
    });
    const committed = endTurn([], cast.effects);
    // Turn 2: 25 damage (DC 12), then a rolled natural 1 (+2 = 3) — a fail.
    const failed = evaluate({
      modules,
      inputFacts,
      committed,
      planned: [
        { instanceId: 'd1', ruleId: 'record-damage', selections: { amount: 25 } },
        { instanceId: 'c1', ruleId: 'concentration-check', selections: { roll: 1 } }
      ]
    });
    expect(failed.facts['concentration.remaining']).toBe(1); // the fold evicted

    // The strip, composed exactly as PlayCharacterMode composes it.
    const strip = mergeActiveEffects(
      committed.map(effectInstanceToRule),
      failed.effects.map(effectInstanceToRule)
    );
    // The spell's chip is gone: the eviction shares its key, so the committed
    // keyed chip is suppressed while the failure is still merely planned.
    expect(strip.some((r) => r.id === 'effect-bless')).toBe(false);
    // The eviction's own chip renders: display opts it onto the strip (an
    // EMPTY effect — no state, so no concentration activity — is hidden
    // without one), named, section 'other' (in the SECTIONS union), an
    // ONGOING chip.
    const broken = strip.find((r) => r.ui?.name === 'planner.concentration.broken');
    expect(broken, 'the broken chip is on the strip').toBeDefined();
    expect(broken!.ui?.section).toBe('other');
    expect(isHiddenEffect(broken!)).toBe(false);
    expect(getEffectKind(broken!)).toBe('ONGOING');
  });
});
