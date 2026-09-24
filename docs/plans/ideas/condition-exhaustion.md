# Condition: Exhaustion

Wave 8, the last condition — and the only COUNTER (glossary: Exhaustion is "an exception" to no-self-stacking). Not a boolean: `condition.exhaustion` holds the level, the record offer increments it, a long rest decrements it. Prone built the boolean chassis; this doc reuses it with a number in the keyed effect's state. See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Exhaustion [Condition]** — While you have the Exhaustion condition, you experience the following effects.
> **Exhaustion Levels.** This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6.
> **D20 Tests Affected.** When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level.
> **Speed Reduced.** Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level.
> **Removing Exhaustion Levels.** Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends.

Glossary "Condition": "A condition doesn't stack with itself; a recipient either has a condition or doesn't. The Exhaustion condition is an exception to that rule."
"D20 Tests ... come in three kinds: ability checks, saving throws, and attack rolls." Initiative: "every participant rolls Initiative; they make a Dexterity check" — a D20 Test.

**DIVERGENCE — settle before execution**: SRD 5.2 = 6 levels, die at 6, no HP-max clause. PHB 2024 = 10 levels, HP max reduced 10 × level, die at 10. Project rule: docs/srd52.txt canonical → **6**. Detail body stays SRD-verbatim; note the divergence in the doc for tables playing from the PHB.

## Decisions (defaults — re-grill before execution)

