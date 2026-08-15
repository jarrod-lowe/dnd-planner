import { describe, it, expect } from 'vitest';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import { resolveEntryValue, isEntryVisible } from '$lib/play/extractTopBar';

/**
 * The facts-driven top-bar / resources catalog (replacing the legacy
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

describe('derivePanels — top bar (steed subject)', () => {
  it('emits a steed HP entry, tagged subject:steed, when the steed has HP', () => {
    const facts = { 'companion.steed.hp.max': 25, 'companion.steed.hp.current': 18 };
    const steed = deriveTopBarEntries(facts).filter((e) => e.subject === 'steed');
    expect(steed.map((e) => e.label)).toEqual(['play.topBar.hp']);
    expect(resolveEntryValue(steed[0], facts)).toBe('18/25');
  });

  it('emits steed AC and speed value chips from the steed facts', () => {
    const facts = {
      'companion.steed.ac.value': 12,
      'companion.steed.movement.remaining': 60
    };
    const steed = deriveTopBarEntries(facts).filter((e) => e.subject === 'steed');
    expect(steed.map((e) => e.label)).toEqual(['play.topBar.ac', 'play.topBar.speed']);
    expect(steed.map((e) => resolveEntryValue(e, facts))).toEqual(['12', '60']);
  });

  it('emits a steed abilities chip with each modifier and its save', () => {
    const entry = deriveTopBarEntries({ 'companion.steed.str.modifier': 4 }).find(
      (e) => e.subject === 'steed'
    );
    expect(entry?.type).toBe('ability');
    expect(entry?.label).toBe('play.topBar.abilities');
    expect(entry?.type === 'ability' && entry.abilities).toEqual([
      {
        name: 'play.stats.str',
        fact: 'companion.steed.str.modifier',
        saveFact: 'companion.steed.str.save'
      },
      {
        name: 'play.stats.dex',
        fact: 'companion.steed.dex.modifier',
        saveFact: 'companion.steed.dex.save'
      },
      {
        name: 'play.stats.con',
        fact: 'companion.steed.con.modifier',
        saveFact: 'companion.steed.con.save'
      },
      {
        name: 'play.stats.int',
        fact: 'companion.steed.int.modifier',
        saveFact: 'companion.steed.int.save'
      },
      {
        name: 'play.stats.wis',
        fact: 'companion.steed.wis.modifier',
        saveFact: 'companion.steed.wis.save'
      },
      {
        name: 'play.stats.cha',
        fact: 'companion.steed.cha.modifier',
        saveFact: 'companion.steed.cha.save'
      }
    ]);
  });

  it('never emits a concentration chip for the steed', () => {
    const facts = {
      'companion.steed.hp.max': 25,
      'companion.steed.hp.current': 25,
      'companion.steed.ac.value': 12,
      'companion.steed.movement.remaining': 60,
      'companion.steed.str.modifier': 4,
      'concentration.max': 1
    };
    const steed = deriveTopBarEntries(facts).filter((e) => e.subject === 'steed');
    expect(steed.map((e) => e.type)).not.toContain('concentration');
    expect(steed.map((e) => e.label)).toEqual([
      'play.topBar.hp',
      'play.topBar.ac',
      'play.topBar.speed',
      'play.topBar.abilities'
    ]);
  });

  it('leaves the player chips untagged so the two subjects stay separate', () => {
    const facts = {
      'hp.max': 12,
      'hp.current': 12,
      'companion.steed.hp.max': 25,
      'companion.steed.hp.current': 25
    };
    const entries = deriveTopBarEntries(facts);
    const player = entries.filter((e) => e.subject === undefined);
    expect(player.map((e) => e.label)).toEqual(['play.topBar.hp']);
    expect(resolveEntryValue(player[0], facts)).toBe('12/12');
    expect(entries.filter((e) => e.subject === 'steed').length).toBe(1);
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

  it('includes an HP row in the ledger (hp.yaml declared both panels)', () => {
    const facts = { 'hp.max': 12, 'hp.current': 9 };
    const hp = deriveResourceEntries(facts).find((e) => e.label === 'play.stats.hp');
    expect(hp).toBeDefined();
    expect(resolveEntryValue(hp!, facts)).toBe('9/12');
  });

  it('picks the class hit die that is present (d10 for a paladin)', () => {
    const entries = deriveResourceEntries({ 'hitDie.d10.total': 5, 'hitDie.d10.remaining': 5 });
    const hd = entries.find((e) => e.type === 'hitDie');
    expect(hd?.type === 'hitDie' && hd.dieSize).toBe(10);
    expect(resolveEntryValue(hd!, { 'hitDie.d10.total': 5, 'hitDie.d10.remaining': 5 })).toBe(
      '5/5 d10'
    );
  });

  it('emits one hit-die entry per size with a total (multiclass 3d10 + 2d6)', () => {
    const facts = {
      'hitDie.d10.total': 3,
      'hitDie.d10.remaining': 2,
      'hitDie.d6.total': 2,
      'hitDie.d6.remaining': 2
    };
    const hd = deriveResourceEntries(facts).filter((e) => e.type === 'hitDie');
    // Emitted in ascending die-size order (HIT_DICE catalog order).
    expect(hd.map((e) => (e.type === 'hitDie' ? e.dieSize : undefined))).toEqual([6, 10]);
    expect(hd.map((e) => resolveEntryValue(e, facts))).toEqual(['2/2 d6', '2/3 d10']);
  });

  it('renders no hit-die row for a size whose total is zero (visibility gate)', () => {
    const facts = {
      'hitDie.d10.total': 3,
      'hitDie.d10.remaining': 3,
      'hitDie.d8.total': 0,
      'hitDie.d8.remaining': 0
    };
    const visible = deriveResourceEntries(facts).filter(
      (e) => e.type === 'hitDie' && isEntryVisible(e, facts)
    );
    expect(visible.map((e) => (e.type === 'hitDie' ? e.dieSize : undefined))).toEqual([10]);
  });

  it('includes Heroic Inspiration as a value when present', () => {
    const entries = deriveResourceEntries({ 'heroicInspiration.remaining': 1 });
    expect(entries.map((e) => e.label)).toEqual(['play.stats.heroicInspiration']);
  });

  it('is empty when no resource facts are present', () => {
    expect(deriveResourceEntries({})).toEqual([]);
  });

  it('surfaces steed resources (subject: steed) with only the matched special ability', () => {
    const facts = {
      'companion.steed.creatureType': 1, // fey → feyStep
      'companion.steed.hp.max': 30,
      'companion.steed.hp.current': 30,
      'companion.steed.movement.total': 60,
      'companion.steed.movement.remaining': 60,
      'companion.steed.actions.max': 1,
      'companion.steed.actions.remaining': 1,
      'companion.steed.bonusActions.max': 1,
      'companion.steed.bonusActions.remaining': 1,
      'companion.steed.healingTouch.total': 1,
      'companion.steed.feyStep.total': 1,
      'companion.steed.feyStep.remaining': 1,
      'companion.steed.fellGlare.total': 1
    };
    const steed = deriveResourceEntries(facts).filter((e) => e.subject === 'steed');
    const labels = steed.map((e) => e.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'play.stats.steed.hp',
        'play.stats.steed.movement',
        'play.stats.steed.actions',
        'play.stats.steed.bonusActions',
        'play.stats.steed.feyStep'
      ])
    );
    // Only the creature-type-matched ability (feyStep) — not healingTouch/fellGlare.
    expect(labels).not.toContain('play.stats.steed.healingTouch');
    expect(labels).not.toContain('play.stats.steed.fellGlare');
  });

  it('adds no steed resources for a character without a steed', () => {
    const steed = deriveResourceEntries({ 'actions.max': 1, 'actions.remaining': 1 }).filter(
      (e) => e.subject === 'steed'
    );
    expect(steed).toEqual([]);
  });
});
