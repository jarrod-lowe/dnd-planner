# Condition: Paralyzed

Wave-5 composition child (conditions-remaining.md) — S effort. DEPENDS on two foundations:
docs/plans/ideas/condition-incapacitated.md (composition contract: our effect writes
`condition.incapacitated: 1` DIRECTLY in its own effect state — no cross-module coupling) and
docs/plans/ideas/condition-grappled.md (`character.movement.halted`: movement.ts derives it from
`condition.{grappled,restrained,paralyzed,petrified,unconscious}` — our own fact feeds it automatically;
zero speed-0 code here).

Record offer → keyed effect (both condition facts) → notice carrying the SRD effects.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Paralyzed [Condition]** — While you have the Paralyzed condition, you experience the following effects.
> **Incapacitated.** You have the Incapacitated condition.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Automatic Critical Hits.** Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.

Modelled: record + keyed composition effect + notice. Auto-fail saves / vs-you Advantage / auto-crit = notice text. Speed-0 via halted.

## Decisions (defaults — re-grill before execution)

- Composition (incapacitated doc contract): ONE effect writes BOTH `condition.paralyzed: 1` AND `condition.incapacitated: 1` in its own state; both facts die with the effect. `condition.incapacitated` carries `stateCombine: 'max'` — mandatory, not stylistic: `effect-incapacitated` writes it `max` and sheet.ts THROWS on conflicting combine modes when standalone Incapacitated co-stands (default-sum child effect = engine error). Recorder apply ALSO invokes the shared concentration-break helper (contract clause 2 — the fact alone is offer-inert and does not evict a held spell; SRD Paralyzed includes Incapacitated → "No Concentration").
- Speed 0: not modelled here — `character.movement.halted` (grappled doc) derives from `condition.paralyzed`; movement.ts owns it. All move offers die on it; walk-illegal scenario pins.
- Auto-fail STR/DEX saves: notice text (umbrella default). Even if Restrained's save-disadvantage wiring landed: auto-fail ≠ disadvantage — its own future semantic, not this PR.
- Vs-you Advantage + auto-crit within 5 ft: notice text (NPC-side; prone precedent — no NPC modelling).
- Recorder `record-paralyzed`: free, ungated (imposed by an enemy effect — record-prone precedent); record-\* carries name only. Ending: umbrella default — `expiry: untilShortRest` (long includes short) + ActiveStateStrip chip dismissal; no end offer (SRD gives none — the source effect ends it).
- Surprised INHERITS: `initiative.disadvantage` derives from `condition.incapacitated` (incapacitated doc's Surprised decision) — children write the fact, never the flag; nothing to add here. Scenario `condition-paralyzed-initiative-disadvantage` (paralyzed → flag 1) pins the inheritance.
- `hold-person.ts` cross-ref: OUR spell imposing Paralyzed on OTHERS (`holdPerson.active` marker, its own notice) — no overlap with this self-condition tracking; no fact collision.
- PR: one per condition OR one shared PR for the trio (near-identical) — executing agent's call; docs stay standalone.

## Design

Module `src/lib/rules-engine/rules/condition-paralyzed.ts`, id `condition-paralyzed`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-paralyzed.yaml`: translations, `requires: [movement]` (halted derive + walk-illegal legality), detail (SRD text, body en-only) → `make publish-details`. No search meta (chassis sibling).

Facts (both written ONLY by the committed effect, prone pattern): `condition.paralyzed` (movement.ts halted reads it) + `condition.incapacitated` (written directly — composition contract).

Effects:

- paralyzed: `{ id: 'effect-paralyzed', key: 'paralyzed', state: { 'condition.paralyzed': 1, 'condition.incapacitated': 1 }, stateCombine: { 'condition.incapacitated': 'max' }, display: { name }, expiry: { kind: 'untilShortRest' } }`

Offers:

- `record-paralyzed`: section `free`, `intents: { CONDITION: 'paralyzed' }`, no control, no gate

Notice (annotate while `condition.paralyzed > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-paralyzed.notice` (+ `.body`), `source` effect name. No `values` (nothing interpolates).
en body sketch: "You are Incapacitated and your Speed is 0. You automatically fail STR and DEX saving throws. Attack rolls against you have Advantage, and any hit is a Critical Hit if the attacker is within 5 ft."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh normal casing, invented values — execution-time):

- `play.verbBuckets.CONDITION.paralyzed` (`play.verbs.CONDITION` exists since prone PR1)
- `rule.dnd-5e-2024.condition-paralyzed.record-paralyzed.name`, `.effect-paralyzed.name`, `.notice`, `.notice.body`

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-paralyzed-record` (facts paralyzed 1 + incapacitated 1 + halted 1, notice exists)
- `condition-paralyzed-breaks-concentration` (bless stack, the incapacitated doc's shape): hold live → record → hold evicted — the composition recorder invokes the break helper
- `condition-paralyzed-initiative-disadvantage` (record → `initiative.disadvantage` 1 — the Surprised inheritance pin; siblings inherit identically)
- `move-walk-illegal-while-paralyzed` (halted: move offers illegal with the grappled-doc halted diagnostic; species-human + movement + this group — walk-illegal-while-prone shape)
- `condition-paralyzed-rest-clears` (short AND long → both facts 0, notice gone)

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

### PR1 — condition-paralyzed module (record, composition effect, notice, rest clear, seeds)

- [ ] RED: `condition-paralyzed-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-paralyzed.ts`: `record-paralyzed` offer, keyed composition effect, notice annotate
- [ ] i18n keys above, both locales
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details`
- [ ] GREEN: record + walk-illegal + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_paralyzed_rulegroup_seed` (dynamodb-items.tf); `make validate`
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge; `make deploy-test` — executing agent never merges

## Out of scope

- auto-fail save flags (own future semantic; Restrained's disadvantage wiring ≠ auto-fail)
- vs-you Advantage / auto-crit enforcement (NPC-side — notice text only)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- Halted fact name + derive list pinned by condition-grappled.md — if that doc renamed anything, update before execution.
- Stunned (trio sibling) has NO Speed-0 clause — its doc records the one place the trio boilerplate diverges.
