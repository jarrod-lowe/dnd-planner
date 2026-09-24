# Condition: Blinded

Third condition on the prone chassis (record offer → keyed effect → notice): Blinded. Prone-minus-movement — the attack-disadvantage flags, nothing else mechanical. Part of the disadvantage-flags trio (Poisoned, Frightened); see conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Blinded [Condition]** — While you have the Blinded condition, you experience the following effects.
> **Can't See.** You can't see and automatically fail any ability check that requires sight.
> **Attacks Affected.** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.

Modelled: prone-minus-movement — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage` (`stateCombine: 'max'`, the prone idiom; weapon/unarmed dice-lines already read them). Sight auto-fail + attacks-vs-you = notice text.

## Decisions (defaults — re-grill before execution)

- Our-attack Disadvantage: **set mechanically**, exact prone idiom — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage`, both `stateCombine: 'max'` (armor modules derive the same facts `combine: 'max'`; default `sum` on the effect write would conflict-throw for armored characters). Weapon/unarmed rollers default 2d20-take-low; per-die override stays. No spell-attack offers exist yet. Custom secondary dice-lines: greataxe's Cleave control (greataxe.ts `actionUiExtra.secondaryControl`) carries NO disadvantage source today — the WeaponDef/diceControl wiring reaches primary controls only — add the source there too (test a mastery-enabled Cleave roll).
- Can't-see auto-fail (sight-requiring checks): **notice text only** — skill offers are display-only (Deafened precedent); player applies the auto-fail.
- Attacks vs you Advantage: **notice text only** — NPC side, never modelled (prone precedent).
- Ending: umbrella default — `expiry: untilShortRest` (long includes short; prone deviation) + ActiveStateStrip chip dismissal. SRD gives no mechanical end.
- Recorder `record-blinded` ("Blinded"): free, ungated, imposed by an enemy effect (knocked-prone shape) — always legal.
- Group `requires: []` — nothing upstream needed (`movement` was prone-only, for Get Up).
- Detail body: SRD text verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-blinded.ts`, id `condition-blinded`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-blinded.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/blinded`, source `srd52`, body en-only) → `make publish-details`. No search meta (prone pattern).

Facts:

- `condition.blinded` — 1 while blinded; written ONLY by the committed effect
- `attack.str.disadvantage`, `attack.dex.disadvantage` — the prone flags, second writer

Effect:

- `{ id: 'effect-blinded', key: 'blinded', state: { 'condition.blinded': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1 }, stateCombine: { 'attack.str.disadvantage': 'max', 'attack.dex.disadvantage': 'max' }, display: { name, detailKey: 'condition/blinded' }, expiry: { kind: 'untilShortRest' } }` — effect `detailKey` rides the `EffectDisplay.detailKey` bridge (landed with the first condition slice, wave 1)

Offer:

- `record-blinded`: section `free`, `intents: { CONDITION: 'blinded' }`, `detailKey: 'condition/blinded'`, no control, no gate, `actionCost: []`; apply advertises the effect

Notice (annotate while `condition.blinded > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-blinded.notice` (+ `.body`), `source` effect name. No `values` (static body, unlike prone's cost).
en body: "You can't see and automatically fail any ability check that requires sight. Your attack rolls have Disadvantage. Attack rolls against you have Advantage."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented at execution, normal casing — do not invent now):

- `rule.dnd-5e-2024.condition-blinded.record-blinded.name`
- `rule.dnd-5e-2024.condition-blinded.effect-blinded.name`
- `rule.dnd-5e-2024.condition-blinded.notice`, `.notice.body`
- `play.verbBuckets.CONDITION.blinded` (verb + bucket exist since prone; only the bucket value is new)

Tests (RED first — yaml scenario asserts are the RED; registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-blinded-record` (facts 1/1/1 + notice exists)
- `condition-blinded-rest-clears` (short AND long → cleared, notice gone; co-load `core-events` for `record-short-rest`)
- `condition-blinded-attack-flags` — co-load `leather-armor` untrained: armor derives the same two facts `combine: 'max'`; blinded + armor → flags still 1, no combine-conflict throw. THE `stateCombine` regression test.

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

### PR1 — condition-blinded module (record, effect, notice, rest clear, seed)

- [x] RED: `condition-blinded-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [x] `condition-blinded.ts`: `record-blinded` offer, keyed blinded effect, notice annotate
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [x] i18n keys both locales
- [x] GREEN: record + rest-clears + attack-flags scenarios; `EXPECTED_RUNNABLE`
- [x] terraform seed `char_condition_blinded_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [x] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod) — merged as PR #447

## Out of scope

- attacks-vs-you Advantage (NPC side — notice text only)
- mechanical sight auto-fail (skill offers display-only)
- inflicting Blinded on others (NPC state)
- condition immunities (glossary "Immunity" — global out-of-scope)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- `record-*` offers carry name only — no `.description` key (prone PR1 note)
- Effect mirrors `proneEffect()` shape minus `condition.prone`'s movement entanglement — copy prone, drop Get Up/crawl
- Known limitation: seeded group self-heal (`requires: []`) needs the character recreated or forward-assignment (prone precedent)
