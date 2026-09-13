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
 * alone does not seed a spell.
 *
 * A grant-covered spell — `alwaysPrepared` 1 — does not seed either, even when
 * the grant also wrote `prepared` 1. The panel renders such rows checked from
 * its own `locked ||` read of the `alwaysPrepared` fact and excludes them from
 * every count; seeding one would make an untouched commit bake `prepared: 1`
 * into the permanent `prepared-spells` effect, turning a class-granted
 * preparation into a manual one that outlives the grant (e.g. after unassigning
 * the granting feature) and silently consumes cap.
 */
export function currentPrepared(modules: RuleModule[], facts: Facts): PrepareDef[] {
  return enumeratePreparableSpells(modules).filter(
    (def) => (facts[def.preparedFact] ?? 0) === 1 && (facts[def.alwaysPreparedFact] ?? 0) !== 1
  );
}
