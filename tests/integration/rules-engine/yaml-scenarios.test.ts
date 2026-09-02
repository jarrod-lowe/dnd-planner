import { describe, it, expect } from 'vitest';
import { evaluate, endTurn } from '$lib/rules-engine';
import { resolveModules } from '$lib/rules-engine/registry';
import type {
  Diagnostic,
  EffectInstance,
  EngineInput,
  EngineOutput,
  Facts,
  PlannedRef,
  RuleModule
} from '$lib/rules-engine';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { INITIAL_EFFECTS } from './initial-effects';
import { assertAnnotations, type AnnotationAssert } from './assert-annotations';

/**
 * M1 / W5 — the parity harness (the acceptance gate).
 *
 * Each scenario's `test.yaml` already encodes the expected output, so it is the
 * oracle. This runner maps a scenario's `ruleGroups` to rule modules via the
 * registry, drives the same steps through `evaluate()`, and runs the same
 * assertions.
 *
 * M1 coverage is bounded by what is ported: a scenario runs only when *every*
 * group resolves to a rule module (and it does not depend on an offer/feature not
 * yet ported — the SKIP_BY_NAME list). Everything else is skipped and counted, so
 * coverage grows automatically as M3 ports more groups. Wired into `make test`
 * via the tests/integration include.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosDir = join(__dirname, 'yaml-scenarios');

// Groups are ported, but these scenarios exercise offers/setters not yet ported
// as rule modules. Skipped with
// a reason rather than silently, so the gap is visible and counted.
const SKIP_BY_NAME: Record<string, string> = {
  // Groups resolve, but these need features still on the M3 backlog:
  // hi-human-long-rest-grant and divinity-short-rest-reset now run via the onRest
  // hook (a passive module emitting a persistent effect from a rest event).
  // hi-human-long-rest-no-duplicate stays skipped by the initialEffects rule
  // (legacy-format initialEffects) rather than for a missing feature.
  // Plans use-hi before grant-hi and relies on the legacy reordering of use AFTER
  // grant (after: group). The plan fold is plan-order-significant by design, so it
  // yields remaining=1 (can't use what you lack, then grant it) — a deliberate divergence.
  'hi-use-then-grant':
    'relies on legacy intra-turn reordering; the plan fold is plan-order (by design)',
  'hi-effect-grant-use':
    'relies on legacy intra-turn reordering; the plan fold is plan-order (by design)',
  // Asserts layOnHands.pool.remaining but omits the class-paladin-lay-on-hands
  // group that derives it (the legacy rules set remaining directly in the class-level
  // rules). pool.total still matches; remaining is covered by the level2/3
  // loh-pool scenarios that do load the group.
  'paladin-level3-loh-pool': 'omits the lay-on-hands group, which derives pool.remaining',
  // Same as paladin-level3-loh-pool: asserts layOnHands.pool.remaining but omits
  // the class-paladin-lay-on-hands group that derives it.
  'oath-redemption-level4': 'omits the lay-on-hands group, which derives pool.remaining',
  // Tests the legacy `removing` 2-turn unprepare lifecycle (spell.l1.sleep.removing +
  // effect-sleep-prepared/-removing). The engine evicts the prepare effect immediately
  // (same end state), as bless/protection prepare already do. sleep-prepare only.
  'sleep-prepare':
    'legacy `removing` unprepare lifecycle; the engine evicts immediately (same end state)',
  'calm-emotions-prepare':
    'legacy `removing` unprepare lifecycle; the engine evicts immediately (same end state)',
  'hold-person-prepare':
    'legacy `removing` unprepare lifecycle; the engine evicts immediately (same end state)',
  // Plans don-dagger THEN lock, then expects the earlier-planned don to retroactively
  // pick up the lock error. The plan fold is plan-order (the don is folded before the
  // lock sets build.locked), so it does not — the same deliberate divergence as
  // hi-use-then-grant. The build-lock scenario proper (lock flips the offers) runs.
  'build-lock-weapon-clear':
    'relies on legacy intra-turn reordering; the plan fold is plan-order (by design)',
  // The steed's damage type is a STRING fact ('radiant'/'psychic'/'necrotic');
  // facts are numeric only (creatureType 0/1/2 is set, the string label is not).
  'steed-creature-type-fey': 'string fact (companion.steed.damageType) — facts are numeric',
  // The steed vanishing at 0 HP was a self-advertise-gated-on-hp + cascadeRemove
  // lifecycle; committed effects cannot self-remove when a derived fact crosses
  // a threshold (there is no per-turn re-advertise hook), so this passive death is
  // by design not reproduced (explicit dismiss cascades correctly — see no-stacking).
  'steed-zero-hp-dismiss':
    'passive self-removal at 0 HP needed the removed self-advertise/cascadeRemove lifecycle',
  // The javelin Slow followup now commits a current-format EffectInstance
  // (`addRule.effect`), where the scenario asserts a legacy-shape effect rule
  // (`addRule.rule`). That is a deliberate shape change; the followup shape is
  // asserted directly in the weapons unit test instead.
  'javelin-slow-mastery':
    'followup commits an EffectInstance (addRule.effect); the scenario asserts the legacy addRule.rule'
};

// The scenarios expected to run today. Asserted as an exact set so that a
// regression (a module dropping out of the registry) fails loudly instead of
// quietly shrinking coverage.
const EXPECTED_RUNNABLE = [
  // M0/M1 baseline
  'bonus-action-init',
  'paladin-spell-slots',
  'spellcasting-base-reset',
  // M3 wave A — free-actions (free action + Help)
  'action-economy-actions-reset-each-turn',
  'action-economy-free-action',
  'action-economy-help-action',
  'action-economy-too-many-actions',
  // M3 wave A — ability-scores + proficiency (and the saveDC / paladin-save adds)
  'ability-increase-affects-skills-saves',
  'ability-increase-basic',
  'ability-increase-max-illegal',
  'ability-increase-offer-exists',
  'ability-increase-past-max',
  'ability-increase-persists',
  'ability-score-cannot-set-twice',
  'ability-score-persists-across-turns',
  'ability-score-set',
  'ability-scores-all-six',
  'acrobatics-skill',
  'config-offers-legal-without-facts',
  'paladin-proficiency',
  'proficiency-base-reset',
  'save-proficiency',
  'save-proficiency-persists-across-turns',
  'save-proficiency-with-paladin',
  'skill-proficiency',
  'skill-proficiency-persists-across-turns',
  'skill-proficiency-with-paladin',
  'spell-save-dc',
  // M3 wave A — core-events (damage / heal / saves / check / rests / note)
  'core-events-check-offered',
  'core-events-damage-offered',
  'core-events-damage-slider',
  'core-events-heal-slider',
  'core-events-note-offered',
  'core-events-save-select',
  'damage-and-heal-persist-end-turn',
  'damage-persists-end-turn',
  'damage-reduces-hp',
  'divine-smite-cap-ordering',
  'heal-increases-hp',
  'heal-persists-and-caps',
  'heal-does-not-bank-over-damage',
  'damage-does-not-bank-below-zero',
  'heal-repairs-banked-overkill',
  'damage-clears-banked-credit',
  'damage-clears-credit-after-overkill-repair',
  'hp-with-modifiers',
  'hp-modifier-no-stacking',
  'hp-paladin-level1',
  'attack-unarmed-strike',
  'ability-modifier-ordering',
  'concentration-check-after-damage',
  'spear-2h-no-free-hands',
  'savage-attacker-usage',
  // Migrated from legacy initialEffects (see INITIAL_EFFECTS):
  'leather-armor-already-equipped',
  'leather-armor-proficient',
  'splint-armor-already-equipped',
  'splint-armor-proficient',
  'shield-already-equipped',
  'shield-proficient',
  'shield-with-splint-armor',
  'attack-greataxe',
  'attack-javelin',
  'attack-scimitar',
  'attack-spear',
  'attack-spear-plus1',
  'greataxe-cleave-mastery',
  'spear-versatile-damage-die',
  'weapon-don-illegal-when-equipped',
  'weapon-donned-attacks-visible',
  'fighting-style-great-weapon-annotations',
  'savage-attacker-annotations',
  'savage-attacker-weapon-only',
  'aid-cast',
  'prayer-of-healing-cast',
  'prayer-of-healing-upcast',
  'sanctuary-slot-selection',
  'sleep-slot-selection',
  'protection-from-evil-and-good-slot-selection',
  'calm-emotions-cast',
  'calm-emotions-concentration-blocking',
  'calm-emotions-concentration-illegal-planned',
  'calm-emotions-no-free-slots-illegal',
  'calm-emotions-select-level-illegal',
  'calm-emotions-slot-selection',
  'calm-emotions-upcast-slider',
  'hold-person-cast',
  'hold-person-concentration-blocking',
  'hold-person-concentration-illegal-planned',
  'hold-person-no-free-slots-illegal',
  'hold-person-select-level-illegal',
  'hold-person-slot-selection',
  'hold-person-upcast-slider',
  'aid-prepare',
  'prayer-of-healing-prepare',
  'find-steed-prepare',
  'hi-annotation',
  'hi-effect-grant-plan-errors',
  'hi-grant-illegal-when-active',
  'hi-use',
  'hi-use-effect-removed',
  'hi-use-twice',
  'hi-human-long-rest-no-duplicate',
  'extra-attack-disabled',
  'extra-attack-grapple',
  'extra-attack-greataxe',
  'extra-attack-overcommit',
  'extra-attack-paladin-level5',
  'extra-attack-shove',
  'extra-attack-unarmed',
  'extra-attack-unarmed-overcommit',
  'divine-smite-cap-high-slot',
  'divine-smite-dice-roller',
  'smite-default-higher-slot',
  'smite-legal-higher-slot',
  'tsmite-cap-high-slot',
  'tsmite-upcast',
  'hands-two-daggers-legal',
  'hands-shield-then-greataxe-illegal',
  'hands-greataxe-then-shield-illegal',
  'grapple-no-free-hand',
  'grapple-no-free-hand-normal-effect',
  'grapple-no-hand-even-when-saved',
  'grapple-saved-frees-hand',
  'spear-2h-effects-ordering',
  'spear-2h-reaction-no-free-hands',
  'reaction-tracking',
  'rebuke-the-violent-illegal-no-reaction',
  'find-steed-basic-cast',
  'find-steed-illegal-no-slots',
  'find-steed-upcast',
  'find-steed-highest-slot',
  'find-steed-select-level-illegal',
  'find-steed-action-resource',
  'find-steed-two-actions-legality',
  'find-steed-same-turn-offers',
  'find-steed-same-turn-dash',
  'find-steed-dismiss',
  'find-steed-long-rest',
  'find-steed-life-bond',
  'find-steed-hp-modifier-no-stacking',
  'attack-with-summoned-steed',
  'steed-saves',
  'steed-skill-checks',
  'steed-movement-walk',
  'steed-movement-fly',
  'steed-fly-illegal-l2',
  'steed-dash',
  'steed-dodge-disengage',
  'steed-slam',
  'steed-slam-upcast',
  'steed-note',
  'steed-healing-touch',
  'steed-fey-step',
  'steed-fell-glare',
  'steed-fell-glare-same-turn',
  'steed-fey-step-same-turn',
  'steed-healing-touch-same-turn',
  'steed-creature-type-gating-celestial',
  'steed-creature-type-gating-fey',
  'steed-creature-type-gating-fiend',
  'steed-hp-modifiers',
  'steed-hp-mods',
  'steed-move-partial-distance',
  'steed-damage-accumulates',
  'steed-overheal-caps-at-damage',
  'steed-damage-clears-banked-credit',
  'long-rest-resets-hit-dice',
  'long-rest-sets-flag',
  'savage-attacker-no-feat',
  'short-rest-hit-dice',
  'short-rest-sets-flag',
  'spellcasting-max-slot-level',
  'unarmed-strike-works-without-weapon',
  // M3 wave A — heroic-inspiration (grant / use / persist via keyed effect)
  'hi-grant',
  'hi-grant-then-use',
  'hi-grant-use-next-turn-effect-gone',
  'hi-grant-use-twice',
  'hi-persist-across-turn',
  'hi-use-illegal-when-none',
  'hi-use-illegal-when-none-plan-errors',
  // M3 wave A — ac (base + dex; armor/shield bonuses arrive with their groups)
  'ac-base-default',
  'ac-with-dexterity',
  'ac-with-paladin',
  'paladin-armor-proficiencies',
  // M3 wave A — species-human (movement constants) + lay-on-hands (pool, rest reset)
  'divine-smite-wrong-level-error',
  'loh-heal-illegal-no-bonus-action',
  'loh-heal-illegal-pool-empty',
  'loh-heal-usage',
  'loh-long-rest-reset',
  'loh-multiple-uses',
  'loh-persistence',
  'loh-pool-init',
  'loh-purify-illegal',
  'loh-purify-usage',
  // M3 wave A — movement (walk / rough / swim / fly)
  'engine-purity-remove-mid',
  'engine-purity-reorder',
  'full-paladin-turn',
  'human-movement-constants',
  'movement-fly-illegal-for-human',
  'movement-out-of-movement',
  'movement-rough-terrain-costs-double',
  'movement-swim-costly',
  'movement-walk-consumes-distance',
  'multiple-movement-types',
  // M3 — prepare path (prepare/unprepare offers + prepared.count/max/remaining)
  'divine-favour',
  'divine-favour-prepare',
  'divine-smite-prepare',
  'divine-smite-slot-cast',
  'smite-available-after-attack',
  'smite-illegal-no-bonus-action',
  'smite-illegal-no-slots',
  'smite-not-available-without-attack',
  // M3 — concentration + bless (first concentration spell)
  'bless-cast',
  'bless-concentration-blocking',
  'bless-concentration-illegal-planned',
  'bless-prepare',
  // M3 — thunderous-smite (L1 bonus-action on-hit smite)
  'thunderous-smite-prepare',
  'tsmite-available-after-attack',
  'tsmite-cap-ordering',
  'tsmite-no-slots',
  'tsmite-not-available-without-attack',
  'tsmite-usage',
  // M3 — create-and-destroy-water (plain L1 action spell) + generic cast scenarios
  'create-and-destroy-water-prepare',
  'smite-blocks-other-spells',
  'spell-cast',
  'spell-effect-persists',
  'spell-long-rest-resets',
  'spell-no-slots',
  // M3 — sanctuary (L1 bonus-action ward, dismissed on rest)
  'sanctuary-cast',
  'sanctuary-long-rest-dismissal',
  'sanctuary-prepare',
  'sanctuary-rest-dismissal',
  // M3 — protection-from-evil-and-good (L1 action concentration ward)
  'protection-from-evil-and-good-cast',
  'protection-from-evil-and-good-concentration-blocking',
  'protection-from-evil-and-good-concentration-illegal-planned',
  'protection-from-evil-and-good-prepare',
  'protection-from-evil-and-good-rest-dismissal',
  // M3 — weapons spike (hands + dagger/greataxe + masteries), replacing the legacy
  // weapon preprocessor with the weaponOffers builder helper
  'hands-max-default',
  'hands-reset-each-turn',
  'hands-weapon-dagger-uses-1',
  'hands-weapon-greataxe-uses-2',
  'hands-weapon-persists',
  'weapon-don-equips',
  'weapon-don-offer',
  'weapon-don-planned-attack-visible',
  'weapon-don-planned-no-duplicate',
  'weapon-mastery-dagger',
  'weapon-mastery-greataxe',
  'weapon-stowed-no-attacks',
  // M3 — class-paladin-level2 (keystone of the paladin progression): the L2 HP /
  // prepared / Lay-on-Hands bumps, plus the Divine Smite free-use path (already in
  // the smite module) these scenarios finally exercise
  'divine-smite-always-prepared',
  'divine-smite-free-cast',
  'divine-smite-free-long-rest-reset',
  'divine-smite-free-then-slot',
  'divine-smite-prepared-then-granted',
  'hp-paladin-level2',
  'paladin-level2-loh-long-rest',
  'paladin-level2-loh-pool',
  'paladin-level2-prepared',
  // M3 — class-paladin-level3 (HP / third L1 slot / prepared / Lay-on-Hands;
  // the Channel Divinity pool total rides along, remaining derived by its group)
  'hp-paladin-level3',
  'paladin-level3-prepared',
  'paladin-level3-spell-slots',
  // M3 — class-paladin-divinity (Channel Divinity pool + Divine Sense); the
  // short-rest partial-recovery scenario is skip-listed (engine hook deferred)
  'divine-sense-illegal-no-bonus-action',
  'divine-sense-illegal-no-divinity',
  'divine-sense-usage',
  'divinity-init',
  'divinity-long-rest-reset',
  // M3 — the onRest hook (passive module emits a persistent effect from a rest):
  // Channel Divinity short-rest recovery + Human Heroic Inspiration on a long rest
  'divinity-short-rest-reset',
  'divinity-short-rest-no-banking',
  'divinity-recovery-caps-at-spent',
  'hi-human-long-rest-grant',
  // M3 — oath-redemption-level3 Channel Divinity options (first runnable reaction
  // spend, via Rebuke the Violent) + Emissary of Peace
  'emissary-of-peace-illegal-no-bonus-action',
  'emissary-of-peace-illegal-no-divinity',
  'rebuke-the-violent-illegal-no-divinity',
  'rebuke-the-violent-usage',
  // M3 — class-paladin-level4 + level5 (HP / prepared / slots / LoH / proficiency).
  // Extra Attack has no yaml scenario (all initialEffects-blocked) — it's covered
  // by tests/unit/rules-engine/extra-attack.test.ts instead.
  'hp-paladin-level4',
  'paladin-level4-prepared',
  'paladin-level4-spell-slots',
  'hp-paladin-level5',
  'paladin-level5-prepared',
  'paladin-level5-proficiency',
  'paladin-level5-save-proficiency',
  'paladin-level5-spell-slots',
  // M3 — leather armor + shield (ac group refactored: armor replaces ac.base /
  // caps dex; untrained-armor disadvantage + no-casting; shield is +2 AC, 1 hand)
  'leather-armor-ac',
  'leather-armor-disadvantage',
  'shield-ac',
  'shield-not-proficient-warning',
  'hands-shield-persists',
  'hands-shield-uses-1',
  'hands-two-daggers-then-shield-illegal',
  // M3 — splint armor (heavy: AC 17, dex capped to 0, STR<15 speed penalty via a
  // movement.spent contribution, untrained disadvantage/no-casting)
  'splint-armor-ac',
  'splint-armor-disadvantage',
  'splint-armor-no-speed-penalty-high-str',
  'splint-armor-speed-penalty-low-str',
  'paladin-splint-armor-spellcasting',
  // M3 — sleep (L1 action concentration spell, protection template) + the empty
  // paladin-spells-l1 spell-list group. sleep-prepare is skip-listed (above).
  'sleep-cast',
  'sleep-concentration-blocking',
  'sleep-concentration-illegal-planned',
  'sleep-rest-dismissal',
  // …and now that Sleep is ported, the oath's always-prepared grant for its oath
  // spells (Sleep + Sanctuary) is exercisable
  'oath-redemption-oath-spells-always-prepared',
  'oath-redemption-oath-spells-prepared-then-granted',
  // M3 — command (plain L1 action spell + slot cascade, no concentration/effect)
  'command-cast',
  'command-prepare',
  // M3 — build-lock (Lock flips every BUILD offer illegal via a permanent
  // build.locked effect); build-lock-weapon-clear is skip-listed (plan-order)
  'build-lock',
  // M3 — initiative (dex-modifier bonus + display-only Roll Initiative offer)
  'alert-no-feat-no-annotations',
  'initiative-bonus',
  'initiative-persists-across-turns',
  // M3 — passive-skills (10 + skill) + simple-actions (8 action-cost options)
  'passive-perception',
  'passive-insight',
  'passive-investigation',
  'simple-action-disengage',
  'simple-action-interact',
  'simple-actions-all-offered',
  // M3 — dash (adds base speed to this turn's movement.total; combine:sum)
  'dash-action-doubles-movement',
  'dash-after-partial-movement',
  'dash-illegal-without-action',
  // M3 — grapple + shove (Unarmed Strike options; extra-attack spend + save DC;
  // grapple's outcome marker drives the hand/grappling effect)
  'grapple-action',
  'grapple-grappled-effect',
  'grapple-escaped-no-effect',
  'shove-action',
  // M3 — feat-alert (initiative-with-proficiency + annotations) and hit-die
  // (d10 pool from the class levels; remaining = total - spent)
  'alert-flag-set',
  'alert-secondary-control-initiative',
  'alert-proficiency-bonus-secondary-roll',
  'hit-die-paladin-level1',
  'hit-die-paladin-level2',
  'hit-die-paladin-level3',
  // M3 — scimitar (Light/Finesse: higher of STR/DEX) + javelin (STR, thrown),
  // both via weaponOffers, plus their mastery flag groups
  'scimitar-finesse',
  'weapon-mastery-scimitar',
  'weapon-mastery-javelin',
  // M3 — fighting-style-great-weapon + feat-sentinel (flag + annotations)
  'fighting-style-great-weapon',
  'sentinel-flag-annotations',
  // M3 — skill-checks (18 display-only roll offers) + Emissary of Peace's +5
  // Persuasion (skill.value is now combine:sum so the effect bonus composes)
  'emissary-of-peace-usage',
  // M3 — spear (versatile/thrown; one-handed don works, 2H free-hand check deferred)
  'hands-weapon-spear-uses-1',
  // M3 — calm-emotions + hold-person (L2 concentration wards) + oath L5 granting
  // them always-prepared (their own -prepare scenarios use the legacy removing path)
  'oath-redemption-l5-oath-spells-always-prepared',
  'oath-redemption-l5-oath-spells-prepared-then-granted',
  // M3 — find-steed (companion summon as companion.steed.* facts) + the paladin
  // free-use/always-prepared feature. Only the L2 summon is reachable; the full
  // steed stat block + actions are initialEffects-only.
  'find-steed-always-prepared',
  'find-steed-free-cast',
  'find-steed-no-slots-error',
  'find-steed-prepared-then-granted',
  // M3 — class-paladin-level6 + oath-redemption-level6. Level 6 is a flat step on
  // the class table (proficiency / prepared / slots hold), so these scenarios pin
  // the "no change" as much as the hit die / HP / LoH additions.
  'hp-paladin-level6',
  'hit-die-paladin-level6',
  'paladin-level6-loh-pool',
  'paladin-level6-prepared',
  'paladin-level6-proficiency',
  'paladin-level6-spell-slots',
  'paladin-level6-aura-of-protection',
  'oath-redemption-level6',
  // M3 — class-paladin-level7 + oath-redemption-level7. Level 7 moves the class
  // table (a third level 2 slot, a seventh prepared spell) and the oath grants
  // Aura of the Guardian, a reaction that moves an ally's damage onto the paladin.
  'hp-paladin-level7',
  'hit-die-paladin-level7',
  'paladin-level7-loh-pool',
  'paladin-level7-prepared',
  'paladin-level7-spell-slots',
  'paladin-level7-aura-of-the-guardian',
  'paladin-level7-aura-concentration',
  'paladin-level7-aura-floors-hp',
  'oath-redemption-level7'
].sort();

// --- Test config types (subset of the legacy runner's schema we drive) ---

interface AssertConfig {
  facts?: Record<string, unknown>;
  offers?: { exists?: string[]; notExists?: string[]; legal?: string[]; illegal?: string[] };
  effects?: { exists?: string[]; notExists?: string[] };
  offerVars?: { id: string; vars: Record<string, unknown> }[];
  offerUi?: { id: string; ui: Record<string, unknown> }[];
  annotations?: AnnotationAssert;
  status?: { ok?: boolean; legal?: boolean; applicable?: boolean };
  planErrors?: { id: string; index?: number; errors: string[] }[];
}

interface TestConfig {
  name: string;
  description?: string;
  ruleGroups: string[];
  initialFacts?: Facts;
  /**
   * Legacy-format initial effects (rule objects). The engine never consumes these;
   * the harness reads the committed-effect translation from `INITIAL_EFFECTS`
   * (keyed by scenario name) instead, so the shared scenario corpus stays untouched.
   */
  initialEffects?: unknown[];
  steps: Record<string, unknown>[];
}

