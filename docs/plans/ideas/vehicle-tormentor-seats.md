# Vehicle: Tormentor; Seats

We are going to implement the various action stations on a Tormentor.

Remember: We do not _prevent_ the player from doing invalid things; we just mark them invalid.

Remember: We do not have the core processing app need to understand anything specific about vehicles, etc - the core is generic, the rules are specific.

Re-use existing components wherever possible.

Some details are available in tormentor2.png.

## Seats

Implement each seat in separate PRs. If it helps, a single seat can be multiple PRs.

### Passenger

For the first pass, we will implement the Passenger seat. This should provide the infrastructure for future seats, but it itself does little.

There should be an option to board the vehicle as a passenger on the Tormentor +ADD panel. There should be an option to de-board the vehicle. They should only be legal if valid (so board if not boarded and vice versa) and also you are not using another seat somewhere. It should only be legal to board if there is a free seat.

At this time, this is the only seat, so using another seat isn't possible - but build it so we can support that in the future.

Boarding/Unboarding should decrease/increase the number of seats used.

### Harpoonist

For the second pass, we will implement the Harpoonist Seat. In addition to any other seat, it provides an action: A ranged weapon attack of a harpoon, +7 to hit, 120ft range, 1 target, 2d8+2 piercing damage. 10 Harpoons (ammunition counts are not yet implemented; so just display this). This is a magical weapon.

### Helm

For the third pass, we will implement the Helm Seat. In addition to any other seat, it implements:

- Drive
- Dash (Annotation about the the dash risk bit)

### Fuel

For the fourth pass, we extend the vehicle, to support fuel:

- Fuel (on the vehicle itself): None, Soul Coin, Demon Ichor - Speed is 0, 100 or 80ft depending
- Boost (on the vehicle itself): None, Demon Ichor - with a demon ichor boost, +30ft for 1 minute. Only legal if using a Soul Coin for fuel
- Insert a soul coin (Helm)
- Pour a flask of demon ichor (Helm)

### Clinger

For the fifth pass, we add a clinger seat. A clinger is someone holding on to the outside of the vehicle. They do not count as consuming seats. Adds a notice about the dex checks.

### Later

For later plans; recorded so I don't forget, but not dealt with here:

- Vehicle checks (STR/DEX/CON) - Done
- Vehicle saves (STR/DEX/CON) - Done
- Wrecking - Done
- Mishaps - Done
- Cover - Done
- _anything else missing from our implementation_ - Check

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Settled decisions (grilling 2026-10-26)

Facts verified against `tormentor2.png` (harpoon +7 to hit / 120 ft / 1 target /
2d8+2 piercing / 10 harpoons; fuel none/soul coin/ichor → speed 0/100/80; boost
+30 ft for 1 minute, soul-coin fuel only; helm 1 crew three-quarters cover;
harpoon station 1 crew half cover). Prose is our own wording throughout.

- ONE subject `tormentor`; no per-seat subjects/seg-buttons. All seat offers in
  the vehicle's +ADD (`ui.subject`, `when: acquired`).
- Seat = PLAYER-side permanent keyed effect per station. Stations:
  `passenger`, `harpoon`, `helm`, `clinger`. Effect ids
  `effect-tormentor-seat-<station>`, keys `tormentor-seat-<station>`, state
  writes `companion.tormentor.seats.<station> = 1`. Chip under vehicle panel
  (`display` section `mount`, subject) = at-a-glance "where am I seated".
- Station labels = stat-block names: Passenger, Helm, Harpoon Flinger, Clinger
  (NOT "Harpoonist"). Board offers "Take the <station> seat", leave offers
  "Leave the <station> seat". Both locales.
- One seat per player GLOBALLY (any vehicle, future-proof): `legalWhen` no
  other seat fact active + error diagnostic, committable. Re-taking the seat
  you hold is illegal (same diagnostic path). Clinger is exclusive too, just
  capacity-free.
- Free-seat rule: boarding illegal-but-committable when derived
  `creatureCapacity.used >= max` + diagnostic.
- Leave-seat offer: `legalWhen` that seat active else diagnostic,
  committable; apply = empty same-key eviction. Leaving a seat never touches
  fuel/boost state.
