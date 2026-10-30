# Cover

Implement cover in the app — generic mechanism first, then the Tormentor
seats' cover. Nothing about cover exists today.

Remember: illegal is marked, never removed. The core stays generic; vehicles
are rules. Re-use existing components. All copy own-wording; verify the
cover numbers against docs/srd52.txt before implementing (2014-vs-2024
divergence trap).

## Facts

- SRD cover (verify wording at implementation): half +2 AC and Dex saves;
  three-quarters +5 AC and Dex saves; total = can't be targeted directly.
- Tormentor seats (tormentor2.png): Helm = three-quarters cover; Harpoon
  Flinger = half cover. Passenger and Clinger: none (open air).
- Cover does NOT stack: best source applies.

## Settled decisions (grilling 2026-10-28)

- FOUR states: None / Half / Three-Quarters / Total. Ordinals 0/1/2/3.
  Total grants NO AC/Dex bonus — notice-only copy ("can't be targeted
  directly").
- Manual cover = segmented record on the PLAYER +ADD, FREE section, filed
  under the RECORD verb (sub-bucket label per existing record filings; new
  sub-bucket label allowed like EQUIP:'vehicle' was). AC-mode precedent:
  keyed record on a DISTINCT fact, immediate apply, re-apply replaces, raw
  chip removal reverts. No economy cost — cover is a state, not an activity.
- Seat cover: Helm ¾, Harpoon Flinger ½, Passenger/Clinger 0 — derived
  from seat facts (PR-2), never a second manual record.
- Effective cover = max(manual, seat-sourced). Never a sum.
- Cover renders as BOTH a NOTICE and an AC MODIFIER (+2/+5 into the
  player's existing AC derive — read the fact, no two-writer) AND a
  DEX-SAVE RIDER (annotation rider chip on save dice lines, toggleable,
  shows the modifier). Rider in PR-1 if the machinery reaches save rolls
  (verified at RED); else AC first, rider follow-up.
- ONE standing notice keyed on EFFECTIVE cover (state + bonus in the body);
  not per-source. Both locales.
- Module home: PLAYER-level generic (wherever AC/save state lives today),
  NOT vehicle-tormentor. Vehicles contribute facts the player derive reads;
  future vehicles plug in the same way.
- Cover is CORE (user ruling 2026-10-28): EVERY character has it by
  default — NOT opt-in content like the Tormentor/spells/spears. Copy the
  existing always-on mechanism used by action-economy/ac/movement; existing
  persisted characters included per that precedent.
- Lifecycle: manual cover ungated (wrecked/abandon irrelevant); seat cover
  vanishes with the seat automatically (derived). No wrecked legs.
- Vehicle's own AC (21/19) untouched — cover protects OCCUPANTS.

## TDD + PR process

TDD inside every PR (RED compiles, runs, fails). Subagents implement, PUSH
ONLY; parent deploys once before each hands-on test. Codex monitor after
each push; every comment replied. User's tablet test gates merge. Never
merge ourselves. STOP if unworkable. Copy own-wording both locales
(tlh plausible, normal casing).

## Checklist

PR-1 — generic cover (player):

- [ ] RED yaml scenarios + unit pins: record segmented ui (4 states) under
      RECORD; effective cover derive; AC derive gains +2/+5 (fact-read, no
      hardcoded path); notice on/off per state incl. Total wording; Dex-save
      rider on save dice lines (or documented fallback AC-only); raw-chip
      removal reverts; i18n both locales
- [ ] SRD wording verified (docs/srd52.txt) before copy written
- [ ] Gates green; PR pushed (no deploy); codex monitor armed
- [ ] Parent deploys once; USER hands-on test (gates merge)

PR-2 — seat-sourced cover (tormentor):

- [ ] RED yaml scenarios + unit pins: helm seat → ¾ contribution; harpoon
      seat → ½; passenger/clinger 0; effective = max(manual, seat); leave
      seat / abandon drops cover automatically; notice reflects effective;
      AC/rider follow the max
- [ ] Tormentor cover-contribution derive + player-side read (no new
      manual controls)
- [ ] Gates green; PR pushed (no deploy); codex monitor armed
- [ ] Parent deploys once; USER hands-on test (gates merge)
