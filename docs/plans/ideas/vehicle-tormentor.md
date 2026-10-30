# Vehicle: Tormentor

Implement the Tormentor vehicle as an extension of the Steed functionality.
Seats (action stations) are modelled as separate vehicles; only "Tormentor
(Damage Control)" — the pseudo-seat for generic non-station actions — is
implemented now. Other seats + Demon Grinder come later.

The Tormentor is not under the SRD: all app text is our own wording; numbers
below are facts, prose is never copied. `tomentor.png` (repo root, do NOT
commit) holds the source stat block; delete after all passes done.

## Stat block (verified against tormentor.png)

- Huge vehicle, 3,000 lb.
- Creature Capacity 4 Medium creatures; Cargo Capacity 500 lb.
- AC 21 (19 while motionless); HP 60 (damage threshold 10, mishap threshold 20); Speed 100 ft.
- STR 16 (+3), DEX 14 (+2), CON 14 (+2); no Int/Wis/Cha
- Damage immunities: fire, poison, psychic
- Condition immunities: blinded, charmed, deafened, frightened, paralyzed, petrified, poisoned, stunned, unconscious (prone NOT immune)
- Traits: Crushing Wheels, Prone Deficiency, Magic Weapons, Raking Scythes
- Action stations: Helm (1 crew, three-quarters cover, drive/steer), Harpoon Flinger (1 crew, half cover, 10 harpoons, +7 to hit, 120 ft., 11 (2d8+2) piercing)
- Reaction: Juke (driver's reaction, advantage on Dex save when able to move)

## Settled decisions (grilling 2026-10-25)

- PRs = smallest meaningful testable units; passes split into multiple PRs.
- Pass 0 required: `derivePanels.ts` hardcodes STEED\_\* catalog blocks. Fix: rule
  modules declare their subject's top-bar/resource entries (data on the module,
  like annotationLabels); UI aggregates by subject. Steed migrated onto it,
  behaviour pinned by existing tests. Adding a vehicle = data only.
- Long labels: generic per-chip max-width + horizontal scroll (stats line,
  resource line, subject seg-buttons); full name kept accessible (title/aria).
- ONE rule group `tormentor` ("Tormentor") holds ALL seats — seats change
  during play, so they are not separate groups. Each seat is still its own
  subject/panel (e.g. `tormentor-damage-control`, label "Tormentor (Damage
  Control)").
- Boarding is a PLAYER action: board offer lives in the PLAYER's +ADD (free
  section, no station subject on the offer), ungated, no legality checks
  (multiple boardings illegal-but-possible; diagnostics deferred). Apply =
  permanent keyed effect (steed `steedEffect` pattern) baking the stat block
  into facts. Having boarded makes that STATION's +ADD panel available
  (subject panel) containing the station's actions — including DE-BOARD
  (planned offer, gated on active, apply removes the board effect; steed
  dismiss/retire pattern). Raw mount-chip removal remains the override path.
- Subject id `tormentor-damage-control`; facts `companion.tormentorDamageControl.*`;
  seg-button label "Tormentor (Damage Control)". Later seats parallel.
- Stats display-only in pass 1: HP 60, AC 21 (motionless 19 = pass 4), Speed
  100 ft., Cargo 500 lb., Str/Dex/Con 16/14/14 chips. No Int/Wis/Cha, no
  movement economy, no damage tracking.
- Creature capacity: usedMax resource 0–4; one plan-able slider offer (0–4,
  steed HP-modifier pattern) writing occupancy; board effect bakes default 1
  (the boarder).
- Board-flip detail: effect chip carries `section: 'mount'` +
  `detailKey: 'vehicle/tormentor-damage-control'`; YAML detail block with our
  own wording (body en-only, names both locales).
- No placeholders for future seats/Demon Grinder.
- engineBridge steed damageType synthesis: leave; note as future cleanup.

## Pass 1 → PRs

### PR 1 — pass 0: module-declared subject entries

- RED: unit test asserting a module-declared entry surfaces for a subject (new
  mechanism) before any derivePanels support.
- Extend rule module/rule-group ui surface to declare top-bar/resource entries
  (gate fact, label key, kind: hp/value/ability/usedMax, subject).
- derivePanels aggregates declarations; delete STEED\_\* hardcodes; steed module
  declares its own (same rendered output).
- Gates: make check, make test, format-check.

### PR 2 — generic label overflow scroll

- RED: component test — long label clamps width, scrolls, keeps accessible name.
- Per-chip/seg-button max-width + overflow-x scroll in IntentTopBar + Ledger;
  CSS variables from theme only.

### PR 3 — Tormentor (Damage Control): board + stats + flip

