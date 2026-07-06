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

**FIXED.** `shouldHideFromStrip` now implements the documented contract (`display` present → shown unless `display.hidden`; absent → hidden; concentration always shows), and `EffectDisplay` gained `hidden`/`subject`. Display metadata authored: hp damage/heal + manual modifiers (health section), weapon/armor/shield equips (the stow/doff affordance restored), build-lock, divinity short-rest, steed hp damage/heal/modifiers (subject: steed). Hidden-but-named restored for prepared spells (shared helper covers all 14) and ability-scores' stat sets (with displayFact) / increases / save+skill proficiencies. Remainder: settings-derived effects (sentinel ASI, paladin skills) still have no display name in the reveal view — their templates live in the YAML data layer.

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

## 2. Faithfulness deltas v1 → v2 (documented/intentional — confirm acceptable)

### 2.1 Offers are judged against post-plan facts (v1: phase-interleaved)

v2 evaluates the offer catalog once against the final projected facts
(engine.ts). v1 produced offers during phase execution, so an offer emitted by
an early-phase rule saw only earlier writes. In practice this makes v2 offers
_more_ consistent (they always see the whole plan), and the parity suite
passes — but any rule that relied on offers seeing pre-plan state would differ.

### 2.2 Plan legality is plan-order-significant (v1 reordered via `after`)

Documented in the parity skip list (`hi-use-then-grant`, `hi-effect-grant-use`,
`build-lock-weapon-clear`): v1 could reorder a planned "use" after a planned
"grant" via group dependencies; v2 folds the plan strictly in player order.
Deliberate design change; players must order dependent actions correctly.

### 2.3 Spell un-prepare is immediate (v1 had a 2-turn `removing` lifecycle)

sleep / calm-emotions / hold-person prepare effects evict immediately on
unprepare in v2 (same end state, no intermediate `removing` turn). Skip-listed.

### 2.4 Steed does not vanish passively at 0 HP

v1's self-advertise-gated-on-hp + `cascadeRemove` let the steed die when its
HP hit 0 without player action; v2 committed effects cannot self-remove on a
derived-fact threshold. Explicit dismissal cascades correctly. Skip-listed.

### 2.5 `cascadeRemove` dropped

`removeEffect` removes exactly one effect id; dependent-effect eviction is the
owning module's job via shared `key`s. No current rule needs the cascade, but
any future "removing X also removes Y" behavior must be authored module-side.

### 2.6 Steed damage type is numeric-only

v2 facts are numbers; the steed's string damage-type label (`radiant` /
`psychic` / `necrotic`) is not represented (creatureType 0/1/2 is). The UI
shows the type via the creature-type ability entry instead. Skip-listed.

### 2.7 Custom rule groups removed outright

v1 let users author per-character YAML/JSON rules (EditCustomRules); v2
evaluates only code modules, and the whole feature (editor, storage endpoint,
export field) was removed on this branch at the owner's direction. Existing
characters with a stored custom group lose those rules (accepted: pre-v2
characters are deleted/recreated).

### 2.8 Planned actions apply even when their structural `when` gate is closed

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

`v2Bridge.durationFromExpiry` maps a `turns` expiry to
`{ countDown: remaining, duration: remaining }` because an `EffectInstance`
keeps only the remaining count — the original total is lost. v1 kept
`ui.duration` (total) and `ui.countDown` (remaining) distinct, so the chip
showed elapsed pips. Cosmetic; fix would add an authored `total` (or
`display.duration`) to timed effects.

### 2.10 Sheet input facts are clobbered by contributors (sharp edge)

`evaluateSheet` seeds `facts = { ...inputFacts }`, but when any module/effect
contributes to the same fact, `settle()` overwrites the input value with the
combined contributions — the input is not itself a contribution. At runtime the
store passes `inputFacts: {}` so this cannot bite today, but a future caller
passing a base fact that modules also `sum` into would silently lose the base.
Consider treating a present input fact as an implicit `sum` contribution, or
throwing on the overlap.

### 2.11 Engine exceptions are uncaught in the store (hard-fail posture)

`performEvaluation` has no try/catch around `evaluateCharacterV2`, so any
engine throw crashes the play view: duplicate offer ids (`collectOffers`),
sheet dependency cycles / conflicting combine modes, and the watchdog's
`EngineTimeoutError`. All are "can't happen with current modules", but one bad
module or pathological plan becomes a blank screen instead of `ruleGroupError`.
Consider catching in `performEvaluation` and surfacing a toast + error state.

## 3. Coverage / test gaps

### 3.1 Diagnostic-code i18n coverage test deleted with no v2 equivalent

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

- **`sync_rule_groups.py` still carries the rules machinery.** The fact-analysis
  half (`extract_rule_facts`, `RULE_TRANSFORM_VERSION`, rule transforms) now
  operates on always-empty rules, and every DynamoDB item publishes
  `rules: "[]"`. Dead but harmless; slim when convenient. The Python tests
  (`scripts/test_sync_rule_groups.py`, `test_publish_details.py`) are NOT wired
  into `make test` and may still assume rules-bearing input — verify before
  relying on them.
- **`data/rule-groups/schema.json` still describes `rules`/activities** even
  though no file carries them any more. Slimming it to
  metadata+settings+condition+detail would make `validate-rules-schema` reject
  rules sneaking back into the data layer.
- **`make test-rules` duplicates coverage**: the default vitest run
  (`test-unit`) already includes `tests/integration/`, so the parity runner
  executes twice in `make test`. Harmless; drop the target or exclude
  integration from `test-unit` if CI time matters.
- **Docs are stale for v2**: `RULES_ENGINE.md` and `docs/RULE_GROUP_GUIDE.md`
  still document the deleted v1 engine/authoring model, and `CLAUDE.md`'s first
  instruction points new-rule authors at the v1 guide. Rewrite before any new
  rule work, or authors will follow a dead process.
- **E2E not exercised in this review**: `make test-e2e` (Playwright smoke) was
  not run here; CI runs it on the prod workflows. The play-flow behavior proof
  remains the manual test-env validation.
- **`ui.section` is now semantics-only, and some values have no meaning.**
  `SectionCollapsible` (the section-header renderer) has no importers — dead
  code — and no live consumer renders section names; sections only feed the
  verb fallback (`deriveVerbFromSection`) and effect-kind mapping. Modules use
  section values with no i18n header and no verb-fallback case (`mastery`,
  `mount`, `equip`, bare `action`/`bonus-action`), which is currently harmless
  (all such offers carry explicit intents) but is an authoring trap — a
  section-only offer with one of those values would fall to the `HANDLE`
  bucket. Consider deleting `SectionCollapsible`/`SECTION_ORDER` or typing the
  allowed section values.

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
