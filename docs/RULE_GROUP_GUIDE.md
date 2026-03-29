# Rule Group Authoring Guide

A practical guide for AI agents creating and modifying rule groups. This covers how rule groups are structured, how the engine processes them, ordering semantics, and common patterns.

For the full engine specification, see [RULES_ENGINE.md](RULES_ENGINE.md).

---

## 1. Quick Reference

### File Locations

```
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

| Field | Level | Required | Description |
|-------|-------|----------|-------------|
| `id` | ruleGroup | yes | Unique identifier (e.g., `spellcasting`, `class-paladin-level1`) |
| `translations` | ruleGroup | yes | Must include both `en` and `en-x-tlh` locales |
| `requires` | ruleGroup | no | IDs of other rule groups that must also be assigned |
| `rules` | ruleGroup | no | Array of rules |
| `id` | rule | yes | Unique rule identifier |
| `phase` | rule | no | `early`, `normal` (default), or `safeguard` |
| `group` | rule | no | Groups this rule belongs to (for ordering) |
| `after` | rule | no | Groups this rule must wait for before executing |
| `when` | rule | no | Conditions that must be true for the rule to execute |
| `activities` | rule | yes | Operations to perform when the rule executes |

---

## 2. How the Engine Processes Rules

### Phase Execution Order

The engine runs three phases **in strict order**:

```
early  ->  normal  ->  safeguard
```

- **early**: Establish preconditions. Reset counters, set base values, emit events.
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

## 3. The Reset-Before-Modify Pattern (Critical)

This is the most important concept in rule group authoring. Get this wrong and values will be incorrect.

### The Problem

Rule groups from **different files** are combined into a single evaluation. Without explicit ordering, the engine might execute a "add +2 to proficiency" rule **before** the "reset proficiency to 0" rule, producing 0 instead of 2.

File order does not matter. Rule order within a file does not matter. Only `group` and `after` matter.

### The Solution: Declare a Group, Then Depend On It

**Step 1 — Base rule resets and declares a group:**

```yaml
# proficiency.yaml
- id: proficiency-reset
  phase: early
  group:
    - proficiency-base          # This rule DECLARES the group
  activities:
    - type: numberSet
      target:
        fact: proficiency.bonus
      source:
        number: 0
```

**Step 2 — Modifier rule waits for the group:**

```yaml
# class-paladin/level1.yaml
- id: paladin-level1-proficiency
  phase: early
  after:
    - group: proficiency-base   # Wait for the reset to complete
  activities:
    - type: numberIncrement
      target:
        fact: proficiency.bonus
      source:
        number: 2
```

**Result:** The reset always runs first, then the increment adds on top. Correct value = 2.

### Why This Works

1. The base rule belongs to `proficiency-base`, so the group exists
2. The modifier rule has `after: [proficiency-base]`, so it waits
3. The group settles after the base rule executes
4. Only then does the modifier rule execute

Without the `after`, the two rules could run in any order.

### The Two-Group Pattern (for composability)

When you need other rule groups to both **contribute to** a value AND have a subsequent rule **depend on the final value**, use two groups:

```yaml
# spellcasting.yaml

# Rule 1: Reset all slot totals AND declare two groups
- id: spellcasting-slots-total
  phase: early
  group:
    - spellcasting-slots-total   # Group A: for modifiers to depend on
    - spellcasting-slots-set     # Group B: for modifiers to join
  activities:
    - type: numberSet
      target:
        fact: spellcasting.slots.level1.total
      source:
        number: 0

# In class-paladin/level1.yaml:
- id: paladin-level1-spell-slots
  phase: early
  after:
    - group: spellcasting-slots-total  # Wait for the reset
  group:
    - spellcasting-slots-set           # Join this group (so others can wait for it)
  activities:
    - type: numberIncrement
      target:
        fact: spellcasting.slots.level1.total
      source:
        number: 2

# Back in spellcasting.yaml — Rule 2: Copy totals to remaining (AFTER all modifiers)
- id: spellcasting-slots-reset
  phase: early
  after:
    - group: spellcasting-slots-set    # Wait for ALL modifiers to settle
  activities:
    - type: numberCopy
      source:
        fact: spellcasting.slots.level1.total
      target:
        fact: spellcasting.slots.level1.remaining
