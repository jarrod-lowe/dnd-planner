# Condition: Frightened

The LAST of the 14 — wave-2's deferred straggler. History: deferred over the line-of-sight qualifier; replanned 2026-09-25 around a LoS notice-button toggle (#461/#462) which was ABANDONED (#462 reverted in #464, #463 closed superseded). **User-directed 2026-09-29: assume the source of fear is always within line of sight** — the qualifier is satisfied by assumption, the flags are STANDING, and mechanising LoS is a deferred follow-up PR. Poisoned's exact chassis. See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: Poisoned's full flag set as STANDING flags (22, uniform `stateCombine: 'max'`) under the always-LoS assumption; can't-approach = notice text (no source-position model).

## Decisions (defaults — re-grill before execution)

- **LoS: assumed always (user-directed 2026-09-29)** — standing flags, no toggles, no derives, no UI work. SUPERSEDES both the 2026-09-25 notice-button toggle replan (abandoned: #462 reverted, #463 closed) and the pre-replan per-die-override idea. Notice/detail copy KEEPS the SRD-verbatim sight qualifier — text ahead of mechanics; the deferred LoS PR makes behavior catch up.
- Flag set + `stateCombine: 'max'` loop: EXACTLY Poisoned's (22 flags — attack.str/dex, `initiative.disadvantage`, `check.disadvantage`, 18 skills); local `SKILLS` const (confinement rule; share only if a third appears). Zero roller work — every fact already has readers (Poisoned's PR wired them, incl. Cleave/Alert secondaries).
- Can't-willingly-approach: notice text only — enforcing "closer to the source" needs source position (NPC side, no modelling).
- Ending: umbrella default — `expiry: untilShortRest` (any rest) + ActiveStateStrip chip dismissal; SRD gives no mechanical end → no end offer.
- Recorder `record-frightened` ("Frightened"): free, ungated, imposed by an enemy effect (knocked-prone shape).
- Group `requires: []`.
- Detail body: SRD verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-frightened.ts`, id `condition-frightened`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-frightened.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/frightened`, source `srd52`, body en-only) → `make publish-details`. No search meta.

Facts:

- `condition.frightened` — 1 while frightened; written ONLY by the committed effect
- `attack.str.disadvantage`, `attack.dex.disadvantage`, `skill.{skill}.disadvantage` ×18, `initiative.disadvantage`, `check.disadvantage` — flags

Effect (loop `SKILLS`, both maps built in one pass):

- `{ id: 'effect-frightened', key: 'frightened', state: { 'condition.frightened': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1, 'initiative.disadvantage': 1, 'check.disadvantage': 1, …`skill.${s}.disadvantage`: 1 for each of 18 }, stateCombine: 'max' on all 22 flags, display: { name, detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }`

Offer:

- `record-frightened`: section `free`, `intents: { CONDITION: 'frightened' }`, `detailKey: 'condition/frightened'`, no control, no gate, `actionCost: []`; apply advertises the effect

Notice (annotate while `condition.frightened > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-frightened.notice` (+ `.body`), `source` effect name. No `values`.
en body: "You have Disadvantage on attack rolls and ability checks while the source of fear is within line of sight. You can't willingly move closer to the source of fear." — BOTH sentences (can't-approach lives here).

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented at execution, normal casing):

- `rule.dnd-5e-2024.condition-frightened.record-frightened.name`
- `rule.dnd-5e-2024.condition-frightened.effect-frightened.name`
- `rule.dnd-5e-2024.condition-frightened.notice`, `.notice.body`
- `play.verbBuckets.CONDITION.frightened`

Tests (RED first — registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-frightened-record` (condition fact + ALL 22 flags — full-set assert is the typo guard for a cloned list, replaces a unit test — + notice exists/targets)
- `condition-frightened-skill-flags` — co-load `leather-armor` untrained; shared flags stay 1 (athletics/stealth armor-derived, perception condition-only)
- `condition-frightened-with-poisoned` — both recorded, shared flags 1 not 2 (the max dividend; replaces poisoned-with-blinded as the wave-2 stacking pair now both exist)
- `condition-frightened-rest-clears` (short AND long → cleared, notice gone; co-load `core-events`)

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

- [x] RED: 4 scenarios fail — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE` (451 vs 455, exactly the four names)
- [x] `condition-frightened.ts`: `record-frightened` offer, keyed frightened effect (22 flags, loop-built), notice annotate
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [x] i18n keys both locales
- [x] GREEN: all 4 scenarios + `EXPECTED_RUNNABLE`
- [x] terraform seed `char_condition_frightened_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → close #463 (superseded) → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod) — on branch `condition-frightened`

## Out of scope

- **LoS qualifier mechanisation** — the deferred follow-up (user-directed 2026-09-29); when it lands, the standing flags become conditional on sight state
- can't-approach movement enforcement (no source position; notice text)
- source IDENTITY (which creature frightened you — one undifferentiated condition)
- inflicting fear on others (fear spells — NPC state)
- wisdom-save fear effects recording the condition automatically (future spell work)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- Abandoned approach (do not resurrect as-is): settings-chassis toggle (settings are build-time), notice-button LoS toggle (#461–#463 — UI chassis reverted; re-derive from first principles if LoS work resumes)
- Poisoned's Cleave note applies identically (greataxe's Cleave secondary reads the attack flags — already wired)
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent)
