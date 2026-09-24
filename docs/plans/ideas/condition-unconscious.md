# Condition: Unconscious

Wave 7 (M). Adds Unconscious per SRD — the last composition child (Incapacitated + Prone + Speed 0). Two knots: "you drop whatever you're holding" and "when this condition ends, you remain Prone". Deps: `docs/plans/ideas/condition-incapacitated.md` (composition contract — our effect writes `condition.incapacitated: 1`; ITS machinery reacts to the fact) and `docs/plans/ideas/condition-grappled.md` (lands `character.movement.halted`, the Speed-0 idiom — must read `condition.unconscious` too). Neither dep doc written yet (waves 3/4); their contracts are assumed here. 0 HP / death saves → separate future idea.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Unconscious [Condition]** — While you have the Unconscious condition, you experience the following effects.
> **Inert.** You have the Incapacitated and Prone conditions, and you drop whatever you're holding. When this condition ends, you remain Prone.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Automatic Critical Hits.** Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.
> **Unaware.** You're unaware of your surroundings.

Modelled: composition child — effect writes unconscious + incapacitated + prone facts; Speed 0 flows via halted; everything NPC-side (vs-you Advantage, auto-crit, auto-fail saves) + Unaware → notice text. Deviation (deliberate, inherited from Prone): rests clear.

## Decisions (defaults — re-grill before execution)

