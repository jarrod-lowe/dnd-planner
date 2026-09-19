import { describe, it, expect } from 'vitest';
import { evaluate, evaluatePlan, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import concentration from '$lib/rules-engine/rules/concentration';
import holdPerson from '$lib/rules-engine/rules/hold-person';

/**
 * Notices batch 2 — Hold Person's repeat-save reminder (reinstated by user
 * ruling: a target-side ongoing effect with a save is strip-notice material —
 * the Searing Smite burn notice is the precedent — because the player needs
 * the standing reminder that the effect can lapse).
 *
 * The hold used to be a display-only duration chip: it wrote
 * `concentration.spent` but no spell-specific fact, so nothing could gate a
 * reminder on the spell itself. The cast now also writes `holdPerson.active: 1`
 * on the committed `effect-hold-person` marker (the `ssmite.burnDice`
 * precedent): the fact lives exactly as long as the effect — dismissing the
 * chip (un-committing) removes the state delta (and releases concentration),
 * so the fact reads 0 again and the notice goes with it. While a target is
 * held, a NOTICE carries the repeat-save rule, its DC interpolated from
 * `spellcasting.saveDC`. The concentration damage-save rule stays on the
 * damage recorder (`planner.concentration.annotation`) — one spell
 * legitimately owns both surfaces. The rule module cannot import the constant
 * (rule modules import only the builder), so this test pins its literal
 * 'notice' to NOTICE_TARGET.
 */
const P = 'rule.spell-hold-person';
const ALL = [actionEconomy, spellcasting, concentration, holdPerson];
// A genuine L2 caster kit for this module set: slots + prepared are inputs (no
// class-level module here), and prof/modifier make the save DC a real number.
const FACTS: Facts = {
  'spellcasting.slots.level2.total': 1,
  'spell.l2.holdPerson.prepared': 1,
  'proficiency.bonus': 2,
  'spellcasting.modifier': 4
};
const cast = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-hold-person' });

/**
 * record-damage's committed marker (core-events) — the genuine shape. The cast
 * itself now writes the same facts (its keyed clear, the pending-save moot), so
 * an INPUT fact would collide with the write (inputs are immutable); the marker
 * must ride the committed set, ordered AFTER the cast's effects so the damage
 * survives the fold (keyed, newest wins).
 */
const damageMarker = {
  id: 'concentration-damage-taken',
  key: 'concentration-damage-taken',
  state: { 'concentration.damage-taken': 1, 'concentration.last-damage': 25 },
  expiry: { kind: 'endOfTurn' as const }
};

describe('hold-person annotate — notice', () => {
  it('a committed hold raises a notice carrying the spell save DC', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [cast('c1')] });
    expect(out.facts['holdPerson.active'], 'a target is held in this state').toBe(1);
    expect(out.facts['spellcasting.saveDC']).toBe(14); // 8 + 2 prof + 4 modifier
    const notice = out.annotations.find((a) => a.key === `${P}.notice`);
    expect(notice, 'notice exists while a target is held').toBeDefined();
    expect(notice!.targets).toEqual([NOTICE_TARGET]);
    expect(notice!.source).toBe(`${P}.offer-hold-person.name`);
    expect(notice!.body).toBe(`${P}.notice.body`);
    expect(notice!.values).toEqual({ dc: out.facts['spellcasting.saveDC'] });
    // Concentration is held too, but no damage was recorded while holding
    // it, so the recorder reminder is off — no concentration save is owed,
    // and the reminder coincides with the concentration-check offer.
    expect(
      out.annotations.find((a) => a.key === 'planner.concentration.annotation')
    ).toBeUndefined();
    // With damage recorded while held, the two surfaces coexist, neither
    // replaces the other. The marker rides the committed set AFTER the hold
    // (the cast's advertised effects include its keyed clear of the same
    // facts; newest wins keeps the damage live).
    const damaged = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [],
      committed: [...out.effects, damageMarker]
    });
    expect(
      damaged.annotations.find((a) => a.key === 'planner.concentration.annotation')
    ).toBeDefined();
  });

  it('emits no notice while nothing is held', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [] });
    expect(out.facts['holdPerson.active'] ?? 0).toBe(0);
    expect(out.annotations.find((a) => a.key === `${P}.notice`)).toBeUndefined();
  });

  it('un-committing the hold chip removes the fact, the notice, and the concentration hold', () => {
    // Damage recorded while held (the marker committed after the cast's
    // advertised effects, so the damage survives the clear), so the recorder
    // reminder is live too — its disappearance below is the slot releasing,
    // not an absent marker.
    const { advertised } = evaluatePlan(ALL, FACTS, [cast('c1')]);
    const damaged = [...advertised, damageMarker];
    // The committed marker keeps the hold (and its notice) alive…
    const committed = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [],
      committed: damaged
    });
    expect(committed.facts['holdPerson.active']).toBe(1);
    expect(committed.annotations.some((a) => a.key === `${P}.notice`)).toBe(true);
    expect(committed.annotations.some((a) => a.key === 'planner.concentration.annotation')).toBe(
      true
    );

    // …and dismissing the chip drops the effect, whose state delta was the ONLY
    // writer of the fact — the hold (and the notice) is gone, and the
    // concentration spend went with the same effect: the slot is free, so no
    // spell is at risk and the recorder reminder goes too, marker or not.
    const dismissed = damaged.filter((e) => e.id.split('#').pop() !== 'effect-hold-person');
    const after = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [],
      committed: dismissed
    });
    expect(after.facts['holdPerson.active'] ?? 0).toBe(0);
    expect(after.annotations.find((a) => a.key === `${P}.notice`)).toBeUndefined();
    expect(after.facts['concentration.remaining']).toBe(1);
    expect(
      after.annotations.find((a) => a.key === 'planner.concentration.annotation')
    ).toBeUndefined();
  });

  it('the body template interpolates only the DC — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const ns = (catalog.rule as unknown as Record<string, Record<string, string | undefined>>)[
        'spell-hold-person'
      ];
      const body = ns?.['notice.body'];
      expect(body, 'body template exists').toBeDefined();
      // {{dc}} double-brace (sveltekit-i18n), and it is the ONLY param.
      expect(body?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{dc}}']);
    }
  });
});
