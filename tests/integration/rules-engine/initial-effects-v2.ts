import type { EffectInstance } from '$lib/rules-engine-v2';

/**
 * v2 translations of scenarios' v1 `initialEffects` blocks — the committed-effect
 * adapter for the parity harness.
 *
 * The shared `yaml-scenarios` corpus authors "already active" starting state as v1
 * rule objects (`initialEffects`), which only the v1 runner understands. Rather
 * than fork the corpus, each such scenario gets an entry here: the committed
 * `EffectInstance[]` the v2 engine should START with so it reproduces the SAME
 * derived facts the v1 `initialEffects` produce. A scenario is runnable on v2 once
 * it has an entry (see the parity test's skip logic).
 *
 * Translation rule: reproduce the v1 fixture's *resulting facts*, but written as
 * v2 INPUT facts wherever v2 derives the fact the v1 rule set directly —
 *   - `ac.base`      (v1, set) → `ac.armorBase`  (v2 derives `ac.base` from it)
 *   - `ac.dexBonus`  (v1, set) → `ac.dexCap`     (v2 derives `ac.dexBonus = min(dex, cap)`)
 *   - slot `.remaining` (v1, set) → omit; set only `.total` (v2 derives remaining)
 * — and DO NOT add facts the v1 fixture didn't set (e.g. `hands.spent`), so both
 * engines start from an identical fact-state.
 */

const permanent = { kind: 'permanent' } as const;

/**
 * A weapon held equipped. `handsSpent` mirrors a v1 fixture that also decremented
 * `hands.remaining` (v2 derives `remaining = max − spent`); the basic
 * attack fixtures set only the equipped flag, so it defaults to 0.
 */
const weaponEquipped = (id: string, handsSpent = 0): EffectInstance => {
  const state: Record<string, number> = { [`weapon.${id}.equipped`]: 1 };
  if (handsSpent > 0) state['hands.spent'] = handsSpent;
  return { id: `effect-${id}`, state, expiry: permanent };
};

/** Hands already occupied (v1 decremented `hands.remaining` by `n`). */
const handsOccupied = (n: number): EffectInstance => ({
  id: 'effect-hands-occupied',
  state: { 'hands.spent': n },
  expiry: permanent
});

/** Light (leather) body armor: AC 11 base, full Dex. */
const leatherEquipped = (): EffectInstance => ({
  id: 'effect-leather-armor',
  key: 'armor:body',
  state: { 'ac.armorBase': 11, 'armor.leather.equipped': 1 },
  stateCombine: { 'ac.armorBase': 'max' },
  expiry: permanent
});

/** Heavy (splint) body armor: AC 17, no Dex (dex cap 0). */
const splintEquipped = (): EffectInstance => ({
  id: 'effect-splint-armor',
  key: 'armor:body',
  state: { 'ac.armorBase': 17, 'ac.dexCap': 0, 'armor.splint.equipped': 1 },
  stateCombine: { 'ac.armorBase': 'max' },
  expiry: permanent
});

/** A shield held: +2 AC. `handsSpent` mirrors a fixture that also used a hand. */
const shieldEquipped = (handsSpent = 0): EffectInstance => {
  const state: Record<string, number> = { 'ac.shieldBonus': 2, 'armor.shield.equipped': 1 };
  if (handsSpent > 0) state['hands.spent'] = handsSpent;
  return { id: 'effect-shield', state, expiry: permanent };
};

/** A binary training/flag fact granted (e.g. `armor.light.proficient`). */
const flag = (fact: string, value = 1): EffectInstance => ({
  id: `flag-${fact}`,
  state: { [fact]: value },
  expiry: permanent
});

/**
 * Heroic Inspiration already granted — the keyed permanent effect `grant-hi`
 * advertises. The key matches so a planned `use-hi` (or a long-rest grant)
 * replaces/dedupes it rather than stacking.
 */
const hiGranted = (): EffectInstance => ({
  id: 'effect-hi-set',
  key: 'heroic-inspiration',
  state: { 'heroicInspiration.remaining': 1 },
  expiry: permanent
});

/**
 * A spell slot the character owns. v1 fixtures set `total` and `remaining`
 * directly; v2 derives `remaining = total − spent`, so we set `total` and, when a
 * fixture starts with a slot already used (`remaining < total`), the matching
 * `spent`.
 */
