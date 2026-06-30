# Rules Engine v2 — M3 Plan (port all rule groups)

Branch `claude/rules-engine-v2-m3` (PR #357, stacked on `…-m2`). This is the big
milestone: re-author every v1 rule group as a v2 builder-API module until the
whole scenario suite runs on v2. M4 then flips the runtime and deletes v1.

## 1. Goal & exit criteria

- **Every existing yaml scenario green on v2** (the parity harness, currently 3
  runnable / 333 skipped, reaches ~0 skipped).
- New scenarios added where v2 exposes behaviour v1 scenarios didn't cover.
- The Python `scripts/rule_preprocessor` (weapons) is retired or retargeted.
- The 3 deferred module-parity items (below) land.
- `make test` green; no v1 behaviour regressions.

## 2. What we already have (ported in M0/M1 + the spike)

`ability-scores`, `hp`, `action-economy`, `attacks`, `spellcasting`,
`class-paladin-level1`, `class-paladin-paladin-smite`, `spell-divine-smite`,
`spell-divine-favour` — 9 modules, each code-split into its own lazy chunk.

## 3. Strategy

- **Parity harness is the oracle.** Port a group, its scenarios unskip
  automatically (the harness resolves a scenario once _all_ its groups are
  ported). Watch "N runnable / M skipped" climb after every port.
- **Dependency order, foundation first** (§5). Most scenarios are full-character
  and block on a few foundational groups (`proficiency`, `free-actions`,
  `core-events`), so porting those unlocks scenarios in waves rather than one at a
  time. Until a group's scenarios unskip, a **per-rule unit test is the interim
  contract check** (as the spike did for Divine Favour).
- **TDD, hardest-representative-first within a wave.** Each module: write the unit
  test (or unskip the scenario), red, port, green, then run the parity harness.
- **One module = one chunk = one canonical bare ruleGroupId** (registry.ts +
  lazy.ts), matching the backend's persisted/published id namespace.

## 4. Step 0 — multi-predicate expiry (DONE)

The pre-M3 spike ([RULES_ENGINE_V2_M3_SPIKE.md](RULES_ENGINE_V2_M3_SPIKE.md))
surfaced that a single-predicate `Expiry` can't model "duration AND ends on a
rest". Landed: `ExpirySpec = Expiry | Expiry[]` (ends when the earliest condition
fires) + an `untilShortRest` condition (a long rest ends it too) + a `shortRest`
option on `endTurn`. Single conditions stay single objects; `endTurn` stays a
pure fold. This unblocks every duration/rest spell in waves D/E.

## 4b. Rest model (decided)

A rest **applies immediately when recorded** — engine-wide, so the app and the
parity harness behave identically, and both engines pass the same (v1-authored)
scenarios that assert restoration right after a planned `record-rest`. Mechanism:
a recorded rest is a fact (`rest.long` / `rest.short`, set by core-events'
recorders); the sheet **excludes that rest's scoped effects in the evaluation it
is recorded** (`untilLongRest` on a long rest; `untilShortRest` on either), and
`endTurn` then drops them so they don't return next turn. `endTurn`'s explicit
`longRest` / `shortRest` param is kept for direct callers (unit tests). A long
rest counts as a short rest too. (Per the user: either timing is fine as long as
it is consistent — this is the consistent definition chosen.)

## 4c. Progress (parity 3 → 164 runnable, ~55% of rule groups)

Done: step 0 (multi-predicate expiry) + the rest model; **Wave A foundation**
(`ability-scores`, `proficiency`, `free-actions`, `core-events`, `ac`,
`movement`, `species-human`); resources `heroic-inspiration`, `lay-on-hands`;
`class-paladin-level1` filled out (saves, spell modifier, armor profs, LoH pool,
prepared max); **the prepared-spell path** (deferred item #2 below — DONE via
`builder.preparedSpellOffers`); the first concentration / on-hit-smite / ward
spells (`bless`, `thunderous-smite`, `create-and-destroy-water`, `sanctuary`,
`protection-from-evil-and-good`); and **the weapons spike** (`hands`,
`dagger`(+`-mastery`), `greataxe`(+`-mastery`)) via `builder.weaponOffers` — the
definitions × profiles cross-product the Python preprocessor generated is now a
plain function over data (see Wave D); and **paladin level 2**
(`class-paladin-level2`) — the keystone of the paladin progression (it blocks
~42 scenarios; level3 a further 32, etc.). It stacks `combine: sum` onto level 1
(HP, prepared-spell capacity, Lay-on-Hands pool) and finally exercises the Divine
Smite free-use path (already in the smite module). The CON-at-level capture v1
did for HP collapses to "count CON once at level 1" in v2's passive-derive model;
the hit-die contribution is deferred with the hit-die group. **Paladin level 3**
(`class-paladin-level3`) follows the same shape (+6 HP, a third L1 slot, +1
prepared, +5 LoH, +2 Channel Divinity pool — `remaining`s derived by their owning
groups). Note `paladin-level3-loh-pool` is skip-listed: it omits the
lay-on-hands group yet asserts `pool.remaining`, which v2 derives there (v1 set
it directly in the class-level rules); `pool.total` still matches and the
level2/3 loh scenarios that load the group cover `remaining`.

Deferred / skip-listed (visible & counted in the harness):

- **Attacks `hitBonus`/damage** — DONE for the spike weapons (dagger/greataxe set
  `attack.<id>.hitBonus`/`damageBonus`); the unarmed `attack-unarmed-strike` /
  `ability-modifier-ordering` scenarios still need unarmed's own hit/damage port.
