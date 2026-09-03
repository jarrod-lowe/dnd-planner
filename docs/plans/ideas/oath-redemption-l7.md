# Oath of Redemption Level 7

Implement Level 7 Paladin, and Level 7 Oath of Redemption.

Paladin L7 - in addition to the standard counters that go up every paladin level - gains an extra L2 spell slot (now 3).

Oath of Redemption L7 provides "Aura of Guardian". This allows the character to use their reaction to do a magic action to take damage intended for someone else (within 10ft). It only takes the damage - any effects remain on the original target. The damage amount cannot be mitigated.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Critical Rules (carry through compaction)

- **TDD mandatory.** RED first: test must compile, run, not panic, FAIL for the right reason. Then GREEN, then refactor.
- **i18n:** every user-facing string is a key in BOTH `src/lib/i18n/en/common.json` and `src/lib/i18n/en-x-tlh/common.json`. No literals in modules. Detail bodies are en-only (tlh falls back).
- **tlh casing:** normal casing in `en-x-tlh` values; the all-caps look is CSS.
- **Never commit on `main`; never commit while tests fail; no `--amend`; no Co-Authored-By / AI attribution.**
- **Never run `terraform`** - use Make targets.
- **Rules live in TS modules**, not YAML. YAML = metadata only (schema rejects `rules:`).
- **No ordering controls.** Derivation order is structural. Never propose phases/`after`.
- **`apply` never writes facts** - it advertises effects.
- **Subagents do the work**; main agent co-ordinates, runs gates, talks to the human.
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing modules.

## Design

### Two new rule groups

| Group                                  | Module                                               | YAML                                         |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `class-paladin-level7`                 | `src/lib/rules-engine/rules/class-paladin-level7.ts` | `data/rule-groups/class-paladin/level7.yaml` |
| `class-paladin-oath-redemption-level7` | `.../class-paladin-oath-redemption-level7.ts`        | `.../oath-redemption-level7.yaml`            |

`requires`: level7 -> `[class-paladin-level6]`; oath7 -> `[class-paladin-level7, class-paladin-oath-redemption-level6]`. No new spell groups (L7 grants no oath spells).

### class-paladin-level7 - `derive` only, all `combine: 'sum'`

| Fact                              | Delta               | Running total |
| --------------------------------- | ------------------- | ------------- |
| `hitDie.d10.total`                | +1                  | 7             |
| `hp.base.max`                     | +6 + `con.modifier` | 46 @ con 0    |
| `layOnHands.pool.total`           | +5                  | 35            |
| `spellcasting.slots.level2.total` | +1                  | 3             |
| `spellcasting.prepared.max`       | +1                  | 7             |

Unchanged (contribute nothing, assert they hold): `proficiency.bonus` 3, `divinity.total` 2, `spellcasting.slots.level1.total` 4, no L3 slots.

### class-paladin-oath-redemption-level7 - Aura of the Guardian

Name: **Aura of the Guardian** (book spelling). One offer, id `aura-of-the-guardian`.

```
ui: section 'reaction', intents { DEFEND: 'ward' }, actionCost ['reaction'],
    detailKey 'class-feature/aura-of-the-guardian',
    primaryControl: slider var 'amount', min 0, max { fact: 'hp.max' }, unit 'hp'
vars: { amount: { capture: true, default: { number: 0 } } }
legalWhen: reactions.remaining > 0 -> `${O}.offer-aura-of-the-guardian.no_reaction`
apply -> advertise:
  1. { id: 'cost', state: { 'reactions.spent': 1 }, expiry endOfTurn }   // keyless, no display
  2. { id: 'effect-aura-of-the-guardian',
       state: { 'hp.modifier.current': -amount },
       display: { name: `${O}.effect-aura-of-the-guardian.name`, section: 'health', value: amount },
       expiry untilLongRest }                                            // keyless -> stacks
  3. if f.has('concentration.remaining') && <= 0:
       { id: 'concentration-damage-taken', key: same, state: { 'concentration.damage-taken': 1 },
         expiry endOfTurn }
  diagnostics: re-check the reaction gate (rebuke-the-violent shape)
```

