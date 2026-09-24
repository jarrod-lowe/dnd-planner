# Condition: Incapacitated

Wave 3 "the enabler" — the composition parent: Paralyzed/Petrified/Stunned (wave 5) and Unconscious (wave 7) docs ASSUME the contract defined here (their effects write `condition.incapacitated` directly). Four SRD effects: action denial (mechanical), concentration break (mechanical), Surprised (existing flag), Speechless (notice text).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Incapacitated [Condition]** — While you have the Incapacitated condition, you experience the following effects.
> **Inactive.** You can't take any action, Bonus Action, or Reaction.
> **No Concentration.** Your Concentration is broken.
> **Speechless.** You can't speak.
> **Surprised.** If you're Incapacitated when you roll Initiative, you have Disadvantage on the roll.

Modelled: record offer (imposed — free, ungated) → keyed effect setting `condition.incapacitated`; the module DERIVES `initiative.disadvantage` from the fact; action-economy/attacks derives read the condition fact; apply breaks a live concentration hold. Speechless = notice text. Ending = umbrella default (prone deviation: any rest clears).

## Decisions (defaults — re-grill before execution)

- **Knot 1 — action denial.** (a) effect writes `actions/bonusActions/reactions.spent: <sentinel>` — sum-combine adds to this turn's endOfTurn spends, and the condition effect's expiry (`untilShortRest`, NOT endOfTurn) keeps the denial standing across turns. Crude: chips read max−(real+sentinel) = negative; breaks the day any max exceeds the sentinel (a future action-surge raising `actions.max` silently re-enables). (b) `action-economy.ts` derives read `condition.incapacitated` → each `remaining` derives 0 while set. **RECOMMEND (b)**: foundational module reading a condition fact — dataflow-clean (ordering derives from the read), zero sentinel, and every dash-style gate (`actions.remaining > 0`), weapon/spell `costApply`, and extra-attack's grant go illegal FOR FREE. Grill: free-section offers stay legal (rest recorders, HI use — correct: not actions); movement untouched (Incapacitated ≠ Speed 0).
- **Follow-up attacks bypass the economy clamp (verified)**: attack offers' legality is `actions.remaining > 0 || attackAction.extraRemaining > 0` (attacks.ts unarmed, builder.ts weaponOffers, grapple/shove mirrors) — the OR's second leg keeps Extra Attack follow-ups legal after recording Incapacitated mid-Attack-action. Fix: the `attackAction.extraRemaining` derive (attacks.ts) clamps to 0 while `condition.incapacitated > 0` (the same read-the-fact clamp as the economy derives). SRD "Inactive" read conservatively (the started action's remaining swings stop); grill the permissive reading (finish the declared action). Scenario: first swing → record → follow-up illegal.
- **Knot 2 — concentration break.** Record apply, WHEN `concentration.spent > 0` (live hold), advertises the empty same-`key` (`CONCENTRATION_SPELL_KEY`) eviction — the concentration-broken/get-up clear idiom: while merely planned it replaces the hold in-fold (undo restores the spell), `expiry: permanent` once committed. Also `concentrationDamageMarkerClear()` (the recast precedent — a damage save owed against the dead hold is moot). Display REUSES `planner.concentration.broken` (existing key, correct regardless of who broke it — no new i18n). Conditional so recording with nothing held shows no phantom "Concentration broken" chip. Grill: unconditional advertise (harmless key-wise, visible chip-wise)? **Extract the conditional eviction + marker clear to a builder helper** (`proneEffect()` extraction precedent — no rule imports another rule): the composition children's recorders invoke the SAME helper — recording Paralyzed/Petrified/Stunned/Unconscious breaks a live hold too (their SRD text includes Incapacitated; the fact alone is offer-inert).
- **Surprised**: condition-incapacitated DERIVES `initiative.disadvantage` (`combine: 'max'`, value `condition.incapacitated > 0 ? 1 : 0`) — NOT an effect state write. Leather-armor derives the same fact `combine: 'max'` (modes agree). The derive makes the flag react to the COMPOSED fact: Paralyzed/Petrified/Stunned/Unconscious inherit Surprised for free (their effects write the fact, never the flag). Initiative dice-line already reads it; zero roller changes.
- **Speechless**: notice text only. Verbal-component spell legality = out of scope (noted below).
- **Composition contract (THIS DOC DEFINES IT) — TWO clauses.** (1) Fact: wave-5 children (Paralyzed/Petrified/Stunned) and Unconscious write `condition.incapacitated: 1` DIRECTLY in their own effect state (`stateCombine: 'max'` on that fact — multi-writer safe; `effect-incapacitated` writes it `max` too, and sheet.ts THROWS on conflicting combine modes, so no child may default it to sum), with NO cross-module import — the shared fact name IS the coupling. Readers gate `> 0`, never `=== 1`. A child's own eviction/clear removes its incapacitated contribution automatically (it lives in the child's effect state). (2) Concentration: a child's recorder invokes the shared break helper from Knot 2 — writing the fact does NOT evict a held spell (the break is offer-side apply logic, not fact-reactive). Without clause 2, recording Unconscious while concentrating leaves the spell live.
- Record offer: section `free`, `intents: { CONDITION: 'incapacitated' }`, no control, no gate (enemies impose it); name-only (record-\* precedent). Repeat records newest-wins-replace — never stacks.
- Ending: umbrella default — `expiry: untilShortRest` (prone deviation; long rest includes short) + manual ActiveStateStrip chip dismissal. No end-offer (SRD gives no mechanical self-end).

