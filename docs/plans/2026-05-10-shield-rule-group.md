# Shield Rule Group Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a shield equipment rule group that grants +2 AC, follows the splint armor don/doff pattern, warns (not errors) when not proficient, and imposes no disadvantages.

**Architecture:** Shield is a `dnd-5e-2024` rule group requiring `ac`. It uses the same offer/effect pattern as splint armor but is much simpler — no disadvantages, no Dex override, no speed penalty. The `ac.shieldBonus` fact is already wired into `ac.yaml`'s AC sum, and Paladin L1 already sets `armor.shield.proficient`.

**Tech Stack:** YAML rule groups, i18n JSON, Vitest yaml-scenario tests

---

### Task 1: Create the shield rule group YAML

**Files:**
- Create: `data/rule-groups/dnd-5e-2024/shield.yaml`

**Step 1: Write the rule group**

```yaml
# yaml-language-server: $schema=../schema.json
ruleGroups:
  - id: shield
    requires:
      - ac
    translations:
      en:
        name: Shield
        description: A shield that grants +2 AC when equipped
        keywords: [shield, armor, ac, equipment]
      en-x-tlh:
        name: DIch
        description: DIch naQ, DIvI' 2 DIch Jun
        keywords: [DIch, Jun]
    rules:
      # Offer to equip shield
      - id: don-shield-offer
        after:
          - group: __planned__
          - group: ac-components
        activities:
          - type: offerRule
            legalWhen:
              - condition:
                  fact: armor.shield.equipped
                  operator: notEquals
                  value: 1
                illegalDiagnostics:
                  - code: rule.dnd-5e-2024.shield.don-shield-offer.already-equipped
                    severity: error
              - condition:
                  fact: armor.shield.proficient
                  operator: equals
                  value: 1
                illegalDiagnostics:
                  - code: rule.dnd-5e-2024.shield.don-shield-offer.not-proficient
                    severity: warning
            rule:
              id: don-shield
              phase: normal
              after:
                - group: ac-calculation
                - group: ac-dex
              group:
                - ac-components
              ui:
                section: configuration
                name: rule.dnd-5e-2024.shield.don-shield.name
              activities:
                # Shield grants +2 AC
                - type: numberIncrement
                  target:
                    fact: ac.shieldBonus
                  source:
                    number: 2
                - type: numberSet
                  target:
                    fact: armor.shield.equipped
                  source:
                    number: 1
                # Persistent effect
                - type: advertiseEffect
                  rule:
                    id: effect-shield
                    phase: normal
                    after:
                      - group: ac-calculation
                      - group: ac-dex
                    group:
                      - ac-components
                    ui:
                      name: rule.dnd-5e-2024.shield.effect-shield.name
                    activities:
                      - type: numberIncrement
                        target:
                          fact: ac.shieldBonus
                        source:
                          number: 2
                      - type: numberSet
                        target:
                          fact: armor.shield.equipped
                        source:
                          number: 1
                      - type: advertiseEffect
                        self: true
```

**Step 2: Run tests to verify no regressions**

Run: `make test`
Expected: All existing tests pass. The new rule group file is not yet loaded by any test.

**Step 3: Commit**

```
feat: add shield rule group definition
```

---

### Task 2: Add i18n translations

**Files:**
- Modify: `src/lib/i18n/en/common.json`
- Modify: `src/lib/i18n/en-x-tlh/common.json`

**Step 1: Add English translations**

Insert after the `splint-armor` block (around line 753 in `en/common.json`), inside `rule.dnd-5e-2024`:

```json
"shield": {
  "don-shield": {
    "name": "Don Shield"
  },
  "don-shield-offer": {
    "already-equipped": "Shield is already equipped",
    "not-proficient": "Not proficient with shields"
  },
  "effect-shield": {
    "name": "Shield"
  }
}
```

**Step 2: Add Klingon translations**

Same insertion point in `en-x-tlh/common.json`:

```json
"shield": {
  "don-shield": {
    "name": "DIch tuQ"
  },
  "don-shield-offer": {
    "already-equipped": "DIch tuQtaH",
    "not-proficient": "DIch SuvwI' DIch DIron"
  },
  "effect-shield": {
    "name": "DIch"
  }
}
```

**Step 3: Run tests**

Run: `make test`
Expected: All tests pass including translation completeness checks.

**Step 4: Commit**

```
feat: add shield i18n translations
```

---

### Task 3: Create test — Shield AC bonus

**Files:**
- Create: `tests/integration/rules-engine/yaml-scenarios/shield-ac/test.yaml`

**Step 1: Write the test**

```yaml
name: 'Shield AC'
description: 'AC increases by 2 when shield is donned'
ruleGroups:
  - dnd-5e-2024/ac
  - dnd-5e-2024/shield
steps:
  - evaluate:
      assert:
        facts:
          ac.base: 10
          ac.shieldBonus: 0
          ac.value: 10
        offers:
          exists:
            - don-shield
  - addOffer:
      id: don-shield
      assert:
        facts:
          ac.shieldBonus: 2
          ac.value: 12
          armor.shield.equipped: 1
  - endTurn:
      assert:
        facts:
          ac.shieldBonus: 2
          ac.value: 12
          armor.shield.equipped: 1
```

