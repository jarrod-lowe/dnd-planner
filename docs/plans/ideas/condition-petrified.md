# Condition: Petrified

Wave-5 composition child (conditions-remaining.md) — S effort. DEPENDS on two foundations:
docs/plans/ideas/condition-incapacitated.md (composition contract: our effect writes
`condition.incapacitated: 1` DIRECTLY in its own effect state — no cross-module coupling) and
docs/plans/ideas/condition-grappled.md (`character.movement.halted`: movement.ts derives it from
`condition.{grappled,restrained,paralyzed,petrified,unconscious}` — our own fact feeds it automatically;
zero speed-0 code here).

Record offer → keyed effect (both condition facts) → notice carrying the SRD effects (incl. resist-all + poison-immunity as notice text).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Petrified [Condition]** — While you have the Petrified condition, you experience the following effects.
> **Turned to Inanimate Substance.** You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging.
> **Incapacitated.** You have the Incapacitated condition.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Resist Damage.** You have Resistance to all damage.
> **Poison Immunity.** You have Immunity to the Poisoned condition.

Modelled: record + keyed composition effect + notice. Turned-to-stone / auto-fail saves / vs-you Advantage / resist-all / poison-immunity = notice text. Speed-0 via halted.

## Decisions (defaults — re-grill before execution)

- Composition (incapacitated doc contract): ONE effect writes BOTH `condition.petrified: 1` AND `condition.incapacitated: 1` in its own state; both facts die with the effect. `condition.incapacitated` carries `stateCombine: 'max'` — mandatory, not stylistic: `effect-incapacitated` writes it `max` and sheet.ts THROWS on conflicting combine modes when standalone Incapacitated co-stands (default-sum child effect = engine error). Recorder apply ALSO invokes the shared concentration-break helper (contract clause 2 — the fact alone is offer-inert and does not evict a held spell; SRD Petrified includes Incapacitated → "No Concentration").
- Speed 0: not modelled here — `character.movement.halted` (grappled doc) derives from `condition.petrified`; movement.ts owns it. All move offers die on it; walk-illegal scenario pins.
- Auto-fail STR/DEX saves: notice text (umbrella default). Even if Restrained's save-disadvantage wiring landed: auto-fail ≠ disadvantage — its own future semantic, not this PR.
- Vs-you Advantage + turned-to-stone flavour (weight ×10, cease aging): notice text (NPC-side/player flavour; prone precedent — no NPC modelling).
- Resist-all-damage: notice text — no resistance modelling exists; damage recorder is free-entry, player halves themselves (umbrella global out-of-scope).
- **Poison-immunity grill (unique to Petrified):** a Poisoned condition effect standing when Petrified is recorded — SHOULD recording evict it? SRD glossary Immunity: "doesn't affect you in any way". Default: notice text only, NO auto-eviction (condition immunities are global out-of-scope; future idea). Re-grill.
- Recorder `record-petrified`: free, ungated (imposed by an enemy effect — record-prone precedent); record-\* carries name only. Ending: umbrella default — `expiry: untilShortRest` (long includes short) + ActiveStateStrip chip dismissal; no end offer (SRD gives none — the source effect ends it).
- PR: one per condition OR one shared PR for the trio (near-identical) — executing agent's call; docs stay standalone.

## Design

Module `src/lib/rules-engine/rules/condition-petrified.ts`, id `condition-petrified`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-petrified.yaml`: translations, `requires: [movement, condition-incapacitated]` (movement: halted derive + walk-illegal legality; the PARENT group self-heal-loads the Surprised derive + break helper — without it a petrified-only character keeps acting and rolls Initiative unflagged; action-economy/attacks clamps are baseline), detail (SRD text, body en-only) → `make publish-details`. No search meta (chassis sibling).

Facts (both written ONLY by the committed effect, prone pattern): `condition.petrified` (movement.ts halted reads it) + `condition.incapacitated` (written directly — composition contract).

Effects:

- petrified: `{ id: 'effect-petrified', key: 'petrified', state: { 'condition.petrified': 1, 'condition.incapacitated': 1 }, stateCombine: { 'condition.incapacitated': 'max' }, display: { name }, expiry: { kind: 'untilShortRest' } }`

Offers:

- `record-petrified`: section `free`, `detailKey: 'condition/petrified'` (the published SRD detail), `intents: { CONDITION: 'petrified' }`, no control, no gate

Notice (annotate while `condition.petrified > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-petrified.notice` (+ `.body`), `source` effect name. No `values` (nothing interpolates).
en body sketch: "You are turned to stone: Incapacitated, Speed 0, weight ×10. Attack rolls against you have Advantage. You automatically fail STR and DEX saving throws. You have Resistance to all damage and Immunity to the Poisoned condition."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh normal casing, invented values — execution-time):

- `play.verbBuckets.CONDITION.petrified` (`play.verbs.CONDITION` exists since prone PR1)
- `rule.dnd-5e-2024.condition-petrified.record-petrified.name`, `.effect-petrified.name`, `.notice`, `.notice.body`

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-petrified-record` (facts petrified 1 + incapacitated 1 + halted 1, notice exists)
- `condition-petrified-breaks-concentration` (bless stack, the incapacitated doc's shape): hold live → record → hold evicted — the composition recorder invokes the break helper
- `move-walk-illegal-while-petrified` (halted: move offers illegal with the grappled-doc halted diagnostic; species-human + movement + this group — walk-illegal-while-prone shape)
- `condition-petrified-rest-clears` (short AND long → both facts 0, notice gone)
- `condition-petrified-with-incapacitated` — both recorded → no combine-conflict throw, `condition.incapacitated` 1 (the max-combine overlap pin — paralyzed's scenario names the pattern)

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing each module
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make validate-rules-schema` (new rule-group YAML), `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push; full `make test` before declaring done
- Per rule-group change: `make publish-details`; `make sync-rule-groups` then `make deploy-test` (sync alone insufficient — CDN); terraform seed per new group (`dynamodb-items.tf`), `make validate`
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); every comment gets fixed or a reasoned won't-fix reply; until reviews + pipelines clean; agent never merges
- i18n: BOTH locales (`en` + `en-x-tlh` invented values, normal casing); `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back); `play.verbBuckets.CONDITION.<name>` per condition
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — condition-petrified module (record, composition effect, notice, rest clear, seeds)

- [ ] RED: `condition-petrified-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-petrified.ts`: `record-petrified` offer, keyed composition effect, notice annotate
- [ ] i18n keys above, both locales
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details`
- [ ] GREEN: record + walk-illegal + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_petrified_rulegroup_seed` (dynamodb-items.tf); `make validate`
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge; `make deploy-test` — executing agent never merges

## Out of scope

- auto-fail save flags (own future semantic; Restrained's disadvantage wiring ≠ auto-fail)
- vs-you Advantage enforcement (NPC-side — notice text only)
- damage Resistance halving (damage recorder is free-entry — player halves themselves)
- auto-eviction of a standing Poisoned effect on record (condition immunities — future idea; see grill default above)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- Halted fact name + derive list pinned by condition-grappled.md — if that doc renamed anything, update before execution.
- Surprised inherits via the incapacitated derive (`initiative.disadvantage` reads the composed fact) — nothing to write here; paralyzed's pin scenario covers the family.
- Recording an immunity ≠ enforcing it — the no-eviction default mirrors the umbrella's global "condition immunities" out-of-scope.