// --- Assertion helpers (adapted to the EngineOutput shape) ---

function assertFacts(actual: Facts, expected: Record<string, unknown>, where: string): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key] ?? 0, `${where}: fact "${key}"`).toEqual(value);
  }
}

function assertOffers(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offers']>,
  where: string
): void {
  for (const id of expected.exists ?? [])
    expect(
      rules.find((r) => r.rule.id === id),
      `${where}: offer "${id}" exists`
    ).toBeDefined();
  for (const id of expected.notExists ?? [])
    expect(
      rules.some((r) => r.rule.id === id),
      `${where}: offer "${id}" absent`
    ).toBe(false);
  for (const id of expected.legal ?? []) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offer "${id}" exists`).toBeDefined();
    expect(e!.legal, `${where}: offer "${id}" legal`).toBe(true);
  }
  for (const id of expected.illegal ?? []) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offer "${id}" exists`).toBeDefined();
    expect(e!.legal, `${where}: offer "${id}" illegal`).toBe(false);
  }
}

function assertOfferVars(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerVars']>,
  where: string
): void {
  for (const { id, vars } of expected) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offerVars "${id}" exists`).toBeDefined();
    for (const [k, v] of Object.entries(vars))
      expect(e!.rule.vars?.[k], `${where}: offerVars "${id}".${k}`).toEqual(v);
  }
}

function assertOfferUi(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerUi']>,
  where: string
): void {
  for (const { id, ui } of expected) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offerUi "${id}" exists`).toBeDefined();
    for (const [k, v] of Object.entries(ui))
      expect(e!.rule.ui?.[k], `${where}: offerUi "${id}".${k}`).toEqual(v);
  }
}

