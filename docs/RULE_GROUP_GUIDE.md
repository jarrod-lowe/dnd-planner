# Rule Group Authoring Guide

A practical guide for AI agents creating and modifying rule groups. A rule
group is a **TypeScript module** (the logic) plus a **YAML metadata file**
(translations, prerequisites, settings, conditions, detail text) plus **i18n
keys** in both locales. There is no rule DSL — the YAML layer carries no rules,
and the schema rejects them.

For the engine specification, see [RULES_ENGINE.md](../RULES_ENGINE.md).

---

## 1. Quick Reference

### Where things live

```plain
src/lib/rules-engine/
  rules/<id>.ts                  # The module: derive/offer/annotate/onRest logic
  registry.ts                    # Eager id → module map (tests, parity harness)
  lazy.ts                        # Dynamic-import chunk map (runtime delivery)
  builder.ts                     # Authoring toolkit (defineRule, shared offer builders)
  types.ts                       # The module contract (RuleModule, Offer, EffectInstance…)

data/rule-groups/<category>/<name>.yaml   # Metadata: translations/requires/settings/condition/detail
data/rule-groups/schema.json              # Schema for the metadata layer (validate-rules-schema)

src/lib/i18n/en/common.json               # All rule.* display text and diagnostics
src/lib/i18n/en-x-tlh/common.json         # …in BOTH locales, always

tests/unit/rules-engine/<feature>.test.ts          # Module unit tests
tests/integration/rules-engine/yaml-scenarios/<name>/ # Player-visible scenario tests
```

### Identity

The module's `id` **is** the canonical rule-group id, used everywhere: the
registry and lazy-loader keys, DynamoDB `ruleGroupId`, `requires` lists,
persisted character assignments, and the search index. Scenario files
reference groups as `<category>/<id>` (a file-location convention the harness
strips). Pick the id once, keep it kebab-case, and never reuse an old one.

### The authoring checklist

1. **Write the failing test first** (TDD is mandatory — see §6).
2. Write the module at `src/lib/rules-engine/rules/<id>.ts`; export
   `default defineRule(module)`.
3. Register it in **both** `registry.ts` (import + `MODULES` array) and
   `lazy.ts` (`LOADERS['<id>']` dynamic import).
4. Add every `rule.*` i18n key to **both** locale files (names, descriptions,
   diagnostics, effect display names). Modules carry keys, never display text.
5. Add the YAML metadata file under `data/rule-groups/<category>/` —
   translations, `requires`, optional `settings`/`condition`/`detail`.
6. Add or extend a YAML scenario (§6) for the player-visible behavior.
7. Run the gates: `make validate-rules-schema && make check && make test-unit`
   (then `make test` before declaring done). To publish metadata to the test
   environment: `make sync-rule-groups`; full refresh: `make deploy-test`.

Guards that will catch a missed step: `module-coverage` (deployed group with no
module), `module-i18n-coverage` (untranslated `rule.*` key),
`sections.test` (bad section / intentless HANDLE), `lazy`/`registry` sync
tests, the metadata i18n-compliance test (literal display text in a module),
and `verify-chunks` (module not code-splitting into its own chunk).

---

## 2. The module

A minimal real module (`rules/dash.ts`):

```ts
import { defineRule, type ActionResult, type RuleModule } from '../builder';

const D = 'rule.dnd-5e-2024.dash';
const NO_ACTION = `${D}.action-dash-offer.no_action`;

const dash: RuleModule = {
  id: 'dash',
  offer: () => [
    {
      id: 'dash-action',
      ui: {
        section: 'action-other',
        name: `${D}.dash-action.name`,
        description: `${D}.dash-action.description`,
        intents: { MOVE: 'dash' },
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const speed = f.num('character.movement.total');
        return {
          advertise: [
            {
              id: 'dash',
              state: { 'actions.spent': 1, 'character.movement.total': speed },
              expiry: { kind: 'endOfTurn' }
            }
          ],
          diagnostics:
            f.num('actions.remaining') > 0 ? [] : [{ code: NO_ACTION, severity: 'error' }]
        };
      }
    }
  ]
};

export default defineRule(dash);
```

Note the pattern: `apply` **never writes facts** — it advertises effects whose
`state` deltas do the work, and it re-checks its own legality so the fold can
attach per-instance diagnostics.

### `derive` — contributing to the sheet

```ts
derive: () => [
  { fact: 'reactions.max', value: () => 1 },
  { fact: 'reactions.remaining', value: (f) => f.num('reactions.max') - f.num('reactions.spent') }
];
```

- Ordering is **structural**: the engine tracks what each `value` reads and
  settles producers before consumers. Do not author ordering; there are no
  phases, groups, or `after`, and none should be proposed.
- `combine: 'sum'` for stacking modifiers, `'max'` for competing floors,
  default `override` for a single authoritative writer. Conflicts throw.
