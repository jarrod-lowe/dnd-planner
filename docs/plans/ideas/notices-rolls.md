# Notices Rolls

Some notices - at least Searing Smite, maybe others - could benefit from a roller on the notice panel. In the case of searing smite, we have to re-roll the damage each of the targets turns. The target rolls the DC again, so we do not roll, and so do not want a roller for that - just for the damage which is us.

Check for any other notices that could benefit from a roller.

Lets work out how to add a roller to a notice.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Plan

### Key insight

The repo already owns the whole roller stack: `PanelDiceLine` (chip, roll, animation, options popover), `DiceRollToast` (equation toast), `rollTypeKey` (purpose → i18n). Notices are text-only `Annotation`s whose `values` channel is documented "never dice". The work is three additions: an authored `roll` field on `Annotation`; Searing Smite's burn notice populating it; `NoticeStrip` mounting `PanelDiceLine` from it, toasting via a helper extracted from `PanelRenderer`.

### Rules basis (srd52.txt, Searing Smite :10188-10203)

- :10195 "Duration: 1 minute" — **flat, NOT concentration** → multiple simultaneous burns are legal → `ssmite.burnDice` summing across targets is a real case, not theoretical.
- :10196-10199 — on-hit 1d6 fire; "At the start of each of its turns … the target takes 1d6 Fire damage and then makes a Constitution saving throw."
- :10202-10203 — "All the damage increases by 1d6 for each spell slot level above 1" (on-hit AND per-turn).
- Save DC basis not stated in the spell text; `spellcasting.saveDC` is the existing, unchanged inference.

### Decisions (settled via grilling — do not relitigate)

| #            | Decision                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criterion    | Roller iff the notice implies a roll the PLAYER makes. Hold Person/Sanctuary (enemy saves), Sentinel (no roll), concentration-style conditional saves → none.                     |
| v1 scope     | Only Searing Smite's burn notice qualifies today. Mechanism general for future notices.                                                                                           |
| Component    | Reuse `PanelDiceLine` (+ `DieChip`, `DiceRollToast`). No bespoke imitation.                                                                                                       |
| Lifecycle    | Ephemeral: local chip state + 4s toast, freely re-rollable. No writeBack, no plan recording, no history.                                                                          |
| Dice count   | Chip = `ssmite.burnDice`d6 (fact sums across burns). One tap, player splits dice across targets (d6s fungible). Never per-target rollers.                                         |
| Engine shape | New optional `roll?: AnnotationRoll` on `Annotation` — structured channel; `values` stays dice-free.                                                                              |
| Toast        | Extract shared helper from `PanelRenderer.handleDiceRoll`; both parents use it. Notice toast title = `$t(notice.source)`.                                                         |
| i18n         | Expect ZERO new keys (title from `notice.source`; `play.toast.rollType.damage`, `damage-type.fire`, die aria-label keys all exist). If a coverage test demands one: both locales. |

### Critical rules (carried from AGENTS.md)

- **Subagents do the work.** Main agent co-ordinates and talks to the human only.
- **TDD strictly.** RED tests must compile, run, not panic, fail for the intended reason.
- **NEVER commit while tests fail. NEVER commit to main.** Branch first.
- **All user-facing text through i18n**, both locales.
- **CSS Law**: existing tokens only.
- **A11y**: semantics, ARIA, contrast, keyboard.
- New rules: read `docs/RULE_GROUP_GUIDE.md` first.
- No `terraform` directly; avoid `find -exec`, `$(...)`, redirections, `sed`, `cd DIR; cmd`.
- `make test` omits `format-check` — run it before pushing.

### Traps