function assertStatus(
  actual: EngineOutput['status'],
  expected: NonNullable<AssertConfig['status']>,
  where: string
): void {
  for (const [k, v] of Object.entries(expected))
    expect(actual[k as keyof typeof actual], `${where}: status.${k}`).toBe(v);
}

/** Effect IDs are namespaced (`instance#i#id`); match by the base id segment. */
function matchesEffectId(actualId: string, baseId: string): boolean {
  if (actualId === baseId) return true;
  return actualId.split('#').includes(baseId) || actualId.startsWith(baseId + '-');
}

function assertEffects(
  committed: EffectInstance[],
  expected: NonNullable<AssertConfig['effects']>,
  where: string
): void {
  for (const id of expected.exists ?? [])
    expect(
      committed.some((e) => matchesEffectId(e.id, id)),
      `${where}: effect "${id}" exists`
    ).toBe(true);
  for (const id of expected.notExists ?? [])
    expect(
      committed.some((e) => matchesEffectId(e.id, id)),
      `${where}: effect "${id}" absent`
    ).toBe(false);
}

function assertPlanErrors(
  planDiagnostics: Record<string, Diagnostic[]>,
  planned: PlannedRef[],
  expected: NonNullable<AssertConfig['planErrors']>,
  where: string
): void {
  for (const { id, index = 0, errors } of expected) {
    const instances = planned.filter((p) => p.ruleId === id);
    expect(instances.length > index, `${where}: planned "${id}"[${index}] exists`).toBe(true);
    const codes = (planDiagnostics[instances[index]!.instanceId] ?? []).map((d) => d.code);
    expect(codes, `${where}: planned "${id}"[${index}] errors`).toEqual(errors);
  }
}

