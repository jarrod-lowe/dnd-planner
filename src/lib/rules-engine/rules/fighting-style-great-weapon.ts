import { defineRule, type RuleModule } from '../builder';

const F = 'rule.dnd-5e-2024.fighting-style-great-weapon';

/**
 * Great Weapon Fighting style — sets `character.fightingStyle.greatWeapon` and,
 * once a weapon attack has been made this turn, annotates the weapon panels held
 * in two hands with the reroll reminder. Foundational, so no search meta.
 *
 * WHICH panels those are depends on the grip, and the grip is a rule, not a UI
 * concern: a two-handed weapon always qualifies, while a versatile one qualifies
 * only while the loadout actually has it in both hands. That gate used to live in
 * PanelRenderer as `selectionExtraHands > 0`, reading a per-attack selection; when
 * the loadout took ownership of the grip nothing wrote that selection any more, so
 * the gate silently pinned itself false and GWF died for every versatile weapon.
 */
const fightingStyleGreatWeapon: RuleModule = {
  id: 'fighting-style-great-weapon',
  derive: () => [{ fact: 'character.fightingStyle.greatWeapon', value: () => 1 }],
  annotate: (f) =>
    // `attack.last.weapon` sums per weapon swing (Extra Attack → 2+), so gate on
    // `>= 1` — as Savage Attacker does — not `=== 1`, which drops the rider on
    // the second swing.
    f.num('character.fightingStyle.greatWeapon') === 1 && f.num('attack.last.weapon') >= 1
      ? [
          {
            key: `${F}.annotation`,
            // `property.twoHanded` is unconditional — such a weapon is never held
            // any other way. `property.versatile` joins only while `grip.twoHanded`
            // says the loadout put both hands on it; dropping the target is what
            // keeps the rider off a one-handed spear's panel, since a panel only
            // receives annotations whose targets intersect its own labels.
            targets:
              f.num('grip.twoHanded') === 1
                ? ['property.twoHanded', 'property.versatile']
                : ['property.twoHanded'],
            rider: { label: `${F}.rider`, type: 'modifier' }
          }
        ]
      : []
};

export default defineRule(fightingStyleGreatWeapon);
