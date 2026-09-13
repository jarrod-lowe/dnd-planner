# Spell Preparation Management

We recently added a "Loadout" option to swap weapons. Now I want to improve the method of preparing and un-preparing spells. Instead of individual prepare/un-prepare options for the spells to make them available, I want a single choice that lets me choose my spells.

I am imaging a list, separated by spell class, each with the option to prepare or un-prepare spells. It should also show the number of spells I can have prepared, and how many I have prepared.

It should not prevent me from preparing too many spells; but it should make it clear that I am doing so. This is the same logic as generally - the app does not prevent you from doing anything, but it makes it clear when it is illegal.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Settled decisions

| #               | Decision                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Scope           | Paladin only class implemented; mechanism class-agnostic. Known-casters: n/a (none exist).              |
| Timing          | No long-rest gate. Picker always available. Follow-up.                                                  |
| Cantrips        | None exist in repo. Out.                                                                                |
| Always-prepared | Row shown, checked, disabled. Excluded from count (already true via `preparedSpellCount`).              |
| Grouping        | Sections by **spell level** (L1, L2 today). Not by class.                                               |
| Granularity     | One effect carrying whole set. Replace, not diff.                                                       |
| Over-limit      | Allowed. Diagnostic `severity: 'error'` (app idiom for illegal-but-permitted). Counter shows `n / max`. |
| Old offers      | `preparedSpellOffers` deleted. No two ways in (Loadout precedent).                                      |
| Detail text     | Untouched — prepare offers never carried `detailKey`. Per-row detail = follow-up.                       |

## Architecture

Mirrors Loadout throughout (`389d1b18`, `docs/plans/ideas/loadout-change.md`).

**New domain lib** `src/lib/rules-engine/preparedSpells.ts` (beside `loadout.ts`, NOT a rule module):

- `PrepareDef { spellId, level, nameKey, preparedFact, alwaysPreparedFact }`
- `enumeratePreparableSpells(modules): PrepareDef[]`
- `preparedEffectState(selected): { state, stateCombine }`

**Types**: `RuleModule.prepare?: PrepareDef` in `types.ts` (mirrors `equip?: EquipDef`). Re-export from `builder.ts`.

**14 spell modules**: drop `...preparedSpellOffers({...})`; add `prepare: {...}`. `preparedSpellCount` in `derive` **unchanged** — it derives from facts, so it keeps working.

**Delete** `preparedSpellOffers` from `builder.ts`. Keep `preparedSpellCount`, keep `notLockedLegal`.

**New rule group** `prepared-spells`:

- `src/lib/rules-engine/rules/prepared-spells.ts`, `data/rule-groups/dnd-5e-2024/prepared-spells.yaml` (`requires: [spellcasting]`)
- Register in `registry.ts` AND `lazy.ts`
- One offer `set-prepared-spells`: `section: 'configuration'`, `intents: { PREPARE: 'spells' }`, `actionCost: []`, `primaryControl: { type: 'spell-prepare', var: 'prepared' }`
- `legalWhen: [notLockedLegal]` **only** — over-cap depends on _selections_, which `legalWhen` cannot read (fact-only). Loadout does the same.
- `apply(f, selections)`: over-cap diagnostic computed here — count selected non-always-prepared vs `spellcasting.prepared.max`. Advertise one effect: `key: 'prepared-spells'`, `expiry: permanent`, `state: { [preparedFact]: 1 }` per selected, `stateCombine: 'max'` per fact (composes with always-prepared grants), `display: { name }`.

**Every spell yaml** gains `requires: [prepared-spells]` (Loadout precedent: the items require the picker).

**UI** `src/lib/components/play/panel-renderer/PanelSpellPrepare.svelte`:

- `SpellPrepareControl { type: 'spell-prepare'; var: string }` added to `Control` union in `panel-renderer/types.ts`
- `<fieldset>` per spell level, `<legend>` = level. Native `<input type="checkbox">`. Alphabetical by **translated** name.
- Always-prepared rows: `checked` + `disabled`.
- Header counter `n / max prepared`, `aria-describedby` from the group. Counter counts **selections**, not facts (facts lag the plan).
- Over cap → existing illegal treatment. **No new colours** — theme variables only.
- `summary` mode → counter only.
- Export `spellPrepareIsEmpty()` escape hatch; wire into `PanelRenderer.svelte` beside the loadout branch (hide offer when no preparable spells).

**Seeding** `src/lib/play/currentPrepared.ts` (mirrors `currentLoadout.ts`): settled facts → selected set. Wire into `resolveInitialSelections.ts` so the picker opens on what is prepared.

**i18n**: every key in **both** `en/common.json` and `en-x-tlh/common.json`. tlh = normal casing, plausible invented values.

## Read first

`docs/RULE_GROUP_GUIDE.md` — mandatory before touching rules. §1 checklist, §7 pitfalls.

## Reference implementations — copy these

| New file                                            | Copy from                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/rules-engine/preparedSpells.ts`            | `src/lib/rules-engine/loadout.ts`                                            |
| `src/lib/rules-engine/rules/prepared-spells.ts`     | `src/lib/rules-engine/rules/loadout.ts`                                      |
| `data/rule-groups/dnd-5e-2024/prepared-spells.yaml` | `data/rule-groups/dnd-5e-2024/loadout.yaml`                                  |
| `.../panel-renderer/PanelSpellPrepare.svelte`       | `.../panel-renderer/PanelLoadout.svelte`                                     |
| `src/lib/play/currentPrepared.ts`                   | `src/lib/play/currentLoadout.ts`                                             |
| `tests/unit/svelte/PanelSpellPrepare.test.ts`       | `tests/unit/svelte/PanelLoadout.test.ts`                                     |
| `...PanelSpellPrepare-summary.test.ts`              | `tests/unit/lib/components/play/panel-renderer/PanelLoadout-summary.test.ts` |
| `tests/unit/lib/play/currentPrepared.test.ts`       | `tests/unit/lib/play/currentLoadout.test.ts`                                 |

`EquipDef` shape to mirror: `src/lib/rules-engine/types.ts:73-95`. Whole-feature diff: `git show 389d1b18`.

## Inventory — the 14 spell modules

All in `src/lib/rules-engine/rules/`. Each: delete the `...preparedSpellOffers({...})` spread, add `prepare: {...}`, leave `preparedSpellCount` in `derive` alone. `alwaysPreparedFact` is always `<preparedFact minus .prepared>.alwaysPrepared`.

| module                             | preparedFact                                  | level |
| ---------------------------------- | --------------------------------------------- | ----- |
| `bless.ts`                         | `spell.l1.bless.prepared`                     | 1     |
| `command.ts`                       | `spell.l1.command.prepared`                   | 1     |
| `create-and-destroy-water.ts`      | `spell.l1.createAndDestroyWater.prepared`     | 1     |
| `divine-favour.ts`                 | `spell.l1.divineFavour.prepared`              | 1     |
| `divine-smite.ts`                  | `spell.l1.divineSmite.prepared`               | 1     |
| `protection-from-evil-and-good.ts` | `spell.l1.protectionFromEvilAndGood.prepared` | 1     |
| `sanctuary.ts`                     | `spell.l1.sanctuary.prepared`                 | 1     |
| `sleep.ts`                         | `spell.l1.sleep.prepared`                     | 1     |
| `thunderous-smite.ts`              | `spell.l1.thunderousSmite.prepared`           | 1     |
| `calm-emotions.ts`                 | `spell.l2.calmEmotions.prepared`              | 2     |
| `find-steed.ts`                    | `spell.l2.findSteed.prepared`                 | 2     |
| `hold-person.ts`                   | `spell.l2.holdPerson.prepared`                | 2     |
| `prayer-of-healing.ts`             | `spell.l2.prayerOfHealing.prepared`           | 2     |
| `spell-aid.ts`                     | `spell.l2.aid.prepared`                       | 2     |

`nameKey`: reuse the module's existing `meta.name` key (its `O`/prefix const).

Always-prepared grants (already work, do not touch): `paladin-smite.ts`, `paladin-find-steed.ts`, `class-paladin-oath-redemption-level3.ts`, `...level5.ts`.

## Facts

- `spell.l<N>.<camelId>.prepared` 0/1 — set by our effect (`stateCombine: 'max'`) or by a grant (`combine: 'max'`).
- `spell.l<N>.<camelId>.alwaysPrepared` 0/1 — grants only.
- `spellcasting.prepared.max` — sum of class-level contributions. Paladin L1→7 gives 2,3,4,5,6,6,7.
- `spellcasting.prepared.count` — summed by `preparedSpellCount`, excludes always-prepared.
- `spellcasting.prepared.remaining` = max − count, derived in `rules/spellcasting.ts`.

Old effect key was `prep:<spellId>` (per spell). New key is `prepared-spells` (one, whole set).

## i18n

Add to **both** `src/lib/i18n/en/common.json` and `src/lib/i18n/en-x-tlh/common.json`:

```
rule.dnd-5e-2024.prepared-spells.set-prepared-spells.name
rule.dnd-5e-2024.prepared-spells.set-prepared-spells.description
rule.dnd-5e-2024.prepared-spells.set-prepared-spells.keywords
rule.dnd-5e-2024.prepared-spells.set-prepared-spells-offer.over-cap
rule.dnd-5e-2024.prepared-spells.effect-prepared-spells.name
play.verbBuckets.PREPARE.spells
play.spellPrepare.groupLabel
play.spellPrepare.level          # "Level {{level}}" — sveltekit-i18n uses {{double}} braces
play.spellPrepare.counter        # "{{count}} / {{max}} prepared"
play.spellPrepare.alwaysPrepared # disabled-row hint
```

Interpolated keys need stubs in `tests/setup.ts` (see the `play.loadout.handsFree.*` precedent at :31-33).

Delete (both locales): every `rule.spell-*.prepare-*-offer.*`, `rule.spell-*.unprepare-*-offer.*`, `rule.spell-*.effect-*-prepared.name`, and `play.verbBuckets.PREPARE.L1` / `.L2` — all dead once the offers go. `module-i18n-coverage` will not catch a _stale_ key, so sweep by hand.

## Gotchas found while planning

- **`notLockedLegal` is not exported** (`builder.ts:28`, module-private). Export it before `rules/prepared-spells.ts` can use it.
- **`play.verbBuckets.PREPARE.L1`/`.L2` are the current level buckets.** One offer means one bucket — `.spells` replaces both.
- Skip-list to prune: `tests/integration/rules-engine/yaml-scenarios.test.ts:62-70` (the three `legacy \`removing\` unprepare lifecycle` entries).
- `EXPECTED_RUNNABLE` starts at `yaml-scenarios.test.ts:91`; asserted exact at `:831`. Adding a scenario without registering it fails there.
- No multi-select control exists in the repo — `PanelLoadout` is a single-select radiogroup. `PanelSpellPrepare` is genuinely new UI, not a variant.
- Scenario dirs: `tests/integration/rules-engine/yaml-scenarios/<name>/test.yaml`. Pre-existing state goes in `initial-effects.ts` keyed by dir name, never legacy `initialEffects:` blocks.

