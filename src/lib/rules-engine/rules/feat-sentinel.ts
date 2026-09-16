import { defineRule, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.feat-sentinel';

/**
 * Sentinel feat — sets `feat.sentinel.active` and emits its three benefits as
 * NOTICES: each annotation targets only the reserved `'notice'` label (equal to
 * `NOTICE_TARGET`; rule modules may import only the builder, so the label is a
 * literal here and the unit test pins it to the exported constant), names the
 * feat as its `source` (the strip's eyebrow) and carries a `body` key for the
 * longer sentence. None target a panel, so the reminders render in the notices
 * strip rather than on reaction rows. The feat's Ability Score Improvement
 * offer is deferred (no runnable scenario exercises it). Foundational, so no
 * search meta.
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
            key: `${S}.notice-speed`,
            targets: ['notice'],
            source: `${S}.name`,
            body: `${S}.notice-speed.body`
          }
        ]
      : []
};

export default defineRule(featSentinel);
