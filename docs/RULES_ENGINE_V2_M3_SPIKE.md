# Rules Engine v2 — pre-M3 Divine Favour spike

A second, deliberately-chosen STOP-gate spike before committing to the M3 port.
M0 proved the engine on **Divine Smite** (slot cascade + free-use + upcast +
illegal-but-visible). Divine Smite is a _reactive, single-shot_ rider, so it
barely touches the **effect-lifetime** model. Divine Favour is the opposite — a
**1-minute self-buff** — so it stresses exactly the part M3 leans on hardest:
persistent effects that age across turns. Porting it now, before porting
_everything_, is the cheap place to discover a model gap.

- Module: [`src/lib/rules-engine-v2/rules/divine-favour.ts`](../src/lib/rules-engine-v2/rules/divine-favour.ts) (~158 lines, vs the v1 group's 386)
- Test: [`tests/unit/rules-engine-v2/divine-favour.test.ts`](../tests/unit/rules-engine-v2/divine-favour.test.ts) (16 cases)
- Registered in `registry.ts` + `lazy.ts`; code-splits into its own chunk (`make verify-chunks` → 9 modules / 9 chunks).

## What it proves (the whole contract in one rule)

| Contract surface             | Divine Favour exercise                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Structural `when` gate       | cast offer hidden until `spell.l1.divineFavour.prepared == 1`                                                            |
| Illegal-but-visible offer    | the free "use" rider has **no** `when` (matches v1) — always shown, gated by `legalWhen`                                 |
| Derived dataflow             | `divineFavour.eligibleSlotsRemaining` ← `spellcasting.slots.level1.remaining`                                            |
| **Three effect lifetimes**   | one `apply` advertises a per-turn cost (`endOfTurn`), a spent slot (`untilLongRest`), and the buff (`turns: 10`)         |
| Same-turn effect visibility  | the buff lights `divineFavour.active` the same turn (the fold re-derives), so `attack → cast → use` is legal in one plan |
| Replace-by-key (no stacking) | the buff is keyed → re-cast refreshes duration; the slot is unkeyed → spends stack                                       |
| Cross-turn aging             | `endTurn` resets the cost, keeps the slot, decrements the buff; buff drops after its 10th round                          |
| Annotation                   | `+1d4 radiant available` on `attack.weapon` only while active                                                            |
| i18n / a11y / CSS law        | reuses existing `rule.spell-divine-favour.*` keys; no new strings, no UI/colour changes                                  |

Verdict: **the paradigm holds.** A genuine duration buff ports faithfully and
concisely with no new engine concepts.

## Findings

### 1. HEADLINE GAP — duration **and** rest cancellation (RESOLVED in M3 step 0)

A 1-minute spell ends when **either** its duration elapses **or** the caster
takes a rest. v1 encodes this by re-advertising the buff effect only
`when rest.short == 0 && rest.long == 0`, so any rest cancels it.

The v2 `Expiry` union is **single-predicate**:

```ts
type Expiry =
  | { kind: 'untilLongRest' }
  | { kind: 'endOfTurn' }
  | { kind: 'turns'; remaining: number }
  | { kind: 'permanent' };
```

There is no way to say "count down N turns **and also** end on a rest", and
`endTurn` models only a **long** rest (no short rest at all). So the spike's
`turns: 10` buff is a faithful port of the _duration_ but **not** of the
rest-cancellation.

**Resolution (M3 step 0, landed):** expiry is now a **set of conditions — the
effect ends when the earliest fires** (`ExpirySpec = Expiry | Expiry[]`), with a
new `untilShortRest` condition (a long rest grants a short rest's benefits too,
so it ends on either) and a `shortRest` option on `endTurn`. Divine Favour's buff
is now `expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]`,
and the test asserts the buff ends on a short **or** long rest before its
duration. A single condition stays a single object (no array churn), so all prior
effects are unchanged, and `endTurn` remains a pure fold. See `effects.ts` /
`types.ts` and the `v2 endTurn — short rest + multi-predicate expiry` tests.

### 2. Effect-only facts are **absent** (not `0`) when no effect contributes

`divineFavour.active` has no `derive` defaulting it to `0` (matching v1) — it is
contributed solely by the buff effect's `state`. Once the buff ages out, nothing
writes the fact, so the **raw facts map lacks the key**. The engine's
`FactReader.num()` reads it as `0` (which is how this module's own
`legalWhen`/`annotate` correctly see "inactive"), but a consumer indexing the raw
map (`facts['divineFavour.active']`) gets `undefined`. **Convention for the
UI/adapter (M4): always read through the reader semantics, never raw-index.**
Worth stating in the authoring guide; no engine change required.

### 3. Per-spell parity scenarios can't run standalone yet

The `divine-favour` yaml scenarios stay **skipped** in the parity harness because
they are _full-character_ tests that pull in unported foundational groups
(`proficiency`, `free-actions`, `core-events`, `species-human`). So parity
coverage for a single ported spell only lights up once M3 ports the common
foundation. Until then, **per-rule unit tests are the right interim granularity**
(the 16-case test _is_ this spike's contract check); the yaml oracle catches up in
bulk as the foundation lands. This argues for M3's stated dependency order
(core stats → action economy → attacks → spells) so scenarios unlock in waves.

## Status

Spike complete, verdict **GO**; all checks green (full vitest suite, parity
harness, `pnpm lint` incl. confinement, `verify-chunks`; svelte-check clean for
the new files). On branch `claude/rules-engine-v2-m3`. Finding 1 (the
expiry-model change) is **approved and landed** as M3 step 0; M3 proper proceeds
per the plan in [RULES_ENGINE_V2_M3_PLAN.md](RULES_ENGINE_V2_M3_PLAN.md).
