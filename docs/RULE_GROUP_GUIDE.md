# Rule Group Authoring Guide

A practical guide for AI agents creating and modifying rule groups. This covers how rule groups are structured, how the engine processes them, ordering semantics, and common patterns.

For the full engine specification, see [RULES_ENGINE.md](RULES_ENGINE.md).

---

## 1. Quick Reference

### File Locations

```plain
data/rule-groups/
  _shared/definitions.yaml       # Shared YAML anchors (prepended before parsing)
  dnd-5e-2024/                   # Core D&D 5e 2024 rules
  class-paladin/                 # Paladin class rules
  species-human/                 # Human species rules
  spells/                        # Individual spell rules
  schema.json                    # JSON Schema for validation
```

### File Naming

- Path: `data/rule-groups/{category}/{name}.yaml`
- The category directory becomes a DynamoDB search index key
- Every file **must** start with the schema comment:

  ```yaml
  # yaml-language-server: $schema=../schema.json
  ```

  Adjust the relative path for nesting depth (e.g., `spells/` uses `$schema=../../schema.json`).

### Minimal Valid Rule Group

```yaml
# yaml-language-server: $schema=../schema.json
ruleGroups:
  - id: my-rule-group
    translations:
      en:
        name: My Rule Group
        description: What this rule group does
        keywords: [search, terms]
      en-x-tlh:
        name: My Rule Group
        description: tlhIngan Hol description
        keywords: [search, terms]
    rules:
      - id: my-rule
        activities:
          - type: numberSet
            target:
              fact: my.counter
            source:
              number: 0
```

### Key Fields

| Field          | Level     | Required | Description                                                      |
| -------------- | --------- | -------- | ---------------------------------------------------------------- |
| `id`           | ruleGroup | yes      | Unique identifier (e.g., `spellcasting`, `class-paladin-level1`) |
| `translations` | ruleGroup | yes      | Must include both `en` and `en-x-tlh` locales                    |
| `requires`     | ruleGroup | no       | IDs of other rule groups that must also be assigned              |
| `rules`        | ruleGroup | no       | Array of rules                                                   |
| `id`           | rule      | yes      | Unique rule identifier                                           |
| `phase`        | rule      | no       | `early`, `normal` (default), or `safeguard`                      |
| `group`        | rule      | no       | Groups this rule belongs to (for ordering)                       |
| `after`        | rule      | no       | Groups this rule must wait for before executing                  |
| `when`         | rule      | no       | Conditions that must be true for the rule to execute             |
| `activities`   | rule      | yes      | Operations to perform when the rule executes                     |

---

## 2. How the Engine Processes Rules

### Facts Start at Zero

The engine is fully stateless. `input.state.facts` is always empty at the start of each evaluation — all fact values are derived entirely by rules. When a rule reads a fact that hasn't been set, it defaults to 0. This means:

- You do **not** need explicit `numberSet` to 0 before incrementing
- Simple `numberIncrement` rules can run in any order with no `group` or `after`
- Ordering is only needed when rules must run in a specific sequence (e.g., copy a final value after all contributions settle)

### Phase Execution Order

The engine runs three phases **in strict order**:

```plain
early  ->  normal  ->  safeguard
```

- **early**: Set base values, declare groups for ordering, compute derived values that other phases depend on.
- **normal**: Standard evaluation. Offer actions, compute derived values.
- **safeguard**: Late normalization. Rarely used.

### Within a Phase: Groups and Settlement

Rules within a phase are **not** processed in file order. Instead, the engine uses a dependency system:

1. A rule declares membership in groups via `group: [group-name]`
2. A rule declares it must wait for groups via `after: [{group: group-name}]`
3. The engine loops through all rules, executing any whose `after` dependencies are satisfied
4. A group is **settled** when all its member rules have either executed or been skipped
5. Only settled groups unblock rules waiting on them

This means execution order is determined entirely by the dependency graph, not by file order or rule position in the YAML.

### Phase Isolation

Groups are **phase-local**. An early-phase rule can only wait on early-phase groups. The engine validates this and reports errors for cross-phase dependencies.

