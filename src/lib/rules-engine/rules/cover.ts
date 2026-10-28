import { defineRule, type ActionResult, type Annotation, type RuleModule } from '../builder';

const C = 'rule.dnd-5e-2024.cover';

/**
 * Cover — the PLAYER-level generic cover record (docs/plans/ideas/cover.md,
 * PR-1). SRD 5.2 (Rules Glossary): "Cover provides a degree of protection to
 * a target behind it. There are three degrees of cover, each of which provides
 * a different benefit to a target: Half Cover (+2 bonus to AC and Dexterity
 * saving throws), Three-Quarters Cover (+5 bonus to AC and Dexterity saving
 * throws), and Total Cover (can't be targeted directly). If behind more than
 * one degree of cover, a target benefits only from the most protective
 * degree." Total therefore grants NO bonus — notice-only copy.
 *
 * The player asserts their degree with ONE free-section record (the tormentor
 * AC-mode precedent): ungated (cover is a state, not an activity — no economy
 * cost, wrecked/seated irrelevant), with a four-degree segmented control
 * pre-showing the CURRENT degree. Apply is immediate (record-class): ONE
 * permanent KEYED effect storing the degree as the DISTINCT `cover.recorded`
 * fact — re-applying replaces by key (never stacks), and dismissing the raw
 * chip reverts everything (the effect writes exactly that one fact).
 *
 * The derives are the whole mechanism, and PR-2's seat-sourced cover plugs in
 * at exactly one of them — nothing downstream changes:
 *  - `cover.current`   = has(recorded) ? recorded : 0
 *  - `cover.effective` = max(current, cover.seat) — the SEAM. `cover.seat` is
 *                        the SHARED player-level fact every cover-carrying
 *                        vehicle CONTRIBUTES its best held seat degree to
 *                        (combine max, the infernal-vehicle factory's
 *                        COVER_SEAT — the shared-spend shape); with no such
 *                        vehicle loaded the fact is unset and reads 0. Never
 *                        a sum, per the SRD's most-protective-degree rule.
 *  - `cover.bonus`     = +2 half, +5 three-quarters, 0 none AND total
 *
 * `cover.bonus` is read by the AC module's sum (a component of `ac.value`,
 * never a second writer) and by this module's own notice/rider — the single
 * place the degree→bonus mapping lives, so the sentence, the chip and the AC
 * can never drift (the Aura of Protection precedent). The Dex-save bonus is a
 * RIDER, not a derive: the ROLL is modified, so `dex.save` and its top bar
 * stay untouched, and the chip targets `save.dex` alone — cover touches Dex
 * saves only, unlike the save.any riders of Aura of Protection/Exhaustion
 * (steed/vehicle `.companion` labels are deliberately unreachable).
 *
 * Foundational, so no search meta.
 */

/** Ordinal degrees: 0 None, 1 Half, 2 Three-Quarters, 3 Total. */
const NONE = 0;
const HALF = 1;
const THREE_QUARTERS = 2;
const TOTAL = 3;

/** The SRD's bonus per degree: Half +2, Three-Quarters +5, Total/None +0. */
const bonusOf = (degree: number): number =>
  degree === HALF ? 2 : degree === THREE_QUARTERS ? 5 : 0;

/** The notice body per positive degree — one literal suffix each, per state. */
const BODY_BY_DEGREE: Record<number, string> = {
  [HALF]: `${C}.notice.body.half`,
  [THREE_QUARTERS]: `${C}.notice.body.three-quarters`,
  [TOTAL]: `${C}.notice.body.total`
};

const DEGREE_CONTROL = {
  type: 'segmented',
  var: 'degree',
  prefix: 'play.choices.cover.degree',
  options: [
    { value: NONE, label: `${C}.degree.none` },
    { value: HALF, label: `${C}.degree.half` },
    { value: THREE_QUARTERS, label: `${C}.degree.three-quarters` },
    { value: TOTAL, label: `${C}.degree.total` }
  ]
} as const;

/** The selected degree from a segmented capture (None when unset). */
const degreeFrom = (selections: Record<string, unknown>): number =>
  typeof selections.degree === 'number' ? selections.degree : NONE;

const cover: RuleModule = {
  id: 'cover',
  offer: () => [
    {
      id: 'set-cover',
      ui: {
        section: 'free',
        name: `${C}.record.name`,
        description: `${C}.record.description`,
        detailKey: 'rule/cover',
        secondaryControl: DEGREE_CONTROL,
        intents: { DEFEND: 'cover' },
        actionCost: []
      },
      vars: { degree: { capture: true, default: { fact: 'cover.current' } } },
      apply: (_f, selections): ActionResult => ({
        advertise: [
          {
            id: 'effect-cover',
            key: 'cover',
            state: { 'cover.recorded': degreeFrom(selections) },
            display: { name: `${C}.effect.name`, detailKey: 'rule/cover' },
            expiry: { kind: 'permanent' }
          }
        ]
      })
    }
  ],
  derive: () => [
    {
      fact: 'cover.current',
      value: (f) => (f.has('cover.recorded') ? f.num('cover.recorded') : 0)
    },
    // The PR-2 seam: seat-sourced cover maxes in here — max(manual, seat),
    // never a sum (the SRD's "only the most protective degree" rule). The
    // seat side is a CONTRIBUTION vehicles make to `cover.seat` (the factory
    // spell COVER_SEAT — this module only READS it, so no cover module ever
    // imports a vehicle module); derived from the seat facts at the source,
    // it vanishes with the seat (leave/abandon) with no wiring here.
    {
      fact: 'cover.effective',
      value: (f) => Math.max(f.num('cover.current'), f.num('cover.seat'))
    },
    { fact: 'cover.bonus', value: (f) => bonusOf(f.num('cover.effective')) }
  ],
  // ONE standing notice keyed on EFFECTIVE cover (state + bonus in the body,
  // per state — not per-source); the rider exists only where there is a bonus
  // to fold, so Total keeps its notice while granting nothing.
  annotate: (f): Annotation[] => {
    const degree = f.num('cover.effective');
    if (degree <= 0) return [];
    const bonus = f.num('cover.bonus');
    const annotations: Annotation[] = [
      {
        key: `${C}.notice`,
        targets: ['notice'],
        source: `${C}.effect.name`,
        body: BODY_BY_DEGREE[degree],
        values: { bonus }
      }
    ];
    if (bonus > 0) {
      annotations.push({
        key: `${C}.rider`,
        targets: ['save.dex'],
        rider: {
          label: `${C}.rider`,
          type: 'modifier',
          value: { kind: 'flat', bonus },
          appliesTo: 'save',
          defaultOn: true
        }
      });
    }
    return annotations;
  }
};

export default defineRule(cover);
