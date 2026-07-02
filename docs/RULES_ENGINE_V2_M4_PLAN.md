# Rules Engine v2 — M4 Plan (cutover & decommission)

Branch `claude/rules-engine-v2-m4` (stacked on the M3 initialEffects-migration
branch, PR #358). M4 is the final milestone: flip the running app from the v1
interpreter to the v2 dataflow/plan/effects engine, migrate persisted state, and
delete v1. After M3 the v2 engine runs essentially the whole scenario suite
(parity 327/337, the rest by-design); M4 makes it the one that actually runs.

## 1. Goal & exit criteria

- The play UI evaluates through **v2** (behind a flag first, then unconditionally).
- Persisted character **effects migrate** from the v1 rule format to the v2 ref /
  `EffectInstance` format, losslessly for every shipped rule group.
- `make test` green (unit + rules + e2e); v2 proven in the **test env**.
- The v1 engine, `activities`, `_auto`, phases, and the YAML rule sources are
  **deleted**; `RULES_ENGINE.md` + the authoring guide are rewritten for v2.
- No user-visible behaviour change at the cutover (the parity harness is the proof
  the two engines agree; the 10 by-design deltas are documented + accepted).

## 2. The contract gap (what the adapter must bridge)

The play store (`src/lib/play/playStore.svelte.ts`) is the single runtime call
site. It calls v1 `evaluate({ rules: { standing, planned, effects }, state:{facts} })`
and consumes:

- `output.availableRules` — `AvailableRuleEntry[]` where **`entry.rule` is a full
  `Rule`** (the UI reads `rule.ui`, `rule.vars`, and **`rule.varsRuntime`** for the
  per-item captured-var values *and* the `errors` set that drives illegal-item
  styling), `legal`, `applicable`, `diagnostics`.
- `output.facts` — the projected post-plan facts (top bar, resources, gating).
- `output.effects` — advertised effects (v1 `Rule[]`), **committed into
  `state.effects` at End Turn** and persisted to `/api/characters/{id}/effects`.
- Per-planned-item **hypothetical** re-evaluations (the "alternatives" picker) —
  one `evaluate` per planned item with that item removed.

v2 `evaluate({ modules, ruleGroupIds, inputFacts, planned, committed })` returns:

- `availableRules` — `AvailableRuleEntry[]` where **`entry.rule` is a lean
  `OfferRuleDescriptor`** (`id`, `ui`, `vars`, `description`) — no `varsRuntime`,
  no `activities`.
- `planDiagnostics: Record<instanceId, Diagnostic[]>` — the per-item legality that
  v1 folded into `varsRuntime.errors`.
- `facts`, `annotations`, `status`; and `evaluatePlan(...).advertised` —
  `EffectInstance[]` (the committed-effect stream).

Four gaps to bridge:

1. **Offer shape.** `OfferRuleDescriptor` → the `Rule`-ish object the UI reads.
   Fold `planDiagnostics[instanceId]` + captured `selections` back into a
   `varsRuntime` (errors set + var values) so the existing UI keeps working
   unchanged. (`collections`/`trace`/`next` are review-cluster items from #355 —
   add only if a consumer still reads them; grep says the store does not.)
2. **Effects.** v1 `Rule[]` ⇄ v2 `EffectInstance[]` — for **persistence** (load =
   old→new, save = new→old until the stored format itself is migrated) and for the
   End-Turn commit/age step (`endTurn` already exists in v2).
3. **Inputs.** v1 fetches full rule JSON per group and computes facts from it. v2
   loads **code-split modules by id** (`loadModules`) and needs **`inputFacts`**
   (the character-build constants: ability totals, slot totals, proficiency bonus,
   equipped/prepared flags — everything v1 set via BUILD rules). Deriving
   `inputFacts` from the persisted character is the biggest single piece.
4. **Hypotheticals.** The per-item "alternatives" map is a plan-fold variant — v2's
   `evaluatePlan` over the plan minus one ref; cheaper than v1 (no rule re-parse).

## 3. Increments (ordered; each shippable + testable)

- **W1 — output contract adapter (pure, TDD here).** `adaptV2Output(v2Output,
  planned): V1ShapedOutput`: map `availableRules` (descriptor→rule, merge
  `planDiagnostics`+`selections`→`varsRuntime`), pass through `facts`/`annotations`/
  `status`. Unit-tested against fixture v2 outputs. No runtime wiring yet.
- **W2 — effect format converter (pure, TDD here) — DONE (mechanical pass).**
  `src/lib/rules-engine-v2/migrate.ts`: `v1EffectRuleToInstance` +
  `migratePersistedEffects` convert a persisted v1 effect `Rule` → v2
  `EffectInstance` (baked `numberSet`→`override`, `numberIncrement`→`sum`,
  `self`-advertise→`permanent`, `group`→`key`); eval-time (`fact`/`condition`)
  sources are surfaced in `unresolved`, not dropped. 6 unit tests.
  **Finding:** this is correct only for the **shared-namespace** effects (build
  state, buffs, `hp.modifier.*`). Resource effects diverge — v1 sets `*.remaining`
  directly, v2 derives `remaining = total − spent` — so a **semantic remap** of
  those to `*.spent` is a W5 layer on top (the same total/remaining/spent mapping
  `INITIAL_EFFECTS_V2` already encodes for the parity harness), not a mechanical
  activity→state conversion.
- **W3 — character→input assembler (pure, TDD here) — DONE.**
  `src/lib/rules-engine-v2/character-input.ts`: `characterToV2Input({ ruleGroupIds,
  effects })` → a `SerializableInput` (assigned ids → `ruleGroupIds`, effect blob →
  committed via W2, `inputFacts` empty, `planned` layered on). **Finding:**
  `inputFacts` is genuinely empty — the v2 build lives in committed effects and the
  rest is module derives (only ~4 parity scenarios set an input fact, all for
  effect/derive state), so W3 collapses into the W2-composing assembler rather than
  a separate BUILD-fact derivation. 4 unit tests.
- **W4 — runtime wiring + display metadata.** (The PR branch *is* the flag — deploy
  it to test to try v2; no in-app `useV2Engine` toggle.)
  - **Display metadata (pure, TDD here) — top bar + resources DONE.**
    `src/lib/play/derivePanels.ts`: `deriveTopBarEntries`/`deriveResourceEntries`
    are the v2 replacement for `extractTopBarEntries`/`extractResourceEntries` —
    v2 modules don't carry the v1 `ui.topBar`/`ui.resources` blocks, so this is a
    fixed facts-driven catalog (an entry surfaces when its driving fact is present;
    the existing `resolveEntryValue`/`isEntryVisible` render it unchanged). 6 tests.
    - **Remaining display metadata:** the character-sheet sections (spell slots
      `magic`, `abilities`, `stats`, `skills`, `passive` — same facts-driven
      pattern, needs its consumer contract confirmed) and the **active-effects
      list** (`ActiveStateStrip`/`EffectChip` read each effect rule's `ui.name`/
      duration; v2 `EffectInstance`s carry none, so effects need display metadata —
      e.g. a name/duration derived from the effect id + expiry, or a small per-
      module effect-descriptor map).
  - **Character-sheet sections — NOT NEEDED (contract confirmed).** Grep of the
    play UI shows the store feeds only `topBarEntries` + `resourceEntries` (+ facts,
    availableRules, effects) to the components; the `stats`/`skills`/`passive`/
    `magic`/`abilities` names in `STAT_SECTION_ORDER` are not wired to a separate
    extractor (abilities render inside the top-bar `ability` entry). So the
    speculative `deriveCharacterSheet` is unnecessary — `derivePanels` covers it.
  - **Store wiring — DONE (green here; behaviour deploy-verified).** Rewrote
    `playStore.svelte.ts` internals to the recipe below. NOTE: the summary's premise
    that "no store tests exist" was WRONG — `tests/unit/lib/play/playStore.test.ts`
    is a 62-test suite that asserted the v1 internals; it has been re-pointed at the
    v2 seam (mocks `./evaluateV2` + `loadModules`, keeps the pure `migrate`/`endTurn`
    real). Full unit suite green (2319 passed / 10 by-design skips), lint + build
    green. Recipe as implemented:
    1. **`loadRuleGroups`** — keep the id fetch; add `state.modules =
       (await loadModules(ids)).modules` (async, once per character). Drop the
       per-group rule-JSON `/batch` fetch from the eval path (settings still use
       `ruleGroupIds` + the dep cache, not the rule objects).
    2. **effects load** — `migratePersistedEffects(v1Blob)` → `state.committed:
       EffectInstance[]` (W2 + the W5 remap). Keep `state.effects: Rule[]` for the
       active-effects UI, produced from `state.committed` by a small
       `effectInstanceToRule` display bridge (id → `ui.name` by the
       `rule.<group>.<id>.name` convention; `expiry` → `ui.countDown`/`duration`;
       synthesize a concentration activity when `state['concentration.spent']` so
       `effectUtils.getEffectKind` reads `CONC`). Persist `state.committed` as JSON.
    3. **`performEvaluation`** (stays sync) — `evaluateCharacterV2(state.modules,
       state.committed, refs, {})` where `refs = plannedItems.map(i => ({
       instanceId: i.instanceId, ruleId: i.rule.id, selections: i.rule.selections }))`.
       Set `state.facts`, `state.topBarEntries`/`resourceEntries` from the result,
       and build `state.engineOutput` in the v1 shape (v2 `availableRules` is
       already compatible; drop `collections`/`trace`). Hypotheticals ←
       `hypotheticalOffers(...)`. Per-item plan legality ← `plannedEntries` (map by
       `instanceId`, which PlanStack already keys on).
    4. **`endTurn`** — age `state.committed` with v2 `endTurn(committed, advertised,
       {})`; refresh `state.effects` via the display bridge; persist. (Replaces the
       v1 `decrementCountDowns` on `output.effects`.)
    5. **`recalculateStats`** — deleted (top bar/resources now come from the eval
       result's `derivePanels` output, not `[...ruleGroups, ...effects]`).
    - Also wired: `assignSingleGroup`/`rollbackDeps`/`unassignRuleGroup` add/remove
      the group's `RuleModule` from `state.modules`; settings-derived effects
      (`assignRuleGroupWithSettings`) are migrated into `committed`; `addFollowupEffect`
      migrates its v1 rule into `committed`; `removeEffect` filters `committed`.

### Known cutover gaps (accepted for the flag deploy; validate/close on test)

These are the deliberate degradations baked into the store cutover. None break the
core play loop (load → stats/resources → plan → end turn); all are advanced-feature
or cosmetic and are the reason "the PR is the flag" — the test-env deploy is where
they get eyeballed and prioritised.

1. **Custom rules do not evaluate.** v2 runs code modules, not authored `Rule`
   objects. Custom rules are still stored, edited (`EditCustomRules`), and exported —
   they just don't contribute facts/offers under v2. A v2 custom-rule authoring path
   (or formal drop) is a separate product decision.
2. **Effect display names fall back to the id.** An `EffectInstance` carries no
   display name, so the active-effects chip shows the effect id (e.g. `effect-bless`)
   and the top-bar concentration label is blank. Needs a per-effect → i18n-name map
   (the "small per-module effect-descriptor map" option). Duration pips + the
   concentration marker DO work.
3. **Strip visibility is heuristic.** `effectInstanceToRule` hides `permanent` (the
   whole v2 build: abilities/equipment/prepared) and pure `*.spent` resource effects,
   showing duration-limited buffs + concentration. Edge cases (a permanent
   player-facing buff; the steed, which surfaces via facts + the subject switcher, not
   the strip) may be mis-classified — confirm on test.
4. **Export/import effect fidelity is lossy.** Export serialises the bridged display
   `Rule`s; effects are transient combat state, so a re-import round-trips them
   imperfectly. Build (rule groups) + custom rules export unchanged.
5. **`cascadeRemove` is dropped.** Not carried by `EffectInstance`; dependent-effect
   eviction is now the owning module's job (by `key`).
6. **Steed resources not in the ledger yet.** `derivePanels` has no
   `companion.steed.*` entries; the steed's own resources need adding to the catalog.
7. **Migrated-character build fidelity is W5/test-env.** Whether a real pre-cutover
   character's build (its settings-derived effects) fully reconstructs as v2
   `committed` is exactly what the test-env deploy proves; the read-time v1→v2 shim
   (`parsePersistedEffects`) is in place, persistence is now `EffectInstance[]` JSON.
- **W5 — persisted-effect migration (env/CI-gated).** A one-shot migration of
  stored `/effects` blobs old→new via W2, plus a read-time shim for un-migrated
  characters. Proven in the **test env** (`make deploy-test`), not here.
- **W6 — flip + delete (after W1–W5 green in test env).** Default the flag on;
  then delete `src/lib/rules-engine/` (v1), the `activities`/`_auto`/phase code,
  `data/rule-sources` + `scripts/rule_preprocessor`, and the YAML groups the app no
  longer reads. Rewrite `RULES_ENGINE.md` + `docs/RULE_GROUP_GUIDE.md` for the v2
  builder API; update `CLAUDE.md` pointers. `make test` green with v1 gone.

## 4. Verification boundary (inherited from the M2/M3 plans)

- **Pure here:** W1–W3 (adapters, converters, inputFacts) are unit-testable now;
  the parity harness remains the behavioural oracle for engine agreement.
- **Env/CI-gated:** W4 proof, W5 data migration, and the e2e/deploy sign-off run
  via `make deploy-test` / the pipeline — deferred to the test env, not this repo
  checkout. W6's deletion lands only once those are green.

## 5. Guardrails (critical — inherited from CLAUDE.md, keep through compactions)

- **TDD** every pure increment (W1–W3): red → green; **never commit on a failing
  `make test`**. Never commit to `main`; develop on `claude/rules-engine-v2-m4`.
- **No behaviour change at cutover** — the parity harness (327 runnable) is the
  agreement proof; the 10 by-design deltas are the accepted, documented set.
- **I18n / a11y / the CSS Law** for any UI-adapter work — reuse existing keys and
  theme variables; the adapter feeds the *existing* PanelRenderer unchanged.
- **Infra only via make targets** (`make deploy-test`, `make sync-rule-groups`);
  never run `terraform` directly. New rules still go through the yaml runner.
- **Delete only after green** — W6 removes v1 strictly after W1–W5 pass in the test
  env, so a regression is always a flag-flip away from the v1 path.

## 6. Out of scope

The M2/W4–W6 items still open in their own row (search-index publish, co-bundled
hosting infra, the end-to-end test-env proof) are prerequisites the pipeline owns;
M4 consumes them but does not re-do them.
