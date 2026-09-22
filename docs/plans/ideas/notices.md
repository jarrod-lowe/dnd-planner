# Notices

I want to add a new feature - "Notices". These would exist below the "Active states" section, but above "This Turn I Want To...".

This is a space to add things the player needs to know as they play, but are not related to their taken choices, like:

- Sentinel: You can Opportunity Attack Disengaging Enemies (5ft)
- Sentinel: You can Opportunity Attack an enemy who just attacked another creature (5ft)
- Spell X: The target may re-roll the DC 13 WIS save to end the spell at the start of their turn
- Searing Smite: At the start of their turn, the target takes an additional [Xd6] fire damage, then makes a DC xx CON save to end the spell

Things like these would NOT get notices:

- You can attack -- a normal thing the user doesn't need to be reminded of
- Heroic Inspiration -- this follows a choice, so shows as an annotation

Notices might, if appropriate, be clicked to add an item to the plan.

We should keep the notices small (so my text examples above may be too long). It may make sense to use HTML/CSS structures that allow multiple in the same line across possibly multiple rows.

It should be possible to collapse the notices section.

Firstly, we must design this. What would it look like?

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Plan

### Key insight

`annotate` already is passive, fact-derived, not tied to a taken choice. Sentinel already emits all three reminders (`rules/feat-sentinel.ts:14-21`). They never show: annotations only render inside a plan panel whose `ui.annotationLabels` intersects `annotation.targets` (`play/annotations.ts:16`), and Sentinel targets `attack.reaction` — visible only once a reaction row is already planned.

Notices are therefore **not a new engine output**. They are a rendering surface for annotations targeting a reserved label no panel claims.

### Decisions (settled, do not relitigate)

| #                | Decision                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanism        | Reuse `Annotation`. Reserved target `'notice'`. Add optional `source`, `body`, `values` fields. No new hook.                                                                                                      |
| Visibility       | Boolean condition on facts, inside `annotate`. Nothing else.                                                                                                                                                      |
| Targets          | No enemy/target modelling. Notice = reminder rendered from the player's own facts.                                                                                                                                |
| Ordering         | Stable structural engine order. UI does not re-sort. No authored priority.                                                                                                                                        |
| Layout           | **Variant D** — dense two-column grid, one cell per notice, collapses to one column <600px.                                                                                                                       |
| Truncation       | None. Drop the 2-line clamp; cells size to content, `align-items: start`.                                                                                                                                         |
| Text shape       | `source` (eyebrow) + label (existing `key`) + optional `body`.                                                                                                                                                    |
| Section presence | Always present. Header carries a count badge.                                                                                                                                                                     |
| Empty            | Zero notices → section renders **collapsed, count `0`**.                                                                                                                                                          |
| Collapse         | Count drives it on first render only. Manual toggle sticks for the session. In-memory, not persisted (nothing in the app persists UI state; `play/planCollapse.svelte.ts` is the precedent).                      |
| Sentinel         | Drop `attack.reaction`; notice-only. General rule: an annotation MAY carry both.                                                                                                                                  |
| Searing Smite    | Interpolate the DC from `spellcasting.saveDC`. **Never** print dice — `ssmite.burnDice` folds `combine: 'sum'`, so two burns read as one wrong number. Per-target dice live on the effect chip's `display.value`. |
| Click-to-plan    | Deferred. Descriptor shaped so `addsToPlan` slots in later.                                                                                                                                                       |
| Roll affordance  | Deferred. Searing Smite wants a per-round roller; v1 is text.                                                                                                                                                     |
| Locales          | Both `en` and `en-x-tlh`, bodies included. Not the detail-body exception.                                                                                                                                         |

### Critical rules (carried from AGENTS.md)

- **TDD strictly.** RED tests must compile, run, not panic, and fail for the intended reason.
- **NEVER commit while tests fail. NEVER commit to main.** Branch first.
- **All user-facing text through i18n.** Both locales. No hardcoded strings.
- **The CSS Law: invent no colours.** Only existing `--md-sys-color-*` / `base.css` tokens.
- **A11y**: semantic HTML, ARIA, contrast, keyboard.
- **New rules**: read `docs/RULE_GROUP_GUIDE.md` first.
- **No `terraform` directly** — Make targets only.
- Avoid `find -exec`, `$(...)`, redirections, `sed`, `cd DIR; cmd`.
- **Subagents do the work.** Main agent co-ordinates and talks to the human only.

### Traps found during research

