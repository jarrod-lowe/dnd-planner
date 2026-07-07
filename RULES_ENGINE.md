# D&D Rules Engine (v2)

## Purpose

This document specifies the v2 rules engine: its input/output contract, its
evaluation model, and its delivery mechanism. The engine lives in
`src/lib/rules-engine-v2/`; rules are TypeScript **modules**, not data.

For a practical "how do I add a rule group" walkthrough, see
[docs/RULE_GROUP_GUIDE.md](docs/RULE_GROUP_GUIDE.md).

---

## Design summary

The engine is a single **pure, synchronous function**:

```ts
evaluate(input: EngineInput, opts?: EvaluateOptions): EngineOutput;
```

Same input → same output. No hidden state, no I/O, no clock (a wall-clock
watchdog bounds pathological inputs but never fires on real ones). It composes
four passes:

```plain
sheet(committed effects)            — derive the character sheet
→ plan fold                         — apply planned actions in player order,
                                      re-deriving the sheet with effects-so-far
→ offers(final facts)               — the action catalog, judged post-plan
→ annotate(final facts)             — related-info chips (riders)
```

Three ideas carry the whole design:

1. **The sheet is a dataflow.** Modules declare _contributions_ to facts as
   pure functions of other facts. The engine discovers dependencies by
   tracking reads and settles facts in dependency order. **There is no
   authored ordering** — no phases, no groups, no `after`. Registration order
   never matters; cycles and writer conflicts are errors.