**Step 2: Run the test**

Run: `make test`
Expected: PASS

**Step 3: Commit**

```
test: add shield AC bonus scenario
```

---

### Task 4: Create test — Shield already equipped

**Files:**
- Create: `tests/integration/rules-engine/yaml-scenarios/shield-already-equipped/test.yaml`

**Step 1: Write the test**

```yaml
name: 'Shield Already Equipped'
description: 'Cannot don shield when already equipped'
ruleGroups:
  - dnd-5e-2024/ac
  - dnd-5e-2024/shield
initialEffects:
  - id: effect-shield
    phase: normal
    after:
      - group: ac-calculation
    group:
      - ac-components
    activities:
      - type: numberIncrement
        target:
          fact: ac.shieldBonus
        source:
          number: 2
      - type: numberSet
        target:
          fact: armor.shield.equipped
        source:
          number: 1
      - type: advertiseEffect
        self: true
steps:
  - evaluate:
      assert:
        facts:
          ac.shieldBonus: 2
          ac.value: 12
          armor.shield.equipped: 1
        offers:
          illegal:
            - don-shield
```

**Step 2: Run the test**

Run: `make test`
Expected: PASS

**Step 3: Commit**

```
test: add shield already-equipped scenario
```

---

### Task 5: Create test — Shield proficiency warning

**Files:**
- Create: `tests/integration/rules-engine/yaml-scenarios/shield-not-proficient-warning/test.yaml`

**Step 1: Write the test**

Verifies that the don-shield offer is illegal with a warning diagnostic when not proficient, and that no disadvantages are imposed.

```yaml
name: 'Shield Not Proficient Warning'
description: 'Don shield is illegal with warning when not proficient, no disadvantages applied'
ruleGroups:
  - dnd-5e-2024/ac
  - dnd-5e-2024/ability-scores
  - dnd-5e-2024/shield
initialFacts:
  armor.shield.proficient: 0
steps:
  - evaluate:
      assert:
        facts:
          ac.value: 10
        offers:
          illegal:
            - don-shield
```

**Step 2: Run the test**

Run: `make test`
Expected: PASS

**Step 3: Commit**

```
test: add shield not-proficient warning scenario
```

---

### Task 6: Create test — Shield proficient (no warning, no disadvantages)

**Files:**
- Create: `tests/integration/rules-engine/yaml-scenarios/shield-proficient/test.yaml`

**Step 1: Write the test**

```yaml
name: 'Shield Proficient'
description: 'No warning or disadvantages when proficient with shields'
ruleGroups:
  - dnd-5e-2024/ac
  - dnd-5e-2024/ability-scores
  - dnd-5e-2024/shield
initialEffects:
  - id: test-shield-proficiency
    phase: early
    activities:
      - type: numberSet
        target:
          fact: armor.shield.proficient
        source:
          number: 1
      - type: advertiseEffect
        self: true
steps:
  - evaluate:
      assert:
        facts:
          armor.shield.proficient: 1
        offers:
          exists:
            - don-shield
  - addOffer:
      id: don-shield
      assert:
        facts:
          ac.shieldBonus: 2
          ac.value: 12
          armor.shield.equipped: 1
          attack.str.disadvantage: 0
          attack.dex.disadvantage: 0
          skill.stealth.disadvantage: 0
```

**Step 2: Run the test**

Run: `make test`
Expected: PASS

**Step 3: Commit**

```
test: add shield proficient scenario
```

---

### Task 7: Create test — Shield with armor (stacks with splint)

**Files:**
- Create: `tests/integration/rules-engine/yaml-scenarios/shield-with-splint-armor/test.yaml`

**Step 1: Write the test**

```yaml
name: 'Shield With Splint Armor'
description: 'Shield +2 AC stacks with splint armor AC 17'
ruleGroups:
  - dnd-5e-2024/ac
  - dnd-5e-2024/ability-scores
  - dnd-5e-2024/splint-armor
  - dnd-5e-2024/shield
initialEffects:
  - id: test-heavy-armor-proficiency
    phase: early
    activities:
      - type: numberSet
        target:
          fact: armor.heavy.proficient
        source:
          number: 1
      - type: numberSet
        target:
          fact: armor.shield.proficient
        source:
          number: 1
      - type: advertiseEffect
        self: true
steps:
  - addOffer:
      id: don-splint-armor
      assert:
        facts:
          ac.base: 17
          ac.dexBonus: 0
          ac.value: 17
  - addOffer:
      id: don-shield
      assert:
        facts:
          ac.shieldBonus: 2
          ac.value: 19
          armor.splint.equipped: 1
          armor.shield.equipped: 1
```

**Step 2: Run the test**

Run: `make test`
Expected: PASS

**Step 3: Commit**

```
test: add shield with splint armor stacking scenario
```

---

### Task 8: Final verification

**Step 1: Run full test suite**

Run: `make test`
Expected: All tests pass.

**Step 2: Verify Paladin L1 still works**

Confirm Paladin L1 already sets `armor.shield.proficient` to 1 — no changes needed to `class-paladin/level1.yaml`.
