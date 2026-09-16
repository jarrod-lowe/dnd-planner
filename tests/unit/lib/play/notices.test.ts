import { describe, it, expect } from 'vitest';
import { getNotices } from '$lib/play/notices';
import type { Annotation } from '$lib/rules-engine';

/**
 * Notices — selector (plan Phase 4).
 *
 * `getNotices` picks the annotations the notices strip renders: exactly those
 * whose `targets` include the reserved `'notice'` label. Everything else —
 * annotations aimed at panel labels like `attack.reaction` — is left alone
 * (`getMatchingAnnotations` owns those). Order is the engine's structural
 * order; the selector preserves it and never re-sorts.
 */
describe('getNotices', () => {
  it('returns empty array when there are no annotations', () => {
    expect(getNotices([])).toEqual([]);
  });

  it('returns only annotations whose targets include the reserved notice label', () => {
    const notice: Annotation = {
      key: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage',
      targets: ['notice'],
      source: 'rule.dnd-5e-2024.feat-sentinel.name',
      body: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage.body',
      values: { dc: 13 }
    };
    const panel: Annotation = {
      key: 'rule.dnd-5e-2024.attacks.extra-attack.annotation',
      targets: ['attack.action']
    };
    expect(getNotices([panel, notice])).toEqual([notice]);
  });

  it('ignores annotations targeted at panel labels like attack.reaction', () => {
    const reaction: Annotation = {
      key: 'rule.dnd-5e-2024.feat-sentinel.annotation-disengage',
      targets: ['attack.reaction']
    };
    expect(getNotices([reaction])).toEqual([]);
  });

  it('keeps a notice that also carries a panel target alongside the reserved one', () => {
    const both: Annotation = {
      key: 'rule.spells.searing-smite.notice-burning',
      targets: ['attack.melee', 'notice']
    };
    expect(getNotices([both])).toEqual([both]);
  });

  it('preserves engine order rather than re-sorting', () => {
    // Keys are deliberately not alphabetical: a sort would flip them.
    const later: Annotation = { key: 'group.rule.notice-b', targets: ['notice'] };
    const panel: Annotation = { key: 'group.rule.annotation', targets: ['dice.any'] };
    const earlier: Annotation = { key: 'group.rule.notice-a', targets: ['notice'] };
    expect(getNotices([later, panel, earlier]).map((n) => n.key)).toEqual([
      'group.rule.notice-b',
      'group.rule.notice-a'
    ]);
  });
});
