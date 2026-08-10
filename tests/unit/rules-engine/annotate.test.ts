import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EngineInput, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import paladinSmite from '$lib/rules-engine/rules/paladin-smite';
import divineSmite from '$lib/rules-engine/rules/divine-smite';

/**
 * M1 / W2 — the annotate pass.
 *
 * `annotate?(f)` is evaluated against the final post-plan facts and emits the view-contract
 * Annotation { key, targets, rider? } the UI's getMatchingAnnotations consumes.
 * Divine Smite is the first ported example: it annotates melee/unarmed attacks
 * only while the smite is actually usable (prepared + an attack taken this turn +
 * a bonus action + spellcasting + a resource left), matching the legacy rule.
 */
const ALL = [actionEconomy, attacks, spellcasting, paladinSmite, divineSmite];
// Slots are a genuine input here (no paladin level module in ALL); prepared is
// NOT — paladin-smite itself contributes prepared = 1 (always-prepared), and
// the sheet rejects inputs that overlap contributions.
const PREPARED = { 'spellcasting.slots.level1.total': 2 };

const attack = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const smite = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-divine-smite' });
const DS_KEY = 'rule.spell-divine-smite.annotation';

describe('annotate pass — Divine Smite attack annotation', () => {
  it('emits no annotation before an attack is taken', () => {
    const out = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [] });
    expect(out.annotations.find((a) => a.key === DS_KEY)).toBeUndefined();
  });

  it('annotates melee/unarmed attacks once an attack is taken and smite is usable', () => {
    const input: EngineInput = { modules: ALL, inputFacts: PREPARED, planned: [attack('a1')] };
    const out = evaluate(input);
    const ann = out.annotations.find((a) => a.key === DS_KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual(['attack.melee', 'attack.unarmed']);
  });

  it('omits the annotation when the spell is not prepared', () => {
    // Without the Paladin's Smite feature (paladin-smite makes Divine Smite
    // always-prepared), and with prepared unset, the gate fails — no annotation.
    const out = evaluate({
      modules: [actionEconomy, attacks, spellcasting, divineSmite],
      inputFacts: { 'spellcasting.slots.level1.total': 2 },
      planned: [attack('a1')]
    });
    expect(out.annotations.find((a) => a.key === DS_KEY)).toBeUndefined();
  });

  it('drops the annotation once the smite is cast (bonus action + spellcasting spent)', () => {
    const out = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [attack('a1'), smite('s1')]
    });
    expect(out.annotations.find((a) => a.key === DS_KEY)).toBeUndefined();
  });
});
