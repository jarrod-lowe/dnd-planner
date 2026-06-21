# Rules Engine v2 — Implementation Plan

> Status: **DRAFT for review.** This is a planning artifact, not yet executed.
> Milestone **M0 is a spike with a built-in STOP gate** — it may end in No-Go by
> design (see the "if a plan won't work, STOP" critical rule).

## 1. Goal & the one invariant

Replace the data-as-imperative-interpreter engine with a **functional core**
(dataflow sheet + reducer plan + declarative effects), authored as
**lint-confined TS builder-API modules**, delivered via **gated-M2**
(CI-precompiled chunks, metadata-indexed search, lazy per-character code
loading).

**Non-negotiable invariant:** `evaluate(input) → EngineOutput` stays a **pure
function** and the **output shape the UI consumes is unchanged**. That
mechanically preserves the three strengths we value:

- **What-if reprocessing** — purity keeps `playStore`'s N+1 re-run valid (and now
  memoizable).
- **Illegal-but-visible** — offers still carry `legal` + `diagnostics`, computed
  against post-plan state.
- **Related-info** — `annotate()` still emits `Annotation{key,targets,rider}`;
  `PanelRenderer` matching untouched.

## 2. Why this exists — the four pains and how v2 kills them

The v1 engine is a tree-walking interpreter for a little imperative language
encoded as JSON/YAML. It pays both the rigidity of data (no abstraction → 12k
line `spell-find-steed.yaml`) and the hazards of imperative mutation (manual
ordering, snapshot activities). It also conflates two different computational
shapes — the derived character sheet (pure dataflow) and the turn plan (an
ordered fold over actions) — forcing both through one "mutate facts in phases"
pipe.

| Pain               | v1 mechanism                                                                      | v2 mechanism                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Ordering fragility | manual `phase`/`group`/`after`; vestigial unused `_auto` scaffolding              | **dataflow**: a contribution declares the fact it writes + the facts it reads; the engine topo-sorts. No phases, no `after`.             |
| Effects/timing     | snapshots (`attackAction.wasExtra`), `advertiseEffect self:true` re-advertisement | **reducer fold** (later actions see earlier state by definition) + **declarative effects** (value + expiry predicate; engine ages them). |
| Repetition         | `spell-find-steed.yaml` 12,324 lines; hand-unrolled L5→L1 cascades                | **TS abstraction** — loops/functions/params.                                                                                             |
| Author complexity  | one decision → many sequential conditional activities                             | rule **returns data**; one logical decision = one function.                                                                              |

## 3. Target architecture

### Rule module (authored in repo — the single source of truth)

```ts
export default defineRule({
  id: 'spell-divine-smite',
  meta: { name, description, keywords, requires, settings }, // → search index (metadata only)
  derive?(ctx): Contribution[];            // SHEET: declarative fact contributions (combine: sum|max|override)
  offer?(ctx): Offer[];                    // → availableRules: { id, ui, vars, legalWhen }
  apply?(state, selections): ActionResult; // PLAN: pure transition when this offer is planned
  effects?(ctx): EffectSpec[];             // declarative persistence: { state, expiry: untilLongRest|endOfTurn|conc }
  annotate?(ctx): Annotation[];            // related-info surfacing
});
```

- `ctx` is the **only** input (read-only facts + resolved selections). Rules
  **return data**; they never mutate working state.
- `ui` / `vars` / `meta` stay plain data, so search, `extractPanelDescriptor`,
  and i18n keys all keep working unchanged.

### Engine passes (all pure)

1. Load assigned modules from the registry.
2. **Sheet** — topo-sort `derive` contributions by fact-reference; combine
   multiple writers per declared mode (`sum`/`max`/`override`).
3. **Plan** — fold `apply` over the ordered planned refs (left fold ⇒ later
   actions see earlier results; no snapshots).
4. **Offer + annotate** — evaluate `offer`/`annotate` against post-plan state;
   produce `availableRules` (with `legal`/`diagnostics`) and `annotations`.
5. **Age effects** — apply each effect's expiry predicate.
6. Build the existing `EngineOutput`.

### Contract impact (strict subset on output)

- `availableRules[].rule` keeps `{ id, ui, vars, description }` (what the UI
  reads) and drops `activities` (now in code). **To confirm in M0:**
  `extractPanelDescriptor` reads only `ui`/`vars`, never `activities`.
- **Input/persistence change:** planned items and effects serialize as refs
  `{ ruleId, selections, state }` instead of full rule objects — smaller and
  cleaner than today's self-replicating effect trees.

### Gated-M2 delivery pipeline

- Author module → **CI precompile** (esbuild/Vite lib build) → emit:
  - **metadata** → DynamoDB search index (existing `/api/rule-groups?q=`
    endpoint and `standardize_term` keyword indexing **unchanged**);
  - **code chunk** → same-origin S3/CloudFront.
- Client: search hits the index; at play time, lazy-`import()` assigned chunks by
  id, guarded by an `engineApiVersion` compat check.
- Discovery never preloads everything: search is already a two-stage,
  metadata-only, server-indexed flow (`/api/rule-groups?q=` → ids →
  metadata-for-matches). Only rule **logic** moves off the API, and it loads
  lazily per character.

## 4. Guardrails this plan inherits (from CLAUDE.md — kept per the "add to plans" rule)

