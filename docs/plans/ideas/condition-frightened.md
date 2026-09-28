# Condition: Frightened

Wave-2's deferred straggler — the LAST of the 14 (waves 1–8 landed; the tracker held this one back over a single knot: the line-of-sight qualifier). **v2 interaction (user-directed 2026-09-29, chosen from visual walkthroughs — "Reading 2: persistent global toggle, chip-styled, immediate")**: the LoS toggle is a PERSISTENT chip on the dice-lines whose disadvantage it scopes; one tap commits IMMEDIATELY (the store's follow-up channel), both directions on the same control. Copy per the user: "Fear source in sight" / "Fear source out of sight" (the SRD's phrase — names WHAT source). The v1 notice-button + picker-offer design is SUPERSEDED, and #462's merged notice button path was DELETED with it (no-unused-code rule: zero users once Frightened stopped using it). See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: keyed condition fact + a player-asserted `frightened.sourceHidden` toggle (keyed effect + empty same-key eviction — the drop-prone/get-up idiom) + the 22 disadvantage flags as DERIVES gated on both (the armorTrainingPenalties shape). The LoS qualifier is MECHANISED — the SRD scopes the whole disadvantage clause to sight. Can't-approach stays notice text (no source position).

## Decisions

- **LoS: player-toggled sub-state, not standing flags** (user-directed 2026-09-25). Rejected: (a) **standing flags**: every die pays disadvantage while the source is hidden until a per-die override — backwards, the SRD sentence is sight-qualified and source-hidden is the common mid-fight state; (b) **settings chassis**: build-time choices, the wrong home for live per-battle combat state; (c) **per-die override as the primary**: burden on every roll, and the board has no source-position model to verify against — the toggle is player judgement.
- **v2 interaction — persistent committed toggle, chip on the rollers** (user-directed 2026-09-29, the walkthrough decision): the control is a state chip AFTER the dice of every dice-line whose rules-driven disadvantage source is one of the 22 gated facts (weapon to-hit, skill, initiative, save, generic-check rollers). Aura-look (the PanelDiceLine modifier chip's classes; `aria-pressed`, filled when in-sight/on). While the source is HIDDEN the flags read 0 but the chip STAYS — label "Fear source out of sight" — so the player can flip back; presence keys on the fact NAME the line reads, never its value. Tapping commits IMMEDIATELY via `addFollowupEffect` (the panel-followup tap-to-commit shape) — no planned choices, no plan rows. **Deleted with v2** (the no-unused-code rule): the `source-out-of-sight` / `source-back-in-sight` picker offers + their legality machinery + diagnostics + i18n, the notice's `addsToPlan`, the `.notice.action-hide` / `.action-reveal` keys, and #462's whole notice button path (NoticeStrip `onAddOfferToPlan`/`addableOfferIds` props + button branch + `AnnotationAction.labelKey` extension — zero users left; the row-side PanelRenderer addsToPlan path is untouched).
- **The annotation channel — `toggle`** (engine `Annotation` + rules-view mirror + `ActiveAnnotation` passthrough): `toggle: { offFact, onLabelKey, offLabelKey, onEffect, offEffect, governs, committedKey }`. ON = in sight (the disadvantage-applying state; `offFact` reads >0 while hidden). The ON-state tap commits `onEffect` (the keyed hide); the OFF-state tap commits `offEffect` (the empty same-key eviction). `governs` names the 22 flag facts — the delivery mirrors how valued riders reach PanelDiceLine (annotation → PanelRenderer resolution → prop), except the resolved `DiceLineToggle` carries the CURRENT state's label + effect, and the tap routes through `onFollowup` rather than keeping ephemeral switch state. ONE annotation carries both surfaces: `targets: ['notice', 'dice.any']` — the strip's text half and the dice-lines' chip half. `dice.any` reaches every d20 roller (the annotation-targets guard pins every dice panel carries it); the chip then narrows to lines whose disadvantage source is a governed fact, so damage/healing lines and the steed's companion-labelled panels never show it.
- **`committedKey` — the chip gates on a COMMITTED condition** (codex 4127417615): `committedKey: 'frightened'`. A planned `record-frightened` row advertises the same facts `annotate` reads, so the ENGINE cannot tell planned from committed (its committed list folds the plan's advertised effects in) — the VIEW can: PlanStack derives the committed effect KEYS from `playStore.state.committed` (the `addableOfferIds` idiom — Set threaded PlanStack → PlanRow → PanelRenderer) and PanelRenderer drops a gated toggle whose key is absent. No chip in ANY form while merely planned (no button, no span, no text fallback — the annotation stays chip-represented; the notice strip's half stands); deny-by-default when the set isn't wired (pickers). Orphan gone at the root: nothing commits off a cancellable projection, so `removeFromPlan` has nothing to clean up.
- **Flags OFF means OFF**: source hidden → 0 on all 22 — NO disadvantage anywhere from Frightened. The qualifier scopes the entire disadvantage clause. Assert (yaml).
- **Flags as DERIVES, not effect state** — effect `state` cannot be conditional on live facts (builder.ts's own armorTrainingPenalties comment); each flag derives `combine: 'max'`, `value: (f) => f.num('condition.frightened') > 0 && f.num('frightened.sourceHidden') === 0 ? 1 : 0`. Mode agreement: Poisoned effect-writes the same flags `stateCombine: 'max'`, armor derives them `combine: 'max'` — same mode, no conflict-throw (Blinded's regression family). Cycle guard: the derives read ONLY `condition.frightened` + `frightened.sourceHidden`, never their own outputs.
- **Toggle key discipline**: toggle effect `key: 'frightened-source'` — DISTINCT from the condition's `'frightened'` (a same-key eviction would end the condition itself). Toggle-on writes `frightened.sourceHidden: 1`; reveal = EMPTY same-key eviction (get-up idiom). `addFollowupEffect`'s keyed replace makes ONE call serve both directions. Both effects carry AUTHORED `ruleGroupId: 'condition-frightened'` (codex 4127417623 — the javelin Slow follow-up idiom): the follow-up channel bypasses the plan fold that stamps owners, so without the authored stamp `unassignRuleGroup` strands a persisted `sourceHidden` and the next Frightened starts hidden.
- **The strip chip** (state display): the committed toggle effect carries `display` — while hidden the strip shows the "Fear Source Out of Sight" chip; DISMISSING it (removeEffect) clears the toggle = restore in-sight. The reveal eviction keeps its distinct ended label ("Fear Source Back in Sight") until a rest.
- **Interaction — Poisoned + hidden → flags STILL 1**: Poisoned's effect writes 1, Frightened's derive contributes 0, max = 1 (the uniform-max dividend). Untrained armor likewise. Assert (yaml).
- **Can't-willingly-approach: notice text only** — enforcing "closer to the source" needs source position (NPC side, no modelling); the LoS toggle changes nothing here (sight judgement, not movement verification). BOTH body copies carry the sentence, flipping per state (exhaustion's body-dead flip precedent).
- Ending: umbrella default — BOTH effects `expiry: untilShortRest` (any rest clears condition + toggle together; assert) + ActiveStateStrip chip dismissal. Committed-toggle orphan guard: the condition effect lists the toggle key in `dependents` — dismissing the Frightened chip removes a COMMITTED toggle too (store `removeEffect` follows dependent keys; store-level pin — the yaml runner's `removeEffect` does not).
- Recorder `record-frightened` ("Frightened"): free, ungated, imposed by an enemy effect (knocked-prone shape). The ONLY offer the module carries.
- `requires: []` — the derives read only their own module's facts; nothing in movement reads Frightened.
- Detail body: SRD verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-frightened.ts`, id `condition-frightened`; registered in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-frightened.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/frightened`, source `srd52`, body en-only). No search meta. (Unchanged from the original landing; v2 touched no metadata.)

Facts:

- `condition.frightened` — 1 while frightened; written ONLY by the condition effect
- `frightened.sourceHidden` — 1 while the player has marked the source out of sight; written ONLY by the toggle effect (unset = in sight)

Derives (module `derive:`, armorTrainingPenalties shape; module-local SKILLS const — copy Poisoned's 18, don't share): 22 contributions — `attack.str/dex.disadvantage`, `initiative.disadvantage`, `check.disadvantage`, `skill.{skill}.disadvantage` ×18 — each `{ fact, combine: 'max', value }` with the gated value above.

Effects:

- `effect-frightened`: `{ key: 'frightened', state: { 'condition.frightened': 1 }, dependents: ['frightened-source'], display: { name, detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }` — writes ONLY the condition fact; the flags live in the derives; `dependents` makes chip dismissal take the toggle too
- toggle-on `frightened-source-hidden`: `{ key: 'frightened-source', ruleGroupId: 'condition-frightened', state: { 'frightened.sourceHidden': 1 }, display: { name: '.effect-source-hidden.name', detailKey: 'condition/frightened' }, expiry: { kind: 'untilShortRest' } }` — the strip SHOWS the LoS state
- reveal eviction `frightened-source-visible`: EMPTY same-`key` ('frightened-source') with the SAME authored `ruleGroupId`, `display: { name: '.source-back-in-sight.effect-cleared.name' }`, `expiry: { kind: 'untilShortRest' }` — NOT permanent: rest must clear it WITH the condition (a permanent ended-chip would outlive Frightened itself)

Offer (section `free`, `intents: { CONDITION: 'frightened' }`, `detailKey: 'condition/frightened'`, `actionCost: []`, no control):

- `record-frightened`: no gate; apply advertises the condition effect

Annotation (while `condition.frightened > 0`): ONE payload, both surfaces —

- `key: '.notice'`, `targets: ['notice', 'dice.any']`, `source: '.effect-frightened.name'`
- `body`: `.notice.body` / `.notice.body-hidden` (flips with state; text only — NO button on the notice)
- `toggle`: `{ offFact: 'frightened.sourceHidden', onLabelKey: '.fear-source-in-sight', offLabelKey: '.fear-source-out-of-sight', onEffect: <toggle-on>, offEffect: <reveal eviction>, governs: [the 22 flag facts], committedKey: 'frightened' }`

en bodies / chip labels:

- `.notice.body`: "Disadvantage on attack rolls and ability checks while the source of fear is within line of sight. You can't willingly move closer to the source of fear."
- `.notice.body-hidden`: "The source of fear is out of sight — no Disadvantage from Frightened. You still can't willingly move closer to the source of fear."
- `.fear-source-in-sight`: "Fear source in sight"
- `.fear-source-out-of-sight`: "Fear source out of sight"

Frontend (v2):

- `PanelDiceLine` renders the chip (full mode: a `panel-renderer__modifier panel-renderer__toggle` button, `aria-pressed={on}`, `data-toggle-key`, tap → `onToggle(effect)`; non-editable / no-handler / summary: the same chip as a span — the no-focusable-in-summary rule). Presence: the line's `control.advantage.fact` ∈ `toggle.governs`.
- `PanelRenderer` resolves matching toggle annotations against the live `facts` into `DiceLineToggle[]` (current state, label, effect), excludes them from the text-annotation list (chip-represented, like valued riders), and passes `toggles` + `onToggle={onFollowup}` to its dice lines. The store wiring is the EXISTING `onFollowup → addFollowupEffect` channel (PlayCharacterMode → PlanStack → PlanRow → PanelRenderer) — zero new screen plumbing for the commit. The committed GATE (v2.1): PlanStack derives `committedEffectKeys` from `playStore.state.committed` (keys) and threads it PlanRow → PanelRenderer (`committedEffectKeys`, deny-by-default — the `addableOfferIds` convention); a toggle whose `committedKey` is absent from the set is dropped before resolution.
- `NoticeStrip`: text + dice only (its pre-#462 shape).

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json`:

- `rule.dnd-5e-2024.condition-frightened.record-frightened.name`
- `.effect-frightened.name`, `.effect-source-hidden.name`, `.source-back-in-sight.effect-cleared.name`
- `.fear-source-in-sight`, `.fear-source-out-of-sight` (NEW in v2)
- `.notice`, `.notice.body`, `.notice.body-hidden`
- `play.verbBuckets.CONDITION.frightened`
- DELETED in v2: `.source-out-of-sight.name/.description`, `.source-back-in-sight.name/.description`, `.source-out-of-sight-offer.*`, `.source-back-in-sight-offer.*`, `.notice.action-hide`, `.notice.action-reveal`

Tests (registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-frightened-record` — pre-record: ONLY the recorder exists (the two v1 toggles pinned absent), no notice; record → condition fact + representative flags 1 + notice exists, targets `[notice, dice.any]`
- `condition-frightened-source-hidden` — seeded committed [condition + hidden toggle] (INITIAL_EFFECTS — the yaml grammar has no commit step): `frightened.sourceHidden` 1, flags 0 (flags-off-is-OFF), notice STILL exists, both effects on the strip
- `condition-frightened-source-back-in-sight` — seeded [condition + reveal eviction]: sourceHidden 0, flags 1 (the restore pin); endTurn keeps both; a short rest clears BOTH effects + the notice (the permanent-ended-chip leak pin, folded here in v2)
- `condition-frightened-rest-clears` — seeded [condition + hidden]: long rest → condition 0 AND toggle gone, no stray chips, no notice
- `condition-frightened-skill-flags` — seeded [condition + hidden] + untrained leather don: derive-vs-derive no-conflict (contributions register at 0), armor-written flags STILL 1 while frightened-only flags go 0 — the honest residual
- `condition-frightened-hidden-with-poisoned` — seeded [condition + hidden] + record-poisoned: flags still 1 (the max dividend)

Unit pins (the yaml grammar cannot assert annotation values/bodies):

- `condition-frightened-notice.test.ts` — the toggle authoring end to end: both effects (keyed hide / empty eviction, both stamped `ruleGroupId: 'condition-frightened'`), both label keys, `offFact`, `governs` = the 22, `committedKey: 'frightened'`, same data both states; notice text-only, body flip, gone at condition 0; both templates + both chip labels in both locales; the module offers ONLY the recorder
- `condition-frightened-derives.test.ts` — gating driven through COMMITTED effects (v2's delivery): 1 visible, 0 hidden on ALL 22 (zeroed, not merely absent), 0 un-frightened; combine 'max' mode agreement with Poisoned's stateCombine (authored effect via apply)
- `PanelDiceLine-toggle.test.ts` — the chip: renders after the dice of a governed line, absent on ungoverned/sourceless lines, aria-pressed/label/effect per state, tap fires the commit callback with the CURRENT state's effect, span variants (non-editable, summary — no focusable), no-prop no-op
- `PanelRenderer-annotations.test.ts` (toggle describe) — the resolution: facts → on/off + label, chip-represented (no text annotation), tap routes `onFollowup` with the right effect per state, span when no handler; the committed gate — denied while `'frightened'` is out of the committed keys (no chip, no span, no text fallback) and DENY-BY-DEFAULT when the set isn't wired
- `PlayCharacterMode.test.ts` — screen-level: the toggle-carrying notice renders as TEXT in the strip (no button), and the screen's PlanStack `onFollowup` reaches the store's `addFollowupEffect`
- `PlanStackStoreReactivity.test.ts` — the committed gate END TO END through the real store + stack: planned-only record-frightened + an axe row → disadvantage shows, NO chip; endTurn, then a fresh axe row → the chip (button, aria-pressed) renders
- `playStore.test.ts` — the commit pin: `addFollowupEffect(hide)` → sourceHidden 1 + flags 0; `addFollowupEffect(reveal)` → keyed replace (never stacks) + flags restored; committed condition seeded via the effects fetch. The dependents dismissal pin stays beside it, with the committed-keys seam pin (planned-only → key out of `state.committed`, in `advertised`; endTurn → in) and the unassign strip pin (authored `ruleGroupId` → `unassignRuleGroup('condition-frightened')` evicts a committed hide).

## Execution rules

- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing the module
- TDD: RED (compiles, runs, fails for the right reason) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make validate-rules-schema`, `make check`, `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format` + `make format-check` before push; full `make test` before declaring done
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- i18n: BOTH locales; `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back)
- **STOP and discuss if any step proves unworkable**

## PRs

### PR1 — NoticeStrip button support (#456 roller precedent) — DELETED

Merged as #462, then deleted in the v2 rework: once Frightened's notice stopped
carrying `addsToPlan` (the chip on the dice lines is the control), the notice
button path had zero users, and the no-unused-code rule took it — props, button
branch, styles, `AnnotationAction.labelKey`, and the button test cases. The
row-side PanelRenderer `addsToPlan` path (its own PR) is untouched.

### PR2 — condition-frightened module (record, derives, toggle offers, notice button, seed)

Landed (commit b3c7c3a1) with the v1 shape: two illegal-but-visible picker
offers + the notice's addsToPlan button. All PR2 gates were green on that shape.

### PR3 (this branch, #463) — v2 rework: persistent committed toggle, dice-line chip

- [x] RED: `condition-frightened-notice.test.ts` (toggle authoring, offers-gone, labels), `PanelDiceLine-toggle.test.ts`, `PanelRenderer-annotations.test.ts` toggle describe, `playStore.test.ts` commit pin, reworked yaml (`record` offer-notExists, `source-hidden` targets) — 19 unit failures + 2 yaml failures pre-implementation
- [x] Engine `AnnotationToggle` channel + mirrors (`rules-view`, `ActiveAnnotation`); `AnnotationAction.labelKey` deleted
- [x] `condition-frightened.ts`: offers deleted, notice text-only, toggle authored
- [x] `PanelDiceLine` chip + `PanelRenderer` resolution/wiring; summary display-only variant
- [x] #462 path deleted (NoticeStrip revert, PlayCharacterMode forwarding, labelKey, tests)
- [x] i18n both locales (add 2, delete 9); yaml ×6 reworked to INITIAL_EFFECTS seeds
- [x] gates green; docs rewritten (this file)
- [x] v2.1 — codex P2 round (both review comments on the PR3 diff):
  - **4127417615, toggle commits off a merely planned row**: gated the chip on a COMMITTED condition — `AnnotationToggle.committedKey: 'frightened'` authored by the rule; PlanStack derives `committedEffectKeys` from `playStore.state.committed` and threads it PlanRow → PanelRenderer, which drops a gated toggle whose key is absent (deny-by-default, `addableOfferIds` convention). No chip in any form while planned-only → nothing to orphan on `removeFromPlan`; the engine CANNOT tell planned from committed (annotate's committed list folds advertised effects in), so the gate lives view-side. RED first: `PlanStackStoreReactivity` end-to-end pin + `PanelRenderer-annotations` gate cases.
  - **4127417623, unassign can't strip the LoS effects**: authored `ruleGroupId: 'condition-frightened'` on BOTH toggle effects (the javelin Slow follow-up idiom — the follow-up channel bypasses the plan fold's stamp). RED first: authored-shape pin + the store unassign strip pin (mirrors the javelin test).

## Out of scope

- can't-approach movement enforcement (no source position; notice text — the toggle is sight judgement, not movement verification)
- source IDENTITY (which creature frightened you — one undifferentiated toggle)
- inflicting fear on others (fear spells — NPC state)
- wisdom-save fear effects recording the condition automatically (future spell work)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- LoS history: the umbrella deferred Frightened in wave 2 over exactly this (conditions-remaining.md — "standing disadvantage vs per-source"); standing flags were the original default, the settings chassis died (build-time choices, wrong home for live combat state), the notice-button toggle was the 2026-09-25 landing, and the walkthroughs (2026-09-29) picked the persistent dice-line chip — the toggle lives where the disadvantage BITES.
- Wave-2's Poisoned landed the roller wiring these derives feed: `check.disadvantage` on record-check (core-events.ts), the skill/initiative/attack flag readers — ZERO roller work here.
- Poisoned's Cleave note applies identically (greataxe's Cleave secondary reads the attack flags — sight-gated now, same facts).
- Same 22-flag list as Poisoned — copy, don't share (module-local consts; share only if a third appears).
- Stray `frightened.sourceHidden` after condition chip-dismissal while hidden: inert (derives gate on the condition); reveal or rest clears.
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent).
