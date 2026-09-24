# Condition: Grappled

Wave 4 (conditions-remaining.md). BEING grappled — an enemy imposes it; NOT the grapple attack we already model (`grapple.ts` = grappling OTHERS, hands-based; distinct facts, no overlap). Grappled lands the **Speed-0 ("halted") FOUNDATION**: "Your Speed is 0 and can't increase", the idiom Restrained/Paralyzed/Petrified/Unconscious all reuse — their docs ASSUME this one's PR1.

Record → keyed effect → notice chassis is prior art (condition-prone.md, PRs #435–#437, #444).

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Grappled [Condition]** — While you have the Grappled condition, you experience the following effects.
> **Speed 0.** Your Speed is 0 and can't increase.
> **Attacks Affected.** You have Disadvantage on attack rolls against any target other than the grappler.
> **Movable.** The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller than it.

Modelled: record offer (imposed — free, ungated, prone-recorder shape) + keyed effect + notice. Grappler exception + Movable/drag = notice text. Escape check offer = out of scope initially.

## Decisions (defaults — re-grill before execution)

- **The cycle trap — why splint's −10 does not transfer.** Zeroing `character.movement.speed`/`total` from a condition module needs a derive contribution reading the fact it contributes: a dynamic zero must subtract everything else (species base, splint −10, Dash's boost) = read its own fact = self-cycle; the engine derives order from reads, a fact cannot feed itself. Splint works only because −10 is a STATIC constant (reads equipped + STR only). Hardcoded −30 also rejected (wrong under splint/dash/other species). Rejected: condition modules contribute movement derives.
- **Recommended: a NEW halted fact** (grill this). movement.ts derives `character.movement.halted` = 1 when any of `condition.{grappled,restrained,paralyzed,petrified,unconscious}` > 0 (unset facts read 0 → safe with those groups unloaded). `character.movement.remaining` derives `halted ? 0 : total − spent`. `speed`/`total` stay live for derived math (`half_speed` Get Up cost) — BUT TWO derivePanels consumers read `character.movement.total` directly and would show 30 (or a planned-anyway-Dashed 60) while SRD says Speed 0: the top-bar SPD chip (entry `fact`) AND the stats-ledger `usedMax` resource entry (renders `remaining/total` → "Speed 0/30" with the accessible "0 of 30"). Derive `character.movement.effective_total` = `halted ? 0 : total`; point BOTH entries at it (the resource entry's `total` field too — while halted it reads 0/0, honest; its zero-value visibility follows). Display reads effective; math keeps base; gates carry the semantics.
- ALL 6 move offers (walk, rough-terrain, crawl, swim, swim-costly, fly) gain not-halted legality + apply re-check, shared code `rule.dnd-5e-2024.movement.cannot_while_halted` (the `cannot_while_prone` shape). Speed 0 beats prone's crawl allowance: prone+grappled → crawl illegal too (no movement at all).
- DASH gains not-halted legality ("can't increase"), code `rule.dnd-5e-2024.dash.action-dash-offer.cannot_while_halted` + apply re-check. `remaining` 0 already masks a planned-anyway boost; the gate adds the honest diagnostic — the player may STILL plan it (illegal-but-visible; the pin asserts the mask), the diagnostic informs, nothing is withdrawn.
- Prone's Get Up / Drop Prone gates EXTENDED to `speed > 0 ∧ halted = 0` — current `speed > 0` alone misses grapple (speed stays 30); halted is the cleaner gate. Same SRD clause ("If your Speed is 0…"), so REUSE the existing codes (`get-up-offer.cannot_get_up`, `drop-prone-offer.cannot_drop`); grill whether a distinct code reads better.
- Attack Disadvantage "vs any target other than the grappler": flag UNscoped — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage`, `stateCombine: 'max'` (armor derives them `combine: 'max'`; default sum conflict-throws — prone PR1 note). Grappler exception = NPC identity → notice text.
- Movable/drag (extra foot, Tiny/size carve-out) → notice text. Escape check offer out of scope initially. Ending = umbrella default: `expiry: untilShortRest` + manual chip dismissal.
- `grapple.ts` cross-ref: it owns `grapple.dc` + key `'grappling'` hands-spend (US grappling); this owns `condition.grappled` (BEING grappled). Namespaces stay distinct.

## Design

Module `src/lib/rules-engine/rules/condition-grappled.ts`, id `condition-grappled`; register `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-grappled.yaml`: translations, `requires: [movement]`, detail (SRD body verbatim, en-only) → `make publish-details`. Terraform seed `char_condition_grappled_rulegroup_seed` (dynamodb-items.tf); `make validate`. No search meta (foundational).

Facts:

- `condition.grappled` — 1 while grappled; written ONLY by the committed effect
- `character.movement.halted` — movement.ts derive over the 5 Speed-0 conditions
- `character.movement.remaining` — now `halted ? 0 : total − spent`
- `character.movement.effective_total` — `halted ? 0 : total`; BOTH derivePanels consumers read it (top-bar SPD entry `fact` + the stats-ledger `usedMax` entry's `total`)

Effect: `{ id: 'effect-grappled', key: 'grappled', state: { 'condition.grappled': 1 }, display: { name, detailKey: 'condition/grappled' }, expiry: { kind: 'untilShortRest' } }` — attack flags join `state` in PR2.

Offers:

- `record-grappled`: section `free`, `detailKey: 'condition/grappled'` (the published SRD detail), `intents: { CONDITION: 'grappled' }`, no control, no gate (imposed)
- movement.ts: not-halted legality + recheck on all 6 move offers, one shared code
- dash.ts: not-halted legality + apply re-check
- condition-prone.ts: get-up + drop-prone gates read halted (extension, PR2)

Notice (while `condition.grappled > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-grappled.notice` (+ `.body`), `source` effect name, no `values`. en body: "Your Speed is 0 and can't increase. Disadvantage on attack rolls against any target other than the grappler. The grappler can drag or carry you when it moves, at 1 extra foot per foot unless you are Tiny or two or more sizes smaller."

i18n — keys ONLY (values at execution), BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json`, never the yaml; detail body en-only:

- `play.verbBuckets.CONDITION.grappled`
- `rule.dnd-5e-2024.condition-grappled.record-grappled.name`, `.effect-grappled.name`, `.notice`, `.notice.body`
- `rule.dnd-5e-2024.movement.cannot_while_halted`
- `rule.dnd-5e-2024.dash.action-dash-offer.cannot_while_halted`

Tests (RED first — yaml scenario asserts are the RED; register each in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-grappled-record` — offer exists; after add: `condition.grappled` 1, `halted` 1, `remaining` 0, `effective_total` 0 (the display leg — without this assert both production edits could be skipped green), notice exists/targets notice (attack-flag asserts join in PR2); rest-clears restores `effective_total` to base
- `move-walk-illegal-while-grappled` — walks/swim-costly/fly illegal; planned-anyway walk carries `cannot_while_halted`
- `dash-illegal-while-grappled` (PR2) — dash illegal; planned-anyway: `total` boosted yet `remaining` stays 0 (mask pinned)
- `get-up-illegal-while-grappled` (PR2) — grappled alone: drop-prone illegal; + prone: get-up AND crawl illegal
- `condition-grappled-rest-clears` — short AND long → cleared, notice gone, halted 0, remaining restored

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

## PRs

### PR1 — halted idiom + condition-grappled module (record, effect, notice, rest clear, seeds)

- [ ] RED: `condition-grappled-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] movement.ts: `character.movement.halted` derive (5 conditions); `remaining` 0-when-halted; not-halted legality + recheck on all 6 move offers, shared `cannot_while_halted`
- [ ] `character.movement.effective_total` derive; derivePanels.ts — BOTH consumers swapped to it (top-bar SPD entry shows 0 while halted; the `usedMax` resource entry renders 0/0, not 0/30); unit test in tests/unit/play/derivePanels.test.ts pins BOTH entry facts = `effective_total`
- [ ] `condition-grappled.ts`: `record-grappled` offer, keyed grappled effect (fact only — flags PR2), notice annotate
- [ ] i18n both locales: `play.verbBuckets.CONDITION.grappled` + record/effect/notice keys + `movement.cannot_while_halted`
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output gitignored — published, not committed)
- [ ] GREEN: record + move-walk-illegal + rest-clears scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_grappled_rulegroup_seed` (dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → clean → `make deploy-test` (includes sync-rule-groups) → human inspects test env → human merges (merge deploys prod)

### PR2 — attack flags + dash/get-up/drop-prone gates

- [ ] RED: `dash-illegal-while-grappled`, `get-up-illegal-while-grappled` fail
- [ ] effect state gains `attack.str/dex.disadvantage` (`stateCombine: 'max'`); record scenario extended with flag asserts; greataxe's Cleave secondary control (greataxe.ts `actionUiExtra.secondaryControl`) gains the disadvantage source (no mode source today — WeaponDef wiring reaches primaries only; test a mastery-enabled Cleave)
- [ ] dash.ts not-halted legality + apply re-check; condition-prone get-up + drop-prone gates read halted (reuse `cannot_get_up`/`cannot_drop`)
- [ ] i18n `rule.dnd-5e-2024.dash.action-dash-offer.cannot_while_halted`, both locales
- [ ] GREEN; gates → PR → codex monitor → clean → `make deploy-test` → human inspects test env → human merges

## Out of scope

- escape check offer (Unarmed Strike grappler-escape flow)
- grappler-identity scoping, drag-cost mechanics, Tiny/size carve-out (notice text)
- shoving/forced movement by the grappler
- mutating `speed`/`total` to literal 0 (halted masks — deliberate; see cycle trap)
- condition stacking / multiple grapplers (glossary: no self-stack)

## Notes

- `speed`/`total` stay live for math (`half_speed`); the SPD chip reads `effective_total` → 0 while halted; gates carry the semantics
- Speed 0 beats prone's crawl: prone+grappled → crawl illegal
- wave-5 children (Paralyzed/Petrified/Unconscious) + Restrained just write their `condition.*` fact — halted picks them up, no movement.ts change
- dash planned-anyway still advertises its boost (apply re-check adds diagnostics, never withdraws) — `remaining` masks it; pinned in the dash scenario
