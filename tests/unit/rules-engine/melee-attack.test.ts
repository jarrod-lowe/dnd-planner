import { describe, it, expect } from 'vitest';
import { evaluatePlan } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import hands from '$lib/rules-engine/rules/hands';
import grapple from '$lib/rules-engine/rules/grapple';
import shove from '$lib/rules-engine/rules/shove';
import dagger from '$lib/rules-engine/rules/dagger';
import spear from '$lib/rules-engine/rules/spear';

/**
 * `attack.last.melee` — "a melee attack was made this turn".
 *
 * The smites ride on hitting with a Melee weapon or an Unarmed Strike, which is
 * neither "the Attack action was taken" (`attack.last.activation.action`, also
 * set by Grapple, Shove and a thrown hit) nor "a weapon attack was made"
 * (`attack.last.weapon`, which excludes the Unarmed Strike the smites allow).
 * This file pins every writer of the new fact, and every near-miss that must
 * NOT write it.
 *
 * Melee-ness of a WEAPON swing is a per-row choice: the dice line's range band.
 * The band the row is cycled to is persisted as the `rangeIndex` selection
 * (PanelDiceLine → playStore.updateSelections → PlannedRef.selections), and
 * `rangesFor` already stamps `meleeAttack` on every band, so the weapon applies
 * read the selection and look the band up.
 */
const ALL = [actionEconomy, attacks, hands, grapple, shove, dagger, spear];

/** Both throwable weapons in hand; the Light off-hand swing granted. */
const EQUIPPED: Facts = {
  'weapon.dagger.equipped': 1,
  'weapon.spear.equipped': 1,
  'capability.attack.bonus.light': 1
};

const plan = (instanceId: string, ruleId: string, selections?: Record<string, unknown>) =>
  ({ instanceId, ruleId, ...(selections ? { selections } : {}) }) as PlannedRef;

describe('attack.last.melee — weapon Attack action', () => {
  it('is set by a swing on the weapon melee band', () => {
    // Band 0 of a spear is `{ distance: 5, type: 'melee' }`.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [
      plan('a1', 'spear-use-action', { rangeIndex: 0 })
    ]);
    expect(facts['attack.last.melee']).toBe(1);
  });

  it('is NOT set by a swing on a thrown band, which is still a weapon attack', () => {
    // Band 1 of a spear is `{ distance: 20, type: 'thrown' }` — a RANGED attack.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [
      plan('a1', 'spear-use-action', { rangeIndex: 1 })
    ]);
    expect(facts['attack.last.melee'] ?? 0).toBe(0);
    expect(facts['attack.last.weapon']).toBe(1); // throwing a spear still throws a WEAPON
    expect(facts['attack.last.activation.action']).toBe(1); // and it IS the Attack action
  });

  it('defaults to band 0 — the melee band — when the row carries no range selection', () => {
    // Adding a row without touching the range chip leaves no `rangeIndex`; the
    // panel opens on band 0, so that is the band the swing is credited to.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('a1', 'spear-use-action')]);
    expect(facts['attack.last.melee']).toBe(1);
  });
});

describe('attack.last.melee — swings outside the Attack action', () => {
  it('is set by a weapon opportunity attack, with no Attack action taken', () => {
    // The reaction offer is built from a melee-only def (thrown bands dropped),
    // so an opportunity attack is a melee attack whatever the weapon can throw.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('r1', 'spear-use-reaction-weapon')]);
    expect(facts['attack.last.melee']).toBe(1);
    expect(facts['attack.last.activation.action'] ?? 0).toBe(0);
    expect(facts['actions.remaining']).toBe(1);
  });

  it('is set by a Light off-hand bonus swing on the melee band', () => {
    const { facts } = evaluatePlan(ALL, EQUIPPED, [
      plan('b1', 'dagger-use-bonus-followup-light', { rangeIndex: 0 })
    ]);
    expect(facts['attack.last.melee']).toBe(1);
    expect(facts['attack.last.activation.action'] ?? 0).toBe(0);
  });

  it('is NOT set by a Light off-hand swing cycled to a thrown band', () => {
    // A dagger is Light AND thrown; throwing the off-hand dagger is ranged.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [
      plan('b1', 'dagger-use-bonus-followup-light', { rangeIndex: 1 })
    ]);
    expect(facts['attack.last.melee'] ?? 0).toBe(0);
    expect(facts['attack.last.weapon']).toBe(1);
  });
});

describe('attack.last.melee — Unarmed Strike', () => {
  it('is set by an unarmed strike taken as the Attack action', () => {
    // An Unarmed Strike is melee by definition and the smites name it
    // explicitly, so it sets the melee marker — even though it is NOT a weapon
    // and so never sets `attack.last.weapon`.
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('a1', 'unarmed-strike-use-action')]);
    expect(facts['attack.last.melee']).toBe(1);
    expect(facts['attack.last.weapon'] ?? 0).toBe(0);
  });

  it('is set by an unarmed opportunity attack', () => {
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('r1', 'unarmed-strike-use-reaction')]);
    expect(facts['attack.last.melee']).toBe(1);
    expect(facts['attack.last.weapon'] ?? 0).toBe(0);
    expect(facts['attack.last.activation.action'] ?? 0).toBe(0);
  });
});

describe('attack.last.melee — the Attack action without an attack', () => {
  it('is NOT set by Grapple, which takes the Attack action but makes no attack roll', () => {
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('g1', 'grapple-action')]);
    expect(facts['attack.last.activation.action']).toBe(1); // the Attack action WAS taken
    expect(facts['attack.last.melee'] ?? 0).toBe(0); // but nothing was hit
  });

  it('is NOT set by Shove, for the same reason', () => {
    const { facts } = evaluatePlan(ALL, EQUIPPED, [plan('s1', 'shove-action')]);
    expect(facts['attack.last.activation.action']).toBe(1);
    expect(facts['attack.last.melee'] ?? 0).toBe(0);
  });

  it('is absent on a turn with no attack at all', () => {
    const { facts } = evaluatePlan(ALL, EQUIPPED, []);
    expect(facts['attack.last.melee'] ?? 0).toBe(0);
  });
});