- **TDD for every change** — engine pieces and each ported module are test-first.
- **Never run `terraform` directly** — M2 infra via `make setup-*` /
  `make deploy-test` targets only.
- **i18n** — all user-facing strings stay i18n keys (names, descriptions,
  diagnostics); no hardcoded text in modules.
- **A11y / CSS law** — output contract held identical ⇒ UI largely untouched; any
  incidental UI edits use existing theme variables + semantic HTML.
- **Git** — work on `claude/epic-dijkstra-lxyaep`; never commit on red; never
  commit to `main`; no PR unless explicitly asked; `make test` before "done".
- **No new processing phases** — v2 _removes_ phases in favour of inferred
  dataflow, consistent with "use dependencies, don't split phases further".
- **The rules engine handles rules; the UI handles the interface** — keep the
  clean contract boundary.

## 5. Migration strategy — strangler via the scenario oracle

The **`tests/integration/rules-engine/yaml-scenarios` runner is the acceptance
suite**: it asserts on output (`facts` / `offers{legal}` / `effects` /
`annotations` / `status` / `planErrors`), not on mechanism. So:

1. Build v2 behind the same `evaluate` signature.
2. **Parity harness** — run _every_ existing scenario on **both** engines
   (old ← YAML data, new ← modules); assert identical output. Wired into
   `make test`.
3. Re-author rule groups as modules **in the new paradigm** (not auto-translated
   — that would carry the warts), proving each via its existing scenarios. Add
   new scenarios where the rewrite clarifies behavior.
4. **Runtime flip is single, all-at-once.** Engines can't be mixed per character
   (rule groups share facts), so cutover is gated on the **full** scenario suite
   passing on v2, behind a feature flag for rollback. All YAML + the old
   interpreter are deleted in the final cutover.

## 6. Milestones

| #      | Milestone                                                                                                                                                                                                                                                                    | Exit criteria                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **M0** | **Spike / STOP-gate.** Engine core (sheet + reducer + effects) just enough to re-author the _hardest_ cases — `hp` / `ability-scores` (pure dataflow) and `divine-smite` (cascade + free-use + persistence + upcast dice + illegal-but-visible). Finalize builder-API types. | Both groups' existing scenarios pass identically via the parity harness; smite is ~dozens of lines. **Go / No-Go decision.** |
| **M1** | **Engine core + builder API + contract adapter.** Registry; the engine passes; effect aging; `EngineOutput` producer; ESLint confinement (`no-restricted-globals` / `-imports`); purity + termination watchdog. Unit tests (TDD).                                            | Engine unit-tested; parity harness in `make test`; lint blocks banned globals/imports.                                       |
| **M2** | **Gated-M2 pipeline (infra).** CI precompile → chunks + metadata; `sync-rule-groups` publishes metadata from modules; chunk upload to S3/CDN; client lazy-load by id + version check. Terraform via make targets. Search endpoint unchanged.                                 | A new group loads end-to-end in the test env via a lazy chunk; search still works.                                           |
| **M3** | **Port all rule groups** (dependency order: core stats → action economy / movement → attacks → spells → weapons [+ retire the Python `rule_preprocessor`]).                                                                                                                  | 100% of existing scenarios green on v2; new scenarios added.                                                                 |
| **M4** | **Cutover & decommission.** Flip the feature flag; migrate persisted effects to ref format; delete old engine / activities / `_auto` / phases / YAML; rewrite `RULES_ENGINE.md` + the authoring guide; update CLAUDE.md pointers.                                            | v2 in the test env; `make test` green; docs updated; old code removed.                                                       |

## 7. Testing

- **TDD** unit tests for the builder API + each engine pass.
- **Parity harness** (the oracle) — both engines, identical output, every
  scenario.
- **Purity test** — run each module twice; assert identical output.
- **Confinement test** — assert no module references banned globals/imports
  (belt-and-suspenders over ESLint).
- `make test` gates every commit; `make sync-rule-groups` / `make deploy-test`
  for the test env.

## 8. Risks & mitigations

- **Paradigm doesn't fit a rule (the STOP rule):** M0 spikes the worst case
  _first_; No-Go is a real option before further commitment.
- **Big-bang runtime flip:** full parity suite as acceptance + feature-flag
  rollback.
- **Persisted-effects migration:** one-time ref converter; **confirm whether prod
  has live character effect blobs or the test env can be reset.**
- **M2 version skew:** `engineApiVersion` per chunk + client compat check; chunks
  and metadata published from the same commit.
- **Termination undecidable:** ESLint-ban `while(true)` / `for(;;)` + runtime
  watchdog + design loops out (return data via bounded combinators).
- **Weapons preprocessor:** re-author weapons as modules (retire or retarget
  `scripts/rule_preprocessor`) — tracked in M3.

## 9. Decisions to confirm during M0 (not blockers now)

- Module location: `src/lib/rules/` (co-bundled, simplest with Vite splitting)
  vs a separate package.
- Content delivery: reuse the app's S3/CloudFront under a `/rules/` path vs a
  dedicated bucket.
- Effects migration: convert vs reset (depends on prod state).

## 10. Immediate next step

Start **M0**: stand up the engine skeleton + builder-API types and re-author
`hp` / `ability-scores` and `divine-smite`, validated against their current
scenarios via the parity harness — i.e. prove the hardest case before building
anything else.
