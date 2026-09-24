# Condition: Frightened

Fifth condition on the prone chassis: Frightened. Same fact footprint as Poisoned (attack flags + 18 skill flags); the two divergences — line-of-sight qualifier, can't-approach — land as notice text (player judgement). See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: same flags as Poisoned. Line-of-sight qualifier + can't-approach = notice text (player judgement; prone simplification precedent — see Decision defaults).

## Decisions (defaults — re-grill before execution)

- **GRILL POINT — line of sight.** Default: **standing disadvantage** — flags always on while the condition is live; notice carries the qualifier; per-die override on the rollers covers the source-not-visible case. Alternative: a toggle ("source in line of sight?" legality/offer suppressing the flags) — rejected: new chassis (facts conditional on a player-asserted sub-state) for one condition, and the board has no source-position model to verify against. Prone simplification precedent: model the common case, surface the exception as text. Recommend standing.
- Attack + ability-check Disadvantage: exactly Poisoned's writes — `attack.str/dex.disadvantage` + all 18 `skill.{skill}.disadvantage` + `initiative.disadvantage` (Initiative is a Dexterity ability check; `roll-initiative` reads the fact — leather-armor precedent) + `check.disadvantage` (the generic `record-check` roller in core-events gains `advantage: { fact }` — see Poisoned), `stateCombine: 'max'` on every flag (armor conflict-throw; stacked-with-Poisoned flag summing). Poisoned's Cleave note applies identically (greataxe's Cleave secondary control needs the source too).
- Can't-willingly-approach: **notice text only** — enforcing "closer to the source" needs source position (NPC side, no modelling); player judgement.
- Ending: umbrella default — `expiry: untilShortRest` (prone deviation; SRD ties duration to the fear source, which we don't model) + ActiveStateStrip chip dismissal.
- Recorder `record-frightened` ("Frightened"): free, ungated, imposed by an enemy effect (knocked-prone shape).
- Group `requires: []`.
- Detail body: SRD verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-frightened.ts`, id `condition-frightened`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-frightened.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/frightened`, source `srd52`, body en-only) → `make publish-details`. No search meta.

Facts:

- `condition.frightened` — 1 while frightened; written ONLY by the committed effect
- `attack.str.disadvantage`, `attack.dex.disadvantage`, `skill.{skill}.disadvantage` ×18, `initiative.disadvantage`, `check.disadvantage` — flags

Effect (loop the module-local SKILLS const, Poisoned shape):

- `{ id: 'effect-frightened', key: 'frightened', state: { 'condition.frightened': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1, 'initiative.disadvantage': 1, 'check.disadvantage': 1, …`skill.${s}.disadvantage`: 1 ×18 }, stateCombine: 'max' on all 22 flags, display: { name, detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }`

Offer:

- `record-frightened`: section `free`, `intents: { CONDITION: 'frightened' }`, `detailKey: 'condition/frightened'`, no control, no gate, `actionCost: []`; apply advertises the effect

Notice (annotate while `condition.frightened > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-frightened.notice` (+ `.body`), `source` effect name. No `values`.
en body: "Disadvantage on attack rolls and ability checks while the source of fear is within line of sight (applied always while Frightened — override a die when it isn't). You can't willingly move closer to the source of fear."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented at execution, normal casing — do not invent now):

- `rule.dnd-5e-2024.condition-frightened.record-frightened.name`
- `rule.dnd-5e-2024.condition-frightened.effect-frightened.name`
- `rule.dnd-5e-2024.condition-frightened.notice`, `.notice.body`
- `play.verbBuckets.CONDITION.frightened`

Tests (RED first — registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-frightened-record` (condition fact + attack flags + `initiative.disadvantage` + `check.disadvantage` + notice exists; Poisoned's `record-check` wiring pin covers the shared control — no duplicate needed here)
- `condition-frightened-rest-clears` (short AND long → cleared, notice gone; co-load `core-events`)
- `condition-frightened-skill-flags` — Poisoned's shape: co-load `leather-armor` untrained; assert attack flags + 2–3 representative skills (`athletics`, `stealth` armor-derived; `perception` not), not all 18; no combine-conflict throw
- optional green-immediate pin: `condition-frightened-with-poisoned` — both recorded → flags still 1 (the uniform-`max` dividend)

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

### PR1 — condition-frightened module (record, effect, notice, rest clear, seed)

- [ ] RED: `condition-frightened-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-frightened.ts`: `record-frightened` offer, keyed frightened effect (22 facts, loop-built), notice annotate
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] i18n keys both locales
- [ ] GREEN: record + rest-clears + skill-flags scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_frightened_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod)

May share PR1 with Poisoned (same footprint). Docs stay standalone either way.

## Out of scope

- line-of-sight toggle / source-position modelling (standing disadvantage — Decision above)
- can't-willingly-approach movement enforcement (no source position; notice text)
- inflicting fear on others (fear spells — NPC state)
- wisdom-save fear effects recording the condition automatically (future spell work)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- `record-*` offers carry name only — no `.description` key (prone PR1 note)
- Same 22-flag loop as Poisoned — copy, don't share (module-local consts; share only if a third appears)
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent)