- Counter: keyed effect `key: 'exhaustion'`, `state: { 'condition.exhaustion': level }`. Key dedupe keeps ONE effect in force (newest-wins replaces), so the summed fact IS the level. `record-exhaustion` apply reads the FOLDED prior level `f.num('condition.exhaustion')` and advertises the keyed effect at level+1 — two rows same turn stack correctly (row 2's fold sees row 1).
- Death at 6: record legal THROUGH 6 and past it — UNGATED (tracker philosophy: record what happened; we don't model death); the notice flags death at 6. Alternative: gate recording at 6 with a diagnostic. grill.
- −2 × level: RIDER, not derive (Aura of Protection precedent — the ROLL is reduced; the modifier and the top bar stay untouched). Three annotations: `appliesTo` is single-purpose (`RollPurpose`), one per die kind, each `rider: { value: { kind: 'flat', bonus: −2 × level } }`, `defaultOn: true`. Channel limitation: the chip is toggleable (no locked variant exists) — a mandatory penalty the player can switch off; grill.
- Initiative: **IN** — it is a D20 Test by being a Dexterity check (SRD wording: "When you make a D20 Test"). Costs nothing: the initiative d20's purpose is `'check'`, so the check rider reaches it (Alert's secondary roll too — also a D20 Test).
- Speed −5 × level: `combine: 'sum'` contributions to BOTH `character.movement.speed` and `character.movement.total` (splint −10 precedent), `value: (f) => −5 × f.num('condition.exhaustion')`. No self-cycle: WRITES the movement facts, READS `condition.exhaustion` — a different fact (splint reads `armor.splint.equipped`, an effect-written fact, the same way); verified. Raw, unclamped (splint precedent; exhaustion 5 + splint → Speed −5 reads odd but every gate still behaves — Get Up's `speed > 0` holds). grill.
- Prone's Get Up cost follows AUTOMATICALLY: `half_speed` floors `speed × 0.5`, and speed now carries the penalty — assert it, code nothing.
- Long rest removes exactly 1: **`onRest` hook** (Channel Divinity precedent — rest expiry CLEARS whole effects, it cannot decrement). `kind === 'long' && level > 0` → advertise the keyed effect at level−1; level 1→0 = empty-`key` eviction (prone get-up idiom; fact reverts to 0). Alternatives rejected: (a) new rest-expiry decrement semantic — core engine change, heavy; (b) manual free offer "Long Rest: remove 1 Exhaustion level" — a second thing to remember, drifts from the player-recorded rest. The hook IS the long-rest flow, with no engine change. Short rest removes nothing. grill.
- Effect expiry `permanent` — deliberate DEVIATION from the umbrella's condition-ending default (`untilShortRest`): a short rest must not clear Exhaustion. Manual strip dismissal clears ALL levels at once — accepted manual override. grill.
- Same-turn rest+gain edge: `onRest` runs once, reads state as it stood AT the rest, and its effects append last (newest-wins) — rest-then-gain in one turn nets −1, swallowing the gain. Accepted imperfection (plan.ts documents the class; divinity's no-banking gate is the kin). Note in the module comment.

## Design

Module `src/lib/rules-engine/rules/condition-exhaustion.ts`, id `condition-exhaustion`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-exhaustion.yaml`: translations, `requires: [movement]`, detail (key `condition/exhaustion`, body = SRD quote above, en-only) → `make publish-details`.

Facts: `condition.exhaustion` — level; written ONLY by the keyed effect's state (prone's `condition.prone` discipline).

Derive: the two speed contributions above (splint-armor shape, dynamic value).

Effects:

- `effect-exhaustion`: `{ key: 'exhaustion', state: { 'condition.exhaustion': level }, display: { name, value: level }, expiry: permanent }` — chip shows the live level
- level-0 clear: EMPTY same-`key` effect with display (newest-wins evicts; the get-up idiom), `expiry: permanent`

Offers:

- `record-exhaustion`: section `free`, `intents: { CONDITION: 'exhaustion' }`, no control, no legality gate (death decision above) — the record-prone shape; apply → keyed effect at prior+1
- `remove-level` free offer ONLY if grilling flips the long-rest decision; apply → level−1 / empty eviction

`onRest`: long + level > 0 → [keyed effect at level−1, or the empty eviction when level is 1].

Annotate (all guarded `condition.exhaustion > 0`), four annotations:

- notice: `targets: ['notice']`, key `.notice`, `source: .effect-exhaustion.name`, `body: .notice.body`, `values: { level, roll: −2 × level, speed: −5 × level }` (prone's `values: { cost }` shape); at level ≥ 6 the body key becomes `.notice.body-dead` (the death flag)
- rider ×3 — label map verified from panel declarations; PanelDiceLine shows a modifier only where a die's `purpose === appliesTo`, so `dice.any` never leaks onto damage/healing dice:
  - to-hit: `targets: ['attack.any']`, `appliesTo: 'to-hit'` — every weapon panel + unarmed declare `attack.any`; companion panels use `.companion`-suffixed labels → unreachable (correct: the steed has no Exhaustion)
  - check: `targets: ['dice.any']`, `appliesTo: 'check'` — 18 skills, record-check, roll-initiative (+ Alert secondary)
  - save: `targets: ['save.any']`, `appliesTo: 'save'` — the 6 save recorders + concentration check
  - one shared `rider.label` key; three annotation keys `.rider-to-hit`, `.rider-check`, `.rider-save`

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented values, normal casing); keys listed only, values at execution:

- `rule.dnd-5e-2024.condition-exhaustion.record-exhaustion.name` (+ `.description` only if carried — prone PR1 note: record-\* offers carry name only)
- `.effect-exhaustion.name`, `.notice`, `.notice.body`, `.notice.body-dead`
- `.rider` (chip label), `.rider-to-hit`, `.rider-check`, `.rider-save`
- `.remove-level.name` (only if the offer variant wins)
- `play.verbBuckets.CONDITION.exhaustion`
  Detail body en-only (tlh falls back). Never in the yaml.

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-exhaustion-record` — level 1, notice exists + targets (PR1); PR2 extends with speed −5 on speed+total
- `condition-exhaustion-death-notice` — record ×6 → level 6, dead body (PR1)
- `condition-exhaustion-record-twice` — level 2, speed −10 + total −10 (PR2); PR3 adds rider-annotation exists
- `condition-exhaustion-half-speed-shrinks` — level 2 + prone → get-up cost 10 (floor(20/2)) (PR2)
- `condition-exhaustion-long-rest-removes-one` — level 2 → long rest → 1, persists past endTurn; SHORT rest removes nothing (PR3)
- rider VALUE (−4 at level 2) + notice `values`: unit tests — the yaml grammar cannot assert annotation values (prone PR2 precedent, `condition-prone-notice.test.ts`)

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing each module
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push
- Per rule-group change: `make publish-details`; `make sync-rule-groups` then `make deploy-test` (sync alone insufficient — CDN); terraform seed per new group (`dynamodb-items.tf`), `make validate`
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); every comment gets fixed or a reasoned won't-fix reply; until reviews + pipelines clean; agent never merges
- i18n: BOTH locales (`en` + `en-x-tlh` invented values, normal casing); `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back); `play.verbBuckets.CONDITION.<name>` per condition
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — counter + record + notice (prone PR1 boilerplate)

- [ ] RED: `condition-exhaustion-record` + `condition-exhaustion-death-notice` fail — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] i18n keys both locales incl. `play.verbBuckets.CONDITION.exhaustion` (verb + bucket exist since prone)
- [ ] `condition-exhaustion.ts`: record offer, keyed level effect, notice annotate (rider + derive + onRest deferred to their PRs)
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] GREEN: both scenarios in `EXPECTED_RUNNABLE`; notice-values unit test
- [ ] terraform seed `char_condition_exhaustion_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge (executing agent never merges)

### PR2 — speed contributions

- [ ] RED: `condition-exhaustion-record-twice` + `condition-exhaustion-half-speed-shrinks` fail; `record` gains the −5 asserts
- [ ] derive: −5 × level on `character.movement.speed` + `character.movement.total`
- [ ] GREEN; gates → PR → codex monitor → merge

### PR3 — D20-test rider + long-rest decrement

- [ ] RED: `condition-exhaustion-long-rest-removes-one` fails; `record-twice` gains rider-annotation asserts
- [ ] rider ×3 annotate + rider-value unit test (−4 at level 2); playwright check that the chips render on a weapon panel, a skill, a save (first to-hit/check flat riders — see Notes)
- [ ] `onRest` decrement + level-0 empty eviction; short-rest-removes-nothing asserted
- [ ] GREEN; gates → PR → codex monitor → merge

## Out of scope

- PHB-2024 variant (10 levels, HP max −10 × level, die at 10) — a table-setting toggle is its own idea; SRD canonical here
- death modelling / 0-HP / death-save flow (separate idea; the notice is text only)
- exhaustion SOURCES (forced march, starvation, frenzy) — record offer covers player entry; source offers later
- steed/companion exhaustion (companion labels deliberately unreachable)
- clamping negative Speed at 0; levels past 6 (recorded but uninterpreted)

## Notes

- Only ONE valued rider exists today — Aura of Protection, `appliesTo: 'save'`. The to-hit/check riders are the FIRST flat riders on those purposes; the purpose filter in PanelDiceLine is generic so they should work — verify in browser (PR3). Bless's +1d4 is a PLANNED `dice`-kind rider (types.ts comment), not landed: it proves the target set, Aura proves flat folding.
- `RiderValue` is `{ kind: 'flat'; bonus }` only — negative bonuses are untested in the UI (Aura's is +); chip must render "−4", not "+−4" (`formatModifier` handles the sign — unit-test it)
- grapple/shove panels carry only `attack.action` (2024: the TARGET saves; no self d20 check) — nothing to reach; verify at execution
- exhaustion 6 + species 30 → Speed 0: Get Up's `speed > 0` gate keeps working (prone interplay); splint + exhaustion stacks to negative
- The effect's `display.value: level` is a literal baked at advertise time (hp-modifier-setter idiom) — safe: newest-wins rewrites the whole effect each record/rest
