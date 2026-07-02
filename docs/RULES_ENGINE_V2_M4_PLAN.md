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
  - **Store wiring (env-proved):** the play store calls `loadModules(ruleGroupIds)`
    instead of fetching rule JSON, assembles the input via `characterToV2Input`
    (W3) + the plan, runs v2 `evaluate`/`evaluatePlan`, adapts via W1
    (`plannedEntries`) + `derivePanels`, and commits/ages effects with `endTurn`.
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
