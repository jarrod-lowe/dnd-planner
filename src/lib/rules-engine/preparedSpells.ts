import type { PrepareDef, RuleModule } from './types';

/**
 * The prepared-spells enumerator.
 *
 * `set-prepared-spells` commits the WHOLE prepared set at once, so the unit of
 * choice is the set, not the spell. This file turns the modules a character has
 * assigned (those declaring `RuleModule.prepare`) into the rows the picker can
 * show, and the facts a given selection's single effect must set.
 *
 * Pure and registry-driven: it reads nothing but the modules handed to it, so
 * the UI (which already resolves a character's groups to modules) and the tests
 * get the same list from the same input, independent of module order.
 */

/**
 * Every preparable spell among the given modules, ordered by level ascending
 * then spellId ascending (so the list is stable however the modules arrive).
 * The picker renders rows alphabetically by TRANSLATED name; this ordering only
 * pins the enumeration itself, like `enumerateLoadouts`'s hands-then-id order.
 */
export function enumeratePreparableSpells(modules: RuleModule[]): PrepareDef[] {
  return modules
    .filter((m) => m.prepare)
    .map((m) => m.prepare!)
    .sort(
      (a, b) => a.level - b.level || (a.spellId < b.spellId ? -1 : a.spellId > b.spellId ? 1 : 0)
    );
}

/**
 * The `state` / `stateCombine` of the single keyed effect a selection commits:
 * one `prepared` fact per selected spell. `max` (not the default `sum`) lets the
 * effect compose with a class always-prepared GRANT writing the same fact — the
 * picker's replacement semantics must never clobber a grant to 0.
 */
export function preparedEffectState(selected: PrepareDef[]): {
  state: Record<string, number>;
  stateCombine: Record<string, 'max'>;
} {
  const state: Record<string, number> = {};
  const stateCombine: Record<string, 'max'> = {};
  for (const def of selected) {
    state[def.preparedFact] = 1;
    stateCombine[def.preparedFact] = 'max';
  }
  return { state, stateCombine };
}