```

This creates the chain: reset(0) -> modify(+2) -> copy(2 to remaining). The two groups allow modifiers to participate in the middle.

### Rules

- **ALWAYS** reset a fact before modifying it across rule groups. Never assume a value.
- **NEVER** rely on file order or rule order within a file.
- Reset rules should be in the same phase as modifier rules (usually `early`).
- All modifiers for a given reset should share the same phase.

---

## 4. Rule Group Dependencies (`requires` vs `after`)

These are two different dependency mechanisms at different levels:

| | `requires` (ruleGroup level) | `after` (rule level) |
|---|---|---|
| **Purpose** | Ensure another rule group is assigned | Control execution order within a phase |
| **Scope** | Character assignment (composition) | Single evaluation cycle |
| **Mechanism** | Auto-assigns dependency when parent is assigned | Waits for group settlement |
| **Example** | Paladin requires spellcasting | Proficiency increment waits for proficiency reset |

### `requires` — Composition Dependency

When a user assigns a rule group with `requires`, the system automatically assigns all required groups first (transitively). This ensures the necessary rules exist in the evaluation.

```yaml
# class-paladin/level1.yaml
ruleGroups:
  - id: class-paladin-level1
    requires:
      - spellcasting           # Spellcasting must also be assigned
    rules:
      - id: paladin-level1-spell-slots
        after:
          - group: spellcasting-slots-total  # Fine-grained ordering
        group:
          - spellcasting-slots-set
        activities:
          - type: numberIncrement
            target:
              fact: spellcasting.slots.level1.total
            source:
              number: 2
```

Without `requires: [spellcasting]`, the `after: group: spellcasting-slots-total` reference would point to a non-existent group (the engine treats this as already satisfied, meaning the rule would execute immediately with no reset having occurred).

### `after` — Execution Ordering

See Section 3. This controls the order rules execute within a single phase.

---

## 5. Common Patterns

### Pattern: Reset-Then-Modify

**Use when:** Multiple rule groups contribute to a single value (e.g., proficiency bonus, HP).

**Base rule group** (reset to base value):
```yaml
- id: proficiency-reset
  phase: early
  group:
    - proficiency-base
  activities:
    - type: numberSet
      target:
        fact: proficiency.bonus
      source:
        number: 0
```

**Contributing rule group** (add to the value):
```yaml
- id: paladin-level1-proficiency
  phase: early
  after:
    - group: proficiency-base
  activities:
    - type: numberIncrement
      target:
        fact: proficiency.bonus
      source:
        number: 2
```

### Pattern: Reset-Then-Copy (Resource Pool)

**Use when:** A "max" value is set once, then copied to "remaining" at the start of each turn.

```yaml
# Set max
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

# Copy max to remaining (after max is settled)
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

### Pattern: Reset-Modify-Then-Copy (Slot Pool)

**Use when:** Multiple rule groups contribute to a "total" that is then copied to "remaining". See the Two-Group Pattern in Section 3.

Chain: `reset total to 0` -> `modifiers increment total` -> `copy total to remaining`

### Pattern: Offer Rule With Legality Checks

**Use when:** Presenting an action the user can choose, with conditions that determine if it's legal.

```yaml
- id: action-move-walk-offer
  after:
    - group: half-movement-remaining
  activities:
    - type: offerRule
      legalWhen:                          # All conditions must pass for legality
        - condition:
            fact: character.movement.remaining
            operator: greaterThanOrEqual
            value: 5
          illegalDiagnostics:             # Shown when this condition fails
            - code: rule.dnd-5e-2024.movement.action-move-walk-offer.out_of_movement
              severity: error
      rule:
        id: move-walk
        ui:
          model: move
          section: move
          name: rule.dnd-5e-2024.movement.move-walk.name
        group:
          - move                          # Consume this group so others can wait
        vars:
          distance:
            capture: true                 # Snapshot value when added to plan
            default:
              fact: character.movement.remaining
        activities:
          - type: numberIncrement
            target:
              fact: character.movement.remaining
            source:
              var: distance               # Uses captured or default value
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
# Only offer swim when swim cost equals 1
- id: action-move-swim-offer
  when:                                   # Applicability gate — rule doesn't execute at all
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
  - *error-clear                          # Clear errors from previous evaluation
  - type: numberIncrement
    target:
      fact: actions.remaining
    source:
      number: 1
    subtract: true
  - type: setAdd                          # Add error if remaining went negative
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
    - half-movement-total                 # Others can wait on this
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
    - species-constants                   # Movement rules wait for this
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
  # Consume resources
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
  # Advertise persistent effect
  - type: advertiseEffect
    rule:
      id: effect-my-spell-l1
      ui:
        section: action-spell
        name: rule.my-spell.effect-my-spell-l1.name
      phase: early
      after:
        - group: spellcasting-slots-set    # Effect participates in slot tracking
      group:
        - spell-slot-effect
      activities:
        - type: numberIncrement
          target:
            fact: spellcasting.slots.level1.remaining
          source:
            number: 1
          subtract: true                    # Continue consuming the slot each turn
        - type: advertiseEffect
          self: true                        # Self-sustain until condition fails
          when:
            fact: rest.long
            operator: equals
            value: 0                        # Expire on long rest
  # Error tracking
  - *error-clear
  # ... setAdd for error conditions
```

