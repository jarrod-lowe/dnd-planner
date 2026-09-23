# Condition: Prone

We are going to add the first D&D condition - Prone. See the SRD text.

We'll need choice RECORD -> CONDITION for Prone. It should trugger the appropriate notice, and make legal the PLAN -> MOVE -> Get Up choice, which should consume half the movement total, and clear the notice and condition.

Short or Long rests should also clear the notice and condition.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Prone [Condition]** — While you have the Prone condition, you experience the following effects.
> **Restricted Movement.** Your only movement options are to crawl or to spend an amount of movement equal to half your Speed (round down) to right yourself and thereby end the condition. If your Speed is 0, you can't right yourself.
> **Attacks Affected.** You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, that attack roll has Disadvantage.
>
> **Dropping Prone** — On your turn, you can give yourself the Prone condition (see "Rules Glossary") without using an action or any of your Speed, but you can't do so if your Speed is 0.
>
> **Crawling** — While you're crawling, each foot of movement costs 1 extra foot (2 extra feet in Difficult Terrain).

Modelled: BEING KNOCKED prone (imposed — free, ungated). NOT modelled: voluntarily DROPPING prone (SRD "Dropping Prone" rule). Deviation (deliberate): rests clear Prone (player convenience; SRD leaves it until righted).

## Decisions (grilled)

- Disadvantage on OUR attack rolls: **set mechanically** — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage`; weapon/unarmed dice-lines already read these → roller defaults to 2d20-take-low (per-die override stays). Attacks vs us: notice text only (no NPC modelling). No spell-attack offers exist yet; future ones must wire `advantage: { fact }`.
- Get Up cost: half **Speed** (not movement total), round down. New facts: `character.movement.speed` (species-contributed, `combine: 'sum'`; Dash keeps touching only `total`), `character.movement.half_speed` (derived, floored).
- Get Up: `when` prone only; legal when `speed > 0` AND `remaining >= half_speed`.
- Recorder `record-prone` ("Knocked Prone"): always legal, free, no action cost — models being knocked prone; dropping prone voluntarily unmodelled.
- Universal group: terraform `SEED#CHAR` record + yaml `requires: [movement]` self-heal for existing characters.
- Clearing: Get Up (empty same-`key` effect — concentration-broken idiom); any rest (effect `expiry: untilShortRest` — long rest includes short); manual chip dismissal on ActiveStateStrip (automatic for committed effects).
- Crawl: `move-crawl` ×2 cost, visible only while prone. Walk / rough-terrain / swim / swim-costly / fly **illegal while prone** (shared diagnostic code). Crawl-in-difficult-terrain (×3) out of scope.
- New RECORD verb `CONDITION` (bucket `prone`); Get Up under MOVE verb (bucket `rise`).

## Design

Module `src/lib/rules-engine/rules/condition-prone.ts`, id `condition-prone`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-prone.yaml`: translations, `requires: [movement]`, detail (SRD text, body en-only) → `make publish-details`. No search meta (foundational).

Facts:

- `condition.prone` — 1 while prone; written ONLY by the committed effect (hold-person/sanctuary pattern); annotate + legality read it
- `character.movement.speed` — species-human adds `{ fact, combine: 'sum', value: () => 30 }`
- `character.movement.half_speed` — movement.ts derives `floor(speed × 0.5)`

Effects:

- prone: `{ id: 'effect-prone', key: 'prone', state: { 'condition.prone': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1 }, display: { name }, expiry: { kind: 'untilShortRest' } }`
- get-up clear: empty same-`key` effect with display (newest-wins evicts prone; `expiry: permanent`)
- get-up spend: keyless `{ 'character.movement.spent': half_speed }`, `expiry: endOfTurn`

Offers:

- `record-prone`: section `free`, `intents: { CONDITION: 'prone' }`, no control, no gate
- `get-up`: section `move`, `intents: { MOVE: 'rise' }`, `when: prone`, legalWhen speed>0 ∧ remaining≥half_speed, apply advertises [empty-keyed clear, spend]
- `move-crawl` (in movement.ts): `when: prone`, `mult: 2`, `packBehind: 'move-walk'`, slider default `half_remaining` / max `half_total` (rough-terrain pattern)
- movement.ts: the 5 existing move offers gain not-prone legality, shared code `…movement.cannot_while_prone`

Notice (annotate while `condition.prone > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-prone.notice` (+ `.body`), `source` name, `values: { cost: half_speed }`.
en body: "Disadvantage on your attack rolls. Attack rolls against you: Advantage from within 5 ft, Disadvantage otherwise. You can only Crawl, or spend {{cost}} ft to Get Up."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh normal casing, invented values):

- `play.verbs.CONDITION`, `play.verbBuckets.CONDITION.prone`, `play.verbBuckets.MOVE.rise`
- `rule.dnd-5e-2024.condition-prone.record-prone.name/.description`, `.effect-prone.name`, `.get-up.name/.description`, `.get-up-offer.cannot_get_up`, `.get-up-offer.out_of_movement`, `.notice`, `.notice.body`
- `rule.dnd-5e-2024.movement.move-crawl.name/.description`, `.cannot_while_prone`

Tests (RED first — yaml scenario asserts are the RED for rule changes):

- New scenarios (+ `EXPECTED_RUNNABLE`): `condition-prone-record` (facts 1/1/1 + notice exists), `condition-prone-rest-clears` (short AND long → cleared, notice gone), `condition-prone-get-up` (spent=15, prone cleared, notice gone), `get-up-illegal-low-movement` (pre-spend 20 → illegal), `move-crawl-while-prone` (legal, cost ×2), `walk-illegal-while-prone`, `half-speed-derived`
- Speed-0 get-up legality: module unit test (scenarios can't override derived facts)
- Verb plumbing covered by `intent-bucket-coverage` (both locales); extend `groupChoicesByVerb`/`AddRowPicker` tests only if they break

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor
- Never commit to main; PR per slice; no commit attribution/co-author; signing: unsigned if 1Password locked, re-sign later, never block
- Per slice gates: `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push
- Per PR final: `make sync-rule-groups` (rule changes) then `make deploy-test` (seed/CDN — sync alone insufficient); playwright check on <http://localhost:5173> (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); triage validity; fix or discuss; until reviews + pipelines clean
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — CONDITION verb + condition-prone module (record, effect, notice, rest clear, seeds)

