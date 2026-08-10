# Rules Engine v2 — M4 Plan (cutover & decommission)

Branch `claude/rules-engine-v2-m4` (stacked on the M3 initialEffects-migration
branch, PR #358). M4 is the final milestone: flip the running app from the v1
interpreter to the v2 dataflow/plan/effects engine, migrate persisted state, and
delete v1. After M3 the v2 engine runs essentially the whole scenario suite
(parity 327/337, the rest by-design); M4 makes it the one that actually runs.

## 1. Goal & exit criteria

- The play UI evaluates through **v2** (behind a flag first, then unconditionally).
- **No migration of existing characters.** Per the original spec, we do NOT build
  permanent cruft to carry pre-v2 characters forward — old characters are deleted and
  recreated v2-native. So there is no read-time v1→v2 effect shim and no one-shot
  `/effects` backfill; a stored blob is always a v2 `EffectInstance[]`.
- `make test` green (unit + rules + e2e); v2 proven in the **test env**.
- The v1 engine, `activities`, `_auto`, phases, and the YAML rule sources are
  **deleted**; `RULES_ENGINE.md` + the authoring guide are rewritten for v2.
- No user-visible behaviour change at the cutover (the parity harness is the proof
  the two engines agree; the 10 by-design deltas are documented + accepted).

### Status — v1 engine removed

The v1 interpreter is **deleted** (this PR): `evaluate`, `activities`, `phases`,
`ordering`, `output`, `sources`, `functions`, `conditions`, `hello-world` are gone,
along with their unit tests, the two v1 scenario runners (`scenarios.test.ts` +
`yaml-scenarios-runner.test.ts`) and the dead `countDown` helper. The scenario
corpus is still exercised — the **v2-parity runner** replays every `yaml-scenarios/`
case through v2. `src/lib/rules-engine/` now holds **only the engine→UI view/output
contract types** (`Rule`, `Facts`, `EngineOutput`, `AvailableRuleEntry`, …) that the
v2 bridge targets; its `index.ts` is type-only. The one shared value the UI still
needed from v1 — `evaluateCondition` for panel gating — moved to
`$lib/play/panelCondition` (pure, unit-tested). The YAML rule-group **metadata**
(names/requires/settings) is still published to DynamoDB via `sync-rule-groups` and
consumed at runtime; deleting those YAML sources is the remaining M2/W4 cleanup and
is not required to run a full test.

## 2. The contract gap (what the adapter must bridge)

The play store (`src/lib/play/playStore.svelte.ts`) is the single runtime call
site. It calls v1 `evaluate({ rules: { standing, planned, effects }, state:{facts} })`
and consumes:

- `output.availableRules` — `AvailableRuleEntry[]` where **`entry.rule` is a full
  `Rule`** (the UI reads `rule.ui`, `rule.vars`, and **`rule.varsRuntime`** for the
  per-item captured-var values _and_ the `errors` set that drives illegal-item
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
- **W2 — v1-shape effect → `EffectInstance` converter — DONE, then DELETED.**
  `migrate.ts` (`v1EffectRuleToInstance` / `migratePersistedEffects` / the
  `*.remaining`→`*.spent` remap) served the two runtime producers that still emitted
  v1-shape effects — settings resolution and follow-up effects. Both are now v2-native
  (settings `effect:` templates are authored as `EffectInstance`s validated by a new
  `effectInstance` schema; the javelin Slow followup carries `addRule.effect`), so the
  store commits their output directly and **`migrate.ts` + its test are deleted**. No
  v1-shape effect is emitted at runtime anywhere. (`substituteTemplate` now also
  substitutes `${value}` in object keys, since a v2 effect puts the fact name in a
  `state` key.)
- **W3 — REMOVED.** The `characterToV2Input` / `PersistedCharacterV1` assembler was
  pure existing-character-migration machinery (stored v1 character → v2 input) and is
  never read by the store — deleted. The store assembles its own input directly
  (`loadModules(ids)` + `parsePersistedEffects` over the v2 `EffectInstance[]` blob;
  `inputFacts` is empty — the v2 build lives in committed effects).
- **W4 — runtime wiring + display metadata.** (The PR branch _is_ the flag — deploy
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
    green. Recipe as implemented: 1. **`loadRuleGroups`** — keep the id fetch; add `state.modules =
(await loadModules(ids)).modules` (async, once per character). Drop the
    per-group rule-JSON `/batch` fetch from the eval path (settings still use
    `ruleGroupIds` + the dep cache, not the rule objects). 2. **effects load** — `parsePersistedEffects(blob)` → `state.committed:
EffectInstance[]` (a plain JSON parse; the blob is v2-native, no migration).
    Keep `state.effects: Rule[]` for the active-effects UI, produced from
    `state.committed` by a small `effectInstanceToRule` display bridge (`expiry` →
    `ui.countDown`/`duration`; synthesize a concentration activity when
    `state['concentration.spent']` so `effectUtils.getEffectKind` reads `CONC`;
    build + resource-spend effects flagged `ui.hidden`). Persist `state.committed`
    as `EffectInstance[]` JSON. 3. **`performEvaluation`** (stays sync) — `evaluateCharacterV2(state.modules,
state.committed, refs, {})` where `refs = plannedItems.map(i => ({
instanceId: i.instanceId, ruleId: i.rule.id, selections: i.rule.selections }))`.
    Set `state.facts`, `state.topBarEntries`/`resourceEntries` from the result,
    and build `state.engineOutput` in the v1 shape (v2 `availableRules` is
    already compatible; drop `collections`/`trace`). Hypotheticals ←
    `hypotheticalOffers(...)`. Per-item plan legality ← `plannedEntries` (map by
    `instanceId`, which PlanStack already keys on). 4. **`endTurn`** — age `state.committed` with v2 `endTurn(committed, advertised,
{})`; refresh `state.effects` via the display bridge; persist. (Replaces the
    v1 `decrementCountDowns` on `output.effects`.) 5. **`recalculateStats`** — deleted (top bar/resources now come from the eval
    result's `derivePanels` output, not `[...ruleGroups, ...effects]`). - Also wired: `assignSingleGroup`/`rollbackDeps`/`unassignRuleGroup` add/remove
    the group's `RuleModule` from `state.modules`; settings-derived effects
    (`assignRuleGroupWithSettings`) are migrated into `committed`; `addFollowupEffect`
    migrates its v1 rule into `committed`; `removeEffect` filters `committed`.

### Cutover gaps

**Only one accepted degradation remains:**

1. **Custom rules do not evaluate.** v2 runs code modules, not authored `Rule`
   objects. Custom rules are still stored, edited (`EditCustomRules`), and exported —
   they just don't contribute facts/offers under v2. A v2 custom-rule authoring path
   (or formal drop) is a separate product decision.

**Closed (were not acceptable losses):**

- **Effect i18n names — FIXED.** An `EffectInstance` now carries optional `display`
  (name/section/displayFact), which the bridge maps to the chip; its presence also
  opts the effect onto the strip. Wired onto the 12 player-facing effects (spells,
  steed as a MOUNT chip, grapple, divine-sense, javelin Slow, …), reusing the existing
  `rule.*.effect-*.name` keys. Also fixes the top-bar concentration label.
- **Steed resources — FIXED.** `deriveResourceEntries` surfaces the steed's HP /
  movement / actions / bonus-actions + the creature-type-matched special ability under
  the `subject: 'steed'` view.
- **Export/import — FIXED.** Now serialises `committed` (`EffectInstance[]`) at
  schemaVersion 2 and round-trips faithfully (intentionally not v1-compatible).

**Minor, still open:**

- **`cascadeRemove` is dropped.** Not carried by `EffectInstance`; dependent-effect
  eviction is now the owning module's job (by `key`). Revisit if a real case needs it.

_(The earlier gap "settings + follow-up effects still emit v1-shape" is CLOSED — see
W2 above: both are now v2-native and `migrate.ts` is deleted. Porting the settings
templates also fixed a latent bug where the paladin skill-proficiency effect could
not resolve its captured `level` var through the converter; v2 emits the base
`skill.X.proficiency` fact and the module derives the rest.)_

- **W5 — REMOVED (no existing-character migration).** Per the original spec we do not
  carry pre-v2 characters forward, so there is no one-shot `/effects` backfill and no
  read-time v1→v2 shim. Old characters are deleted and recreated v2-native; every
  stored blob is a v2 `EffectInstance[]`.
- **W6 — flip + delete (after W4 green in test env).** Default the flag on;
  then delete `src/lib/rules-engine/` (v1), the `activities`/`_auto`/phase code,
  `data/rule-sources` + `scripts/rule_preprocessor`, and the YAML groups the app no
  longer reads. Rewrite `RULES_ENGINE.md` + `docs/RULE_GROUP_GUIDE.md` for the v2
  builder API; update `CLAUDE.md` pointers. `make test` green with v1 gone.

## 4. Verification boundary (inherited from the M2/M3 plans)

- **Pure here:** W1–W2 (adapters, converters) are unit-testable now; the parity
  harness remains the behavioural oracle for engine agreement.
- **Env/CI-gated:** the W4 cutover proof and the e2e/deploy sign-off run via
  `make deploy-test` / the pipeline — deferred to the test env, not this repo
  checkout. W6's deletion lands only once those are green.

## 5. Guardrails (critical — inherited from CLAUDE.md, keep through compactions)

- **TDD** every pure increment (W1–W3): red → green; **never commit on a failing
  `make test`**. Never commit to `main`; develop on `claude/rules-engine-v2-m4`.
- **No behaviour change at cutover** — the parity harness (327 runnable) is the
  agreement proof; the 10 by-design deltas are the accepted, documented set.
- **I18n / a11y / the CSS Law** for any UI-adapter work — reuse existing keys and
  theme variables; the adapter feeds the _existing_ PanelRenderer unchanged.
- **Infra only via make targets** (`make deploy-test`, `make sync-rule-groups`);
  never run `terraform` directly. New rules still go through the yaml runner.
- **Delete only after green** — W6 removes v1 strictly after the W4 cutover passes in
  the test env, so a regression is always a flag-flip away from the v1 path.

## 6. Deploy readiness (the M2 delivery pipeline, for a full test-env run)

The env-gated half of the **M2 delivery pipeline** (`docs/RULES_ENGINE_V2_M2_PLAN.md`
— "gated delivery pipeline") is what a full test run exercises. Verified here that
the code side is ready:

- **W5 — co-bundled chunk hosting (works).** `pnpm build` code-splits every rule
  module into its own client chunk (`make verify-chunks`), and now that the store
  imports `loadModules`, the app's build actually ships them (bless/steed module code
  is present in `build/_app/immutable/chunks/…`). `make push-test` does
  `aws s3 sync build/` → S3 + a CloudFront invalidation, so the chunks deploy with the
  normal app build. No separate infra.
- **W4 — metadata/search index (works for the test via the existing sync).** The app
  reads rule-group metadata (name/requires/settings/condition) from DynamoDB, populated
  by `make sync-rule-groups` from the YAML — unchanged. Publishing metadata _from the
  v2 modules_ (so the YAML can be deleted) is a **W6** prerequisite, not test-blocking.
- **W6 — end-to-end proof = the deploy itself.** `make deploy-test` runs the full gate
  then `push-test` + `sync-rule-groups`. Its e2e gate is only the home-page smoke test
  (no play-flow e2e), so the cutover doesn't break it.
- **Coverage is complete + guarded.** All 84 deployed rule groups either resolve to a
  v2 module (67) or have **0 rules** (17: the `*-spells-l*` list aggregators + the
  `*-detail` catalog entries), which `loadModules` harmlessly skips. `v2-coverage.test.ts`
  asserts every rule group _with rules_ has a module, so a future unported group fails
  loudly.

**MUST re-sync on deploy:** the settings `effect:` templates changed shape (v1 rule →
v2 `EffectInstance`), so DynamoDB must be re-synced or `resolveSettings` will choke on
old-shape data. `make deploy-test` runs `sync-rule-groups`, so a full deploy covers it;
a chunks-only `push-test` would not.