- Composition: ONE keyed effect writes `condition.unconscious: 1` + `condition.incapacitated: 1` + `condition.prone: 1`. Action-economy denial reacts to the FACT (its doc's derive clamp); the concentration break does NOT — it is offer-side apply logic, so `record-unconscious` invokes the shared break helper (incapacitated doc, Knot 2): recording while concentrating evicts the held spell (SRD Unconscious includes Incapacitated → "No Concentration"). No nested/sub-effects.
- Speed 0: NOT written here — `character.movement.halted` (Grappled's idiom) reads `condition.unconscious` too; move offers + Get Up's speed gate die on it. PR1 extends the halted derive (no-op if Grappled already reads it).
- Attack flags: unconscious effect writes NONE. Prone's disadvantage lives in the prone EFFECT, not the fact — moot while unconscious (Incapacitated denies attacks); restored by the fresh prone effect at end.
- Knot 1 (drop held) — **(a) notice text + manual unequip (RECOMMEND)**: notice says drop held; player empties hands via existing set-loadout (free, atomic swap, house rule). Loadout is its own selection-driven system (key `loadout`); a condition effect mutating it is invasive. Rejected (b) mechanical empty-`loadout` eviction: one-way (dismissing the unconscious chip never restores the prior loadout); items are DROPPED, not stowed — the hands model has no "dropped" channel; loses player judgement (corded weapon?). Residual: weapon reads equipped until swapped — masked by Incapacitated action denial. Prior thinking: `docs/plans/ideas/loadout-change.md`.
- Knot 2 (remain Prone):
  - Rest path: `untilShortRest` clears the WHOLE unconscious effect incl. its prone write — aligned with Prone's own rest-clears deviation. Deliberate consequence.
  - Manual path — **Regain Consciousness end-offer (RECOMMEND)**: section `free`, `when: condition.unconscious > 0` (get-up idiom inverted), ungated (waking is external — healing / shaken awake; recorder precedent). Apply advertises [empty same-`key` 'unconscious' eviction (newest-wins), FRESH keyed prone effect — condition-prone's `proneEffect()` shape: `condition.prone` + `attack.str/dex.disadvantage`, `stateCombine: max`, `expiry: untilShortRest`] so Prone survives the eviction per SRD. Regain-then-get-up works in one plan: eviction applies while merely planned → speed restored at the get-up row.
  - Alternative rejected: no end-offer, strip dismissal also drops prone — WRONG per SRD ("you remain Prone"). Strip dismissal of the unconscious chip: NOT suppressible (no mechanism — `removeEffect` has no per-effect opt-out; `dependents` only removes MORE) → chip dismissal leaves you standing. Accept + document as known deviation; steer to the end-offer. Re-grill: acceptable, or suppression flag on EffectInstance as its own slice.
  - Duplicate prone (record-prone while unconscious): keys `prone` + `unconscious` coexist; regain's fresh key-`prone` newest-wins REPLACES it — CORRECT, a condition doesn't stack with itself.
- Recorder `record-unconscious`: free, ungated — imposed (sleep, knockout). Not HP-driven (death saves out of scope).
- Auto-fail STR/DEX saves / vs-you Advantage / auto-crit-within-5-ft / Unaware / drop-held: notice text (decision defaults; NPC-side).
- yaml `requires: [movement, condition-incapacitated, condition-prone]` (movement: halted; incapacitated: the Surprised derive + break helper self-heal-load — without the parent a unconscious-only character keeps acting and rolls Initiative unflagged; prone: the surviving-Prone machinery — get-up offer, prone notice, the shared `proneEffect()`).

## Design

Module `src/lib/rules-engine/rules/condition-unconscious.ts`, id `condition-unconscious`; register `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-unconscious.yaml`: translations, `requires`, detail (key `condition/unconscious`, source srd52, body = SRD verbatim, en-only) → `make publish-details`. No search meta (prone precedent).

Effects:

- unconscious: `{ id: 'effect-unconscious', key: 'unconscious', state: { 'condition.unconscious': 1, 'condition.incapacitated': 1, 'condition.prone': 1 }, stateCombine: { 'condition.incapacitated': 'max' }, display, expiry: { kind: 'untilShortRest' } }` — `condition.incapacitated` MUST be `max`: `effect-incapacitated` writes it `max` and sheet.ts THROWS on conflicting combine modes when standalone Incapacitated co-stands. `condition.prone` stays default-sum on BOTH its writers (prone effect + this) — same mode, no conflict; doubling reads 2, harmless (`> 0` gates)
- regain clear: empty same-`key` 'unconscious' effect, `display`, `expiry: permanent` (get-up idiom)
- fresh prone: `proneEffect()` extracted to the builder (`attackActionSpend` precedent — no rule imports another rule; condition-prone keeps using it)

Offers:

- `record-unconscious`: section `free`, `intents: { CONDITION: 'unconscious' }`, no control, no gate
- `regain-consciousness`: section `free`, `when: condition.unconscious > 0`, apply advertises [clear, fresh prone]

Notice (annotate while `condition.unconscious > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-unconscious.notice` (+ `.body`), `source` effect name. Body: attack rolls vs you have Advantage; any hit within 5 ft is a Critical Hit; auto-fail STR/DEX saves; you drop what you're holding (Set Loadout to empty hands); unaware of surroundings.

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh values invented at execution, normal casing); detail body en-only:

- `play.verbBuckets.CONDITION.unconscious` (`play.verbs.CONDITION` exists)
- `rule.dnd-5e-2024.condition-unconscious.record-unconscious.name` (record-\* carries name only), `.effect-unconscious.name`, `.regain-consciousness.name/.description`, `.regain-consciousness.effect-cleared.name` (nameless effects render nothing), `.notice`, `.notice.body`

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-unconscious-record` (unconscious + incapacitated + prone facts = 1, halted, notice exists)
- `condition-unconscious-breaks-concentration` (bless stack, the incapacitated doc's shape): cast bless → hold live → record → `concentration.spent` 0, `effect-bless` gone — composition recorder invokes the shared break helper
- `condition-unconscious-regain` (end-offer → unconscious 0, `condition.prone` STILL 1 + attack flags present — the key assert)
- `condition-unconscious-rest-clears` (short AND long → all three facts cleared, notice gone — deviation pin)
- `move-walk-illegal-while-unconscious`

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

### PR1 — condition-unconscious module (record, composition, notice, halted read, seeds)

- [ ] RED: `condition-unconscious-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-unconscious.ts`: record offer (apply invokes the shared concentration-break helper), keyed effect (3 facts, incapacitated `max`), notice annotate
- [ ] halted derive reads `condition.unconscious` (whichever module Grappled landed it in)
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details`
- [ ] i18n keys, both locales
- [ ] terraform seed `char_condition_unconscious_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] GREEN: record + breaks-concentration + rest-clears + walk-illegal scenarios in `EXPECTED_RUNNABLE`
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge; `make sync-rule-groups` then `make deploy-test`

### PR2 — Regain Consciousness end-offer

- [ ] RED: `condition-unconscious-regain` scenario fails
- [ ] extract `proneEffect()` to builder; regain offer (`when`/apply: empty-keyed clear + fresh prone)
- [ ] i18n regain keys + effect-cleared display, both locales
- [ ] GREEN: regain + green-immediate pin `condition-unconscious-regain-after-record-prone` (exactly one prone effect survives — newest-wins)
- [ ] gates → PR → codex monitor → merge

## Out of scope

- 0 HP / death saves / stable-dying flow — separate future idea
- mechanical drop of held items (knot 1 option b)
- vs-you Advantage / auto-crit / auto-fail STR/DEX saves enforcement (NPC-side, notice text)
- strip-dismissal suppression (unless re-grilled into its own slice)
- waking triggers (healing amounts, shaken awake) — player adjudicated

## Notes

- Strip dismissal of the unconscious chip leaves you NOT prone — known deviation, no suppression mechanism; Regain Consciousness is the blessed end
- Doubled `condition.prone` (live prone effect + unconscious effect) reads 2 — harmless, all reads are `> 0`
- `when: false` skips planned instances — regain can't be pre-planned while awake (mirror of get-up)
- Unconscious effect's missing attack flags are invisible in play: Incapacitated (fact-written) zeroes actions first
- Surprised inherits via the incapacitated derive (`initiative.disadvantage` reads the composed fact) — nothing to write here; paralyzed's pin scenario covers the family
