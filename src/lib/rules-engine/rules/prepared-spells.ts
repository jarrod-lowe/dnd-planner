import {
  defineRule,
  notLockedLegal,
  preparedEffectState,
  type ActionResult,
  type Diagnostic,
  type PrepareDef,
  type RuleModule
} from '../builder';

const P = 'rule.dnd-5e-2024.prepared-spells';
const OVER_CAP = `${P}.set-prepared-spells-offer.over-cap`;

/**
 * Prepared spells — the whole prepared set, chosen as one configuration.
 *
 * The per-spell prepare/unprepare offers this replaces each gated on
 * `build.locked === 0` and on the prepared limit, so curating a day's spells
 * meant ticking rows one at a time against a shrinking
 * `spellcasting.prepared.remaining`. `set-prepared-spells` instead commits ONE
 * permanent effect under the shared key `prepared-spells`: same-key effects do
 * not stack (the newest evicts the older), so re-preparing is a whole-set
 * replace with no offer-side removal API. The effect writes the facts the spell
 * modules themselves declare (`spell.l<N>.<camelId>.prepared`), so every cast
 * offer's `when` gate and the derived `spellcasting.prepared.count` keep
 * working unchanged.
 *
 * The rows the picker shows are NOT here — they are `enumeratePreparableSpells`
 * in preparedSpells.ts, a pure function over the modules a character has
 * assigned. This module only commits the chosen set, which is why adding a new
 * preparable spell needs no change to it. Foundational, so no search `meta`.
 */

/**
 * Read the chosen spell set back out of the persisted selection.
 *
 * A selection is JSON that outlived the evaluation that produced it, so this
 * re-derives nothing from it: an entry that is not a well-formed `PrepareDef`
 * (the picker's rows are the spell modules' own declarations) is dropped
 * rather than trusted. An unreadable selection degrades to preparing nothing,
 * never to a throw — the same contract `set-loadout`'s config read follows.
 */
function readSelection(selections: Record<string, unknown> | undefined): PrepareDef[] {
  const raw = selections?.prepared;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is PrepareDef =>
      !!entry &&
      typeof entry === 'object' &&
      typeof (entry as Partial<PrepareDef>).spellId === 'string' &&
      typeof (entry as Partial<PrepareDef>).level === 'number' &&
      typeof (entry as Partial<PrepareDef>).nameKey === 'string' &&
      typeof (entry as Partial<PrepareDef>).preparedFact === 'string' &&
      typeof (entry as Partial<PrepareDef>).alwaysPreparedFact === 'string'
  );
}

const preparedSpells: RuleModule = {
  id: 'prepared-spells',
  offer: () => [
    {
      id: 'set-prepared-spells',
      ui: {
        section: 'configuration',
        name: `${P}.set-prepared-spells.name`,
        description: `${P}.set-prepared-spells.description`,
        intents: { PREPARE: 'spells' },
        actionCost: [],
        primaryControl: { type: 'spell-prepare', var: 'prepared' }
      },
      // Deliberately the ONE gate: over-cap depends on the SELECTION, which
      // `legalWhen` cannot read (facts only) — the over-cap diagnostic is
      // computed in `apply` below, where the chosen set is in hand. Preparing
      // is a build-time choice, so the build-lock gate is the one that stays.
      legalWhen: [notLockedLegal],
      apply: (f, selections): ActionResult => {
        const selected = readSelection(selections);
        const diagnostics: Diagnostic[] = [];
        // Always-prepared spells are free (the count derive excludes them too),
        // so the cap only counts selections the player genuinely chose.
        const counted = selected.filter((def) => f.num(def.alwaysPreparedFact) === 0);
        if (counted.length > f.num('spellcasting.prepared.max')) {
          // Illegal-but-permitted: an error diagnostic marks the row illegal,
          // and the fold still executes it — the app never prevents, it flags.
          diagnostics.push({ code: OVER_CAP, severity: 'error' });
        }
        return {
          advertise: [
            {
              id: 'effect-prepared-spells',
              // The shared key is the mechanism: the newest set evicts the
              // previous one, so re-preparing needs no unprepare step.
              key: 'prepared-spells',
              ...preparedEffectState(selected),
              // On the strip: removing the chip clears the set.
              display: { name: `${P}.effect-prepared-spells.name` },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ],
  // Advisory AND actionable: finishing a Long Rest is when a prepared caster
  // may swap a spell out, so the reminder lands on the long-rest recorder and
  // names the set picker — re-committing the set with the change IS the swap,
  // so one tap hands the player the picker instead of a hunt through the
  // add-row catalog. Gated on prepared capacity: a known-spells caster (or no
  // caster at all — `spellcasting.prepared.max` unset → 0) has nothing to swap.
  annotate: (f) =>
    f.num('spellcasting.prepared.max') > 0
      ? [
          {
            key: `${P}.annotation-long-rest`,
            targets: ['rest.long'],
            addsToPlan: { offer: 'set-prepared-spells' }
          }
        ]
      : []
};

export default defineRule(preparedSpells);