### Rules With No Dependencies

A rule with no `after` and no `group` can execute immediately in its phase. The engine processes rules in iteration order when multiple rules are eligible simultaneously.

---

## 3. Facts and Ordering

### When You Don't Need Ordering

For most cases, you can simply `numberIncrement` a fact. Since facts start at 0, multiple increments from different rule groups will produce the correct total regardless of execution order:

```yaml
# proficiency.yaml — declares UI stats, no activities needed
- id: proficiency-reset
  phase: early
  activities: []
  ui:
    stats:
      - name: play.stats.proficiency
        type: modifier
        fact: proficiency.bonus
        section: abilities

# class-paladin/level1.yaml — just increment, no after needed
- id: paladin-level1-proficiency
  phase: early
  activities:
    - type: numberIncrement
      target:
        fact: proficiency.bonus
      source:
        number: 2
```

Multiple classes can each increment `proficiency.bonus` without any ordering, because addition is commutative and facts start at 0.

### When You DO Need Ordering

Ordering is needed when:

1. **A value must be copied after all contributions settle** (e.g., copy `hp.max` to `hp.current` after all class levels have contributed)
2. **A rule sets a non-zero base value that modifiers depend on** (e.g., set `spellcasting.max` to 1, then copy to `remaining`)

### The Two-Group Pattern (for copy-after-settle)

When multiple rule groups contribute to a value and then a final rule needs the settled total, use two groups:

```yaml
# hp.yaml — Reset and declare two groups
- id: hp-reset
  phase: normal
  group:
    - hp-total # Group A: signals that the base value has been set
    - hp-set # Group B: modifiers join this group
  activities:
    - type: numberSet
      target:
        fact: hp.max
      source:
        number: 0

# hp.yaml — Copy max to current, after ALL modifiers settle
- id: hp-copy
  phase: normal
  after:
    - group: hp-set # Wait for all hp contributors
  activities:
    - type: numberCopy
      source:
        fact: hp.max
      target:
        fact: hp.current
```

Then a class level contributes:

```yaml
# class-paladin/level1.yaml — Contribute to HP
- id: paladin-level1-hp
  phase: normal
  after:
    - group: hp-total # Wait for the base value to be set
  group:
    - hp-set # Join this group (so hp-copy waits for us)
  activities:
    - type: numberIncrement
      target:
        fact: hp.max
      source:
        number: 10
    - type: numberIncrement
      target:
        fact: hp.max
      source:
        fact: con.modifier
```

**Chain**: `hp-reset` (set to 0, declare groups) -> `paladin-level1-hp` (add 10 + CON) -> `hp-copy` (copy max to current).

The two groups allow modifiers to participate between the reset and the copy. Without `hp-total`, the modifier might run before the reset. Without `hp-set`, the copy might run before the modifier.

### The One-Group Pattern (for simple copy)

When a value is set once and copied once (no modifiers from other rule groups), a single group suffices:

```yaml
# spellcasting.yaml
- id: spellcasting-max
  phase: early
  group:
    - spellcasting-max
  activities:
    - type: numberSet
      source:
        number: 1
      target:
        fact: spellcasting.max

- id: spellcasting-reset
  phase: early
  after:
    - group: spellcasting-max
  activities:
    - type: numberCopy
      source:
        fact: spellcasting.max
      target:
        fact: spellcasting.remaining
```

### Rules

- **NEVER** rely on file order or rule order within a file.
- Use `group` and `after` only when ordering actually matters (copy-after-settle, base-then-modify).
- Stats-only skeleton rules with `activities: []` are used to declare `ui.stats` for facts derived by multiple rule groups.

---

## 4. Rule Group Assignment

Rule groups must reach a character through one of three mechanisms:

### SEED# Records (Automatic on Character Creation)

Defined in `terraform/module/dnd-planner/dynamodb-items.tf`. When a new character is created, the backend reads all `SEED#CHAR` records and instantiates them for that character.

Every new character receives these core rule groups:

