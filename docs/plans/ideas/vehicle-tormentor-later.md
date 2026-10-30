# Vehicle: Tormentor; Later list

Working through the "Later" items from vehicle-tormentor-seats.md, in the
user's chosen order. Same rules as the seats job: TDD inside each PR
(RED compiles, runs, fails), subagents implement (push ONLY — parent deploys
once before the user's hands-on test), codex monitor after each push, every
review comment replied, user's tablet test gates merge, never merge
ourselves, STOP if unworkable. All copy own-wording (not SRD); facts from
the stat block images; no hardcoded derived numbers — bake facts, compute,
interpolate via Diagnostic.params.

## List

- [x] Mishaps — per-row note at damage >= 20 (PR #490 MERGED)
- [x] Wrecked legality — dash/drive/juke/fire/fuel/boost/repairs illegal
      (not removed) while destroyed (PR #491 MERGED; + copy fixes: "a
      passenger seat", clinger is not a seat)
- [x] Vehicle checks + saves STR/DEX/CON (PR #492 MERGED)
- [ ] Cover — generic player cover + seat cover (helm 3/4, harpoon 1/2) —
      ideas doc docs/plans/ideas/cover.md, grilling pending
- [ ] Wrecking
- [ ] Anything else missing — final audit vs stat block

## Mishaps (settled 2026-10-28)

- Trigger: a recorded damage AMOUNT >= the mishap threshold on one row.
- Placement: PER-ROW notice on that damage row (bounce-note slot; post-hoc
  consequence on the action, never a standing notice).
- Threshold as FACT: acquire bakes `companion.tormentor.mishapThreshold` 20
  (beside damageThreshold 10); condition reads the fact; copy interpolates
  {{amount}} and {{threshold}}. Damage still records fully (not a gate).
- Generic-but-opt-in: hpRecorders factory option (mishapThresholdFact +
  note key); player/steed unconfigured → zero change.
- Tormentor wires it; copy consistent with the damage detail body.

## Checklist

- [ ] RED scenarios + unit pins (20+ note with params; 10-19 clean; <10
      bounce; abandon clears; both locales; params render)
- [ ] Factory option + acquire bake + wiring + i18n both locales
- [ ] Gates green; PR pushed (no deploy); codex monitor armed
- [ ] Parent deploys once; USER hands-on test (gates merge)