- **Passive-effect-from-rest hook — DONE** (`RuleModule.onRest`): a passive module
  emits persistent effects when a rest is recorded this turn. `evaluatePlan` detects
  the rest from the settled facts, appends each module's `onRest` effects, and
  re-derives so they are visible in-evaluation and commit at end of turn. This
  unblocked **Channel Divinity short-rest recovery** (`divinity` emits an
  `untilLongRest` `divinity.recovered` point; `remaining = clamp(total − spent +
  recovered)`) and **Human HI-on-long-rest** (`species-human` emits a keyed
  permanent HI effect — same key as the grant, so it does not stack).
  `hi-human-long-rest-no-duplicate` stays skipped, but now only for its v1-format
  `initialEffects`, not a missing feature.
- **`hi-use-then-grant`** — relies on v1 intra-turn reordering; v2 plan fold is
  plan-order by design (won't change).
- **Always-prepared count gate edge** — handled at apply time (reads
  `alwaysPrepared`); the `*-prepared-then-granted` scenarios that exercise it
  also need later groups (level2 / find-steed / oath), so they unlock there.

## 5. Port waves (order is a guide; parity coupling may reshuffle)

Each entry is a v1 group → v2 module. Run the parity harness after each.

- **Wave A — foundation (highest unlock):** `proficiency` (unblocks
  ability-increase + all skills), `free-actions` (action-economy scenarios),
  `core-events`, `hit-die`, `build-lock`, `concentration`, `movement`, `hands`,
  `species-human`.
- **Wave B — defence & checks:** `ac`, armor (`leather-armor`, `splint-armor`,
  `shield`), `skill-checks`, `passive-skills`, `initiative`, `heroic-inspiration`.
- **Wave C — actions & feats:** `dash`, `grapple`, `shove`, `simple-actions`,
  `feat-alert`, `feat-savage-attacker`, `feat-sentinel`,
  `fighting-style-great-weapon`.
- **Wave D — weapons (retire the Python preprocessor):** `dagger`(+`-mastery`),
  `greataxe`(+`-mastery`) **DONE**; remaining `javelin`(+`-mastery`),
  `scimitar`(+`-mastery`), `spear`, `spear-plus1`. The replacement for the
  preprocessor is `builder.weaponOffers(def)`: a weapon is one self-contained
  module (hit/damage derives + `weaponOffers`), where the helper crosses the
  weapon `def` with the don/use-action/use-reaction/use-bonus profiles directly
  in TS (template literals stand in for `$(definition.id)`). The remaining
  weapons are the same shape; `spear`/`spear-plus1` additionally need the
  versatile `extraHands` two-hand path (deferred — neither spike weapon uses it).
  The v1 `data/rule-sources` + `scripts/rule_preprocessor` stay until v1 is
  decommissioned (M4); deleting them now would break the v1 engine and its
  scenarios. The spike proves the retirement is a mechanical follow-up.
- **Wave E — paladin class + remaining spells:** class-paladin `divinity`,
  `lay-on-hands`, `level2`–`level5`, `oath-redemption-level3/4/5`,
  `paladin-find-steed`, `paladin-spells-l1/l2`; spells `bless`, `calm-emotions`,
  `command`, `create-and-destroy-water`, `hold-person`, `prayer-of-healing`,
  `protection-from-evil-and-good`, `sanctuary`, `sleep`, `spell-aid`,
  `spell-find-steed`, `thunderous-smite`.

## 6. Deferred module-parity items (carried from M0, land in M3)

1. **Replacement-effect / HP-modifier rules** — the keyed-effect + `stateCombine`
   engine support exists (`effect-model.test.ts`); port the rules that use it
   (HP modifiers, prepared-spell markers).
2. **Divine Smite / Divine Favour prepare path** — the prepare/unprepare offers +
   `spellcasting.prepared.*` accounting (the spike used `prepared` as an input
   fact; real prepare management ports here).
3. **Full attack UI descriptors** — incl. `annotationLabels` so the smite/favour
   riders actually attach in the panel (#355).

## 7. Verification boundary

- Pure-engine work (modules, expiry model, parity) is **fully testable here**:
  `make test` (vitest + rules + lint), parity harness, `verify-chunks`.
- Search-index publish of the new modules' metadata (M2/W4 sync half) and the
  e2e/deploy proof remain **env/CI-gated** (run via `make sync-rule-groups` /
  `make deploy-test`), deferred to their milestones.

## 8. Guardrails (critical — inherited from CLAUDE.md, keep through compactions)

- **TDD** for every module (red → green); **never commit on a failing `make test`**.
- **Never commit to `main`.** Develop on `claude/rules-engine-v2-m3`.
- **I18n:** all user-facing text via the translation files/keys — never hardcode
  strings in modules; reuse existing `rule.*` keys where the v1 group had them.
- **A11y + the CSS Law:** any UI-descriptor work uses semantic markup and only
  existing theme colour variables — never invent colours; reuse semantic styles.
- **Infra only via make targets** (`make deploy-test`, `make sync-rule-groups`,
  `make validate`); never run `terraform` directly.
- **New rules go through the yaml scenarios runner**; see
  `docs/RULE_GROUP_GUIDE.md` before authoring.
- **STOP rule:** if a rule genuinely doesn't fit the paradigm, stop and ask — do
  not improvise a different engine shape (use the dependency mechanism / data
  combinators, never split the phases further).

## 9. Out of scope (M4)

Runtime flip / feature-flag cutover, the UI + persistence contract adapter,
migrating persisted effects to the ref format, and deleting the v1
engine/activities/phases/YAML. Tracked in the master plan's M4 row.
