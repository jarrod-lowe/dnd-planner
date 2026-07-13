# Walkthrough Test Plan

A scripted manual walkthrough of the whole application, for a human tester or an
AI agent driving the real UI against the real backend. Each check is written as
**Do → Expect** so it can be executed and judged without further context.

## Why these tests (and not others)

The automated layers already cover a lot, and this plan deliberately does not
re-test what they test:

- **Unit + integration tests (~1,600)** exhaustively cover the rules engine
  (plan fold, legality, effect aging, steed HP math, weapon offers) and
  components in isolation (with mocked stores). This plan does NOT re-verify
  engine arithmetic — where numbers appear below they are spot-check anchors,
  not the target.
- **Playwright e2e** currently covers only the landing page and CSS theming.

That leaves the following **walkthrough-only territory**, which this plan
prioritises:

1. Real AWS integration: Cognito auth, API Gateway + DynamoDB (character CRUD,
   quota, effects persistence, rule-group search index, batch fetch), lazy
   module chunks over CloudFront.
2. The real play-view wiring: store → engine → ledger/chips/plan rows with no
   mocks, across End Turn boundaries.
3. Multi-session journeys: reload and sign-in/out continuity, the persisted
   effects blob round-trip.
4. Visual/interaction verification of behaviour that is unit-tested but never
   rendered in automation (over-budget highlighting, chip amounts, inapplicable
   rows, warning-blocked rows).
5. i18n in situ (no raw keys anywhere, Klingon locale) and keyboard/tablet
   accessibility.
6. Error paths with a real backend (failed saves, forbidden access).

## Conventions

- Checks are numbered `W<suite>.<check>`. Record each as **PASS / FAIL /
  SKIP** (with a note). A FAIL should capture what was seen vs expected.
- Run the suites in order the first time: later suites assume the character
  built in earlier ones. Suites marked _(independent)_ can be run alone.
- "Ledger" = the pinned resource strip; "strip" = the active-effects chip row;
  "plan" = the This Turn I Want To… stack; "picker" = the +ADD chooser.
- Checks tagged **[ALL-WORK]** exercise the unassign-cleanup change that only
  exists on `claude/unassign-effect-provenance`. Mark them N/A when testing a
  build without it.

## Setup

### Environment

Option A — deployed test environment (preferred; exercises the full stack):

1. `make deploy-test` (deploys infra, lambdas, syncs rule groups, publishes the
   frontend). For data-only refreshes, `make sync-rule-groups`.
2. Open the test environment URL (CloudFront). Do not test against prod.

Option B — local dev server against the test backend:

1. Check the dev server isn't already running: `pgrep -f vite.js`.
2. `make dev` and open the printed URL.

### Account and data

- A Cognito test account you can sign in with (fresh or with spare character
  quota).
- No leftover characters you care about: this plan creates, mutates, and
  deletes characters.

### The persona built during the walkthrough

| Aspect         | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| Species        | Human (grants Heroic Inspiration, regained on long rest)          |
| Class          | Paladin, levels 1–5 assigned one group at a time                  |
| Ability scores | STR 16, DEX 10, CON 14, INT 8, WIS 12, CHA 15 (via settings)      |
| Armor          | Splint (AC 17, Dex ignored) + Shield (+2)                         |
| Weapons        | Greataxe (2-handed d12), Javelin (+ Javelin Mastery), Dagger      |
| Spells         | Bless, Divine Favour, Divine Smite, Lay on Hands pool, Find Steed |
| Feats          | Savage Attacker; Sentinel (used for the prerequisite-gate check)  |

Key derived anchors at level 5 (used as spot checks): d10 hit dice ×5, Lay on
Hands pool 25, Channel Divinity 2 uses, Extra Attack (one extra swing per
Attack action), one free Find Steed use per long rest.

---

## Suite 1 — Delivery, auth, and session (independent)

_Why manual: no automated test touches Cognito or the deployed bundle._

- **W1.1** Do: open the app URL in a fresh browser session. Expect: the landing
  page renders styled (no flash of unstyled content); no console errors.
- **W1.2** Do: sign in with the test account. Expect: redirected into the app;
  your account is identifiable (e.g. sign-out affordance present).
- **W1.3** Do: reload the browser tab. Expect: still signed in; no re-prompt.
- **W1.4** Do: sign out, then navigate directly to an in-app URL (e.g. the
  character list). Expect: bounced to sign-in; no data flashes before the
  bounce.
- **W1.5** Do: sign back in. With devtools open on the Network tab, open a
  character (once one exists — revisit after Suite 2). Expect: rule-module
  chunks load lazily (separate JS chunk requests per assigned group family),
  all 200s from the CDN.