2. **The plan is a left fold.** Planned actions execute strictly in player
   order. Before each step the sheet is re-derived with all effects advertised
   so far, so every action sees the real current state (a second attack sees
   the first one's spent action).

3. **State changes are effects, not mutations.** An action's `apply` never
   writes facts; it _advertises_ `EffectInstance`s — serializable values that
   contribute fact deltas while they live and age out at end of turn. The
   committed-effects list **is** the persisted character state.

---

## Input contract

```ts
interface EngineInput {
  modules: RuleModule[]; // the rule modules to evaluate
  ruleGroupIds?: string[]; // provenance: ids the modules were resolved from
  inputFacts?: Facts; // pre-settled source facts (see contract below)
  planned?: PlannedRef[]; // this turn's plan, in player order
  committed?: EffectInstance[]; // persistent effects already in force
}

interface PlannedRef {
  instanceId: string; // unique per plan row
  ruleId: string; // the offer id being executed
  selections?: Record<string, unknown>; // panel control values
}
```

`evaluate` runs `modules` directly and never touches the registry, so it stays
pure and does not eagerly bundle every module. Modules carry functions and do
not survive JSON — persistence uses the **serializable projection**:

```ts
interface SerializableInput {
  ruleGroupIds: string[]; // replaces `modules`
  inputFacts?: Facts;
  planned?: PlannedRef[];
  committed?: EffectInstance[];
}
```

`serializeInput` projects an input down; `resolveInput` (sync, eager registry)
or `loadModules` (async, lazy chunks) rehydrates it. Unresolvable ids are
returned in `missing` — surfaced, never silently dropped.

### The input-facts contract

`inputFacts` are **pre-settled sources with no contributor** (at runtime the
store passes `{}`; tests use them for genuine inputs such as raw ability
scores). A fact that is both an input and a contribution target would silently
lose the input, so the sheet **throws** on the overlap, naming the fact and its
writers. Model the base value as a module contribution or an effect instead.

---

## The module contract

```ts
interface RuleModule {
  id: string; // canonical rule-group id (backend-wide)
  meta?: RuleMeta; // search/discovery metadata (i18n keys)
  derive?: (ctx: SheetCtx) => Contribution[];
  offer?: (ctx: SheetCtx) => Offer[];
  effectContributions?: (effect: EffectInstance) => Contribution[];
  annotate?: (f: FactReader) => Annotation[];
  onRest?: (kind: RestKind, facts: FactReader) => EffectInstance[];
}
```

Modules must be **deterministic, stateless functions of their facts** (the
purity test evaluates every registered module twice and diffs the snapshots).
All user-facing text is i18n keys (`rule.*`), never literal strings.

### `derive` — sheet contributions

```ts
interface Contribution {
  fact: string;
  combine?: 'sum' | 'max' | 'override'; // default: override
  value: (f: FactReader) => number;
}
```

- `sum`: additive modifiers (HP from many class levels).
- `max`: competing floors (unarmored AC variants, always-prepared grants).
- `override`: single authoritative writer — two override writers to the same
  fact is an error, as is mixing combine modes on one fact.

`FactReader.num()` reads an unset fact as `0` (v1 parity); `has()`
distinguishes unset from explicit 0. Dependency discovery is **pull-based**:
the engine records what each `value` actually reads (including reads behind
conditionals), so consumers settle after all of their producers' contributions
— the v1 "two-group copy-after-settle dance" is free.

### `offer` — the action catalog

```ts
interface Offer {
  id: string;
  ui?: OfferUI; // plain data for PanelRenderer (name, section, intents, …)
  vars?: Record<string, unknown>; // panel control variable definitions
  when?: (f: FactReader) => boolean; // structural gate
  legalWhen?: LegalWhen[]; // legality gates
  apply?: (f: FactReader, selections) => ActionResult;
}
```

Two distinct gates, matching v1 semantics:

- **`when` (structural)**: false → the offer is **omitted** from the catalog
  entirely (e.g. Divine Smite is only offered while prepared). The plan fold
  re-checks it per step: a planned action whose `when` no longer holds is
  **skipped** — no execution, no resource spend — and its plan row renders as
  inapplicable.
- **`legalWhen` (legality)**: false → the offer stays **visible but illegal**,
  with diagnostics attached (illegal-but-visible). Planned illegal actions
  still execute — the projection shows the over-commit (e.g.
  `actions.remaining: -1`) and the row shows the diagnostic.

`apply` is the pure transition run when the offer is planned:

```ts
interface ActionResult {
  advertise?: EffectInstance[]; // the ONLY way an action changes state
  diagnostics?: Diagnostic[]; // per-instance legality of THIS execution
}
```

### `effectContributions` — parameterized effects

By default an effect's `state` is read as fact deltas. When a contribution
must be computed (not a constant delta), the owning module (matched by the
effect's `ruleId`) provides it. Used sparingly.

### `annotate` — related info

A pure function of the **final post-plan facts** returning annotations
(`{ key, targets, rider? }`). The UI matches `targets` against panel
`annotationLabels` — e.g. Divine Smite's "+Nd8 radiant" rider on melee attack
panels while the smite is usable.

### `onRest` — passive rest recoveries

Runs after the plan settles when a rest was recorded this turn; returns
effects folded into the same evaluation and committed at end of turn. This is
the **only** way a non-planned module emits effects. It exists for recoveries
that can't be expressed as expiry aging (Channel Divinity regains exactly one
use on a short rest; a Human regains Heroic Inspiration on a long rest). Emit
**keyed** effects so a second rest doesn't stack the grant.

---

## The effects model

```ts
interface EffectInstance {
  id: string;
  ruleId?: string; // owning module, for effectContributions
  key?: string; // logical identity: same key → newest evicts oldest
  state?: Record<string, number>; // fact deltas while active (sum by default)
  stateCombine?: Record<string, CombineMode>; // per-fact override (max/override)
  display?: EffectDisplay; // UI chip metadata (inert to the engine)
  expiry: ExpirySpec;
}
```

- **Keys**: effects sharing a `key` do not stack — the newest replaces the
  oldest, both in the sheet and at commit. Re-applying a modifier (set Max HP
  +5, then +10) replaces; an empty same-key effect _removes_ (this is how
  unprepare works). Keyless effects (ordinary per-turn spends) never dedupe.
- **Expiry** is one condition or an array (ends on the **earliest** to fire):
  `permanent`, `endOfTurn`, `untilShortRest`, `untilLongRest`,
  `turns { remaining, total? }`. A 10-round buff that also ends on a rest is
  `[{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]`. Authors
  write only `remaining`; the first end-of-turn aging backfills `total` so the
  UI can render elapsed-vs-remaining pips.
- **Display contract**: `display` present → shown on the active-effects strip
  (`display.hidden: true` → named but only in the "show hidden" reveal); no
  `display` at all → hidden **and** nameless — reserve that for pure
  bookkeeping. Concentration markers always show. `display.section` is
  confined to the `SECTIONS` union; `display.subject` (e.g. `'steed'`) drives
  the companion subject views.

### End of turn

`endTurn(committed, advertised, { longRest?, shortRest? })` merges the turn's
advertised effects into the committed set (keyed dedupe, newest wins), ages
every expiry (turns decrement, `endOfTurn` drops, rest-scoped effects drop on
their rest — a long rest satisfies `untilShortRest` too), and returns the next
committed set, which the store persists. Rests recorded via core-events'
recorder effects (`rest.long` / `rest.short` facts) apply **within the same
evaluation**: the sheet already excludes effects the rest ends, so resources
read as restored immediately.

---

## Output contract

```ts
interface EngineOutput {
  status: { ok; legal; applicable }; // legal = no plan-step error diagnostics
  facts: Facts; // projected post-plan facts
  availableRules: AvailableRuleEntry[]; // the offer catalog, judged post-plan
  planDiagnostics: Record<string, Diagnostic[]>; // per plan-instance legality
  annotations: Annotation[];
  effects: EffectInstance[]; // this turn's advertised effects
  diagnostics: { errors; warnings; notices }; // engine-level problems
  next: EngineInput; // echo for replay (serializeInput → JSON-safe)
}
```

- `availableRules` entries are `{ rule: { id, ui, vars }, legal, applicable,
diagnostics }` — offers judged against the **post-plan** facts, so the
  catalog reflects what you could _still_ do.
- `planDiagnostics` is keyed by plan `instanceId`; per-instance legality comes
  from the fold (each step judged against the state it actually executed in).
- Engine throws (dependency cycles, combine conflicts, input-fact overlap,
  watchdog timeout) are caught by the play store, which keeps the previous
  output and surfaces `play.error.engineCycle` / `play.error.evaluate` in the
  error banner — a bad module degrades, it does not blank the screen.

### The UI bridge

The UI consumes the v1-era view contract (`$lib/rules-engine` is now a
**types-only package**). `src/lib/play/v2Bridge.ts` adapts v2 output to it:
committed `EffectInstance`s become effect `Rule`s for the strip (display →
`ui.name`/`section`/`subject`, turns expiry → `ui.countDown`/`ui.duration`
pips), and `EngineOutput` becomes the store's v1 shape. Offer `ui`/`vars`
payloads pass through untouched — PanelRenderer reads them directly.

---

## Delivery

- **Static registry** (`registry.ts`): eager id → module map, keyed by each
  module's `id`, which is the **canonical rule-group id** used backend-wide
  (DynamoDB `ruleGroupId`, `requires`, persisted assignments, search index).
  Used by tests and the sync parity harness.
- **Lazy chunks** (`lazy.ts`): the runtime path. Each module is a dynamic
  `import()` Vite code-splits into its own chunk (verified by
  `make verify-chunks`); a character loads only its assigned groups' chunks.
  `loadModules(ids, builtForVersion)` gates each chunk on
  `engineApiVersion` compatibility (`version.ts`) before fetching.
- **Metadata** (`metadata.ts`): modules with `meta` (user-facing content
  groups) expose `{ name, description, keywords }` **i18n keys** plus
  `requires`; `buildModuleRuleGroups` resolves them against the locale
  dictionaries into the search-index shape. Foundational modules (hp,
  action-economy, …) carry no `meta` and have no search presence.
- **The YAML data layer** (`data/rule-groups/`): translations, `requires`,
  `settings`, `condition`, and `detail` per rule group — published to DynamoDB
  by `make sync-rule-groups`. It carries **no rules** (the schema rejects
  them); DynamoDB items publish `rules: "[]"` only for API wire-stability.

## Guards

| Guard                                        | Catches                                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `tests/integration/rules-engine/v2-coverage` | a deployed rule group with no v2 module (and stale catalog-only allowlist entries) |
| `tests/unit/i18n/module-i18n-coverage`       | a `rule.*` key referenced by a module with no translation in either locale         |
| `tests/unit/rules-engine-v2/sections.test`   | a section outside the `SECTIONS` union; an intentless offer falling to `HANDLE`    |
| `tests/unit/rules-engine-v2/purity.test`     | a nondeterministic or stateful module                                              |
| yaml-scenarios parity runner                 | behavior drift against the v1 scenario corpus                                      |
| `make validate-rules-schema`                 | YAML metadata drift (including `rules:` sneaking back)                             |
| `make check` (svelte-check, also in CI)      | type drift, including the `Section` union and the module contract                  |
