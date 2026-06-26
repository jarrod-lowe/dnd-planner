# Rules Engine v2 — M1 Plan (Engine build-out)

> Status: **DRAFT for review.** Follows M0 (verdict **GO** — see
> [RULES_ENGINE_V2_PLAN.md](RULES_ENGINE_V2_PLAN.md)).
> Branch: `claude/rules-engine-v2-m1`, stacked on and PR'd into
> `claude/epic-dijkstra-lxyaep` (not `main`).

## 1. Where M0 left us

The spike already built and tested (35 v2 unit tests; `src/lib/rules-engine-v2/`):

- **Sheet** — `evaluateSheet(modules, inputFacts, effects)`: pull-based dataflow,
  `sum`/`max`/`override` combine, cycle detection, effect contributions
  (`state` deltas or `effectContributions`).
- **Plan** — `evaluatePlan(modules, inputFacts, planned, committed)`: pure left
  fold that re-derives the sheet with effects-so-far before each action;
  `legalWhen` evaluated for planned items; advertised effects; per-instance
  diagnostics.
- **Offers** — `evaluateOffers(modules, facts)`: structural `when` gate +
  `legalWhen` → `OfferEntry[]` (illegal-but-visible); globally-unique offer ids.
- **Effects** — `endTurn(committed, advertised, {longRest})` aging
  (`untilLongRest` / `endOfTurn` / `turns`).
- **Modules** — `ability-scores`, `hp`, `class-paladin-level1`, `action-economy`,
  `attacks`, `spellcasting`, `paladin-smite`, `divine-smite`.

So M1 is **not** "build the engine core" (largely done) — it's **productionize it
to the full output contract and stand up the acceptance gate**, still additive
(the app stays on v1).

## 2. M1 goal

A single pure **`evaluate(input): EngineOutput`** that composes the M0 passes and
emits the **existing** `EngineOutput` shape unchanged, validated by a **parity
harness** running real `yaml-scenarios` on v2 — plus the confinement/safety rails
that make LLM-authored modules safe. No runtime flip, no full rule port, no M2
infra.

## 3. Workstreams

### W1 — `evaluate()` + contract adapter _(the core of M1)_

- Define the v2 input shape and the adapter to/from the **existing**
  `EngineOutput` (`src/lib/rules-engine/types.ts`). Compose:
  `sheet(committed)` → plan fold → final `sheet(committed+advertised)` →
  `offers(final)` → `annotate(final)` → aged effects → build output.
- **Output mapping (must stay byte-compatible with what the UI reads):**
  - `availableRules[]` ← `OfferEntry` → `{ rule: { id, ui, vars, description }, legal, applicable, diagnostics }` (PanelRenderer reads `rule.ui`/`rule.vars` only — confirmed in M0).
  - **Planned-item legality** ← `planDiagnostics`: map to whatever the plan UI reads today (`varsRuntime.errors` equivalent) so illegal planned items render. **Key adapter task** — audit `playStore`/`PanelRenderer` for the exact field.
  - `annotations`, `facts`, `effects` (next committed set), `next` (replayable input), `status { ok, legal, applicable }`, `diagnostics`, `collections`, `trace`.
- **Decide the input/persistence shape:** prefer "everything derived" like v1
  (`state.facts` ~empty) — player choices (ability scores, prepared spells) are
  **permanent effects**, not input facts; planned items + effects are refs
  (`PlannedRef` / `EffectInstance`). Document the round-trip (commit at end of
  turn = `endTurn` output → persisted effects).
- TDD: unit tests asserting the adapter produces the exact `EngineOutput` fields.

### W2 — Registry + `annotate` pass

- **Registry**: `ruleId → module`. Static map for M1 (M2 swaps in
  `import.meta.glob` + lazy chunks). `ruleGroupIds → modules` resolution.
- **Annotate**: add `annotate?(ctx): Annotation[]` to `RuleModule`; evaluate
  against final facts; emit `Annotation { key, targets, rider }`. Port
  `divine-smite`'s annotate as the first example; verify `getMatchingAnnotations`
  label-matching is unchanged.

### W3 — Builder API + confinement + safety rails

- **Builder API**: decide `defineRule()` wrapper vs the current plain
  `RuleModule` objects (recommend a thin `defineRule()` for a stable authored
  surface + types).
