import { describe, it, expect } from 'vitest';
import { evaluate, evaluatePlan, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import sanctuary from '$lib/rules-engine/rules/sanctuary';

/**
 * Notices batch 2 — Sanctuary's ward reminder.
 *
 * The ward used to be a display-only duration chip with no spell-specific
 * fact, so nothing could gate a reminder on it. The cast now writes
 * `sanctuary.active: 1` on the committed `effect-sanctuary` marker (the
 * `ssmite.burnDice` precedent): the fact lives exactly as long as the effect —
 * dismissing the chip (un-committing) removes the state delta, so the fact
 * reads 0 again and the notice goes with it. While the ward is live, a NOTICE
 * carries the attacker-save rule, its DC interpolated from
 * `spellcasting.saveDC`. The rule module cannot import the constant (rule
 * modules import only the builder), so this test pins its literal 'notice' to
 * NOTICE_TARGET.
 */
const R = 'rule.spell-sanctuary';
const ALL = [actionEconomy, spellcasting, sanctuary];
// A genuine L1 caster kit for this module set: slots + prepared are inputs (no
// class-level module here), and prof/modifier make the save DC a real number.
const FACTS: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.sanctuary.prepared': 1,
  'proficiency.bonus': 2,
  'spellcasting.modifier': 4
};
const cast = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-sanctuary' });

describe('sanctuary annotate — notice', () => {
  it('a committed ward raises a notice carrying the spell save DC', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [cast('c1')] });
    expect(out.facts['sanctuary.active'], 'the ward is live in this state').toBe(1);
    expect(out.facts['spellcasting.saveDC']).toBe(14); // 8 + 2 prof + 4 modifier
    const notice = out.annotations.find((a) => a.key === `${R}.notice`);
    expect(notice, 'notice exists while the ward is live').toBeDefined();
    expect(notice!.targets).toEqual([NOTICE_TARGET]);
    expect(notice!.source).toBe(`${R}.offer-sanctuary.name`);
    expect(notice!.body).toBe(`${R}.notice.body`);
    expect(notice!.values).toEqual({ dc: out.facts['spellcasting.saveDC'] });
  });

  it('emits no notice while unwarded', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [] });
    expect(out.facts['sanctuary.active'] ?? 0).toBe(0);
    expect(out.annotations.find((a) => a.key === `${R}.notice`)).toBeUndefined();
  });

  it('un-committing the ward chip removes the fact and the notice with it', () => {
    const { advertised } = evaluatePlan(ALL, FACTS, [cast('c1')]);
    // The committed marker keeps the ward (and its notice) alive…
    const committed = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [],
      committed: advertised
    });
    expect(committed.facts['sanctuary.active']).toBe(1);
    expect(committed.annotations.some((a) => a.key === `${R}.notice`)).toBe(true);

    // …and dismissing the chip drops the effect, whose state delta was the ONLY
    // writer of the fact — so the ward (and the notice it gates) is gone.
    const dismissed = advertised.filter((e) => e.id.split('#').pop() !== 'effect-sanctuary');
    const after = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [],
      committed: dismissed
    });
    expect(after.facts['sanctuary.active'] ?? 0).toBe(0);
    expect(after.annotations.find((a) => a.key === `${R}.notice`)).toBeUndefined();
  });

  it('the body template interpolates only the DC — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const ns = (catalog.rule as unknown as Record<string, Record<string, string | undefined>>)[
        'spell-sanctuary'
      ];
      const body = ns?.['notice.body'];
      expect(body, 'body template exists').toBeDefined();
      // {{dc}} double-brace (sveltekit-i18n), and it is the ONLY param.
      expect(body?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{dc}}']);
    }
  });
});