Key points:
- `advertiseEffect` creates a rule that persists in `effects` across evaluations.
- `self: true` re-advertises the effect each turn (self-sustaining).
- The effect expires when its `when` condition is false (omitting `advertiseEffect self: true` also removes it).
- Effects get unique IDs with numeric suffixes to avoid collisions.

---

## 6. Conventions

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
- `proficiency-base` — The base proficiency reset
- `spellcasting-slots-total` — When slot totals are ready
- `spellcasting-slots-set` — When all slot modifications are done
- `species-constants` — When species base values are set
- `action-max` — When action maximum is set

### Rule ID Naming

Rule IDs should be descriptive and namespaced:
- `{category}-{feature}-{action}`: `action-move-walk-offer`
- `{category}-{feature}-{modifier}`: `paladin-level1-proficiency`
- `{category}-{reset}`: `proficiency-reset`, `spellcasting-slots-reset`

---

## 7. Testing and Verification

### Automated

- **`make test`** — Runs unit tests including translation completeness checks
- **Schema validation** — The `schema.json` file provides validation via yaml-language-server in editors

### Syncing to Test Environment

- **`make sync-rule-groups`** — Syncs YAML definitions to the test DynamoDB table
- **`make deploy-test`** — Full deployment including rule group sync

### Manual Verification Checklist

1. All rule groups have `en` and `en-x-tlh` translations with `name`, `description`, and `keywords`
2. Every YAML file has the schema comment on line 1
3. All `after` references point to groups that actually exist in the same phase
4. Reset rules declare groups; modifier rules wait for those groups
5. No rule waits on a group it belongs to (self-dependency cycle)
6. All `requires` references point to existing rule group IDs
7. User-facing strings use i18n keys, not hardcoded text
8. The `*error-clear` anchor is used before any `setAdd` to the `errors` var

---

## 8. Activity Types Reference

| Type | Description | Key Fields |
|------|-------------|------------|
| `numberSet` | Set fact to value (overwrite) | `target.fact`, `source` |
| `numberIncrement` | Add/subtract from fact | `target.fact`, `source`, `subtract?: true` |
| `numberCopy` | Copy value between facts | `source.fact`, `target.fact` |
| `numberSum` | Sum multiple sources | `target.fact`, `sources[]` |
| `numberFunction` | Apply named function | `function`, `sources[]`, `target.fact`, `args` |
| `emitEvent` | Emit transient event | `event` |
| `generateRule` | Create rule for later phase | `rule` |
| `offerRule` | Offer choice to UI | `rule`, `legalWhen[]` |
| `setClear` | Clear var array | `target.var` |
| `setAdd` | Add string to var array | `target.var`, `source.string` |
| `advertiseEffect` | Persistent cross-turn effect | `rule` or `self: true` |

### Source Types

| Type | Example | Description |
|------|---------|-------------|
| `number` | `{number: 5}` | Literal numeric value |
| `fact` | `{fact: proficiency.bonus}` | Reference to a fact |
| `var` | `{var: distance}` | Reference to a rule variable |
| `condition` | `{condition: {fact: x, operator: equals, value: 0}}` | Evaluates to 1 or 0 |
| `string` | `{string: rule.error.key}` | Literal string (i18n key) |

### Comparison Operators

`equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`

---

## 9. Dependency Graph Visualization

Here is the dependency graph for the base D&D 5e 2024 rule groups with a Paladin:

```
Phase: early
  species-constants ──────────────────> action-move-reset
  (species-human)                       (movement)
       │                                     │
       └── sets movement.total               └── copies total to remaining
                                            (after species-constants)

  proficiency-base ─────────────────> paladin-level1-proficiency
  (proficiency)                        (class-paladin-level1)
       │                                     │
       └── sets bonus to 0                    └── increments bonus by 2
                                            (after proficiency-base)

  spellcasting-max ──────> spellcasting-reset
  (spellcasting)            (spellcasting)
       │                        │
       └── sets max to 1        └── copies max to remaining
                              (after spellcasting-max)

  spellcasting-slots-total ──> paladin-level1-spell-slots ──> spellcasting-slots-reset
  (spellcasting)                (class-paladin-level1)          (spellcasting)
       │                              │                           │
       └── resets totals to 0          └── adds +2 to level1      └── copies totals to remaining
                                    (after slots-total,        (after slots-set)
                                     joins slots-set)

  rest-reset
  (turn-rest)
       │
       └── sets rest.long to 0

  turn-counter
  (turn-rest)
       │
       └── increments turn.counter by 1

Phase: normal
  half-movement-total ──> ... ──> half-movement-remaining ──> offer rules
  (movement)                (movement, after move group)       (movement)
```
