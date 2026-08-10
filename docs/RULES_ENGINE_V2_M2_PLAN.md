# Rules Engine v2 — M2 Plan (gated delivery pipeline)

> Status: **code core done; infra staged** (2026-06-26). Delivery decision:
> **co-bundled lazy chunks** (A). **W1–W3 complete + unit-tested** on this branch
> (serializable input, metadata extraction, lazy loading + version gate). **W4–W6
> are env-gated** (DynamoDB sync, deploy, end-to-end) and cannot be run in this
> sandbox — staged for CI / a writable test env (see §5). Follows M1 (complete).
> Branch: `claude/rules-engine-v2-m2`, stacked on and PR'd into
> `claude/rules-engine-v2-m1` (not `main`). **Do not auto-merge.**
>
> | WS  | Scope                                           | Status                                                         |
> | --- | ----------------------------------------------- | -------------------------------------------------------------- |
> | W1  | serializable `EngineInput` (#355 carry-over)    | ✅                                                             |
> | W2  | module `meta` + metadata extraction             | ✅                                                             |
> | W3  | lazy chunk loading + `engineApiVersion` gate    | ✅                                                             |
> | W4  | metadata → search-index transform / emit + sync | ✅ transform (tested) · ⏳ emit + DynamoDB sync (env)          |
> | W5  | co-bundled chunk-splitting / ship to S3+CDN     | ✅ splitting verified (`make verify-chunks`) · ⏳ deploy (env) |
> | W6  | end-to-end proof in the test env                | ⏳ needs env (+ M4 app-wiring to consume v2)                   |

## 1. Goal

Deliver rule **logic** as precompiled JS chunks loaded **lazily per character by
id**, with rule **metadata** published to the existing search index, behind an
`engineApiVersion` compatibility check — same-origin, infra via make targets.

Still additive: the app keeps running v1. M2's job is to prove the **delivery
mechanism** end-to-end in the test env for at least one group, **without changing
search behaviour**. It does not port rules (M3) or flip the runtime (M4).

## 2. What M1 already gives us

- A registry (`ruleGroupId → module`) with `resolveModules` — a static map today.
- `evaluate()` pure; modules are plain data + pure functions; lint/confinement
  keeps each module sandboxable and side-effect free.
- The parity harness for regression safety as we change how modules load.

So M2 changes **how modules are discovered, built, shipped, and loaded** — not
what they compute.

## 3. The one delivery decision (please confirm before W3/W5)

How rule chunks are built and served. This shapes all the infra:

- **(A) Co-bundled lazy chunks — _recommended._** Modules stay in the app repo;
  Vite `import.meta.glob('./rules/*.ts')` code-splits each into its own chunk,
  shipped to the **existing** S3/CloudFront as ordinary app assets; the client
  lazy-`import()`s a character's assigned chunks by id. **Little/no new
  terraform.** Trade-off: adding/changing a rule needs an app redeploy — which is
  already how rules ship (in-repo, via PR + CI), so the cost is near zero.
- **(B) Separate chunk bucket.** A dedicated build uploads chunks to a separate
  bucket / CloudFront `/rules/` path, deployable independently of the app.
  Enables rule changes without an app redeploy. Trade-off: new terraform (bucket,
  CloudFront behaviour, cache + content-hash versioning), a chunk manifest, and
  explicit version-skew handling — materially more infra and risk.

Recommendation: **A**. It satisfies M2's exit criterion (lazy per-character chunk
load + search unchanged) with far less infra, and matches the master plan's
pre-flagged "co-bundled, simplest with Vite splitting / reuse the app's
S3/CloudFront" option. B's independent-deploy benefit is marginal while rules
live in-repo. The plan below assumes A; the deltas for B are noted in W5.

## 4. Workstreams

### W1 — Serializable engine input (carry-over from #355) · _fully testable here_

Add `ruleGroupIds` to `EngineInput`; `evaluate` resolves them via the registry so
`next` is JSON-replayable (not just in-memory). Keep the resolved-`modules` path
working for tests/the harness. Fork-independent — the clean place to start. TDD.

### W2 — Module metadata + the `meta` builder field · _fully testable here_

Add `meta: { name, description, keywords, requires?, settings? }` to the builder
API and the 8 modules (i18n keys for `name`/`description` — no hardcoded strings).
A build step extracts a metadata index JSON from the modules. This is the only
data search needs; logic stays in the chunk.

### W3 — Lazy chunk registry + version gate · _mostly testable here_

Add an async loader (`loadModules(ids): Promise<RuleModule[]>`) backed by an
explicit per-id dynamic `import()` map (cleaner typing than `import.meta.glob`;
Vite still code-splits each into its own chunk — verified by `make
verify-chunks`). `evaluate` stays sync/pure — loading happens **before** it. Add
`ENGINE_API_VERSION`; stamp it in the metadata; the client refuses/falls back on
mismatch. Keep the static `resolveModules` for the parity harness (sync).

### W4 — Publish metadata to the search index · _split: build here, sync needs the env_

Feed the W2 metadata JSON into the existing `/api/rule-groups` index via the
`sync-rule-groups` path, alongside the current YAML-sourced entries (they must
coexist during the M3 partial port). The extraction/transform is testable here;
the DynamoDB write runs through `make sync-rule-groups` / the test env.

### W5 — Infra + CI · _authored here, verified in CI/AWS_

Option A: ensure rule chunks ship to the existing S3/CloudFront with the normal
app build/deploy; CI builds them as part of the deploy. Little/no terraform.
Option B (if chosen): terraform for the chunk bucket + CloudFront `/rules/`
behaviour + a manifest, all via `make setup-*` / `make deploy-test`.

### W6 — End-to-end proof in the test env · _exit criterion; needs deploy_

`make deploy-test`; confirm a character loads a rule chunk lazily by id and
search still works.

## 5. Verification boundary (important — read this)

This sandbox has **no terraform CLI** and only a **read-only AWS profile**
(`dnd-planner-ro`). So:

- **Built + tested here:** W1, W2, W3, and the extraction half of W4.
- **Authored here, verified by you / CI:** the terraform + deploy in W5, the
  DynamoDB sync in W4, and the whole of W6 (`make validate` / `make deploy-test`
  need a writable env). I will not run `terraform` directly (make targets only),
  and cannot run them at all here — they are the CI/test-env sign-off.

So M2 will land **code-complete and unit-tested** on this branch, with the
infra/deploy steps staged for a writable environment. I'll call that out
explicitly rather than claim an end-to-end pass I can't run.

## 6. Guardrails (inherited — see CLAUDE.md)

TDD for every change; **never run `terraform` directly** (make targets only);
i18n keys for all `meta` name/description text; never commit on red / to `main`;
keep the rules-engine ↔ UI contract boundary clean; search endpoint behaviour
unchanged. Work on `claude/rules-engine-v2-m2`; its PR targets
`claude/rules-engine-v2-m1` (no auto-merge).

## 7. Out of scope

- **M3** — port all rule groups to full parity (the deferred module-parity items).
- **M4** — runtime flip behind a flag + the UI/persistence contract adapter
  (the #355 review cluster) + decommission v1.
