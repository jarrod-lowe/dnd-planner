# Move defaults: derive captures from the row's prefix

Adding a move to the plan opens on the wrong amount; swapping a move (OR INSTEAD) opens on
the previous value / 0 / negative. Every add/swap must default to **as much movement as is
legal** — remaining at the row's position in the fold. Fix must be correct by construction:
no call-site discipline (flush / pick-the-right-facts) — that is doomed to failure.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Problem

Move offers' slider default is `{ fact: 'character.movement.remaining' }` (or
`half_remaining`), `capture: true` — resolved ONCE, at add/swap time, outside the fold, from
`state.facts`. That read is wrong twice over:

1. **Wrong time** — `state.facts` is a display cache trailing the plan by
   `DEBOUNCE_MS = 300` (`playStore.svelte.ts:30`, written only in `performEvaluation`
   `:213`). `addToPlan` (`:401`) and `swapPlanItemRule` (`:606`) read it without flushing.
2. **Wrong slice** — it is the FINAL fold output (all rows). A row at index i must open on
   the PREFIX (committed + earlier rows — `plan.ts:126`); the final facts include the
   OUTGOING row's own spend.

The frozen capture then outranks derivation forever (`resolveValueSource.ts:21-29` UI,
`movement.ts:22-23` `apply`), unclamped (undefined → 0, negatives pass through).

Symptoms (speed 30, one row):

| Action                                     | Today                         | Cause                 |
| ------------------------------------------ | ----------------------------- | --------------------- |
| add Walk, drag to 15, add Fly within 300ms | Fly opens 30 (2× the 15 left) | stale cache           |
| swap Walk@15 → Fly                         | opens 15 (old value)          | final facts: 30−15    |
| swap Walk@30 → Fly                         | opens 0                       | final facts: 0        |
| swap over-committed Walk@35 → Fly          | opens −5                      | final facts negative  |
| MOVE chip → Dash, swap to Walk             | opens 60 (2× speed)           | final facts: Dash +30 |

Architectural framing: the engine fold is pure (`plan.ts:78`); the store broke "operations
take state in, return varied state" by resolving row INPUTS from a time-lagged cache of
OUTPUTS. Identical plans behave differently depending on add/swap history.

