# Condition: Poisoned

Fourth condition on the prone chassis: Poisoned — the most common condition in play (poison saves everywhere), high value. First condition to touch the skill-check rollers: attack flags PLUS all 18 `skill.{skill}.disadvantage` facts. See conditions-remaining.md.

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## SRD (verbatim, docs/srd52.txt)

> **Poisoned [Condition]** — While you have the Poisoned condition, you experience the following effect.
> **Ability Checks and Attacks Affected.** You have Disadvantage on attack rolls and ability checks.

Modelled: attack flags + all 18 `skill.{skill}.disadvantage` facts (facts exist — leather-armor writes 4; loop like ability-scores). Most common condition in play.

## Decisions (defaults — re-grill before execution)

- Attack Disadvantage: prone idiom — effect writes `attack.str.disadvantage` + `attack.dex.disadvantage`, `stateCombine: 'max'`.
- Ability-check Disadvantage: **all 18 skill flags** + `initiative.disadvantage` + NEW `check.disadvantage`, mechanically — skill offers' dice-lines already read `skill.{skill}.disadvantage` (`advantage: { fact }`, skill-checks.ts) and `roll-initiative` already reads `initiative.disadvantage` (initiative.ts; leather-armor writes it) → those rollers default 2d20-take-low, zero roller changes. Initiative IS an ability check (SRD: "they make a Dexterity check"), so the ability-check disadvantage reaches it. The GENERIC ability check — `record-check` (core-events.ts, free section, `purpose: 'check'`) — has no advantage wiring today: its dice gains `advantage: { fact: 'check.disadvantage' }` (the Restrained save-wiring shape, one line) and the effect writes the fact.
- `stateCombine: 'max'` on EVERY flag write, loop-built: 4 skills (acrobatics, athletics, sleight-of-hand, stealth) + the 2 attack facts + `initiative.disadvantage` are armor-derived `combine: 'max'` — default `sum` effect writes conflict-throw for armored characters (prone PR1 note); uniform `max` also keeps stacked conditions (Poisoned + Frightened both live) from summing flags to 2.
- SKILLS list: **local const in the module** — modules import only from `builder` (confinement lint); skill-checks.ts and ability-scores.ts each keep a local copy already. Consolidation = out of scope.
- Ending: umbrella default — `expiry: untilShortRest` (prone deviation) + ActiveStateStrip chip dismissal. SRD gives no mechanical end.
- Recorder `record-poisoned` ("Poisoned"): free, ungated, imposed by an enemy effect (knocked-prone shape).
- Group `requires: []`.
- Detail body: SRD verbatim (umbrella quote), en-only.

## Design

Module `src/lib/rules-engine/rules/condition-poisoned.ts`, id `condition-poisoned`; register in `registry.ts` AND `lazy.ts`. YAML `data/rule-groups/dnd-5e-2024/condition-poisoned.yaml`: translations (name/description/keywords, en + tlh), `requires: []`, detail (key `condition/poisoned`, source `srd52`, body en-only) → `make publish-details`. No search meta.

Facts:

- `condition.poisoned` — 1 while poisoned; written ONLY by the committed effect
- `attack.str.disadvantage`, `attack.dex.disadvantage`, `skill.{skill}.disadvantage` ×18, `initiative.disadvantage`, `check.disadvantage` — flags

Effect (loop `SKILLS`, both maps built in one pass):

- `{ id: 'effect-poisoned', key: 'poisoned', state: { 'condition.poisoned': 1, 'attack.str.disadvantage': 1, 'attack.dex.disadvantage': 1, 'initiative.disadvantage': 1, 'check.disadvantage': 1, …`skill.${s}.disadvantage`: 1 for each of 18 }, stateCombine: 'max' on all 22 flags, display: { name }, expiry: { kind: 'untilShortRest' } }`

Offer:

- `record-poisoned`: section `free`, `intents: { CONDITION: 'poisoned' }`, `detailKey: 'condition/poisoned'`, no control, no gate, `actionCost: []`; apply advertises the effect

Notice (annotate while `condition.poisoned > 0`): `targets: ['notice']`, key `rule.dnd-5e-2024.condition-poisoned.notice` (+ `.body`), `source` effect name. No `values`.
en body: "You have Disadvantage on attack rolls and ability checks."

i18n — BOTH `src/lib/i18n/en/common.json` AND `src/lib/i18n/en-x-tlh/common.json` (tlh invented at execution, normal casing — do not invent now):

- `rule.dnd-5e-2024.condition-poisoned.record-poisoned.name`
- `rule.dnd-5e-2024.condition-poisoned.effect-poisoned.name`
- `rule.dnd-5e-2024.condition-poisoned.notice`, `.notice.body`
- `play.verbBuckets.CONDITION.poisoned`

Tests (RED first — registered in `EXPECTED_RUNNABLE`, tests/integration/rules-engine/yaml-scenarios.test.ts):

- `condition-poisoned-record` (condition fact + attack flags + `initiative.disadvantage` + notice exists)
- `condition-poisoned-rest-clears` (short AND long → cleared, notice gone; co-load `core-events`)
- `condition-poisoned-skill-flags` — co-load `leather-armor` untrained (its penalty derives 4 of the same skill flags `max`); record → attack flags + 2–3 representative skills asserted, NOT all 18: `skill.athletics.disadvantage` (armor-derived — the conflict case), `skill.stealth.disadvantage` (armor-derived), `skill.perception.disadvantage` (not). No combine-conflict throw.

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

### PR1 — condition-poisoned module (record, effect, notice, rest clear, seed)

- [ ] RED: `condition-poisoned-record` scenario fails — right reason: unknown group → skipped vs `EXPECTED_RUNNABLE`
- [ ] `condition-poisoned.ts`: `record-poisoned` offer, keyed poisoned effect (22 facts, loop-built), notice annotate
- [ ] core-events.ts `record-check` dice gains `advantage: { fact: 'check.disadvantage' }` (generic ability-check roller — the Restrained save-wiring shape)
- [ ] register `registry.ts` + `lazy.ts`; yaml + detail; `make publish-details` (output `static/details/` gitignored — published, not committed)
- [ ] i18n keys both locales
- [ ] GREEN: record + rest-clears + skill-flags scenarios; `EXPECTED_RUNNABLE`
- [ ] terraform seed `char_condition_poisoned_rulegroup_seed` (terraform/module/dnd-planner/dynamodb-items.tf); `make validate` passes
- [ ] gates (`make check`, `make test-unit`, `make format-check`) → PR → codex monitor → merge; `make sync-rule-groups` then `make deploy-test`

May share PR1 with Frightened (same footprint — 18-flag sibling; conditions-remaining.md calibration). Docs stay standalone either way.

## Out of scope

- inflicting Poisoned on others (poison spells — NPC state)
- poison immunity / resistance (glossary "Immunity" — global out-of-scope; Petrified neighbour)
- skill-less ability checks (raw STR/DEX/… checks — no offers exist; notice text)
- condition stacking semantics beyond flag-max (a condition doesn't stack with itself — glossary ground rule)
- backfilling seeded groups to pre-existing characters (prone known limitation)

## Notes

- `record-*` offers carry name only — no `.description` key (prone PR1 note)
- 21-flag effect is the template for Frightened — extract nothing yet (two modules, two local loops; share only if a third appears)
- Known limitation: seeded group self-heal needs character recreated or forward-assignment (prone precedent)