- Unset facts read as `0`; use `f.has()` when unset must differ from zero
  (an unset ability score's modifier is 0, not −5).
- Never contribute to a fact the runtime passes as an input — the sheet
  throws on input/contribution overlap.

### Offers — `when` vs `legalWhen`

- `when` (structural): false hides the offer entirely, and a planned instance
  whose gate closes is **skipped** (no execution, no spend; the row shows as
  inapplicable). Use for "this action doesn't exist right now" (not prepared,
  weapon not equipped, steed not summoned).
- `legalWhen` (legality): false keeps the offer visible but illegal, showing
  the diagnostic. Planned-anyway actions still execute and the projection
  shows the over-commit. Use for resource gates (no action left, no slot).

### Offer `ui` — what the panel renders

`ui.name`/`ui.description` are i18n keys. `ui.section` must be a value from
the `SECTIONS` union (`types.ts`); only some sections map to a picker verb, so
an offer whose section has no verb mapping **must** carry `ui.intents`
(`sections.test.ts` enforces this). `ui.intents: { VERB: 'variant' }` drives
the add-picker grouping; `ui.actionCost` tags the cost chip;
`ui.annotationLabels` opts the panel into matching annotations;
`ui.detailKey` (e.g. `spell/sleep`) links the rules-mode detail text;
`ui.subject: 'steed'` scopes it to a companion. Panel controls
(`primaryControl`, `vars`, followups) pass straight through to PanelRenderer —
copy an existing offer with the control you need (slider: `movement`,
dice-line: weapons via the builder, select: `skill-checks`).

### Effects

- Per-turn spends: keyless, `expiry: { kind: 'endOfTurn' }`.
- Durable spends: `untilLongRest` / `untilShortRest`.
- Timed buffs: `{ kind: 'turns', remaining: N }` (write only `remaining`;
  aging backfills `total` for the pips), usually paired in an array with
  `{ kind: 'untilShortRest' }` so a rest also ends it.
- Replaceable state: give the effect a `key` — newest same-key effect evicts
  the older one (this is how prepare/unprepare and set-value modifiers work).
- **Display contract**: no `display` → hidden and nameless (pure
  bookkeeping); `display: { name }` → a named chip on the active-effects
  strip; `display: { name, hidden: true }` → named but only in the "show
  hidden" reveal (build/settings effects). `displayFact` shows a live value on
  the chip; `subject: 'steed'` files it under the steed view.

### Shared builders

`builder.ts` is the toolkit: `defineRule` (validates the module),
`preparedSpellOffers` (the prepare/unprepare pair every prepared spell uses),
the weapon-definition builder (attack/equip/stow/reaction offers from one
`def`), and `statToModifier`. Reuse them — do not hand-roll a prepared spell
or a weapon.

### `meta` — search discovery

User-facing content groups (spells, feats, class levels, weapons) carry
`meta: { name, description, keywords, requires }` — all i18n keys except
`requires` (literal rule-group ids that auto-assign with this group).
Foundational modules (hp, action-economy, hands…) have no `meta` and no
search presence.

---

## 3. The YAML metadata file

One file per group under `data/rule-groups/<category>/`, validated by
`make validate-rules-schema` against `schema.json`. It contains **no rules**.

```yaml
# yaml-language-server: $schema=../schema.json
ruleGroups:
  - id: spell-example # must equal the module id
    translations:
      en:
        name: Example
        description: One-line description for search results.
        keywords: [example, sample]
      en-x-tlh:
        name: ghItlh
        description: DIvI' Hol.
        keywords: [ghItlh]
    requires: [spellcasting] # auto-assigned alongside this group
    condition: # optional assignment gate
      - fact: class.paladin.level
        operator: greaterThanOrEqual
        value: 2
    settings: # optional per-character choices
      - id: example-choice
        type: select
        translations:
          en: { name: Choose a thing }
          en-x-tlh: { name: wIv }
        options:
          - value: athletics
            translations:
              en: { name: Athletics }
              en-x-tlh: { name: Qapla' }
        effect: # ${value} substitutes the chosen option
          id: example-${value}
          key: example-${value}
          state: { 'skill.${value}.proficiency': 1 }
          display:
            name: rules.settings.example.${value}
            hidden: true
          expiry: { kind: permanent }
    detail: # optional rules-mode text (publish-details → static/details)
      key: spell/example
      source: srd52
      translations:
        en:
          meta: Level 1 Abjuration
          body: |
            Markdown body text…
```

- `settings` of type `select` produce an `EffectInstance` from the `effect`
  template via `${value}` substitution (including inside `display`); the
  result is stored as a character build effect. `select-rule-group` instead
  auto-assigns the chosen group.
- `condition` gates assignment (top-level array is AND; `type: or` for OR).
- `detail` is extracted by `make publish-details` and served statically;
  offers reference it via `ui.detailKey`.
- Sync to the test environment with `make sync-rule-groups` (content-hash
  driven; every category re-syncs when its files change).

---

## 4. i18n

Everything a player can read is a key in **both**
`src/lib/i18n/en/common.json` and `src/lib/i18n/en-x-tlh/common.json`:

- Convention: `rule.<group-id-ish>.<offer-or-effect>.<field>` — e.g.
  `rule.dnd-5e-2024.dash.dash-action.name`, diagnostics as
  `…-offer.no_action`.
- Build keys from a single `const` prefix per file so the
  `module-i18n-coverage` test can statically resolve them (it expands
  `${PREFIX}.suffix` templates one level deep; keys built from two template
  variables are invisible to it — avoid them where possible).
- Never put display text in a module; the metadata i18n-compliance test
  rejects it.

---

## 5. Facts and naming

- Facts are flat dotted keys holding numbers. Resources follow
  `<thing>.max` / `<thing>.spent` / `<thing>.remaining = max − spent`, with
  spends as effect deltas to `.spent` (so rests restore by aging the spend
  away, not by writing `.remaining`).
- Booleans are 0/1 facts (`weapon.spear.equipped`, `build.locked`).
- Rest signals are `rest.long` / `rest.short` facts contributed by
  core-events' recorder effects; they apply within the same evaluation.
- Namespace by feature (`spellcasting.slots.level1.*`,
  `companion.steed.*`, `capability.attack.reaction.weapon`). Grep before
  inventing a new fact — the module you're integrating with usually already
  derives what you need.

---

## 6. Testing

TDD, always: failing test → implementation → green → refactor.

### Module unit tests (`tests/unit/rules-engine/`)

Exercise the module through the public entry points (`evaluateSheet`,
`evaluatePlan`, `evaluate`, `endTurn`) with a minimal module set. Remember the
input-facts contract: pass genuine inputs only — a fact your module set
contributes must arrive as an effect or a module, or the sheet throws.

### YAML scenarios (`tests/integration/rules-engine/yaml-scenarios/`)

Player-visible behavior belongs in a scenario (this is the corpus the parity
runner executes — CLAUDE.md's "add to the yaml scenarios runner"). Anatomy:

```yaml
name: 'Dash adds speed for one turn'
ruleGroups:
  - dnd-5e-2024/action-economy
  - dnd-5e-2024/movement
  - dnd-5e-2024/dash
steps:
  - addOffer:
      id: dash-action
      assert:
        facts:
          character.movement.remaining: 60
        planErrors:
          - id: dash-action
            errors: []
  - endTurn:
      assert:
        facts:
          character.movement.remaining: 30
```

Steps: `evaluate` (assert without acting), `addOffer` (+ optional
`selections`), `updateSelections`, `removeFromPlan`, `removeEffect`, and
`endTurn` (optionally `longRest: true`). Asserts sit under the step (or as a
sibling `assert:`) and cover `facts`, `offers` / `effects` / `annotations`
(`exists` / `notExists`, plus `legal` / `illegal` for offers), `offerVars`,
`offerUi`, `status`, and `planErrors`. Conventions:

- `initialFacts` may only carry facts **no module derives** (the engine
  rejects overlap). Prefer driving state through steps or committed effects.
- Do not author legacy-format `initialEffects` blocks in new scenarios. If a
  scenario must start with pre-existing state, add its committed
  `EffectInstance[]` to `INITIAL_EFFECTS`
  (`tests/integration/rules-engine/initial-effects.ts`), keyed by scenario
  directory name.
- The runner asserts an exact runnable-scenario set (`EXPECTED_RUNNABLE`) —
  add your scenario's name there.

### The gates

`make validate-rules-schema` (YAML), `make check` (types), `make test-unit`
(vitest incl. all guards + parity), `make test` before declaring done.

---

## 7. Common pitfalls

- **Rules in YAML.** There is no rules DSL any more; the schema rejects
  `rules:`. Logic goes in the module.
- **Authoring ordering.** No phases/groups/`after` exist. If a value seems to
  need ordering, express it as a derivation of the facts it depends on.
- **Writing facts from `apply`.** Impossible by design — advertise an effect.
- **Missing the second registration.** `registry.ts` AND `lazy.ts` both need
  the module; a sync test fails if they drift.
- **A section with no verb.** An offer whose `ui.section` has no verb mapping
  and no `ui.intents` lands in the generic HANDLE picker bucket —
  `sections.test.ts` fails the build.
- **Keyed vs keyless effects.** Forgetting a `key` on replaceable state makes
  re-application stack; putting a `key` on a per-turn spend makes the second
  spend evict the first.
- **Display omission.** An effect the player should see (or ever inspect)
  needs `display`; a nameless hidden effect is invisible even in the reveal.
- **One locale.** Every key lands in `en` **and** `en-x-tlh`, or
  `module-i18n-coverage` fails.
- **`annotationLabels` nested in a control.** They belong on the offer's `ui`,
  never inside `primaryControl` / `secondaryControl`. Only `ui.annotationLabels`
  is read (`extractPanelDescriptor` → `getAnnotationLabels`), and a module's `ui`
  is typed `Record<string, unknown>`, so a nested array compiles happily and
  silently matches nothing. `annotation-targets.test.ts` catches a target label
  no panel carries at all, but not a label that is nested-and-dead here while
  another panel still carries it correctly.
