#!/usr/bin/env python3
"""
Tests for loader module — YAML parsing with anchor resolution.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_loader.py -v
"""

import pytest
from pathlib import Path

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.loader import load_source_file, SourceDocument
from rule_preprocessor.models import Definition, Profile, Expansion


FIXTURES_DIR = Path(__file__).parent / "fixtures"


class TestLoadSourceFile:
    """Tests for loading and parsing YAML source files."""

    def test_plain_rule_groups_passthrough(self, tmp_path):
        """Should load plain ruleGroups without preprocessor constructs."""
        source = tmp_path / "plain.yaml"
        source.write_text("""
ruleGroups:
  - id: test-group
    translations:
      en:
        name: Test
        description: Test desc
        keywords: [test]
      en-x-tlh:
        name: Test
        description: Test desc
        keywords: [test]
    rules:
      - id: test-rule
        activities:
          - type: emitEvent
            event: test.event
""")
        doc = load_source_file(source)
        assert doc.rule_groups is not None
        assert len(doc.rule_groups) == 1
        assert doc.rule_groups[0]["id"] == "test-group"
        assert doc.definitions == []
        assert doc.profiles == []
        assert doc.expansions == []

    def test_definitions_only(self, tmp_path):
        """Should load definitions from source file."""
        source = tmp_path / "defs.yaml"
        source.write_text("""
definitions:
  - id: dagger
    kind: option
    tags: [attack, weapon]
    payload:
      activities:
        - type: emitEvent
          event: attack.made
    translations:
      en:
        name: Dagger
        description: Dagger
        keywords: [dagger]
      en-x-tlh:
        name: Dagger
        description: Dagger
        keywords: [dagger]
""")
        doc = load_source_file(source)
        assert len(doc.definitions) == 1
        assert isinstance(doc.definitions[0], Definition)
        assert doc.definitions[0].id == "dagger"
        assert doc.definitions[0].kind == "option"

    def test_profiles_only(self, tmp_path):
        """Should load profiles from source file."""
        source = tmp_path / "profiles.yaml"
        source.write_text("""
profiles:
  - id: use-action
    match:
      tags: [attack]
    emit:
      mode: offerRule
""")
        doc = load_source_file(source)
        assert len(doc.profiles) == 1
        assert isinstance(doc.profiles[0], Profile)
        assert doc.profiles[0].id == "use-action"

    def test_expansions_only(self, tmp_path):
        """Should load expansions from source file."""
        source = tmp_path / "expansions.yaml"
        source.write_text("""
expansions:
  - id: option-activations
    includeDefinitions:
      kind: option
      tags: [attack]
    includeProfiles:
      - use-action
    emit:
      mode: offerRule
      ruleGroupIdPattern: "gen-$(definition.id)-$(profile.id)"
""")
        doc = load_source_file(source)
        assert len(doc.expansions) == 1
        assert isinstance(doc.expansions[0], Expansion)
        assert doc.expansions[0].id == "option-activations"

    def test_mixed_source(self, tmp_path):
        """Should load a mix of ruleGroups and preprocessor constructs."""
        source = tmp_path / "mixed.yaml"
        source.write_text("""
ruleGroups:
  - id: existing
    translations:
      en: {name: E, description: E, keywords: []}
      en-x-tlh: {name: E, description: E, keywords: []}

definitions:
  - id: dagger
    payload:
      activities:
        - type: emitEvent
          event: attack.made
    translations:
      en: {name: D, description: D, keywords: []}
      en-x-tlh: {name: D, description: D, keywords: []}

profiles:
  - id: use-action
    match:
      tags: [attack]

expansions:
  - id: expand
    includeProfiles: [use-action]
""")
        doc = load_source_file(source)
        assert len(doc.rule_groups) == 1
        assert len(doc.definitions) == 1
        assert len(doc.profiles) == 1
        assert len(doc.expansions) == 1

    def test_anchor_resolution(self, tmp_path):
        """Should resolve YAML anchors when shared definitions are provided."""
        source = tmp_path / "with-anchor.yaml"
        shared = tmp_path / "_shared" / "definitions.yaml"
        shared.parent.mkdir(parents=True, exist_ok=True)
        shared.write_text("""
refs:
  error-clear: &error-clear
    type: setClear
    target:
      var: errors
""")
        source.write_text("""
definitions:
  - id: test
    payload:
      activities:
        - *error-clear
    translations:
      en: {name: T, description: T, keywords: []}
      en-x-tlh: {name: T, description: T, keywords: []}
""")
        doc = load_source_file(source, shared_definitions_file=shared)
        assert len(doc.definitions) == 1
        act = doc.definitions[0].payload["activities"][0]
        assert act["type"] == "setClear"

    def test_unsupported_top_level_key_raises(self, tmp_path):
        """Should raise PreprocessorError for unsupported top-level keys."""
        source = tmp_path / "bad.yaml"
        source.write_text("""
unknownKey: value
definitions:
  - id: test
    payload:
      activities: []
    translations:
      en: {name: T, description: T, keywords: []}
      en-x-tlh: {name: T, description: T, keywords: []}
""")
        with pytest.raises(PreprocessorError, match="unsupported"):
            load_source_file(source)

    def test_empty_file(self, tmp_path):
        """Should handle empty YAML files gracefully."""
        source = tmp_path / "empty.yaml"
        source.write_text("")
        doc = load_source_file(source)
        assert doc.rule_groups is None or doc.rule_groups == []
        assert doc.definitions == []
        assert doc.profiles == []
        assert doc.expansions == []
