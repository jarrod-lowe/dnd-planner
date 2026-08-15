# Spell Slots in the UI — Implementation Plan

Per-level spell slots in the play-mode ledger. Design ref: turn 8 of the
`Spell Slots Ideas` mock (Weave + Cast, hatched "this turn" state).

Rules: theme colour variables only (no new colours), semantic re-used CSS, no
hardcoded strings (i18n both `en` and `en-x-tlh`), ARIA/keyboard, TDD (RED must
compile, run, not panic, fail), HTML over JS.

## Behaviour during execution

- Main agent co-ordinates + talks to the human only. Each checklist item is
  executed by a subagent (`general-purpose`, or `svelte:svelte-file-editor` for
  `.svelte`). Subagent gets: the item, the TDD superpower, the critical rules
  from CLAUDE.md, and "STOP and report if the plan doesn't work".
- One subagent per checklist item, sequential (phases build on each other).
- Never commit to main; never commit with failing tests; no `Co-Authored-By`.

## Findings that changed the original draft

1. **No new facts. The engine cannot express "committed this turn".**
   `evaluate()` returns `plan.facts` — the _projected post-plan_ facts — so
   `spellcasting.slots.levelN.remaining` already nets off the current plan.
   `evaluateSheet` sees `[...committed, ...advertised]` merged and cannot tell
   them apart. The split exists only in the store: `state.committed` (prior
   turns) vs `engineOutput.effects` (= `plan.advertised`, this turn).
   ⇒ derive per-level state in a pure UI-layer module from
   `facts` + `engineOutput.effects`. No rules-engine change at all.
2. **The resources catalog is code, not YAML.** `deriveResourceEntries()` in
   `src/lib/play/derivePanels.ts` is a fixed facts-driven catalog; rule modules
   carry no display metadata. ⇒ no rule-group / YAML authoring.
3. Minor: `Ledger.svelte` hard-filters to `usedMax | hitDie` and keys the
   `{#each}` on `entry.total` — both need widening. Popover patterns to copy are
   `AddRowPicker.svelte` (aria-expanded + outside click) and
   `ReminderPopover.svelte` (Escape), not `UserDropdown.svelte`.

## Slot states

Distinguished by shape/texture **and** colour:

| State     | Pip                              | Tile                                    | Meaning                                   |
| --------- | -------------------------------- | --------------------------------------- | ----------------------------------------- |
| Open      | solid, `primary`                 | solid `primary`, digit `on-primary`     | Castable now                              |
| This turn | hatched, `tertiary`              | hatched `tertiary`, digit `on-tertiary` | Spent by the current plan, turn not ended |
| Spent     | 1.5px outline, `outline-variant` | outlined, digit `outline`               | Gone until a long rest                    |

Hatch = the `repeating-linear-gradient(-45deg, …)` already used by
`effect-chip--expiring`. Pip geometry = `effect-chip__pip` (0.5rem, 1.5px
border, 3px gap).

Per level, from `facts` and this turn's advertised effects:

- `total` = `spellcasting.slots.levelN.total`
- `spent` = `spellcasting.slots.levelN.spent` (projected: prior + this turn)
- `thisTurn` = Σ `effect.state['spellcasting.slots.levelN.spent']` over
  `engineOutput.effects`
- `open` = `total - spent`; `spentEarlier` = `spent - thisTurn`

## Phase 1 — Derivation (pure, no engine change)

New `src/lib/play/slotLevels.ts`:

```ts
export interface SlotLevel {
  level: number;
  total: number;
  open: number;
  thisTurn: number;
  spent: number;
}
export function deriveSlotLevels(facts: Facts, advertised: EffectInstance[]): SlotLevel[];
```

Levels 1–9, filtered to `total > 0`.

