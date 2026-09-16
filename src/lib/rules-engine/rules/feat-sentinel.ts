import { defineRule, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.feat-sentinel';

/**
 * Sentinel feat — sets `feat.sentinel.active` and emits its three benefits.
 * Two are standing reminders the player needs with no choice made, so they
 * are NOTICES: they target only the reserved `'notice'` label (equal to
 * `NOTICE_TARGET`; rule modules may import only the builder, so the label is
 * a literal here and the unit test pins it to the exported constant), name
 * the feat as their `source` (the strip's eyebrow) and carry a `body` key
 * for the longer sentence.
 *
 * The speed-to-0 benefit is post-hoc — it only matters AFTER the player
 * plans an Opportunity Attack — so it rides the reaction panels via their
 * `'attack.reaction'` annotationLabels (same confinement rule as 'notice':
 * a literal here, pinned by the tests), and its key follows the panel-rider
 * `annotation-*` naming (feat-alert's annotation-swap idiom). Panels render
 * the annotation label only (`$t(annotation.key)`), so the full sentence
 * lives in the label copy and it carries no `body`.
 *
 * The feat's Ability Score Improvement offer is deferred (no runnable
 * scenario exercises it). Foundational, so no search meta.
 */
const featSentinel: RuleModule = {
  id: 'feat-sentinel',
  derive: () => [{ fact: 'feat.sentinel.active', value: () => 1 }],
  annotate: (f) =>
    f.num('feat.sentinel.active') === 1
      ? [
          {
            key: `${S}.notice-disengage`,
            targets: ['notice'],
            source: `${S}.name`,
            body: `${S}.notice-disengage.body`
          },
          {
            key: `${S}.notice-retaliate`,
            targets: ['notice'],
            source: `${S}.name`,
            body: `${S}.notice-retaliate.body`
          },
          {
            key: `${S}.annotation-speed`,
            targets: ['attack.reaction'],
            source: `${S}.name`
          }
        ]
      : []
};

export default defineRule(featSentinel);
