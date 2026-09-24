# Condition: Deafened

Add Deafened — wave 1 of the conditions umbrella (docs/plans/ideas/conditions-remaining.md); prior art docs/plans/ideas/condition-prone.md. Pure bookkeeping (XS): record offer → keyed committed effect (`condition.deafened`) → notice. Sole effect display-only (auto-fail hearing checks — skill offers are display-only) → notice text; effect writes NOTHING else.

Umbrella flags Deafened XS, batch with Charmed — pair may ship as ONE PR; this doc stays standalone.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Deafened [Condition]** — While you have the Deafened condition, you experience the following effect.
> **Can't Hear.** You can't hear and automatically fail any ability check that requires hearing.

Modelled: record + effect (`condition.deafened`) + notice. Auto-fail hearing checks = notice text (skill offers are display-only).

## Decisions (defaults — re-grill before execution)

- Adopt umbrella Decision defaults; NO open mechanical questions — pure bookkeeping.
- Sole effect display-only → notice text only; effect writes ONLY `condition.deafened: 1`. No disadvantage flags, no other facts.
- Ending: umbrella default — `expiry: untilShortRest` (long rest includes short) + manual ActiveStateStrip chip dismissal. SRD gives no mechanical end → no end offer.
- Recorder free + ungated — enemies impose it (prone "Knocked Prone" precedent).

## Design

Module `src/lib/rules-engine/rules/condition-deafened.ts`, id `condition-deafened`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-deafened.yaml`: translations both locales (name/description/keywords), `requires: []` (unlike prone, reads nothing — keep minimal), detail key `condition/deafened` (SRD body, en-only) → `make publish-details`.

Facts:

- `condition.deafened` — 1 while deafened; written ONLY by the committed effect; notice reads it

Effect:

- `{ id: 'effect-deafened', key: 'deafened', state: { 'condition.deafened': 1 }, display: { name, detailKey: 'condition/deafened' }, expiry: { kind: 'untilShortRest' } }` — no `stateCombine` (own fact only; prone's max-combine was for shared attack flags). Effect `detailKey` rides the `EffectDisplay.detailKey` bridge — landed with the FIRST condition slice (wave 1; Charmed's doc carries the PR item)

Offer:

- `record-deafened`: section `free`, name + `detailKey: 'condition/deafened'`, `intents: { CONDITION: 'deafened' }`, `actionCost: []`, no `when`/`legalWhen` (imposed)

Notice (annotate while `condition.deafened > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-deafened.notice` (+ `.body`), `source` `…effect-deafened.name`, no `values` (nothing live to interpolate).
en body: "You can't hear and automatically fail any ability check that requires hearing."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh execution-time: invented values, normal casing — do NOT pre-invent here):

- `play.verbBuckets.CONDITION.deafened` (verb CONDITION landed prone PR1 — bucket only)
- `rule.dnd-5e-2024.condition-deafened.record-deafened.name`, `.effect-deafened.name`, `.notice`, `.notice.body`
- detail body en-only (tlh falls back)

Tests (RED first — yaml scenario asserts are the RED for rule changes; register via `EXPECTED_RUNNABLE` in `tests/integration/rules-engine/yaml-scenarios.test.ts`):

- `condition-deafened-record` — record → `condition.deafened: 1`, notice present (targets notice); pre-record: fact 0, notice absent
- `condition-deafened-rest-clears` — short AND long rest → fact 0, notice gone
- verb-bucket plumbing covered by `intent-bucket-coverage` (both locales)

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

### PR1 — condition-deafened (record, effect, notice, rest clear, seed)

May ship batched with condition-charmed as ONE PR (umbrella waves the pair); docs standalone.

- [x] RED: `condition-deafened-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [x] `condition-deafened.ts`: `record-deafened` offer, keyed deafened effect, notice annotate
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [x] i18n keys (list above), both locales
- [x] GREEN: record + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [x] terraform seed `char_condition_deafened_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod) — batched with Charmed on branch `condition-charmed-deafened`; awaiting review

## Out of scope

- mechanical auto-fail on hearing ability checks (skill offers display-only — player judgement)
- hearing-gated mechanics beyond the notice (per-spell "must be able to hear" — unmodelled)
- backfilling seeded groups to pre-existing characters (umbrella global limitation)

## Notes

- record-\* offers carry name only — no `.description` key (prone precedent)
- effect key `deafened` matches fact suffix — empty same-key effect eviction stays available if a future end offer appears
