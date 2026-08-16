# Simplify Resources

Recently, we added a new type of display into the resources panel.

I'd like to re-use it to collapse Actions, Bonus Actions, and Reactions into one display using the same system.

Re-use code where possible, in preference to writing new code.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Plan — Action-economy tray (re-uses the spell-slot display)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (or superpowers:executing-plans). Checklist items are the steps.
> TDD: RED must compile, run, not panic, fail. Never commit while tests fail.
> Rules: theme colour variables only, semantic re-used CSS, i18n both `en` +
> `en-x-tlh`, ARIA/keyboard, HTML over JS.

**Goal:** one ledger cell + disclosure tray for Actions / Bonus Actions /
Reactions (player **and** steed), replacing the three `usedMax` cells. Zero
rules-engine change.

**Architecture:** mirror the spell-slot pipeline — pure derivation
(`actionPools.ts`) → `UiEntry` type (`actionPools`) → Ledger cell + generalized
`SlotTray`. Slot machinery is generalized, not duplicated.

**Decisions (grilled, settled):** replace old cells entirely (delete, no
option); three tiles + expand toggle, names in tray; cell short label reuses
"ACT" (`play.ledger.short.actions`); steed included (2 pools, no reactions);
cell stays where ACT sat (after HP); `open` stays unclamped — over-budget
negative is the overdraft signal (same doctrine as slots). **Post-review user
feedback:** the point is saving ledger width — cell tiles show single letters
A/B/R (`play.economy.tile.*`), tray keeps ACT/BON/RXN.

### Findings

1. Facts: `actions|bonusActions|reactions.max/.spent/.remaining`
   (`rules/action-economy.ts:11-21`); steed:
   `companion.steed.actions|bonusActions.*` (`find-steed.ts:50-51`, no steed
   reactions fact). Every spend is `endOfTurn`-scoped ⇒ `earlierSpent` is
   always 0 today; keep the split anyway (free, matches slots).
2. The resources catalog is code, not YAML (`derivePanels.ts` RESOURCES /
   STEED_CORE). No new rules ⇒ no yaml-scenario changes, no
   `make sync-rule-groups` needed.
3. `Ledger` already takes `effects` (raw advertised `EffectInstance[]` from
   `playStore.state.advertised`) — required for `thisTurn`. Never re-wire to
   `engineOutput.effects` (bridged list drops `state`).
4. Short labels are ledger-only (`RESOURCE_SHORT_LABELS`); the top bar is
   untouched by this change.

### Design

**Phase 1 — derivation** `src/lib/play/actionPools.ts` (mirrors `slotLevels.ts`):

```ts
import type { Facts } from '$lib/rules-view';
import { endsOnRest } from '$lib/rules-engine';
import type { EffectInstance } from '$lib/rules-engine';

export interface ActionPool {
  /** Fact key, e.g. 'actions'. */
  key: string;
  /** Pool size — the `.max` fact. */
  total: number;
  /** `total - spent`, DELIBERATELY unclamped (over-budget overdraft). */
  open: number;
  /** Spends from the current uncommitted plan. */
  thisTurn: number;
  /** Projected total spent. */
  spent: number;
}

const PLAYER_POOLS = ['actions', 'bonusActions', 'reactions'];

export function deriveActionPools(
  facts: Facts,
  advertised: EffectInstance[],
  factPrefix = '',
  pools: string[] = PLAYER_POOLS
): ActionPool[];
```

Same shape as `deriveSlotLevels`: `numberFact` coercion; advertised filtered
through `endsOnRest` (harmless for `endOfTurn` spends, correct if a rest-scoped
one ever appears); `thisTurn` = Σ `effect.state[`${factPrefix}${key}.spent`]`;
skip pools with `total <= 0`; `open = total - spent` unclamped (comment why,
like `slotLevels.ts:89-96`).

**Phase 2 — UI entry type** `src/lib/play/extractTopBar.ts`:

```ts
export interface UiEntryActionPools extends UiEntryBase {
  type: 'actionPools';
  /** Fact prefix: '' for the player, 'companion.steed.' for the steed. */
  factPrefix: string;
  pools: Array<{ key: string; label: string; shortLabel: string }>;
}
```

- Guard branch in `isUiEntry` (label + factPrefix strings, pools array of
  `{key,label,shortLabel}` strings).
- `UI_ENTRY_TYPE_ORDER`: `actionPools: 0` — ties `usedMax`, so the stable sort
  keeps catalog position (right after HP). Byte-identical in BOTH maps
  (`extractTopBar.ts` + the copy in `derivePanels.ts`).