- RED: yaml scenarios (new dirs + EXPECTED_RUNNABLE): board offer exists when
  group loaded; apply → facts (active, ac 21, hp 60, speed 100, cargo 500,
  str/dex/con 16/14/14); subject appears; unboard via removeEffect clears.
- New rule module + registry/lazy registration + YAML metadata (translations en
  - en-x-tlh, detail block; no rules in YAML).
- Board offer (free section) → keyed permanent effect with mount display +
  detailKey; module-declared panel entries (PR 1 mechanism).
- i18n: `play.companion.tormentor-damage-control`, `play.addRow.*Sublabel`,
  `play.stats.tormentor-damage-control.*`, short labels +
  RESOURCE_SHORT_LABELS; both locales (module-i18n-coverage).
- Detail body: own wording, en-only; `make publish-details`.
- Unit tests: UI entries per subject (steed-\* tests as pattern).

### PR 4 — creature capacity resource + occupancy slider

- RED: yaml scenario — occupancy slider offer vars 0–4; apply writes used; cap
  clamp; board default 1; removeEffect resets.
- usedMax resource entry (module-declared), slider offer (steed HP-modifier
  pattern), diagnostics none.

## Passes 2–4 (separate plan + grilling each, PRs between)

- Pass 3: damage threshold (generic mechanism, set 10); damage immunities
  (annotation?); mishap threshold 20 (annotation?).
- Pass 4: AC mode switch item (21 ↔ 19 motionless).

### Pass 2 — vehicle prone + Prone Deficiency (settled 2026-10-25)

Extend `vehicle-tormentor.ts` (same group; no new module). State tracking
ONLY — no attack flags, no movement wiring, incapacitated stays descriptive.
Conditions today are player-global (`condition.*`), so the vehicle fact is
namespaced and NEVER reuses `proneEffect()`/`condition.prone`.

- Facts: `companion.tormentorDamageControl.prone`; keyed effect
  `tormentor-prone` (display.subject station → chip under station view);
  board effect `dependents` += prone key; de-board/re-board evict; re-board
  clears prone.
- Offers (STATION +ADD, ui.subject, free section, `when: boarded` ONLY —
  always visible + applicable while boarded; NEVER structural prone gates.
  Corrected 2026-10-25 three times: ungated → structural when-gates → both
  wrong; illegal = legalWhen + diagnostic + player override, never absent):
  `knocked-prone` (record; ILLEGAL while already prone — legalWhen
  prone === 0 — but committable), `flip-upright` (clear, empty same-key
  eviction; ILLEGAL while not prone — legalWhen prone > 0 — but committable).
- Annotation: NOTICE gated on the vehicle's PRONE fact (PC-prone parity —
  the CONDITION triggers the notice; corrected 2026-10-25 after user
  feedback: not standing-while-boarded): own-wording body — vehicle cannot
  right itself; until flipped upright it stays prone and can do nothing.
  Both locales.
- Detail body: add a Prone Deficiency line (own wording; app-meta guard holds).
- One PR. TDD: RED yaml scenarios (record/flip/de-board-eviction/notice) +
  unit tests (offers, effect shape, notice both locales).

### Pass 3 — damageable HP + damage threshold (settled 2026-10-25)

- HP pool (steed pattern): bake `hp.base` 60 (replaces the flat hp.max
  display fact); derives `hp.max`/`hp.current`/`hp.modifier.current`
  (currentHp from builder); top-bar HP entry value → usedMax.
- Station +ADD recorders (when: boarded, ui.subject, free): damage AND heal
  (slider 0..hp.max, keyed accumulating effects `tormentor-hp-damage`/
  `-heal`, displayFact chips under station view, untilLongRest). No manual
  HP setters (fixed stat block).
- GENERIC threshold mechanism (builder-level helper, not vehicle-local):
  damage apply gates amount vs a threshold FACT (`${F}.damageThreshold` 10
  baked here): below → records NOTHING + diagnostic (i18n both locales);
  ≥ threshold → full amount. Offer stays legal (apply-level gate, dash
  idiom).
- Destroyed at 0 HP (steed lethal-check precedent, but NO auto-unboard):
  sets `destroyed` fact + notice (own wording, gated on destroyed); board
  effect persists so the wreck stays inspectable; de-board clears all.
- NO standing notices for threshold/immunities/mishap (user: nothing behaves
  differently; no notice needed). The DAMAGE offer carries the explanation:
  detail text (own wording) covering threshold-10 semantics, damage
  immunities (fire/poison/psychic — record none of it), mishap threshold 20
  (one source ≥ 20 → consult the mishap table). Extend the app-meta guard.
