# Condition: Frightened

The LAST of the 14 — wave-2's deferred straggler. History: deferred over the line-of-sight qualifier; replanned 2026-09-25 around a LoS notice-button toggle (#461/#462) which was ABANDONED (#462 reverted in #464, #463 closed superseded). **User-directed 2026-09-29: assume the source of fear is always within line of sight** — landed as PR1/#465 (standing flags). **Follow-up (user-directed 2026-09-29, later same day): mechanise LoS as an Aura-of-Protection-style chip on the choice** — default on, sticky across rolls, state flows through the committed-effects plan cycle (never a global). PR2 below. See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: Poisoned's full flag SET (22, all `combine: 'max'`) — PR1 effect-wrote them standing; PR2 moved them to DERIVES gated `condition.frightened > 0 && frightened.sourceHidden === 0` (unset = in sight = flags on, the free default). Can't-approach = notice text (no source-position model).

## Decisions (defaults — re-grill before execution)

- **LoS: assumed always (user-directed 2026-09-29)** — standing flags, no toggles, no derives, no UI work. SUPERSEDES both the 2026-09-25 notice-button toggle replan (abandoned: #462 reverted, #463 closed) and the pre-replan per-die-override idea. Notice/detail copy KEEPS the SRD-verbatim sight qualifier — text ahead of mechanics; the deferred LoS PR makes behavior catch up. **Follow-up landed the same day (PR2): dice-line chip.**
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
- [x] gates (`make check`, `make test-unit`, `make format-check`) → PR → close #463 (superseded) → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod) — on branch `condition-frightened`; merged as #465, all checks + manual pass

### PR2 — line of sight (user-directed: Aura-of-Protection-style chip on the choice, default on, sticky, flows through the plan — never a global; one folded PR because an engine-only slice has no hands-on testable surface)

**Reworked mid-review (user-directed, after hands-on)**: the first cut read ONE shared seed fact live — every chip flipped together, which played as a global. The corrected model is PER-ROW: each planned row CAPTURES its sight value at add time (the store's capture pass, the loadout capture-var idiom generalized to the toggle channel); a tap writes the ROW's selection (previous rows never move) and commits the seed effect future rows capture. Engine consequence (user-confirmed): **Frightened contributes NONE of the 22 shared flags** — a max-combined flag cannot be subtracted per row — so the chip itself forces the disadvantage roll-mode, and flag sources (Poisoned/Blinded/armor) stay source-pure and combine per row. Record scenario now asserts flags 0 + chip present.

- [x] RED: 4 scenarios (`source-hidden`, `source-revealed`, `hidden-with-poisoned`, `rest-clears-toggle`) seeded via INITIAL_EFFECTS (the yaml harness has no mid-scenario commit step); `toggles` assert grammar added to assert-annotations.ts (rider style — effect instances stay unit-pinned)
- [x] engine: effect slims to `condition.frightened` + `dependents: ['frightened-source']`; keyed `frightened-source` seed effects (hide writes the fact; reveal = empty display-less same-key eviction; both `ruleGroupId`-authored — the follow-up channel bypasses the fold's stamping, javelin precedent; both untilShortRest); NO flag derives (per-row model)
- [x] `AnnotationToggle` channel (engine + view types + `ActiveAnnotation` pick) — `onWhen: 0` makes the UNSET fact pressed (defaults-to-on free); `appliesTo: ['to-hit', 'check']` keeps the chip off saves
- [x] capture-at-add: `captureToggleSelections` (annotations.ts, pure) folded into the store's `captureSelections` — a row added while the seed says hidden opens hidden, permanently its own
- [x] UI: PanelRenderer resolves `pressed` from the ROW's selection first (seed fact only as the picker fallback), passes `toggles` + `onToggleEffect={onFollowup}`; PanelDiceLine renders the chip in the modifier slot (`aria-pressed`, two distinct labels, reuses `.panel-renderer__modifier` styles; span indication when not editable; dropped in summary) and a PRESSED chip forces the disadvantage roll-mode (the per-row leg; flag sources OR in beside it)
- [x] tap → row `onSelectionChange` (this row only) + `addFollowupEffect` seed commit (synchronous re-eval, replace-by-key — N flips per turn never accumulate); notice body flips with the seed (`.notice.body-hidden`)
- [x] codex review round 1: onEffect/offEffect were assigned backwards (every tap a no-op recommit) — swapped + behavioural direction pin; toggle annotations excluded from `informationalAnnotations` (raw-key text beside the chip)
- [x] codex review round 2: chips gated on a COMMITTED parent (toggle carries `parentKey`; the store strips uncommitted-parent chips — a planned recorder removed pre-End-Turn would strand the persisted seed; engine annotate folds planned+committed by design, so the gate is view-side); legacy #465 flag blobs slimmed at the load seam (`slimLegacyFrightenedDisadvantage`, beside the keyless-concentration dismissal)
- [x] labels use the SRD noun phrase: "Source of fear in sight" / "Source of fear out of sight"
- [x] i18n both locales (`.los.in-sight`, `.los.out-of-sight`, `.effect-source-hidden.name`, `.notice.body-hidden`)
- [x] unit pins: `condition-frightened-los.test.ts` (flags-stay-0 in all states, seed eviction round-trip, chip mapping flips the seed, effect shapes, annotation contract, i18n distinct labels) + `captureToggleSelections` (annotations.test.ts) + PanelDiceLine chip tests (pressed/unpressed names, aria, both write directions, the FORCING trio — pressed forces / unpressed doesn't / a flag still applies beside an unpressed chip, span variants, save-line absence, summary drop)
- [ ] gates → PR → codex monitor → clean → `make deploy-test` → human inspects test env → human merges — on branch `frightened-los`

## Out of scope

- can't-approach movement enforcement (no source position; notice text)
- source IDENTITY (which creature frightened you — one undifferentiated condition)
- inflicting fear on others (fear spells — NPC state)
- wisdom-save fear effects recording the condition automatically (future spell work)
- backfilling seeded groups to pre-existing characters (prone known limitation)
- the LoS chip on notice-strip dice-lines (NoticeStrip mounts no toggles; the notice body flip is the awareness channel)

## Notes

- Abandoned approach (do not resurrect as-is): settings-chassis toggle (settings are build-time), notice-button LoS toggle (#461–#463 — UI chassis reverted; re-derive from first principles if LoS work resumes)
- Poisoned's Cleave note applies identically (greataxe's Cleave secondary reads the attack flags — already wired)
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent)