## TDD

Superpower `/tdd`, strictly. Every step: **RED** (compiles, runs, does not panic, fails for the stated reason) → **GREEN** → refactor. Never commit while red. Never commit to main.

Data/rule changes may use a yaml scenario assert as the RED test.

RED order:

1. `enumeratePreparableSpells` unit test — no lib yet.
2. `set-prepared-spells` yaml scenario (`prepared-spells-set`) — offer does not exist.
3. Over-cap scenario (`prepared-spells-over-cap`) — offer illegal, effect still applies.
4. Always-prepared scenario (`prepared-spells-always-prepared`) — granted spell checked, not counted.
5. `PanelSpellPrepare` svelte tests (render, a11y, checkbox toggle, counter, disabled always-prepared) — component absent.
6. `currentPrepared` unit test — module absent.
7. Rewrite the 14 `*-prepare` scenarios to drive `set-prepared-spells`; delete the 3 legacy skip-listed ones (`calm-emotions-prepare`, `hold-person-prepare`, `sleep-prepare`).

## Subagent protocol

**Main agent co-ordinates and talks to the human only.** Every checklist item is dispatched to a subagent with: the item, the relevant file paths, the settled-decisions table, and the critical rules (TDD, i18n both locales, a11y, CSS law, no commit while red, no commit to main). Main agent verifies the subagent's claim by running the gate itself, ticks the box, appends notes. Full-suite runs and failure triage → subagent.

