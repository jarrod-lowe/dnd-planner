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

/** A weapon held equipped (v1 set only `weapon.<id>.equipped`; no hand consumed). */
const weaponEquipped = (id: string): EffectInstance => ({
  id: `effect-${id}`,
  state: { [`weapon.${id}.equipped`]: 1 },
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

/** A shield held: +2 AC (v1 fixture consumed no hand). */
const shieldEquipped = (): EffectInstance => ({
  id: 'effect-shield',
  state: { 'ac.shieldBonus': 2, 'armor.shield.equipped': 1 },
  expiry: permanent
});

/** A binary training/flag fact granted (e.g. `armor.light.proficient`). */
const flag = (fact: string, value = 1): EffectInstance => ({
  id: `flag-${fact}`,
  state: { [fact]: value },
  expiry: permanent
});

export const INITIAL_EFFECTS_V2: Record<string, EffectInstance[]> = {
  // === Armor / shield ===
  'leather-armor-already-equipped': [leatherEquipped()],
  'leather-armor-proficient': [flag('armor.light.proficient')],
  'splint-armor-already-equipped': [splintEquipped()],
  'splint-armor-proficient': [flag('armor.heavy.proficient')],
  'shield-already-equipped': [shieldEquipped()],
  'shield-proficient': [flag('armor.shield.proficient')],
  'shield-with-splint-armor': [flag('armor.heavy.proficient'), flag('armor.shield.proficient')],

  // === Weapons (feat riders) ===
  'savage-attacker-usage': [weaponEquipped('dagger')]
};
