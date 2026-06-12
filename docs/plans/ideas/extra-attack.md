# Extra Attack (Paladin L5)

## Context

Paladin L5 grants **Extra Attack**: "You can attack twice instead of once
whenever you take the Attack action on your turn." This applies to all weapon
attacks and unarmed strikes, but **not** spells, and **not** to bonus-action
light attacks or reaction/opportunity attacks (those are not "the Attack
action").

The challenge: in this engine there is no single "Attack action" object — each
weapon swing / unarmed strike **is itself** an action-costing offer. Both cost
paths subtract `actions.remaining` and flag `attack.last.activation.action=1`:

- Hand-written unarmed strike: `data/rule-groups/dnd-5e-2024/attacks.yaml`
  (`unarmed-strike-use-action`).
- Generated weapon attacks: `data/rule-sources/weapons.yaml`, `use-action`
  profile `wrapper.activitiesBefore` (preprocessor expands per weapon).

So Extra Attack must make a **second** swing legal **without** a second action,
off the Attack action only, and it must mix weapons freely. The mechanism below
was validated empirically against the live rules engine.

### Decisions

- **Reusable core fact** — a generic `extraAttacks.max` (default 0) lives in the
  core `action-economy` rule group; Paladin L5 just increments it. Other classes
  (Fighter, Barbarian, …) can reuse it later. No per-weapon knowledge needed.
- **UI = annotation**, not a resource counter — an `annotate` reminder on attack
  choices telling the player Extra Attack lets them attack again.
- **Verification** — YAML scenario tests + `make test`, then
  `make sync-rule-groups` / `make deploy-test` and a Playwright smoke check.

## Critical Rules (carry through compaction)

- **TDD (superpower):** RED first — tests must compile, run, not panic, and fail
  for the right reason before any implementation.
- **i18n:** all user-facing text (the annotation) goes in the i18n system, both
  `en` and `en-x-tlh` locales. No hardcoded strings.
- **Never commit on `main`; never commit while tests fail; no `--amend`; no
  Co-Authored-By / AI attribution.**
- **Never run `terraform` directly** — use Make targets.
- **`make sync-rule-groups`** pushes rule changes to the test DynamoDB table;
  **`make deploy-test`** does the full deploy.

## Design — the mechanism

### New facts

- `extraAttacks.max` — extra attacks granted per Attack action. Default 0. Set in
  **early** phase via `numberIncrement` (so multiple features stack, mirroring
  the `reaction-max` pattern). Paladin L5 increments by 1.
- `attackAction.extraRemaining` — working budget of free follow-up attacks left
  in the current Attack-action chain. **Reset to 0 in early phase**
  (`numberSet 0`) — facts persist across the whole evaluation pass and this one
  is inc/decremented, so it needs an explicit per-turn reset.
- `attackAction.wasExtra`, `attackAction.actionsBefore` — transient snapshot
  facts written via `numberCopy` at the top of each cost path; no reset needed.
- `attackAction.canAttack` — computed legality fact.

### Modified cost logic (both action-attack paths, identical)

Replace the single `action-cost` activity. New `activitiesBefore` order
(activities run top-to-bottom, each `when` sees prior mutations — the snapshot
trick is required because we branch both ways on the pre-state):

1. `numberCopy attackAction.extraRemaining → attackAction.wasExtra`
2. `numberCopy actions.remaining → attackAction.actionsBefore`
3. `numberIncrement attackAction.extraRemaining` by 1, subtract, **when**
   `wasExtra > 0` — this swing is a free follow-up.
4. `numberIncrement actions.remaining` by 1, subtract (id: `action-cost`),
   **when** `wasExtra <= 0` — this swing starts a new Attack action.
5. `numberSet attackAction.extraRemaining = extraAttacks.max`, **when**
   `wasExtra <= 0` AND `actionsBefore > 0` — refill the follow-up budget.
   The `actionsBefore > 0` guard prevents a force-planned over-committed
   (illegal) attack from re-opening the budget.

Keep the existing `action-flag`, `weapon-flag`, hands, and error activities.
Update the `no_action` error-collection `setAdd` to fire on a true over-commit
(`wasExtra <= 0` AND `actionsBefore <= 0`) so the planned-item error display
stays in sync with `canAttack` legality.

### Legality (OR via a computed fact)

`legalWhen` entries are AND-ed; there is no native OR. So compute
`attackAction.canAttack` (normal phase, `group: [ea-canattack]`,
`after: [{group: __planned__}]`): set 0, then set 1 when `actions.remaining > 0`,
set 1 when `attackAction.extraRemaining > 0`. (Precedent: divine-smite's
`smite.anyResourceRemaining`.)

Both action-attack offers change `legalWhen` from `actions.remaining > 0` to
`attackAction.canAttack == 1` (keep the `…attacks.activation.no_action`
diagnostic code) and add `after: [{group: ea-canattack}]`. For weapons, add
`ea-canattack` to the `attack-activations` expansion `emit.after` list. This
only affects `use-action`; reaction/bonus-action attacks are untouched.

### Annotation (UI)

`annotate` rule, normal phase, `after: [{group: __planned__}]`,
`when: extraAttacks.max > 0`, key
`rule.dnd-5e-2024.attacks.extra-attack.annotation`, targets
`[attack.melee, attack.weapon, attack.unarmed]`. i18n in both locales.

## Files to modify

- `data/rule-groups/dnd-5e-2024/action-economy.yaml`
- `data/rule-groups/dnd-5e-2024/attacks.yaml`
- `data/rule-sources/weapons.yaml`
- `data/rule-groups/class-paladin/level5.yaml`
- `src/lib/i18n/en/common.json`, `src/lib/i18n/en-x-tlh/common.json`
- new scenarios under `tests/integration/rules-engine/yaml-scenarios/`

## Checklist

### RED — failing scenario tests first

- [x] `extra-attack-greataxe`: extraAttacks.max=1, greataxe equipped — 1st attack
      spends action + extraRemaining=1, 2nd legal/free, 3rd illegal; annotation present.
- [x] `extra-attack-unarmed`: same via unarmed cost path.
- [x] `extra-attack-disabled`: extraAttacks.max=0 — 1 attack, 2nd illegal,
      extraRemaining stays 0, annotation absent (vanilla regression).
- [x] `extra-attack-overcommit`: force-plan 3rd attack — budget does NOT re-open
      (extraRemaining 0, offer illegal), planned 3rd shows no_action error.
- [x] `extra-attack-paladin-level5`: real class-paladin-level5 grant → extraAttacks.max=1.
- [x] Run scenarios; confirm they FAIL for the right reason. (greataxe failed RED on
      missing annotation before implementation.)

### GREEN — implement

- [x] action-economy.yaml: extraRemaining reset, ea-canattack compute, annotate.
- [x] i18n annotation key (en + en-x-tlh).
- [x] attacks.yaml: unarmed use-action 5-step cost + offer legalWhen/after.
- [x] weapons.yaml: use-action wrapper 5-step cost + error update; legalWhen →
      canAttack; expansion emit.after += ea-canattack.
- [x] class-paladin/level5.yaml: increment extraAttacks.max; update descriptions.
- [x] Make RED scenarios pass. (308/308 scenarios pass.)

### Verify

- [x] `make test` green (validate, security, schema, unit, rules, e2e, lint — EXIT=0).
- [x] `make sync-rule-groups` (78 rule groups updated on test table).
      `make deploy-test` not required — no Lambda/Go/infra changes, rules-only.
- [x] Playwright smoke on `http://localhost:5173`: confirmed on L5 Paladin
      character "a" — Extra Attack annotation renders on attack choices, two
      Unarmed Strikes allowed off a single action, a third is rejected ("No
      action available"). Plan undone afterwards; nothing persisted.

## Risks

- `extraAttacks.max=0` path must stay identical to vanilla (regression test).
- Planned-item error display must stay in sync with `canAttack` legality.
- Annotation target breadth may over-show on bonus/reaction panels — verify in
  Playwright, refine if needed.
- Reaction / bonus-action light attacks must remain unaffected.

---

# Round 2 — UX fixes found during live review

Two defects the user found in the live app:

1. **Annotation over-showed** on the follow-up attack (where no extra attack
   remains). It was gated on `extraAttacks.max > 0` (always-on with the feature).
2. **Unarmed over-commit flagged the wrong attacks.** Planning 3 Unarmed Strikes
   marked all of them "No action available", not just the third. Unlike the
   generated weapon `use-action` profile, the unarmed strike had no per-item
   error tracking, so `correctEntryForPlanItem` fell back to hypothetical-offer
   legality (which fails for every attack in an over-commit). Weapons were
   already correct.

### Fixes (done)

- [x] `action-economy.yaml`: `extra-attack-annotate` `when` →
      `attackAction.extraRemaining > 0` (shown only while a follow-up is available).
- [x] i18n: annotation text simplified to "Extra Attack: you can attack again"
      (en + en-x-tlh).
- [x] `attacks.yaml`: added `error-clear` + `error-check` (no_action on true
      over-commit) to `unarmed-strike-use-action`, mirroring the weapons profile.

### Tests (done)

- [x] Updated `extra-attack-greataxe` / `extra-attack-paladin-level5` annotation
      assertions (notExists before 1st attack, exists after 1st, notExists after 2nd).
- [x] Added `extra-attack-unarmed-overcommit` (planErrors: indexes 0/1 empty,
      index 2 no_action). Confirmed RED first, then GREEN.
- [x] `make test` green; `make sync-rule-groups` (38 groups updated).

### Live verification (done)

- [x] On a freshly-reloaded L5 Paladin: annotation appears only after the first
      attack and disappears once both attacks are committed; planning a third
      Unarmed Strike flags ONLY the third "No action available" — the first two
      stay legal. (Note: a stale browser session from prior testing initially
      masked the fix; a page reload resolved it. A summoned steed was dismissed
      during testing — unrelated to the fix.)

---

# Round 3 — Code-review findings (codex bot)

Two P2 findings on the PR, both in scope ("unarmed attacks of all kinds"):

1. **Grapple/Shove didn't participate in the Extra Attack budget.** They gated on
   `actions.remaining > 0` and always spent an action, so a grapple/shove could
   not be the free follow-up and grappling first never opened the budget.
2. **Annotation over-showed on reaction/bonus attacks.** It targeted
   `[attack.melee, attack.weapon, attack.unarmed]`, which the reaction and
   bonus-action offers also carry.

### Fixes (done)
- [x] `grapple.yaml` + `shove.yaml`: replaced the single action-cost with the
      shared 5-step budget logic (snapshot → spend-extra-or-action → guarded
      refill + over-commit error), `legalWhen` → `attackAction.canAttack == 1`,
      offer `after` += `ea-canattack`, and added `annotationLabels: [attack.action]`.
- [x] Introduced an `attack.action` label on Attack-action offers only:
      `use-action` weapon profile (`weapons.yaml`, unioned via the preprocessor's
      `annotationLabels` merge), the unarmed action offer (`attacks.yaml`), and
      grapple/shove. Retargeted the annotation to `targets: [attack.action]` so it
      no longer matches reaction/bonus offers (which carry `attack.reaction` /
      neither). Verified in generated YAML: weapon `use-action` has `attack.action`,
      reaction profile has `attack.reaction` only.

### Tests (done)
- [x] `extra-attack-grapple` scenario: grapple opens the budget; a follow-up
      (unarmed or grapple) is free; both illegal once spent. Includes `offerUi`
      assertions (action offer has `attack.action`, reaction offer does not).
- [x] `extra-attack-shove` scenario: shove usable as the free follow-up.
- [x] `annotations.test.ts`: `getMatchingAnnotations` — extra-attack annotation
      (`targets: [attack.action]`) matches action attacks, not reaction/bonus.
- [x] `make test` green; `make sync-rule-groups` (80 groups updated).

### Live verification (done)
- [x] Fresh-reloaded L5 Paladin: after taking an attack, Grapple and Shove show
      as legal free follow-ups (no "No action available"), and the Extra Attack
      annotation is present.
