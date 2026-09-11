# Better Summary Panels

The summary form of each panel is useless. They should all display the type pills (ACT, BON, etc) and also each display line (rollers, sliders, etc) should exist in a short form.

The short form of a display line should be non-editable, and just show the current value (taking adv/dis/etc into account). They should all be on one line in the UI, separated by a suitable separator character.

## Behaviour

Be extremely concise. Sacrifice grammar for the sake of concision
Use subagents for tasks - the main agent should only be used for coordination and communication with the human

## Critical Rules (carry through compactions)

- TDD superpower for all code changes. RED tests must compile, run, not panic, and fail for the right reason.
- All user-facing text goes through i18n (`src/lib/i18n/en/common.json` + `en-x-tlh/common.json`). No hardcoded strings.
- A11y: semantic HTML, ARIA, keyboard navigable, contrast.
- CSS Law: no new colours. Theme variables only. Semantic, reused styles.
- `make test` before declaring done. Never commit on failing tests. Never commit to main.
- No `terraform` directly; no `find -exec`; no `$(...)`; no redirections/chaining where avoidable.

## Decisions (settled with the human)

| #                      | Decision                                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                  | Collapsed `PlanRow` only. Picker panels (`PackedChoiceGroup`, `AddRowPicker`, `QuickSearch`) untouched.                                                                                               |
| Line contents          | `[cost pills] Name · <primary short> · <secondary short> · <information lines>`. Warning indicator kept. Mod chips dropped (their value is folded into the shown number).                             |
| Separator              | `·` via CSS `::before`, `aria-hidden`. Not a translated string.                                                                                                                                       |
| Dice line              | Rolled dice show their **value** (`▲ 18`); unrolled dice show the expression (`d20+7`). Partially-rolled lines mix per die.                                                                           |
| Adv/dis/crit           | Reuse `DieChip` non-editable + its existing `advantage`/`disadvantage`/`critDamage` styling. No new notation, no new colours.                                                                         |
| Effective value        | Show `RollResult.effective` when present, else `total`. No strikethrough.                                                                                                                             |
| Hit dice               | ~~Pool counts, `3/4 d10`. Not the rolled heals.~~ SUPERSEDED — see the third correction. The wording was ambiguous: "pool" was read as "add the results together", which is what it should have said. |
| Slider                 | Formatted value (`Level 2`, `Free Use`).                                                                                                                                                              |
| Select / segmented     | Selected option label.                                                                                                                                                                                |
| Text                   | Entered text, ellipsized. Nothing when empty.                                                                                                                                                         |
| Loadout                | Plain text from `PanelLoadout.rowLabel(config)`. Not chips.                                                                                                                                           |
| Un-activated secondary | Omitted (gated behind `enabled.button`, has no current value).                                                                                                                                        |
| Staleness              | Inherit `PanelDiceLine`'s existing invalidation exactly. Collapse is a view change, not a state change.                                                                                               |
| Overflow               | Single line, ellipsis on the strip. Cost pills never truncate.                                                                                                                                        |
| Tap target             | Chevron button only (unchanged). The strip is inert. Revised after Q17's strip-as-button collided with the mounted-instance requirement — see Architecture.                                           |
| Name                   | Kept in the strip (left column's verb+subject is not always populated).                                                                                                                               |

## Plan

### Architecture

`rollResults` is local `$state` in `PanelDiceLine` (`:98`), cleared when vars/selections change (`:160`). It is **not** in `selections`, so no external/pure summariser can see rolled values, and unmounting the control destroys them.

Therefore: **the control components render their own short form**, via a new `summary` prop threaded `PlanRow → PanelRenderer → each control`. The same component instances stay mounted across collapse/expand; only their internal template swaps. This preserves the existing "keep it mounted so state survives" invariant that `PlanRow:363` documents.

`PanelDiceLine.formatDieChip` (`:241`) already implements rolled-value-else-expression. Reuse it verbatim.

Composition when collapsed:

- `PlanRow` owns: `<div class="plan-row__summary">`, the cost pills, the name, the warning indicator. The strip is **inert** — expansion stays on the existing chevron button.
- `PanelRenderer` (summary mode) owns: control short forms + information lines. No nested interactive elements (nothing focusable inside a collapsed row), but ordinary block markup is fine — the strip is not a button.

**Why the strip is not a button.** A `<button>` may contain phrasing content only, so nesting the panel would mean swapping the control wrappers from `<div>` to `<span>` in summary mode — which needs an `{#if}` that remounts the controls and destroys `rollResults`. Keeping the rolls wins; the chevron keeps the job.

**Mount preservation is a hard constraint everywhere:** one set of control instances, mode expressed with `class:` directives and `{#if !summary}` around suppressed parts only. Never an `{#if summary}...{:else}...{/if}` that duplicates a control.

### Steps

1. **RED — contract tests.** Component tests (vitest + `@testing-library/svelte`, matching `tests/unit/lib/components/PlanRowRulesMode.test.ts`) asserting collapsed `PlanRow` renders cost pills, name and a summary strip; per-control tests asserting each control's short form and that summary mode renders no `<button>`/`<input>`.
2. **GREEN — plumbing.** `summary?: boolean` on `PanelRenderer` and all seven controls (`PanelDiceLine`, `PanelHitDice`, `PanelSlider`, `PanelSelect`, `PanelSegmented`, `PanelTextInput`, `PanelLoadout`). Summary mode suppresses header, description, followups, enable-button and un-activated secondaries.
3. **GREEN — control short forms.** One per control, per the decision table. `PanelDiceLine` reuses `formatDieChip` + `DieChip(editable=false)`.
4. **GREEN — `PlanRow` strip.** Replace the bare `plan-row__collapsed-name` (`:357`) with pills + name + inert summary strip; drop `plan-row__content--hidden` in favour of passing `summary={collapsed}` so the panel stays mounted.
5. **i18n.** New keys (`x/y` hit-dice pattern if needed) in `en` and `en-x-tlh` in the same change. Reuse existing damage-type and slider-format keys.
6. **A11y + CSS.** Nothing focusable inside a collapsed row; separators `aria-hidden`; chevron keeps its existing `expandAria`/`collapseAria`; existing theme variables only; ellipsis via a shared semantic class.
7. **REFACTOR + verify.** `make lint`, `make format`, `make test`.

### Security review

No new data flows: no network calls, no storage, no new persisted state, no user-supplied HTML (all text goes through i18n `$t` or already-sanitised Svelte interpolation). The one risk is _information exposure of the wrong kind_ — a stale rolled value shown as current — addressed by inheriting `PanelDiceLine`'s existing invalidation rather than caching separately. Read-only rendering path; no new privilege.

### Subagent fan-out

Main agent coordinates only. Step 2 (the prop contract) lands first and alone — every other task depends on it. Steps 3's seven controls then fan out in parallel (disjoint files); steps 4-6 follow.

## Checklist

- [x] 1. RED: `tests/unit/lib/components/PlanRowSummary.test.ts` — collapsed row shows cost pills, name, summary strip. Fails today (collapsed renders name only).
- [x] 2. RED: per-control summary tests (7 files) — short-form text + no interactive elements in summary mode.
- [x] 3. RED: `PanelDiceLine` summary — unrolled shows `d20+7`, after roll shows `▲ 18`, partially-rolled mixes.
- [x] 4. GREEN: `summary` prop contract on `PanelRenderer` + all seven controls (lands first, blocks everything else).
- [x] 5. GREEN: `PanelDiceLine` short form (reuse `formatDieChip`, `DieChip` non-editable, `effective` over `total`).
- [x] 6. GREEN: `PanelHitDice` short form (`3/4 d10` per pool).
- [x] 7. GREEN: `PanelSlider` short form (formatted value).
- [x] 8. GREEN: `PanelSelect` + `PanelSegmented` short forms (selected option label).
- [x] 9. GREEN: `PanelTextInput` short form (ellipsized text, empty renders nothing).
- [x] 10. GREEN: `PanelLoadout` short form (plain `rowLabel` text).
- [x] 11. GREEN: `PanelRenderer` summary mode — phrasing-only output, no root `role`/`tabindex`, suppress header/description/followups/enable-button/un-activated secondary.
- [x] 12. GREEN: `PlanRow` collapsed strip — pills + name + panel summary + warning; strip inert, chevron unchanged as the only expander.
- [x] 13. CSS: separator via `::before` (`aria-hidden`), single-line ellipsis, pills never truncate, theme variables only, no new colours.
- [x] 14. i18n: new keys in `en/common.json` and `en-x-tlh/common.json` (only if any are actually needed); i18n parity test passes.
- [x] 15. A11y check: nothing focusable inside a collapsed row, decorative parts `aria-hidden`, chevron label/state correct.
- [x] 16. REFACTOR: dedupe short-form helpers if three or more controls converge.
- [x] 17. `make lint`, `make format`, `make test` all green.

## Correction (2026-09-10)

The human corrected the layout after seeing it. "All on one line" in the original brief scoped the **short forms**, not the whole strip. Superseding decisions:

| #           | Decision                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout      | THREE stacked lines when collapsed: (1) cost pills, (2) name, (3) the control short forms. Only line 3 is the one-line, `·`-separated, ellipsized strip. |
| Damage dice | The short form carries its `DamageTypeIcon`, same as the full render. Previously dropped — wrong.                                                        |
| Range       | A weapon with ranges shows its range text in the short form, non-interactively. Previously dropped — wrong.                                              |
| Warning     | The `(!)` indicator stays over the NAME, in the same visual position it holds in the expanded row. Not on the short-forms line.                          |

Roll modifiers stay dropped (value already folded into the numbers).

**Second correction, same day.** The `(!)` was not clickable when collapsed, because the header existed TWICE: `PanelRenderer` suppressed its own in summary and `PlanRow` rendered a second, non-interactive copy. The human's framing — "surely it is the same code, only after the pill and title do they change" — is the design. Now:

- `PanelRenderer` renders the header (title + interactive `WarningIndicator`) in BOTH modes, one code path. Only what sits below the title differs, inside a new `.panel-renderer__body` (`display: contents` expanded, so expanded layout is untouched; `display: block` + ellipsis in summary).
- `PlanRow` renders the pills line only; its `.plan-row__name-line` duplicate is gone, as is `WarningIndicator`'s `interactive` prop.
- The earlier "nothing focusable in the collapsed strip" rule is relaxed for this one element: the warning button is focusable and clickable when collapsed. Everything else stays inert; the chevron is still the only expander.
- The `(!)` overlapping the name's first character is CORRECT — confirmed by the human.
- Empty-control wrappers no longer emit a stray `·`: pure predicates (`textInputIsEmpty`, `selectIsEmpty`, `loadoutIsEmpty`, `segmentedIsEmpty`, `hitDiceIsEmpty`) gate the wrapper in `PanelRenderer` before the child mounts.

Final state: `make test` green end to end (2031 unit, 16/16 e2e, lint, svelte-check 0 errors). Click-through verified in a real browser at 1024×768.

## Third correction (2026-09-12)

From the owner playing with real collapsed rows:

- **Hit dice show the SUMMED heal**, then remaining capacity: `18 hp 2/2 d8 4/4 d10`. The earlier "pool counts, not the rolled heals" decision is reversed — "pooling" was understood as adding the results together, which is the more useful reading. The sum comes from `ownPendingHeal()` (the engine's advertised effects), so a heal floored at 1 or capped by missing HP shows what landed, not raw dice math. Unrolled renders exactly as before.
- **Units are literal strings, never i18n keys.** `unit: 'hp'` is authored directly on the control (`record-heal`, `prayer-of-healing`, the hit-dice control, `'ft'` on movement sliders) and concatenated raw. Lay on Hands authored no unit at all, so both the expanded and collapsed panels showed a bare number — the fix is in the rule, not the renderer.
- **`.panel-renderer__dice-line` must be inline-level in summary.** As `display: flex` it is a block box, and inline generated content (the `·` separator) can never share a line with one, so the browser broke before it and the dot appeared alone on its own line above the values. jsdom has no line boxes, so no unit test in this repo could have caught it.

## Outcome

Full `make test` gate green (validate, security, validate-rules-schema, check, test-unit 2019 passed / 10 skipped, test-e2e 16/16, lint). Nothing committed.

Deviations from the plan, all deliberate:

- **No new i18n keys at all.** `3/4 d10` (hit dice) and `filled/total` (countdown) follow the existing wordless-notation precedent at `src/lib/play/extractTopBar.ts:295` — digits and dice notation, no natural-language words. `tests/unit/i18n/hit-dice-tlh.test.ts` polices leaked English words, which this does not trip. Every other short form reuses the keys the full control already renders.
- **Separator is a real `aria-hidden` `<span>`, not a CSS `::before`.** The pseudo-element approach forced the panel to be inline-level, which broke the layout in a live browser (two lines; and a percentage `max-width` on an `inline-flex` box failed to paint its text in Chromium while every measurement API reported it correct). `.panel-renderer--summary` stays `display: block`.
- **Informational annotations suppressed in summary.** `.panel-renderer__annotations` is a stacked chip list with no value to fold into the strip — it would have added a second line.
- **`WarningIndicator` gained an `interactive` prop.** It rendered as a `<button>` unconditionally, which would have left a focusable element inside the inert collapsed strip. Summary mode renders `role="img"` instead (a bare `<span aria-label>` is invalid ARIA — caught by axe).
- **Item 16 refactor declined.** Only two controls (`PanelSelect`, `PanelSegmented`) share the "find selected option, render its label" shape; `PanelLoadout` matches by `id` and formats via `rowLabel()`, so extracting a helper would add indirection without removing duplication.
- **`SelectControl.display?: ValueSource` is dead code** — never authored on any rule, never read by `PanelSelect`'s full render either. Untouched, flagged for a separate decision.

Verified visually at 1024×768 via Playwright: single-line dice row, single-line multi-control row with warning (Divine Smite), long note ellipsized with no horizontal page scroll. Axe: 0 violations in both themes; summary text contrast 7.6–14:1.