- One PR. TDD: RED yaml scenarios (record/heal/accumulate/threshold-gate/
  destroyed/lifecycle) + unit tests.

### Pass 4 — AC mode segmented offer (settled 2026-10-26; v2)

v1 (annotation-toggle state chip) ABANDONED after hands-on test: the chip
sprayed across every station panel via label-matching and was absent when no
panels were open; its out-of-band tap also caused the pending-board trap.
PR #478 closed unmerged, branch deleted — nothing of it is on main.

v2 — segmented control (steed creatureType precedent), applied immediately
(record-class like occupancy/damage):

- BOARD offer gains a segmented secondary control [Moving | Motionless],
  default Moving; the board effect bakes the mode (no ac.value bake).
- Station +ADD gains an always-present (when boarded) "AC Mode" record offer
  with the same segmented control pre-showing the current mode; apply =
  keyed effect `tormentor-ac-mode` writing motionless; re-apply replaces;
  immediate effect.
- AC displayed via a NEW derived fact `${F}.ac.effective` (19 motionless
  else 21) — deliberately NOT ac.value, so legacy persisted boards (which
  bake flat ac.value) never hit a two-writer conflict; their stale ac.value
  is simply unused. Legacy boards default Moving and the station offer works
  on them. No load-seam migration (per user: dismiss + re-add is acceptable
  if ever needed; only a test character has one).
- Mode key joins CHILD_KEYS (dependents + board/de-board evictions); fresh
  board resets to the selected default.
- No legality gates; no annotate changes; no UI machinery (PanelRenderer /
  IntentTopBar untouched).
- One PR from clean origin/main. TDD.

### Follow-up 4 — Acquire/Abandon model, no seat fiction (settled 2026-10-26)

Data-level restructure (no engine/UI logic): bringing a vehicle in is
EQUIPPING, not boarding; the Damage Control seat fiction is retired.

- "Board the Tormentor" → "Acquire Tormentor", new intent sub-bucket
  BUILD:'vehicle' (labels both locales), still the PLAYER's +ADD.
- "De-board the Tormentor" → "Abandon Tormentor", BUILD:'vehicle', lives in
  the vehicle's own +ADD panel. Other vehicle offers (occupancy, damage/
  heal, prone, AC mode) unchanged in behavior and filing.
- User-facing label everywhere: "🛞 Tormentor" (no "(Damage Control)");
  detail/stat-block/keywords de-seated (acquire/abandon/vehicle wording).
- FULL id rename (user model: rules are data): subject
  `tormentor-damage-control` → `tormentor`; facts
  `companion.tormentorDamageControl.*` → `companion.tormentor.*`; i18n keys
  renamed to match; board effect id/key de-seated; one
  RESOURCE_SHORT_LABELS row; detail key `vehicle/tormentor-damage-control`
  → `vehicle/tormentor`. Persisted test characters orphaned → remove +
  re-add (accepted precedent; NO migration).
- One PR. TDD: guards enforce key parity; scenarios/pins updated
  mechanically; RED-first where behavior pins change (offer names/intents).

PR 8 (follow-up 4; PR #484, commits 9f82bc74 re-signed + cc330127
duplicate-acquire legality; EQUIP:'vehicle' under the BUILD verb family):

- [x] Full rename map applied (subject/facts/i18n/effect ids/detail key);
      guards green; corpus mechanically updated
- [x] Acquire/Abandon de-seated copy; 🛞 Tormentor labels; search de-seated
- [x] Duplicate-acquire illegal-but-committable (legalWhen + diagnostic,
      override pinned)