function runAssertions(
  out: EngineOutput,
  committed: EffectInstance[],
  planned: PlannedRef[],
  assert: AssertConfig,
  where: string
): void {
  if (assert.facts) assertFacts(out.facts, assert.facts, where);
  if (assert.offers) assertOffers(out.availableRules, assert.offers, where);
  if (assert.offerVars) assertOfferVars(out.availableRules, assert.offerVars, where);
  if (assert.offerUi) assertOfferUi(out.availableRules, assert.offerUi, where);
  if (assert.annotations) assertAnnotations(out.annotations, assert.annotations, where);
  if (assert.status) assertStatus(out.status, assert.status, where);
  if (assert.effects) assertEffects(committed, assert.effects, where);
  if (assert.planErrors) assertPlanErrors(out.planDiagnostics, planned, assert.planErrors, where);
}

// --- harness: drives scenario steps through evaluate() ---

class ScenarioHarness {
  private planned: PlannedRef[] = [];
  private committed: EffectInstance[];
  private last: EngineOutput | null = null;
  private counter = 0;

  constructor(
    private modules: RuleModule[],
    private inputFacts: Facts,
    initialEffects: EffectInstance[]
  ) {
    this.committed = [...initialEffects];
  }

  private build(): EngineInput {
    return {
      modules: this.modules,
      inputFacts: this.inputFacts,
      planned: this.planned,
      committed: this.committed
    };
  }