- `DiceEntry.damageType` is a `ValueSource` → author `{ string: 'fire' }`, never bare `'fire'`.
- `count` accepts a literal number; `facts={{}} vars={{}}` satisfies the required props (resolver never runs for literals). `editable` must be `true` or `handleRoll` no-ops.
- Damage dice may offer the normal/critical options popover — burn can never be crit-doubled. Inspect the gating; if it leaks to notice dice, add a PanelDiceLine opt-out prop TDD-first (default unchanged for panels).
- Do NOT add a new yaml scenario dir (grows `EXPECTED_RUNNABLE` + coverage gate) — extend the existing `searing-smite-burning-notice/test.yaml`.
- `assert-annotations.ts` has a unit twin (`tests/unit/rules-engine/assert-annotations.test.ts`) — extend both in the same change.
- No yaml schema validation exists (js-yaml blind cast) — only the TS interface + runner to touch.
- Collapse runs `{#if expanded}` inside the always-mounted div → collapsing destroys roll display. Accepted: rolls are advisory, the toast already fired.
- `PanelRenderer` refactor must keep its rider labels in the toast (pass as extra modifiers) — its suite will catch a regression.

### Files

| Path                                                                                   | Change                                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/rules-engine/types.ts`                                                        | `AnnotationRoll` interface + `roll?` on `Annotation`                                          |
| `src/lib/rules-engine/rules/searing-smite.ts`                                          | `annotate`: burn notice carries `roll`                                                        |
| `tests/integration/rules-engine/assert-annotations.ts`                                 | new `rolls` assert (whole-object `toEqual`, `targets`-style)                                  |
| `tests/integration/rules-engine/yaml-scenarios/searing-smite-burning-notice/test.yaml` | add `rolls` assert on the burn notice                                                         |
| `src/lib/components/play/panel-renderer/diceRollToast.ts`                              | NEW — shared `showDiceRollToast(title, result, extraModifiers?)` extracted from PanelRenderer |
| `src/lib/components/play/PanelRenderer.svelte`                                         | `handleDiceRoll` delegates to the helper (rider labels → extraModifiers)                      |
| `src/lib/components/play/NoticeStrip.svelte`                                           | cell mounts `PanelDiceLine` when `notice.roll` present; `onRoll` → helper                     |
| `src/lib/components/play/panel-renderer/PanelDiceLine.svelte`                          | only if the crit popover leaks: opt-out prop                                                  |

`AnnotationRoll` shape (engine-side plain strings, `WeaponDef.damageType` convention):

```ts
{ sides: number; count: number; purpose: RollPurpose; damageType?: string; unit?: string }
```

Searing Smite populates `{ sides: 6, count: f.num('ssmite.burnDice'), damageType: 'fire', purpose: 'damage' }`. `NoticeStrip` maps it to `{ type: 'dice-line', dice: [{ sides, count, damageType: { string }, purpose }] }`.

## Checklist

### Phase 0 — setup

- [x] Branch off main (`notices-rolls`)
- [x] Dev server check (`pgrep -f vite.js`) — not running; start before Phase 7 Playwright
- [ ] Read `docs/RULE_GROUP_GUIDE.md` §1 + §7 (delegated to Phase 1–3 agent)

### Phase 1 — engine type (RED → GREEN)

- [x] RED: `notice-annotations.test.ts` — ride-through is type-level RED (annotations pass by reference, so runtime passes pre-GREEN; `make check` 5 errors all naming `roll`); scaffolding interface used then removed after GREEN (notices.md precedent)
- [x] GREEN: `AnnotationRoll` + `roll?` in `types.ts` (doc: dice allowed here — rolled, never printed; `values` stays dice-free)
- [x] `make check` — 0 errors / 5 warnings = baseline parity. `AnnotationRoll` not in index barrel yet (one-liner for Phase 5 if wanted)

### Phase 2 — yaml assert vocabulary (RED → GREEN)

- [x] RED: `assert-annotations.test.ts` — 2 failures on wrong-roll + missing-annotation (rolls silently ignored pre-vocabulary)
- [x] GREEN: `rolls` loop in `assert-annotations.ts`, targets-style whole-object `toEqual`

### Phase 3 — Searing Smite notice roll (RED → GREEN)

- [x] RED: `searing-smite.test.ts` — count 1 at one burn, 2 across two concurrent burns (the intended sum)
- [x] RED: `searing-smite-burning-notice/test.yaml` — rolls assert `{sides:6,count:1,damageType:fire,purpose:damage}` (existing dir; no `EXPECTED_RUNNABLE` change). build/test-rule-groups.json regenerated via the sync script directly (94 groups) to avoid racing the parallel agent
- [x] GREEN: `annotate` populates `roll` from `f.num('ssmite.burnDice')`; comment explains summed count (flat 1-min duration → multi-burn legal; d6s fungible). Unit trio 32/32

### Phase 4 — shared toast helper (RED → GREEN)

- [x] RED: new `showDiceRollToast.test.ts` — fires `toast.custom(DiceRollToast, …)` with translated rollType, adv/dis modifier labels, formatted `result.modifiers`, `damageTypeKey`/`unitKey` (mock svelte-sonner) — 6/6 RED on stub throw. **Renamed** from `diceRollToast.test.ts`: case-insensitive FS collision with sibling `DiceRollToast.test.ts` (first write clobbered it; restored byte-for-byte, then renamed)
- [x] GREEN: `showDiceRollToast(title, result, extraModifierLabels?)` in `panel-renderer/diceRollToast.ts`; PanelRenderer delegates, keeps `onRoll?.()` + rider loop (pushes raw i18n keys — helper translates). i18n in .ts via repo idiom `get(t)('key')` (playStore precedent). PanelRenderer suite + older tests/unit/svelte duplicates green (52 files/656 + 5 files/61); `make check` 0 errors

### Phase 5 — NoticeStrip roller (RED → GREEN)

- [x] RED: NoticeStrip.test.ts — roll-notice renders die-chip `<button>` (`2d6`, purpose-derived aria-label, no options trigger); click w/ Math.random=0.4 → chip `6` + `showDiceRollToast(source key, result total 6)` once; no-roll notice → no chip; 13 pre-existing tests green through RED
- [x] Crit popover DID leak (`hasOptions` gated only on isD20||isDamageDie, no writeBack gate — panels rely on it) → added `criticalOption` prop to PanelDiceLine (default `true`, panels unchanged; `false` removes the trigger entirely — a Normal-only menu is meaningless). 4 RED→GREEN tests
- [x] GREEN: `noticeRollControl()` maps roll → literal control; PanelDiceLine mounted (editable, empty facts/vars, `criticalOption={false}`); `onRoll` → `showDiceRollToast($t(notice.source ?? notice.key), result)`; barrel export `AnnotationRoll` added
- [x] CSS: `.notice-strip__roll { margin-top: var(--spacing-xs) }` — existing token only; chip styling stays PanelDiceLine's
- [x] A11y: chip button + purpose aria-label asserted. Test-infra note: `mount()`ed PanelDiceLine needs `flushSync()` settle before click (pending $effect batch wipes an early roll otherwise) — harness artifact, commented in test

### Phase 6 — refactor pass

- [x] No bespoke roll UI (full reuse); strings all via $t; scoped eyebrow CSS kept per repo idiom; no rule files touched. Final: NoticeStrip 15/15, PanelDiceLine-critical 12/12, play dir 52 files/662, `make check` baseline, format clean

### Phase 7 — verify

- [x] `make test-unit` — 192 files, 2394 passed | 7 skipped
- [x] `make check` (0 errors / 5 warnings — all pre-existing; PanelDiceLine's 3 `state_referenced_locally` verified pre-branch via diff); `make lint`; `make format-check` clean; `make format` not needed
- [x] `make test` (full) — terraform validate ok, schema 90 files, e2e 16 passed
- [x] Playwright on `http://localhost:5173`: seeded char already had a burn active (no cast-drive needed) — roller renders in burn cell (d6 chip + Fire icon, **no options trigger**); roll → chip total (3, then 4); toast renders (user-confirmed live; 4s expiry is the shared convention — first "missing toast" was my query slower than the window, helper verified rendering at +300ms); collapse → region hidden, expand → chip back unrolled (ephemeral, by design); Sentinel notices no chip; dark theme tokens correct (computed styles)
- [x] `make deploy-test` running in background (rule module ships in the frontend bundle; `sync-rule-groups` unnecessary — yaml unchanged; deploy invalidates the CDN)
- [x] Commit f9606f8c (SSH-signed via `rebase -f -S` after initial unsigned commit — local `%G?` reads N/E for ALL commits incl. merged ones, an allowedSignersFile config gap; signature verified present via `cat-file`), force-pushed, no attribution lines. PR https://github.com/jarrod-lowe/dnd-planner/pull/429
- [x] Review check scheduled 13:33 (~15 min post-push)

