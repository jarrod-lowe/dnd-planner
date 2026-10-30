# Vehicle: Demon Grinder

Second infernal vehicle, built on a genericised infernal-vehicle factory shared
with the Tormentor. Facts verified against `demon-grinder.png` (repo root, do
NOT commit) + BG:DiA Appendix B (AnyFlip scan pp. 213–225, includes the general
rules + all four stat blocks); prose is our own wording, numbers are facts.
Delete png at end of job.

## Stat block (verified)

- Gargantuan vehicle, 12,000 lb.; Creature Capacity 8 Medium; Cargo 1 ton
- AC 19 flat — NO motionless mode (source rule "19 + Dex mod"; DEX +0 → no
  rider printed; Tormentor-only feature stays Tormentor-only)
- HP 200 (damage threshold 10, mishap threshold 20); Speed 100 ft.
- STR 18 (+4), DEX 10 (+0), CON 18 (+4); INT/WIS/CHA 0 (not displayed)
- Damage immunities fire, poison, psychic; condition immunities as Tormentor
  (prone NOT immune)
- Traits: Crushing Wheels (moves through Large-or-smaller space; DC 11 Dex
  save or 22 (4d10) bludgeoning + knocked prone; already prone → extra 22
  (4d10); once per creature per turn), Magic Weapons, Prone Deficiency.
  NO Raking Scythes
- Stations: Helm (1 crew, ¾ cover; drive/steer); Chomper (1 crew, ½ cover;
  +9, reach 5 ft., 25 (6d6+4) piercing; 0-HP target ground to bits + spit out
  through pipes, any nonmagical items held or carried destroyed); Wrecking
  Ball (1 crew, ½ cover; +9, reach 15 ft., 40 (8d8+4) bludgeoning; double vs
  objects/structures); 2× Harpoon Flinger (EACH 1 crew, ½ cover, 10 harpoons
  per station, +5, 120 ft., 9 (2d8) piercing)
