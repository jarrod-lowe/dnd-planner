import { describe, it, expect } from 'vitest';
import type { Facts } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

/** A spent slot lasts until a long rest; the expiry is irrelevant to the derivation. */
function effect(id: string, state?: Record<string, number>): EffectInstance {
  const base: EffectInstance = { id, expiry: { kind: 'untilLongRest' } };
  return state === undefined ? base : { ...base, state };
}

describe('deriveSlotLevels', () => {
  it('returns an empty array when there are no slot facts at all', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = { 'hp.max': 35, 'hp.current': 28 };
    expect(deriveSlotLevels(facts, [])).toEqual([]);
  });

  it('reports a full level with nothing spent', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 0
    };
    expect(deriveSlotLevels(facts, [])).toEqual([
      { level: 1, total: 4, open: 4, thisTurn: 0, spent: 0 }
    ]);
  });

  it('treats a missing spent fact as zero spent', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = { 'spellcasting.slots.level1.total': 4 };
    expect(deriveSlotLevels(facts, [])).toEqual([
      { level: 1, total: 4, open: 4, thisTurn: 0, spent: 0 }
    ]);
  });

  it('counts one slot spent by an advertised effect as this turn', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 1
    };
    const advertised = [effect('bless', { 'spellcasting.slots.level1.spent': 1 })];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 3, thisTurn: 1, spent: 1 }
    ]);
  });

  it('sums two slots spent at the same level this turn', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 2
    };
    const advertised = [
      effect('bless', { 'spellcasting.slots.level1.spent': 1 }),
      effect('cure-wounds', { 'spellcasting.slots.level1.spent': 1 })
    ];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 2, thisTurn: 2, spent: 2 }
    ]);
  });

  it('splits this-turn spends across two different levels', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 1,
      'spellcasting.slots.level2.total': 3,
      'spellcasting.slots.level2.spent': 1
    };
    const advertised = [
      effect('bless', { 'spellcasting.slots.level1.spent': 1 }),
      effect('hold-person', { 'spellcasting.slots.level2.spent': 1 })
    ];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 3, thisTurn: 1, spent: 1 },
      { level: 2, total: 3, open: 2, thisTurn: 1, spent: 1 }
    ]);
  });

  it('lands an upcast spend on the upcast level, not the authored level', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    // Bless is authored at level 1 but cast with a level 3 slot: the advertised
    // effect names level 3, so level 1 must stay untouched.
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 0,
      'spellcasting.slots.level3.total': 2,
      'spellcasting.slots.level3.spent': 1
    };
    const advertised = [effect('bless', { 'spellcasting.slots.level3.spent': 1 })];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 4, thisTurn: 0, spent: 0 },
      { level: 3, total: 2, open: 1, thisTurn: 1, spent: 1 }
    ]);
  });

  it('counts a prior-turn spend as spent but not as this turn', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 2
    };
    // Only one of the two spends is in this turn's plan.
    const advertised = [effect('bless', { 'spellcasting.slots.level1.spent': 1 })];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 2, thisTurn: 1, spent: 2 }
    ]);
  });

  it('counts a prior-turn spend with no advertised effects at all', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 1
    };
    expect(deriveSlotLevels(facts, [])).toEqual([
      { level: 1, total: 4, open: 3, thisTurn: 0, spent: 1 }
    ]);
  });

  it('ignores advertised effects with no state and with unrelated state keys', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 0
    };
    const advertised = [
      effect('stateless'),
      effect('unrelated', { 'hp.current': -3, 'divinity.spent': 1 }),
      effect('other-level-shaped', { 'spellcasting.slots.level1.total': 1 })
    ];
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 4, open: 4, thisTurn: 0, spent: 0 }
    ]);
  });

  it('omits a level whose total is 0 even when other levels are present', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 0,
      'spellcasting.slots.level2.total': 0,
      'spellcasting.slots.level2.spent': 0,
      'spellcasting.slots.level3.total': 2,
      'spellcasting.slots.level3.spent': 0
    };
    const result = deriveSlotLevels(facts, []);
    expect(result.map((l) => l.level)).toEqual([1, 3]);
  });

  it('reports a negative open for an over-budget plan (deliberate — do not clamp)', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    // The engine does not veto an illegal cast: it applies it and advertises the
    // spend, so `spent` can exceed `total`. Two level-1 slots, three cast.
    const facts: Facts = {
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 3
    };
    const advertised = [
      effect('bless', { 'spellcasting.slots.level1.spent': 1 }),
      effect('cure-wounds', { 'spellcasting.slots.level1.spent': 1 }),
      effect('shield-of-faith', { 'spellcasting.slots.level1.spent': 1 })
    ];
    // -1, NOT 0: the player is one slot into the red and must be told the size
    // of the overdraft. The ledger flags the illegality separately.
    expect(deriveSlotLevels(facts, advertised)).toEqual([
      { level: 1, total: 2, open: -1, thisTurn: 3, spent: 3 }
    ]);
  });

  it('covers levels 1 through 9', async () => {
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const facts: Facts = {};
    for (let level = 1; level <= 9; level++) {
      facts[`spellcasting.slots.level${level}.total`] = 1;
    }
    const advertised = [effect('wish', { 'spellcasting.slots.level9.spent': 1 })];
    facts['spellcasting.slots.level9.spent'] = 1;
    const result = deriveSlotLevels(facts, advertised);
    expect(result.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result[8]).toEqual({ level: 9, total: 1, open: 0, thisTurn: 1, spent: 1 });
  });
});