| Rule Group ID    | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `turn-rest`      | Turn counter and long rest management           |
| `action-economy` | Action economy rules                            |
| `proficiency`    | Proficiency bonus system                        |
| `movement`       | Movement rules                                  |
| `free-actions`   | Free actions (like Help)                        |
| `ability-scores` | Ability score system                            |
| `hit-die`        | Hit die mechanics                               |
| `hp`             | Hit points tracking                             |
| `species-{name}` | Species-specific rules (e.g., `species-human`)  |
| `custom-{id}`    | Empty per-character rule group for custom rules |

The species rule group is parameterized: the character creation request provides the species, and the seed template substitutes `$(species)` to produce the correct ID.

**Adding a new SEED rule group**: Add a new `aws_dynamodb_table_item` resource to `dynamodb-items.tf` with `gsiSeedPK = "SEED#CHAR"`, then run `make deploy-test`.

### `requires` Dependencies (Automatic on Assignment)

When a user assigns a rule group with `requires`, the system automatically resolves all transitive dependencies and assigns them first:

```yaml
# class-paladin/level1.yaml
ruleGroups:
  - id: class-paladin-level1
    requires:
      - spellcasting # Spellcasting must also be assigned
    rules: [...]
```

Assigning `class-paladin-level1` will automatically assign `spellcasting` first. Dependencies are resolved in `src/lib/rules/resolveDependencies.ts` — deepest first, with deduplication for diamond dependencies.

**Use `requires` for**: Supporting rule groups that should never be directly assigned by users but are needed by other rule groups.

### Manual User Selection

Rule groups synced to DynamoDB (via `make sync-rule-groups`) appear in the rule group picker in the UI. Users can manually browse and assign them. This is how class levels, spells, and other optional content get added to characters.

**Use manual selection for**: Content that users choose to add — class levels, subclasses, spells, feats.

### Authoring Checklist for New Rule Groups

Before a new rule group can be used, it must be reachable via at least one mechanism:

- **Every character needs it** → Add a SEED# record to `dynamodb-items.tf`
- **Users choose to add it** → Sync via `make sync-rule-groups`; it appears in the UI picker
- **It's a dependency of another group** → Add `requires` to the parent group; no SEED# needed

---

## 5. Rule Group Dependencies (`requires` vs `after`)

These are two different dependency mechanisms at different levels:

|               | `requires` (ruleGroup level)                    | `after` (rule level)                   |
| ------------- | ----------------------------------------------- | -------------------------------------- |
| **Purpose**   | Ensure another rule group is assigned           | Control execution order within a phase |
| **Scope**     | Character assignment (composition)              | Single evaluation cycle                |
| **Mechanism** | Auto-assigns dependency when parent is assigned | Waits for group settlement             |
| **Example**   | Paladin requires spellcasting                   | HP increment waits for HP reset        |

### `requires` — Composition Dependency

When a user assigns a rule group with `requires`, the system automatically assigns all required groups first (transitively). This ensures the necessary rules exist in the evaluation.

```yaml
# class-paladin/level1.yaml
ruleGroups:
  - id: class-paladin-level1
    requires:
      - spellcasting
    rules:
      - id: paladin-level1-spell-slots
        group:
          - spellcasting-slots-set
        activities:
          - type: numberIncrement
            target:
              fact: spellcasting.slots.level1.total
            source:
              number: 2
```

Without `requires: [spellcasting]`, the `spellcasting-slots-set` group might not exist (if no other assigned rule group declares it), which could cause incorrect ordering.

### `after` — Execution Ordering

See Section 3. This controls the order rules execute within a single phase.

---

## 6. Common Patterns

### Pattern: Stats-Only Skeleton

**Use when:** Multiple rule groups contribute to a fact, and you need UI stats for it. The skeleton rule has no activities — it exists solely to declare `ui.stats`.

```yaml
# proficiency.yaml
- id: proficiency-reset
  phase: early
  activities: []
  ui:
    stats:
      - name: play.stats.proficiency
        type: modifier
        fact: proficiency.bonus
        section: abilities
```

### Pattern: Simple Increment (No Ordering)