### Post-review amendment (user request, 13:26)

- [x] Roller repositioned from under the body to the RIGHT of the cell — `.notice-strip__content` wrapper (column rhythm kept) + row-flex cell, chip right-aligned, vertically centred, `flex-shrink: 0`; no-roll cells pixel-identical. TDD: 2 RED (structure + DieChip-style source-reading layout asserts) → 17/17; browser-verified geometry (chip right, centred, content wraps beside). Commit `2fca4aaa`, pushed to PR #429 before the review check fired

### Phase R — one notice per burn (PR #429 review P2; supersedes the Q5 "summed roll" decision)

Decision: **B** — per-burn notices, chosen over rollers-on-effect-chips (C) with full knowledge of the costs: Active State chips stay roller-free; the engine contract grows.

- [x] R1 engine: `annotate` gains the committed-effects list — `(f: FactReader, committed: EffectInstance[])` (additive; types.ts, annotate.ts, engine.ts); `Annotation.id?: string` (effect-instance identity; rides through `evaluate()`). RULE_GROUP_GUIDE §1+§7 read; RULES_ENGINE.md + guide §annotate updated. Contract nuance the yaml forced: the engine passes the effects IN FORCE — committed PLUS this turn's advertised, `dedupeByKey` newest-wins (the exact set whose state settled `f`) — because the burning-notice scenario asserts the notice at the `addOffer` step, where the burn is advertised, not yet committed. 6 pre-existing direct `annotate`/`collectAnnotations` test callers updated with `[]`. RED: 2 runtime probe failures (committed undefined) + 9 `make check` errors naming `id`/the 2-param signature; GREEN: rules-engine 413/413, check 0 errors
- [x] R2 searing-smite: one notice per live burn (match `#effect-searing-smite` id suffix; the `-slot-lN` spends don't match), `id` = effect instance id, `roll.count` = that effect's `display.value` (notice still emitted without a roll if a future burn omits it), dc unchanged; summed `ssmite.burnDice` no longer read in annotate. Dual-burn unit rewritten (slot-1 + slot-2 casts → 2 notices, distinct ids, 1d6 + 2d6); zero burns → zero notices kept. RED 3 (id undefined ×2, 1 notice ≠ 2); GREEN: unit 413/413, yaml `searing-smite-burning-notice` unchanged and passing (advertised AND post-endTurn committed steps), integration 382/382, check 0 errors
- [x] R3 NoticeStrip: `cellKey()` helper → keyed each `notice.id ?? notice.key`. RED was a real `each_key_duplicate` hard-crash on mount (Svelte 5 throws, not mis-renders). 3 tests added (two same-key/distinct-id → two cells + ×2 badge; id-less fallback; per-cell chips `d6`+`2d6` with independent roll state and per-notice toasts). 20/20
- [x] R4 verify: gates 2402 unit/integration + 16 e2e green (warnings exactly baseline); browser (see below); commit `968146b6` (signed first try) pushed; inline reply posted on the Codex review comment (fixed — per-burn, with the three-burn browser evidence; one edit to repair backtick mangling from shell quoting); deploy-test running; review check scheduled 14:46
  - Browser (before gates): char had THREE burns live (1d6, 1d6, 2d6 — extra casts driven earlier) → three Burning notices, each own roller, no crash; 2d6 rolled `4`, both 1d6 chips untouched (independent state)

## Out of scope

- Rollers on other current notices — none qualify under the criterion
- Per-target burn rollers; recording/applying damage anywhere; roll history, log, sounds
- Click-to-plan on notices (still deferred)
- Concentration check relocation — it already has a plan-row roller
