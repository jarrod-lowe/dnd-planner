# Condition: Frightened

Wave-2's deferred straggler — the LAST of the 14 (waves 1–8 landed; the tracker held this one back over a single knot: the line-of-sight qualifier). New shape, **user-directed 2026-09-25**: a LoS TOGGLE the player taps ON THE NOTICE — keyed sub-state + gated derives + a strip button. SUPERSEDES this doc's old standing-flags GRILL POINT and the umbrella's standing-disadvantage default (conditions-remaining.md, Decision defaults). See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: keyed condition fact + a player-asserted `frightened.sourceHidden` toggle (keyed effect + empty same-key eviction — the drop-prone/get-up idiom) + the 22 disadvantage flags as DERIVES gated on both (the armorTrainingPenalties shape). The LoS qualifier is MECHANISED — the SRD scopes the whole disadvantage clause to sight. Can't-approach stays notice text (no source position).

## Decisions (defaults — re-grill before execution)

- **LoS: player-toggled sub-state, not standing flags** (user-directed 2026-09-25, SUPERSEDING this doc's standing-flags GRILL POINT + the umbrella's standing-disadvantage default). Two free offers flip `frightened.sourceHidden`; the standing notice carries the tap-to-toggle button (`addsToPlan` naming the applicable offer, conditional on state). Rejected: (a) **standing flags** (the old default): every die pays disadvantage while the source is hidden until a per-die override — backwards, the SRD sentence is sight-qualified and source-hidden is the common mid-fight state; (b) **settings chassis** (yaml `settings` select → EffectInstance): dead per the LoS exploration — settings are build-time choices, the wrong home for live per-battle combat state; (c) **per-die override as the primary**: burden on every roll, and the board has no source-position model to verify against anyway — the toggle is player judgement, one tap, both directions.
- **Flags OFF means OFF**: source hidden → 0 on all 22 — NO disadvantage anywhere from Frightened. The qualifier scopes the entire disadvantage clause. Assert (yaml).
- **Flags as DERIVES, not effect state** — effect `state` cannot be conditional on live facts (builder.ts's own armorTrainingPenalties comment); each flag derives `combine: 'max'`, `value: (f) => f.num('condition.frightened') > 0 && f.num('frightened.sourceHidden') === 0 ? 1 : 0`. Mode agreement: Poisoned effect-writes the same flags `stateCombine: 'max'`, armor derives them `combine: 'max'` — same mode, no conflict-throw (Blinded's regression family). Cycle guard: the derives read ONLY `condition.frightened` + `frightened.sourceHidden`, never their own outputs (splint reads `armor.splint.equipped`, an effect-written fact, the same way).
- **Toggle key discipline**: toggle effect `key: 'frightened-source'` — DISTINCT from the condition's `'frightened'` (a same-key eviction would end the condition itself). Toggle-on writes `frightened.sourceHidden: 1`; reveal = EMPTY same-key eviction (get-up idiom).
- **Toggles always-visible + legality-gated** (the #453 illegal-but-visible contract — condition-prone.ts's current get-up shape): no `when`; `legalWhen` diagnostics + apply re-check (the dash idiom). Planned-anyway rows execute harmlessly: toggle-on while un-frightened writes an inert fact (derives gate on the condition), reveal while visible is a no-op eviction.
- **The notice is the toggle's home**: ONE standing notice while `condition.frightened > 0`; `addsToPlan` flips with state (visible → `source-out-of-sight`, hidden → `source-back-in-sight`); body key flips (exhaustion's `.notice.body-dead` precedent). **Distinct accessible names per state** (a11y): the addsToPlan action gains an optional `labelKey` (rules-view types extension — generic, absent → the existing `play.annotation.addToPlan` fallback); the frightened notice supplies `.action-hide` / `.action-reveal` so screen readers announce which way the control toggles — asserted in the component test. The toggles ALSO live in the add-row picker as ordinary free offers — the button is a shortcut, not the only path; it degrades to plain text when the offer isn't addable (PR1 chassis).
- **Interaction — Poisoned + hidden → flags STILL 1**: Poisoned's effect writes 1, Frightened's derive contributes 0, max = 1 (the uniform-max dividend). Untrained armor likewise. Assert (yaml).
- **Can't-willingly-approach: notice text only** — enforcing "closer to the source" needs source position (NPC side, no modelling); the LoS toggle changes nothing here (sight judgement, not movement verification). BOTH body copies carry the sentence.
- Ending: umbrella default — BOTH effects `expiry: untilShortRest` (any rest clears condition + toggle together; assert) + ActiveStateStrip chip dismissal. Committed-toggle orphan guard: the condition effect lists the toggle key in `dependents` — dismissing the Frightened chip removes a COMMITTED toggle too (store `removeEffect` follows dependent keys; store-level pin — the yaml runner's `removeEffect` does not). PLANNED toggle rows are NOT removed by dismissal (removeEffect touches only `state.committed`): they go ILLEGAL at the next evaluation (the toggle legality reads `condition.frightened > 0`) and a planned-anyway row commits an inert, dismissible toggle chip — the illegal-but-visible contract, same as every other override.
- Recorder `record-frightened` ("Frightened"): free, ungated, imposed by an enemy effect (knocked-prone shape).
- `requires: []` — the derives read only their own module's facts; the flags are inert facts without reader groups (Poisoned precedent); nothing in movement reads Frightened.
- Detail body: SRD verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-frightened.ts`, id `condition-frightened`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-frightened.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/frightened`, source `srd52`, body en-only) → `make publish-details`. No search meta.