  get committedEffects(): EffectInstance[] {
    return this.committed;
  }
  get plannedRefs(): PlannedRef[] {
    return this.planned;
  }

  evaluate(): EngineOutput {
    this.last = evaluate(this.build());
    return this.last;
  }

  addOffer(id: string, selections?: Record<string, unknown>): EngineOutput {
    this.planned.push({ instanceId: `instance-${this.counter++}`, ruleId: id, selections });
    return this.evaluate();
  }

  removeFromPlan(id: string): EngineOutput {
    const i = this.planned.findIndex((p) => p.ruleId === id);
    if (i === -1) throw new Error(`No planned item with offer id "${id}"`);
    this.planned.splice(i, 1);
    return this.evaluate();
  }

  updateSelections(id: string, selections: Record<string, unknown>): EngineOutput {
    const item = this.planned.find((p) => p.ruleId === id);
    if (!item) throw new Error(`No planned item with offer id "${id}"`);
    item.selections = { ...selections };
    return this.evaluate();
  }

  endTurn(longRest: boolean): EngineOutput {
    this.committed = endTurn(this.committed, this.last?.effects ?? [], { longRest });
    this.planned = [];
    return this.evaluate();
  }

  removeEffect(id: string): EngineOutput {
    this.committed = this.committed.filter((e) => !matchesEffectId(e.id, id));
    return this.evaluate();
  }
}

