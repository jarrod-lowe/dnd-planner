import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const B = 'rule.dnd-5e-2024.build-lock';

/**
 * Build Lock — a single BUILD offer that freezes the character build. Choosing
 * Lock advertises a PERMANENT effect setting `build.locked`, which every BUILD
 * offer (ability set/increase, proficiency, equip, prepare, and Lock itself) is
 * gated on being 0 — so they all flip illegal and the BUILD group tucks away.
 * Removing the effect from the ledger clears the flag and restores them.
 * Foundational, so no search meta.
 */
const buildLock: RuleModule = {
  id: 'build-lock',
  offer: () => [
    {
      id: 'lock',
      ui: {
        section: 'configuration',
        name: `${B}.lock.name`,
        intents: { STAT: 'lock' },
        actionCost: []
      },
      legalWhen: [
        { condition: (f) => f.num('build.locked') === 0, diagnostics: [{ code: `${B}.locked`, severity: 'error' }] }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('build.locked') !== 0) diagnostics.push({ code: `${B}.locked`, severity: 'error' });
        return {
          advertise: [
            {
              id: 'effect-build-locked',
              key: 'build-locked',
              state: { 'build.locked': 1 },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(buildLock);
