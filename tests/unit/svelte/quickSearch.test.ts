import { describe, it, expect } from 'vitest';
import {
  type SearchOption,
  CAP,
  RESULTS_COLUMNS,
  WELL_ROWS,
  searchText,
  isMatch,
  filterMatches,
  splitShown,
  keyEnabled,
  whyBadge
} from '$lib/play/quickSearch';

const greataxe: SearchOption = { id: 'greataxe', name: 'Greataxe', keywords: '' };
const cureWounds: SearchOption = {
  id: 'cure-wounds',
  name: 'Cure Wounds',
  keywords: 'heal restore'
};
const heal: SearchOption = { id: 'heal', name: 'Heal', keywords: 'restore' };
const fireball: SearchOption = { id: 'fireball', name: 'Fireball', keywords: 'fire damage' };

const sample = [greataxe, cureWounds, heal, fireball];

describe('quickSearch matching', () => {
  it('builds search text from name plus keywords, lowercased', () => {
    expect(searchText(cureWounds)).toBe('cure wounds heal restore');
  });

  it('matches a substring of the name (anywhere)', () => {
    expect(isMatch('gre', greataxe)).toBe(true);
    expect(isMatch('axe', greataxe)).toBe(true);
  });

  it('matches a keyword for a name that does not contain the query', () => {
    expect(isMatch('heal', cureWounds)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isMatch('AXE', greataxe)).toBe(true);
  });

  it('does not match when query is absent from name and keywords', () => {
    expect(isMatch('sword', greataxe)).toBe(false);
  });

  it('returns matches in natural (input) order', () => {
    expect(filterMatches('heal', sample)).toEqual([cureWounds, heal]);
  });

  it('returns all options for an empty query', () => {
    expect(filterMatches('', sample)).toEqual(sample);
  });
});

describe('splitShown', () => {
  it('caps shown at CAP and reports the overflow count', () => {
    const many: SearchOption[] = Array.from({ length: 12 }, (_, i) => ({
      id: `o${i}`,
      name: `Option ${i}`,
      keywords: ''
    }));
    const { shown, overflowCount } = splitShown(many);
    expect(shown).toHaveLength(CAP);
    expect(overflowCount).toBe(3);
  });

  it('reports zero overflow when at or under the cap', () => {
    const { shown, overflowCount } = splitShown(sample);
    expect(shown).toHaveLength(sample.length);
    expect(overflowCount).toBe(0);
  });
});

describe('keyEnabled (dead keys)', () => {
  it('enables a letter that would still yield a match', () => {
    expect(keyEnabled('fire', 'b', sample)).toBe(true);
  });

  it('disables a letter that would yield no match', () => {
    expect(keyEnabled('fire', 'z', sample)).toBe(false);
  });
});

describe('whyBadge', () => {
  it('returns null when the name itself matches', () => {
    expect(whyBadge('heal', heal)).toBeNull();
  });

  it('returns the first matching keyword token for a keyword-only hit', () => {
    expect(whyBadge('heal', cureWounds)).toBe('heal');
  });

  it('returns null when there are no keywords', () => {
    expect(whyBadge('axe', greataxe)).toBeNull();
  });
});

describe('constants', () => {
  it('exposes the fixed-height well geometry', () => {
    expect(CAP).toBe(9);
    expect(WELL_ROWS).toBe(3);
    expect(RESULTS_COLUMNS).toBe(3);
  });
});