- `resolveEntryValue`: summed `open/total` fallback.
- `isEntryVisible`: any pool's `${factPrefix}${key}.max` present and `> 0`.
- `deriveResourceEntries` (`derivePanels.ts`): delete the three `usedMax`
  entries from RESOURCES, insert after HP:

```ts
{
  type: 'actionPools',
  label: 'play.stats.actions',
  factPrefix: '',
  pools: [
    { key: 'actions', label: 'play.stats.actions', shortLabel: 'play.ledger.short.actions' },
    { key: 'bonusActions', label: 'play.stats.bonusActions', shortLabel: 'play.ledger.short.bonusActions' },
    { key: 'reactions', label: 'play.stats.reactions', shortLabel: 'play.ledger.short.reactions' }
  ]
}
```

Widen the filter to keep it:

```ts
(e.type === 'usedMax' && present(facts, e.total)) ||
  (e.type === 'actionPools' && e.pools.some((p) => present(facts, `${e.factPrefix}${p.key}.max`)));
```

- `STEED_CORE`: drop the `steed.actions`/`steed.bonusActions` items (keep
  hp/movement); `deriveSteedResources` pushes the steed entry when either
  `companion.steed.actions.max` or `.bonusActions.max` is present:

```ts
{
  type: 'actionPools',
  label: 'play.stats.steed.actions',
  subject: 'steed',
  factPrefix: 'companion.steed.',
  pools: [
    { key: 'actions', label: 'play.stats.steed.actions', shortLabel: 'play.ledger.short.steed.actions' },
    { key: 'bonusActions', label: 'play.stats.steed.bonusActions', shortLabel: 'play.ledger.short.steed.bonusActions' }
  ]
}
```

(Labels still consumed ⇒ `RESOURCE_SHORT_LABELS` and all `short.*` keys
stay; no orphan cleanup.)

**Phase 3 — SlotTray generalization + Ledger cell.**

`SlotTray.svelte` — generalize the row so both displays share it:

```ts
export interface TrayRow {
  /** Compact tile text: "1", "ACT". */
  tile: string;
  /** Full name for the row's aria-label: "Level 1", "Bonus Action". */
  name: string;
  /** Sort order (slot level, or pool position). */
  order: number;
  open: number;
  thisTurn: number;
  spent: number;
  total: number;
}
interface Props {
  rows: TrayRow[];
  titleKey: string;
  id?: string;
}
```

- Rows sorted by `order`; tile shows `row.tile`; row aria-label via ONE shared
  key `play.tray.row` (see i18n); pips/`earlierSpent`/`pipRun`/legend/count
  unchanged; title renders `$t(titleKey)`.
- Slots caller (Ledger) builds rows:
  `{ tile: $t('play.slots.levelTile', { level }), name: $t('play.slots.levelName', { level }), order: level.level, ...counts }`,
  `titleKey: 'play.slots.title'`.
- Economy caller: `{ tile: $t(p.shortLabel), name: $t(p.label), order: i, ...counts }`,
  `titleKey: entry.label`.

`Ledger.svelte`:

- `LedgerEntry` union += `UiEntryActionPools`; filter lets it through.
- Generalize the single `slotsOpen` flag to `let trayOpenKey: string | null`
  (an `entryKey`) — one tray open at a time. Per-cell wrapper/toggle element
  refs become `Record<string, HTMLElement>` keyed by `entryKey`
  (`bind:this={cellEls[key]}`), so Escape/outside-click/focus-return serve both
  cells. Tray id: `ledger-tray-${entryKey(entry)}`.
- `entryKey`: `slotLevels`/`actionPools` → `label` + (`subject ?? ''`).
- Rename `slotTileState` → `tileState` (same open/this-turn/spent precedence),
  used by both cells.
- Economy cell = the slot-cell markup with: label `shortLabelFor(entry)`
  ("ACT"; steed view → "S-ACT" via `short.steed.actions`), one tile per pool
  (text = `$t(p.shortLabel)`, class/state via `tileState`), button
  `title=$t('play.economy.toggle')`, tile-row `role="img"` aria built like
  `slotTilesLabel` but from `play.economy.*` keys.
- CSS: reuse `.ledger__cell--slots`, `.ledger__slot-toggle`, `.ledger__slot-tile*`
  classes as-is for the economy cell (tiles grow past `min-width` for
  "BON"/"RXN"). No new colours, no new classes unless a width fix demands it.
- Position/anchor risk: the economy cell is NOT last in the row, and
  `.slot-tray` anchors `right: 0` extending left — check for left-edge clipping
  in the browser pass; if it clips, add an `anchor?: 'left' | 'right'` prop to
  SlotTray rather than a second tray.

