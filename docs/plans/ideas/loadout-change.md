# Loadout Change

Changing what is in your hands is onerous. We should add an option to the EQUIP settings.

It should present a list of possible options, from the equipment available on the character. It should honour the hands limit (including for the versatile version of a weapon). It should present anything that the character have that go in their hands. We should have a property on the appropriate rules so we can look them up.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Critical rules (carry through compactions)

- **TDD** (`/tdd`). RED tests must compile, run, not panic, fail.
- **i18n**: no hardcoded strings. Both `en` and `en-x-tlh`. tlh = canary, normal casing.
- **a11y**: semantic HTML, ARIA, contrast, keyboard.
- **CSS Law**: no new colours; theme variables only; semantic reusable styles.
- Never commit to `main`. Never commit while tests fail. Never amend.
- No `terraform` — Make targets only.
- If the plan won't work, **STOP** and ask.

## Design (settled)

**Problem.** Every EQUIP offer gates on `build.locked === 0`. Changing hands today = unlock build, dismiss equip chips from the strip, re-don, re-lock.

**Shape.** One offer that sets the _whole_ hand configuration at once, legal while the build is locked.

| Decision        | Resolution                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope           | In-play (legal with `build.locked === 1`); build-time falls out free                                                                                                                        |
| Mechanism       | Single keyed permanent effect `key: 'loadout'` — shared key means newest evicts oldest, so a swap is atomic with no removal API                                                             |
| Hands property  | `RuleModule.equip = { hands: 1 \| 2, versatile?: boolean, nameKey }` in TS (YAML is metadata-only and its schema rejects rules)                                                             |
| List source     | Assigned modules declaring `equip` — 6 weapons + shield. Body armor excluded (no hands)                                                                                                     |
| Unit of choice  | Whole legal **configurations**, not items: "Spear (2H)", "Spear + Shield", "Spear (1H)", "Empty hands"                                                                                      |
| Free hand       | Explicit — a free hand is load-bearing (somatic, Grapple, Lay on Hands)                                                                                                                     |
| Per-item dons   | **Deleted.** Loadout offer is the only write path                                                                                                                                           |
| Action cost     | **Free, always** (house rule — GM ignores swap costs). `actionCost: ['free']`, apply spends nothing                                                                                         |
| Rule group      | New foundational group `loadout`, display name **"Loadout (House Rule)"**                                                                                                                   |
| Presentation    | Flat list, current loadout pinned first, ~24 rows at today's roster                                                                                                                         |
| Entry rendering | One chip per held item using that item's own name key + fixed annotation keys for grip / "hand free". No composed strings (dodges the two-variable template trap in `module-i18n-coverage`) |
| Migration       | None. Legacy `equip:*` / `armor:shield` chips dismissed manually                                                                                                                            |
| Ladder          | Bottom-up: enumerator unit → yaml scenario → component                                                                                                                                      |
| Subagents       | Strictly sequential                                                                                                                                                                         |

**Facts written.** Keep `weapon.<id>.equipped` and `armor.shield.equipped` so attack `when` gates and AC keep working. The loadout effect sets those plus total `hands.spent`.

**Versatile grip moves to the loadout.** Today grip is a per-attack `extraHands` selection (`withVersatile`, `builder.ts:273`). It becomes a loadout fact (e.g. `weapon.<id>.twoHanded`). Consequences: `withVersatile`'s selection capture goes; the dice-line `ranges` bands filter to the equipped grip; `spear.ts:13`'s "not yet modelled" comment is stale and gets corrected.

**Known cost.** 23 yaml scenarios reference `don-dagger|greataxe|spear|javelin|scimitar|shield`, plus the `weapons — equip (don)` block in `tests/unit/rules-engine/weapons.test.ts`. All get rewritten onto the loadout offer. Accepted deliberately: they are the regression net.

**Scale risk.** 7 hand items → ~24 rows. 10 items → ~50. If the roster grows, revisit as a grouped/expandable control.