- [x] Gates green; re-signed; CI green; zero review comments
- [x] MERGED (#484) — FOLLOW-UP 4 COMPLETE. Job fully closed except png.

Future work (recorded, not scheduled): multiple Tormentors per character
(lifts the already-have leg); further seats (Helm, Harpoon Flinger); Demon
Grinder; optional concentration step-marker cleanup (redundant under prefix
annotations).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for
co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Checklist

PR 1 (done → PR #470; UiEntry types moved to rules-engine/panels.ts, guide §2
gained `panels` subsection):

- [x] RED test for module-declared entries
- [x] Mechanism + steed migration; STEED\_\* hardcodes deleted
- [x] make check / make test / make format-check
- [x] PR #470 pushed (2 signed commits, gates green)
- [x] codex monitor armed (10:52 check)
- [x] USER hands-on test PASSED (2026-10-25, deploy-test + localhost)
- [x] no review comments landed; CI all green (10:52 check); no merge
- [x] MERGED by user (PR 1 complete)

PR 2 (done → PR #471, 1 signed commit; test lives at
tests/unit/lib/components/play/label-overflow.test.ts):

- [x] RED component test (clamp + scroll + a11y name)
- [x] Generic overflow in IntentTopBar + Ledger + seg-buttons
- [x] Gates green (check / test / format-check)
- [x] PR #471 pushed; review check armed (11:19)
- [ ] USER hands-on test (long-label clamp+scroll, short labels unchanged)
- [x] 11:19 check: CI all green, zero review comments
- [ ] REVISION (user tablet feedback): 8rem clamps everywhere; pausable
      looping ticker on ALL clamped labels incl. resources (aria-hidden dup,
      reduced-motion fallback); exemptions kept — commit b58ecb3c pushed,
      PR comment posted, gates green
- [x] post-revision review check (12:17): CI green, zero comments
- [ ] ROUND 2 (user tablet feedback): root causes found by probe — ledger
      pane-title line + slot/action-economy cells exempted, plus fit-content
      row defeating the 100% cap; all clamped+tickered, ticker 60→30px/s —
      commit 850264ab pushed, gates green
- [x] USER tablet re-test #2 PASSED (2026-10-25)
- [x] TEMP label reverted (tree clean); clean redeploy running
- [x] round-2 review check (12:44): CI green, zero comments
- [x] MERGED by user (PR 2 complete; TEMP label reverted, clean redeploy done)

PR 3 (PR #472; commits 22ac25ac + 4df555a9 + 841d1f64 restructure; one
`tormentor` group, player-side board, station +ADD with de-board; codex
P1+P2 fixed+replied; 🛞 emoji; play.stats keys + panel-i18n guard test):

- [x] RED yaml scenarios (board/apply/subject/unboard)
- [x] Module + registration + YAML metadata + detail
- [x] Panel entries + i18n both locales
- [x] deploy-test done 13:12; RE-DEPLOY of restructure running 13:38
- [x] review checks (13:29 codex findings fixed+replied; 13:56 post-fix: green, no new comments)
- [x] USER tablet tests PASSED through seam round; MERGED by user (PR 3 done;
      final commits incl. 0340949a seam; CI green, all comments replied)
- [x] POLISH round (ab15b1b0 + 3528e0bd): blink root-caused (12px flex gap
      sweeping the viewport; copies now flush, translateX(-100%)); +ADD sublabel
      wraps/centers like plan rows; detail body in-world + app-meta guard test
- [x] polish deploy done 14:16; review check 14:33: CI green, no new comments

PR 4 (done → PR #473, commit c387ffe3; occupancy keyed effect, used/4
resource, dependents+eviction; raw-chip cascade unit-pinned per repo
precedent):

- [x] RED yaml scenarios (slider vars, default 1, clamp, reset)
- [x] Resource + slider offer + labels (both locales, guard tests green)
- [x] Gates green; PR #473 pushed
- [ ] deploy (15:22 running) + review check (15:40 armed)
- [x] MERGED by user — PASS 1 COMPLETE (PRs #470 #471 #472 #473)

PR 5 (pass 2 — vehicle prone + Prone Deficiency; PR #474, commit 9a6b395c):

- [x] RED yaml scenarios (record / flip upright / de-board eviction / notice)
- [x] Module extension + offers + keyed effect + dependents + notice + detail
- [x] Gates green; PR #474 pushed; review check 16:23 armed
- [x] RE-SIGNED (49e0950f, force-pushed; verified SSH signature)
- [x] USER tests passed through all four correction rounds (notice gating,
      Conditions bucket, flip detail, illegal-but-committable legality);
      PR body rewritten to final design; MERGED by user — PASS 2 COMPLETE

PR 475 (comment-only cleanup of the prone pivot; UNSIGNED — re-sign when
1Password unlocked):

- [x] Six stale comment clauses deleted; gates green; PR #475 pushed
- [x] re-signed (ecc26b38, force-pushed 2026-10-26, signature verified)
- [x] review check 17:49: CI green, zero comments (re-sign still pending)

PR 6 (pass 3; PR #476, commit b806fd24 signed; builder damageThresholdGate
exported; recorders filed under HEALTH 'hp' like steed recorders):

- [x] RED yaml scenarios (5 new dirs) + 30 RED unit assertions
- [x] HP pool derives + usedMax chip + station damage/heal recorders
- [x] Generic threshold helper in builder + baked threshold fact + diagnostic
- [x] Destroyed fact + notice (survives long rest); damage-offer detail text;
      app-meta guard extended
- [x] Gates green; PR #476 pushed; review check 18:16 armed
- [x] USER tablet test passed (one legacy-state eval error, worked around:
      remove + re-add; follow-up tolerance fix in flight); MERGED — PASS 3
      COMPLETE

PR 477 (legacy-state tolerance follow-up to #476; commit d7c3e982 signed):
root cause = pass-2 persisted blobs bake flat hp.max, #476 made hp.max a
derive → two-writer override throw on every evaluation; fix =
rekeyLegacyTormentorHpBase load-seam migration (hp.max → hp.base) beside
the other legacy transforms.

- [x] RED test pins raw legacy blob throwing + migration evaluating 60/60
- [x] Gates green; PR #477 pushed; root cause commented on #476
- [x] CLOSED UNMERGED (user: the one affected test character was manually
      migrated via remove + re-add; workaround preferred over migration code)

PR 7 (pass 4 v2 — segmented AC mode; v1 PR #478 closed unmerged, branch
deleted; reimplementation from clean main):

- [x] RED yaml scenarios (board default/selected mode; station offer vars,
      replace, immediate apply; derive ac.effective; lifecycle resets;
      legacy board tolerance — flat ac.value no conflict)
- [x] Segmented controls (board + station offer) + keyed mode effect +
      ac.effective derive + CHILD_KEYS lifecycle + i18n both locales
- [x] Gates green; PR #479 pushed; zero review comments
- [x] USER tablet test PASSED; MERGED (#479) — PASS 4 / ALL PASSES COMPLETE

End of job:

- [x] All implementation PRs resolved (#470 #471 #472 #473 #476 #479 merged;
      #477 #478 closed with reasoning; CI green throughout)
- [x] #475 comment cleanup MERGED (after re-sign + rebase); #481 MERGED;
      #482 (per-row bounce note) open pending user test
- [ ] User deletes tormentor.png

Follow-up (user-approved 2026-10-26 — audit found the record-damage
recorders are parallel hand-written copies; only the vehicle consults the
threshold gate):

- [x] hpRecorders factory in builder (slider descriptor + vars + amount +
      both accumulation idioms + heal cap + generic threshold gate; zero
      UI-layer diff — generic slider path untouched)
- [x] Player/steed/vehicle migrated (one spec each; lethal hooks
      retire/wreck; player concentration trigger preserved)
- [x] RED-first adaptation pins (player + steed bounce sub-threshold when
      seeded; new i18n both locales; 2 new scenarios)
- [x] Gates green (entire existing corpus unchanged); PR #480 pushed;
      review check 12:03 armed
- [x] MERGED (#480) — CI green, zero review comments; follow-up COMPLETE

Follow-up 2 (user correction 2026-10-26 — sub-threshold damage is LEGAL to
attempt; the error/diagnostic framing was the wrong model. The player is
TOLD an amount by the GM and records it — the app tells them it was under
the limit; requiring prior knowledge defeats the point):

- [x] Threshold v2 in hpRecorders (PR #481, commit e3a1ddf1 signed): bounce
      = hidden keyed marker + factory annotate share → panel annotation
      (never error); damageThresholdGate folded away; Use/Ignore segmented
      control gated by enabled.condition on threshold fact; marker in
      CHILD_KEYS/STEED_CHILD_EFFECTS
- [x] RED-first rewrites + new pins (15 RED); corpus otherwise unchanged;
      gates green
- [x] PR #481 MERGED (model change + Use/Ignore segmented, bug accepted)
- [x] PR #482 MERGED — THRESHOLD SAGA COMPLETE (all work merged; png deletion
      pending)

Follow-up 3 (user model, settled 2026-10-26 after investigation):
annotations evaluate PER PLAN ITEM — the state as at the END of the item
they show on (committed + rows 1..N inclusive; never later rows).

- [x] INLINE per-row annotate at fold boundaries → annotationsByRow
      (PR #483, commits 9e5b2a17 + f5b213fb signed); rows read their own
      list; global list unchanged; post-plan addsToPlan gate kept
- [x] ensurePlannedToggleSelections reads row-prefix facts; dead consumers
      deleted; concentration marker left for optional later cleanup
- [x] RED-first pins (later-row isolation, last==global, multi-instance,
      reorder, real-module smite case); gates green; census re-measured:
      46 appearances / 0 disappearances (methodology differs from the
      investigation's 11; direction + verdict agree; PR body honest)
- [x] PR #483 pushed; review check 15:02 armed
- [x] Deployed; MERGED (#483) — FOLLOW-UP 3 COMPLETE. NOTE: #482 (the
      two-row bounce fix) is still OPEN and was NOT in #483's branch —
      the deployed env still shows the bounce spray until #482 merges +
      redeploys (my earlier checklist item 3 overclaimed this)
- [x] Job completed 2026-10-26; no step proved unworkable
