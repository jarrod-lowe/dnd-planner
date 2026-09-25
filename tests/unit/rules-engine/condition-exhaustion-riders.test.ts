import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import conditionExhaustion from '$lib/rules-engine/rules/condition-exhaustion';

/**
 * The Exhaustion D20-test riders (docs/plans/ideas/condition-exhaustion.md,
 * PR3): SRD 5.2 "When you make a D20 Test, the roll is reduced by 2 times
 * your Exhaustion level" — a RIDER, not a derive (the Aura of Protection
 * precedent: the ROLL is reduced; the attack/save modifiers and the top bar
 * stay untouched), so while any level is live the annotate emits THREE
 * flat-rider annotations, one per D20 Test kind (`appliesTo` is
 * single-purpose): to-hit on attack.any (every weapon + unarmed), check on
 * dice.any (skills, record-check, Initiative — a Dex check), save on save.any
 * (the 6 save recorders + concentration). PanelDiceLine's purpose filter
 * keeps each on its own dice, so the check rider never leaks onto a weapon
 * panel's damage die even though weapon panels also carry dice.any. The YAML
 * grammar asserts existence/targets only — the −2 × level VALUES (and the
 * shared chip label + explicit defaultOn) are pinned here. These are the
 * FIRST to-hit/check flat riders in the repo; the negative chip's RENDER is
 * pinned in PanelDiceLine-summary.test.ts.
 */
const CE = 'rule.dnd-5e-2024.condition-exhaustion';
const ALL = [conditionExhaustion];
const FACTS: Facts = {};
const record = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'record-exhaustion' });

const RIDER_KEYS = [
  { key: `${CE}.rider-to-hit`, targets: ['attack.any'], appliesTo: 'to-hit' },
  { key: `${CE}.rider-check`, targets: ['dice.any'], appliesTo: 'check' },
  { key: `${CE}.rider-save`, targets: ['save.any'], appliesTo: 'save' }
] as const;

const ridersAt = (planned: PlannedRef[]) => {
  const out = evaluate({ modules: ALL, inputFacts: FACTS, planned });
  return RIDER_KEYS.map(({ key }) => out.annotations.find((a) => a.key === key));
};

describe('condition-exhaustion annotate — the three D20-test riders', () => {
  it('emits no rider at level 0', () => {
    for (const rider of ridersAt([])) expect(rider, 'absent while unexhausted').toBeUndefined();
  });

  it('carries the shared chip label, an explicit defaultOn, and −2 × level per kind', () => {
    for (const [i, { key, targets, appliesTo }] of RIDER_KEYS.entries()) {
      const rider = ridersAt([record('c1')])[i]!;
      expect(rider, `${key} exists at level 1`).toBeDefined();
      expect(rider.targets).toEqual(targets);
      expect(rider.rider).toEqual({
        label: `${CE}.rider`,
        type: 'modifier',
        value: { kind: 'flat', bonus: -2 },
        appliesTo,
        // Explicit (the Aura precedent omits it; the UI defaults true anyway)
        defaultOn: true
      });
    }
  });

  it('scales with the FOLDED level — −4 at level 2, −12 at the level-6 maximum', () => {
    for (const rider of ridersAt([record('c1'), record('c2')]))
      expect(rider!.rider!.value, 'the counter, not a stack: −2 × the folded level').toEqual({
        kind: 'flat',
        bonus: -4
      });
    const max = [
      record('c1'),
      record('c2'),
      record('c3'),
      record('c4'),
      record('c5'),
      record('c6')
    ];
    for (const rider of ridersAt(max))
      expect(rider!.rider!.value).toEqual({ kind: 'flat', bonus: -12 });
  });
});
