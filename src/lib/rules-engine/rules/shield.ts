import { defineRule, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.shield';

/**
 * Shield — +2 AC, one hand.
 *
 * There is no don-shield offer any more: a shield is one of the things you can
 * HOLD, so it declares `equip` and the `loadout` group's `set-loadout` puts it in
 * a hand as part of a whole configuration. That is the only write path, which is
 * why this module is now pure declaration — the AC bonus and the equipped flag
 * ride on the loadout effect, keyed so a swap evicts them atomically.
 *
 * `ac.shieldBonus` is additive and distinct from the worn-armor base, so it
 * composes with leather/splint exactly as before. Foundational equip group, so no
 * search meta.
 */
const shield: RuleModule = {
  id: 'shield',
  // One hand, and never two of them: a shield is not stackable, so the loadout
  // enumerator never offers "Shield + Shield".
  equip: {
    hands: 1,
    nameKey: `${S}.effect-shield.name`,
    state: { 'armor.shield.equipped': 1, 'ac.shieldBonus': 2 }
  }
};

export default defineRule(shield);