- [x] RED: `condition-prone-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [x] `Verb` union + `verbConfig.ts` (`VERB_ORDER`, `RECORD_VERBS`) add CONDITION
- [x] i18n `play.verbs.CONDITION` + buckets, both locales
- [x] `condition-prone.ts`: `record-prone` offer, keyed prone effect, notice annotate
- [x] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [x] GREEN: record + rest-clears scenarios; `EXPECTED_RUNNABLE` (rest-clears green-immediate: expiry landed with slice A — kept as pin)
- [x] unit: recorder legal at Speed 0 — done as scenario `condition-prone-record-speed-zero` (green-immediate pin by design: no gate)
- [x] terraform seed `char_condition_prone_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [x] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge; `make deploy-test` — merged as 4d3c7378 (PR #435); codex P1 backfill comment answered won't-fix; mid-review reframe: recorder = "Knocked Prone" (being knocked, not dropping)

PR1 notes: effect carries `stateCombine: max` on the two disadvantage facts (armor modules derive them `combine: 'max'`; default `sum` on the effect write would conflict-throw for armored characters — leather-armor idiom). `record-prone.description` key omitted: record-\* offers carry name only.

### PR2 — Get Up (+ speed facts)

- [x] RED: `condition-prone-get-up` scenario fails
- [x] species-human contributes `character.movement.speed`; movement.ts derives `half_speed`
- [x] `get-up` offer (when/legalWhen/apply: empty-keyed clear + spend)
- [x] i18n get-up keys + `play.verbBuckets.MOVE.rise`, both locales (also get-up keywords — move/dash offers carry them)
- [x] GREEN: get-up + `get-up-illegal-low-movement` + `half-speed-derived` scenarios; Speed-0 done as scenario `get-up-illegal-speed-zero`; notice `values` as unit test `condition-prone-notice.test.ts` (yaml grammar can't assert annotation values)
- [x] gates → PR → codex monitor → merge — merged as 0d01826f (PR #436); codex P2 fixed: splint-armor penalty now REDUCES `speed`+`total` (−10) instead of consuming `.spent`, so the Get Up cost sees armored Speed (`get-up-splint-armor-cost` scenario)

### PR3 — crawl + prone movement restriction

- [ ] RED: `move-crawl-while-prone`, `walk-illegal-while-prone` scenarios fail
- [ ] movement.ts: `move-crawl` offer; not-prone legality on 5 move offers; shared `cannot_while_prone` code
- [ ] i18n crawl keys, both locales
- [ ] GREEN
- [ ] gates → PR → codex monitor → merge

## Out of scope

- shove/other effects auto-recording prone (NPC state, not ours)
- voluntarily dropping prone (recorder models being knocked prone only)
- backfilling seeded groups (this or grapple/shove) to pre-existing characters — known limitation; codex P1 answered won't-fix on PR1; recreate character or build a forward-assignment mechanism as its own idea
- end-of-turn-in-occupied-space auto-prone
- flying + prone → falling
- crawl in difficult terrain (×3)
- mechanical enforcement of attacks-vs-us (notice text only)

## Notes

- `half_total` stays unrounded (×0.5) — only `half_speed` floors
- Empty keyed clear effect carries `display` (nameless hidden effects render nothing)
- `when: false` skips planned instances — Get Up can't be pre-planned before dropping prone