Reaction is the whole cost (the transfer is described as magical, which is flavour rather than a Magic action). No `amount > 0` gate and no gate on having the HP to spare - dropping yourself to 0 is the point of the feature. (Phase 6 added the floor at 0: absorbing more than you hold bottoms out rather than going negative.)

**Deliberately not modelled** (doc-comment + description only, mirroring the L6 aura): the 10-ft radius, ally positioning, line of sight, the ban on mitigating the absorbed damage (nothing in the engine reduces damage), the rule that only hit point loss crosses over, the L18 range increase to 30 ft.

**Detail text must be original.** The published wording of this feature is copyrighted and not licensed here - the rules-mode body conveys the mechanics in our own voice, as the L3 oath detail does. Never paste or closely track published text.

### i18n keys (both locales)

- `rule.class-paladin-oath-redemption-level7.aura-of-the-guardian.{name,keywords,description}`
- `rule.class-paladin-oath-redemption-level7.offer-aura-of-the-guardian.no_reaction`
- `rule.class-paladin-oath-redemption-level7.effect-aura-of-the-guardian.name` - `"Aura of the Guardian {{score}}"` (`{{param}}` double-brace, per `effect-hp-damage`)
- `class-paladin-level7` needs no `rule.*` keys (derive only); its search text lives in the YAML `translations`.

### YAML metadata

Both files: `translations` en + en-x-tlh (name/description/keywords), `requires`. `oath-redemption-level7.yaml` also carries the `detail:` block - `key: class-feature/aura-of-the-guardian`, `source: custom`, `fields` for casting time (1 Reaction) and range (10 feet), en-only markdown `body`.

### Tests (RED first)

Eight YAML scenarios under `tests/integration/rules-engine/yaml-scenarios/`, each added to `EXPECTED_RUNNABLE` in `tests/integration/rules-engine/yaml-scenarios.test.ts`:

1. `hp-paladin-level7` - `hp.max` 46
2. `hit-die-paladin-level7` - `hitDie.d10.total` 7
3. `paladin-level7-loh-pool` - pool 35
4. `paladin-level7-prepared` - `spellcasting.prepared.max` 7
5. `paladin-level7-spell-slots` - 4 / 3 (the line that changes)
6. `oath-redemption-level7` - roll-up: all prior oath features intact, `aura-of-the-guardian` offer exists
7. `paladin-level7-aura-of-the-guardian` - plan with `amount: 12` -> `reactions.remaining` 0, `hp.current` -12, effect exists; plan again with no reaction -> `no_reaction` plan error
8. `paladin-level7-aura-concentration` - concentrating + aura use -> `concentration.damage-taken` 1

## Checklist

### Phase 1 - RED (subagent) - DONE

- [x] Write all 8 scenario `test.yaml` files
- [x] Add all 8 names to `EXPECTED_RUNNABLE`
- [x] Run `make test-unit`; RED confirmed: all 8 skip as `unported groups: class-paladin-level7...`, one failing assertion (the coverage set). No parse error, no panic.
- Note: scenario 7 needed an `endTurn` between the two uses (the `effects:` assert reads COMMITTED effects) - bonus coverage of `untilLongRest` persistence and keyless stacking.
- Note: no `paladin-level7-proficiency` scenario written (proficiency 3 is asserted inside the roll-up); the L6 set has a standalone one, so symmetry is available if wanted.

### Phase 2 - GREEN: class level (subagent) - DONE

- [x] `src/lib/rules-engine/rules/class-paladin-level7.ts` (derive table above, doc-comment in the L5/L6 house style)
- [x] Register in `registry.ts` (import + `MODULES`) AND `lazy.ts` (`LOADERS`)
- [x] `data/rule-groups/class-paladin/level7.yaml`
- [x] `make validate-rules-schema` (83 files) + `make check` (0 errors) pass; scenarios 1-5 GREEN. Only remaining failure is the coverage set, missing the 3 oath scenarios.
- Note: plan derive table was accurate; no deviations.

### Phase 3 - GREEN: oath level (subagent) - DONE