## Gates

`make validate-rules-schema` → `make check` → `make test-unit` → `make test`.

Guards that will bite: `module-coverage`, `module-i18n-coverage`, `sections.test`, `lazy`/`registry` sync, metadata i18n-compliance, `verify-chunks`, `annotation-targets.test`, `EXPECTED_RUNNABLE`.

## Checklist

- [x] Branch off main — `spell-prepare-management`
- [x] RED: `tests/unit/rules-engine/prepared-spells.test.ts` — `enumeratePreparableSpells` over a fixture module set (7 tests)
- [x] GREEN: `src/lib/rules-engine/preparedSpells.ts` + `RuleModule.prepare` in `types.ts` + re-export in `builder.ts` — `PrepareDef` defined in `types.ts` (EquipDef precedent)
- [x] Add `prepare: PrepareDef` to all 14 spell modules (offers untouched this step)
- [x] RED: yaml scenario `prepared-spells-set` + `EXPECTED_RUNNABLE` entry
- [x] GREEN: export `notLockedLegal` from `builder.ts`; `rules/prepared-spells.ts`, yaml metadata, `registry.ts`, `lazy.ts`, i18n both locales — **selection shape: full `PrepareDef` objects, not spellIds** (loadout's self-describing-selection mechanism; `apply` has no module list). `section: 'configuration'` confirmed in SECTIONS
- [x] RED→GREEN: scenario `prepared-spells-over-cap` (illegal, executes anyway) — behavior already green; mutation-checked non-vacuous
- [x] RED→GREEN: scenario `prepared-spells-always-prepared` (checked, uncounted, cannot unprepare) — same; real group id is `class-paladin/class-paladin-paladin-smite`
- [x] RED: `tests/unit/svelte/PanelSpellPrepare.test.ts` — rows, fieldset/legend, counter, disabled always-prepared, keyboard (15 tests incl. PanelRenderer wiring)
- [x] GREEN: `PanelSpellPrepare.svelte` + `SpellPrepareControl` in `panel-renderer/types.ts` + `PanelRenderer.svelte` wiring + `spellPrepareIsEmpty` — + `spellPrepareId.ts`; contrast 5.26:1 light / 8.42:1 dark (AA+AAA); svelte-autofixer clean; zero new colours (`--md-sys-color-error` token)
- [x] RED→GREEN: `PanelSpellPrepare-summary.test.ts` (counter-only collapsed row) — 4 tests
- [x] RED→GREEN: `tests/unit/lib/play/currentPrepared.test.ts` + `currentPrepared.ts` + `resolveInitialSelections.ts` — always-prepared-but-unprepared NOT seeded (facts are facts; panel renders checked via fact anyway)
- [x] Delete `preparedSpellOffers` from `builder.ts`; strip its spread from all 14 modules
- [x] Rewrite the 14 `*-prepare` yaml scenarios onto `set-prepared-spells`; delete the 3 legacy skips + their skip-list entries — 11 rewritten, 3 deleted; ~110 further scenarios that injected preparation via `prepare-*` steps also migrated (engine silently skips unknown offer ids — they'd pass vacuously); `smite-blocks-other-spells`' two sequential prepares merged into one whole-set selection
- [x] Update `build-lock/test.yaml` (`prepare-bless` → `set-prepared-spells`) and `tests/integration/rules-engine/slot-levels.test.ts` — + `tests/unit/rules-engine/prepared-count.test.ts` (found during execution)
- [x] Add `requires: [prepared-spells]` to every spell yaml — **Correction: yamls live in `data/rule-groups/spells/` (not dnd-5e-2024/) and all already carry `requires:` — appended**
- [x] Purge dead i18n keys (`prepare-*`/`unprepare-*` offer names + diagnostics) from both locales — 248 lines per locale incl. the 14 pre-existing stale `effect-*-removing` keys
- [x] Found during execution: rewrite `prep:<spellId>` literals in `tests/unit/rules-engine/effect-model.test.ts` + `tests/unit/play/engineBridge.test.ts`; rewrite 4 `*-prepared-then-granted` scenarios — 4 always-prepared scenarios' dead `illegal: [unprepare-*]` asserts replaced with behavioral empty-set steps
- [x] Fixed: lint error from UI phase (`_selections` unused → 2-param `spellPrepareIsEmpty`, sibling arity kept)
- [x] a11y pass: component-level asserts in `PanelSpellPrepare.test.ts` (fieldset/legend, implicit labels, native checkboxes keyboard-operable, `aria-describedby` counter link, `aria-live`); over-cap contrast `--md-sys-color-error` on `surface-container-high` = 5.26:1 light / 8.42:1 dark (AA+AAA both themes). Axe-on-page scan folded into the in-browser pass
- [x] CSS audit: zero literal colours in all new files (rg verified); theme vars only (`--md-sys-color-*`, `--spacing-*`, `--font-*`); `--illegal` modifier naming matches `warning-indicator--illegal` convention
- [x] `make validate-rules-schema && make check && make test-unit` — schema 86 files / check 0 errors / 175 files 2204 passed
- [x] `make test` green — full gate exit 0 (validate, security, schema, check, unit, e2e, lint)
- [x] `make sync-rule-groups` then `make deploy-test` — sync: 1 added, 58 updated, index rebuilt (2049 entries); deploy exit 0
- [x] Playwright against `http://localhost:5173`: picker opens seeded `6 / 7` → `7 / 7`; always-prepared rows checked+disabled with hints; effect chip on Active State. **Over-cap not reachable in-browser for this character** — exactly 7 preparable spells, cap 7 (covered by scenario + component tests instead)
- [x] Commit (signed, no amend, no co-author attribution beyond session lines), PR

### Progress log

| Phase                                       | Commit     | Verified by main agent                                           |
| ------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| Lib + types + 14 `prepare:` defs            | `00fb66ea` | `make check` 0 errors; 7/7 targeted tests                        |
| Rule group + scenario + registration + i18n | `3b9e7180` | `make check` 0 errors; scenario green; subagent gates green      |
| over-cap + always-prepared scenarios        | `25e30471` | subagent: 367 passed, mutation-checked; full scenario file green |
| PanelSpellPrepare + wiring + summary        | `3f4c8e72` | `make check` 0 errors; 39/39 panel tests                         |
| currentPrepared seeding                     | `73d85fdf` | 33/33 play tests                                                 |
| Teardown: offers deleted, ~130 scenarios migrated, i18n purged, requires appended | `362f1826` | schema 86 files, `make check` 0 errors, `make test-unit` 175 files / 2204 passed, `make lint` clean |

## Follow-ups (not this branch)

- Per-row detail text in the picker. Today a spell's rules text is reachable **only** from its cast offer, which is gated `when: prepared === 1` — so you cannot read a spell while deciding whether to prepare it. Needs plumbing: `detailKey` is per-offer, not per-row.
- Long-rest gate on re-preparing (2024 rules).
- Four orphan detail keys, already published and unreachable: `action/healing-touch`, `action/fey-step`, `action/fell-glare` (`steedAbilityOffer()` omits `detailKey`, unlike sibling `steedSlamOffer()`), and `equipment/shield`.