**Use when:** Multiple rule groups add to the same value. No ordering needed since facts start at 0 and addition is commutative.

```yaml
# class-paladin/level1.yaml
- id: paladin-level1-proficiency
  phase: early
  activities:
    - type: numberIncrement
      target:
        fact: proficiency.bonus
      source:
        number: 2
```

### Pattern: Reset-Modify-Copy (Two-Group Pattern)

**Use when:** Multiple rule groups contribute to a value, then a final copy is needed after all contributions settle (e.g., HP, spell slots). See Section 3 for the full explanation.

Chain: `reset total to 0` -> `modifiers increment total` -> `copy total to remaining/current`

### Pattern: Simple Copy (One-Group Pattern)

**Use when:** A value is set once and needs to be copied once per evaluation (e.g., action points, spellcasting uses).

```yaml
- id: action-max
  phase: early
  group:
    - action-max
  activities:
    - type: numberSet
      source:
        number: 1
      target:
        fact: actions.max

- id: action-reset
  phase: early
  after:
    - group: action-max
  activities:
    - type: numberCopy
      source:
        fact: actions.max
      target:
        fact: actions.remaining
```

### Pattern: Offer Rule With Legality Checks

**Use when:** Presenting an action the user can choose, with conditions that determine if it's legal.

```yaml
- id: action-move-walk-offer
  after:
    - group: half-movement-remaining
  activities:
    - type: offerRule
      legalWhen:
        - condition:
            fact: character.movement.remaining
            operator: greaterThanOrEqual
            value: 5
          illegalDiagnostics:
            - code: rule.dnd-5e-2024.movement.action-move-walk-offer.out_of_movement
              severity: error
      rule:
        id: move-walk
        ui:
          model: move
          section: move
          name: rule.dnd-5e-2024.movement.move-walk.name
        group:
          - move
        vars:
          distance:
            capture: true
            default:
              fact: character.movement.remaining
        activities:
          - type: numberIncrement
            target:
              fact: character.movement.remaining
            source:
              var: distance
            subtract: true
```

Key points:

- `offerRule` does NOT execute the inner rule. It offers it as a UI choice.
- `legalWhen` is an array — every entry's condition must pass.
- `illegalDiagnostics` provides i18n error keys for failed conditions.
- The inner `rule` is what gets executed when the user chooses this action.
- `capture: true` snapshots the default value when added to the plan.

### Pattern: Conditional Offerings

**Use when:** An action should only be available under certain conditions.

```yaml
- id: action-move-swim-offer
  when:
    - fact: character.movement.swim.cost
      operator: equals
      value: 1
  after:
    - group: half-movement-remaining
  activities:
    - type: offerRule
      # ...
```