- [x] `src/lib/rules-engine/rules/class-paladin-oath-redemption-level7.ts` (offer above)
- [x] Register in `registry.ts` AND `lazy.ts`
- [x] `data/rule-groups/class-paladin/oath-redemption-level7.yaml` incl. `detail:` block
- [x] i18n keys in `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json`
- [x] `make validate-rules-schema` (84 files) + `make check` (0 errors); `make test-unit` fully
      green - 145 files, 1859 passed, 11 skipped. Scenarios 6-8 GREEN.
- Note: the concentration branch worked as specced - the scenario commits Bless on an
  earlier turn, so `concentration.remaining` is 0 in committed state when `apply` runs.
- Note: yaml-scenarios runnable count is 350, not the 349 the plan predicted.

### Phase 4 - Gates (main agent) - DONE

- [x] `make test` fully green end to end (validate, security, rules schema, check, test-unit, build, test-e2e 16/16, lint)
- [x] `make format` clean (no files changed), `make lint` clean
- [x] Refactor pass: no change made, deliberately. The two new modules follow the per-level house style (each level file stands alone; sharing across them would fight the code-splitting/chunk convention). The one real duplication is the `concentration-damage-taken` guard block, copied from `core-events` `record-damage` - 2 occurrences, 6 lines, and hoisting it into `builder.ts` would touch a core module for marginal gain. Worth extracting if a third damage source appears.

### Phase 5 - Deploy + visual (main agent)

- [x] `make sync-rule-groups` - 2 rule groups added, 16 updated, 673 search index entries
- [x] `make deploy-test` - REQUIRED even for a rules-only change: `make sync-rule-groups` alone updates DynamoDB but does not invalidate the CloudFront distribution, so the test site keeps serving the old bundle. Deploy issued invalidation `/*`.
- [x] Playwright check on <http://localhost:5173>: assigned "Oath of Redemption Level 7" in Manage Rules; `class-paladin-level7` auto-assigned via `requires` (checked + disabled). Live topline/resources moved exactly as specced - HP 17/52 -> 25/60, LoH 30 -> 35/35, HD 6 -> 7/7 d10, slots 4/2 -> 4/3. The offer appears under Defend -> Ward, renders the `RXN` cost chip, the description, and the hp slider; sliding to 33 took HP 25 -> -8 and spent the reaction; the chip reads "Aura of the Guardian 33"; the Flip side renders the detail meta, Casting Time/Range fields and body. Undo restored everything.
- [x] Branch `paladin-l7-oath-redemption` off `main`
- [x] Commit + PR - https://github.com/jarrod-lowe/dnd-planner/pull/394

### Phase 6 - Post-review fixes (main agent + subagents)

Raised by the human after the PR opened.

- [x] **Copyright.** The published wording of Aura of the Guardian is not licensed here, and the first draft of the rules-mode body tracked it sentence-for-sentence. Rewritten in our own voice (four paragraphs, leading with the aura rather than the trigger); every distinctive published phrase replaced. Also reworded the casting-time field, the offer description (`cannot be reduced` -> `Absorb an ally's damage in full`, both locales), three quoted clauses in the module doc-comment and two in this plan. `source: custom` was already correct.
- [x] **HP floored at 0.** `hp.current` had no lower clamp, so absorbing more than you hold read `HP -8/60`. Two defects, both fixed:
  - `hp.current` now uses the shared `currentHp` helper - `Math.max(0, hpMax + Math.min(0, modifierCurrent))` - hoisted into `builder.ts` and reused by `hp.ts` and `find-steed.ts` (the steed already had the correct formula, with a comment calling it "the player's formula"; they had drifted).
  - Overkill damage no longer BANKS. `effectiveDamage(f, amount)` caps a record at the HP held, mirroring the existing heal cap, applied in `core-events` `record-damage` and in the aura. Without it the floor would have hidden a worse bug: 100 damage on 60 HP then a heal of 20 left the player visibly at 0.
  - Consequence accepted by the human: damage chips show the EFFECTIVE amount, as heal chips already do.
  - RED first: 2 yaml scenarios (`damage-does-not-bank-below-zero`, `paladin-level7-aura-floors-hp`) + 2 unit tests in `hp-record-chips.test.ts`, all failing for the right reason before implementation. `make test` green after.

