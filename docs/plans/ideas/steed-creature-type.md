# Find Steed Creature Type Selector

Add a creature type selector (Celestial/Fey/Fiend) to Find Steed's cast action, and make the Otherworldly Slam damage type dynamic based on the selection.

## What Changes

- Add a `secondaryControl` segmented selector to the cast action for creature type
- Persist the selection as facts (`companion.steed.creatureType`, `companion.steed.damageType`, `companion.steed.damageTypeLabel`)
- Change all 12 slam `damageType` from static `{ string: radiant }` to dynamic `{ fact: companion.steed.damageType }`
- Add `descriptionValues` to `PanelDescriptor` for dynamic damage type in slam description

## What Does NOT Change

- All three bonus actions (Healing Touch, Fey Step, Fell Glare) remain offered regardless of creature type
- Bonus action resource setup is not gated
- Early-phase resource rules are not gated

## SRD Text

From `static/details/en/spell/find-steed.json`:

> Whenever you cast the spell, choose the steed's creature type—Celestial, Fey, or Fiend—which determines certain traits in the stat block.

> _Otherworldly Slam._ Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. _Hit:_ 1d8 plus the spell's level of Radiant (Celestial), Psychic (Fey), or Necrotic (Fiend) damage.

## Implementation Notes

- `damageType` in `DiceEntry` is a `ValueSource` — supports `{ fact: ... }` (`src/lib/components/play/panel-renderer/types.ts:37`)
- `resolveValueSource()` resolves it dynamically (`PanelDiceLine.svelte:118`)
- `stringSet` activity type exists (`src/lib/rules-engine/activities.ts:106`)
- `advertiseEffect` copies `selections` from current rule to new effect (`activities.ts:513-514`), so `creatureType` var propagates to persistent effects
- `$t()` supports interpolation params (e.g. `$t(key, { score: value })` from `EffectChip.svelte:44`)
- The file uses YAML anchors (`&steed-resources-l2` etc.) — the L2 block is the anchor, L3/L4/L5 are separate blocks with their own anchors

## Files

- `data/rule-groups/spells/spell-find-steed.yaml` — Main rule changes (~12,000 lines, highly repetitive)
- `data/rule-groups/schema.json` — Add `descriptionValues` to ui schema
- `src/lib/components/play/panel-renderer/types.ts` — Add `descriptionValues` to `PanelDescriptor`
- `src/lib/components/play/panel-renderer/extractPanelDescriptor.ts` — Extract `descriptionValues` from ui
- `src/lib/components/play/PanelRenderer.svelte` — Resolve `descriptionValues` in `displayDescription`
- `src/lib/i18n/en/common.json` — Creature type labels + updated slam description
- `src/lib/i18n/en-x-tlh/common.json` — Klingon translations

## Checklist

### Cycle 1: Creature type facts

- [ ] RED: Write `tests/integration/rules-engine/yaml-scenarios/steed-creature-type-fey/test.yaml` — cast with `selections: { creatureType: 1 }`, assert facts `companion.steed.creatureType: 1`, `companion.steed.damageType: psychic`, `companion.steed.damageTypeLabel: damage-type.psychic`, persist after endTurn
- [ ] Verify test fails: `make build/test-rule-groups.json && npx vitest run tests/integration/rules-engine/yaml-scenarios-runner.test.ts -t "steed-creature-type-fey"`
- [ ] GREEN: Add i18n keys `rule.spell-find-steed.creature-type.celestial/fey/fiend` to `en/common.json` and `en-x-tlh/common.json`
- [ ] GREEN: Add `secondaryControl` (segmented, var `creatureType`, 3 options) to `cast-find-steed` rule UI, after `valueFormat: spellLevel`
- [ ] GREEN: Add `creatureType` var with `capture: true, default: { number: 0 }` to cast rule vars
- [ ] GREEN: Add fact-setting activities in cast activities (after `numberSet` for `find-steed.selectedLevel`): `numberSet` for creatureType, conditional `stringSet` for damageType (radiant/psychic/necrotic) and damageTypeLabel (damage-type.radiant/psychic/necrotic)
- [ ] GREEN: Add same `vars` + fact-setting to all 4 `effect-steed-resources` blocks (`&steed-resources-l2` through `&steed-resources-l5`) — add `vars` before `activities`, add activities after `spellLevel` numberSet
- [ ] Verify test passes and no regressions: `make build/test-rule-groups.json && npx vitest run tests/integration/rules-engine/yaml-scenarios-runner.test.ts`

### Cycle 2: Dynamic slam damage type

- [ ] RED: Verify that without the change, slam always uses radiant (existing behavior)
- [ ] GREEN: Replace all 12 `damageType: { string: radiant }` with `damageType: { fact: companion.steed.damageType }` (use `replace_all: true` on the Edit)
- [ ] Verify all tests pass: `make build/test-rule-groups.json && make test`

### Cycle 3: Dynamic slam description

- [ ] RED: Write unit test for `descriptionValues` on PanelDescriptor — verify ValueSource resolved through `$t()` then interpolated
- [ ] Verify test fails
- [ ] GREEN: Add `descriptionValues?: Record<string, ValueSource>` to `PanelDescriptor` in `types.ts`
- [ ] GREEN: Add `descriptionValues` extraction in `extractPanelDescriptor.ts`
- [ ] GREEN: Update `displayDescription` in `PanelRenderer.svelte` to resolve values through `$t()` then pass as interpolation params
- [ ] GREEN: Add `descriptionValues` to `schema.json` ui definition
- [ ] GREEN: Update slam description i18n to `"Melee Attack | Reach 5 ft | 1d8 + spell level {{damageType}} damage"` in both locale files
- [ ] GREEN: Add `descriptionValues: { damageType: { fact: companion.steed.damageTypeLabel } }` to all 12 slam offer ui blocks
- [ ] Verify all tests pass: `make build/test-rule-groups.json && make test`

### Final verification

- [ ] `make test` passes
- [ ] `make dev` — visually verify creature type selector on cast, correct damage type on slam
- [ ] `make sync-rule-groups` to update test seed data
