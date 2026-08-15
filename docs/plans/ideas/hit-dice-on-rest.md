# Hit Dice on Rest

Currently, we don't do anything with our hit dice. They merely exist. In this PR, we
are going to implement the health functionality of hit dice.

On the Short Rest panel, we should have the option of spending Hit Dice. Have a
roller per die (which might be of different sizes!). When a die is rolled, it
"consumes" one of the hit die. If the same die is rolled multiple times, it only
consumes once. If the panel is dismissed, it consumes no die - including if the
panel is re-opened (where it starts anew). Rolled die on an open panel contribute
to the HP count, up to max HP.

Long rest resets the hit die, as per D&D5e(2024) rules.

## Design (agreed)

1. **Rollers on rest offer.** `record-short-rest` gains a dice control: one tappable
   roller per hit die, grouped by size (d6/d8/d10/d12). Always `total` rollers per
   size; already-spent ones rendered disabled.
2. **Rolls → plan.** Rolled slot feeds offer `selections` (existing input path).
   Re-roll replaces slot value; one slot = one die. Rolls live in pending plan row;
   removing row discards; re-adding starts fresh.
3. **Effects.** `apply` advertises per rolled slot:
   `hp.modifier.current += max(1, roll + con.modifier)` (floor 1/die, capped at
   missing HP) and `hitDie.dN.spent += 1`. `untilLongRest`, removable chips.
4. **Preview/commit.** Structural optimism (top bar/ledger update while row open);
   End Turn commits via existing path. Dismiss consumes nothing.
5. **Long rest.** Full hit-dice reset, automatic — `untilLongRest` aging on spends
   (Lay on Hands pattern). No `onRest` hook needed.
6. **Multiclass ledger fix.** Top bar/ledger show one hit-die line per size with
   nonzero total (currently only first nonzero size — bug).

## Execution rules

- Subagents perform tasks; main agent co-ordinates + talks to human only.
- TDD (/tdd) strictly: RED (compiles, runs, fails — not panics) → GREEN → refactor.
- i18n for every new string (en + en-x-tlh). A11y: semantic, keyboard-navigable
  rollers, disabled state announced. Theme colours only, no new colours.
- This control's rolls must not clear when dice signature changes (today's
  `$effect` in PanelDiceLine clears on change — use slot-keyed state here).

## Checklist

- [x] 1. RED: yaml scenario `short-rest-hit-dice`: add `record-short-rest` with
     selections carrying rolled values; assert `hp.modifier.current`,
     `hitDie.d10.spent`, floor-1, cap-at-max, chips removable, dismiss = no spend
- [x] 2. RED: yaml scenario `long-rest-resets-hit-dice`: spend, endTurn, long rest,
     endTurn → `hitDie.dN.remaining` back to total
- [x] 3. GREEN: `core-events.ts` restOffer — dice control from `hitDie.*` facts,
     apply computes heal + spends per selections (reuse `record-heal` cap logic)
- [x] 4. Reroll-replaces + spent-roller-disabled semantics (RED unit test on offer
     logic, then GREEN)
- [x] 5. RED: unit test `derivePanels` multiclass — one line per nonzero size;
     GREEN: fix `derivePanels.ts` / `extractTopBar.ts` / `Ledger.svelte`
- [x] 6. UI: `PanelDiceLine` slot-keyed roll state + `onSelectionChange` wired for
     this control type (`panel-renderer/types.ts`)
- [x] 7. i18n keys en + en-x-tlh
- [x] 8. `make test` green; `make sync-rule-groups`
     (not needed — no data/rule-groups changes; engine work is client-side TS)
- [x] 9. Playwright: dev server <http://localhost:5173> — roll hit dice on short
     rest row, preview, chips, End Turn commit, disabled spent rollers
     (verified on TestCharacter: roll+CON, cap at missing HP, reroll replaces,
     dismiss consumes nothing, long rest resets to 6/6)
- [x] 10. `make deploy-test` if needed beyond step 8
      (not needed — frontend-only branch, no backend/infra changes)

## Notes

- `hit-die.ts` already derives `remaining = total − spent`; nothing writes `spent`
  today — this plan adds the writers.
- Rests are plan-terminal (`plan.ts`): dice on the rest row itself avoids ordering
  problems.
