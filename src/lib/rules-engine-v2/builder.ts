import type { Diagnostic, LegalWhen, Offer, RuleModule } from './types';

/** Pure, deterministic helpers that are part of the authoring toolkit. */
export { statToModifier } from './functions';

const BUILD_LOCKED = 'rule.dnd-5e-2024.build-lock.locked';
/** A BUILD offer is illegal while the build is locked (the build-lock group). */
const notLockedLegal: LegalWhen = {
  condition: (f) => f.num('build.locked') === 0,
  diagnostics: [{ code: BUILD_LOCKED, severity: 'error' }]
};

/**
 * The prepare / unprepare offer pair shared by every prepared spell.
 *
 * - prepare: legal while not locked, not already prepared, and under the prepared
 *   limit (`spellcasting.prepared.remaining > 0`). It advertises a PERMANENT keyed
 *   effect setting the spell's `prepared` fact (via `max`, so it composes with a
 *   class always-prepared grant) and `spellcasting.prepared.count += 1` — except
 *   an always-prepared spell is free, so it adds 0 to the count.
 * - unprepare: legal while not locked, prepared, and NOT always-prepared. It
 *   advertises a same-key empty PERMANENT effect that evicts the prepare effect
 *   (newest-wins dedupe), dropping `prepared` and the count contribution.
 *
 * `alwaysPreparedFact` is read for the count gate / unprepare legality; for a
 * spell no feature ever grants, it is simply absent (0).
 */
export function preparedSpellOffers(opts: {
  /** The spell id used in offer ids / i18n keys, e.g. `divine-smite`. */
  spellId: string;
  /** i18n prefix for the offers, e.g. `rule.spell-divine-smite`. */
  i18nPrefix: string;
  /** The spell's prepared fact, e.g. `spell.l1.divineSmite.prepared`. */
  preparedFact: string;
  /** The always-prepared fact, e.g. `spell.l1.divineSmite.alwaysPrepared`. */
  alwaysPreparedFact: string;
  /** The PREPARE intent level shown in the UI, e.g. `L1`. */
  intentLevel: string;
}): Offer[] {
  const { spellId, i18nPrefix, preparedFact, alwaysPreparedFact, intentLevel } = opts;
  const prepareId = `prepare-${spellId}`;
  const unprepareId = `unprepare-${spellId}`;
  const key = `prep:${spellId}`;
  const alreadyPrepared = `${i18nPrefix}.${prepareId}-offer.already_prepared`;
  const maxPrepared = `${i18nPrefix}.${prepareId}-offer.max_prepared`;
  const notPrepared = `${i18nPrefix}.${unprepareId}-offer.not_prepared`;
  const alwaysPreparedCode = `${i18nPrefix}.${unprepareId}-offer.always_prepared`;

  return [
    {
      id: prepareId,
      ui: {
        section: 'configuration',
        name: `${i18nPrefix}.${prepareId}-offer.name`,
        intents: { PREPARE: intentLevel },
        actionCost: []
      },
      legalWhen: [
        notLockedLegal,
        {
          condition: (f) => f.num(preparedFact) !== 1,
          diagnostics: [{ code: alreadyPrepared, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.prepared.remaining') > 0,
          diagnostics: [{ code: maxPrepared, severity: 'error' }]
        }
      ],
      apply: (f) => {
        const diagnostics: Diagnostic[] = [];
        if (f.num(preparedFact) === 1) diagnostics.push({ code: alreadyPrepared, severity: 'error' });
        if (f.num('spellcasting.prepared.remaining') <= 0)
          diagnostics.push({ code: maxPrepared, severity: 'error' });
        // An always-prepared spell is free — it doesn't count against the limit.
        const count = f.num(alwaysPreparedFact) > 0 ? 0 : 1;
        return {
          advertise: [
            {
              id: 'prepared',
              key,
              state: { [preparedFact]: 1, 'spellcasting.prepared.count': count },
              stateCombine: { [preparedFact]: 'max' },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    },
    {
      id: unprepareId,
      ui: {
        section: 'configuration',
        name: `${i18nPrefix}.${unprepareId}-offer.name`,
        intents: { PREPARE: intentLevel },
        actionCost: []
      },
      legalWhen: [
        notLockedLegal,
        {
          condition: (f) => f.num(preparedFact) === 1,
          diagnostics: [{ code: notPrepared, severity: 'error' }]
        },
        {
          condition: (f) => f.num(alwaysPreparedFact) !== 1,
          diagnostics: [{ code: alwaysPreparedCode, severity: 'error' }]
        }
      ],
      apply: (f) => {
        const diagnostics: Diagnostic[] = [];
        if (f.num(preparedFact) !== 1) diagnostics.push({ code: notPrepared, severity: 'error' });
        if (f.num(alwaysPreparedFact) === 1)
          diagnostics.push({ code: alwaysPreparedCode, severity: 'error' });
        // Same key, no state → evicts the prepare effect (prepared & count drop).
        return { advertise: [{ id: 'unprepared', key, expiry: { kind: 'permanent' } }], diagnostics };
      }
    }
  ];
}

/**
 * The rules-authoring surface.
 *
 * Rule modules import ONLY from here — enforced by the confinement lint
 * (eslint.config.js, scoped to `rules/**`) and the confinement test. A single
 * authored entry point means:
 *  - the sandbox boundary (and the M2 chunk build) has exactly one import to
 *    allow;
 *  - authors get a stable API independent of the engine's internal file layout;
 *  - banned ambient globals (fetch/window/Date/Math.random/...) have no legal
 *    path into a module, keeping every rule a pure function of its facts.
 */

export type {
  RuleModule,
  RuleMeta,
  Contribution,
  FactReader,
  SheetCtx,
  Offer,
  LegalWhen,
  ActionResult,
  EffectInstance,
  Expiry,
  Annotation,
  AnnotationRider,
  Diagnostic
} from './types';

/**
 * Define a rule module. Currently an identity-with-type-anchor: its value is the
 * stable authored surface and the single import the confinement rules allow. A
 * dev-time guard rejects a module with no id so a copy-paste slip fails fast at
 * load rather than silently colliding (or vanishing) in the registry.
 */
export function defineRule(rule: RuleModule): RuleModule {
  if (!rule.id) {
    throw new Error('defineRule: a rule module must have a non-empty id');
  }
  return rule;
}