## Suite 2 — Character lifecycle, quota, and persistence (independent)

_Why manual: character CRUD, quota refund, and the effects blob live in API
Gateway/DynamoDB; nothing automated calls the real API._

- **W2.1** Do: create a character (name with an apostrophe and a non-ASCII
  character, e.g. `Zoë O'Brien`, species Human). Expect: it appears in the
  list with the name rendered exactly (escaping intact).
- **W2.2** Do: reload the tab. Expect: the character is still listed (server
  persistence, not local state).
- **W2.3** Do: create a scratch character, then delete it. Expect: it leaves
  the list; creating another character afterwards succeeds (the quota slot was
  refunded).
- **W2.4** Do: open the kept character. Expect: a fresh sheet — the default
  starter rule groups are present; no stale effects.

## Suite 3 — Rule-group search, assignment, and prerequisites

_Why manual: search runs against the real DynamoDB prefix index; dependency
resolution and condition gating run against live group metadata._

- **W3.1** Do: search for a group with a 2-character term. Expect: no results /
  prompt for at least 3 characters (index requires ≥ 3).
- **W3.2** Do: search `fire`… then a real term, e.g. `stee`. Expect: relevant
  results (`Find Steed` for `stee`); name matches rank above keyword matches.
- **W3.3** Do: assign the ability-scores group and set the persona's scores via
  its settings. Expect: settings save; the sheet reflects the modifiers (e.g.
  STR-based values move when STR changes).
- **W3.4** Do: assign the Human species group. Expect: it pulls in anything it
  `requires` automatically (no manual dependency hunting), and Heroic
  Inspiration appears as a resource.
- **W3.5** Do: BEFORE raising ability scores above 12 on a scratch character
  (or temporarily set STR/DEX ≤ 12), try to assign the Sentinel feat. Expect:
  blocked with a clear message (prerequisite STR 13 or DEX 13).
- **W3.6** Do: with the persona's STR 16, assign Sentinel. Expect: assignment
  succeeds.
- **W3.7** Do: assign Paladin levels 1 through 5 in order, plus the divinity,
  smite/spell, and free-steed feature groups. Expect: each level adds visibly
  (HP max grows per level including the CON modifier; level 3 adds Channel
  Divinity ×2; level 5 adds Extra Attack behaviour tested later).
- **W3.8** Do: reload. Expect: all assignments and settings survive.

## Suite 4 — Build & equipment in the real UI

_Why manual: the equip flow's visuals (warning-blocked rows, hands budget,
chip-driven unequip) are only unit-tested with mocks._

- **W4.1** Do: assign splint armor + shield groups; don splint. Expect: AC
  reads 17 exactly (Dex ignored — with DEX 10 it must not read 16 or 18).
- **W4.2** Do: don the shield. Expect: AC 19; one hand consumed.
- **W4.3** Do: with the shield still equipped, don the greataxe (2 hands).
  Expect: the row is visibly illegal/blocked (not enough hands) — it must not
  silently equip.
- **W4.4** Do: remove the shield's chip from the strip; don the greataxe.
  Expect: shield chip gone, AC back to 17, greataxe equips using both hands.
- **W4.5** Do: on a character WITHOUT shield training (scratch character with
  no paladin levels), try Don Shield. Expect: the offer shows as illegal with a
  proficiency warning, and if planned anyway the planned row also shows the
  warning state (a warning that still blocks — it must not display as legal).
- **W4.6** Do: prepare a spell (e.g. Bless) up to the prepared limit, then one
  more. Expect: the over-limit prepare is blocked; unprepare frees the slot.
  If a class feature makes a spell always-prepared, its unprepare is blocked.

## Suite 5 — The core turn loop (plan → ledger → End Turn → persistence)

_Why manual: this is the real store/engine/UI wiring with no mocks, across a
turn boundary and a reload._

- **W5.1** Do: plan Attack (greataxe). Expect: the row shows a dice line — d20
  to-hit with the STR+proficiency bonus, d12 damage with the STR bonus; the
  ledger's ACT cell decrements.
- **W5.2** Do: plan a Move with the distance slider at 15 ft. Expect: movement
  remaining drops by exactly 15 (not the full speed).
- **W5.3** Do: add a second Attack action row (beyond Extra Attack budget — at
  level 5 plan three attack rows). Expect: the first two are legal (one action
  - Extra Attack), the THIRD row alone shows illegal; earlier rows stay clean
    (per-instance legality, not whole-plan poisoning).
