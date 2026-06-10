# Otherworldly Slam

Currently, the Find Steed's Otherworldly Steed has a dummy action. We need to replace it with the real action.

This is an action against the steed, not the player. It is called Otherworldly Slam.

## SRD Text

From `static/details/en/spell/find-steed.json`:

> **Otherworldly Slam.** Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. **Hit:** 1d8 plus the spell's level of Radiant (Celestial), Psychic (Fey), or Necrotic (Fiend) damage.

- **Attack bonus**: Player's spell attack modifier (CHA mod + proficiency for paladins)
- **Damage**: d8 + `find-steed.selectedLevel` / `companion.steed.spellLevel`
- **Damage type**: Depends on steed creature type (Celestial=Radiant, Fey=Psychic, Fiend=Necrotic). Defaulting to Radiant since steed type isn't tracked as a fact yet.
- **Action economy**: Consumes `companion.steed.actions.remaining` (steed's action) or `reactions.remaining` (player's reaction for opportunity attack)

## Implementation Notes

- **Same-turn hit bonus**: Uses `spellcasting.modifier` (CHA mod only, no proficiency) because the full attack modifier can't be computed in same-turn activities without breaking the cast rule. The persisted (next-turn) slam correctly uses `companion.steed.slam.hitBonus` which includes proficiency.
- **Reaction variant**: Uses player's `reactions.remaining` (not steed's — steed has no reaction economy). Only in persisted effect sections, not same-turn.
- **Damage die**: Uses `{ var: damageDie }` with `default: { number: 8 }` instead of hardcoded `expression: "1d8"` because the dice-line component's `getDieSides()` doesn't parse "1d8" notation.
- **Heroic Inspiration**: Removed `dice.any` from `annotationLabels` so HI doesn't incorrectly apply to steed dice.

## Checklist

- [x] Write failing test `tests/integration/rules-engine/yaml-scenarios/steed-slam/test.yaml`
- [x] Write failing test `tests/integration/rules-engine/yaml-scenarios/steed-slam-upcast/test.yaml`
- [x] Add `steed-slam` offerRule in same-turn offers (L2–L5) in `spell-find-steed.yaml`
- [x] Add `steed-slam` offerRule in persisted effect offers in `spell-find-steed.yaml`
- [x] Add `steed-slam-reaction` offerRule in persisted effect offers (4 copies)
- [x] Add `companion.steed.spellLevel` fact to all resource blocks
- [x] Add `companion.steed.slam.hitBonus` computation to all resource blocks
- [x] Fix damage die expression from `"1d8"` to `{ var: damageDie }` with default 8
- [x] Remove `dice.any` from annotationLabels (HI fix)
- [x] Add `steed-slam` translations to `src/lib/i18n/en/common.json`
- [x] Add `steed-slam` translations to `src/lib/i18n/en-x-tlh/common.json`
- [x] Remove `offer-steed-dummy-action` and `offer-steed-dummy-bonus` from both locale files
- [x] `make test` passes (292/292 tests green)
- [x] `make sync-rule-groups` to push rule changes
- [ ] Visual check on localhost:5173 — slam appears as steed action with dice-line
