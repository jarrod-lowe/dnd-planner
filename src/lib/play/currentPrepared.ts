import { enumeratePreparableSpells } from '$lib/rules-engine/preparedSpells';
import type { Facts } from '$lib/rules-view';
import type { PrepareDef, RuleModule } from '$lib/rules-engine/types';

/**
 * Which spells the character has prepared right now.
 *
 * The prepared set is stored as a committed effect's facts, not as a selection,
 * so the only way back from the settled sheet to "what is in my spellbook" is to
 * read the `prepared` facts the effect wrote. Each preparable spell declares its
 * own fact (`PrepareDef.preparedFact`), so the match is per-spell: prepared fact
 * reads 1, the spell is in the set.
 *
 * This is what lets the picker open on the set the player already has rather
 * than on an empty one (which, committed, would unprepare everything). Like
 * `currentLoadout`, it claims only what the facts carry: an absent fact reads as
 * 0 — the engine drops facts that settle to nothing — and `alwaysPrepared`
 * alone does not seed a spell. The panel renders such rows checked from its own
 * read of the `alwaysPrepared` fact and excludes them from every count, so
 * membership would be inert; seeding it would only make an untouched commit
 * write a `prepared` fact the character never had.
 */
export function currentPrepared(modules: RuleModule[], facts: Facts): PrepareDef[] {
  return enumeratePreparableSpells(modules).filter((def) => (facts[def.preparedFact] ?? 0) === 1);
}