/** The step verb (the one key that isn't `assert`). */
function stepKeyOf(step: Record<string, unknown>): string {
  const key = Object.keys(step).find((k) => k !== 'assert');
  if (!key) throw new Error('Unknown step type');
  return key;
}

/** Assertions live either nested under the step verb or as a sibling key. */
function assertOf(step: Record<string, unknown>): AssertConfig | undefined {
  const data = step[stepKeyOf(step)] as Record<string, unknown> | undefined;
  return (data?.assert ?? step.assert) as AssertConfig | undefined;
}

function runStep(harness: ScenarioHarness, step: Record<string, unknown>): EngineOutput {
  const key = stepKeyOf(step);
  const data = (step[key] ?? {}) as Record<string, unknown>;
  switch (key) {
    case 'evaluate':
      return harness.evaluate();
    case 'addOffer':
      return harness.addOffer(data.id as string, data.selections as Record<string, unknown>);
    case 'removeFromPlan':
      return harness.removeFromPlan(data.id as string);
    case 'updateSelections':
      return harness.updateSelections(
        data.id as string,
        data.selections as Record<string, unknown>
      );
    case 'endTurn':
      return harness.endTurn(Boolean(data.longRest));
    case 'removeEffect':
      return harness.removeEffect(data.id as string);
    default:
      throw new Error(`Unknown step type "${key}"`);
  }
}