### Phase 9 - Reverted the fragile HP repairs (main agent + subagent)

Phases 7 and 8 are reverted (`eb6c685d`, `17f14990`). Both stored a CORRECTION inside an effect other than the one that caused the problem - the heal chip carried the overkill repair, the damage chip carried the credit clear - so dismissing a chip afterwards orphans the correction and HP comes out wrong again. Each fix traded one reachable wrong answer for another.

- [x] A two-counter ledger (record damage and healing as separate running totals, HP = max - (damage - healing)) was evaluated and REJECTED: the steed already works that way and has the identical bug - dismissing its damage chip leaves healing standing as pure credit.
- [x] Kept, both from Phase 6 and both safe because the correction lives in the effect that causes it: the `hp.current` floor (`currentHp`, shared by `hp.ts` and the steed) and the damage cap (`effectiveDamage`, a bare number, used by `record-damage` and the aura).
- [x] Reverted: `healableHp`, `bankedCredit`, the `{ effective, credit }` pair, the heal/hit-die repair, the steed credit fold, and 4 yaml scenarios (`heal-repairs-banked-overkill`, `damage-clears-banked-credit`, `damage-clears-credit-after-overkill-repair`, `steed-damage-clears-banked-credit`).
- [x] Kept from the revert: the `hit-dice-on-rest.test.ts` fixtures keep a real `hp.base.max`. Without it `hp.max` is 0 and the surviving damage cap reduces a damage record to 0, so the "caps the total at the missing HP" case asserted nothing.
- [x] **Known bugs, unchanged from `main`, to be raised SEPARATELY:** dismissing a damage chip after healing banks positive credit and the next damage does nothing; a character banked below zero cannot be healed. Both follow from `hp.modifier.current` being a summed fact over independently removable effects. The fix is an ordered-replay model, not another summed-fact patch - out of scope for this PR.

### Phase 10 - Dropped the damage cap; guarded the zero-damage concentration marker (main agent + subagent)

Post-review, decided by the human.

- [x] **`effectiveDamage` deleted.** The cap had the SAME flaw as the Phase 7/8 reverts: it baked an
      order-dependent value into an independently removable committed effect. Shown by: 12 max HP,
      record Damage 10 (chip -10, HP 2), record Damage 10 again (chip -2, HP 0), delete the FIRST
      chip -> HP reads 10, where only the second 10-point event should stand and it should read 2.
      `record-damage` (core-events) and `aura-of-the-guardian` now record the RAW amount in both the
      state delta and `display.value`, exactly as on `main`.
- [x] **`currentHp` is the sole surviving HP change** and is safe because it STORES NOTHING - a pure
      read over settled facts in the `hp.current` derive (and the steed's), not a value persisted in
      a chip. `builder.ts` now holds `currentHp` and no other HP helper.
- [x] **Overkill banking is back**, accepted and expected: `hp.modifier.current` goes below `-max`
      and a later heal can be swallowed. Nothing compensates for it - compensating is precisely what
      Phases 7-9 reverted. Tracked in #395 with the other summed-fact HP bugs.
- [x] Tests: deleted `damage-does-not-bank-below-zero` (it asserted the cap) and its
      `EXPECTED_RUNNABLE` entry; `paladin-level7-aura-floors-hp` keeps its floor assertions and drops
      the post-overkill heal step the cap had made work; the two cap cases left
      `hp-record-chips.test.ts`. The `hit-dice-on-rest.test.ts` fixtures keep a real `hp.base.max`,
      but the comment now gives the reason that survives the cap: `hp.max` 0 is a state no character
      reaches, and the healing under test would not be visible on the sheet.
- [x] **Zero-damage concentration guard.** `aura-of-the-guardian` advertised
      `concentration-damage-taken` whenever concentrating, so merely adding the row with the slider
      at its default 0 tripped a concentration check for nothing. `record-damage` had the identical
      unguarded block (pre-existing). Both now require `amount > 0`. RED first: extended
      `paladin-level7-aura-concentration` and `concentration-check-after-damage` with an amount-0
      step (fact 0, no `concentration-check` offer) plus a `removeFromPlan`, both failing
      `expected 1 to deeply equal +0` before the guard.