- RED: `tests/unit/lib/play/slotLevels.test.ts` — no slots ⇒ `[]`; 4 total /
  0 spent; 1 committed this turn; 2 at one level; 1 each at two levels; upcast
  (`slotLevel` selection above authored level) lands on the upcast level;
  prior-turn spend counts as `spent` not `thisTurn`; effects lacking the state
  key ignored.
- Also an integration test over a real evaluation (paladin + Bless planned)
  proving `thisTurn` tracks a planned spell and moves to `spent` after End Turn.

## Phase 2 — UI entry type

`src/lib/play/extractTopBar.ts`:

- `UiEntrySlotLevels`: `{ type: 'slotLevels'; label: string; levels: number[] }`
  — level numbers only; fact paths are `spellcasting.slots.level{n}.*` by
  construction (mirrors `hitDie`'s `dieSize`).
- Extend `isUiEntry`, both `UI_ENTRY_TYPE_ORDER` maps (`extractTopBar.ts` and
  the duplicate in `derivePanels.ts`), `resolveEntryValue` (compact
  `"open/total"` sum for the text/aria fallback), `isEntryVisible` (any level
  with `total > 0`).
- `RESOURCE_SHORT_LABELS`: `play.stats.spellSlots` → `play.ledger.short.spellSlots`.
- `deriveResourceEntries()` emits the entry when any `spellcasting.slots.levelN.total`
  is present — works for half-casters with no per-class code.
- RED: extend `tests/unit/lib/play/extractTopBar.test.ts` — guard accepts/rejects,
  visibility at 0 totals, level filtering, short-label lookup; new cases in the
  derivePanels test for emission/non-emission.

## Phase 3 — Ledger cell + tray

`Ledger.svelte` + new `src/lib/components/play/SlotTray.svelte`.

- Widen the `visibleEntries` filter to include `slotLevels`; replace the
  `entry.total` `{#each}` key with an `entryKey(entry)` helper (`total` for
  usedMax/hitDie, `label` for slotLevels).
- Cell: `<button type="button" aria-expanded aria-controls>` wrapping the
  existing `.ledger__cell-label` ("Cast") and a tile row replacing
  `.ledger__cell-value`. Tiles 18px, `--radius-sm`, 4px gap.
- Tray: one row per level — tile, pips, `open/total` — plus a legend row
  (Open / This turn / Spent) as real text. Anchored to the cell, `--z-dropdown`,
  `surface-container-high` on `outline-variant`, `--shadow-lg`. Escape closes
  (`<svelte:window onkeydown>` per ReminderPopover); outside click closes per
  AddRowPicker; focus returns to the button.
- Pass `effects={playStore.state.engineOutput?.effects ?? []}` from
  `PlayCharacterMode.svelte` into `Ledger`.
- a11y: tile row is one `role="img"` with an i18n aria-label ("Spell slots:
  2 open at level 1, 1 open at level 2"); each tray row labelled
  "Level 1: 2 open, 1 this turn, 1 spent, 4 total"; legend states the texture
  coding in words. Verify with the a11y MCP tools.
- RED: `tests/unit/lib/components/play/SlotTray.test.ts` +
  extend `Ledger.test.ts` — tile count/state per level, `total === 0` level not
  rendered, opens on click, closes on Escape, aria-labels carry the counts,
  this-turn state renders when an advertised effect spends a slot.

## Phase 4 — Rename Magic → Weave

Copy only; keys and facts unchanged.

- `play.ledger.short.spellcasting` "Magic" → "Weave" in `en` and a plausible
  tlh value in `en-x-tlh` (normal casing; all-caps is CSS).
- Add `play.stats.spellSlots` / `play.ledger.short.spellSlots` ("Cast") plus the
  tray/legend/aria keys to both locales.
- Grep tests + e2e for the literal "Magic" (currently only the two locale
  files) and for the new keys' absence.

## Phase 5 — Point-of-decision pips (optional, separate PR)

Options `1c`/`1e`: pips on `plan-row__alt-btn` spell chips and
`panel-renderer__annotation` rows that spend a slot. Needs no new facts — same
`slotLevels` derivation plus the existing `--illegal` dashed treatment for an
exhausted level. Not in this checklist.

## Risks

- **Hatch at tablet DPI.** 1.5px hatch in a 9px pip may muddy. Test on device;
  fallback = diamond pip (mock option `7a`), hatch kept on the 18px tile only.
- **Bar width.** Nine levels of tiles in one cell needs a check at the narrowest
  supported tablet width; if it wraps badly, collapse to a summed `5/6` below a
  breakpoint and keep the tray identical.
- **`thisTurn` correctness.** Every slot spend must go through an advertised
  effect whose `state` key is `spellcasting.slots.level{n}.spent`. Phase 1's
  integration test covers Bless; sweep the other slot-spending rules
  (`divine-smite`, `find-steed`, `command`, `sleep`, `hold-person`,
  `calm-emotions`, `sanctuary`, `spell-aid`, `prayer-of-healing`,
  `protection-from-evil-and-good`, `thunderous-smite`,
  `create-and-destroy-water`, `divine-favour`) for the same shape before
  shipping.

## Checklist

Phase 1 — derivation

- [x] Write RED unit tests `tests/unit/lib/play/slotLevels.test.ts` (cases above); confirm they compile, run, and fail
  - 12 tests. Genuine RED needed a signature-only stub first (a missing module fails resolution and runs no tests): 11 failed | 1 passed, then 12/12 green.
- [x] Implement `src/lib/play/slotLevels.ts` → GREEN
  - Traps for later phases: `EffectInstance.expiry` is **required**, so a bare `{ id, state }` test literal passes vitest but fails `pnpm check`; `Facts` values are `number | string | boolean | object`, so slot facts need numeric coercion, not a cast. A level is included on `total > 0`.
- [x] Write RED integration test: paladin + planned Bless ⇒ `thisTurn` 1 at the slot level; after End Turn ⇒ `spent`
  - `tests/integration/rules-engine/slot-levels.test.ts`. Drives `evaluate()` over the bless-cast group list via `resolveModules`, and crosses the turn boundary with the engine's own `endTurn()` — the same helper `playStore.endTurn()` calls. Prepare is committed on turn 1 so the plan under test is the cast alone.
  - The production code was already complete, so there is no module-missing RED to stage. Non-vacuity was proved by mutation instead: `thisTurn` forced to 0 fails the mid-turn assert (`thisTurn 1 → 0`), and `thisTurn` sourced from the projected `spent` fails the post-End-Turn assert (`thisTurn 0 → 1`). Both halves are load-bearing; the mutations were reverted.
- [x] Make it GREEN (expected: passes on the Phase 1 code; if not, STOP and report)
  - Passed unchanged — no production edit. Confirms the plan's finding #1: `evaluate()`'s `facts` + `effects` pair alone carries the this-turn/earlier split.
- [x] Sweep the slot-spending rules listed under Risks; confirm each advertises `spellcasting.slots.level{n}.spent`; note exceptions
  - All 14 use the exact key, value `1`, unkeyed (so repeated casts stack), `untilLongRest`, emitted only via `advertise`. No slot spend comes from `onRest`; no cast emits two slot effects. `rg` over `src/` proves the list complete. **The sum approach is sound.**
  - `prayer-of-healing` can reach levels 6–9 ⇒ the derivation must cover 1–9, not 1–5. (Already in the design.)
  - Free uses (Divine Smite / Find Steed at level 0) spend `paladinSmite.spent` / `paladinFindSteed.spent`, no slot ⇒ the cell must read as _slots_, never "spells cast".
  - `find-steed` also advertises an `endOfTurn` effect carrying `find-steed.selectedLevel` — a level number in a `state` map that is NOT a slot key. Match on the exact key, never a prefix.
  - Pre-existing engine quirks, out of scope, no fix here: a `slotLevel` outside a rule's guard (0 when exhausted, or 6–9 where the guard caps at 5) silently spends nothing in 11 modules; `create-and-destroy-water` / `divine-favour` advertise their level-1 spend unconditionally, so an errored row still counts 1.
- [x] `make test-unit`
  - 138 files, 1730 passed / 11 skipped. `pnpm check`: 0 errors (6 pre-existing warnings, none in the new files).

Phase 2 — UI entry type

- [x] RED: extend `tests/unit/lib/play/extractTopBar.test.ts` for `slotLevels` (guard, visibility, `resolveEntryValue`, short label)
- [x] RED: derivePanels test — entry emitted when a level total is present, absent for a non-caster
  - The derivePanels test lives at `tests/unit/play/derivePanels.test.ts` (note: `tests/unit/play/`, not `tests/unit/lib/play/`). RED was 8 failed / 71 passed.
- [x] Implement `UiEntrySlotLevels` + guard + both `UI_ENTRY_TYPE_ORDER` maps + `resolveEntryValue` + `isEntryVisible` + `RESOURCE_SHORT_LABELS` + `deriveResourceEntries` → GREEN
  - Order: `slotLevels` 4, `concentration` 5, `ability` 6, byte-identical in both maps. Sorts are stable, so relative order of existing entries is unchanged.
  - Consumer sweep found no exhaustive switches — only narrowing filters, so nothing broke. `Ledger.svelte` still drops the entry until its filter widens, so Phase 2 ships no visible change on its own.
- [x] `make test-unit`
  - 138 files, 1730 passed / 11 skipped. `pnpm check` 0 errors.

Phase 3 — components

- [x] Add i18n keys (tray, legend, aria templates) to `en` and `en-x-tlh` — required before component RED tests
  - 15 keys under `play.slots.*` plus `play.stats.spellSlots` / `play.ledger.short.spellSlots` ("Cast"), both locales, all double-brace interpolation.
  - A locale-parity test already existed (`tests/unit/lib/i18n/index.test.ts`); added `tests/unit/i18n/slots-tlh.test.ts` (5 tests) per the `hit-dice-tlh.test.ts` convention — param-set match, no single-brace `{param}`, no English leaking into tlh.
- [x] RED: `tests/unit/lib/components/play/SlotTray.test.ts` (tiles/pips per state, zero-total level absent, aria-labels)
  - 12 failed / 2 passed at assertion level (the 2 are true-by-construction on an empty shell), then 14/14 green.
- [x] Implement `SlotTray.svelte` (theme variables only, reuse `effect-chip__pip` geometry + `--expiring` hatch idiom) → GREEN
  - Props: `{ levels: SlotLevel[]; id?: string }`. The tray owns no open/close, Escape, outside-click or focus logic — all the Ledger's.
  - **Ledger must give the slot cell `position: relative`**: the tray self-anchors (`position: absolute` + `--z-dropdown`), per `AddRowPicker`'s convention. A bare `z-index` on an unpositioned element is inert.
  - Legend swatches reuse `.slot-tray__pip` rather than a bespoke class. Empty `levels` renders only the `id`-carrying shell, so an `aria-controls` reference stays valid.
  - axe (wcag2a/aa, wcag21a/aa) clean bar two bare-test-document artifacts. Svelte autofixer clean.
  - **Contrast caveat:** the spent pip is `outline-variant` on `surface-container-high` ≈ 1.3:1 in light theme — below the 3:1 non-text guideline, but byte-identical to the shipped `.effect-chip__pip` empty state, and the spent count is fully carried by the row aria-label, the `open/total` text and the legend. If the device check finds it invisible, escalate to `--md-sys-color-outline` (an existing variable).
- [x] RED: extend `Ledger.test.ts` — `slotLevels` cell renders, opens on click, closes on Escape, `entryKey` keeps other cells intact
  - 9 failed / 18 passed at assertion level; 10 new cases; GREEN 27/27.
- [x] Implement Ledger cell: widen filter, `entryKey()`, disclosure button, `effects` prop → GREEN
  - ~~One tile per slot, not per level~~ — **superseded by user review; see the design corrections below.** The original rationale (a mixed level can't carry three states in one tile) assumed the cell was a tally. It isn't: it answers "can I cast at this level right now?", so one tile per level with a state precedence is correct and the per-slot breakdown belongs to the tray.
  - Button's accessible name comes from its content ("Cast" + the `role="img"` tile-row label); an `aria-label` on the button would have swallowed the summary. `play.slots.toggle` is the `title`; `aria-expanded` carries the disclosure semantics.
  - Focus return is keyboard-only: Escape returns focus, an outside click does not (the click already moved focus; stealing it back fights the user).
  - Outside click uses a containment test against a wrapper that is never `{#if}`-swapped — the detached-node trap `AddRowPicker` documents.
  - This-turn tile backs the hatch with `tertiary-container` (rather than the tray pip's transparent) so the digit stays legible at 18px — a deliberate deviation from the plan's "digit `on-tertiary`".
- [x] **BLOCKED → resolved:** pass this turn's advertised effects from `PlayCharacterMode.svelte`
  - Implemented: `PlayState.advertised: EffectInstance[]` (`src/lib/play/types.ts`), set from `result.advertised` in the reactive `state` update, `[]` in `initialState` (so `reset()` clears it) and on the engine-error path. `_lastAdvertised` still feeds `endTurn`'s aging, unchanged. `PlayCharacterMode.svelte` passes `effects={playStore.state.advertised}`; `Ledger.svelte` needed no change.
  - Regression guard (4 store tests): the `state` map survives to `state.advertised`, while the same injected effect has **no `state` property at all** on `engineOutput.effects` — the bug pinned in a test. Plus cleared at End Turn, on `reset()`, and on an engine throw.
  - The plan's `effects={playStore.state.engineOutput?.effects}` **cannot work**: `engineBridge.ts:185` maps every effect through `effectInstanceToRule()`, which discards the `state` map (view `Rule` has no `state`). `thisTurn` would be permanently 0 in the real app while unit tests — which inject real `EffectInstance`s — stayed green. Caught by `pnpm check`, not by any test.
  - The raw list exists only as module-private `_lastAdvertised` (`playStore.svelte.ts:62`).
  - Precedent that settled it: `PlannedEntry.advertisedEffects?: EffectInstance[]` already crosses into the view layer (`rules-view/types.ts:552`, `adapter.ts:59`) and `PanelHitDice.svelte:99` already sums effect `state` from it.
  - **User decision: Option 1** — expose the advertised list on the store, placed in the reactive `state` object (a bare getter over the module variable would not trigger re-render). Ledger's prop and its 27 tests stay as written.
- [x] a11y pass with the a11y MCP tools (contrast, ARIA, keyboard); fix findings
  - First attempt was stopped mid-run: it drove a REAL character ("Sami") rather than a test one. Nothing was committed — End Turn was never pressed, so the only change was one uncommitted plan row (local-only, clears on reload). **Any browser check must target `TestCharacter` and nothing else, and must check the on-screen name first: the app auto-loads the last-used character, which is `Sami`.**
  - `TestCharacter` needed no setup — already Paladin 6 with 4 level-1 and 2 level-2 slots. Two slot levels is the app's ceiling: `class-paladin-level1/3/5` are the only rules anywhere contributing slot totals.
  - **ARIA: 0 violations** collapsed and expanded. Keyboard verified live: Tab reaches the cell, Enter and Space both toggle, Escape closes and returns focus.
  - **`mcp__a11y__check_color_contrast` is unreliable** — for any pair outside its axe pass-data table it returns a hardcoded `4.5` / `passesWCAG2AA: true`. Ratios were computed in-page from live tokens instead. Do not trust that tool in future passes.
  - Measured (light theme): open pip/tile 5.25–5.55:1 · this-turn hatch 5.04–5.30:1 · digits 6.44–7.23:1 · tray text 7.61–13.98:1 · **spent pip 1.39:1** (the documented caveat, confirmed; faint but discernible at device DPI). `--md-sys-color-outline` would give 3.65:1 — open question with the user, deliberately not changed unilaterally.
  - `mcp__a11y__test_accessibility` can only reach the unauthenticated landing page (its browser has no session); its 6 violations are pre-existing landing-page copy. The ledger/tray markup was audited via `test_html_string` instead: 0 real violations, 26 passes.

Design corrections from user review of the live UI

- [x] Ledger cell: **one tile per spell LEVEL**, not one tile per slot (overrules the earlier per-slot decision). Tile state precedence: open if `open > 0`; else this-turn if `thisTurn > 0`; else spent. The tray keeps one pip per slot.
  - RED 8 failed / 24 passed; the per-slot test was rewritten into six level-contract cases, not deleted. `slotTiles()` replaced by a pure `slotTileState(level)`. The `role="img"` row label was already a per-level open summary, so it stayed correct unchanged.
- [x] Ledger cell needs a visible affordance that it opens (caret/chevron, `aria-hidden` — `aria-expanded` already carries the state).
  - Inline stroked SVG chevron following the existing `UserDropdown` / `PackedChoiceGroup` convention (24×24 viewBox, `on-surface-variant`, `--transition-fast`, rotate on expand). Points **up** by default since the tray opens upward, flipping down when expanded.
- [x] Tray must open **ABOVE** the cell — the resources ledger is pinned to the bottom of the viewport, so a downward drop is clipped.
  - One declaration: `top:` → `bottom: calc(100% + var(--spacing-xs))`. No `transform-origin` or entry animation existed to flip. `--shadow-lg` deliberately kept: all four shadow tokens are downward-only because Material's light source is fixed overhead, so an upward variant would mean inventing a token.
  - **Not unit-testable here** — vitest never loads component CSS into jsdom (probed: `STYLE_TAGS 0`, `POSITION static`), so any `getComputedStyle` assertion would pass identically before and after. Left untested rather than hollow-tested; needs the browser check.
- [x] Drop the explanatory sentence under the key (`play.slots.legendHint`), including the key in both locales. The legend's own words plus each row's aria-label still keep the texture coding out of colour-only territory.
  - Key deleted from both locales (parity verified with `jq`); `REMOVED_SLOT_KEYS` guard added so its return would go red. A11y re-confirmed: legend words are real text, every row's aria-label carries all four counts, pips are `aria-hidden` by construction.
  - Leftover: a dead `legendHint` mock entry at `tests/unit/lib/components/play/Ledger.test.ts:40` (inert, other agent's file at the time).

Phase 4 — copy

- [x] `play.ledger.short.spellcasting` → "Weave" (`en`) + tlh value ("mugh"; tlh had literally said "Magic" — a canary miss, now fixed)
- [x] Grep repo for the literal "Magic" and for stale expectations in unit/e2e tests; update
  - No test or e2e asserted on the label — nothing to update. Remaining "Magic" hits are unrelated: the `play.stats.sections.magic` panel heading and a `spear-plus1.yaml` item name.
  - Out of scope, worth a later pass: the rest of the `en-x-tlh` `play.ledger.short.*` block (ACT/BON/RXN/HP/SPD/HAND/HD/CD/LoH/Smite/Steed/Savage + the steed sub-block) is still English — pre-existing canary misses.
- [x] `make test`

Final

- [x] `make lint` and `make format`
  - eslint clean; Prettier rewrote only this plan doc.
  - Also fixed the now-wrong comment on `Ledger.svelte`'s `effects` prop: it documented `engineOutput.effects` as the source. Rewritten to name `playStore.state.advertised` and to warn that re-wiring to the bridged list silently zeroes every count.
- [x] `make test` (full) — all green
  - `validate` (terraform test+prod, pre-existing deprecation warnings only) · Trivy 13 files, 0 misconfigurations · rules schema 82 files · `pnpm check` 0 errors / 6 pre-existing warnings · vitest **140 files, 1763 passed / 11 skipped** (incl. the yaml runner's 353) · vite build + Playwright e2e **16 passed** (chromium + tablet) · eslint clean.
  - No warnings in any file this feature touched.
- [x] Playwright check on <http://localhost:5173>: tiles render, tray opens, this-turn hatch appears when a spell is planned and moves to spent after End Turn
  - All three tile states confirmed live through cast → End Turn → cast → End Turn. One tile per level, caret rotates, tray opens upward, legend has no hint sentence, "WEAVE" shows in the bar.
  - **DEFECT FOUND AND FIXED — right-edge overflow.** `.slot-tray` used `left: 0`, but the Cast cell is always the last cell, so the tray ran 90px off-screen at 1080px and 48px at 1024px, with `scrollWidth` unchanged — the counts and the "Spent" legend item were genuinely unreachable. Fixed with `left: 0` → `right: 0`, verified by bounding box at both viewports (every element now `inside: true`, tray flush with the cell's right edge).
  - Safe because the Cast cell can never be flush-left: it sorts last (`slotLevels` order 4), and any character with slots necessarily has HP, actions and Lay on Hands cells before it.
  - Like the open-upward flip, this has **no unit-test coverage** — vitest never loads component CSS into jsdom. Both are CSS-positioning behaviours that only a browser can catch, which is exactly how this defect surfaced.
- [x] Screenshot at the narrowest supported tablet width; confirm the width risk
  - **Both documented risks are clear.** Hatch reads correctly at 9px pip and 18px tile — no diamond fallback needed. At 1024×768 all 14 cells fit one row; a simulated nine-level worst case wraps onto a second ledger row, legible and unclipped, so the `5/6`-collapse fallback is **not needed**.
- [x] Branch off main, commit (no AI attribution in the message)
  - Branch `spell-slot-display`, commit `6bb17020`. `docs/plans/ideas/_sample.md` was deliberately left out — it is a pre-existing local edit unrelated to this feature.
Review feedback — PR #386 (Codex, automated)

- [x] **P1 "Use a theme token for the hatch color"** (`Ledger.svelte`) — **rejected, false positive.** `color-mix(in srgb, var(--token) N%, transparent)` derives an alpha from an existing theme variable; it does not invent a colour. It is the established idiom here: `EffectChip.svelte:241-242` uses exactly it for the `--expiring` hatch this deliberately mirrors, and six components use `color-mix` in total. No change.
- [x] **P2 "Clamp slot breakdowns for illegal over-budget plans"** (`slotLevels.ts`) — **rejected by user decision.** The defect is real (an over-budget plan drives `spent` past `total`, so the tray shows `-1/2` and announces "-1 open"), but the user ruled the negative is correct: *"Showing -1 spell slots is valid if the player plays spells illegally."* The ledger already flags over-budget separately, so the number's job is to say how far over.
  - Pinned rather than left implicit: a comment on the `open` computation and on `SlotLevel.open` forbidding a clamp, plus regression tests in `slotLevels.test.ts` and `SlotTray.test.ts`. Non-vacuity proved by applying a clamp in three places in turn and watching each assertion fail, then reverting.
  - Confirmed not broken, just negative: `pipRun()`'s `Math.max(0, …)` keeps the pip run sane (3 pips, no negative-length run).

- [x] Open PR
  - **Spent-pip contrast: user accepted 1.39:1 as shipped**, on the grounds that the three states differ by shape/texture (solid / hatched / outlined), not colour alone — so the low-contrast ring is never the sole carrier of meaning. `--md-sys-color-outline` (3.65:1) stays documented above as the escalation if that judgement changes.
