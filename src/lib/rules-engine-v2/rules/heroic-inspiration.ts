import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const HI = 'rule.dnd-5e-2024.heroic-inspiration';
// Grant and use share a key so use REPLACES the grant (newest-wins dedupe).
const KEY = 'heroic-inspiration';

/**
 * Heroic Inspiration: a one-point boolean resource the DM grants and the player
 * spends to reroll. Granted HI persists across turns; using it consumes it for
 * good.
 *
 * v1 kept it alive by re-advertising a self-effect each turn gated on a per-eval
 * `consumed` flag. v2 expresses the same with the effect lifetime:
 *  - `grant-hi` advertises a PERMANENT keyed effect (`remaining = 1`).
 *  - `use-hi` advertises an `endOfTurn` effect with the SAME key, so it replaces
 *    the grant this turn (remaining → 0, consumed → 1) and then expires — leaving
 *    no HI effect next turn. No re-advertisement, no explicit consumed reset
 *    (an absent fact reads as 0).
 *
 * Foundational (auto-assigned, not user-searched), so no `meta`.
 */
const heroicInspiration: RuleModule = {
  id: 'heroic-inspiration',
  derive: () => [{ fact: 'heroicInspiration.max', value: () => 1 }],
  offer: () => [
    {
      id: 'grant-hi',
      ui: {
        section: 'other',
        name: `${HI}.grant-hi.name`,
        description: `${HI}.grant-hi.description`,
        intents: { AID: 'self' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('heroicInspiration.remaining') < 1,
          diagnostics: [{ code: `${HI}.grant-hi-offer.already_has`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('heroicInspiration.remaining') >= 1)
          diagnostics.push({ code: `${HI}.grant-hi-offer.already_has`, severity: 'error' });
        return {
          advertise: [
            {
              id: 'effect-hi-set',
              key: KEY,
              state: { 'heroicInspiration.remaining': 1 },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    },
    {
      id: 'use-hi',
      ui: {
        section: 'other',
        name: `${HI}.use-hi.name`,
        description: `${HI}.use-hi.description`,
        intents: { AID: 'self' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('heroicInspiration.remaining') > 0,
          diagnostics: [{ code: `${HI}.use-hi-offer.no_inspiration`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('heroicInspiration.remaining') < 1)
          diagnostics.push({ code: `${HI}.use-hi-offer.no_inspiration`, severity: 'error' });
        // Same key as the grant → replaces it this turn; endOfTurn → gone next.
        return {
          advertise: [
            {
              id: 'effect-hi-consume',
              key: KEY,
              state: { 'heroicInspiration.consumed': 1 },
              expiry: { kind: 'endOfTurn' }
            }
          ],
          diagnostics
        };
      }
    }
  ],
  annotate: (f) =>
    f.num('heroicInspiration.remaining') > 0
      ? [{ key: `${HI}.annotation`, targets: ['dice.any'] }]
      : []
};

export default defineRule(heroicInspiration);