Root cure: stop reading the output cache for input resolution at all. `plannedItems` +
`committed` are the synchronous source of truth; a row's opening facts are a pure function
of them — the same inputs the fold itself uses at that row. Then the debounce cannot affect
correctness (nothing to flush) and the only parameter is the row index (structural: append →
length, swap → the row's index). No discipline to forget.

## Decisions

- New pure seam: `factsBeforeRow(modules, committed, refs, index)` — evaluates
  `refs.slice(0, index)` via the same `evaluate` + `adaptEngineOutput` bridge
  `performEvaluation` uses → view facts (loadout/spell-prepare captures read
  view-synthesized facts).
- One store helper `captureSelections(rule, index)` wraps it + `resolveInitialSelections`.
  `addToPlan` (index = items.length) and `swapPlanItemRule` (index = row's) call it; NO
  facts argument at call sites — nothing to pass wrong.
- **No flush** in these paths — capture reads source of truth, not the lagging cache.
  Correct by construction; debounce-independence pinned by test.
- A choice and its swap receive identical facts — same function the fold uses (#438
  semantics, `evaluateCharacter.ts:69-83`).
- Numeric fact captures clamp at the var's authored `min` (`VarDefinition.min`,
  `resolveInitialSelections`): prefix `remaining` can be negative when earlier rows
  over-commit (planner projects over-commit by design), so the movement/steed `distance`
  vars author `min: 0`. NO global floor — signed captures (save/skill bonuses) are
  preserved verbatim (codex P1 on PR1).
- `capture: true` freeze-at-add semantics KEPT (untouched rows don't track later edits to
  earlier rows — semantics choice, out of scope).
- Slider max stays `total`/`half_total` — over-commit dragging stays (illegal-but-visible).
- Prefix-evaluate throw → skip capture (rule's own defaults); never block the add/swap.
- `addOfferToPlan` KEEPS its flush — it reads the offer CATALOG (gate freshness), a
  genuinely cache-shaped need; unrelated to this cure.

## Design

- `evaluateCharacter.ts`: `factsBeforeRow(modules, committed, refs, index): Facts` —
  `evaluate({ modules, inputFacts: {}, planned: refs.slice(0, index), committed })` →
  `adaptEngineOutput(...).facts`. Pure. (`performEvaluation` passes no inputFacts — same
  here.)
- `playStore.svelte.ts`: `captureSelections(rule, index)` = `resolveInitialSelections(rule,
factsBeforeRow(state.modules, state.committed, buildPlannedRefs(), index),
state.modules)` wrapped in try/catch → `{}` on throw. Wire into `addToPlan` +
  `swapPlanItemRule`; delete their direct `state.facts` reads.
- `resolveInitialSelections.ts`: numeric `fact` captures `Math.max(varDef.min, value)` only
  when the var authors a `min` (no `min` → verbatim; loadout / spell-prepare / string
  captures untouched).
- Reference diagram: `prefix-capture-flow.html` (this folder) — future-state data flow,
  ships with PR1 as the mechanism's documentation.
- Class coverage: fix is entirely in the generic path — movement rules untouched; every
  `capture: true` var (steed moves, loadout, spell-prepare, future offers) gets the same
  cure.

## Tests (RED first — store behaviour; engine math already pinned by yaml

`multiple-movement-types`)

- `tests/unit/play/evaluateCharacter.test.ts` extend, seam-style per
  `or-instead-gating.test.ts`, real `movement` module:
  - `factsBeforeRow` [Walk 15] index 0 → `remaining` 30 (own-row exclusion)
  - `factsBeforeRow` [Walk 15, X] index 1 → 15 (earlier rows count)
  - index 0 / empty plan → committed-only facts
- `tests/unit/play/resolveInitialSelections.test.ts` NEW: fact −5 → 0; undefined → 0;
  number default passthrough; loadout/spell-prepare untouched
- store regression, `vi.useFakeTimers()`, singleton pattern per `companionStore.test.ts`,
  real movement module loaded via store loader:
  - add Walk → drag 15 (no advance) → add Fly: 15 (RED: 30 — empty-plan facts still
    cached)
  - add Walk → advance → drag 15 → add Fly (no advance): 15 (RED: 0 — stale Walk@30
    facts)
  - swap evaluated [Walk 15] → Fly: 30 not 15; [Walk 30] → 30 not 0; [Walk 35] → 30 not
    −5
  - debounce-independence (now a structural pin): same assertions with NO timer advance
    after add/drag — identical results
  - multi-row: [Walk 15, X] swap X → Fly: 15 (earlier rows count)
  - guard: `addOfferToPlan` seed still beats capture; existing captures unaffected
- harness fallback: if driving the singleton store proves heavier than expected, fall back
  to seam-level tests + the thinnest store test that reproduces one symptom — STOP rule
  applies if neither works

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor
- Never commit to main; PR per slice; no commit attribution/co-author; signing: unsigned
  if 1Password locked, re-sign later, never block
- Per slice gates: `make check` (vitest skips type-check), `make test-unit` (yaml runner
  needs its build artifact), `make format-check` before push
- No user-facing text → no i18n keys. No rule-group/data changes → no
  `sync-rule-groups`/`deploy-test`
- Playwright sanity on <http://localhost:5173> (`pgrep -f vite.js` first): add/drag/add,
  swap each walk amount, over-commit swap — defaults read as max legal each time
- After each push: monitor PR for codex comments (~15 min delayed); triage validity; fix
  or discuss; until reviews + pipelines clean
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — `factsBeforeRow` seam + clamp + wire `addToPlan`

- [x] RED: `factsBeforeRow` seam tests (own-row exclusion; earlier rows count; empty) +
      `resolveInitialSelections` clamp tests + store add tests (Fly opens 15: no-advance
      variant REDs 30, post-advance variant REDs 0)
  - done: seam tests in `tests/unit/play/evaluateCharacter.test.ts` (real
    species-human+movement); clamp tests extended into the EXISTING
    `tests/unit/lib/play/resolveInitialSelections.test.ts` (plan said NEW file — one
    already existed); store tests `tests/unit/lib/play/playStorePrefixCapture.test.ts`,
    real engine path, no evaluation mocks. Second row is Walk not Fly: species-human
    writes `fly.can` 0 as the single override writer, so a committed fly-grant effect
    conflicts in the sheet combine — Walk is the offer reading `remaining` directly.
    REDs were exactly 30 / 0 as predicted.
- [x] `factsBeforeRow` (pure, `evaluate` + `adaptEngineOutput`); `captureSelections` helper
      (try/catch → `{}`); wire `addToPlan`; numeric clamp in `resolveInitialSelections`
  - done: clamp applies to numeric fact captures only (string/undefined/null unchanged);
    added a store guard test for the throw → no-capture path
- [x] GREEN; existing suites pass
  - done: the mocked-seam `playStore.test.ts` re-pointed at the prefix (display cache and
    prefix made to disagree); its evaluateCharacter mock gained `factsBeforeRow`;
    PlanStackStoreReactivity mock too. 2502 unit tests green.
- [x] commit `prefix-capture-flow.html` with the PR (reference doc)
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor →
      merge
  - gates green (check 0 errors, test-unit 2502 pass, format-check clean); PR open,
    merge pending
  - codex P1 review fix: the unconditional `Math.max(0, …)` floor on numeric fact
    captures broke signed captures (save/skill bonuses read negative legitimately) —
    clamp is now authored per var (`min?: number` on `VarDefinition`; movement factory +
    steed `distance` declare `min: 0`), no-min captures verbatim; tests repointed
  - second codex round (P2): lay-on-hands `amount` authored `min: 1` (remaining-resource
    capture class; a negative prefix could commit a refunding negative spend)

### PR2 — wire `swapPlanItemRule` from prefix

- [x] RED: store swap tests (30 not 15 / not 0 / not −5; multi-row earlier-rows-count;
      no-advance variants identical)
  - done: extended `tests/unit/lib/play/playStorePrefixCapture.test.ts` (same real-engine
    harness). Swap driven the UI way — entry from `getAlternativeEntries` (the
    hypothetical catalog), post-plan catalog as the in-debounce fallback, then
    `swapPlanItemRule`. Target is Fly (illegal-for-a-human but rendered + tappable in the
    picker — no committed fly-grant needed, unlike PR1's second-row add). REDs: Dash→Walk
    got 60; Walk@15 got 15; Walk@30 got 0; Walk@35 got 0 (−5 floors at PR1's authored
    `min: 0` through the old facts read — still the leftover, not max legal); multi-row
    got 0. One debounce-window pin (row just added, no advance) passes on main BY DESIGN
    — cache coincides with the prefix there; its settled twin is the RED.
  - Dash→Walk is the ORIGINALLY reported "2× speed" repro — MOVE chip defaults to Dash,
    user swaps to Walk; Dash's +30 `total` boost sits in the final facts. Manual repro
    confirmed 2026-09-24 (fresh character, top bar 30, swapped row 60, search-added row 30)
- [x] `swapPlanItemRule` uses `captureSelections(entry.rule, index)`; delete its
      `state.facts` read
- [x] GREEN; guards (seed beats capture; existing captures unaffected)
  - done: 2510 unit tests / 200 files pass — `playStore.test.ts` (93, incl. the
    seed-beats-capture guard) and the PR1 prefix tests untouched by the change
- [ ] gates → PR → codex monitor → merge; playwright sanity (all add/swap cases default
      to max legal)
  - gates green (test-unit 2510 pass, check 0 errors, format-check clean); PR open,
    merge pending; playwright sanity still to run against a dev server

## Out of scope

- live prefix-derivation defaults replacing `capture: true` entirely (untouched rows would
  track earlier-row edits — the full endgame; changes visible behaviour + every panel's
  facts plumbing; own idea if wanted)
- slider max → remaining-aware (over-commit dragging stays)
- Dash compounding (`dash.ts:33` re-adds current `total`; steed `dashed`-flag pattern is
  the fix — own idea)
- re-deriving captured defaults when EARLIER rows later change (frozen-at-add stays)
- `addOfferToPlan` flush removal (reads the catalog — cache-shaped need, stays)

## Notes

- Why no flush: the capture reads `plannedItems`/`committed` (synchronous source of
  truth), never the trailing cache — debounce is display throttling only, cannot affect
  capture correctness
- Engine purity untouched — capture becomes the same pure function the fold uses at that
  row; "state in, varied state out" restored at the store boundary
- Residual, deliberate: `resolveInitialSelections` still ACCEPTS a facts argument (pure,
  testable); the only store callers are `captureSelections` + the existing
  `addOfferToPlan` path — no facts-choosing call sites remain
- The post-swap ≤300 ms transient (row briefly rendered from the last evaluation's entry
  map) remains — pre-existing display behaviour, resolves on the debounce; out of scope
