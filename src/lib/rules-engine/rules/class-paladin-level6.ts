import { defineRule, type RuleModule } from '../builder';

const A = 'rule.class-paladin-level6';

/**
 * Paladin level 6 contributions, stacking on levels 1–5 (all `combine: sum`):
 * a sixth hit die, +6 (average d10) + the live CON modifier to max HP (as at
 * every level — 2024: retroactive recalc on a CON change), and +5 Lay on Hands
 * (→ 30).
 *
 * Level 6 is otherwise a flat step on the class table: proficiency stays +3,
 * prepared-spell capacity stays 6, the slot line stays 4×level-1 / 2×level-2 and
 * Channel Divinity stays at 2 uses, so nothing is contributed for those (the
 * level-6 scenarios assert they hold).
 *
 * Aura of Protection is a rider, not a derive: it grants a BONUS to saving
 * throws (CHA modifier, minimum +1) rather than changing the saving throw
 * modifier, so `{a}.save` — and the top bar that displays it — stay untouched.
 * It targets every save panel plus the steed's (`save.any.companion`: an ally
 * in the 10-foot emanation), and the UI renders it as a default-on toggle chip.
 *
 * Deliberately not modelled: the 10-foot radius and ally positioning, the
 * "inactive while Incapacitated" clause (the player switches the chip off —
 * conditions are not modelled anywhere in the app), the one-aura-at-a-time rule
 * for a second paladin (irrelevant to a single-character tracker), and death
 * saves (not modelled).
 */
const paladinLevel6: RuleModule = {
  id: 'class-paladin-level6',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ],
  annotate: (f) => [
    {
      key: `${A}.aura-of-protection`,
      targets: ['save.any', 'save.any.companion'],
      rider: {
        label: `${A}.aura-of-protection`,
        type: 'modifier',
        value: { kind: 'flat', bonus: Math.max(1, f.num('cha.modifier')) },
        appliesTo: 'save'
      }
    }
  ]
};

export default defineRule(paladinLevel6);