## Design

Module `src/lib/rules-engine/rules/condition-incapacitated.ts`, id `condition-incapacitated`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-incapacitated.yaml`: translations, NO `requires` (every read is baseline or absent-safe — action-economy/initiative are SEED#CHAR baseline; `concentration.spent` reads 0 without the concentration group), detail (`key: condition/incapacitated`, source srd52, body = SRD text above, en-only) → `make publish-details`. No search meta (foundational).

Facts:

- `condition.incapacitated` — >0 while incapacitated; written ONLY by committed effect state (this effect now; wave-5 children later)
- `initiative.disadvantage` — existing; condition-incapacitated derives 1 while the condition fact is set (covers composition children)
- `action-economy.ts`: the three `*.remaining` derives gain `condition.incapacitated > 0 ? 0 : max − spent`
- `attacks.ts`: the `attackAction.extraRemaining` derive gains the same clamp (follow-up attacks die with the action pool)
- `condition-incapacitated.ts` derive: `initiative.disadvantage` (above)

Effects:

- incapacitated: `{ id: 'effect-incapacitated', key: 'incapacitated', state: { 'condition.incapacitated': 1 }, stateCombine: { 'condition.incapacitated': 'max' }, display: { name, detailKey: 'condition/incapacitated' }, expiry: { kind: 'untilShortRest' } }` — the initiative flag moved to a derive (Surprised decision) so composition children inherit it
- concentration eviction (PR2, conditional in apply): `{ id: 'incapacitated-breaks-concentration', key: CONCENTRATION_SPELL_KEY, display: { name: 'planner.concentration.broken', section: 'other' }, expiry: { kind: 'permanent' } }` + `concentrationDamageMarkerClear()`

**Effect-chip detail access (bridge extension — mechanics; the PR itself rides the FIRST condition slice, wave 1, so no wave executes before it exists):** `EffectDisplay` has NO `detailKey` today and `effectInstanceToRule` (engineBridge.ts) copies only name/section/displayFact/value/subject — so the OFFER's `ui.detailKey` makes the PlanRow flippable but the ActiveStateStrip chip (the standing condition, post-End-Turn) cannot open the published rules. Extend the contract: `EffectDisplay.detailKey?: string`; the bridge copies it; EVERY condition effect carries `display: { name, detailKey: 'condition/<name>' }` (all 14 docs — umbrella standing rule). Component test: the committed chip exposes the detail.

Offers:

- `record-incapacitated`: as Decisions, `detailKey: 'condition/incapacitated'` (the published SRD detail — PlanRow/ActiveStateStrip load rules only via `ui.detailKey`); apply advertises [effect] (+ eviction pair when a hold is live)

Notice (annotate while `condition.incapacitated > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-incapacitated.notice` (+ `.body`), `source` effect name. Body carries all four effects (denial + concentration enforced; speechless + surprised-reminder player-side).

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh values invented at execution, normal casing):

- `play.verbBuckets.CONDITION.incapacitated`
- `rule.dnd-5e-2024.condition-incapacitated.record-incapacitated.name`, `.effect-incapacitated.name`, `.notice`, `.notice.body`

Detail body en-only (tlh falls back).

Tests (RED first — yaml scenario asserts are the RED for rule changes; register in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-incapacitated-record` (groups: condition-incapacitated + action-economy): facts `condition.incapacitated: 1`, `initiative.disadvantage: 1`, `actions/bonusActions/reactions.remaining: 0` + notice exists, targets [notice]
- `dash-illegal-while-incapacitated` (groups: + species-human/movement/dash): dash legal before, illegal after record
- `extra-attack-followup-illegal-while-incapacitated` (groups: + a weapon + attacks): first swing legal, record, follow-up illegal — the `extraRemaining` clamp leg
- `concentration-broken-on-record` (bless stack, bless-concentration-replacement shape): prepare+cast bless → `concentration.spent: 1`, endTurn (effect-bless committed), record-damage (a save owed — marker live: `concentration.damage-taken: 1`), record → `concentration.spent: 0`, `concentration.remaining: 1`, effects notExists `effect-bless`, AND the marker cleared: `concentration.damage-taken: 0`, `concentration.last-damage: 0`, the free concentration-check notice gone. Without the damage leg an implementation that evicts the spell but skips `concentrationDamageMarkerClear()` passes green — the children's break scenarios inherit this shape by reference
- `condition-incapacitated-rest-clears` (condition-prone-rest-clears shape): short AND long → facts + notice gone

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

