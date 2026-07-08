# Rules Engine v2 — Review Findings (branch vs main)

Careful review of the full diff `origin/main...claude/rules-engine-v2-m4`
(111 commits, 315 files): does v2 faithfully reimplement v1, were bugs
introduced, and what should be known before merge. Ordered by severity within
each section. Line refs are to the branch head at review time.

## 1. Bugs / regressions (should fix before or shortly after merge)

### 1.1 v2 delivery-coverage guard is now vacuous

**FIXED.** Rewritten to assert every deployed group resolves via `lazyRuleGroupIds()` or sits in an explicit `CATALOG_ONLY` allowlist, with a second assertion keeping the allowlist accurate (not loadable, still deployed). The rewrite immediately caught a stale entry (`class-paladin-oath-redemption-level4` has a module).

`tests/integration/rules-engine/v2-coverage.test.ts` asserts "every deployed
rule group **with rules** resolves to a v2 module". Stripping the dead `rules:`
arrays from the YAML (commit 9922555) made every group 0-rule, so the filter
matches nothing and both assertions pass trivially — the guard can no longer
catch a deployed group that lacks a v2 module. Fix: assert from the opposite
direction — every group id in `build/test-rule-groups.json` must either resolve
via `lazyRuleGroupIds()` or appear in an explicit allowlist of catalog-only
groups (`*-spells-l*`, `*-detail`, `class-paladin-oath-redemption-level4`).
This matters doubly because the runtime is silent about the same failure:
`loadRuleGroups` discards `loadModules`' `missing`/`incompatible` lists (it
must — the catalog-only groups are expected misses), so an assigned group whose
module was forgotten simply contributes nothing at play time. This test is the
only tripwire.

### 1.2 Seeds still create custom rule groups; deleting a character now leaks them

**FIXED.** Both seed resources removed from `dynamodb-items.tf`; `deleteCustomRuleGroup` (+ test) restored in cleanup-character so v1-era and interim rows are still cleaned. Terraform validate could not run in this sandbox (no terraform binary) — CI validates.

`terraform/module/dnd-planner/dynamodb-items.tf` still seeds, for **every new
character**: a `RULEGROUP#custom-$(characterId)` definition row
(`char_custom_rulegroup_def_seed`, ~line 874) and an assignment row linking it
to the character (`char_custom_rulegroup_seed`, ~line 980). The custom-rules
feature was removed on this branch, and the cleanup-character Lambda's
`deleteCustomRuleGroup` was removed with it — so after this branch, every
character deletion **leaks the seeded `RULEGROUP#custom-<id>` META row**
(the assignment row is still cleaned, the definition row is not). Existing
v1-era characters have these rows too, so the leak also applies to them.
Fix (both): remove the two seed resources (stop seeding a group the app can no
longer use), and **restore** `deleteCustomRuleGroup` in cleanup-character (an
idempotent, cheap delete) so v1-era and interim rows are still cleaned up.

### 1.3 Ledger lost its HP row

**FIXED.** `play.stats.hp` usedMax entry added to the RESOURCES catalog (test-first).

v1's `hp.yaml` declared two display entries: `play.topBar.hp` (top bar) and
`play.stats.hp` (a usedMax row in the ledger/resources panel). The v2
`derivePanels.ts` RESOURCES catalog has no `play.stats.hp` entry, so the
ledger no longer shows HP. Fix: add
`{ type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' }`
to the RESOURCES catalog.

### 1.4 Active-effects strip shows raw-id chips for per-turn bookkeeping effects

**FIXED.** `shouldHideFromStrip` now implements the documented contract (`display` present → shown unless `display.hidden`; absent → hidden; concentration always shows), and `EffectDisplay` gained `hidden`/`subject`. Display metadata authored: hp damage/heal + manual modifiers (health section), weapon/armor/shield equips (the stow/doff affordance restored), build-lock, divinity short-rest, steed hp damage/heal/modifiers (subject: steed). Hidden-but-named restored for prepared spells (shared helper covers all 14) and ability-scores' stat sets (with displayFact) / increases / save+skill proficiencies. The settings-derived remainder (sentinel ASI, paladin skills) is fixed too: the schema's `effectInstance` gained a `display` block and the YAML templates author `display: { name: rules.settings…${value}, hidden: true }` (`${value}` substitution test-covered), resolving against the existing flat `rules.settings.*` i18n keys in both locales.

