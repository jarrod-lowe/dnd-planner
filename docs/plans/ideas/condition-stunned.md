# Condition: Stunned

Wave-5 composition child (conditions-remaining.md) — S effort, the SMALLEST: no Speed-0 clause, no
damage riders. DEPENDS on one foundation: docs/plans/ideas/condition-incapacitated.md (composition
contract: our effect writes `condition.incapacitated: 1` DIRECTLY in its own effect state — no
cross-module coupling). No grappled dependency: SRD Stunned imposes no Speed 0, so
`character.movement.halted` never reads `condition.stunned` — movement unaffected.

Record offer → keyed effect (both condition facts) → notice carrying the SRD effects.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Stunned [Condition]** — While you have the Stunned condition, you experience the following effects.
> **Incapacitated.** You have the Incapacitated condition.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Attacks Affected.** Attack rolls against you have Advantage.

Modelled: record + keyed composition effect + notice. Auto-fail saves / vs-you Advantage = notice text. Movement untouched.

## Decisions (defaults — re-grill before execution)

- Composition (incapacitated doc contract): ONE effect writes BOTH `condition.stunned: 1` AND `condition.incapacitated: 1` in its own state; both facts die with the effect. `condition.incapacitated` carries `stateCombine: 'max'` — mandatory, not stylistic: `effect-incapacitated` writes it `max` and sheet.ts THROWS on conflicting combine modes when standalone Incapacitated co-stands (default-sum child effect = engine error). Recorder apply ALSO invokes the shared concentration-break helper (contract clause 2 — the fact alone is offer-inert and does not evict a held spell; SRD Stunned includes Incapacitated → "No Concentration").
- NO Speed 0: SRD Stunned has no such clause and sits outside halted's derive list (`condition.{grappled,restrained,paralyzed,petrified,unconscious}`) — walk stays LEGAL. The trio's `move-walk-illegal-while-*` scenario DOES NOT APPLY here (umbrella boilerplate overreach); do not write it.
- Auto-fail STR/DEX saves: notice text (umbrella default). Even if Restrained's save-disadvantage wiring landed: auto-fail ≠ disadvantage — its own future semantic, not this PR.
- Vs-you Advantage: notice text (NPC-side; prone precedent — no NPC modelling).
- Recorder `record-stunned`: free, ungated (imposed by an enemy effect — record-prone precedent); record-\* carries name only. Ending: umbrella default — `expiry: untilShortRest` (long includes short) + ActiveStateStrip chip dismissal; no end offer (SRD gives none — the source effect ends it).
- PR: one per condition OR one shared PR for the trio (near-identical) — executing agent's call; docs stay standalone.

## Design

Module `src/lib/rules-engine/rules/condition-stunned.ts`, id `condition-stunned`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-stunned.yaml`: translations, `requires: [condition-incapacitated]` (the PARENT group self-heal-loads the Surprised derive + break helper — without it a stunned-only character keeps acting and rolls Initiative unflagged; action-economy/attacks clamps are baseline; no movement dep — SRD Stunned has no Speed 0), detail (SRD text, body en-only) → `make publish-details`. No search meta (chassis sibling).

Facts (both written ONLY by the committed effect, prone pattern): `condition.stunned` (nothing else reads it yet) + `condition.incapacitated` (written directly — composition contract).

Effects:

- stunned: `{ id: 'effect-stunned', key: 'stunned', state: { 'condition.stunned': 1, 'condition.incapacitated': 1 }, stateCombine: { 'condition.incapacitated': 'max' }, display: { name, detailKey: 'condition/stunned' }, expiry: { kind: 'untilShortRest' } }`

Offers:

- `record-stunned`: section `free`, `detailKey: 'condition/stunned'` (the published SRD detail), `intents: { CONDITION: 'stunned' }`, no control, no gate

Notice (annotate while `condition.stunned > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-stunned.notice` (+ `.body`), `source` effect name. No `values` (nothing interpolates).
en body sketch: "You are Incapacitated. You automatically fail STR and DEX saving throws. Attack rolls against you have Advantage."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh normal casing, invented values — execution-time):

- `play.verbBuckets.CONDITION.stunned` (`play.verbs.CONDITION` exists since prone PR1)
- `rule.dnd-5e-2024.condition-stunned.record-stunned.name`, `.effect-stunned.name`, `.notice`, `.notice.body`

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-stunned-record` (facts stunned 1 + incapacitated 1, notice exists; optional assert `move-walk` still LEGAL — pins the no-halted divergence)
- `condition-stunned-breaks-concentration` (bless stack, the incapacitated doc's shape): hold live → record → hold evicted — the composition recorder invokes the break helper
- `condition-stunned-rest-clears` (short AND long → both facts 0, notice gone)
- `condition-stunned-with-incapacitated` — both recorded → no combine-conflict throw, `condition.incapacitated` 1 (the max-combine overlap pin — paralyzed's scenario names the pattern)

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing each module
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make validate-rules-schema` (new rule-group YAML), `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push; full `make test` before declaring done
- Per rule-group change: `make publish-details`; `make deploy-test` (includes sync-rule-groups; deploy also invalidates the CDN); terraform seed per new group (`dynamodb-items.tf`), `make validate`
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); every comment gets fixed or a reasoned won't-fix reply; until reviews + pipelines clean; agent never merges
- i18n: BOTH locales (`en` + `en-x-tlh` invented values, normal casing); `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back); `play.verbBuckets.CONDITION.<name>` per condition
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — condition-stunned module (record, composition effect, notice, rest clear, seeds)

- [x] RED: `condition-stunned-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [x] `condition-stunned.ts`: `record-stunned` offer, keyed composition effect, notice annotate
- [x] i18n keys above, both locales
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details`
- [x] GREEN: record + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [x] terraform seed `char_condition_stunned_rulegroup_seed` (dynamodb-items.tf); `make validate`
- [x] gates (`make check`, `make test-unit`, `make format-check`) → PR — executed as ONE trio PR with Paralyzed + Petrified (branch `condition-composition-trio`); codex monitor / deploy-test / human merge follow orchestrator cadence

## Out of scope

- auto-fail save flags (own future semantic; Restrained's disadvantage wiring ≠ auto-fail)
- vs-you Advantage enforcement (NPC-side — notice text only)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- The one trio divergence lives here: no halted, no walk-illegal scenario — SRD Stunned moves normally. If a reviewer expects parity with Paralyzed/Petrified, point at the SRD quote above.
- Surprised inherits via the incapacitated derive (`initiative.disadvantage` reads the composed fact) — nothing to write here; paralyzed's pin scenario covers the family.
- `requires: [condition-incapacitated]` — the parent group is a real rules dep (Surprised derive + break helper), not loader mechanics; no movement dep (no Speed 0).