## Workstreams

Main agent co-ordinates only: dispatches each subagent, reviews its diff, runs `make test`, reports to the human. Strictly sequential — 2 and 3 both depend on the offer id, fact names and selection shape that 1 settles.

1. **Engine** — `RuleModule.equip`, enumerator, `loadout` group + offer, versatile-grip fact, unit + yaml tests, engine-side i18n keys.
2. **Test migration** — 23 yaml scenarios + `weapons.test.ts`.
3. **UI** — chip control, PanelRenderer wiring, a11y, component tests, UI i18n keys.

## Checklist

### 1 — Engine (subagent)

- [x] RED: unit test for the enumerator — assigned modules with `equip` → legal configurations. Assert: greataxe alone (2H), no greataxe+shield, spear 1H and spear 2H both present, empty hands present, two daggers legal.
- [x] GREEN: add `equip?: { hands, versatile?, nameKey }` to `RuleModule` / `defineRule`; declare on 6 weapons + shield (mirror `WeaponDef.hands`).
- [x] GREEN: enumerator — pure function, registry-driven, returns ordered configurations.
- [x] RED: yaml scenario `loadout-set` — set a loadout, assert `hands.remaining`, `weapon.*.equipped`, effect `key: 'loadout'`, `expiry: permanent`.
- [x] RED: yaml scenario `loadout-swap` — set A, then B; assert A's facts are gone (key eviction), hands correct.
- [x] RED: yaml scenario `loadout-while-locked` — legal with `build.locked: 1`.
- [x] GREEN: `loadout` rule module + `data/rule-groups/dnd-5e-2024/loadout.yaml` (foundational, `requires: [hands]`, name "Loadout (House Rule)").
- [x] GREEN: offer `set-loadout`, `section: 'equip'`, `intents: { EQUIP: … }`, `actionCost: ['free']`, no build-lock gate.
- [x] RED: yaml scenario for versatile grip — spear 2H sets the grip fact, 1H+shield does not.
- [x] GREEN: move grip from `withVersatile` selection to the loadout fact; filter dice-line `ranges` to the equipped grip; fix stale `spear.ts:13` comment.
- [x] i18n: offer name, group name, annotation keys (grip, hand free, hands remaining) — `en` + `en-x-tlh`.
- [x] Delete `don-*` weapon offers from `weaponOffers`; delete `don-shield` from `shield.ts`; remove their i18n keys and diagnostics (`no-hands`, `already-equipped`).
- [x] `make test-unit` green.

### 2 — Test migration (subagent)

- [x] Rewrite the 23 `don-*` weapon/shield yaml scenarios onto `set-loadout`.
- [x] Rewrite `describe('weapons — equip (don)')` in `weapons.test.ts`.
- [x] Confirm the 11 body-armor `don-` scenarios still pass untouched.
- [x] `make test` green.

### 3 — UI (subagent)

- [x] RED: component test — picker renders one row per configuration, chips per item, current loadout first.
- [x] RED: component test — a11y: `role="radiogroup"`, each row `role="radio"` with a **text** accessible name, roving tabindex, arrow-key traversal, hands-remaining announced.
- [x] GREEN: new chip-list control kind (`PanelSelect` is a flat radiogroup with no arrow keys and renders ValueSource options via `String(v)`, untranslated — not reusable here).
- [x] GREEN: wire into `PanelRenderer` + `types.ts`.
- [x] CSS: theme variables only, semantic classes, reuse chip styling from `EffectChip` / `ModChip`.
- [x] i18n for any UI-side strings, `en` + `en-x-tlh`.
- [x] `make test` green, `make lint`, `make format`.

### 4 — Verify (main agent)

