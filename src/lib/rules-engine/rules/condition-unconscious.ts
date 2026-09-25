import {
  concentrationBreakEffects,
  defineRule,
  proneEffect,
  type ActionResult,
  type Annotation,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CU = 'rule.dnd-5e-2024.condition-unconscious';
const NOT_UNCONSCIOUS = `${CU}.regain-consciousness-offer.not_unconscious`;

/**
 * The keyed unconscious effect the recorder commits: `key: 'unconscious'` so
 * a later Regain Consciousness clear (an empty same-key effect) evicts it
 * rather than stacking. It writes ALL THREE of its facts in its OWN state —
 * `condition.unconscious`, `condition.incapacitated` AND `condition.prone`
 * (SRD 5.2 Inert: "You have the Incapacitated and Prone conditions"; the
 * composition contract — all three die with this one effect, the child
 * imports nothing from the parent or the prone module, the shared fact names
 * ARE the coupling). Speed 0 is NOT written here: movement.ts's halted
 * derive already reads `condition.unconscious` (the grappled Speed-0
 * family), so halted + the remaining/effective_total mask + every halted
 * gate come free. `condition.incapacitated` carries `stateCombine: 'max'` —
 * mandatory, not stylistic: `effect-incapacitated` writes it `max` and
 * sheet.ts THROWS on conflicting combine modes when standalone Incapacitated
 * co-stands (pinned by condition-unconscious-with-incapacitated).
 * `condition.prone` stays DEFAULT-SUM on both its writers (this effect and
 * the prone effect): same mode, no conflict — doubling reads 2, harmless,
 * every read is `> 0`. The effect writes NO attack flags: prone's
 * disadvantage lives in the prone EFFECT, not the fact, and Incapacitated
 * (fact-written) zeroes actions first — moot while unconscious, restored by
 * the fresh prone effect at regain.
 */
const unconsciousEffect = (): EffectInstance => ({
  id: 'effect-unconscious',
  key: 'unconscious',
  state: {
    'condition.unconscious': 1,
    'condition.incapacitated': 1,
    'condition.prone': 1
  },
  stateCombine: { 'condition.incapacitated': 'max' },
  display: { name: `${CU}.effect-unconscious.name`, detailKey: 'condition/unconscious' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Unconscious — wave 7, the last composition child (Incapacitated + Prone +
 * Speed 0). SRD 5.2: Inert (the composition above, plus "you drop whatever
 * you're holding" — notice text + manual Set Loadout, no loadout mutation;
 * and "When this condition ends, you remain Prone"), Speed 0 (halted —
 * movement.ts owns it), Attacks Affected (vs-you Advantage), Saving Throws
 * Affected (auto-fail STR/DEX), Automatic Critical Hits (within 5 ft),
 * Unaware. One free-section RECORDER models BEING UNCONSCIOUS (imposed —
 * sleep, knockout; death saves out of scope), free and ungated — the prone
 * "Knocked Prone" precedent.
 *
 * No Concentration (via the composed Incapacitated) is the record apply's
 * conditional break: writing the fact does NOT evict a held spell, so the
 * recorder invokes the shared builder helper the parent's does — eviction +
 * marker clear, only while a hold is live.
 *
 * REGAIN CONSCIOUSNESS is the mechanical end (SRD's "when this condition
 * ends, you remain Prone" — waking is external: healing, shaken awake), a
 * free-section offer with NO `when` gate (the #453 illegal-but-visible
 * pattern, like Get Up while standing): always visible, illegal while awake
 * with its not_unconscious diagnostic, and a planned-anyway row still
 * EXECUTES — committing the fresh prone effect (pinned by
 * condition-unconscious-regain-while-awake). Its apply advertises the
 * eviction idiom (empty same-key 'unconscious', newest-wins — applies while
 * merely planned, so a Get Up planned after it already sees Speed restored)
 * beside a FRESH keyed prone effect (the builder's shared `proneEffect()`),
 * so Prone survives the end exactly as SRD says. Rests clear the WHOLE
 * effect including its prone write (the umbrella rest-clears deviation —
 * Regain Consciousness is the blessed end that keeps Prone standing).
 *
 * Strip dismissal of the unconscious chip leaves you NOT prone — a known
 * deviation: `removeEffect` has no suppression mechanism, so the end-offer
 * is the steered path (docs/plans/ideas/condition-unconscious.md Notes).
 *
 * Foundational, so no search meta.
 */
const conditionUnconscious: RuleModule = {
  id: 'condition-unconscious',
  offer: () => [
    {
      id: 'record-unconscious',
      ui: {
        section: 'free',
        name: `${CU}.record-unconscious.name`,
        detailKey: 'condition/unconscious',
        intents: { CONDITION: 'unconscious' },
        actionCost: []
      },
      apply: (f): ActionResult => ({
        // The composed Incapacitated's No Concentration clause: while a hold
        // is live the record also advertises the shared break — the
        // conditional eviction + marker clear (the helper returns [] with
        // nothing held, so no phantom chip records).
        advertise: [unconsciousEffect(), ...concentrationBreakEffects(f)]
      })
    },
    {
      // The mechanical end. NO `when` gate (the #453 illegal-but-visible
      // pattern — Get Up while standing): waking is imposed externally, so
      // the offer exists at every state and carries a legality clause
      // instead — ILLEGAL while awake with its not_unconscious diagnostic,
      // and a planned-anyway row still executes (the plan.ts contract),
      // committing the fresh prone effect it advertises.
      id: 'regain-consciousness',
      ui: {
        section: 'free',
        name: `${CU}.regain-consciousness.name`,
        description: `${CU}.regain-consciousness.description`,
        detailKey: 'condition/unconscious',
        intents: { CONDITION: 'unconscious' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('condition.unconscious') > 0,
          diagnostics: [{ code: NOT_UNCONSCIOUS, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row
        // carries its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num('condition.unconscious') === 0)
          diagnostics.push({ code: NOT_UNCONSCIOUS, severity: 'error' });
        return {
          advertise: [
            // The clear: an EMPTY same-key effect (the concentration-broken /
            // get-up idiom) — newest-wins evicts the unconscious effect while
            // the row is still merely planned (a Get Up after it already sees
            // Speed restored), and endTurn merges the eviction permanently.
            // Carries display because a nameless hidden effect renders
            // nothing on the effects strip.
            {
              id: 'unconscious-ended',
              key: 'unconscious',
              display: { name: `${CU}.regain-consciousness.effect-cleared.name` },
              expiry: { kind: 'permanent' }
            },
            // SRD 5.2 Inert: "When this condition ends, you remain Prone."
            // The eviction kills this effect's own condition.prone write, so
            // a FRESH keyed prone effect lands beside it — the builder's
            // shared proneEffect() (condition.prone + the STR/DEX attack
            // flags, max-combined). Newest-wins on the 'prone' key also
            // replaces a separately recorded prone effect — a condition
            // doesn't stack with itself.
            proneEffect()
          ],
          diagnostics
        };
      }
    }
  ],
  // While unconscious, a NOTICE carries the standing effects (SRD verbatim
  // minus the engine-enforced facts — Incapacitated/Prone/Speed 0 are
  // facts; vs-you Advantage, the within-5-ft auto-crit, auto-fail STR/DEX
  // saves, Unaware and the drop-held reminder are text only, nothing live
  // to interpolate; the Incapacitated and Prone notices fire off the
  // composed facts too). 'notice' == NOTICE_TARGET; rule modules may import
  // only the builder, so the reserved label is a literal here (see
  // condition-prone / -paralyzed).
  annotate: (f): Annotation[] =>
    f.num('condition.unconscious') > 0
      ? [
          {
            key: `${CU}.notice`,
            targets: ['notice'],
            source: `${CU}.effect-unconscious.name`,
            body: `${CU}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionUnconscious);