- **W5.4** Do: with the plan overspending actions, look at the ledger. Expect:
  the "Over budget" badge shows, and ONLY the overdrawn cell (ACT) is
  highlighted red — the legitimately spent Move cell must NOT be red.
- **W5.5** Do: remove the third attack; End Turn. Expect: the plan clears;
  per-turn resources (actions, movement) reset to full; durable spends stay
  spent.
- **W5.6** Do: record 7 damage, then End Turn; then record a 15 heal after
  taking 10 total damage. Expect: strip chips read "Damage 7" (and the heal
  chip shows the EFFECTIVE amount, 10 — never a raw `{{score}}` placeholder);
  HP math matches; a second identical damage record produces its own chip.
- **W5.7** Do: reload the tab mid-adventure. Expect: committed state (HP
  records, equipment, spent slots) survives; the un-ended plan does not.
- **W5.8** Do: reorder plan rows with the move up/down controls and swap a row
  via its alternatives. Expect: order changes stick; a swap keeps the row but
  changes the action; legality re-evaluates after each change.

## Suite 6 — Masteries and followups (visual + turn boundary)

_Why manual: followup buttons, chip lifecycle, and expiry timing are
unit-tested in pieces; the tap-to-chip-to-expiry journey is not._

- **W6.1** Do: equip the javelin (assign javelin + javelin-mastery), plan an
  Attack with it. Expect: the dice line offers melee 5 ft AND thrown 30/120
  bands; a Slow followup button is visible on the row.
- **W6.2** Do: plan a Reaction (opportunity attack) with the javelin. Expect:
  melee range only — no 30/120 thrown bands on the reaction row.
- **W6.3** Do: tap the Slow followup once. Expect: a Slow chip appears
  immediately on the strip.
- **W6.4** Do: tap Slow again in the same turn. Expect: still exactly ONE Slow
  chip (replace, not duplicate).
- **W6.5** Do: End Turn. Expect: the Slow chip is gone (it lasts until the
  start of your next turn — not through it).

## Suite 7 — Spells, concentration, and resources

_Why manual: concentration chip lifecycle and save-DC labels involve the
view-facts bridge in the real UI._

- **W7.1** Do: cast Bless. Expect: an L1 slot is spent in the ledger; a
  concentration-marked chip appears; the panel's save/DC text names CHA (not a
  blank or key).
- **W7.2** Do: with Bless up, record damage. Expect: a concentration-check
  prompt/indicator appears for the turn.
- **W7.3** Do: with Bless up, cast another concentration spell. Expect: the
  Bless chip is replaced (no double concentration).
- **W7.4** Do: use Lay on Hands with the amount slider (heal 6). Expect: pool
  drops 25 → 19; the heal lands on HP; the pool persists across End Turn and
  reload.
- **W7.5** Do: spend Channel Divinity twice, attempt a third. Expect: third is
  illegal (2 uses at level 5).

## Suite 8 — Find Steed and the companion journey (multi-turn)

_Why manual: this is the longest cross-turn journey in the app — summon,
subject views, later-turn attacks, death, and recast — none of it rendered in
automation._

- **W8.1** Do: cast Find Steed; on the row pick the FREE use on the slot
  slider and Celestial as the type. Expect: the slider offers Free plus each
  owned slot level (L2+); End Turn: the steed appears as a mount chip; no
  spell slot was spent (the free use was).
- **W8.2** Do: switch the ledger/picker to the steed subject. Expect: steed
  resources (its own HP 25/25 at L2-equivalent, ACT/BON/RXN, 60 ft move)
  separate from the player's.
- **W8.3** Do: NEXT turn (after at least one End Turn), plan Otherworldly
  Slam. Expect: a rollable dice panel — d20 + CHA+proficiency to hit, 1d8 plus
  the summon level as damage (the bonus must not be +0 on later turns).
- **W8.4** Do: steed move with the slider at 10 ft, then Dash. Expect: 10 ft
  spent (not 30); Dash doubles the pool for the turn.
- **W8.5** Do: record 10 steed damage, End Turn, record 3 more. Expect: they
  accumulate (13 total off its HP; e.g. 25→12); heal 20. Expect: heal caps at
  the missing HP (back to full, no overheal banked).
