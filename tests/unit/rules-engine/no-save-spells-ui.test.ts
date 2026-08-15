import { describe, it, expect } from 'vitest';
import bless from '$lib/rules-engine/rules/bless';
import protectionFromEvilAndGood from '$lib/rules-engine/rules/protection-from-evil-and-good';

/**
 * Bless and Protection from Evil and Good force no saving throw — their SRD text
 * has no save at all (Bless adds 1d4 to the target's own rolls; PfEaG imposes
 * disadvantage/immunity). A "Save DC" information line on their cast panels
 * would tell the player to roll a save that doesn't exist, so the cast offers
 * must carry no saveDc information block.
 */

const castOffer = (module: typeof bless, id: string) => {
  const offers = module.offer!({ selections: {} });
  const offer = offers.find((o) => o.id === id);
  if (!offer?.ui) throw new Error(`offer ${id} with a ui payload expected`);
  return offer.ui;
};

describe('spells without saving throws — no DC line', () => {
  it('cast-bless carries no saveDc information block', () => {
    expect(castOffer(bless, 'cast-bless').information).toBeUndefined();
  });

  it('cast-protection-from-evil-and-good carries no saveDc information block', () => {
    expect(
      castOffer(protectionFromEvilAndGood, 'cast-protection-from-evil-and-good').information
    ).toBeUndefined();
  });
});
