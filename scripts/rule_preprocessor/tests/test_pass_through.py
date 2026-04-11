#!/usr/bin/env python3
"""
Tests for pass-through behavior and CLI integration.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_pass_through.py -v
"""

import pytest
from pathlib import Path

import yaml

from rule_preprocessor.__main__ import preprocess


class TestPassThrough:
    """Tests for plain ruleGroups passing through unchanged."""

    def test_empty_source_dir(self, tmp_path):
        """Should produce no output when source dir is empty."""
        source_dir = tmp_path / "sources"
        source_dir.mkdir()
        output_dir = tmp_path / "output"
        result = preprocess(source_dir, output_dir)
        assert result == []

    def test_plain_rule_groups_no_expansions(self, tmp_path):
        """Should produce no generated output when no expansions present."""
        source_dir = tmp_path / "sources"
        source_dir.mkdir()
        (source_dir / "plain.yaml").write_text("""
ruleGroups:
  - id: test-group
    translations:
      en: {name: Test, description: Test desc, keywords: [test]}
      en-x-tlh: {name: Test, description: Test desc, keywords: [test]}
    rules:
      - id: test-rule
        activities:
          - type: emitEvent
            event: test.event
""")
        output_dir = tmp_path / "output"
        result = preprocess(source_dir, output_dir)
        # No expansions means no generated output
        assert result == []


class TestIntegration:
    """End-to-end integration tests using the full dagger example."""

    def test_dagger_full_example(self, tmp_path):
        """Should generate correct rule groups from the full dagger source."""
        source_dir = tmp_path / "sources"
        source_dir.mkdir()

        # Write the dagger example source
        (source_dir / "weapons.yaml").write_text("""
definitions:
  - id: dagger
    kind: option
    tags: [attack, weapon, melee]
    traits:
      weapon.light: true
      weapon.finesse: true
    ui:
      model: attack
      name: rule.dnd-5e-2024.attack.dagger.name
      section: action-attack
    vars:
      target:
        capture: true
    payload:
      phase: normal
      activities:
        - type: emitEvent
          event: attack.made
          id: dagger-emit
        - type: numberSet
          target:
            fact: attack.last.weapon.light
          source:
            number: 1
          id: dagger-light-set
    translations:
      en:
        name: Dagger
        description: Dagger
        keywords: [dagger, weapon]
      en-x-tlh:
        name: Dagger
        description: Dagger
        keywords: [dagger, weapon]

profiles:
  - id: use-action
    match:
      tags: [attack]
    ui:
      section: action-attack
    gating:
      legalWhen:
        - condition:
            fact: actions.remaining
            operator: greaterThanOrEqual
            value: 1
          illegalDiagnostics:
            - code: rule.dnd-5e-2024.attack.activation.no_action
              severity: error
    wrapper:
      activitiesBefore:
        - type: numberIncrement
          target:
            fact: actions.remaining
          source:
            number: 1
          subtract: true
          id: action-cost
    emit:
      mode: offerRule

  - id: use-reaction-weapon
    match:
      tags: [weapon]
    ui:
      section: reaction
    gating:
      when:
        - fact: capability.attack.reaction.weapon
          operator: equals
          value: 1
      legalWhen:
        - condition:
            fact: reactions.remaining
            operator: greaterThanOrEqual
            value: 1
          illegalDiagnostics:
            - code: rule.dnd-5e-2024.attack.activation.no_reaction
              severity: error
    wrapper:
      activitiesBefore:
        - type: numberIncrement
          target:
            fact: reactions.remaining
          source:
            number: 1
          subtract: true
          id: reaction-cost
    emit:
      mode: offerRule

expansions:
  - id: option-activations
    includeDefinitions:
      kind: option
      tags: [attack]
    includeProfiles:
      - use-action
      - use-reaction-weapon
    emit:
      ruleGroupIdPattern: "generated-$(definition.id)-activations"
      ruleIdPattern: "$(definition.id)-$(profile.id)"
      offerRuleIdPattern: "$(definition.id)-$(profile.id)-offer"
      after:
        - group: option-capabilities
      translations:
        en:
          name: "$(definition.translations.en.name)"
          description: "$(definition.translations.en.description)"
          keywords:
            - "$(definition.id)"
        en-x-tlh:
          name: "$(definition.translations.en-x-tlh.name)"
          description: "$(definition.translations.en-x-tlh.description)"
          keywords:
            - "$(definition.id)"
""")
        output_dir = tmp_path / "output"
        result = preprocess(source_dir, output_dir)

        # Should generate 1 rule group per definition (dagger has 2 matching profiles)
        assert len(result) == 1

        # Check ID
        rg = result[0]
        assert rg["id"] == "generated-dagger-activations"
        assert rg["translations"]["en"]["name"] == "Dagger"
        assert rg["translations"]["en"]["keywords"] == ["dagger"]

        # Should have 2 rules (action + reaction)
        assert len(rg["rules"]) == 2
        rule_ids = [r["id"] for r in rg["rules"]]
        assert "dagger-use-action-offer" in rule_ids
        assert "dagger-use-reaction-weapon-offer" in rule_ids

        # Verify action variant outer rule structure
        action_rule = next(r for r in rg["rules"] if r["id"] == "dagger-use-action-offer")
        assert action_rule["activities"][0]["type"] == "offerRule"
        assert "legalWhen" in action_rule["activities"][0]
        assert action_rule["activities"][0]["legalWhen"][0]["condition"]["fact"] == "actions.remaining"

        # Verify action inner rule has merged activities
        inner = action_rule["activities"][0]["rule"]
        assert inner["id"] == "dagger-use-action"
        # activitiesBefore (1) + definition (2) = 3
        assert len(inner["activities"]) == 3
        assert inner["activities"][0]["target"]["fact"] == "actions.remaining"
        assert inner["activities"][1]["type"] == "emitEvent"
        assert inner["activities"][2]["type"] == "numberSet"

        # Verify inner rule UI merge
        assert inner["ui"]["model"] == "attack"
        assert inner["ui"]["section"] == "action-attack"

        # Verify reaction variant
        reaction_rule = next(r for r in rg["rules"] if r["id"] == "dagger-use-reaction-weapon-offer")
        assert "when" in reaction_rule
        assert reaction_rule["when"][0]["fact"] == "capability.attack.reaction.weapon"

        # Verify files were written in generated/ category subdirectory
        files = list((output_dir / "generated").glob("*.yaml"))
        assert len(files) == 1

        # Verify written files are valid YAML
        for f in files:
            data = yaml.safe_load(f.read_text())
            assert "ruleGroups" in data
            assert len(data["ruleGroups"]) == 1