Facts:

- `condition.frightened` — 1 while frightened; written ONLY by the condition effect
- `frightened.sourceHidden` — 1 while the player has marked the source out of sight; written ONLY by the toggle effect

Derives (module `derive:`, armorTrainingPenalties shape; module-local SKILLS const — copy Poisoned's 18, don't share): 22 contributions — `attack.str/dex.disadvantage`, `initiative.disadvantage`, `check.disadvantage`, `skill.{skill}.disadvantage` ×18 — each `{ fact, combine: 'max', value }` with the gated value above.

Effects:

- `effect-frightened`: `{ key: 'frightened', state: { 'condition.frightened': 1 }, dependents: ['frightened-source'], display: { name, detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }` — writes ONLY the condition fact; the flags live in the derives; `dependents` makes chip dismissal take the toggle too
- toggle-on `frightened-source-hidden`: `{ key: 'frightened-source', state: { 'frightened.sourceHidden': 1 }, display: { name: '.effect-source-hidden.name', detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }` — the strip SHOWS the LoS state
- reveal eviction `frightened-source-visible`: EMPTY same-`key` ('frightened-source'), `display: { name: '.source-back-in-sight.effect-cleared.name' }`, `expiry: { kind: 'untilShortRest' }` — NOT permanent: rest must clear it WITH the condition (a permanent ended-chip would outlive Frightened itself); the strip shows the ended chip until then

Offers (all section `free`, `intents: { CONDITION: 'frightened' }`, `detailKey: 'condition/frightened'`, `actionCost: []`, no control):

- `record-frightened`: no gate; apply advertises the condition effect
- `source-out-of-sight`: no `when`; `legalWhen` [frightened > 0 && sourceHidden === 0 → diagnostics `.source-out-of-sight-offer.not_frightened` / `.already_hidden`]; apply re-checks, advertises toggle-on
- `source-back-in-sight`: no `when`; `legalWhen` [sourceHidden > 0 → `.source-back-in-sight-offer.not_hidden`]; apply re-checks, advertises the eviction

Notice (annotate while `condition.frightened > 0`): `targets: ['notice']`, key `.notice`, `source` `.effect-frightened.name`; body + `addsToPlan` flip on state (the annotation-targets registry guard validates the offer ids — same-module here):

- visible: `body: '.notice.body'`, `addsToPlan: { offer: 'source-out-of-sight', labelKey: `${CF}.notice.action-hide` }`
- hidden: `body: '.notice.body-hidden'`, `addsToPlan: { offer: 'source-back-in-sight', labelKey: `${CF}.notice.action-reveal` }`

en bodies:

- `.notice.body`: "Disadvantage on attack rolls and ability checks while the source of fear is within line of sight. You can't willingly move closer to the source of fear."
- `.notice.body-hidden`: "The source of fear is out of sight — no Disadvantage from Frightened. You still can't willingly move closer to the source of fear."

NoticeStrip UI slice (PR1; the only frontend change):

- NoticeStrip renders notices TEXT-only today (NoticeStrip.svelte:20-24/125-135 — no addsToPlan branch). Copy the PanelRenderer row-button pattern (PanelRenderer.svelte:846-874): resolve the notice's `addsToPlan` via an `addableOfferIds` membership test (the WHOLE test); button aria-label = the action's `labelKey` when present, else `play.annotation.addToPlan`; decorative plus icon; tap → `onAddOfferToPlan(offerId)` (PanelRenderer's prop names, reused). Absent props → DENY: a missing button, never a dead one. REJECTED FORMS in the notices path (degrade to plain text, like an unaddable offer): the `'again'` action (no source row to resolve against) AND the seeded `{ offer, seed }` form — `resolveSeed` needs a `sourceInstanceId` a notice cannot supply; the row would silently take defaults. STYLING: PanelRenderer's `.panel-renderer__annotation--action` rules are Svelte-SCOPED — they do not carry over; author NoticeStrip-scoped action-button styles from THEME VARIABLES ONLY (the CSS Law), matching the row button's touch target / theme / hover / focus treatment (no new colours, semantic reuse).
- `addsToPlan: 'again'` REJECTED in this path — it resolves against the panel row it renders on (`entry.rule.id`), and a notice has no row; render plain text. Unit-pinned.
- PlayCharacterMode forwarding, one line each: derive `new Set(availableRules.map((e) => e.rule.id))` (the PlanStack.svelte:95 idiom) + pass it and `addOfferToPlan` (PlayCharacterMode.svelte:134) into `<NoticeStrip>` (:186).
- i18n: only the generic fallback is reused (`play.annotation.addToPlan`, both locales exist); PR2 lands the state-specific `labelKey` values below.

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented at execution, normal casing — do not invent now):

- `rule.dnd-5e-2024.condition-frightened.record-frightened.name` (record-\* carries name only)
- `rule.dnd-5e-2024.condition-frightened.notice.action-hide` / `.action-reveal` (the two button accessible names)
- `.effect-frightened.name`, `.effect-source-hidden.name`, `.source-back-in-sight.effect-cleared.name`
- `.source-out-of-sight.name/.description`, `.source-back-in-sight.name/.description`
- `.source-out-of-sight-offer.not_frightened`, `.source-out-of-sight-offer.already_hidden`, `.source-back-in-sight-offer.not_hidden`
- `.notice`, `.notice.body`, `.notice.body-hidden`
- `play.verbBuckets.CONDITION.frightened`