- Capacity derive CHANGES (no fact renames; derives aren't persisted):
  `used = num(occupancy) + active-seat count` (passenger/harpoon/helm +1,
  clinger +0). Default-1-acquirer DROPPED — freshly acquired = 0/4 until
  seated. Slider = NPCs/manual base, unchanged shape.
- Lifecycle: seat keys (+ fuel/boost keys in PR-D) join `CHILD_KEYS`
  (acquire `dependents` + explicit evictions on acquire/abandon). Abandon
  evicts seats + fuel + boost; re-acquire resets (fuel none, speed 0).
- No destroyed-gates on seat offers (nothing else gates on destroyed; GM
  adjudicates a wreck; destroyed notice already informs).
- Harpoon attack: plan-row ACTION offer (steed-slam/weaponOffers idiom),
  gated `when` harpoon seat held; `legalWhen` PLAYER's `actions.remaining`;
  dice-line control d20 +7 to-hit, 2d8+2 piercing (count-2 dice entry,
  HEAL_TOUCH precedent). Magical + 10 harpoons = detail text only, no ammo
  tracking, no chip.
- Drive + Dash: plan-row ACTION offers gated `when` helm seat; NO mechanical
  effect (vehicles have no movement economy) — planning/record only, spend
  the player's action. Dash risk UNKNOWN/GM-adjudicated: own wording on the
  helm detail + Dash offer copy ("consequence at GM's discretion"); NOT a
  standing notice (notice taxonomy: post-choice risk ≠ standing condition).
- Fuel = segmented record (None/Soul Coin/Demon Ichor → 0/1/2) on vehicle
  +ADD, `when` acquired AND helm seat held; keyed effect on
  `fuel.recorded` (AC-mode pattern: never write the derive's fact). Boost =
  segmented (None/Demon Ichor → 0/1), same gating, `legalWhen`
  fuel = soul coin + diagnostic, committable. Boost 1-minute duration =
  copy only (no timer; player flips back to None).
- Speed: NEW derive `companion.tormentor.speed.effective` = fuel map
  (0/100/80) + 30 if boosted; panel Speed entry reads it; legacy flat baked
  `speed` orphans unread (ac.effective precedent, no migration).
- Fuel visibility: NEW panel value entry "Fuel" (labelled map of
  fuel.current); NO boost chip (number + control pre-show suffice).
- Details: four new catalog entries `vehicle/tormentor-harpoon`,
  `-helm`, `-fuel`, `-clinger` (en bodies, own wording, app-meta guard
  extended); offers link via detailKey; existing `vehicle/tormentor` body
  stays. No passenger detail (nothing to say).
- i18n: `rule.tormentor.*` in common.json BOTH locales; tlh plausible
  values normal casing; `play.stats.tormentor.fuel`;
  `play.choices.tormentor.fuel`/`.boost` prefixes; module-i18n +
  panel-declaration guards.
- Seat helper (board/leave offer pair) is module-LOCAL in
  vehicle-tormentor.ts; not builder-level until a second vehicle needs it.

## Economy ruling (user, 2026-10-26)

Taking a vehicle action / bonus action / reaction consumes the PLAYER's
matching economy slot — the player is the one doing it; no double-dipping.
Vehicle activities are NEVER PC weapon attacks: they use the GENERIC economy
spend (action/bonus/reaction pool), never `attackActionSpend`, and Extra
Attack does NOT apply (harpoon→PC-attack and PC-attack→harpoon both illegal;
user-reported bug on #486, fixed same day).

- Drive + Dash (PR-C): Drive = player ACTION (generic spend). Dash
  CORRECTED (user + stat block Ability Scores fine print): BONUS action.
  Risk note FINAL SHAPE (user correction 2): UNCONDITIONAL per-row notice on
  EVERY dash row stating the rule — "Each encounter the vehicle can Dash 3
  times plus its Constitution modifier; each Dash beyond that runs the risk
  of damaging the vehicle" — the app has NO encounter tracking so it cannot
  gate on a count; the player counts, the app informs. The interim
  counter/chip/allowance machinery (dashes.taken, allowance derive,
  conditional gate) was OVER-BUILT and is deleted. Movement doubling stays
  per-turn. Notice text renders on COLLAPSED rows too (generic UI fix).
- Juke (ADDED to PR-C by user): player REACTION; advantage on Dex saves;
  requires the vehicle able to move. PR-C legality = reaction pool + not
  prone ("unable to move" diagnostic); PR-D refines the leg to
  speed.effective > 0 once fuel exists. Own wording; no dice wiring.
- Fuel changes + Boost (PR-D): player BONUS ACTION each (per stat block) —
  NOT free record controls. Offers with segmented secondaryControl (acquire
  AC-mode pattern), `when` acquired AND helm-seated, apply = generic
  bonus-action spend + keyed record write. Boost legality adds fuel = soul
  coin (illegal-but-committable + diagnostic).

## TDD + PR process

TDD inside every PR (RED → Green → Refactor): RED = new yaml scenario dirs +
unit assertions that COMPILE, RUN, don't panic, and FAIL; then implement;
`make check`, `make test-unit`, `make test`, `make format-check` green before
push. Each PR from clean `origin/main`. Use SUBAGENTS for implementation
tasks; main agent coordinates + talks to the human only. After each push:
`make sync-rule-groups` (+ `make deploy-test` for CDN invalidation), codex
review monitor (~15 min), reply to every comment, user's hands-on tablet test
gates merge. I never merge. **If any step proves unworkable, STOP and
discuss.**

## Checklist

PR-A — Passenger (seat infrastructure):

PR-A (done → PR #485, commit 27ffeff5 signed; 31 RED → 588 green; SEAT_STATIONS
list iterated by every condition; diagnostics station-generic shared keys;
scenarios de-seated naming; deployed):

- [x] RED yaml scenarios: board → effect + chip + seats.passenger=1; leave →
      eviction; re-board-while-seated illegal-but-committable + diagnostic;
      board when used ≥ 4 illegal-but-committable + diagnostic; leave when
      not seated illegal-but-committable + diagnostic; abandon evicts; re-add
      resets
- [x] RED unit pins for capacity derive change (used = occupancy + seats,
      default 0; existing scenarios asserting default-1 updated RED-first)
- [x] Module: seat effect/offer helper + passenger instance + CHILD_KEYS +
      diagnostics + i18n both locales
- [x] Gates green; PR pushed; deploy done; codex monitor armed
- [x] codex round 1: P2 slider-default double-count FIXED (2db86573 signed,
      RED-first, redeployed; reply posted); P2 legacy-dependents WON'T FIX
      (accepted legacy-blob precedent #477; abandon/re-acquire self-heals;
      reply posted)
- [x] USER hands-on test PASSED (2026-10-26); MERGED (#485) — PR-A COMPLETE

PR-B (done → PR #486, commit b2495a19 signed; 20 RED → green; shared
no-action diagnostic; dice.any.companion annotationLabels via generalized
companion guard [steed precedent]; detail published + synced + deployed):

- [x] RED yaml scenarios: take seat; fire offer exists only when seated;
      action-pool legality; dice-line ui (d20+7, 2d8+2 piercing); leave-seat
      hides offer
- [x] Attack offer + derives (hitBonus 7 / damageBonus 2 / damageDie 8,
      count 2) + detail `vehicle/tormentor-harpoon` (10 harpoons, magical,
      ammo untracked note)
- [x] Gates green; PR pushed; deploy done; codex monitor armed
- [x] USER bug report → economy fix (6d0e22de signed): fire = generic
      action spend, no Extra Attack accounting, both orders illegal pinned;
      CI green, zero codex comments
- [x] USER hands-on re-test PASSED; MERGED (#486) — PR-B COMPLETE

PR-C (done → PR #487, commit 37219cca signed; 27 RED → green; drive/dash =
MOVE buckets, juke = REACT ward; juke unable-to-move leg = prone; detail
published; CI green; codex zero findings round 1; deployed; NOTE: app-meta
guard not extended for helm body — fold into PR-D):

- [x] RED yaml scenarios: take seat; drive/dash/juke offers exist only when
      seated; action cost + no-action illegality (drive/dash); reaction cost + no-reaction illegality (juke); juke illegal while prone (unable to
      move, committable); applies spend economy, write no facts
- [x] Drive + Dash (ACTION) + Juke (REACTION, Dex-save advantage, able-to-
      move leg = not prone here) offers + detail `vehicle/tormentor-helm`
      (dash risk GM-adjudicated + Juke, own wording)
- [x] Gates green; PR pushed; deploy done; codex monitor armed (round 1
      clean)
- [x] USER test round 2 findings: (1) Drive was intent-only → movement
      economy ADDED (cfa92549 signed): steed pattern copied verbatim
      (movement.base/total/remaining derives, base READS speed facts = PR-D
      seam; drive = move offer w/ distance slider + player action spend;
      dash writes dashed → doubles total; movement usedMax panel row) —
      supersedes the old "no vehicle movement economy" decision; (2) dash
      risk invisible in play → per-row notice diagnostic on dash rows
      (bounce-note pattern) in flight
- [x] PROCESS FIX (user): subagents PUSH ONLY; parent deploys ONCE before
      handing to user (per-test-batch deploy, not per-subagent)
- [x] codex P2 (movement spent survives same-turn abandon→re-acquire):
      DECLINED (user rationale — the carried spend CAPS combined same-turn
      driving at one vehicle's pool; a fresh pool would allow 140 ft/turn;
      unreachable legally anyway, each drive = the one ACTION). Both replies
      posted. ACCEPTED BEHAVIOUR — pin as intended if ever touched (note for
      Demon Grinder: cross-vehicle same-turn cap is the goal)
- [x] Dash note LANDED (was 3d8e952b): per-row notice on planned dash rows
      (bounce-note pattern via apply diagnostics + plan fold); superseded by
      the rework below
- [x] USER test round 3: Dash is a BONUS action (2024 block) + per-encounter
      cap 3+CON mod (source: Ability Scores fine print) → REWORKED
      (was 83da2f67): actionCost bonus, no_bonus_action diagnostic, keyed
      running-total dashes.taken chip (untilLongRest, CHILD_KEYS), allowance
      derive 3+con.modifier, risk note ONLY beyond allowance, number-free
      copy, GM-adjudicated wording deleted everywhere
- [x] RE-SIGNED: whole branch force-rebased with -S (all four PR commits
      carry SSH signatures; shas 1ce6aa33/bc29f051/82c00706/9aea8fea),
      force-pushed with lease; deploy + review check armed
- [x] USER correction 3: counter machinery OVER-BUILT (no encounter
      tracking → cannot gate) → SIMPLIFIED (d59b99ca signed): counter/
      chip/allowance derive/conditional gate DELETED; note UNCONDITIONAL on
      every dash row; NEW generic Diagnostic.params + render-site
      forwarding; {{allowance}} interpolated from 3+con.modifier at fold
      time (5 @ CON 14, 7 @ +4, pinned); collapsed-row rendering kept
- [x] USER hands-on re-test PASSED; MERGED (#487) — PR-C COMPLETE
      (final shape: helm seat; Drive = action + movement economy;
      Dash = bonus action + doubling + unconditional interpolated risk
      note; Juke = reaction; collapsed-row notices; Diagnostic.params)

PR-D (done → PR #488, commit 4d6d919b signed; 48 RED → green; CI green;
generic UiEntryValue.valueLabels for textual Fuel chip; combined juke
unable-to-move leg; app-meta guard extended; flat speed bake retired,
legacy inert; deployed; USER test PASSED 2026-10-27):

- [x] RED yaml scenarios: fuel/boost offer ui (segmented secondaryControl +
      bonus-action cost); speeds 0/100/80; boost +30; boost without soul
      coin illegal-but-committable + diagnostic; no-bonus-action
      illegal-but-committable; leave helm hides offers, state persists;
      abandon resets; legacy flat speed tolerated; juke leg refines to
      speed.effective > 0
- [x] Fuel + boost bonus-action offers (helm-gated, segmented, keyed
      records) + `speed.effective` derive + Fuel panel entry + Speed entry
      swap + details + i18n both locales
- [x] Gates green; PR pushed; deploy done; codex monitor armed
- [x] USER hands-on test PASSED — awaiting merge

PR-E (done → PR #489, commit 51680506 signed; 20 RED → green; consumesSeat
flag on SeatSpec drives both capacity count + take-offer leg; SEATS spec
registry beside SEAT_STATIONS; deployed; USER test PASSED; MERGED (#489)):

- [x] RED yaml scenarios: take/leave seat; exclusive with passenger
      (illegal-but-committable + diagnostic); capacity unchanged; notice
      on/off; abandon evicts
- [x] Clinger seat + standing notice (dex checks, own wording, both locales) + detail `vehicle/tormentor-clinger`
- [x] Gates green; PR pushed; deploy done; codex monitor armed
- [x] USER hands-on test PASSED; MERGED (#489) — PR-E COMPLETE

End of job:

- [x] All PRs merged (#485 #486 #487 #488 #489); CI green throughout;
      every review comment replied (fixed / reasoned won't-fix)
- [ ] User deletes tormentor.png + tormentor2.png — SEATS JOB COMPLETE
      except this
