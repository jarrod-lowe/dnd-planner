# Condition: Restrained

Wave 4 (conditions-remaining.md), S–M. Restrained REUSES the halted foundation (condition-grappled PR1: its effect writes `condition.restrained`, which movement's `character.movement.halted` derive already reads — zero movement.ts changes here) and lands the **save-recorder advantage wiring**: the 6 core-events save offers gain rules-driven disadvantage sources.

Record → keyed effect → notice chassis is prior art (condition-prone.md).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Restrained [Condition]** — While you have the Restrained condition, you experience the following effects.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.
> **Saving Throws Affected.** You have Disadvantage on Dexterity saving throws.

Modelled: record offer (imposed — free, ungated) + keyed effect (restrained fact + attack flags + DEX-save flag) + notice. Vs-you Advantage = notice text (prone precedent, no NPC modelling).

## Decisions (defaults — re-grill before execution)

- Halted reuse: effect writes `condition.restrained`; halted + `remaining` 0 + all move offers dying + Dash/Get-Up gates all come free from condition-grappled PR1. No movement.ts change.
- Attack flags: prone idiom — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage`, `stateCombine: 'max'` (armor derives them max; sum conflict-throws). ~~Greataxe's Cleave secondary control (greataxe.ts `actionUiExtra.secondaryControl`) has no mode source today — add it there too (test a mastery-enabled Cleave).~~ DONE via #447 (blinded wired the Cleave disadvantage source).
- `save.dex.disadvantage`: NEW fact; effect writes it with `stateCombine: 'max'` (no other writer today — armor precedent keeps future derivers conflict-free).
- **Save wiring**: core-events `saveOffer` `primaryControl` gains `advantage: { fact: `save.${a}.disadvantage` }` — CONTROL-level (skill-checks/attacks idiom), not per-die. PanelDiceLine ALREADY resolves a truthy `control.advantage` → default roll mode `'disadvantage'` (~line 202) — NO component change; disadvantage wiring exists, rules-driven advantage does not (that is Invisible's wave-6 work, not this). All 6 recorders gain it (one line each; the other 5 have no writers yet — dead wiring until they do).
- Wave-5 auto-fail saves are NOT this: auto-fail ≠ disadvantage — own semantic, stays notice-default (umbrella decision).
- Vs-you Advantage → notice text. Ending = umbrella default: `expiry: untilShortRest` + manual chip dismissal.

## Design

Module `src/lib/rules-engine/rules/condition-restrained.ts`, id `condition-restrained`; register `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-restrained.yaml`: translations, `requires: [movement]`, detail (SRD body verbatim, en-only) → `make publish-details`. Terraform seed `char_condition_restrained_rulegroup_seed` (dynamodb-items.tf); `make validate`. No search meta.

Effect: `{ id: 'effect-restrained', key: 'restrained', state: { 'condition.restrained': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1, 'save.dex.disadvantage': 1 }, stateCombine: { max on the 3 flags }, display: { name, detailKey: 'condition/restrained' }, expiry: { kind: 'untilShortRest' } }`.

Offers:

- `record-restrained`: section `free`, `detailKey: 'condition/restrained'` (the published SRD detail), `intents: { CONDITION: 'restrained' }`, no control, no gate (imposed)
- core-events.ts: `saveOffer` controls gain the `advantage` source (6 abilities)

Notice (while `condition.restrained > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-restrained.notice` (+ `.body`), `source` effect name, no `values`. en body: "Your Speed is 0 and can't increase. Attack rolls against you have Advantage, your attack rolls have Disadvantage, and you have Disadvantage on Dexterity saving throws."

i18n — keys ONLY (values at execution), BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json`, never the yaml; detail body en-only:

- `play.verbBuckets.CONDITION.restrained`
- `rule.dnd-5e-2024.condition-restrained.record-restrained.name`, `.effect-restrained.name`, `.notice`, `.notice.body`

Tests (RED first; register each in `EXPECTED_RUNNABLE`):

- `condition-restrained-record` — offer exists; after add: `condition.restrained` 1, `character.movement.halted` 1, `character.movement.remaining` 0, both attack flags 1, `save.dex.disadvantage` 1, notice exists/targets notice
- `condition-restrained-dex-save-disadvantage` — yaml asserts the FACT; the yaml grammar cannot assert control payloads or roller modes → unit test `tests/unit/rules-engine/condition-restrained-save.test.ts` (condition-prone-notice.test.ts pattern) pins all 6 save offers' `advantage` sources against evaluate output
- `condition-restrained-rest-clears` — short AND long → cleared, notice gone, flags 0, remaining restored

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

> FOLDED: PR1 + PR2 shipped as ONE PR by decision (the fold PR2 itself anticipated). The separate `condition-restrained-dex-save-disadvantage` yaml scenario was dropped — the unit test `condition-restrained-save.test.ts` pins all 6 control payloads (the yaml grammar cannot assert controls); the record scenario asserts the fact.

### PR1 — condition-restrained module (record, effect, notice, rest clear, seeds)

- [x] RED: `condition-restrained-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [x] `condition-restrained.ts`: `record-restrained` offer, keyed effect (all 4 facts), notice annotate
- [x] i18n both locales: `play.verbBuckets.CONDITION.restrained` + record/effect/notice keys
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details`
- [x] GREEN: record + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [x] terraform seed `char_condition_restrained_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod)

### PR2 — core-events save-recorder advantage wiring (folded into PR1 by decision)

- [x] RED: unit test `condition-restrained-save.test.ts` fails (save offers carry no `advantage` source) — the yaml leg dropped (see the fold note above; the fact is asserted in the record scenario)
- [x] core-events.ts `saveOffer`: `advantage: { fact: `save.${a}.disadvantage` }` on the 6 dice-line controls
- [x] GREEN; playwright: restrained → record a DEX save → dice-line defaults to disadvantage (per-die manual override still wins) — dev-server leg, see notes
- [ ] gates → PR → codex monitor → clean → `make deploy-test` → human inspects test env → human merges

## Out of scope

- vs-you Advantage mechanics (NPC-side — notice text)
- auto-fail save semantics (wave 5; ≠ disadvantage)
- escape-DC offers / source spells (web, entangle) — record only
- rules-driven ADVANTAGE sources (Invisible, wave 6 — extends PanelDiceLine; disadvantage-only here)

## Notes

- The 5 non-DEX save recorders gain the source with no writers — dead until leather-armor-style derivers or wave 5 land
- Halted means move offers die on BOTH `cannot_while_halted` and out-of-movement (remaining 0) — expected, shared diagnostic reads clearer
