# Condition: Invisible

Wave 6 (conditions-remaining.md) — lands **rules-driven advantage**: the roller today only understands rules-driven DISadvantage. Prone is the prior art (condition-prone.md).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Invisible [Condition]** — While you have the Invisible condition, you experience the following effects.
> **Surprise.** If you're Invisible when you roll Initiative, you have Advantage on the roll.
> **Concealed.** You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed.
> **Attacks Affected.** Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature.
>
> **Hide [Action]** (stop conditions — HIDE's, not the condition's; source-specific, see Knot 3) — You stop being hidden immediately after any of the following occurs: you make a sound louder than a whisper, an enemy finds you, you make an attack roll, or you cast a spell with a Verbal component.
>
> **Disadvantage** — If you have Disadvantage on a D20 Test, roll two d20s and use the lower roll. A roll can't be affected by more than one Disadvantage, and Advantage and Disadvantage on the same roll cancel each other.

Modelled: recorder + keyed effect writing `attack.{str,dex}.advantage` + `initiative.advantage`; roller gains the advantage leg (Knot 1). Concealed (+equipment), vs-you Disadvantage, see-me exception → notice text. Deviation (umbrella default): `untilShortRest` where SRD lasts per source.

Code today (verified): PanelDiceLine.svelte:202-208 resolves `control.advantage` (ValueSource) as a BOOLEAN — `defaultRollMode = rulesDisadvantage || currentRange?.disadvantage ? 'disadvantage' : 'normal'`; advantage exists only as the per-die manual menu (`selectRollMode`, l.648). types.ts:149 `advantage?: ValueSource`. builder.ts:337 `advantage: { fact: def.disadvantageFact }` (diceControl), :477 `ui.disadvantageFact` (authored metadata — no runtime consumer found; pinned only by unarmed-strike-ui.test.ts). initiative.ts:26 same pattern on `initiative.disadvantage` (leather-armor writes it). ▼ indicator (l.811/894) renders for ANY non-normal default, aria-label hardcoded "disadvantage".

## Decisions (defaults — re-grill before execution)

