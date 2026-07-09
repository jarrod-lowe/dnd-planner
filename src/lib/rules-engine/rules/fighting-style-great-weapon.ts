import { defineRule, type RuleModule } from '../builder';

const F = 'rule.dnd-5e-2024.fighting-style-great-weapon';

/**
 * Great Weapon Fighting style — sets `character.fightingStyle.greatWeapon` and,
 * once a weapon attack has been made this turn, annotates two-handed/versatile
 * weapon panels with the reroll reminder. Foundational, so no search meta.
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
            targets: ['property.twoHanded', 'property.versatile'],
            rider: { label: `${F}.rider`, type: 'modifier' }
          }
        ]
      : []
};

export default defineRule(fightingStyleGreatWeapon);
