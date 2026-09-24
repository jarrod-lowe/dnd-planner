# Condition: Charmed

Add Charmed — wave 1 of the conditions umbrella (docs/plans/ideas/conditions-remaining.md); prior art docs/plans/ideas/condition-prone.md. Pure bookkeeping (XS): record offer → keyed committed effect (`condition.charmed`) → notice. Both SRD effects NPC-side → notice carries them as text; effect writes NOTHING else.

Umbrella flags Charmed ⅓ PR, batch with Deafened — pair may ship as ONE PR; this doc stays standalone.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Charmed [Condition]** — While you have the Charmed condition, you experience the following effects.
> **Can't Harm the Charmer.** You can't attack the charmer or target the charmer with damaging abilities or magical effects.
> **Social Advantage.** The charmer has Advantage on any ability check to interact with you socially.

Modelled: record offer + keyed effect (`condition.charmed`) + notice. Both effects NPC-side → notice text only.

## Decisions (defaults — re-grill before execution)

- Adopt umbrella Decision defaults; NO open mechanical questions — pure bookkeeping.
- Both effects NPC-side → notice text only; effect writes ONLY `condition.charmed: 1`. No disadvantage flags, no other facts.
- Ending: umbrella default — `expiry: untilShortRest` (long rest includes short) + manual ActiveStateStrip chip dismissal. SRD gives no mechanical end (charm-end triggers are per-spell) → no end offer.
- Recorder free + ungated — enemies impose it (prone "Knocked Prone" precedent).

## Design

Module `src/lib/rules-engine/rules/condition-charmed.ts`, id `condition-charmed`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-charmed.yaml`: translations both locales (name/description/keywords), `requires: []` (unlike prone, reads nothing — keep minimal), detail key `condition/charmed` (SRD body, en-only) → `make publish-details`.

Facts:

- `condition.charmed` — 1 while charmed; written ONLY by the committed effect; notice reads it

Effect:

- `{ id: 'effect-charmed', key: 'charmed', state: { 'condition.charmed': 1 }, display: { name }, expiry: { kind: 'untilShortRest' } }` — no `stateCombine` (own fact only; prone's max-combine was for shared attack flags)

Offer:

- `record-charmed`: section `free`, name + `detailKey: 'condition/charmed'`, `intents: { CONDITION: 'charmed' }`, `actionCost: []`, no `when`/`legalWhen` (imposed)

Notice (annotate while `condition.charmed > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-charmed.notice` (+ `.body`), `source` `…effect-charmed.name`, no `values` (nothing live to interpolate).
en body: "You can't attack the charmer or target the charmer with damaging abilities or magical effects. The charmer has Advantage on any ability check to interact with you socially."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh execution-time: invented values, normal casing — do NOT pre-invent here):

- `play.verbBuckets.CONDITION.charmed` (verb CONDITION landed prone PR1 — bucket only)
- `rule.dnd-5e-2024.condition-charmed.record-charmed.name`, `.effect-charmed.name`, `.notice`, `.notice.body`
- detail body en-only (tlh falls back)

Tests (RED first — yaml scenario asserts are the RED for rule changes; register via `EXPECTED_RUNNABLE` in `tests/integration/rules-engine/yaml-scenarios.test.ts`):

- `condition-charmed-record` — record → `condition.charmed: 1`, notice present (targets notice); pre-record: fact 0, notice absent
- `condition-charmed-rest-clears` — short AND long rest → fact 0, notice gone
- verb-bucket plumbing covered by `intent-bucket-coverage` (both locales)

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

### PR1 — condition-charmed (record, effect, notice, rest clear, seed)

May ship batched with condition-deafened as ONE PR (umbrella waves the pair); docs standalone.

- [ ] RED: `condition-charmed-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-charmed.ts`: `record-charmed` offer, keyed charmed effect, notice annotate
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] i18n keys (list above), both locales
- [ ] GREEN: record + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_charmed_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge (executing agent never merges) → `make sync-rule-groups` + `make deploy-test`

## Out of scope

- can't-harm-the-charmer enforcement (charmer identity unmodelled — no target facts)
- Social Advantage (the charmer's rolls — NPC-side)
- charm-end triggers (per-spell SRD; rest + chip only)
- backfilling seeded groups to pre-existing characters (umbrella global limitation)

## Notes

- record-\* offers carry name only — no `.description` key (prone precedent)
- effect key `charmed` matches fact suffix — empty same-key effect eviction stays available if a future end offer appears
