import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateSheet, endTurn } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import paladinL1 from '$lib/rules-engine/rules/class-paladin-level1';
import holdPerson from '$lib/rules-engine/rules/hold-person';
import oathL5 from '$lib/rules-engine/rules/class-paladin-oath-redemption-level5';

/**
 * The prepared-spell count is LIVE, not baked: a manual preparation counts
 * against `spellcasting.prepared.count` only while the spell is not granted
 * always-prepared. The grant can arrive AFTER the preparation (prepare Hold
 * Person early, take Oath of Redemption L5 later); the persisted prepare effect
 * must stop consuming a slot the moment the grant is active — and unprepare is
 * illegal for an always-prepared spell, so a baked count could never be evicted.
 * The yaml scenario covers the grant-already-active order; this pins the
 * prepare-BEFORE-grant order, which needs the module set to change between
 * evaluations.
 */

const base: RuleModule[] = [spellcasting, paladinL1, holdPerson];
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/** Prepare Hold Person with no always-prepared grant assigned, and commit it. */
function prepareThenCommit(): ReturnType<typeof endTurn> {
  const out = evaluatePlan(base, {}, [ref('i0', 'prepare-hold-person')]);
  return endTurn([], out.advertised, {});
}

describe('prepared-spell count — manual prepare, then an always-prepared grant', () => {
  it('the manual preparation counts against the limit while ungranted', () => {
    const facts = evaluateSheet(base, {}, prepareThenCommit());
    expect(facts['spell.l2.holdPerson.prepared']).toBe(1);
    expect(facts['spellcasting.prepared.count']).toBe(1);
  });

  it('a LATER grant frees the slot the stale manual-prepare effect consumed', () => {
    const facts = evaluateSheet([...base, oathL5], {}, prepareThenCommit());
    expect(facts['spell.l2.holdPerson.prepared']).toBe(1);
    expect(facts['spell.l2.holdPerson.alwaysPrepared']).toBe(1);
    expect(facts['spellcasting.prepared.count']).toBe(0);
  });
});