**i18n** (`en` + `en-x-tlh`, double-brace interpolation, tlh = plausible
values, normal casing):

| Key                       | en                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `play.tray.row`           | `{{name}}: {{open}} open, {{thisTurn}} this turn, {{spent}} spent, {{total}} total` |
| `play.slots.levelName`    | `Level {{level}}`                                                                   |
| `play.economy.toggle`     | `Show action breakdown`                                                             |
| `play.economy.tilesLabel` | `Action economy: {{summary}}`                                                       |
| `play.economy.poolOpen`   | `{{name}}: {{open}}`                                                                |
| `play.economy.noneOpen`   | `None open`                                                                         |

Reuses `play.slots.summarySeparator`. Deletes `play.slots.levelRow` (both
locales) — superseded by `play.tray.row` + `levelName`. Update
`tests/unit/i18n/slots-tlh.test.ts`'s key set (add `levelName`, drop
`levelRow`); new `tests/unit/i18n/economy-tlh.test.ts` pinning parity for
`play.economy.*` + `play.tray.row` (params preserved, no English leakage into
tlh).

### Risks

- **Tray anchor clipping** (economy cell mid-row): browser-only detectable —
  vitest never loads component CSS into jsdom. Mitigation in Phase 3 design.
- **3-char tiles** ("BON") at 18px height: grows past `min-width`; verify at
  1024px tablet width.
- **Over-budget**: tray shows `-1/1`; ledger-wide badge already flags it. Do
  not clamp (grilled decision, matches slots).

### Checklist

Phase 0 — setup

- [x] Branch `simplify-resources` off main

Phase 1 — derivation

- [x] RED `tests/unit/lib/play/actionPools.test.ts` (stub module w/ signature returning `[]` first, so tests resolve + run + fail): empty facts ⇒ `[]`; defaults 1/1/1; advertised `actions.spent:1` (`endOfTurn`) ⇒ thisTurn 1 open 0; committed-only ⇒ spent 1 thisTurn 0; 2 advertised ⇒ open −1 (unclamped); prefix `companion.steed.` + pools `[actions, bonusActions]` ⇒ missing-max pool filtered, prefix facts read; effect w/o key ignored; `untilLongRest` spend + `rest.long` ⇒ not counted, `endOfTurn` always counted
  - 9 failed | 1 passed on the stub (the 1 = empty-[] case). Over-budget fixture grew to committed 1 + advertised 2 ⇒ asserts `open: -2` — self-consistent superset of the planned case.
- [x] Implement `src/lib/play/actionPools.ts` → GREEN; `make test-unit`
  - 142 files, 1789 passed | 11 skipped. Offer id for the integration attack: `unarmed-strike-use-action`.
- [x] Integration `tests/integration/rules-engine/action-pools.test.ts` (mirror `slot-levels.test.ts`): planned attack ⇒ actions thisTurn 1 open 0; engine `endTurn()` ⇒ open 1 thisTurn 0 (endOfTurn effect dropped)
  - Commits `2c1895a7` + `73b932dd` (review fixes: unused import, prettier tabs→spaces, stale copied header). Spec + quality reviews approved.

Phase 2 — UI entry type

- [x] RED extend `tests/unit/lib/play/extractTopBar.test.ts`: guard accept/reject `actionPools`; `isEntryVisible` on/off max facts; `resolveEntryValue` summed
- [x] RED rewrite `tests/unit/play/derivePanels.test.ts` action cases: single `actionPools` entry after HP before movement; steed entry (2 pools, `subject: 'steed'`); absent without facts
  - 8 new RED tests; old usedMax action assertions rewritten, adjacency (HP+1, <movement) asserted for real.
- [x] Implement `UiEntryActionPools` + guard + both `UI_ENTRY_TYPE_ORDER` maps + `resolveEntryValue` + `isEntryVisible` + RESOURCES/STEED_CORE catalog swap + filter widening → GREEN; `make test-unit`
  - Commits `b39ee5a7` + `9d8f6bd1` (review fixes: 2 contradictory test comments, heterogeneous '2/3' resolveEntryValue case, 2 comment rewrites). Spec + quality approved. Order tie `actionPools: 0` verified sound (single stable sort, no consumer re-sorts). Ledger still filters the entry out — planned; must not merge before Phase 3.

Phase 3 — components

- [x] Add i18n keys (table above) to both locales; drop `play.slots.levelRow`; update `slots-tlh.test.ts`; add `economy-tlh.test.ts`
  - Commits `147e120e` + `c8294cb6` (review fixes: tlh "DIv DIv" stutter → "DIvI'mey", `economy` added to leak wordlist). `levelRow` deletion deferred to 3b (SlotTray still consumes it). Spec + quality approved.