- **Lint confinement** (the security story): ESLint config scoped to the rules
  dir — `no-restricted-globals` / `no-restricted-properties`
  (`fetch`, `window`, `document`, `localStorage`, `Date`, `Math.random`,
  `globalThis`, `XMLHttpRequest`), `no-restricted-imports` (only the builder API
  / types). Lint runs in CI (`pnpm lint`).
- **Purity test**: run each module's `derive`/`offer` twice, assert identical
  output.
- **Termination watchdog**: time-box `evaluate` (defensive; combined with
  lint-banning `while(true)`/`for(;;)`).

### W4 — Effect-model completeness _(settles the deferred design)_

- **Per-fact `combine` on effect `state`** (the deferred #9): a state entry may
  declare `override`/`max` rather than the default `sum`, so replacement-style
  effects (HP modifiers) don't stack. Decide multi-writer semantics:
  latest-committed-wins **or** commit-time replace-by-identity (recommend
  **replace-by-identity** — an effect carries a logical key; committing a new one
  with the same key evicts the old, so the sheet keeps a single writer).
- **`permanent` expiry kind** — for prepared spells / conditions that persist
  until explicitly removed (never aged by `endTurn`). Unblocks the Divine Smite
  **prepare path** and always-prepared interaction in M3.
- These are engine features; the _rules_ that use them (HP modifiers, prepare)
  are ported in M3, but the engine must support them first.

### W5 — Parity harness _(the acceptance gate)_

- A v2 scenario runner that loads each `yaml-scenarios/*/test.yaml`, maps its
  `ruleGroups` → v2 modules via the registry, drives the same steps
  (`evaluate` / `addOffer` / `removeFromPlan` / `updateSelections` / `endTurn` /
  `removeEffect`) through `evaluate()`, and runs the **same assertions** (the
  scenario already encodes v1's expected output — it is the oracle).
- M1 scope: green for the **subset of scenarios whose groups are all ported**
  (hp, ability-scores, action-economy, attacks, spellcasting, divine-smite-ish);
  skip-list the rest with a count, so coverage grows as M3 ports more.
- Wire into `make test`. This is the formal Go/No-Go evidence the plan called 3c.

## 4. Sequencing

W1 → (W2, W3 in parallel) → W4 → W5. W1 unblocks everything (the output shape);
W5 validates the whole. W4 can land any time before M3 needs it but is cleanest
right after W1 (it touches the sheet/effect path).

## 5. Testing (TDD — mandatory)

- Unit tests per workstream (adapter output, registry, annotate, combine modes,
  permanent expiry, watchdog).
- Purity + confinement tests (W3).
- **Parity harness** in `make test` (W5) — the acceptance gate.
- `make test` before "done"; never commit on red.

## 6. Risks

- **Adapter mismatch** with what the UI actually reads (esp. planned-item
  legality) → audit `playStore`/`PanelRenderer` first in W1; lean on the parity
  harness.
- **Scenario coverage gap**: many scenarios need groups not yet ported → explicit
  skip-list with counts; not a failure, just bounded M1 coverage.
- **combine/identity design** (W4) → prototype against the `hp-modifier-no-stacking`
  scenario before committing to latest-wins vs replace-by-identity.

## 7. Definition of done (M1)

- `evaluate(input): EngineOutput` emits the existing contract; adapter unit-tested.
- Registry + `annotate` working; `divine-smite` annotation parity.
- Lint confinement + purity + watchdog in place and in CI.
- Effect `combine`/`permanent` supported (engine-level), with tests.
- Parity harness in `make test`, green over the ported-group scenario subset
  (with a documented skip-list).
- App still 100% on v1; everything additive. `make test` green.

## 8. Out of scope (later milestones)

- **M2**: gated-M2 delivery (CI precompile → chunks + metadata, lazy load).
- **M3**: port all rule groups to full parity (incl. the 3 deferred module-parity
  items: replacement-effect rules / HP modifiers, Divine Smite prepare path, full
  attack UI descriptors; retire the Python `rule_preprocessor`).
- **M4**: runtime flip behind a flag + decommission v1.

## 9. Guardrails (inherited — see CLAUDE.md)

TDD for every change; i18n keys for all user-facing strings; never run
`terraform` directly (make targets); never commit on red / to `main`; keep the
rules-engine ↔ UI contract boundary clean. Work on `claude/rules-engine-v2-m1`;
its PR targets `claude/epic-dijkstra-lxyaep` (no auto-merge).