- Knot 1 roller: **add `advantageUp?: ValueSource` to DiceLineControl** — truthy → default mode 'advantage'. `advantage` stays boolean-disadvantage; back-compat, zero existing users change. REJECTED: signed semantics on `advantage` (negative = disadvantage) — breaks every boolean reader (weapons, unarmed, initiative, skill-checks) for no gain.
- Cancellation (Disadvantage glossary above): `advantageUp` AND (`advantage` truthy OR dis range band) both present → **'normal'** (explicit cancel). Real case: Prone (dis on your attacks) + Invisible (adv) co-occur. Range-band disadvantage (long-range throws, spear's 60ft band) joins the cancel — SRD cancellation is source-agnostic. Rejected: adv-wins, dis-wins (both un-SRD).
- Indicator: split ▲/▼ by default mode, full + summary render; ▲ reuses `play.choices.attack.advantage` key.
- Knot 2 facts: `attack.str.advantage` + `attack.dex.advantage`. WeaponDef gains `advantageFact: string` — REQUIRED (parity with `disadvantageFact`; the compiler forces every weapon). `diceControl` adds `advantageUp: { fact: def.advantageFact }`; `weaponOffers` mirrors `ui.advantageFact` beside `ui.disadvantageFact` (extend the unarmed-strike-ui pin).
- Weapon modules to touch (verified by listing rules/): dagger, greataxe, javelin, scimitar (dex), spear, spear-plus1 — plus attacks.ts `UNARMED_CONTROL` (+ its 2 `ui.disadvantageFact` sites). Mastery variants NOT touched: flag-only groups (derive `attack.<id>.mastery`; no WeaponDef, no offers).
- Effect writes carry `stateCombine: 'max'` on the advantage facts (prone/armor idiom; no other contributor today — uniform, future-proof).
- Initiative: NEW fact `initiative.advantage` (mirror of leather-armor's `initiative.disadvantage`); effect writes it; initiative.ts primaryControl gains `advantageUp`. "Surprise" is the SRD's name for this bullet.
- Notice-only: Concealed (+ equipment), attacks-vs-you Disadvantage, see-me exception → notice body text.
- Knot 3 ending: **umbrella default** — `expiry: untilShortRest` + manual ActiveStateStrip dismissal; the notice carries ONLY the condition's effects + "ends on any rest". Hide's stop conditions (sound/found/attack/V-spell) are NOT in the notice: they are HIDE's, not the Invisible condition's, and the recorder is source-blind — spell-sourced invisibility (Greater Invisibility attacks freely) would be misled by them. REJECTED end-offer: the stops are event-based and SOURCE-dependent — a keyed end-offer cannot see the source. Source-aware endings (a "from hiding?" toggle) = future idea, out of scope.
- Recorder ungated (every source funnels here; the Hide action itself is out of scope).

## Design

Module `src/lib/rules-engine/rules/condition-invisible.ts`, id `condition-invisible`; register `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-invisible.yaml`: translations, no `requires` (no dependency), detail (SRD body, en-only) → `make publish-details`. Terraform seed `char_condition_invisible_rulegroup_seed` (dynamodb-items.tf) + `make validate`. No search meta (prone precedent).

Facts:

- `condition.invisible` — 1 while invisible; written ONLY by the committed effect
- `attack.str.advantage` / `attack.dex.advantage` — same effect; weapon/unarmed dice-lines read them (Knot 2 wiring)
- `initiative.advantage` — same effect; initiative dice-line reads it (PR3)

Effect: `{ id: 'effect-invisible', key: 'invisible', state: { 'condition.invisible': 1, 'attack.str.advantage': 1, 'attack.dex.advantage': 1, 'initiative.advantage': 1 }, stateCombine: 'max' ×3, display: { name, detailKey: 'condition/invisible' }, expiry: { kind: 'untilShortRest' } }`

Offer: `record-invisible` — section `free`, `detailKey: 'condition/invisible'` (the published SRD detail), `intents: { CONDITION: 'invisible' }`, no control, no gate, name only (record-\* precedent: no `.description` key).

Notice (annotate while `condition.invisible > 0`): `targets: ['notice']`, key `.notice` (+ `.body`), `source` effect name. en body: "Advantage on your attack rolls and on Initiative. Attack rolls against you have Disadvantage (not against a creature that can somehow see you). You and your equipment are concealed from effects that require their target to be seen. Ends on any rest." — NO Hide stop-conditions text (source-blind recorder; spell-sourced invisibility ignores them — Knot 3).

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented values, normal casing — execution-time, not listed here):

- `play.verbBuckets.CONDITION.invisible`
- `rule.dnd-5e-2024.condition-invisible.record-invisible.name`, `.effect-invisible.name`, `.notice`, `.notice.body`

Detail body en-only (tlh falls back). `rule.*` keys in common.json, never the yaml.

Tests (RED first — yaml scenario asserts are the RED for rule changes):

- PR1 (UI-only): component tests in tests/unit/svelte/PanelDiceLine.test.ts (+ panel-renderer suite) — advantageUp truthy → default 'advantage'; + dis fact → 'normal'; + dis band → 'normal'; ▲ indicator + aria
- Scenarios (+ `EXPECTED_RUNNABLE`): `condition-invisible-record` (4 facts + notice exists/targets), `condition-invisible-rest-clears` (short AND long → cleared, notice gone), `invisible-plus-prone-cancels` (both conditions live: `attack.str.advantage: 1` AND `attack.str.disadvantage: 1` coexist — yaml CAN pin the coexisting facts and the `offerUi` wiring; it CANNOT assert the render decision — default roll mode is a PanelDiceLine derivation over the control, not engine output → the PR1 component test is the cancel pin; no condition-prone-notice.test.ts analog needed at the engine layer)

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing each module
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make validate-rules-schema` (new rule-group YAML), `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push; full `make test` before declaring done
- Per rule-group change: `make publish-details`; `make sync-rule-groups` then `make deploy-test` (sync alone insufficient — CDN); terraform seed per new group (`dynamodb-items.tf`), `make validate`
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); every comment gets fixed or a reasoned won't-fix reply; until reviews + pipelines clean; agent never merges
- i18n: BOTH locales (`en` + `en-x-tlh` invented values, normal casing); `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back); `play.verbBuckets.CONDITION.<name>` per condition
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## PRs

### PR1 — roller: `advantageUp` + cancellation (UI-only)

- [ ] RED: PanelDiceLine component tests fail — advantage default; dis-fact cancel → normal; dis-band cancel → normal; ▲ indicator
- [ ] types.ts `advantageUp?: ValueSource` (documented beside the historical `advantage` = disadvantage-source); defaultRollMode 3-way; ▲/▼ indicator split (full + summary)
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge

### PR2 — weapon wiring + condition-invisible module (prone PR1 boilerplate)

- [ ] RED: `condition-invisible-record` + `condition-invisible-rest-clears` fail (unknown group → skipped vs `EXPECTED_RUNNABLE`)
- [ ] `WeaponDef.advantageFact` (required) + diceControl `advantageUp` + `weaponOffers` ui mirror; 6 weapon modules + attacks.ts unarmed (advantageFact + ui); greataxe's Cleave SECONDARY control (greataxe.ts `actionUiExtra.secondaryControl`) gains BOTH sources (`advantageUp` + the existing disadvantage fact — it has neither today; test a mastery-enabled Cleave roll)
- [ ] `condition-invisible.ts`: record offer, keyed effect, notice; `registry.ts` + `lazy.ts`; yaml + detail + `make publish-details` (output gitignored — published, not committed); i18n both locales; terraform seed + `make validate`
- [ ] GREEN: record + rest-clears + `invisible-plus-prone-cancels` facts leg
- [ ] gates → PR → codex monitor → merge

### PR3 — initiative advantage (Surprise)

- [ ] RED: new scenario asserting `offerUi` on `roll-initiative` (`primaryControl.advantageUp` = `{ fact: 'initiative.advantage' }`) fails
- [ ] initiative.ts primaryControl `advantageUp` (+ ui mirror); record scenario already writes `initiative.advantage` (PR2 effect — fact lands ahead of its reader, harmless)
- [ ] Alert's `secondaryControl` (the proficiency-based d20, feat-alert) gets BOTH sources: `advantageUp: { fact: 'initiative.advantage' }` AND `advantage: { fact: 'initiative.disadvantage' }` (it bypasses condition-driven Disadvantage today too — fix both legs while here); test the Alert + Invisible combination
- [ ] GREEN
- [ ] gates → PR → codex monitor → merge

## Out of scope

- Hide action (Invisible's usual source) — global out-of-scope, umbrella
- spell-sourced variants + source-specific ending (Greater Invisibility attacks freely)
- NPC-side: attacks-vs-you enforcement, see-me identity scoping — notice text only
- save-roller advantage wiring (Restrained neighbour — own knot)
- spell-attack offers (none exist yet; future ones must wire `advantageUp` too)

## Notes

- `advantage` field name is historical (it names the DISadvantage source); rename rejected — breaks all users. `advantageUp` documented beside it.
- yaml grammar CAN assert `offerUi` — wiring pins belong in scenarios; render decisions never do.
- `ui.disadvantageFact`/`ui.advantageFact` are metadata (no runtime consumer found); kept for panel-documentation parity, pinned by unit test.
