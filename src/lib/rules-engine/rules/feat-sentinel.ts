import { defineRule, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.feat-sentinel';

/**
 * Sentinel feat — sets `feat.sentinel.active` and annotates melee reaction
 * attacks with its three benefits (stop-on-hit, retaliate, no-Disengage). The
 * feat's Ability Score Improvement offer is deferred (no runnable scenario
 * exercises it). Foundational, so no search meta.
 */
const featSentinel: RuleModule = {
  id: 'feat-sentinel',
  derive: () => [{ fact: 'feat.sentinel.active', value: () => 1 }],
  annotate: (f) =>
    f.num('feat.sentinel.active') === 1
      ? [
          { key: `${S}.annotation-disengage`, targets: ['attack.reaction'] },
          { key: `${S}.annotation-retaliate`, targets: ['attack.reaction'] },
          { key: `${S}.annotation-speed`, targets: ['attack.reaction'] }
        ]
      : []
};

export default defineRule(featSentinel);
