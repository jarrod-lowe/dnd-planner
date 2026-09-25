# Conditions — the remaining 14

SRD 5.2 defines 15 conditions (Rules Glossary, "Condition"); Prone is done (PRs #435, #436, #437, #444) and built the chassis: record offer → keyed committed effect (`condition.<name>` fact, `expiry`) → notice. This doc is the umbrella **tracker**: each condition below links its own doc in this folder (written off this tracker; `condition-prone.md` for prior art). Per item: re-grill the doc's Decision defaults (/grill-me), then execute its PR checklist to merge.

Glossary ground rules (SRD 5.2 "Condition"): a condition doesn't stack with itself — you have it or you don't; Exhaustion is the exception (levels).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Checklist

Each item links the condition's doc — re-grill its Decision defaults (/grill-me), then execute its PRs. Tick the umbrella item when its last PR lands. Waves 1–2 are reorderable; hard deps: Incapacitated and Grappled land before wave 5 (composition children need `condition.incapacitated` + the Speed-0 idiom).

Rough total: ~10–12 PRs. Calibration: prone = 4 PRs incl. inventing the chassis; siblings ≈ 1 PR each, bookkeeping pairs share PRs.

### Wave 1 — pure bookkeeping

- [x] [Charmed](condition-charmed.md) — executed, batched with Deafened on branch `condition-charmed-deafened` (modules + EffectDisplay.detailKey bridge + seeds + scenarios); merged as PR #446
- [x] [Deafened](condition-deafened.md) — same PR as Charmed (#446)
- [x] [Blinded](condition-blinded.md) — executed on branch `condition-blinded` (module + Cleave disadvantage wiring + stateCombine regression scenario + seed); PR pending at commit time

### Wave 2 — disadvantage flags

- [x] [Poisoned](condition-poisoned.md) — executed on branch `condition-poisoned` (module + record-check/Alert roller wiring + skill-flag stateCombine regression + blinded stacking pin + seed); PR pending at commit time
- [ ] [Frightened](condition-frightened.md) — execute — **deferred**: its line-of-sight qualifier handling needs exploring first (standing disadvantage vs per-source; see its Decision defaults)

### Wave 3 — the enabler

- [x] [Incapacitated](condition-incapacitated.md) — executed (action economy denial + concentration break; unlocks wave 5): PR1 merged as #449; PR2 (the shared `concentrationBreakEffects` builder helper + conditional eviction/marker clear on record) on branch `condition-incapacitated-2`, PR pending at commit time

### Wave 4 — Speed-0 + save wiring

- [x] [Grappled](condition-grappled.md) — executed (lands the Speed-0 idiom): PR1 (halted derives + all 6 move gates + module) merged as #451; PR2 (attack flags + dash/get-up/drop-prone halted gates) merged as #453
- [x] [Restrained](condition-restrained.md) — executed (lands save-recorder advantage wiring; PR1+PR2 folded into ONE PR by decision): halted free-ride off grappled's foundation + the 6 saveOffer disadvantage sources — wave 4 complete

### Wave 5 — composition batch (likely one PR after their docs)

- [x] [Paralyzed](condition-paralyzed.md) — executed with the trio in ONE PR (branch `condition-composition-trio`): keyed effect writes both condition facts, shared break helper, halted free-ride, inheritance + overlap pins
- [x] [Stunned](condition-stunned.md) — same PR; the trio divergence pinned (no Speed 0 — walk stays legal)
- [x] [Petrified](condition-petrified.md) — same PR; poison-immunity notice text only (future mechanisation noted in Out of scope below)

### Wave 6

- [x] [Invisible](condition-invisible.md) — executed (PR1 #456 the roller, then PR2+PR3 folded into ONE branch `condition-invisible-2`: WeaponDef.advantageFact + advantageUp on every dice-line incl. Cleave/Alert secondaries, recorder + keyed effect writing the attack/initiative advantage flags)

### Wave 7

- [x] [Unconscious](condition-unconscious.md) — executed (PR1+PR2 folded into ONE PR by decision, branch `condition-unconscious`): keyed effect writes all three facts (unconscious + incapacitated max + prone default-sum), shared break helper, halted free-ride, Regain Consciousness end-offer with NO `when` gate (the #453 illegal-but-visible deviation) committing an empty-keyed eviction + a FRESH shared `proneEffect()` from the builder so Prone survives the end per SRD

### Wave 8

- [ ] [Exhaustion](condition-exhaustion.md) — execute (counter machinery; settle 6-vs-10 first — see Decision defaults)

## Conditions (verbatim SRD + scope + effort)

Per-condition docs lift their detail bodies from these quotes (`docs/srd52.txt`, Rules Glossary). "Notice text only" = the prone precedent: NPC-side / out-of-engine effects stay notice text, never facts.

Standing rule (all 14): every condition EFFECT carries `display: { name, detailKey: 'condition/<name>' }` — the offer's `ui.detailKey` only covers the plan row; the committed ActiveStateStrip chip needs the `EffectDisplay.detailKey` bridge extension. **The bridge lands with the FIRST condition slice (wave 1 — Charmed's doc carries the PR item)**, so no wave executes before it exists; condition-incapacitated.md spells out the mechanics (type + engineBridge copy + chip component test).

### Charmed — XS (⅓ PR; batch with Deafened)

> **Charmed [Condition]** — While you have the Charmed condition, you experience the following effects.
> **Can't Harm the Charmer.** You can't attack the charmer or target the charmer with damaging abilities or magical effects.
> **Social Advantage.** The charmer has Advantage on any ability check to interact with you socially.

Modelled: record offer + keyed effect (`condition.charmed`) + notice. Both effects NPC-side → notice text only.

### Deafened — XS

> **Deafened [Condition]** — While you have the Deafened condition, you experience the following effect.
> **Can't Hear.** You can't hear and automatically fail any ability check that requires hearing.

Modelled: record + effect (`condition.deafened`) + notice. Auto-fail hearing checks = notice text (skill offers are display-only).

### Blinded — S

> **Blinded [Condition]** — While you have the Blinded condition, you experience the following effects.
> **Can't See.** You can't see and automatically fail any ability check that requires sight.
> **Attacks Affected.** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.

Modelled: prone-minus-movement — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage` (`stateCombine: 'max'`, the prone idiom; weapon/unarmed dice-lines already read them). Sight auto-fail + attacks-vs-you = notice text.

### Poisoned — S

> **Poisoned [Condition]** — While you have the Poisoned condition, you experience the following effect.
> **Ability Checks and Attacks Affected.** You have Disadvantage on attack rolls and ability checks.

Modelled: attack flags + all 18 `skill.{skill}.disadvantage` facts (facts exist — leather-armor writes 4; loop like ability-scores) + `initiative.disadvantage` (Initiative is a Dexterity ability check; the fact + roller read exist). Most common condition in play — high value.

### Frightened — S

> **Frightened [Condition]** — While you have the Frightened condition, you experience the following effects.
> **Ability Checks and Attacks Affected.** You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.
> **Can't Approach.** You can't willingly move closer to the source of fear.

Modelled: same flags as Poisoned (incl. `initiative.disadvantage` — ability checks cover Initiative). Line-of-sight qualifier + can't-approach = notice text (player judgement; prone simplification precedent — see Decision defaults).

### Incapacitated — M–L (the enabler)

> **Incapacitated [Condition]** — While you have the Incapacitated condition, you experience the following effects.
> **Inactive.** You can't take any action, Bonus Action, or Reaction.
> **No Concentration.** Your Concentration is broken.
> **Speechless.** You can't speak.
> **Surprised.** If you're Incapacitated when you roll Initiative, you have Disadvantage on the roll.

Modelled:

- action economy denial: `actions/bonusActions/reactions.remaining` are central derives (`max − spent`, action-economy.ts); effect-side spends zero them — dash-style offers already gate on `actions.remaining`. Design knot: spend size vs varying maxes (surge-type), or clamp in derive.
- concentration broken on record: the empty-`key` eviction idiom (concentration-broken precedent).
- `initiative.disadvantage` — fact exists (leather-armor writes it); initiative dice-line reads it.
- Speechless (Verbal components) = notice text.
- Sets `condition.incapacitated`; Paralyzed/Petrified/Stunned/Unconscious compose it (their effects write the fact too — the composition pattern to grill here). Composition has TWO clauses: the fact (max-combined, `> 0` reads) AND the concentration break — each child's recorder invokes the same break logic (writing the fact alone does not evict a held spell). Each child's yaml `requires` lists the parent group (self-heal-load of the Surprised derive + break helper); Unconscious also requires `condition-prone`.

### Grappled — M (lands the Speed-0 idiom)

> **Grappled [Condition]** — While you have the Grappled condition, you experience the following effects.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** You have Disadvantage on attack rolls against any target other than the grappler.
> **Movable.** The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller than it.

Modelled:

- Speed 0 + "can't increase": the `character.movement.halted` fact (movement.ts derives it from the 5 Speed-0 conditions); `movement.remaining` derives 0; all move offers + **Dash** gated not-halted. Base `speed`/`total` stay live for `half_speed` math, but the top-bar SPD chip (derivePanels reads `movement.total`) must show 0 while halted — derive a halted-aware effective total for display. Solve ONCE; reused by Restrained/Paralyzed/Petrified/Unconscious.
- attack Disadvantage vs non-grappler: flag without the scoping (NPC identity) — notice text carries the exception.
- Movable/drag = notice text. Escape check offer = out of scope initially. `grapple.ts` (grappling others) already exists — this is being grappled; keep fact namespaces distinct.

### Restrained — S–M (lands save wiring)

> **Restrained [Condition]** — While you have the Restrained condition, you experience the following effects.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage, and your attack rolls have Disadvantage.
> **Saving Throws Affected.** You have Disadvantage on Dexterity saving throws.

Modelled: Speed-0 idiom + attack flags + DEX-save Disadvantage — the 6 save recorders (core-events `saveOffer`) have **no advantage wiring** (`dice: [{ sides: 20, bonus: { var: 'saveBonus' } }]`, no `advantage` field). Small roller extension: `save.{ability}.disadvantage` facts + dice-line `advantage` sources. Reused by wave 5 auto-fails (if mechanical) — see Decision defaults.

### Paralyzed — S after Incapacitated + Grappled

> **Paralyzed [Condition]** — While you have the Paralyzed condition, you experience the following effects.
> **Incapacitated.** You have the Incapacitated condition.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Automatic Critical Hits.** Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.

Modelled: composition — effect writes `condition.paralyzed` + `condition.incapacitated` + Speed-0. Auto-fail STR/DEX saves: notice text, or save flags if Restrained's wiring landed (auto-fail ≠ disadvantage — needs its own semantic; grill). Vs-you Advantage + auto-crit = notice text. `hold-person.ts` exists (our spell on others) — no overlap.

### Petrified — S after Incapacitated + Grappled

> **Petrified [Condition]** — While you have the Petrified condition, you experience the following effects.
> **Turned to Inanimate Substance.** You are transformed, along with any nonmagical objects you are wearing and carrying, into a solid inanimate substance (usually stone). Your weight increases by a factor of ten, and you cease aging.
> **Incapacitated.** You have the Incapacitated condition.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Resist Damage.** You have Resistance to all damage.
> **Poison Immunity.** You have Immunity to the Poisoned condition.

Modelled: Paralyzed's composition + resist-all / poison-immunity as notice text (damage recorder is free-entry; no resistance modelling exists — player halves themselves).

### Stunned — S after Incapacitated

> **Stunned [Condition]** — While you have the Stunned condition, you experience the following effects.
> **Incapacitated.** You have the Incapacitated condition.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Attacks Affected.** Attack rolls against you have Advantage.

Modelled: smallest composition child.

### Invisible — S–M (lands rules-driven advantage)

> **Invisible [Condition]** — While you have the Invisible condition, you experience the following effects.
> **Surprise.** If you're Invisible when you roll Initiative, you have Advantage on the roll.
> **Concealed.** You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed.
> **Attacks Affected.** Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature.

Modelled:

- **Rules-driven advantage doesn't exist**: dice-line `advantage: ValueSource` is boolean-disadvantage-only (PanelDiceLine resolves truthy → `'disadvantage' | 'normal'`; advantage is a per-die manual menu). Extend to advantage sources; wire `attack.{str,dex}.advantage` + `initiative.advantage`. One shared-roller change.
- Concealed + vs-you Disadvantage + see-me exception = notice text.
- Ending (attack made / V-spell cast — the Hide rule's stop conditions): expiry design — manual end / event-based; grill.

### Unconscious — M

> **Unconscious [Condition]** — While you have the Unconscious condition, you experience the following effects.
> **Inert.** You have the Incapacitated and Prone conditions, and you drop whatever you're holding. When this condition ends, you remain Prone.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** Attack rolls against you have Advantage.
> **Saving Throws Affected.** You automatically fail Strength and Dexterity saving throws.
> **Automatic Critical Hits.** Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.
> **Unaware.** You're unaware of your surroundings.

Modelled: composition (incapacitated + prone + Speed-0) plus two knots:

- **drop what you're holding**: hands/loadout mutation (hands spent→free, weapons unequipped) — the meaty bit; grill scope (maybe notice + manual unequip).
- **"you remain Prone" on end**: the unconscious effect's state (incl. `condition.prone`) dies with its eviction — the end must advertise a FRESH prone effect (reuse `condition-prone`'s `proneEffect()` / keyed idiom).
- 0 HP / death-save flow = out of scope (separate idea).

### Exhaustion — M–L (own epic)

> **Exhaustion [Condition]** — While you have the Exhaustion condition, you experience the following effects.
> **Exhaustion Levels.** This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6.
> **D20 Tests Affected.** When you make a D20 Test, the roll is reduced by 2 times your Exhaustion level.
> **Speed Reduced.** Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level.
> **Removing Exhaustion Levels.** Finishing a Long Rest removes 1 of your Exhaustion levels. When your Exhaustion level reaches 0, the condition ends.

Nothing like it exists — a counter, not a boolean:

- levels: record offer increments (apply reads folded `condition.exhaustion`, advertises keyed effect with level+1 — newest-wins replaces); needs a max-6 legality gate (die).
- −2 × level on D20 Tests (to-hit, checks, saves): flat rider on the annotation-rider channel (`{ kind: 'flat', bonus }` — Bless +1d4 and Aura of Protection prove it reaches those dice). Initiative is a Dex check — grill in/out.
- Speed −5 × level: contribution to `character.movement.speed`/`total` (both `combine: 'sum'`; splint-armor −10 precedent).
- Long Rest removes 1 level: **new rest-expiry semantic** (decrement, not clear — `untilShortRest`/rest expiry clears whole effects today).
- Die at 6: attention/notice (we don't model death).
- **Divergence**: SRD 5.2 says 6 levels, no HP-max clause; PHB 2024 says 10 levels + HP max −10 × level. Project rule = srd52.txt canonical → 6. Settle before the doc (Decision defaults).

## Decision defaults (re-grill per condition doc)

- Exhaustion cap: **SRD 6** (srd52.txt is canonical; note the PHB-2024 divergence in the doc).
- Auto-fail saves: **notice text first**; mechanical flags only where save-mode wiring already landed (Restrained) — auto-fail ≠ disadvantage, own semantic.
- Condition ending: prone deviation — effect `expiry: untilShortRest` (long rest includes short) + manual ActiveStateStrip chip dismissal. Per-condition end offers only where SRD gives a mechanical end (grapple escape → out of scope initially).
- Frightened line-of-sight: **standing disadvantage** + notice carries the qualifier (prone simplification precedent).

## Execution rules

- Subagents perform tasks; main agent coordinates + talks to human only
- Read `docs/RULE_GROUP_GUIDE.md` §1 checklist + §7 pitfalls before writing each module
- TDD inside each PR: RED (compiles, runs, no panic, fails) → GREEN → refactor; yaml scenario asserts are the RED for rule changes
- Never commit to main; PR per slice; no attribution/co-author; never amend; signing: unsigned if 1Password locked, re-sign later (`rebase -f -S`), never block
- Gates per slice: `make validate-rules-schema` (new rule-group YAML), `make check` (vitest skips type-check), `make test-unit` (yaml runner needs its build artifact — bare `pnpm test` fails ENOENT), `make format-check` before push; full `make test` before declaring done
- Per rule-group change: `make publish-details`; `make deploy-test` (includes sync-rule-groups; deploy also invalidates the CDN); terraform seed per new group (`dynamodb-items.tf`), `make validate`
- Playwright check on http://localhost:5173 (`pgrep -f vite.js` first)
- After each push: monitor PR for codex comments (~15 min delayed); every comment gets fixed or a reasoned won't-fix reply; until reviews + pipelines clean; agent never merges
- i18n: BOTH locales (`en` + `en-x-tlh` invented values, normal casing); `rule.*` keys in `common.json` never rule-group YAML; detail body en-only (tlh falls back); `play.verbBuckets.CONDITION.<name>` per condition
- **STOP and discuss if any step proves unworkable**
- Tick items as done; add notes inline

## Out of scope (global)

- NPC-side enforcement: attacks vs us (Advantage/auto-crit from within 5 ft), charmer/grappler identity scoping, drag costs — notice text only (prone precedent)
- damage Resistance/Immunity halving (damage recorder is free-entry)
- death saves / 0 HP flow (Unconscious neighbour — separate idea)
- Hide action (Invisible's usual source); flying + Prone → falling
- condition immunities (glossary "Immunity") — future idea (user-directed 2026-09-25): mechanise Petrified's Poisoned immunity (recording Petrified evicts a standing Poisoned effect)
- mechanical drop of held items on Unconscious (auto-loadout → empty hands) — future idea (user-directed 2026-09-25)
- persisted effects from prior releases are not rewritten — re-record to heal
- backfilling seeded groups to pre-existing characters (prone known limitation — recreate character or forward-assignment idea)
