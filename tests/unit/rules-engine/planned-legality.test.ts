import { describe, it, expect } from 'vitest';
import { evaluate, plannedEntries } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import { enumerateLoadouts, loadoutEffectState } from '$lib/rules-engine/loadout';
import type { LoadoutConfig } from '$lib/rules-engine/loadout';
import hands from '$lib/rules-engine/rules/hands';
import loadout from '$lib/rules-engine/rules/loadout';
import shield from '$lib/rules-engine/rules/shield';

/**
 * A planned action's legality follows "a `legalWhen` gate failed" — matching the
 * add catalog (`evaluateOffers`) — NOT the severity of the diagnostics it emits.
 *
 * `set-loadout`'s shield-training gate carries that case: it fails with WARNING
 * severity while an untrained shield is in hand, and still blocks, so the planned
 * row must read illegal exactly as the catalog row does. (It inherited the case
 * from the deleted `don-shield`, which was the codebase's only warning-severity
 * gate; the gate now reads the RESULTING state — a shield actually held — because
 * a `legalWhen` condition sees facts, not the pending selection.)
 *
 * The contrast test at the bottom pins the other half of the same rule: a warning
 * an `apply` RETURNS is not a gate failure and does not block. Both halves are
 * needed — "legality ignores severity" would otherwise be satisfiable by blocking
 * on every warning, or on none.
 */
const MODULES = [shield, loadout, hands];

/** The only configurations this module set admits: nothing held, or a shield. */
function configOf(id: string): LoadoutConfig {
  const found = enumerateLoadouts(MODULES).find((c) => c.id === id);
  if (!found) throw new Error(`no such configuration: ${id}`);
  return found;
}

const setLoadout: PlannedRef = {
  instanceId: 'i0',
  ruleId: 'set-loadout',
  selections: { loadout: configOf('shield') }
};

/**
 * A shield already in hand from an earlier turn — the state that closes the gate.
 * Built from the enumerator's own state map, so the fixture cannot drift from
 * what `set-loadout` actually commits.
 */
const alreadyHeld: EffectInstance[] = [
  {
    id: 'effect-loadout',
    key: 'loadout',
    state: loadoutEffectState(configOf('shield')),
    expiry: { kind: 'permanent' }
  }
];

const UNTRAINED = { 'armor.shield.proficient': 0 };
const TRAINED = { 'armor.shield.proficient': 1 };
const NOT_PROFICIENT = 'rule.dnd-5e-2024.loadout.set-loadout-offer.not-proficient';
const WARNING = { code: NOT_PROFICIENT, severity: 'warning' };

describe('planned legality — a warning-severity gate failure still blocks', () => {
  it('catalog marks set-loadout illegal while an untrained shield is held (warning gate)', () => {
    const out = evaluate({ modules: MODULES, inputFacts: UNTRAINED, committed: alreadyHeld });
    const row = out.availableRules.find((o) => o.rule.id === 'set-loadout');
    expect(row?.legal).toBe(false);
    expect(row?.diagnostics).toContainEqual(WARNING);
  });

  it('keeps the planned row illegal too — via plannedOffers and the adapter', () => {
    const out = evaluate({
      modules: MODULES,
      inputFacts: UNTRAINED,
      planned: [setLoadout],
      committed: alreadyHeld
    });
    expect(out.planDiagnostics['i0']).toContainEqual(WARNING);
    expect(out.plannedOffers['i0'].legal).toBe(false);
    expect(plannedEntries(out, [setLoadout])[0].legal).toBe(false);
    // The global status (the Ledger over-budget indicator) reflects it too — a
    // warning gate must not read as globally legal while the row is illegal.
    expect(out.status.legal).toBe(false);
  });

  it('is legal once the character is proficient', () => {
    const out = evaluate({
      modules: MODULES,
      inputFacts: TRAINED,
      planned: [setLoadout],
      committed: alreadyHeld
    });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(plannedEntries(out, [setLoadout])[0].legal).toBe(true);
    expect(out.status.legal).toBe(true);
    expect(out.availableRules.find((o) => o.rule.id === 'set-loadout')?.legal).toBe(true);
  });

  it('contrast: a warning an `apply` returns surfaces on the row without blocking', () => {
    // Nothing held yet, so the gate passes at this step and only `apply` — which
    // can see the chosen configuration — raises the warning. The row stays legal
    // and the shield still goes on: picking up an untrained shield is flagged,
    // never prevented.
    const out = evaluate({ modules: MODULES, inputFacts: UNTRAINED, planned: [setLoadout] });
    expect(out.planDiagnostics['i0']).toContainEqual(WARNING);
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(plannedEntries(out, [setLoadout])[0].legal).toBe(true);
    expect(out.status.legal).toBe(true);
    expect(out.facts['armor.shield.equipped']).toBe(1);
  });
});
