# Roll Log

Currently, there is no way to go back and look at previous rolls. The toast shows the details for a bit, but then disappears.

Lets add a dice button to the right of the end turn button, which slides in (from the right) a log panel. It should show the rolls that have occurred. Each should show the same details as the toast (try to re-use components). They only go back as far as the current turn (end turn clears the log). There is no need to sync the log back to the server. The latest roll should be at the top, and the list should be scrollable if necessary. Replaced rolls should be distinct - maybe a different background and a dotted border instead of solid?

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Design (grilled — settled)

- Capture: every roll that toasts. `showDiceRollToast` (diceRollToast.ts) is the sole funnel (PanelRenderer + NoticeStrip both go through it) — hook the log there. Nothing else records rolls today.
- Log entry = exact toast payload (`title`, `rollType`, `result`, `modifiers?`, `damageTypeKey`, `unitKey`) + `id`, `rollKey?`, `replaced`.
- Replaced: nothing marks re-rolls today (rollers overwrite in place), so callers pass a `rollKey` (panel: `rule.id` + primary/secondary + die index / hit-dice pool die size + slot index; notice: per-cell key `notice.id ?? notice.key` + die index — `id` not shared i18n `key`, so sibling burns don't cross-mark). A new entry marks **all earlier same-key entries** `replaced`. In-roll replacements (`droppedRoll`/`gwfFloor`/`effective`) already render inside the entry — untouched.
- Replaced styling: stays at chronological position; hollow card — flat `surface` bg + 1px dotted border. Subtracts prominence (a replaced roll is spent, never emphasised — no heavier border, no label), structural cue, **no opacity** (contrast law — see depleted-ledger lesson).
- State: new runes module `src/lib/play/rollLogStore.svelte.ts` (companionStore pattern): `rolls` (latest first), `isOpen`, `logRoll`, `clearRollLog`, `open`/`close`. Memory only — no server sync, refresh empties, fine.
- Clearing: `playStore.endTurn()` and `playStore.reset()` call `clearRollLog()`. Notice rolls persist across turns in their components, but the log is current-turn only — a cross-turn re-roll starts fresh (no replaced marker). Accepted.
- Button: dice icon **right of End Turn** (PlanStack footer), always enabled, no badge, `aria-label` from i18n.
- Panel: fixed right-edge overlay (play grid never reflows), scrim; close = X + scrim tap + Esc. a11y per SettingsModal (`role="dialog"`, `aria-modal`, focus in/out, Esc via `svelte:window`); fixed/z-index/backdrop conventions per ReminderPopover. No existing slide-in drawer — new CSS, theme tokens only.
- Entries: latest at top, scrollable, **stay scrolled** on new roll; render `DiceRollToast` per entry (reuse — identical details to the toast).
- Empty: openable with zero rolls; i18n'd empty-state line.
- Toasts: unchanged. Bottom-right toasts may overlay the open panel — accepted.
- i18n: `play.rollLog.openButton`, `play.rollLog.title`, `play.rollLog.empty` (+ close key if no common one) in `en` + `en-x-tlh` common.json.

## Process

Subagents perform tasks; main agent coordinates + talks to human. TDD inside each PR (RED: compiles, runs, doesn't panic, fails → GREEN → REFACTOR). Per PR: `make test`, `make check`, `make format-check`, lint; push; monitor for codex comments (~15 min delayed); every review comment gets a fix or a reasoned won't-fix; continue until no reviews and pipelines green. UI slices verified on <http://localhost:5173> via Playwright (check vite already running: `pgrep -f vite.js`). `make deploy-test` if the test site needs it (no rule-group/backend changes here). **If any step proves unworkable, STOP** and discuss with the human.

### PR 1 — store + funnel (no UI)

- RED `tests/unit/lib/play/rollLogStore.test.ts`: logRoll appends latest-first; same rollKey marks all earlier same-key entries replaced; unkeyed never replaced; clearRollLog; open/close
- RED extend `showDiceRollToast.test.ts`: logs an entry carrying the exact toast payload; optional rollKey threaded through
- RED extend `playStore.test.ts`: endTurn + reset clear the log
- GREEN: `rollLogStore.svelte.ts`; `showDiceRollToast(title, result, extraModifierLabels?, rollKey?)` → `logRoll`; playStore hooks

### PR 2 — roll keys from callers (makes "replaced" real)

- RED: PanelRenderer dice-line + hit-dice toasts carry key (planned item + control + die/slot); NoticeStrip carries notice key + die index
- GREEN: plumb keys from `handleDiceRoll` / NoticeStrip roll handler

### PR 3 — panel UI

- RED `RollLogPanel.test.ts`: renders entries latest-first via `DiceRollToast`; empty state; replaced wrapper class; close via X / scrim / Esc; `role="dialog"` + aria-label; focus moves in on open, back on close
- RED extend `PlanStack.test.ts`: dice button right of End Turn, aria-label, opens panel
- GREEN: `RollLogPanel.svelte`, button in PlanStack footer, slide-in transform, scroll container
- i18n keys both locales; contrast test pinning replaced styling tokens (depleted-contrast pattern) if styles land

### Checklist

- [x] PR 1 merged (store + funnel + clearing) — #432
- [x] PR 2 merged (roll keys) — #433, incl. codex P1 instance-key fix
- [ ] PR 3 merged (panel UI + i18n)
- [ ] Each PR: make test / make check / make format-check / lint green before push
- [ ] Each PR: codex monitor run, all comments answered, pipelines green
- [x] PR 3: Playwright pass on localhost:5173 (open, roll, replaced entry — restyled hollow after user feedback, end-turn clear, close gestures; 0 console errors)