- **W8.6** Do: set the steed's max-HP modifier to +10. Expect: max AND current
  both rise (35/35 — same behaviour as the player's HP model).
- **W8.7** Do: on a scratch cast, record damage equal to its full HP. Expect:
  the steed dies — mount chip and steed subject disappear; then take a long
  rest. Expect: the steed does NOT come back.
- **W8.8** Do: recast Find Steed with an L3 slot, type Fey. Expect: a fresh
  steed at higher HP with no inherited damage; the slot is spent.
- **W8.9** Do: Dismiss Steed as an action. Expect: it costs the player's
  action; steed vanishes.
- **W8.10** Do: summon again, record some steed damage, then remove the MOUNT
  chip from the strip directly. Expect: the steed's damage/heal record chips
  vanish with it (no orphaned steed-HP chips under a gone steed).

## Suite 9 — Rests and recovery (multi-turn)

_Why manual: rest recovery spans turn boundaries and idempotency is a
journey-level property._

- **W9.1** Do: spend one Channel Divinity, then record a Short Rest and End
  Turn. Expect: exactly one CD use returns (2/2), with a single recovery chip.
- **W9.2** Do: take a second short rest at full CD. Expect: no extra use is
  banked (still 2/2, no stacking recovery chips).
- **W9.3** Do: plan a Short Rest row and THEN an action row after it in the
  same plan. Expect: the post-rest action row shows illegal (a rest ends the
  turn's plan) and does not execute at End Turn.
- **W9.4** Do: with damage recorded, slots spent, and Heroic Inspiration used:
  record a Long Rest and End Turn. Expect: HP back to full (damage/heal chips
  cleared), spell slots restored, the free Find Steed use restored, and Heroic
  Inspiration regained (Human).

## Suite 10 — Unassign cleanup **[ALL-WORK]**

_Why manual: the round-trip (equip → persist → unassign → persisted cleanup →
reload) crosses the API and two evaluations; only the pieces are unit-tested._

- **W10.1** Do: don the shield, End Turn (so it is committed), then unassign
  the Shield rule group. Expect: AC drops immediately, the hand refunds, the
  shield chip disappears — no ghost +2 AC from a group you no longer have.
- **W10.2** Do: reload. Expect: the cleanup persisted (still no shield effect).
- **W10.3** Do: with a steed summoned (committed), unassign the Find Steed
  group. Expect: the mount chip and all steed record chips disappear; the
  steed subject is gone from pickers/ledger.
- **W10.4** Do: unassign the ability-scores group on a scratch character.
  Expect: its settings-derived effects disappear (modifiers revert) — the
  pre-existing namespaced cleanup still works.

## Suite 11 — i18n and accessibility sweep (independent)

_Why manual: automation asserts individual keys; only a walkthrough can sweep
whole screens for raw keys and drive the app keyboard-only._

- **W11.1** Do: switch the locale to `en-x-tlh` and walk the character sheet,
  play view, pickers, and chips. Expect: translated text everywhere; NO raw
  keys (`rule.…`, `play.…`, `{{score}}`) anywhere, including chip names with
  amounts.
- **W11.2** Do: switch back to `en` mid-session. Expect: everything re-renders
  in English without a reload.
- **W11.3** Do: drive one full turn keyboard-only (Tab/Shift-Tab/Enter/Space/
  arrows): add an offer, adjust its slider, End Turn. Expect: every control is
  reachable, focus is always visible, sliders respond to arrow keys.
- **W11.4** Do: inspect the ledger cells and one chip with a screen reader or
  the accessibility tree. Expect: cells expose full labels ("Actions: 0 of 1"
  style), the over-budget badge is announced (alert), chips have accessible
  names.
- **W11.5** Do: view the play screen at a tablet viewport (~1024×768, touch if
  available). Expect: no horizontal page scroll; touch targets (sliders, +ADD,
  End Turn) are comfortably tappable.

## Suite 12 — Error paths and resilience (independent)

_Why manual: failure UX needs a real (or really-broken) backend._

- **W12.1** Do: with devtools, set the network offline; End Turn. Expect: a
  visible error toast about saving effects; the app stays usable; going back
  online and acting again saves cleanly.
- **W12.2** Do: while offline, try to assign a rule group. Expect: a clear
  failure (and the optimistic change reverts — the group is not left
  half-assigned after reload).
- **W12.3** Do: navigate to another user's character id directly (or a
  fabricated id). Expect: a forbidden/not-found experience, not a crash or an
  empty sheet that looks real.
- **W12.4** Do: if a pre-cutover legacy character exists in the account, open
  it. Expect: it opens without crashing; legacy-shape effects are dropped
  (clean state) rather than rendering broken chips. (SKIP if none exists —
  legacy characters are expected to be deleted and recreated.)

---

## Results log

| Check | Result (PASS/FAIL/SKIP) | Notes |
| ----- | ----------------------- | ----- |
| W1.1  |                         |       |

_(Extend the table for each check executed; attach screenshots for FAILs.)_