`EffectDisplay`'s contract (types.ts) says an effect's `display` **presence opts
it into the strip** — but `v2Bridge.shouldHideFromStrip` only hides
display-less effects that are `permanent` or "resource-only" (all facts
`*.spent` / `character.movement*`). Per-turn spends that carry bookkeeping
facts — e.g. every Attack's `spend` effect with `attackAction.extraGranted`,
`attack.activation.count`, `attack.last.weapon` (attacks.ts) — fail
`isResourceOnly`, are not hidden, and reach the strip via
`PlayCharacterMode.currentEffects` (committed + this turn's advertised).
`ActiveStateStrip.getEffectName` then falls back to `effect.id`, so the player
sees chips like `a1b2c3#0#spend` after any attack. Fix: make the bridge match
the documented contract — hide every effect without `display` except the
concentration marker (`shouldHideFromStrip = !display && !concentration`),
rather than enumerating fact-name patterns.

**The display-metadata port is also incomplete.** v1 authored `ui.name` on ~90
effect rules; v2 gave `display` to 14. Beyond hidden build effects (see below),
v1 effects that were _visible_ chips lost their names entirely — notably
`effect-hp-damage` / `effect-hp-heal` (v1: `section: health`, showed the amount
via `displaySelection`, removable as an "undo"), the manual HP modifiers,
`effect-build-locked`, `effect-divinity-short-rest`, and the steed
damage/heal/modifier effects. Under the current bridge these render as raw-id
chips; under the contract fix above they would silently disappear instead.
Either way the v1 behavior is degraded — these effects need `display` metadata
authored (reusing the existing `rule.*.effect-*.name` keys, which are still in
the i18n files).

**Equipment can no longer be unequipped through the UI.** Neither v1 nor v2 has
"doff" offers — in v1 you unequipped by removing the _named_ equipment effect
chip (`effect-shield`, `effect-leather-armor`, `effect-splint-armor`, weapon
equips) from the strip. In v2 those equip effects are permanent, keyed, and
display-less, so they are hidden from the strip by default; the only path to
free a hand or swap armor is the "show hidden" toggle and guessing among
raw-id chips. Functional regression, fixed by the same means: author `display`
on the equip effects.

**Hidden build effects lost their reveal names too.** v1's strip "show hidden"
toggle revealed named chips ("Strength 15", "Athletics proficiency", "Bless
prepared"); every v2 build/settings effect is nameless, so the reveal view is a
wall of raw ids. Lower priority, but it makes the hidden-effects toggle nearly
useless for debugging a character.

### 1.5 Two module diagnostic codes have no i18n translation (both locales)

**FIXED.** steed-dash now emits the plural `no_actions` (matching the helper and the i18n); `wrong_level` translations added to both locales.

Verified by expanding every `rule.*` key referenced from
`src/lib/rules-engine-v2/` (plain + template-literal) against both locale
files. Missing leaves:

- `rule.spell-find-steed.steed-dash.no_action` (find-steed.ts:517/527) — a
  typo: the i18n key (and the shared steed-action helper, line 99) use
  `no_actions` (plural); steed-dash's hand-rolled diagnostics use the singular.
  One-character fix in the module.
- `rule.spell-divine-smite.offer-divine-smite.wrong_level`
  (divine-smite.ts:168) — a new v2-only guard (out-of-range slot-level
  selection) with no translation authored in either locale. Add the key.
  When these fire, the player sees a raw i18n key / missing-translation warning.
  (The deleted diagnostic-code-coverage test would not have caught these either —
  it only walked YAML rules — but its v2 replacement, §3.1, would.)

### 1.6 Character export includes the seeded `custom-<characterId>` group id

**FIXED.** Export filters `custom-*` ids; import validation drops them (legacy exports keep importing after the seeds are gone). Both test-covered.

v1's `buildCharacterExport` filtered `custom-${characterId}` out of the
exported `ruleGroups`; the custom-rules removal dropped that filter, but the
terraform seeds (§1.2) still assign `custom-<id>` to every character. So a v2
export now contains a foreign, character-specific group id. On import today it
validates (the seeded definition row exists) and gets assigned to the new
character — cross-character pollution; once §1.2 removes the seeds, the same
export **fails import validation** ("unknown rule group"). Fix alongside §1.2:
filter `custom-*` ids on export (and/or tolerate them on import).

### 1.7 `addFollowupEffect` never persists the committed effect

**FIXED.** `persistCommitted()` added; store test asserts the POST.

`playStore.addFollowupEffect` (javelin Slow rider, etc.) appends to
`state.committed` and re-evaluates but does not call `persistCommitted()`,
unlike `removeEffect` / `endTurn` / `assignRuleGroupWithSettings`. A follow-up
effect committed mid-turn is silently lost if the page reloads before the next
End Turn / effect change. One-line fix.

### 1.8 Steed actions are invisible in the add-picker (`ACTION` is not a verb)

**FIXED.** All steed offers restored to their v1 verbs: dash `MOVE: dash`, dodge/disengage `DEFEND: evade`, slam `ATTACK: brawl` (+`attack.any`/`attack.melee` labels), slam-reaction `DEFEND: brawl` (+labels), healing touch `AID: heal`, fey step `MOVE: travel`, fell glare `CONTROL: single`.

`find-steed.ts` gives its activation offers `intents: { ACTION: 'steed' }`
(lines 108/145/511) — but `ACTION` is not in the `Verb` union or `VERB_ORDER`.
`deriveVerbFromRule` returns the first intents key verbatim, and
`groupChoicesByVerb` only emits buckets for verbs in `VERB_ORDER`, so these
offers land in a bucket the picker never renders. Affected: `steed-dash`,
`steed-dodge`, `steed-disengage`, `steed-slam`, `steed-slam-reaction`, and the
three creature abilities (healing touch / fey step / fell glare) — essentially
the steed's entire action surface. v1 used legal verbs (`MOVE: dash`,
`DEFEND: evade`, `ATTACK: brawl`, `AID: heal`, `CONTROL: single`). The parity
suite passes because it asserts engine offers, not picker rendering. The
offers remain reachable via QuickSearch (it matches all entries by name and
uses the verb only as a row label — which renders as a raw i18n key for
`ACTION`), and an item added that way gets `PlannedItem.verb = 'ACTION'`,
whose `verbConfig[verb]` lookup is undefined (stripe/label breakage on the
plan row). Fix: restore v1's verb intents on the steed offers
(`MOVE: dash`, `DEFEND: evade`, `ATTACK: brawl`, `AID: heal`,
`CONTROL: single`) — `subject: 'steed'` already carries the steed-ness.

### 1.9 Life Bond annotation targets a label no panel carries

**FIXED.** Target restored to `healing.any` (the Record Healing panel), and the slam offers carry `annotationLabels` again so attack annotations reach steed panels as in v1.

v1's `annotate-life-bond` (steed regains HP from spell healing within 5 ft)
targeted `healing.any`, which the Record Healing panel carries — the reminder
showed when recording healing with a steed summoned. v2 (`find-steed.ts:675`)
targets `companion.steed`, and no offer in the codebase carries that
annotation label, so the annotation never renders anywhere. Fix: restore the
`healing.any` target. Related: v2's steed offers carry no `annotationLabels`
at all (v1's slam had `[attack.any, attack.melee]`), so attack-targeting
annotations no longer appear on steed attack panels — possibly intended
(rider buffs don't apply to the steed), worth a conscious call.

### 1.10 Plan rows never consumed per-instance legality; instance entries leaked into pickers

**FIXED** (found by Codex review on PR #363). `adaptEngineOutput` mixed
per-instance planned entries (id = instanceId) into `availableRules`, but
`PlanStack` resolved rows by `originalRuleId` — so the engine's
`planDiagnostics` never reached the rows. Row legality came from the
hypothetical (plan-minus-this-row) catalog, which marks BOTH copies of a
duplicated action illegal when only the second over-spends; the
`correctEntryForPlanItem` arbiter that used to fix this read `varsRuntime`,
which nothing writes any more (deleted as dead). The mixed instance entries
also leaked into the verb groups, +ADD pickers, and QuickSearch as
unresolvable duplicate options. Now: `availableRules` is the addable catalog
only; the store keeps a per-instance `plannedEntries` map
(`getPlannedEntry(instanceId)`, legality straight from `planDiagnostics`) that
the plan rows consume; hypotheticals remain for the alternatives picker only.
Test-covered at all three layers (bridge, store, PlanStack).

### 1.11 Channel Divinity banked recovery points on spend-less short rests

**FIXED** (found by Codex review on PR #363, round 2). The divinity `onRest`
hook emitted a keyless `divinity.recovered` effect on EVERY short rest,
unconditionally. Resting with a full pool banked a point that pre-paid a use
spent later (`remaining = clamp(total − spent + recovered)` hid the surplus
until the spends arrived); repeated spend-less rests banked without bound. Now
the hook emits only while there is an unrecovered spend outstanding
(`divinity.spent > divinity.recovered` — the hook already received a
`FactReader` it ignored), which is the 2024 rule: a short rest restores one
EXPENDED use. Scenarios: `divinity-short-rest-no-banking`,
`divinity-recovery-caps-at-spent`; the existing `divinity-short-rest-reset`
covers the recover-then-respend chain unchanged.

### 1.12 Manual prepare count could not be released by a later always-prepared grant

**FIXED** (found by Codex review on PR #363, round 2). The prepare offer baked
`spellcasting.prepared.count: 1` (or 0 if granted at prepare TIME) into the
permanent effect's state. State is an unconditional delta, and unprepare — the
only eviction — is illegal for an always-prepared spell: prepare Sleep at L1,
take Oath of Redemption at L3, and the stale count consumed a prepared slot
forever. The count is now derived live (`preparedSpellCount` in the builder,
paired into all 14 users' `derive`: 1 while `prepared && !alwaysPrepared`),
and the prepare effect persists only the prepared flag. NOTE for stored
characters: prep effects persisted BEFORE this change still carry the baked
count in state and will over-count by 1 per manually-prepared spell until
re-prepared or recreated — covered by the pre-merge delete/recreate pass the
cutover already requires. Unit: `prepared-count.test.ts` (prepare-then-grant
across module-set change); the yaml scenarios keep the grant-first order.

### 1.13 Steed damage/heal records replaced instead of accumulating

**FIXED** (found by Codex review on PR #363, round 2). `steed-record-damage`
advertised a keyed effect whose state carried ONLY that record's amount —
`dedupeByKey` (newest wins) meant 10 damage then 3 damage left the steed at −3,
not −13 (heals identically). Each record now bakes prior-total + amount into
the one keyed effect via dedicated accumulator facts
(`companion.steed.hp.damageRecorded` / `.healRecorded`; the module derives
their net into `companion.steed.hp.modifier.current` alongside the manual
setter), so records add up while the dismiss cascade still evicts by key and
removing the single chip clears the whole record. The chips also gained
`displayFact` so they show the running total (legacy showed the per-record
amount). Scenario: `steed-damage-accumulates`.

### 1.14 spellcasting.saveAbility string fact lost in the port (save DC labels broken)

**FIXED** (found by Codex review on PR #363, round 2). Legacy set
`spellcasting.saveAbility` to the STRING `'CHA'` (stringSet); seven spells'
saveDc info line reads it (`saveType: { fact: 'spellcasting.saveAbility' }`).
Engine facts are numeric by design, so the fact silently vanished and the
label rendered with an empty save type. Now `class-paladin-level1` contributes
a numeric flag (`spellcasting.saveAbility.cha` = 1) and the play bridge
synthesizes the view-side string ('CHA') from the flag (`toViewFacts` in
engineBridge). Asserted in `spell-save-dc` (flag) and the bridge unit test
(synthesis).

### 1.15 Overhealing persisted as future HP credit (player)

**FIXED** (found by Codex review on PR #363, round 3). `record-heal` persisted
the RAW amount into `hp.modifier.current`; `hp.current` clamps only the final
sum, so the surplus of a heal beyond the missing HP stayed banked and
pre-cancelled damage taken later (heal 15 on 10 damage, then take 7 → −2
instead of −7). The heal now caps at the HP missing at record time
(`min(amount, max(0, −hp.modifier.current))`) — 5e: regained HP cannot exceed
the max; the surplus is lost. Scenario: `heal-does-not-bank-over-damage` (the
existing `heal-persists-and-caps` never took damage AFTER the overheal, so it
missed this).

### 1.16 Steed overhealing cancelled later damage (hole in the 1.13 fix)

**FIXED** (found by Codex review on PR #363, round 3). The 1.13 accumulator
let `healRecorded` grow past `damageRecorded`; the net is clamped only in
`hp.current`, so a heal recorded on a full-health steed banked and absorbed
damage taken later. The running heal total now caps at the running damage
total (`min(healRecorded + amount, damageRecorded)`). Scenario:
`steed-overheal-caps-at-damage`.

### 1.17 End Turn in the engine-error state committed the PREVIOUS plan's effects

**FIXED** (found by Codex review on PR #363, round 3). When an evaluation
threw (banner path), the store kept `_lastAdvertised`, `_plannedEntriesMap`
and `_hypotheticalEntriesMap` from the last SUCCESSFUL evaluation while the
plan stayed editable and End Turn enabled — ending the turn merged and
persisted the previous plan's advertised effects rather than the visible
plan's. The catch path now clears all three per-evaluation caches: End Turn
then only ages the committed set, and plan rows/alternatives fall back instead
of showing the old evaluation's legality. Unit: playStore 'a failed evaluation
clears the per-evaluation caches'.

### 1.18 Paladin levels 2–5 dropped the CON modifier from max HP

**FIXED** (found by Codex review on PR #363, round 4). The level modules
contributed a flat +6 per level, so a CON +2 level-5 paladin ran 8 HP low. The
port had chosen the flat value deliberately — to reproduce the legacy scenario
totals, which came from legacy's CON-captured-at-level-up model where levels
assigned BEFORE CON was set contributed a frozen 0 (the app's normal creation
order). That made the module wrong in every order, where legacy was only wrong
in one. Levels 2–5 now add `6 + con.modifier` live, matching level 1 and the
2024 rule that a CON change retroactively recalculates max HP for every level.
This is a deliberate faithfulness divergence: the hp-paladin-level2/3/4
scenarios (which had codified the captured-0 totals, with comments saying so)
now assert the live-CON totals.

### 1.19 Stacked Channel Divinity recoveries shared one effect id

**FIXED** (found by Codex review on PR #363, round 4). The short-rest recovery
effects are keyless so they stack (one per unrecovered spend — see 1.11), but
every emission carried id `effect-divinity-short-rest`. `ActiveStateStrip`
keys chips by `effect.id` (a duplicate crashes the keyed each) and
`removeEffect` filters by exact id (dismissing one chip removed EVERY
recovery). The id now carries the recovery ordinal for the long-rest cycle
(`effect-divinity-short-rest-<recovered+1>`, pure over the facts at emission).
Unit: `divinity-recovery.test.ts`; scenario asserts on the base id keep
matching via the runner's `startsWith(baseId + '-')` rule.

### 1.20 Unarmed strike lost its dice panel in the port

**FIXED** (found by Codex review on PR #363, round 5). Both unarmed strike
offers were ported without the legacy `primaryControl` dice-line and the
captured `hitBonus`/`damageBonus` vars — the module even derived
`attack.unarmed.hitBonus`/`.damageBonus`, which nothing then read — so a
planned unarmed strike (action or opportunity-attack reaction) rendered as a
bare row with no d20/damage roller. The action copy had also dropped
description/detailKey/intents/disadvantageFact. Restored verbatim from the
legacy attacks.yaml (shared `UNARMED_CONTROL`/`UNARMED_VARS`; `damageDie` 0
renders the flat 1 + STR damage). Unit: `unarmed-strike-ui.test.ts`.

### 1.21 Synthesized view facts never reached the panels (hole in the 1.14 fix)

**FIXED** (found by Codex review on PR #363, round 5). The 1.14 fix
synthesized the `spellcasting.saveAbility` string in `adaptEngineOutput`, but
`performEvaluation` set `state.facts` from the RAW engine facts
(`result.facts`) — and `state.facts` is what PlanStack / the strip / the
ledger pass to PanelRenderer, so the saveDc label still saw the missing fact.
`state.facts` is now the adapted view output's facts (one adapt call, reused).
Store test: 'state.facts is the VIEW facts'.

### 1.22 Unarmed opportunity attack wrongly marked itself a weapon attack

**FIXED** (found by Codex review on PR #363, round 6). The unarmed reaction's
apply set `attack.last.weapon: 1`, which the weapon-only riders (Savage
Attacker, Great Weapon Fighting) read — so an unarmed opportunity attack
unlocked those riders, while the unarmed ACTION path never set the marker
(inconsistent). Legacy `attacks.yaml` set only `attack.last.activation.reaction`
on the unarmed reaction, never the weapon marker (the weapon reactions in
`weaponOffers` correctly set it). Dropped the marker from the unarmed reaction.
Unit: extra-attack.test.ts ('unarmed opportunity attack is not a weapon attack',
plus a donned-weapon-reaction contrast).

### 1.23 Steed movement always spent 30 ft (no distance slider)

**FIXED** (found by Codex review on PR #363, round 6). `steed-move-walk`/`-fly`
hardcoded `movement.spent: 30` with no control, so a 5- or 10-ft step consumed
half the steed's 60-ft pool. Legacy carried a distance slider (max
`movement.total`, default `movement.remaining`) and spent the captured distance
— the same shape as the player's own move offers. Restored via a shared
`STEED_MOVE_CONTROL`/`STEED_MOVE_VARS` + captured-distance apply. Scenario:
steed-move-partial-distance (the existing steed-movement-walk selected 30, so it
passed by coincidence and missed this).

### 1.24 Steed Otherworldly Slam lost its rollable dice panel

**FIXED** (found by Codex review on PR #363, round 6; owner approved restoring
the damage-type label). Both slam offers used the generic `steedActivation`
helper, rendering a bare row: no dice-line, no to-hit/damage vars, and the
reaction referenced unauthored `steed-slam-reaction.*` i18n keys. Restored via
a dedicated `steedSlamOffer`: d20 + `companion.steed.slam.hitBonus`
(cha.modifier + proficiency.bonus, newly derived) to hit, 1d8 +
`find-steed.selectedLevel` damage, section `action-attack`, detailKey
`action/otherworldly-slam`; both copies reuse the authored `steed-slam.*` keys
(action → `no_actions`, reaction → `no_reaction`). The damage-type label is a
string the numeric engine can't hold (the limitation that skip-lists
steed-creature-type-fey), so the bridge synthesizes `companion.steed.damageType`
('radiant'/'psychic'/'necrotic') from the numeric `companion.steed.creatureType`
while summoned — same view-synthesis pattern as the CHA save-ability fix — and
the slam die + description `{{damageType}}` read it. Unit: steed-slam-ui.test.ts

- engineBridge damageType synthesis; scenario steed-slam gains the hit-bonus /
  detailKey asserts.

### 1.25 Steed move spent a fixed 30 ft with no validation of the selected distance

**FIXED** (found by Codex review on PR #363, round 7 — a gap in the round-6
§1.23 slider fix). The move apply spent the captured distance but the legality
only checked `remaining >= 5`, so selecting 60 ft with 5 ft left spent 60 and
drove movement negative. Now the apply validates the SELECTED distance against
remaining (walk and fly), like the player move helper. Scenario
steed-move-partial-distance gains an over-select step (planErrors).

### 1.26 Steed current HP could exceed its max

**FIXED** (found by Codex review on PR #363, round 7). `companion.steed.hp.current`
was `hp.base + damage`, ignoring the derived max — a negative max-HP modifier
dropped the max but left current at base (impossible 25/15). Now
`min(hp.max, hp.base + min(0, damageModifier))`, exactly how legacy clamped it
(`max: companion.steed.hp.max`): current never exceeds max, and a positive max
modifier still doesn't auto-heal above base (so the steed-hp-modifiers scenario
is unchanged). Unit: steed-fixes.test.ts.

### 1.27 Dismiss Steed used an invalid verb and cost no action

**FIXED** (found by Codex review on PR #363, round 7). The offer's intent verb
was `ACTION`, which isn't in the `Verb` union — the add picker drops offers with
an unknown verb, so Dismiss Steed vanished from it. It also had no action cost
and its apply didn't spend one, though legacy dismissed as an action. Now
`intents: { HANDLE: 'steed' }`, `actionCost: ['action']`, an
`actions.remaining > 0` legality gate (new `offer-dismiss-steed.no_action` i18n
key, both locales), and the apply spends `actions.spent`. Unit:
steed-fixes.test.ts.

Two further round-7 findings are steed-UI restorations (owner approved doing
both now) — see §1.28 and §1.29.

### 1.28 Find Steed cast offer lost its slot-level / creature-type controls

**FIXED** (found by Codex review on PR #363, round 7). The cast offer captured
`slotLevel` / `creatureType` vars but had no controls to set them, so it always
committed the defaults (free/lowest slot, celestial) — no free-use-vs-slot
choice, no upcast, no fey/fiend. Restored the legacy controls: a `slotLevel`
slider whose values (0 free-use, L2–5) are each `enabled` by the matching
resource fact, and a `creatureType` segmented (celestial/fey/fiend, reusing the
existing `creature-type.*` i18n). Unit: steed-recorders-ui.test.ts.

### 1.29 Steed save / skill-check / note rows were bare (no roll/record controls)

**FIXED** (found by Codex review on PR #363, round 7). The shared
`steedFreeOffer` rendered only a name + intents (and pointed at unauthored
`steed-save-*.name` / `steed-skill-*.name` keys), so the ~25 steed recorder
rows exposed no d20 roller, outcome, or text box. Replaced with dedicated
builders mirroring the player recorders and the legacy steed rows:
`steedSaveOffer` (d20 + `companion.steed.<ability>.save`, pass/fail segmented,
name `planner.record.save.<ability>`), `steedSkillOffer` (d20 + the governing
ability modifier via a skill→ability map — steeds have no skill proficiency —
name `play.stats.skills.<skill>`), and `steedNoteOffer` (multiline text). All
reuse existing shared i18n keys (no new strings) and the ability-modifier facts
already derived (no new derives). Unit: steed-recorders-ui.test.ts.

## 2. Faithfulness deltas v1 → v2 (2.1–2.7 ACCEPTED; 2.8–2.11 FIXED)

### 2.1 Offers are judged against post-plan facts (v1: phase-interleaved)

**ACCEPTED** (owner sign-off, 2026-07-07).

v2 evaluates the offer catalog once against the final projected facts
(engine.ts). v1 produced offers during phase execution, so an offer emitted by
an early-phase rule saw only earlier writes. In practice this makes v2 offers
_more_ consistent (they always see the whole plan), and the parity suite
passes — but any rule that relied on offers seeing pre-plan state would differ.

### 2.2 Plan legality is plan-order-significant (v1 reordered via `after`)

**ACCEPTED** (owner sign-off, 2026-07-07).

Documented in the parity skip list (`hi-use-then-grant`, `hi-effect-grant-use`,
`build-lock-weapon-clear`): v1 could reorder a planned "use" after a planned
"grant" via group dependencies; v2 folds the plan strictly in player order.
Deliberate design change; players must order dependent actions correctly.

### 2.3 Spell un-prepare is immediate (v1 had a 2-turn `removing` lifecycle)

**ACCEPTED** (owner sign-off, 2026-07-07).

sleep / calm-emotions / hold-person prepare effects evict immediately on
unprepare in v2 (same end state, no intermediate `removing` turn). Skip-listed.

### 2.4 Steed does not vanish passively at 0 HP

**ACCEPTED** (owner sign-off, 2026-07-07). Revisit after play-testing if the explicit dismiss tap grates —
auto-vanish would need a threshold-eviction engine feature.

v1's self-advertise-gated-on-hp + `cascadeRemove` let the steed die when its
HP hit 0 without player action; v2 committed effects cannot self-remove on a
derived-fact threshold. Explicit dismissal cascades correctly. Skip-listed.

### 2.5 `cascadeRemove` dropped

**ACCEPTED** (owner sign-off, 2026-07-07).

`removeEffect` removes exactly one effect id; dependent-effect eviction is the
owning module's job via shared `key`s. No current rule needs the cascade, but
any future "removing X also removes Y" behavior must be authored module-side.

### 2.6 Steed damage type is numeric-only

**ACCEPTED** (owner sign-off, 2026-07-07).

v2 facts are numbers; the steed's string damage-type label (`radiant` /
`psychic` / `necrotic`) is not represented (creatureType 0/1/2 is). The UI
shows the type via the creature-type ability entry instead. Skip-listed.

### 2.7 Custom rule groups removed outright

**ACCEPTED** (owner sign-off, 2026-07-07).

v1 let users author per-character YAML/JSON rules (EditCustomRules); v2
evaluates only code modules, and the whole feature (editor, storage endpoint,
export field) was removed on this branch at the owner's direction. Existing
characters with a stored custom group lose those rules (accepted: pre-v2
characters are deleted/recreated).

### 2.8 Planned actions apply even when their structural `when` gate is closed

**FIXED (v1 parity restored).** The plan fold now re-checks the offer's `when`
gate before applying a planned ref and skips it when closed — no execution, no
resource spend (engine test + updated `plan-offers` contract test, which had
codified the old "apply registry ignores when" behavior). `PlanStack` gives
stale instances a fallback entry (`applicable: false`) so the row renders as
inapplicable instead of losing its live entry. Surfaced a masked scenario bug:
`attack-with-summoned-steed`'s v2 initial-effects mapping was missing the
weapon equip and only passed because the fold ignored `when`.

`evaluatePlan` builds its action registry from `collectOffers(modules)` and
applies any planned ref it finds — it never re-checks the offer's `when` gate.
`evaluateOffers` (the catalog) does honor `when`, so the offer disappears from
the picker, and `plannedEntry` returns `undefined` for the stale instance (the
plan row loses its live entry) — but the fold still executes its `apply`,
spending resources in the projection. v1 skipped a planned rule whose `when`
was unsatisfied (`isRuleApplicable`) and surfaced it as `applicable: false`.
Example: plan an attack with a weapon, then plan stowing that weapon earlier in
the turn — v2 still charges the attack. Consider: skip refs whose offer `when`
fails (or surface `applicable: false` + a diagnostic instead of applying).

### 2.9 Effect-chip duration pips always render "full"

**FIXED.** The `turns` expiry now carries an optional `total`, backfilled by the
first `endTurn` aging (authors still write only `remaining`), and the bridge
renders pips as `remaining` of `total` — so a 10-round spell at 7 remaining
shows 10 pips with 7 filled. Old persisted effects without `total` fall back to
the previous shrink behavior until their next aging. Schema updated to match.

`v2Bridge.durationFromExpiry` maps a `turns` expiry to
`{ countDown: remaining, duration: remaining }` because an `EffectInstance`
keeps only the remaining count — the original total is lost. v1 kept
`ui.duration` (total) and `ui.countDown` (remaining) distinct, so the chip
showed elapsed pips. Cosmetic; fix would add an authored `total` (or
`display.duration`) to timed effects.

### 2.10 Sheet input facts are clobbered by contributors (sharp edge)

**FIXED (guarded).** `evaluateSheet` now throws on the overlap, naming the fact
and its writers; at runtime the store's §2.11 catch surfaces it as an error
banner rather than a blank screen. The guard immediately caught four places
where inputs were already being silently swallowed: the annotate tests and the
purity test passed module-contributed facts (`spell.l1.divineSmite.prepared`,
`spellcasting.slots.level1.total`) as inputs, and the
`spear-2h-reaction-no-free-hands` scenario's v1-era `initialFacts` restated
facts v2 derives — all four remodelled.

`evaluateSheet` seeds `facts = { ...inputFacts }`, but when any module/effect
contributes to the same fact, `settle()` overwrites the input value with the
combined contributions — the input is not itself a contribution. At runtime the
store passes `inputFacts: {}` so this cannot bite today, but a future caller
passing a base fact that modules also `sum` into would silently lose the base.
Consider treating a present input fact as an implicit `sum` contribution, or
throwing on the overlap.

### 2.11 Engine exceptions are uncaught in the store (hard-fail posture)

**FIXED.** `performEvaluation` now catches engine throws: it keeps the previous
engine output (or a minimal stub on first evaluation), overrides
`diagnostics.errors` with `play.error.engineCycle` (cycle messages) or the new
`play.error.evaluate` (both locales), and the play view shows the existing
error banner instead of a blank screen. Store tests cover both paths.

`performEvaluation` has no try/catch around `evaluateCharacterV2`, so any
engine throw crashes the play view: duplicate offer ids (`collectOffers`),
sheet dependency cycles / conflicting combine modes, and the watchdog's
`EngineTimeoutError`. All are "can't happen with current modules", but one bad
module or pathological plan becomes a blank screen instead of `ruleGroupError`.
Consider catching in `performEvaluation` and surfacing a toast + error state.

## 3. Coverage / test gaps

### 3.1 Diagnostic-code i18n coverage test deleted with no v2 equivalent

**CODIFIED.** `tests/unit/i18n/module-i18n-coverage.test.ts` extracts every
statically-resolvable `rule.*` key from the v2 module sources (plain literals,
`const`-prefix template keys with one level of nesting) and asserts each
resolves in both locales via sveltekit-i18n-style flattening, with a >100-key
floor so extractor rot is caught. Double-template keys remain uncheckable.

`tests/unit/i18n/diagnostic-code-coverage.test.ts` (deleted 9922555) verified
every `rule.*` diagnostic code referenced by rule content had a translation in
every locale. It walked the YAML `rules:`, which are gone — but v2 modules also
emit diagnostic codes (offer legality reasons), and those i18n keys are now
unchecked. A future equivalent could extract `rule.*` string literals from
`src/lib/rules-engine-v2/rules/*.ts` and assert they resolve — the ad-hoc
version of exactly that check found the two §1.5 misses, so it has proven
value.

### 3.2 Some v1 scenarios never replay on v2 (initialEffects-blocked)

The parity run is 326 passed / 11 skipped. Beyond the §2 behavior deltas, a few
scenarios are skipped for scenario-format reasons, not behavior:
`hi-human-long-rest-no-duplicate` (v1-format `initialEffects`), the steed
stat-block scenarios, and Extra Attack (which has **no** yaml scenario at all —
"all initialEffects-blocked", covered only by module unit tests). The
`EXPECTED_RUNNABLE` exact-set assertion guards against silent coverage
shrinkage, which is good — but these paths rest on unit tests alone.

### 3.3 Detail wiring is untested

`detail-flips.test.ts` (deleted) asserted each combat-facing feature was
referenced by a rule's detail key. Details still render (33 published files;
offers carry `ui.detailKey`), but nothing now asserts every published detail is
reachable / every detailKey resolves to a published file.

## 4. Pipeline / deploy notes

- **`sync_rule_groups.py` rules machinery: STRIPPED.** The fact-analysis half
  (`extract_fact_reads_writes`, `add_auto_groups`, `RULE_TRANSFORM_VERSION`),
  the generated-groups merge path (`merge_generated_into_bases`,
  `sync_category_with_groups`, `compute_merged_hash`) and the `--data-dir2`
  plumbing are deleted; `--json-out` output verified byte-identical before and
  after. DynamoDB items still publish `rules: "[]"` for API stability. The
  Python tests are pruned to match (18 pass) but remain NOT wired into
  `make test`. Note: the new hash recipe re-syncs every category once on the
  next deploy (intended — the YAML changed anyway).
- **`data/rule-groups/schema.json`: SLIMMED.** `ruleGroup` no longer accepts
  `rules` (`additionalProperties: false` makes `validate-rules-schema` reject
  rules sneaking back), definitions pruned 26→11 to the reachable metadata set,
  and `effectInstance` gained the `display` block (§1.4). Fallout: the schema's
  `#/definitions/rule` removal killed `src/lib/rules/validateRules.ts` — a dead
  v1 client-side validator for custom-group rules whose only consumer was its
  own test. Validator + test deleted, along with the Makefile step that shipped
  `schema.json` into `static/` for it (the schema is no longer fetched at
  runtime). Stale `_shared`/`generated/rule-groups` references dropped from
  `publish-details` and `build/test-rule-groups.json` prerequisites.
- **`make test-rules` duplicate coverage: DROPPED.** The target (and its
  `make test` step) is gone; the parity runner already executes inside
  `test-unit`'s vitest run.
- **Docs REWRITTEN for v2.** `RULES_ENGINE.md` is now the v2 engine
  specification (module contract, sheet/plan/offers/annotate passes, effects
  model, I/O contract, delivery, guards); `docs/RULE_GROUP_GUIDE.md` is the v2
  authoring walkthrough (module + registry/lazy + i18n + YAML metadata +
  scenario checklist, verified against the code and the parity runner's actual
  step/assert vocabulary); AGENTS.md/CLAUDE.md's "Notable Code Features" no
  longer describes phases/`after` — it states the structural-ordering and
  effects-not-mutations model.
- **E2E**: `make test-e2e` (Playwright smoke, 16 tests) now run and green in
  this environment (needed a sandbox-only browser-build shim); CI runs it on
  the prod workflows too. The play-flow behavior proof remains the manual
  test-env validation.
- **`ui.section` is now semantics-only; dead renderers DELETED, values TYPED.**
  `SectionCollapsible` (the section-header renderer) and
  `sectionConfig.ts` (`SECTION_ORDER`/`STAT_SECTION_ORDER`) had no importers —
  deleted with their tests. No live consumer renders section names; sections
  only feed the verb fallback (`deriveVerbFromSection`) and effect-kind
  mapping. The authoring trap is closed: `section` is confined to a `Section`
  union (`SECTIONS` in engine types; `OfferUI.section` +
  `EffectDisplay.section`; matching enum on the schema's `display.section`),
  and — belt-and-braces with the typecheck gate below — `sections.test.ts`
  walks every registered offer and fails on an unknown section or an intentless
  offer whose section has no verb mapping (accidental `HANDLE`);
  mutation-checked.
- **Typecheck gate ADDED (was: nothing typechecked in CI).** `pnpm check`
  (`svelte-kit sync && svelte-check`) is wired into `make test` (`make check`)
  and both prod workflows as a Typecheck step, and the pre-existing pile of
  138 errors across 43 files is burned to zero. The burn-down found two real
  src bugs: `CharacterCard` rendered `character.race` (a field that doesn't
  exist — every card subtitle was blank; now `species`), and the auth callback
  listened for the pre-Amplify-v6 `signIn` Hub event that can never fire (now
  `signedIn`/`signInWithRedirect`; previously only the fallback path
  redirected). Also fixed: the i18n `t()` payload typing (`PayloadDefault`
  rejected every real placeholder), `evaluateCondition` union narrowing, and
  ~50 test-fixture shape drifts. 6 warnings remain (not gating): an unused
  EffectChip CSS ruleset, four Svelte 5 initial-value-capture warnings in
  `PanelDiceLine` (worth a look — possible stale-`selections` reactivity), and
  one a11y warning on the SettingsModal overlay.

## 5. Verified-OK (checked, no issue)

- **Details pipeline intact after preprocessor removal**: `make publish-details`
  emits 33 detail JSON files across locales from `data/rule-groups` alone.
- **Creation-flow effects persist v2-shape end-to-end**: the wizard's settings
  resolve to v2 `EffectInstance`s, `POST /characters` passes them as raw JSON
  into seed instantiation, and the char seed stores `effects = "$(effects)"`
  verbatim — no v1-shape defaults are baked into the seeds.
- **Batch metadata API returns `settings`/`condition`**: the openapi
  BatchGetItem response template projects both (defaulting `"[]"`), so the
  frontend settings cache works against the deployed API.
- **End-turn staleness window is v1 parity, not a regression**: v1's `endTurn`
  also committed `state.engineOutput?.effects` from the last completed
  (debounced, 300 ms) evaluation.
- **All 68 `play.*`/`planner.*` i18n keys referenced by v2 code resolve in both
  locales** (including the new steed ledger labels in `derivePanels`).
- **The shared weapon/armor offer helpers (`builder.ts`) are faithful**:
  don guards (build-lock / already-equipped / hands budget), the versatile
  two-hand free-hand check, Light off-hand gating, and the Extra-Attack budget
  spend all mirror v1; "don-only" is itself v1 parity — v1 never had doff
  offers either (unequip was always the strip chip, see §1.4).
- **Annotation wiring is sound except §1.9**: every other module annotation
  target matches at least one offer's `annotationLabels`
  (`attack.unarmed`/`property.*` flagged by extraction were false positives —
  they live in const label arrays). Riders are 1:1 with v1 (fighting-style
  great-weapon only).
- **Heroic Inspiration cross-module keying is exact**: species-human's
  long-rest grant and heroic-inspiration's grant/use share the literal key
  `'heroic-inspiration'`, so eviction/idempotency compose as designed.
- **Javelin's Slow followup matches the PanelRenderer contract**
  (`type: 'effect'`, `condition`, `button`, `addRule.effect` with `display`).
- **The whole backend compiles** (`go build ./...`) after the
  cleanup-character edit; `watchdog.ts` semantics are sane (2 s budget,
  between-pass checks).
- **Zero dependency/config drift**: no changes to `package.json`,
  `vite.config.ts`, `svelte.config.js`, or `tsconfig.json` vs main — the v2
  engine added no runtime dependencies. `static/details` is gitignored build
  output, correctly untracked.