- `display: grid/flex` **beats the `hidden` attribute**. Use `{#if}`, not `hidden`.
- Adding a yaml scenario dir grows `runnable` and fails the coverage gate as well as your assert. Add the dir **and** its `EXPECTED_RUNNABLE` entry together, so the only red is the assertion.
- `make check` type-checks test files; **vitest does not**. A type-broken RED test still runs.
- `make test` omits `format-check`. Run it separately before pushing.
- `tests/setup.ts` i18n mock returns the key for unknown keys — use it to prove strings are translated.
- Pre-existing, out of scope: `.active-state-strip__placeholder` uses `--md-sys-color-outline` at 4.04:1, below AA.
- `.play-character__intent-body` gives new siblings no flex rules; add `flex-shrink: 0`.

### Files

| Path                                                    | Change                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/lib/rules-engine/types.ts`                         | `Annotation`: add `source?`, `body?`, `values?`. Export `NOTICE_TARGET = 'notice'`.                    |
| `src/lib/rules-engine/rules/feat-sentinel.ts`           | Targets → `['notice']`; add `source` + `body`.                                                         |
| `src/lib/rules-engine/rules/searing-smite.ts`           | New burn notice in `annotate`, gated on `ssmite.burnDice > 0`, `values.dc` from `spellcasting.saveDC`. |
| `src/lib/play/notices.ts`                               | New. `getNotices(annotations)` — filter by reserved target.                                            |
| `src/lib/components/play/NoticeStrip.svelte`            | New. Grid, header, count, disclosure.                                                                  |
| `src/lib/components/character/PlayCharacterMode.svelte` | Mount between `ActiveStateStrip` and `PlanStack` (~:178).                                              |
| `data/rule-groups/dnd-5e-2024/feat-sentinel.yaml`       | None — plan corrected: translations live in common.json.                                               |
| `data/rule-groups/spells/searing-smite.yaml`            | None — plan corrected: translations live in common.json.                                               |
| `src/lib/i18n/{en,en-x-tlh}/common.json`                | `play.notices.*` chrome keys **and** `rule.*` notice label/body keys (corrected).                      |

## Checklist

### Phase 0 — setup

- [x] Branch off main
- [x] Confirm dev server state (`pgrep -f vite.js`) — not running

### Phase 1 — engine types (RED → GREEN)

- [x] RED: `tests/unit/rules-engine/notice-annotations.test.ts` — an annotation carrying `source`/`body`/`values` survives `evaluate()` intact
- [x] GREEN: extend `Annotation` in `types.ts`; export `NOTICE_TARGET` (also re-exported from rules-engine barrel)
- [x] `make check` (vitest does not type-check) — 0 errors, 6 pre-existing warnings

### Phase 2 — Sentinel notices (RED → GREEN)

- [x] RED: new `tests/unit/rules-engine/feat-sentinel.test.ts` — three annotations, `targets: ['notice']`, each with `source` + `body`
- [x] RED: `yaml-scenarios/sentinel-flag-annotations/test.yaml` — add a `targets:` assert for `['notice']`
- [x] GREEN: rewrite `feat-sentinel.ts` `annotate`
- [x] Translations into both locales — **plan corrected: common.json, not rule-group yaml** (schema rejects non-name/description/keywords keys; `$t` reads only common.json; module-i18n-coverage.test.ts enforces it there)
- [x] Verify no other test asserted `attack.reaction` on Sentinel — one collateral fix: `annotation-targets.test.ts` exempts `NOTICE_TARGET` from the panel-orphan check (no panel carries it by design)

### Phase 3 — Searing Smite notice (RED → GREEN)

- [x] RED: extend `tests/unit/rules-engine/searing-smite.test.ts` — with a committed burn, notice exists; `values.dc` equals `spellcasting.saveDC`; body key contains no dice
- [x] RED: new `yaml-scenarios/searing-smite-burning-notice/test.yaml` **plus** its `EXPECTED_RUNNABLE` entry, same commit
- [x] GREEN: add the notice to `searing-smite.ts` `annotate` — `values: { dc }` from `spellcasting.saveDC`, gate `burnDice > 0`
- [x] Translations into both common.json locales under `rule.spell-searing-smite.*` (plan-corrected placement)
- [x] Confirm: no notice when `ssmite.burnDice === 0`

### Phase 4 — selector (RED → GREEN)

- [x] Stub `src/lib/play/notices.ts` so the test compiles
- [x] RED: `tests/unit/lib/play/notices.test.ts` — filters by reserved target; preserves engine order; ignores panel-targeted annotations
- [x] GREEN: implement `getNotices` — `(annotations: Annotation[]) => Annotation[]`, filter on `NOTICE_TARGET`

### Phase 5 — component (RED → GREEN)

- [x] Stub `NoticeStrip.svelte` so tests compile
- [x] RED: `tests/unit/lib/components/play/NoticeStrip.test.ts` — 11 tests, all failing for intended reasons
  - [x] renders one cell per notice, source + label + body
  - [x] header count matches notice count
  - [x] zero notices → rendered, collapsed, count `0`
  - [x] non-zero → expanded on first render
  - [x] manual collapse survives a notice arriving — count drives collapse on first render only
  - [x] disclosure is a `<button>` with correct `aria-expanded`
  - [x] body text is not clamped/truncated
  - [x] all strings resolve via `$t` (setup.ts mock returns raw keys)
- [x] GREEN: implement. `{#if}` not `hidden`. Two-column grid, one column <600px, `align-items: start`
- [x] CSS: existing tokens only. Reuse the `.source` eyebrow vocabulary from the mockup
- [x] `play.notices.*` keys into both locale files (title/count/expand/collapse/placeholder; expand+collapse carry {{count}} for a11y)

### Phase 6 — wire in (RED → GREEN)

- [x] RED: `PlayCharacterMode` test — `NoticeStrip` present, ordered after `ActiveStateStrip` and before `PlanStack`
- [x] GREEN: mount it; add `flex-shrink: 0` to `.play-character__intent-body > :global(.notice-strip)` — notices flow from `playStore` engineOutput annotations via `getNotices`

### Phase 7 — refactor

- [x] Dedupe chip/eyebrow CSS against `ModChip` conventions — left as-is: ModChip is an interactive chip (different semantic); per-component scoped eyebrow IS the repo idiom (every play component has its own)
- [x] Re-read `docs/RULE_GROUP_GUIDE.md` §1 checklist and §7 pitfalls — no violations; smite annotation key now built from the `const R` prefix; RED scaffolding interface removed from notice-annotations.test.ts

### Phase 8 — verify

- [x] `make test-unit` — 184 files, 2288 passed | 7 skipped
- [x] `make check` — 0 errors, 6 pre-existing warnings
- [x] `make lint` — after fixing `no-useless-assignment` on the id counter (now `nextCollapsibleId()` module function, diceLineId idiom)
- [x] `make format` then `make format-check`
- [x] `make test` (full) — 2288 passed | 7 skipped, terraform validate ok, e2e 16 passed
- [x] `make sync-rule-groups` — 94 groups unchanged (notices are frontend-only)
- [x] `make deploy-test` (sync alone does not invalidate the CDN) — ran twice, second after the collapse fix, invalidation E9UMNV9FSHAWL
- [x] Playwright against `http://localhost:5173`: notices visible with Sentinel assigned; collapse works (mouse + keyboard); zero-state shows collapsed `0`; 400px single column, 1024px two-column; light and dark. **Defect found + fixed TDD-style**: strip always mounted collapsed — playStore awaits the effects fetch before `performEvaluation()`, so "first render" always saw `notices=[]`; component now tri-state (`manualExpanded ?? notices.length > 0`), 12/12 tests. Searing Smite burning notice NOT browser-verified (would need cast→hit→failed save driven through UI) — covered by unit + yaml scenario
- [x] a11y check on the new section — axe 17 passes, 0 section violations; contrast AA+ both themes; pre-existing placeholder contrast issue untouched (out of scope)
- [x] Commit (signed, no amend, not on main), PR — 49dc0e49, SSH-signed, no attribution lines; PR https://github.com/jarrod-lowe/dnd-planner/pull/424

### Out of scope

- Click-to-plan on a notice — deliberately deferred; leave room for `addsToPlan`
- Dice roller inside a notice body — deliberately deferred; Searing Smite will want one
- Sentinel's actual mechanics — speed-to-0, reaction triggers (still a stub)
- New feats or spells
- `.active-state-strip__placeholder` contrast fix
- A play-screen e2e spec — no login/seeding helper exists today

### Design reference

Mockup, four variants in context, light/dark, tablet + phone: `docs/plans/ideas/notices-mockup.html` (open in a browser). Also published at https://claude.ai/artifact/1uEhSZgHU8wGtjWq3JhDyg

Variant D is the one to build. The mockup shows all four; ignore A, B, C except as rejected options.

**Why D, and what not to "fix".** B (full-width rows) was the runner-up and is more readable; D was chosen for density, because every row Notices takes is a row the plan stack loses. D as mocked has one real flaw — a 2-line clamp that truncates exactly the sentences carrying a DC. **The fix is to drop the clamp, not to shorten the text.** Cells then size to content with `align-items: start`, which leaves cell heights ragged. That raggedness is accepted, not a bug. Do not re-add `-webkit-line-clamp`, and do not equalise heights by truncating.

## Implementation detail

### Notice copy (en)

Sentinel — `source` is the feat name; three notices:

| key suffix         | label                           | body                                                                                                       |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `notice-disengage` | Opportunity Attack on Disengage | A creature within 5 ft that takes the Disengage action still provokes your Opportunity Attack.             |
| `notice-retaliate` | Opportunity Attack on ally hit  | When a creature within 5 ft attacks someone other than you, you can make an Opportunity Attack against it. |
| `notice-speed`     | Hit stops movement              | A creature you hit with an Opportunity Attack has its Speed reduced to 0 for the rest of the turn.         |

Searing Smite — one notice, emitted only when `ssmite.burnDice > 0`:

| key suffix       | label   | body                                                                                                                 |
| ---------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `notice-burning` | Burning | At the start of each burning target's turn: roll its fire dice, then it makes a DC {{dc}} CON save to end the spell. |

`{{dc}}` resolves from `spellcasting.saveDC`, read in `annotate` and passed as a literal number in `values`. **No dice count anywhere in this string** — see the Decisions table.

The existing Sentinel keys (`annotation-disengage`, `annotation-retaliate`, `annotation-speed`) are replaced, not kept alongside. Their current label text is the `label` above.

### Key placement

- ~~Rule content keys live in the **rule-group YAML**, not `common.json`~~ **Corrected during execution**: rule display keys live in `src/lib/i18n/{en,en-x-tlh}/common.json` — the YAML schema's `translations` block is closed (`additionalProperties: false`, name/description/keywords only), `$t` loads only the common.json catalogs, and `tests/unit/i18n/module-i18n-coverage.test.ts` enforces `rule.*` keys there in both locales. Namespacing is `rule.<rule-group-id>.<rule-id>.<field>`; body keys are flat-dotted siblings (`notice-x.body`). Follow `docs/RULE_GROUP_GUIDE.md`.
- UI chrome keys go in `src/lib/i18n/{en,en-x-tlh}/common.json` under `play.notices.*` — at minimum a title, a count label, and expand/collapse aria labels. Follow the `play.activeState.*` / `play.planStack.*` precedent.
- Both locales, always. `tests/unit/lib/i18n/index.test.ts` asserts key parity in **both** directions, so a missing tlh key fails the suite.
- tlh values: normal casing (the all-caps look is CSS). Invent plausible Klingon; it is a canary for hardcoded text, not a real translation.

### Interpolation

`sveltekit-i18n` uses **double-brace** `{{param}}`. Single-brace `{param}` silently fails to interpolate — a known latent bug elsewhere in the repo. `NoticeStrip` renders `$t(notice.body, notice.values)`; `PanelRenderer`'s existing `$t(annotation.key)` call is untouched (notices do not render there).

### Why panel matching is unaffected

`getMatchingAnnotations` intersects `annotation.targets` with a panel's `ui.annotationLabels` (`src/lib/play/annotations.ts:16`). No panel declares `'notice'`, so notice-targeted annotations never leak into panels and no exclusion logic is needed. Sentinel disappears from reaction panels solely because Phase 2 drops `attack.reaction` from its targets.

### Test idioms

- Component tests: vitest + jsdom + `@testing-library/svelte` (`render`, `fireEvent`, `tick`). Config at `vite.config.ts:31-48`.
- For a component pulling in the store or a large subtree, use the `mount()` + per-file `vi.mock('$lib/i18n', …)` idiom — see `tests/unit/lib/components/play/PlanStack.test.ts:1-40`. The `vi.mock` call is written **before** the component import.
- Query by BEM class (`container.querySelector('.notice-strip__cell')`), never by `id` — ids are per-instance generated.
- `tests/setup.ts` mocks i18n so unknown keys render as the key itself. Assert on the key to prove a string is translated rather than hardcoded.
- Reactive parent state needs a harness component — precedent: `tests/unit/lib/components/play/PlanStackCollapseHarness.svelte`.
- `annotate` unit idiom: import the rule modules, call `evaluate({ modules, inputFacts, planned })`, assert on `out.annotations` found by `key`. See `tests/unit/rules-engine/annotate.test.ts:1-45`.

### yaml scenario mechanics

- One dir per scenario: `tests/integration/rules-engine/yaml-scenarios/<kebab-name>/test.yaml`. Discovery is automatic from the directory name.
- `ruleGroups` entries are `<directory>/<id>`; the runner strips the prefix.
- Register the name in `EXPECTED_RUNNABLE` (`tests/integration/rules-engine/yaml-scenarios.test.ts:82-535`). The literal is grouped by thematic `//` comments, **not** alphabetical — `.sort()` is applied at the end, so insert under the relevant comment. Sentinel's group is `// M3 — fighting-style-great-weapon + feat-sentinel (flag + annotations)`.
- Annotation assert vocabulary (`tests/integration/rules-engine/assert-annotations.ts:18-24`): `exists`, `notExists`, `riders`, `targets` (full array equality), `addsToPlan`.

### Fast loops

- One component/unit file: `pnpm exec vitest run <path>`
- One scenario: `pnpm exec vitest run tests/integration/rules-engine/yaml-scenarios.test.ts -t '<scenario-name>'`
- Needs `build/test-rule-groups.json` fresh: `make test-unit` (bare `pnpm test` does not regenerate it)
