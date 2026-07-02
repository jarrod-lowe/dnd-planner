import { describe, it, expect } from 'vitest';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import { resolveEntryValue } from '$lib/play/extractTopBar';

/**
 * M4/W4 — the facts-driven top-bar / resources catalog (v2 replacement for the v1
 * `ui.topBar`/`ui.resources` extraction). An entry surfaces iff its driving fact
 * is present, and the existing resolveEntryValue renders it unchanged.
 */

describe('derivePanels — top bar', () => {
  it('emits an entry only when its driving fact is present', () => {
    expect(deriveTopBarEntries({}).length).toBe(0);
    const hpOnly = deriveTopBarEntries({ 'hp.max': 10, 'hp.current': 7 });
    expect(hpOnly.map((e) => e.label)).toEqual(['play.topBar.hp']);
    expect(resolveEntryValue(hpOnly[0], { 'hp.max': 10, 'hp.current': 7 })).toBe('7/10');
  });

  it('assembles the full bar (HP / AC / speed / concentration / abilities) in type order', () => {
    const facts = {
      'hp.max': 12,
      'hp.current': 12,
      'ac.value': 16,
      'character.movement.remaining': 30,
      'concentration.max': 1,
      'str.modifier': 3
    };
    const labels = deriveTopBarEntries(facts).map((e) => e.label);
    // usedMax(hp) < value(ac,speed) < concentration < ability
    expect(labels).toEqual([
      'play.topBar.hp',
      'play.topBar.ac',
      'play.topBar.speed',
      'play.topBar.conc',
      'play.topBar.abilities'
    ]);
    const abilityEntry = deriveTopBarEntries(facts).find((e) => e.type === 'ability');
    expect(abilityEntry?.type === 'ability' && abilityEntry.abilities.map((a) => a.fact)).toEqual([
      'str.modifier',
      'dex.modifier',
      'con.modifier',
      'int.modifier',
      'wis.modifier',
      'cha.modifier'
    ]);
  });
});

describe('derivePanels — resources', () => {
  it('emits pools whose total fact is present', () => {
    const facts = {
      'actions.max': 1,
      'actions.remaining': 1,
      'spellcasting.max': 1,
      'spellcasting.remaining': 1,
      'layOnHands.pool.total': 5,
      'layOnHands.pool.remaining': 5
    };
    const labels = deriveResourceEntries(facts).map((e) => e.label);
    expect(labels).toContain('play.stats.actions');
    expect(labels).toContain('play.stats.spellcasting');
    expect(labels).toContain('play.stats.layOnHands');
    expect(labels).not.toContain('play.stats.divinity'); // no divinity facts
  });

  it('picks the class hit die that is present (d10 for a paladin)', () => {
    const entries = deriveResourceEntries({ 'hitDie.d10.total': 5, 'hitDie.d10.remaining': 5 });
    const hd = entries.find((e) => e.type === 'hitDie');
    expect(hd?.type === 'hitDie' && hd.dieSize).toBe(10);
    expect(resolveEntryValue(hd!, { 'hitDie.d10.total': 5, 'hitDie.d10.remaining': 5 })).toBe('5/5 d10');
  });

  it('includes Heroic Inspiration as a value when present', () => {
    const entries = deriveResourceEntries({ 'heroicInspiration.remaining': 1 });
    expect(entries.map((e) => e.label)).toEqual(['play.stats.heroicInspiration']);
  });

  it('is empty when no resource facts are present', () => {
    expect(deriveResourceEntries({})).toEqual([]);
  });
});