`when` controls whether the rule executes at all. `legalWhen` (inside `offerRule`) controls whether the offered action is legal but still visible. Use `when` for structural conditions (this rule is irrelevant), `legalWhen` for resource conditions (you can try but it'll be marked illegal).

### Pattern: Error Collection

**Use when:** Collecting error states within a rule's execution.

```yaml
activities:
  - *error-clear
  - type: numberIncrement
    target:
      fact: actions.remaining
    source:
      number: 1
    subtract: true
  - type: setAdd
    target:
      var: errors
    source:
      string: rule.dnd-5e-2024.free-actions.action-help-offer.no_action
    when:
      fact: actions.remaining
      operator: lessThan
      value: 0
```

The `*error-clear` anchor is defined in `_shared/definitions.yaml`. Always clear before collecting.

### Pattern: Computed Values

**Use when:** Deriving a value from another fact, especially when other rules need to wait for it.

```yaml
- id: compute-half-movement-total
  phase: normal
  group:
    - half-movement-total
  activities:
    - type: numberFunction
      function: multiply
      sources:
        - fact: character.movement.total
      target:
        fact: character.movement.half_total
      args:
        multiplier: 0.5
```

By declaring a `group`, other rules can use `after: [{group: half-movement-total}]` to wait for this computation.

### Pattern: Species/Class Constants

**Use when:** Setting base character attributes that other rules depend on.

```yaml
- id: set-base-distance
  phase: early
  group:
    - species-constants
  activities:
    - type: numberSet
      target:
        fact: character.movement.total
      source:
        number: 30
    - type: numberSet
      target:
        fact: character.movement.swim.can
      source:
        number: 1
    - type: numberSet
      target:
        fact: character.movement.swim.cost
      source:
        number: 2
```

### Pattern: Persistent Effects (Spells)

**Use when:** An action creates an ongoing effect that persists across turns.

```yaml
activities:
  - type: numberIncrement
    target:
      fact: actions.remaining
    source:
      number: 1
    subtract: true
  - type: numberIncrement
    target:
      fact: spellcasting.slots.level1.remaining
    source:
      number: 1
    subtract: true
  - type: advertiseEffect
    rule:
      id: effect-my-spell-l1
      ui:
        section: action-spell
        name: rule.my-spell.effect-my-spell-l1.name
      phase: early
      after:
        - group: spellcasting-slots-set
      group:
        - spell-slot-effect
      activities:
        - type: numberIncrement
          target:
            fact: spellcasting.slots.level1.remaining
          source:
            number: 1
          subtract: true
        - type: advertiseEffect
          self: true
          when:
            fact: rest.long
            operator: equals
            value: 0
  - *error-clear
```

Key points:

- `advertiseEffect` creates a rule that persists in `effects` across evaluations.
- `self: true` re-advertises the effect each turn (self-sustaining).
- The effect expires when its `when` condition is false.
- Effects get unique IDs with numeric suffixes to avoid collisions.

---

## 7. Conventions

### Stats Declarations (`ui.stats[]`)

Rules can declare stats to display in the play mode stats column via `ui.stats[]`. The rules engine ignores these — they are a UI concern only.

**Convention:** Place `ui.stats[]` on the rule that logically owns the fact being displayed. For facts derived by modifier rules across multiple files, use a dedicated stats-only skeleton rule (with `activities: []`).

Three stat types are supported:

```yaml
# Plain number (e.g., Turn Counter)
- id: turn-counter-increment
  activities:
    - type: numberIncrement
      target: { fact: turn.counter }
      source: { number: 1 }
  ui:
    stats:
      - name: play.stats.turnCounter
        type: value
        fact: turn.counter
        section: turn

# Stats-only skeleton (no activities — facts derived by modifier rules)
- id: proficiency-reset
  activities: []
  ui:
    stats:
      - name: play.stats.proficiency
        type: modifier
        fact: proficiency.bonus
        section: abilities

# Resource with capacity (e.g., Actions 1/1)
- id: action-max
  activities:
    - type: numberSet
      target: { fact: actions.max }
      source: { number: 1 }
  ui:
    stats:
      - name: play.stats.actions
        type: usedMax
        total: actions.max
        remaining: actions.remaining
        section: resources

# Stats-only skeleton for spell slots (9 stat entries, one per level)
- id: spellcasting-slots-total
  activities: []
  ui:
    stats:
      - name: play.stats.spellLevel
        nameParams: { level: 1 }
        type: usedMax
        total: spellcasting.slots.level1.total
        remaining: spellcasting.slots.level1.remaining
        section: magic
```

**Sections** group stats visually. Known sections (in display order):

- `turn` — Turn counter
- `resources` — Speed, Actions, Spellcasting, HP
- `abilities` — Proficiency
- `magic` — Spell slots
- `stats` — Ability scores
- `skills` — Skills

**Display rules:**

- `value`: shows plain number; hidden if fact is undefined
- `modifier`: shows `+X` or `-X`; hidden if fact is undefined
- `usedMax`: shows `X / Y`; hidden if total is 0 or undefined

### Annotations (`annotate` activity and `ui.annotationLabels`)

Annotations display reminder text on action panels when certain conditions are met. The rules engine produces annotations via the `annotate` activity, and the UI matches them against action labels.

**How it works:**

1. Actions (e.g., attacks) declare `ui.annotationLabels` — labels they respond to
2. Rules use `annotate` activities with conditions and target labels — the engine produces annotations when conditions pass
3. When an annotation's targets overlap with an action's labels, the annotation text appears on that action's panel

**Attack labels** (on the definition's `ui` field):

```yaml
# Unarmed Strike
ui:
  model: attack
  annotationLabels: [attack.any, attack.melee, attack.unarmed]

# Melee weapon (dagger, greataxe, etc.)
ui:
  model: attack
  annotationLabels: [attack.any, attack.melee, attack.weapon]
```

**Annotation rules** (using `annotate` activity with YAML anchors):

```yaml
# Define condition anchors (shared with legalWhen)
legalWhen:
  - condition: &ds-has-bonus-action
      fact: bonusActions.remaining
      operator: greaterThan
      value: 0
    illegalDiagnostics:
      - code: rule.class-paladin-divine-smite.offer-divine-smite.no_bonus_action
        severity: error

# Annotate rule uses the same anchors
- id: annotate-divine-smite
  after:
    - group: __planned__
    - group: spellcasting
    - group: smite-slots-computed
  activities:
    - type: annotate
      when:
        - *ds-has-bonus-action
        - *ds-has-attack-action
        - *ds-has-smite-slots
        - *ds-has-spellcasting
      key: rule.class-paladin-divine-smite.annotation
      targets: [attack.melee, attack.unarmed]
```

Annotations are produced by the engine when all `when` conditions pass. Use YAML anchors (`&name` / `*name`) to share conditions between `legalWhen` and the annotate rule's `when` — avoiding duplication. The annotation `key` must be an i18n key with translations in both locales.

### Translations

Every rule group must have translations for both supported locales:

```yaml
translations:
  en:
    name: Display Name
    description: Human-readable description
    keywords: [search, terms]
  en-x-tlh:
    name: Klingon Name
    description: Klingon description
    keywords: [klingon, terms]
```

The test suite validates this — missing translations will fail `make test`.

### i18n Keys

All user-facing strings use i18n keys, never hardcoded text:

```yaml
# Correct
name: rule.dnd-5e-2024.movement.move-walk.name

# Wrong
name: Walk
```

i18n keys follow the pattern: `rule.{rule-group-id}.{rule-id}.{field}`

### Shared Anchors

Place reusable YAML anchors in `data/rule-groups/_shared/definitions.yaml`. This file is prepended before parsing, so anchors are available in all rule group files.

Currently available:

- `*error-clear` — Clears the `errors` var

### Group Naming

Group names should describe what they gate:

- `spellcasting-slots-set` — When all slot modifications are done
- `species-constants` — When species base values are set
- `action-max` — When action maximum is set
- `hp-total` — When HP base value has been set
- `hp-set` — When all HP contributions have settled

### Rule ID Naming

Rule IDs should be descriptive and namespaced:

- `{category}-{feature}-{action}`: `action-move-walk-offer`
- `{category}-{feature}-{modifier}`: `paladin-level1-proficiency`
- `{category}-{reset}`: `proficiency-reset`, `spellcasting-slots-reset`

---

## 8. Testing and Verification

Add suitable tests into `yaml-scenarios` when creating new rules.

### Automated

- **`make test`** — Runs unit tests including translation completeness checks
- **Schema validation** — The `schema.json` file provides validation via yaml-language-server in editors

### Syncing to Test Environment

- **`make sync-rule-groups`** — Syncs YAML definitions to the test DynamoDB table. Run this after adding or modifying rule groups.
- **`make deploy-test`** — Full deployment including rule group sync

### Manual Verification Checklist

1. All rule groups have `en` and `en-x-tlh` translations with `name`, `description`, and `keywords`
2. Every YAML file has the schema comment on line 1
3. All `after` references point to groups that actually exist in the same phase
4. Rules that modify the same fact use `group`/`after` only when ordering matters (copy-after-settle)
5. No rule waits on a group it belongs to (self-dependency cycle)
6. All `requires` references point to existing rule group IDs
7. User-facing strings use i18n keys, not hardcoded text
8. The `*error-clear` anchor is used before any `setAdd` to the `errors` var
9. New rule groups are reachable via SEED#, `requires`, or manual selection (see Section 4)

---

## 9. Activity Types Reference

| Type              | Description                   | Key Fields                                     |
| ----------------- | ----------------------------- | ---------------------------------------------- |
| `numberSet`       | Set fact to value (overwrite) | `target.fact`, `source`                        |
| `numberIncrement` | Add/subtract from fact        | `target.fact`, `source`, `subtract?: true`     |
| `numberCopy`      | Copy value between facts      | `source.fact`, `target.fact`                   |
| `numberSum`       | Sum multiple sources          | `target.fact`, `sources[]`                     |
| `numberFunction`  | Apply named function          | `function`, `sources[]`, `target.fact`, `args` |
| `emitEvent`       | Emit transient event          | `event`                                        |
| `generateRule`    | Create rule for later phase   | `rule`                                         |
| `offerRule`       | Offer choice to UI            | `rule`, `legalWhen[]`                          |
| `setClear`        | Clear var array               | `target.var`                                   |
| `setAdd`          | Add string to var array       | `target.var`, `source.string`                  |
| `advertiseEffect` | Persistent cross-turn effect  | `rule` or `self: true`                         |

### Named Functions (numberFunction)

| Function         | Description                       | `args`       |
| ---------------- | --------------------------------- | ------------ |
| `statToModifier` | Convert ability score to modifier | _(none)_     |
| `multiply`       | Multiply source values together   | `multiplier` |
| `max`            | Return maximum value from sources | _(none)_     |

### Source Types

| Type        | Example                                              | Description                  |
| ----------- | ---------------------------------------------------- | ---------------------------- |
| `number`    | `{number: 5}`                                        | Literal numeric value        |
| `fact`      | `{fact: proficiency.bonus}`                          | Reference to a fact          |
| `var`       | `{var: distance}`                                    | Reference to a rule variable |
| `condition` | `{condition: {fact: x, operator: equals, value: 0}}` | Evaluates to 1 or 0          |
| `string`    | `{string: rule.error.key}`                           | Literal string (i18n key)    |

### Comparison Operators

`equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`

---

## 10. Dependency Graph Visualization

Here is the dependency graph for the base D&D 5e 2024 rule groups with a Paladin:

```plain
Phase: early
  species-constants ──────────────────> action-move-reset
  (species-human)                       (movement)
       │                                     │
       └── sets movement.total               └── copies total to remaining
                                            (after species-constants)

  paladin-level1-proficiency
  (class-paladin-level1)
       │
       └── increments proficiency.bonus by 2
           (no after — facts start at 0)

  spellcasting-max ──────> spellcasting-reset
  (spellcasting)            (spellcasting)
       │                        │
       └── sets max to 1        └── copies max to remaining
                              (after spellcasting-max)

  paladin-level1-spell-slots
  (class-paladin-level1)
       │
       └── increments spellcasting.slots.level1.total by 2
           (no after — facts start at 0, joins spellcasting-slots-set)

  paladin-level1-hit-die
  (class-paladin-level1)
       │
       └── increments hitDie.d10.total by 1
           (joins hit-die-base group)

  turn-counter
  (turn-rest)
       │
       └── increments turn.counter by 1

Phase: normal
  hp-reset ──────> paladin-level1-hp ──> hp-copy
  (hp)              (class-paladin-level1)  (hp)
       │                  │                    │
       └── sets max to 0  └── adds 10 + CON    └── copies max to current
       (declares groups)     (joins hp-set)        (after hp-set)

  half-movement-total ──> ... ──> half-movement-remaining ──> offer rules
  (movement)                (movement)                         (movement)
```

## 11. Common Errors

- Forgetting to create a SEED# record for new rule groups that should be used by all characters
- Getting the ordering wrong
- Not capturing variables that need to keep their values (e.g. slider max's)
- Not making sure activities apply from both planned choices and active effects where required
- Forgetting to `make deploy-test` or `make sync-rule-groups` to update the database