Tests (RED first — registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-frightened-record` — pre-record: both toggles visible + ILLEGAL (not_frightened — the illegal-but-visible pin); record → condition fact + representative flags 1 (attack.str/dex, `initiative.disadvantage`, `check.disadvantage`, athletics/stealth/perception) + notice exists/targets; out-of-sight now LEGAL, back-in-sight illegal
- `condition-frightened-source-hidden` — toggle → `frightened.sourceHidden` 1, flags 0 (flags-off-is-OFF), notice STILL exists (can't-approach channel); legality flipped (back-in-sight legal, out-of-sight illegal)
- `condition-frightened-source-back-in-sight` — toggle → toggle back → sourceHidden 0, flags 1 (the round-trip pin)
- `condition-frightened-rest-clears` — record + hide → short AND long → condition 0 AND sourceHidden 0, notice gone; AND the reveal-path variant (record + hide + reveal + endTurn + rest): the eviction EFFECT is gone too (notExists — a fact reading 0 is not enough; the permanent-ended-chip leak), no stray chips
- `condition-frightened-dismiss-clears-toggle` — STORE-LEVEL pin (tests/unit/lib/play/playStore.test.ts, the `removeEffect` dependents coverage): committed condition + committed hidden-toggle → dismiss the condition chip → the toggle effect is gone too (no orphan chip). NOT a yaml scenario — the runner's `removeEffect` filters by exact id and never follows `dependents`; a yaml version cannot pass
- `condition-frightened-skill-flags` — co-load `leather-armor` untrained (Poisoned's shape): visible → shared flags 1, no conflict-throw (derive-vs-derive mode agreement); hidden → armor-written flags STILL 1 (attack.str/dex, initiative, athletics/stealth) while frightened-only flags go 0 (`check.disadvantage`, perception) — the honest residual
- `condition-frightened-hidden-with-poisoned` — co-load `condition-poisoned`, both recorded, hide → flags still 1 (the max dividend; green-immediate pin)

Unit pins (the yaml grammar cannot assert annotation values/bodies):

- `condition-frightened-notice.test.ts` — `addsToPlan` flips with state ({ offer: 'source-out-of-sight', labelKey: …action-hide } / { offer: 'source-back-in-sight', labelKey: …action-reveal }); body key flips; notice gone at condition 0; both body templates + both label keys in both locales; the named offers exist in the module
- `condition-frightened-derives.test.ts` — gating: 1 visible, 0 hidden on ALL 22 (zeroed, not merely absent), 0 un-frightened; combine 'max' mode agreement with Poisoned's stateCombine (the conflict-throw guard)

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

### PR1 — NoticeStrip button support (UI-only; the #456 roller precedent — zero rule writers)

- [ ] RED: `NoticeStrip.test.ts` — synthetic annotation with `addsToPlan: { offer }` renders the button, tap fires `onAddOfferToPlan(id)`; aria-label uses `labelKey` when present, the generic `play.annotation.addToPlan` otherwise (BOTH asserted); degrades to plain text when the offer isn't in `addableOfferIds`, when the action is `'again'` or seeded (the rejected forms), and when props are absent; existing text notices unchanged
- [ ] RED: `PlayCharacterMode.test.ts` screen-level wiring regression — mount with an actionable notice + its matching available offer; assert the tap reaches `addOfferToPlan` (guards the prop forwarding + addable-set derivation; the component test alone stays green if the screen omits them)
- [ ] NoticeStrip props (`onAddOfferToPlan`, `addableOfferIds`) + the button branch (the PanelRenderer:846-874 copy); PlayCharacterMode forwarding + the addable-set derivation
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (human inspects the strip button in the test env; no rule-group change — no publish-details, no seed) → human merges

May FOLD into PR2 if PR1 proves trivial — one decision line at execution.

### PR2 — condition-frightened module (record, derives, toggle, notice wiring, seed)

- [ ] RED: scenarios fail — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-frightened.ts`: record offer, condition effect, 22 gated derives, both toggle offers (legality + re-check), notice annotate (flipping body + addsToPlan)
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] i18n keys both locales
- [ ] GREEN: all scenarios + the two unit pins
- [ ] terraform seed `char_condition_frightened_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod)

## Out of scope

- can't-approach movement enforcement (no source position; notice text — the toggle is sight judgement, not movement verification)
- source IDENTITY (which creature frightened you — one undifferentiated toggle)
- inflicting fear on others (fear spells — NPC state)
- wisdom-save fear effects recording the condition automatically (future spell work)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- LoS history: the umbrella deferred Frightened in wave 2 over exactly this (conditions-remaining.md — "standing disadvantage vs per-source"); standing flags were this doc's default, the settings chassis (yaml `settings` select → EffectInstance) was explored for the toggle and died (build-time choices, wrong home for live combat state); the notice-button toggle is the user-directed 2026-09-25 landing.
- Wave-2's Poisoned landed the roller wiring these derives feed: `check.disadvantage` on record-check (core-events.ts:378), the skill/initiative/attack flag readers — ZERO roller work here.
- Poisoned's Cleave note applies identically (greataxe's Cleave secondary reads the attack flags — sight-gated now, same facts).
- Same 22-flag list as Poisoned — copy, don't share (module-local consts; share only if a third appears).
- Stray `frightened.sourceHidden` after condition chip-dismissal while hidden: inert (derives gate on the condition); reveal or rest clears.
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent).