- [x] `make test` — all green.
- [x] `make sync-rule-groups` then `make deploy-test` (sync alone does not invalidate the CDN).
- [x] Playwright against `http://localhost:5173` (check `pgrep -f vite.js` first): open EQUIP, set a loadout mid-combat, confirm chips, hands readout, and that attack rows follow the grip.
- [x] Report to human. Do not commit without approval; branch first.

## Execution notes

Deviations from the plan as written, and what was decided mid-flight.

**Dice-line grip filter is data, not a UI filter.** Offer `vars` are static (built
with no facts), so a fact-driven band filter was impossible engine-side. A
versatile weapon now carries one melee band with no die of its own, and
`vars.damageDie` sources `{ fact: 'attack.<id>.damageDie' }`, derived from
`weapon.<id>.twoHanded`. Thrown bands pin `damageDie: 6` so a 2H grip cannot
inflate a throw. Net effect matches intent with **zero** UI changes. The cosmetic
`1H`/`2H` range labels are gone (untranslated literals); grip shows on the chip.

**`EquipDef` carries two fields beyond the settled three.** `state` /
`twoHandedState` (the facts an item sets while held) and `stackable`. `state` is
necessary: `apply` has no registry access, so an item must carry its own fact
names — that is what keeps `loadout` decoupled from every weapon. `stackable` is
what makes "Dagger + Dagger" legal while "Shield + Shield" is not.

**Shield not-proficient warning restored** (approved). It died with `don-shield`;
re-added to `set-loadout` as `…loadout.set-loadout-offer.not-proficient`.
Non-blocking, and `don-shield` was the only warning-severity offer in the repo,
so `planned-legality.test.ts` needed it to exist.

**Red set was wider than estimated:** 24 scenarios + 16 unit tests across 4 files,
not 23 + 1 file. The extras used `don-*` purely as setup.

**"Current loadout pinned first" was unimplementable as specified.**
`PanelRenderer` gets _post_-plan facts, so once the row is in the plan with no
selection the facts already read as empty hands — meaning an untouched row would
commit an effect that silently disarmed the character. Fixed with
`currentLoadout(modules, facts)` matching settled facts against each
configuration's `loadoutEffectState`, captured at _add_ time in
`resolveInitialSelections`. The matcher compares against the union of all facts
any configuration can write, or spear-1H / spear-in-each-hand / spear-2H collide.

**`build-lock-weapon-clear` rewritten, not deleted** → `build-lock-clears-stale-error`.
The `setAdd`-without-`setClear` bug it caught is structurally impossible now
(`donApply` is gone), but the contract — an already-planned equip row goes legal
again when the lock is removed — is user-visible and asserted nowhere else. Rebuilt
on `don-leather-armor`, and came off `SKIP_BY_NAME` in the process.

**Two scenarios deleted** (approved): `spear-2h-effects-ordering`,
`spear-2h-reaction-no-free-hands`. They assert `versatile.no-free-hand`, now
unreachable — a 2H grip consumes the second hand at equip time.

## Known follow-ups

- **Legacy chip double-count is rougher than "Migration: none" implied.** The row
  auto-pins to what you hold, so a character with legacy `equip:*` chips counts
  those hands twice the moment the row is added — observed as **HAND -2/2** on
  TestCharacter, with the player having done nothing. Dismissing the stale chips
  fixes it, but the failure mode is a confusing negative rather than a prompt.
  Options: a one-time fold of legacy keys into a `loadout` effect on load, or at
  minimum clamp the hands readout at zero with a warning.
- **Scale.** 7 hand items → ~24 rows; 10 → ~50. Revisit as a grouped/expandable
  control if the roster grows.
- **Scenario redundancy.** `hands-greataxe-plus-shield-over-budget` and
  `hands-two-daggers-then-shield-illegal` now assert the same `no-hands` guard;
  `hands-shield-then-greataxe-replaces` overlaps `loadout-swap`.
- **Dynamic cost tags** (Q8 option iii) were not needed once the swap became free,
  but `resolveCostTags` still cannot derive a tag from a selection.