const slot = (level: number, total = 1, remaining = total): EffectInstance => {
  const state: Record<string, number> = { [`spellcasting.slots.level${level}.total`]: total };
  const spent = total - remaining;
  if (spent > 0) state[`spellcasting.slots.level${level}.spent`] = spent;
  return { id: `slot-l${level}`, state, expiry: permanent };
};

export const INITIAL_EFFECTS_V2: Record<string, EffectInstance[]> = {
  // === Armor / shield ===
  'leather-armor-already-equipped': [leatherEquipped()],
  'leather-armor-proficient': [flag('armor.light.proficient')],
  'splint-armor-already-equipped': [splintEquipped()],
  'splint-armor-proficient': [flag('armor.heavy.proficient')],
  'shield-already-equipped': [shieldEquipped()],
  'shield-proficient': [flag('armor.shield.proficient')],
  'shield-with-splint-armor': [flag('armor.heavy.proficient'), flag('armor.shield.proficient')],

  // === Weapons: an already-equipped weapon (v1 set only weapon.<id>.equipped) ===
  'attack-greataxe': [weaponEquipped('greataxe')],
  'attack-javelin': [weaponEquipped('javelin')],
  'attack-scimitar': [weaponEquipped('scimitar')],
  'attack-spear': [weaponEquipped('spear')],
  'attack-spear-plus1': [weaponEquipped('spear-plus1')],
  'greataxe-cleave-mastery': [weaponEquipped('greataxe')],
  'javelin-slow-mastery': [weaponEquipped('javelin')],
  'spear-versatile-damage-die': [weaponEquipped('spear')],
  'weapon-don-illegal-when-equipped': [weaponEquipped('dagger')],
  'weapon-donned-attacks-visible': [weaponEquipped('dagger')],
  'fighting-style-great-weapon-annotations': [weaponEquipped('greataxe')],
  'savage-attacker-annotations': [weaponEquipped('dagger')],
  'savage-attacker-weapon-only': [weaponEquipped('dagger')],
  'savage-attacker-usage': [weaponEquipped('dagger')],

  // === Spell slots (v1 set total+remaining; v2 derives remaining from total − spent) ===
  'aid-cast': [slot(2)],
  'prayer-of-healing-cast': [slot(2)],
  'prayer-of-healing-upcast': [slot(3)],
  'sanctuary-slot-selection': [slot(2)],
  'sleep-slot-selection': [slot(2)],
  'protection-from-evil-and-good-slot-selection': [slot(2)],
  'calm-emotions-cast': [slot(2)],
  'calm-emotions-concentration-blocking': [slot(2, 2)],
  'calm-emotions-concentration-illegal-planned': [slot(2, 2)],
  'calm-emotions-no-free-slots-illegal': [slot(2, 1, 0)],
  'calm-emotions-select-level-illegal': [slot(2), slot(3, 1, 0)],
  'calm-emotions-slot-selection': [slot(2), slot(3)],
  'calm-emotions-upcast-slider': [slot(2)],
  'hold-person-cast': [slot(2)],
  'hold-person-concentration-blocking': [slot(2, 2)],
  'hold-person-concentration-illegal-planned': [slot(2, 2)],
  'hold-person-no-free-slots-illegal': [slot(2, 1, 0)],
  'hold-person-select-level-illegal': [slot(2), slot(3, 1, 0)],
  'hold-person-slot-selection': [slot(2), slot(3)],
  'hold-person-upcast-slider': [slot(2)],
  // prepare/unprepare scenarios that assert only the final prepared state (no v1
  // `removing` intermediate), so v2's immediate-evict reproduces them.
  'aid-prepare': [slot(2)],
  'prayer-of-healing-prepare': [slot(2)],
  'find-steed-prepare': [slot(2)],

  // === Heroic Inspiration already granted ===
  'hi-annotation': [hiGranted()],
  'hi-effect-grant-plan-errors': [hiGranted()],
  // hi-effect-grant-use is a by-design plan-order divergence (SKIP_BY_NAME), not
  // migrated: it plans use-hi then grant-hi and expects grant-hi to see the
  // pre-consumption remaining (v1 phase-order); v2's fold consumes first.
  'hi-grant-illegal-when-active': [hiGranted()],
  'hi-use': [hiGranted()],
  'hi-use-effect-removed': [hiGranted()],
  'hi-use-twice': [hiGranted()],
  'hi-human-long-rest-no-duplicate': [hiGranted()],

  // === Extra Attack (a granted extraAttacks.max and/or an equipped weapon) ===
  'extra-attack-disabled': [weaponEquipped('greataxe')],
  'extra-attack-grapple': [flag('extraAttacks.max')],
  'extra-attack-greataxe': [weaponEquipped('greataxe'), flag('extraAttacks.max')],
  'extra-attack-overcommit': [weaponEquipped('greataxe'), flag('extraAttacks.max')],
  'extra-attack-paladin-level5': [weaponEquipped('greataxe')],
  'extra-attack-shove': [flag('extraAttacks.max')],
  'extra-attack-unarmed': [flag('extraAttacks.max')],
  'extra-attack-unarmed-overcommit': [flag('extraAttacks.max')],

  // === Smites (a granted slot; the free use / always-prepared come from the groups) ===
  'divine-smite-cap-high-slot': [slot(6)],
  'divine-smite-dice-roller': [slot(1)],
  'smite-default-higher-slot': [slot(2)],
  'smite-legal-higher-slot': [slot(2)],
  'tsmite-cap-high-slot': [slot(6)],
  'tsmite-upcast': [slot(2)],

  // === Hands budget (v1 decremented hands.remaining; v2 sets hands.spent) ===
  'hands-two-daggers-legal': [shieldEquipped(1)],
  'hands-shield-then-greataxe-illegal': [shieldEquipped(1)],
  'hands-greataxe-then-shield-illegal': [weaponEquipped('greataxe', 2)],
  'grapple-no-free-hand': [handsOccupied(2)],
  'grapple-no-free-hand-normal-effect': [handsOccupied(2)],
  'grapple-no-hand-even-when-saved': [handsOccupied(2)],
  'grapple-saved-frees-hand': [flag('extraAttacks.max')],
  'spear-2h-effects-ordering': [weaponEquipped('dagger', 1), weaponEquipped('spear', 1)],
  'spear-2h-reaction-no-free-hands': [weaponEquipped('dagger', 1), weaponEquipped('spear', 1)],

  // === Find Steed (casting) — a granted slot; the free use comes from the group ===
  'find-steed-basic-cast': [slot(2)],
  'find-steed-illegal-no-slots': [slot(2)],
  'find-steed-upcast': [slot(4)],
  'find-steed-highest-slot': [slot(2, 2), slot(3)],
  'find-steed-select-level-illegal': [slot(2), slot(3, 1, 0)],
  'find-steed-action-resource': [slot(2)],
  'find-steed-two-actions-legality': [slot(2)],
  'find-steed-same-turn-offers': [slot(2)],
  'find-steed-same-turn-dash': [slot(2)],

  // === Reactions (an equipped weapon; reaction tracked via steps) ===
  'reaction-tracking': [weaponEquipped('greataxe')],
  'rebuke-the-violent-illegal-no-reaction': [weaponEquipped('greataxe')],

  // === Steed behaviour (a granted slot; the steed is summoned in a cast step) ===
  'steed-saves': [slot(2)],
  'steed-skill-checks': [slot(2)],
  'steed-movement-walk': [slot(2)],
  'steed-movement-fly': [slot(4)],
  'steed-fly-illegal-l2': [slot(2)],
  'steed-dash': [slot(2)],
  'steed-dodge-disengage': [slot(2)],
  'steed-slam': [slot(2)],
  'steed-slam-upcast': [slot(3)],
  'steed-note': [slot(2)],
  'steed-healing-touch': [slot(2)],
  'steed-fey-step': [slot(2)],
  'steed-fell-glare': [slot(2)],
  'steed-fell-glare-same-turn': [slot(2)],
  'steed-fey-step-same-turn': [slot(2)],
  'steed-healing-touch-same-turn': [slot(2)],
  // steed-creature-type-fey (string damageType fact) and steed-zero-hp-dismiss
  // (passive self-removal) are SKIP_BY_NAME v2 limitations, not migrated.
  'steed-creature-type-gating-celestial': [slot(2)],
  'steed-creature-type-gating-fey': [slot(2)],
  'steed-creature-type-gating-fiend': [slot(2)],
  'steed-hp-modifiers': [slot(2)],
  'steed-hp-mods': [slot(2)],
  'find-steed-dismiss': [slot(2)],
  'find-steed-long-rest': [slot(2)],
  'find-steed-life-bond': [slot(2)],
  'find-steed-hp-modifier-no-stacking': [slot(2)],
  // The scenario's initialEffects grant a L2 slot AND equip the Spear +1; the
  // equip half was masked while the plan fold ignored `when` gates.
  'attack-with-summoned-steed': [slot(2), weaponEquipped('spear-plus1')]
};