- [x] RED rewrite `tests/unit/lib/components/play/SlotTray.test.ts` for the `rows`/`titleKey` API: tile/name rendered, `order` sort, aria from `play.tray.row`, pips/legend/count cases carried over
  - 19 tests RED (`$$props.levels is not iterable`). One Ledger aria assertion updated to the `play.tray.row` composition.
- [x] Generalize `SlotTray.svelte` to `TrayRow[]` → GREEN
  - Commit `331d40fe`. `levelRow` deleted from both locales w/ `REMOVED_SLOT_KEYS` guard. Spec + quality approved (3 LOW polish items deferred into Phase 3c: shared `TrayRow` type instead of test-local copy, `slotTrayRowsFor(levels)` re-derivation, stale slot wording in tray comments).
- [x] RED extend `tests/unit/lib/components/play/Ledger.test.ts`: economy cell renders "ACT" + 3 tiles w/ states; opens on click, closes on Escape (focus returns) + outside click; tiles aria summary; steed view ⇒ 2 tiles + steed short label; over-budget negative open; opening economy tray closes the slots tray; existing slot-cell cases stay green
  - 14 RED initially; +2 spec-gap tests (bidirectional mutual exclusion) and +2 quality-gap tests (pool precedence, mixed-max dropped pool) ⇒ 18 economy cases total.
- [x] Implement Ledger: `trayOpenKey`, per-entry element refs, `tileState`, economy cell branch, tray ids → GREEN; `make test-unit`
  - Commits `2e3178c4` + `11424fe6` + `efa50afb`. Accepted deviation: added `play.economy.summarySeparator` (pinned in economy-tlh) rather than borrowing the slots key. `bind_this` teardown writes null ⇒ no stale-element leak. Mutation checks: precedence flip and dropped-pool skip both caught. 3b review polish (shared `TrayRow` import, `slotTrayRowsFor(levels)`, pool-neutral comments) landed here. **Follow-up recorded:** slotLevels/actionPools cell shells are ~45 duplicated lines — extract a shared presentational cell component later.
- [x] a11y pass (a11y MCP `test_html_string`; do NOT trust `check_color_contrast` — hardcoded 4.5): tile-row `role="img"` label, per-row aria, keyboard toggle/Escape
  - Collapsed 14 passes / expanded 17, only bare-fragment harness artifacts (document-title, html-has-lang). Button name carries live pool summary; ids pair; keyboard verified live both views. One cosmetic finding fixed after: `toggleEls`/`cellEls` → `$state({})` to silence `binding_property_non_reactive` dev warnings.

Phase 4 — sweep + final

- [x] `make lint` + `make format`
  - Both clean, zero rewrites.
- [x] `make test` (full)
  - Exit 0: tf validate (pre-existing warnings), trivy 0, schema 82, svelte-check 0 errors (6 pre-existing), vitest 143 files / 1830 passed / 11 skipped (yaml inline), build ok, e2e 16/16.
- [x] Playwright on <http://localhost:5173>: **target `TestCharacter` only — check the on-screen name first, the app auto-loads "Sami"**; tiles render, tray opens, hatch on planned attack → spent after End Turn; steed view tray; check tray anchor + 3-char tiles at 1024×768
  - TestCharacter confirmed on load. ONE ACT cell after HP, 3 open tiles; tray upward, on-screen at 1024×768 (x=114, 192×154, no clip) and 1280×800; tiles never overflow (scrollWidth == clientWidth); Unarmed Strike plan ⇒ ACT hatched, row "0 open, 1 this turn", End Turn ⇒ back to solid 1/1; steed view: 2 tiles, steed title/rows. Screenshots /tmp/verify-economy-*.png.
- [ ] Commit per phase (no AI attribution, never on main); open PR
  - Per-phase commits done through `efa50afb` (+ reactive-refs fix staged — commit blocked by a 1Password agent signing error, awaiting unlock).
- [x] User feedback rework: cell tiles A/B/R (`play.economy.tile.*` both locales), tray unchanged; tests updated
  - 1833 passed | 11 skipped; pnpm check 0 errors. Final-review wrap-ups landed alongside (staged): `effects` prop comment covers both cells; WALKTHROUGH_TEST_PLAN.md W5.1/W5.4/W8.2/W11.4 rewritten for the single cell. All awaiting one commit once 1Password signs.
- [x] User feedback rework: caret on the title line (beside the label) in both tray cells, not the tile line
  - `.ledger__slot-row` is now the shared row pattern for label+caret and tiles lines; DOM-order tests pin caret-in-label-row for both cells. Full suite 1835 passed | 11 skipped. Staged.