- NO Reaction — no Juke on DG (Tormentor/Devil's Ride only). Dash + fuel +
  boost = generic vehicle/helm rules → DG gets them via factory
- Tormentor numbers for later PRs (verified same scan): Crushing Wheels DC 13,
  11 (2d10), Medium-or-smaller, same riders; Raking Scythes = moves within
  5 ft of a non-prone creature OR another vehicle, first time on a turn →
  13 (2d10+2) slashing, avoided on DC 13 Dex save (a vehicle avoids if its
  driver saves)

## Settled decisions (grilling 2026-10-28)

- Whole job planned here (no per-phase re-grill unless implementation
  surfaces new questions).
- Cover PR-2 (seat-sourced cover, `cover.md`) lands FIRST — DG seats plug
  into its vehicle→player contribution seam.
- Factory: `buildInfernalVehicle(spec)` extracted first; Tormentor migrated
  as pure spec, behaviour-identical, corpus-pinned; the module-header "later
  vehicles join this same group" comment corrected (superseded).
- TWO rule groups: `tormentor` untouched + new `demon-grinder` (subject
  `demon-grinder`, facts `companion.demonGrinder.*`, 🛞 Demon Grinder labels,
  detail keys `vehicle/demon-grinder*`, i18n templated from id).
- Ownership per-vehicle: owning both vehicles is LEGAL (no cross-vehicle
  ALREADY_HAVE). ONE seat per player globally across all vehicles
  (registry-level seatedAnywhere). Movement spend = ONE shared player-level
  fact; every vehicle's remaining = its total − shared spent → cross-vehicle
  same-turn cap (recorded goal from Tormentor PR-C).
- DG spec: no acMode; no Juke; drive/dash (allowance 3+CON mod = 7,
  interpolated, never hardcoded)/fuel/boost (same generic machinery, speeds
  0/100/80, boost +30 soul-coin-only); checks/saves 18/10/18; prone pair +
  wrecked + mishap note + damage-threshold Use/Ignore via factory; occupancy
  slider 0–8.
- Base seats: Helm + ONE Harpoon Flinger (DG numbers +5/2d8). Weapon
  stations = spec-driven machinery; Tormentor harpoon migrates onto it.
  Multi-harpoonist deferred to its own phase (factory anticipates station
  multiplicity).
- Station riders = PER-ROW ANNOTATIONS on the station's attack rows
  (SUPERSEDES the original copy-only ruling; user correction 2026-10-28 —
  post-hoc consequences belong on the action panel, dash-note pattern):
  chomper 0-HP destruction + nonmagical items destroyed; wrecking ball
  doubled vs objects/structures. Unconditional note on every attack row,
  collapsed-row rendering, no mechanics behind them, own wording both
  locales. Details keep their descriptions; #500 amended pre-merge
  (chomper agent resumed, RED-first).
- Crushing Wheels + Raking Scythes = generic spec-driven per-row annotation
  on EVERY drive row (dash-note pattern; {{dc}}/{{damage}} params;
  collapsed-row rendering); wheels on both vehicles with per-vehicle numbers,
  scythes Tormentor-only.
- Damage immunities = generic recorder annotation on the record-damage offer
  (hpRecorders option; lists immune types, both locales); both vehicles wire
  fire/poison/psychic; retires the immunities sentence from Tormentor damage
  detail copy if redundant.
- Not modelled (existing simplifications, unchanged): engine on/off,
  vehicle Disengage, driver proficiency rider, mishap table itself,
  fuel-charge durations (24/48/72 h).
- Future work (recorded, not scheduled): multi-harpoonist; Scavenger +
  Devil's Ride (blocks now verified via scan); Appendix B alternative weapon
  stations + upgrades.

## TDD + PR process

TDD inside every PR (RED → Green → Refactor): RED = new yaml scenario dirs +
unit pins that COMPILE, RUN, don't panic, FAIL; then implement; `make check`,
`make test-unit`, `make test`, `make format-check` green before push. Each PR
from clean `origin/main`. SUBAGENTS implement, PUSH ONLY; parent deploys once
per test batch (`make sync-rule-groups` + `make deploy-test`; playwright on
localhost:5173 if helpful). Codex review monitor (~15 min) after each push;
every comment replied (fixed / reasoned won't-fix; discuss with user if
unsure); user's hands-on tablet test gates merge. Never merge ourselves.
**If any step proves unworkable, STOP and discuss.**

## PRs

- PR-1 Factory extraction: `buildInfernalVehicle(spec)` + Tormentor as spec;
  seat helper/registries/derives/offers/panels lift into factory; comment fix.
- PR-2 Shared movement spend: player-level spend fact replaces
  `companion.tormentor.movement.spent`; remaining = total − shared; cap pinned
  cross-vehicle with a factory-built fixture vehicle (unit level).
- PR-3 DG base (seat-free): group/module/yaml/i18n/details; acquire/abandon;
  panels; occupancy; acMode absent; hp recorders (thresholds + mishap);
  prone pair; wrecked; checks/saves; fuel/speed/movement derives.
- PR-4 DG seats: generic weapon-station machinery (+ Tormentor harpoon
  migration); Helm + one Harpoon Flinger; drive/dash/fuel/boost offers;
  no Juke; cover contributions (helm ¾, harpoon ½).
- PR-5 Wrecking Ball station (spec + detail + copy riders).
- PR-6 Chomper station (spec + detail + copy riders).
- PR-7 Crushing Wheels annotation: generic move-trait machinery; both
  vehicles, per-vehicle DC/damage params (DG 11/22 (4d10); T 13/11 (2d10)).
- PR-8 Raking Scythes annotation: Tormentor spec entry on same machinery
  (13 (2d10+2), DC 13; vehicle-avoids-if-driver-saves in copy).
- PR-9 Damage immunities annotation: generic recorder option; both vehicles.
- PR-10 Multi-harpoonist: second harpoon station; mechanism chosen when
  reached (distinct stations vs station capacity) — mini-grill if not obvious.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for
co-ordination and communicating with the human.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Checklist

PR-1 — factory extraction (done → PR #494, commits 79e62a95 + 9ec2a282, both
SSH-signed; 22 RED pins observed failing first; net −1 414 lines; corpus
unchanged green; emitted-surface i18n walk restores the coverage guard for
spec-templated keys; confinement allowlist + verify-chunks lazy-derived):

- [x] RED: unit pins for factory surface (spec → module emission) + full
      corpus unchanged (51 tormentor scenario dirs, 208 unit its)
- [x] Factory + Tormentor spec migration; module-header comment fixed
- [x] Gates green; PR pushed (no deploy); codex monitor armed (14:48 check)
- [x] 14:48 check: CI all green; codex review completed, ZERO findings;
      deployed to test 14:35
- [x] USER hands-on test round 1: reported AC mode stuck 19 + Dex bonus
      missing — investigation found NO reproduction anywhere (branch code,
      full-registry engine, live app w/ real backend, deployed chunk
      fingerprint); broken state gone from all characters; presumed stale
      browser bundle. Disclosed: TestCharacter exercised + abandoned (inert
      end state)
- [x] MERGED by user (#494) — PR-1 COMPLETE

PR-2 — shared movement spend (done → PR #495, commit c628b959 SSH-signed;
shared fact `companion.vehicle.movement.spent` via VEHICLE_MOVEMENT_SPENT
constant; 2 yaml scenarios + 4 unit pins RED first (3+2 failed observed);
fixture second vehicle pins cross-vehicle cap; legacy old-fact effect inert +
pinned; only 3 existing drive-effect pins updated = exactly the behaviour
change):

- [x] RED: scenarios (tormentor drive/dash spend via shared fact; legacy
      `companion.tormentor.movement.spent` tolerated end-of-turn) + unit pin
      of cross-vehicle cap via fixture vehicle
- [x] Shared spend fact wired into factory movement derives
- [x] Gates green; PR pushed; codex monitor armed (16:33 check)
- [x] Deployed 16:20; USER hands-on test PASSED; MERGED (#495) — PR-2
      COMPLETE

PR-3 — DG base (done → PR #496, commit 9ed4c8a2 SSH-signed — subagent
misreported unsigned, re-check confirmed gpgsig on the pushed sha; 8 yaml
dirs + 24+ unit pins RED first; two new factory branches flatAc + juke?
both RED-pinned; Tormentor touched only by `juke: true` (behaviour-
identical); cargo bakes 2000 lb., detail carries 1-ton wording; dormant
helm-gated offers emitted but pinned never-surfacing):

- [x] RED: yaml scenarios (acquire → facts 200/10/20/1 ton/18/10/18/cap 8/
      speed 100/flat ac 19; subject + panels; occupancy; damage/heal +
      threshold Use/Ignore + mishap note; prone pair; abandon evicts) +
      unit pins (panels per subject, both locales)
- [x] Module + registration + `data/rule-groups/vehicles/demon-grinder.yaml` + details (stat block, damage, prone) + i18n both locales +
      RESOURCE_SHORT_LABELS rows
- [x] Gates green; PR pushed; codex monitor armed (17:27 check)
- [x] Parent deploys once; USER hands-on test — ROUND 1 finding (search
      "grinder" missed; prefix-index duplicate keyword) FIXED 8ae4b610 +
      verified live in DynamoDB (gri → 3 entries); round 2 PASSED; MERGED
      (#496) — PR-3 COMPLETE

PR-3.5 — cover PR-2 prerequisite (tracked in cover.md; per settled
sequencing, lands before DG seats):

- [x] Cover PR-2 → PR #497 (commit 30bb735c SSH-signed; SeatSpec.cover spec
      field; factory emits best-held-seat → shared `cover.seat` fact,
      combine max; cover.effective = max(manual, seat); leave/abandon drop
      automatically; DG seats next PR are data-only). Deployed; review check
      17:56
- [x] USER hands-on test PASSED; MERGED (#497) — COVER PR-2 COMPLETE;
      DG SEATS UNBLOCKED

PR-3.6 — DG cargo chip display: REVIEWED, NO CHANGE (user ruling
2026-10-28): chip keeps raw 2000 — more useful than "1 ton" (user would
never convert it themselves); detail body keeps "1 ton (2,000 lb.)".
1 ton = 2,000 lb US short ton (WotC is US-published; NOT imperial 2,240).

PR-4 — DG seats (done → PR #498, commit e265d67c SSH-verified; +1807/−71;
8 yaml dirs + 20 unit REDs first; cross-vehicle exclusivity via
VEHICLE_SPECS registry map (later vehicles data-only, third-fixture
pinned); shared chunk-infernal-vehicle.js verified single-instance; NOTE
weapon-station machinery + Tormentor migration already existed from PR-1
— this PR exercised it on DG's zero-bonus shape; dash {{allowance}}=7
unit-pinned (yaml harness can't assert params); stat-block detail gained
Stations+Dash paragraphs, flagged for review):

- [x] RED: yaml scenarios (helm/harpoon take/leave + global one-seat legs;
      harpoon fire offer + dice line (+5, 2d8); drive/dash/fuel/boost offers
      helm-gated; dash risk note interpolates 7; wrecked legs; cover
      contributions ¾/½; no Juke offer anywhere) + unit pins (weapon-station
      machinery generic; Tormentor harpoon migration behaviour-identical)
- [x] Weapon-station machinery + Tormentor migration; DG seat specs + offers + details (`vehicle/demon-grinder-helm`, `-harpoon`)
- [x] Gates green; PR pushed; codex monitor armed (18:35 check)
- [x] Parent deploys once; USER hands-on test PASSED; MERGED (#498) — PR-4
      COMPLETE, BASE PHASE COMPLETE

PR-5 — wrecking ball (done → PR #499, commit bceb7762 SSH-verified;
DATA-ONLY HELD — factory + Tormentor untouched, one SeatSpec + i18n +
yaml detail + tests; 15 REDs first (2 yaml dirs + 13 unit); station
slotted Helm→WreckingBall→Harpoon so PR-6 chomper drops in at stat-block
order; keywords carry ball/wrecking per PR-3 lesson):

- [x] RED: yaml scenarios (station offers gated on seat; attack offer
      +9/8d8+4; rider copy present) + unit pins
- [x] Spec entry + detail `vehicle/demon-grinder-wrecking-ball` + i18n
- [x] Gates green; PR pushed; codex monitor armed (19:21 check)
- [x] Parent deploys once; USER hands-on test PASSED; MERGED (#499) — PR-5
      COMPLETE

PR-6 — chomper (done → PR #500, commit 3b31266a SSH-verified; DATA-ONLY
held, factory + Tormentor untouched; 16 REDs first (2 yaml dirs + 13
unit + 1 allowlist); chomper slotted Helm→Chomper→WreckingBall→Harpoon;
riders honoured: ground-to-bits + pipes + nonmagical items destroyed, NO
wish, NO AC-15; first attempt agent died on API usage limit pre-work,
clean relaunch):

- [x] RED: yaml scenarios (station offers gated on seat; attack offer
      +9/6d6+4; rider copy present) + unit pins
- [x] Spec entry + detail `vehicle/demon-grinder-chomper` + i18n
- [x] Gates green; PR pushed; codex monitor armed (20:04 check)
- [x] USER CORRECTION mid-test: riders = PER-ROW ANNOTATIONS (chomper 0-HP + items; ball doubling) — amendment 69bd7c14 SSH-verified on #500:
      optional SeatWeaponSpec.rider → unconditional notice diagnostic on
      every attack row (DASH_RISK shape); own wording, no book phrasing;
      offer descriptions trimmed of duplicates; harpoon pinned note-free;
      10 REDs first. Supersedes PR-5's copy-only landing for the ball
- [x] USER re-test PASSED; MERGED (#500) — PR-6 COMPLETE; all four
      stations live (Helm, Chomper, Wrecking Ball, Harpoon)

PR-7 — crushing wheels annotation (done → PR #501, commit c1c39bf7
SSH-verified; `moveTraits?: MoveTraitSpec[]` on the spec — drive apply
pushes one unconditional notice per entry (DASH_RISK idiom); params
computed (dc, damage = dice avg); 20 REDs first (2 new yaml + 9 corpus
drive scenarios + 9 unit); two-trait fixture pins PR-8 scythes as data;
disclosed wording divergence: DG detail vs drive note phrase the
already-prone clause differently — both faithful, details unchanged):

- [x] RED: yaml scenarios (every drive row carries the note on BOTH vehicles
      with per-vehicle params; collapsed-row rendering; no drive → no note) +
      unit pins
- [x] Generic move-trait machinery + wheels spec entries (DG + Tormentor)
- [x] Gates green; PR pushed; codex monitor armed (21:33 check)
- [x] codex P2 (already-prone clause wrong: wheels-caused + second-pass
      requirement) ACCEPTED — review fix ef9715cd SSH-verified: any-source
      prone takes {{damage}} instead of being knocked prone, once per
      creature per turn; RED semantic pins; reply posted on thread; agent
      died twice on API usage limits, resumed into its own uncommitted work
- [x] USER review 2: {{damage}} now carries the DICE FORMULA + type (4d10
      bludgeoning / 2d10 bludgeoning) computed from spec — 66537f71
      SSH-verified, 6 REDs first, MoveTraitSpec gains damageType (scythes
      will render 2d10+2 slashing); PR body updated
- [x] USER review 3 RESTRUCTURE landed (473284fe SSH-verified, 22 REDs
      first): vehicle-level roll row `wheels-<id>` (free, no spend, no
      apply; damage-only dice line, type localized via damage-type.\* at
      the render site — codex P2 4408768279 resolved structurally,
      replied); per-vehicle `<stem>.movement.drove` marker written by
      Drive beside the shared spend, cross-vehicle precision pinned;
      not_driven illegal-but-committable; Drive note slims to DC {{dc}}
      pointer; scythes ride as `scythes-<id>` data (MoveTraitSpec.slug)
- [x] USER corrections (5835cfe9 SSH-verified, 21 REDs first): roll row
      re-filed ATTACK:'weapons' (was SAVE — "Crushing Wheels is in no way
      a save"); note is now a LINKED CHIP on the drive panel (annotate +
      addsToPlan → tapping plans the wheels row; Extra Attack mechanism);
      per-row diagnostic removed (chip is the note)
- [x] USER re-test PASSED; MERGED (#501, 5 commits) — PR-7 COMPLETE

PR-7b — trait panel with damage roller: CANCELLED 2026-10-29 (user
restructure — the attack offer replaces the panel; no click machinery).

PR-8 — raking scythes annotation (user ruling: works THE SAME WAY as
Crushing Wheels; done → PR #502, commit 707792da SSH-verified; DATA-ONLY
HELD — factory untouched, one spec entry + 4 i18n keys/locale; 7 REDs
first; DG absence pinned both directions; one disclosed comment-only fix
in the DG spec (its PR-7 comment falsely claimed scythes would join the
Grinder's list); agent died on usage limit near-done, resumed into its
own tree):

- [x] RED: yaml scenarios (scythes roll row + chip on Tormentor, coexists
      with wheels; DG has nothing scythes) + unit pins
- [x] Scythes spec entry (Tormentor only: DC 13, 2d10+2 slashing,
      within-5-ft non-prone-or-vehicle trigger, driver-save clause copy)
- [x] Gates green; PR pushed; codex monitor armed (17:20 check)
- [x] USER test PASSED; MERGED (#502) — PR-8 COMPLETE

PR-9 — damage immunities annotation (done → PR #503, commit c93285f4
SSH-verified; vehicle-level opt-in `immunities?: string[]` → ONE standing
annotation on the damage offer, types rendered as localized damage-type.\*
chips via a NEW damageTypes annotation channel; player/steed byte-identical
(pinned); TRIMMED the Immunities paragraph from both damage-detail bodies
(stat-block details keep their line); 2 yaml dirs + 7 unit REDs first):

- [x] RED: yaml scenarios (damage offer carries immunities annotation on
      both vehicles; player/steed unaffected) + unit pins (option off by
      default, both locales)
- [x] Generic recorder option + both vehicles wired; Tormentor damage detail
      copy trimmed if redundant
- [x] Gates green; PR pushed; codex monitor armed (18:04 check)
- [x] USER test PASSED; MERGED (#503) — PR-9 COMPLETE

PR-10 — multi-harpoonist (user ruling 2026-10-30: NOTHING mechanical
needed — one seat per player globally, other crew = occupancy slider,
fire offer/dice line identical per station; closed as recorded no-op
plus copy accuracy → PR #504, commit de2d6a36 SSH-verified, parent-done
inline per the PR-3 keyword-fix precedent):

- [x] Mechanism decided: no-op; stat-block + flinger details now state
      two flingers, each carrying 10 harpoons
- [x] Gates green (full make test + format-check); PR pushed; codex
      monitor armed (18:52 check)

End of job:

- [ ] All PRs merged; CI green throughout; every review comment replied
- [ ] Final audit vs stat block (anything missing → user)
- [ ] User deletes demon-grinder.png
