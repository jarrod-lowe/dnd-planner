import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CI = 'rule.dnd-5e-2024.condition-invisible';

/**
 * The keyed invisible effect the recorder commits: `key: 'invisible'` so
 * repeat records evict rather than stack. It writes `condition.invisible`
 * plus the rules-driven ADVANTAGE facts the dice-lines' `advantageUp` leg
 * reads (PR1's roller): the STR/DEX attack flags every weapon and unarmed
 * control declares, and `initiative.advantage` both Roll Initiative controls
 * read (SRD "Surprise"). The advantage facts carry `stateCombine: 'max'` (the
 * prone/blinded idiom on their disadvantage mirrors): future advantage
 * writers must co-write the flags, and the default `sum` would
 * conflict-throw. Cancellation needs no wiring here — Advantage and
 * Disadvantage are DIFFERENT facts, and PanelDiceLine's three-way default
 * roll mode cancels them when both resolve truthy (the
 * invisible-plus-prone-cancels scenario pins the coexistence).
 */
const invisibleEffect = (): EffectInstance => ({
  id: 'effect-invisible',
  key: 'invisible',
  state: {
    'condition.invisible': 1,
    'attack.str.advantage': 1,
    'attack.dex.advantage': 1,
    'initiative.advantage': 1
  },
  stateCombine: {
    'attack.str.advantage': 'max',
    'attack.dex.advantage': 'max',
    'initiative.advantage': 'max'
  },
  display: { name: `${CI}.effect-invisible.name`, detailKey: 'condition/invisible' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Invisible — wave 6, the condition that lands rules-driven ADVANTAGE. SRD
 * 5.2: Surprise (Advantage on Initiative), Concealed (+ your equipment, vs
 * see-target effects), Attacks Affected (your attacks have Advantage; attacks
 * against you have Disadvantage, unless the creature can somehow see you).
 * One free-section RECORDER models BEING INVISIBLE — the source (Hide, a
 * spell, an item) is out of scope (umbrella), so it is free, ungated and
 * source-blind (the prone "Knocked Prone" precedent).
 *
 * Engine-enforced: your-attack Advantage (STR/DEX flags) and Initiative
 * Advantage. Notice text only: attacks AGAINST you having Disadvantage and
 * Concealed are NPC-side (identity/targeting out of engine scope), and the
 * see-me exception is creature knowledge the sheet cannot derive.
 *
 * Ending is the umbrella default — any rest (`untilShortRest`; a long rest
 * includes a short) plus manual ActiveStateStrip chip dismissal. Hide's stop
 * conditions (sound / found / attack / V-spell) deliberately do NOT appear:
 * they are the HIDE action's endings, not the condition's, and the recorder
 * is source-blind — spell-sourced invisibility (Greater Invisibility attacks
 * freely) would be misled by them. Source-aware endings are a future idea.
 *
 * Foundational, so no search meta.
 */
const conditionInvisible: RuleModule = {
  id: 'condition-invisible',
  offer: () => [
    {
      id: 'record-invisible',
      ui: {
        section: 'free',
        name: `${CI}.record-invisible.name`,
        detailKey: 'condition/invisible',
        intents: { CONDITION: 'invisible' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [invisibleEffect()]
      })
    }
  ],
  // While invisible, a NOTICE carries the standing effects (the
  // engine-enforced advantage legs plus the NPC-side text — nothing live to
  // interpolate). 'notice' == NOTICE_TARGET; rule modules may import only the
  // builder, so the reserved label is a literal here (see condition-prone /
  // -grappled).
  annotate: (f): Annotation[] =>
    f.num('condition.invisible') > 0
      ? [
          {
            key: `${CI}.notice`,
            targets: ['notice'],
            source: `${CI}.effect-invisible.name`,
            body: `${CI}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionInvisible);
