import {
  enumerateLoadouts,
  loadoutEffectState,
  type LoadoutConfig
} from '$lib/rules-engine/loadout';
import type { RuleModule } from '$lib/rules-engine/types';
import type { Facts } from '$lib/rules-view';

/**
 * Which legal configuration the character is holding right now.
 *
 * The loadout is stored as a keyed effect, not as a selection, so the only way
 * back from the settled sheet to "what is in my hands" is to read the facts the
 * effect wrote. Each configuration knows the facts it commits
 * (`loadoutEffectState`), so the match is an exact comparison against those —
 * including `hands.spent`, which is what separates one dagger from two, and a
 * one-handed grip from a versatile weapon held in both hands.
 *
 * This is what lets the picker open on the row the player is already on rather
 * than on empty hands (which, committed, would disarm them).
 */
export function currentLoadout(modules: RuleModule[], facts: Facts): LoadoutConfig {
  const configs = enumerateLoadouts(modules);
  const empty = configs.find((c) => c.id === 'empty') ?? configs[0];

  const states = configs.map((config) => loadoutEffectState(config));

  // Every fact ANY configuration can write. The comparison has to run over the
  // whole set, not just the candidate's own keys: a spear held in one hand and
  // a spear in each hand write the same `weapon.spear.equipped` and the same
  // `hands.spent`, and differ only by the `twoHanded` fact one of them leaves
  // unset. Checking a candidate's own keys alone would match the wrong row.
  const owned = new Set<string>();
  for (const state of states) for (const fact of Object.keys(state)) owned.add(fact);

  for (const [index, config] of configs.entries()) {
    const state = states[index];
    // An absent fact reads as 0: the engine drops facts that settle to nothing,
    // so "no shield" arrives as a missing key rather than a zero.
    const matches = [...owned].every((fact) => (facts[fact] ?? 0) === (state[fact] ?? 0));
    if (matches) return config;
  }

  // No match means the facts were not written by any configuration this roster
  // can produce (a legacy per-item equip chip, or an item since unassigned).
  // Empty hands is the honest answer, and the safe one: it claims nothing.
  return empty;
}
