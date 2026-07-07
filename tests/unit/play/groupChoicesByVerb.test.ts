import { describe, it, expect } from 'vitest';
import {
  groupChoicesByVerb,
  findDefaultEntryForVerb,
  verbLabelKey,
  subBucketLabelKey
} from '$lib/play/groupChoicesByVerb';
import { getVerbGroup } from '$lib/play/verbConfig';
import type { AvailableRuleEntry, Verb } from '$lib/rules-view';

const makeEntry = (
  id: string,
  overrides: {
    section?: string;
    intents?: Record<string, string>;
    legal?: boolean;
    applicable?: boolean;
  } = {}
): AvailableRuleEntry => ({
  rule: {
    id,
    activities: [],
    ui: {
      ...(overrides.section ? { section: overrides.section } : {}),
      ...(overrides.intents ? { intents: overrides.intents } : {})
    }
  },
  legal: overrides.legal ?? true,
  applicable: overrides.applicable ?? true,
  diagnostics: []
});

describe('groupChoicesByVerb', () => {
  it('groups entries by verb from ui.intents', () => {
    const entries = [
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' } }),
      makeEntry('bless', { intents: { AID: 'ally' } }),
      makeEntry('dodge', { intents: { DEFEND: 'evade' } })
    ];

    const groups = groupChoicesByVerb(entries);

    expect(groups).toHaveLength(3);
    expect(groups[0].verb).toBe('ATTACK');
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[1].verb).toBe('AID');
    expect(groups[2].verb).toBe('DEFEND');
  });

  it('organizes entries into sub-buckets', () => {
    const entries = [
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' } }),
      makeEntry('javelin', { intents: { ATTACK: 'weapons' } }),
      makeEntry('searing-smite', { intents: { ATTACK: 'spells' } })
    ];

    const groups = groupChoicesByVerb(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].verb).toBe('ATTACK');
    expect(groups[0].subBuckets.get('weapons')).toHaveLength(2);
    expect(groups[0].subBuckets.get('spells')).toHaveLength(1);
  });

  it('returns groups in verb order', () => {
    const entries = [
      makeEntry('rest', { intents: { REST: 'type' } }),
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' } }),
      makeEntry('bless', { intents: { AID: 'ally' } })
    ];

    const groups = groupChoicesByVerb(entries);

    expect(groups.map((g) => g.verb)).toEqual(['ATTACK', 'AID', 'REST']);
  });

  it('includes illegal entries alongside legal ones', () => {
    const entries = [
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' }, legal: true }),
      makeEntry('javelin', { intents: { ATTACK: 'weapons' }, legal: false }),
      makeEntry('dodge', { intents: { DEFEND: 'evade' }, legal: false })
    ];

    const groups = groupChoicesByVerb(entries);

    expect(groups).toHaveLength(2);
    expect(groups[0].verb).toBe('ATTACK');
    expect(groups[0].entries).toHaveLength(2);
    expect(groups[0].entries.map((e) => e.rule.id)).toEqual(['greataxe', 'javelin']);
    expect(groups[1].verb).toBe('DEFEND');
    expect(groups[1].entries).toHaveLength(1);
    expect(groups[1].entries[0].legal).toBe(false);
  });

  it('falls back to section-based derivation when no intents', () => {
    const entries = [makeEntry('old-attack', { section: 'action-attack' })];

    const groups = groupChoicesByVerb(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].verb).toBe('ATTACK');
  });

  it('returns empty array for no entries', () => {
    expect(groupChoicesByVerb([])).toEqual([]);
  });

  it('skips verbs not in verbOrder', () => {
    const entries = [makeEntry('greataxe', { intents: { ATTACK: 'weapons' } })];
    const customOrder: Verb[] = ['AID', 'DEFEND'];

    const groups = groupChoicesByVerb(entries, customOrder);

    expect(groups).toHaveLength(0);
  });

  it('handles multi-intent rules in first verb', () => {
    const entries = [makeEntry('sanctuary', { intents: { AID: 'ally', DEFEND: 'ward' } })];

    const groups = groupChoicesByVerb(entries);

    expect(groups).toHaveLength(1);
    expect(groups[0].verb).toBe('AID');
  });
});

describe('findDefaultEntryForVerb', () => {
  it('returns first legal entry for the verb', () => {
    const entries = [
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' }, legal: true }),
      makeEntry('javelin', { intents: { ATTACK: 'weapons' }, legal: true })
    ];

    const result = findDefaultEntryForVerb(entries, 'ATTACK');

    expect(result).not.toBeNull();
    expect(result!.rule.id).toBe('greataxe');
  });

  it('prefers legal entry over an illegal entry that appears first', () => {
    const entries = [
      makeEntry('sword', { intents: { ATTACK: 'weapons' }, legal: false }),
      makeEntry('dagger', { intents: { ATTACK: 'weapons' }, legal: true })
    ];

    const result = findDefaultEntryForVerb(entries, 'ATTACK');

    expect(result).not.toBeNull();
    expect(result!.rule.id).toBe('dagger');
  });

  it('returns first illegal entry when no legal entries exist', () => {
    const entries = [makeEntry('greataxe', { intents: { ATTACK: 'weapons' }, legal: false })];

    const result = findDefaultEntryForVerb(entries, 'ATTACK');

    expect(result).not.toBeNull();
    expect(result!.rule.id).toBe('greataxe');
  });

  it('returns null when no entries for verb exist', () => {
    const entries = [makeEntry('bless', { intents: { AID: 'ally' } })];

    expect(findDefaultEntryForVerb(entries, 'ATTACK')).toBeNull();
  });

  it('skips entries for other verbs', () => {
    const entries = [
      makeEntry('bless', { intents: { AID: 'ally' }, legal: true }),
      makeEntry('greataxe', { intents: { ATTACK: 'weapons' }, legal: true })
    ];

    const result = findDefaultEntryForVerb(entries, 'ATTACK');

    expect(result).not.toBeNull();
    expect(result!.rule.id).toBe('greataxe');
  });
});

describe('verbLabelKey', () => {
  it('returns correct i18n key', () => {
    expect(verbLabelKey('ATTACK')).toBe('play.verbs.ATTACK');
    expect(verbLabelKey('AID')).toBe('play.verbs.AID');
  });
});

describe('subBucketLabelKey', () => {
  it('returns correct i18n key', () => {
    expect(subBucketLabelKey('ATTACK', 'weapons')).toBe('play.verbBuckets.ATTACK.weapons');
  });
});

describe('getVerbGroup', () => {
  it('HEALTH is in record group', () => {
    expect(getVerbGroup('HEALTH')).toBe('record');
  });
});