// --- Discover scenarios and classify run vs skip ---

const scenarioNames = existsSync(scenariosDir)
  ? readdirSync(scenariosDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  : [];

function loadConfig(name: string): TestConfig {
  return yaml.load(readFileSync(join(scenariosDir, name, 'test.yaml'), 'utf-8')) as TestConfig;
}

/**
 * Scenarios reference groups as `<directory>/<id>` (a file-location convention);
 * the registry is keyed by the canonical bare id (= module.id), so strip the
 * directory prefix before resolving.
 */
function canonicalId(scenarioGroupId: string): string {
  return scenarioGroupId.includes('/') ? scenarioGroupId.split('/').pop()! : scenarioGroupId;
}
function resolveScenarioGroups(ruleGroups: string[]) {
  return resolveModules(ruleGroups.map(canonicalId));
}

/** Why a scenario is skipped, or null if it should run. */
function skipReason(config: TestConfig, name: string): string | null {
  if (SKIP_BY_NAME[name]) return SKIP_BY_NAME[name];
  const { missing } = resolveScenarioGroups(config.ruleGroups ?? []);
  if (missing.length > 0) return `unported groups: ${missing.join(', ')}`;
  // A scenario with a committed-effect translation of its initial effects (INITIAL_EFFECTS)
  // runs; one that still only has the legacy `initialEffects` block stays skipped
  // until it is migrated there.
  if (config.initialEffects && config.initialEffects.length > 0 && !INITIAL_EFFECTS[name])
    return 'initialEffects use the legacy rule format';
  return null;
}

const runnable: string[] = [];
const skipped: string[] = [];
for (const name of scenarioNames) {
  if (skipReason(loadConfig(name), name) === null) runnable.push(name);
  else skipped.push(name);
}

describe('yaml scenarios', () => {
  it(`coverage: ${runnable.length} runnable, ${skipped.length} skipped (grows as M3 ports)`, () => {
    expect(runnable.slice().sort()).toEqual(EXPECTED_RUNNABLE);
  });

  for (const name of scenarioNames) {
    const config = loadConfig(name);
    const reason = skipReason(config, name);
    if (reason) {
      it.skip(`${name} — skipped: ${reason}`, () => {});
      continue;
    }
    it(name, () => {
      const { modules } = resolveScenarioGroups(config.ruleGroups);
      const harness = new ScenarioHarness(
        modules,
        config.initialFacts ?? {},
        INITIAL_EFFECTS[name] ?? []
      );
      config.steps.forEach((step, i) => {
        const out = runStep(harness, step);
        const assert = assertOf(step);
        if (assert)
          runAssertions(out, harness.committedEffects, harness.plannedRefs, assert, `Step ${i}`);
      });
    });
  }
});