### PR1 — condition-incapacitated module + action-economy denial (+ initiative flag)

- [ ] RED: `condition-incapacitated-record`, `dash-illegal-while-incapacitated` fail — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-incapacitated.ts`: record offer, keyed effect (condition fact, `max`, `display.detailKey`), `initiative.disadvantage` derive, notice annotate
- [ ] Bridge extension: `EffectDisplay.detailKey` + `effectInstanceToRule` copy + chip component test — SKIP if wave 1 already landed it (check first; it should have)
- [ ] `action-economy.ts`: three `remaining` derives clamp to 0 while `condition.incapacitated > 0`; `attacks.ts`: `attackAction.extraRemaining` derive gains the same clamp
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] i18n keys above, both locales
- [ ] terraform seed `char_condition_incapacitated_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] GREEN: both scenarios + `condition-incapacitated-rest-clears` (green-immediate pin: expiry lands with the effect) + `EXPECTED_RUNNABLE`
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge

### PR2 — concentration break on record

- [ ] RED: `concentration-broken-on-record` fails
- [ ] apply gains the conditional eviction + marker clear (Decisions Knot 2)
- [ ] GREEN
- [ ] gates → PR → codex monitor → merge

## Out of scope

- Verbal-component spell legality while Speechless (no component modelling exists; notice text carries it)
- why/who imposed the condition (NPC state — prone precedent)
- free-section offers staying legal (rests, HI use) — correct, not a gap
- backfilling seeded groups to pre-existing characters (prone known limitation)
- reaction-timing subtleties (denial is standing, not per-trigger)

## Notes

- Initiative flag rode PR1 (one line of the effect's state) — splitting it out buys nothing; PR2 is the apply-side work only
- Option (a) rejected: sentinel spends pollute resource semantics + negative chips + surge-fragility — see Decisions
- No umbrella clear offer (no get-up analogue): chip dismissal + rest expiry are the only ends
- `planner.concentration.broken` display reused — names the state, not the breaker
