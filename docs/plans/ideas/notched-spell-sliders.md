# Notched Spell Sliders

Currently, spells have sliders to specify the spell level, or "Free Use", where available.

However, it isn't always clear what the options are. Lets experiment with adding labelled notches to the slider component.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Plan

Settled via grilling. Design:

- `PanelSlider.svelte` gains notch-label row **below** track: thin tick per position; current value's tick + label accent-coloured, bolder.
- Positions: explicit `control.notches` when authored (labels from each notch's own value — gaps fine, e.g. find-steed `0,2..5`). Else synthesised from `min`/`max`/`step` when integer-spaced and ≤10 positions. Otherwise no notch row.
- Labels: value `0` → `Free`; `n≥1` → `L{{level}}`. New i18n keys `play.slider.freeShort`, `play.slider.levelShort`; both locales (`en`, `en-x-tlh` — invent plausible tlh values).
- Tap label → set that value. Labels pointer-only, `aria-hidden` — native range input stays sole accessible control (`aria-valuetext` unchanged).
- Collapsed `summary` form unchanged.
- No rule-data changes → no `sync-rule-groups`/`deploy-test`.

Execution: subagents do all task work (tests, implementation, triage); main agent co-ordinates + talks to human only. Load /tdd; RED must compile, run, fail.

### PR 1 — notch row in PanelSlider (only PR)

Files:

- `src/lib/components/play/panel-renderer/PanelSlider.svelte` — label row + CSS (theme vars only, no new colours)
- `src/lib/i18n/en/common.json`, `src/lib/i18n/en-x-tlh/common.json` — new keys
- `tests/unit/lib/components/play/panel-renderer/PanelSlider.test.ts` — new cases

TDD inside PR:

1. RED — unit tests:
   - sequential (min 1..max 5, `valueFormat: 'spellLevel'`) → labels `L1`..`L5`
   - value `0` → `Free`
   - explicit notches `0,2,3` → `Free`,`L2`,`L3`, no `L1`
   - > 10 positions → no row; non-integer step → no row
   - current value tick/label carries emphasis class
   - tap label → `onSelectionChange` with mapped value
   - label row `aria-hidden`
2. GREEN — implement. 3. REFACTOR.

### Checklist

- [x] Branch off main (never commit main)
- [x] RED: label-row unit tests fail (compile, run)
- [x] GREEN: implement notch row + i18n keys (both locales)
- [x] REFACTOR
- [x] `make test` green
- [x] `make check` clean
- [x] `make format`, `make format-check` clean
- [x] Playwright look at <http://localhost:5173> (`pgrep -f vite.js` first): cure-wounds (sequential), find-steed (gapped), emphasis on current; dark + light

- [x] Follow-up (user review): value text resizing wobbles the track — size value cell from widest candidate (hidden sizer), same PR
- [x] Follow-up (codex P2, valid, fixed d6af6bc3): marks percentage-positioned at i/(n-1) over the input's exact box — tick centers independent of label width
- [x] Follow-up (user, fixed d76563b2): ticks off at range ends — native thumb travels input width minus thumb width; marks now on thumb-travel model (`--notch-fraction` × `calc`, `--slider-thumb-width: 16px`)
- [x] Follow-up (codex P2, valid, fixed d76563b2): tap targets were label-sized — transparent `::after` hit area ±12px/±14px, no visual change; `elementFromPoint` verified
- [x] Follow-up (codex P2, valid, fixed 7522bc32): hit area overlapped the input (paint order stole thumb drag-starts) — asymmetric insets, top stops at the 4px row gap

Notes:

- Added gate: row renders only when `valueFormat === 'spellLevel'` — non-spell sliders (movement, LoH, heal amount) otherwise got bogus Free/Ln labels. Covered by 2 extra tests (33 total).
- `make dev` side effect: regenerated `.env.local` via a test-env terraform apply (flipped account-level api-gateway CloudWatch role prod→test; same flip every test deploy). Started vite with `pnpm dev` instead after.
- Screenshots: `notched-cure-wounds-light.png`, `notched-find-steed-dark.png`, `notched-narrow-dark.png` (repo root, untracked).
- [ ] Commit (signed; 1Password locked → commit unsigned, re-sign later; no AI attribution, no amend)
- [ ] Push, open PR
- [ ] Monitor PR ~15 min for codex comments / thumbs-up; triage each (valid → fix + reply; unsure → ask user)
- [ ] Repeat until reviews quiet + pipelines green
