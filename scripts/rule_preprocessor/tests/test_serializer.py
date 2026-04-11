#!/usr/bin/env python3
"""
Tests for serializer module — YAML output generation.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_serializer.py -v
"""

import pytest
from pathlib import Path

import yaml

from rule_preprocessor.serializer import serialize_rule_groups, write_output_files


class TestSerializeRuleGroups:
    """Tests for YAML serialization of rule groups."""

    def test_single_rule_group(self):
        """Should serialize a rule group to valid YAML with ruleGroups wrapper."""
        rgs = [
            {
                "id": "gen-dagger-action",
                "translations": {
                    "en": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                    "en-x-tlh": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                },
                "rules": [
                    {
                        "id": "dagger-action-offer",
                        "phase": "normal",
                        "activities": [{"type": "offerRule", "id": "offer-1", "rule": {"id": "inner", "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}]}}],
                    }
                ],
            }
        ]
        result = serialize_rule_groups(rgs, "data/rule-sources/weapons.yaml", "option-activations", "dagger", "use-action")
        data = yaml.safe_load(result)
        assert "ruleGroups" in data
        assert len(data["ruleGroups"]) == 1
        assert data["ruleGroups"][0]["id"] == "gen-dagger-action"

    def test_provenance_comments(self):
        """Should include provenance comments in generated YAML."""
        rgs = [{"id": "test", "translations": {"en": {"name": "N", "description": "D", "keywords": []}, "en-x-tlh": {"name": "N", "description": "D", "keywords": []}}, "rules": []}]
        result = serialize_rule_groups(rgs, "src.yaml", "expand-id", "def-id", "prof-id")
        assert "GENERATED FILE" in result
        assert "source: src.yaml" in result
        assert "expansion: expand-id" in result
        assert "definition: def-id" in result
        assert "profile: prof-id" in result

    def test_schema_comment(self):
        """Should include yaml-language-server schema comment."""
        rgs = [{"id": "test", "translations": {"en": {"name": "N", "description": "D", "keywords": []}, "en-x-tlh": {"name": "N", "description": "D", "keywords": []}}, "rules": []}]
        result = serialize_rule_groups(rgs, "src.yaml", None, None, None)
        assert "$schema=" in result


class TestWriteOutputFiles:
    """Tests for writing output to the build directory."""

    def test_writes_files_to_output_dir(self, tmp_path):
        """Should write one YAML file per rule group to output directory."""
        rgs = [
            {"id": "gen-a", "translations": {"en": {"name": "A", "description": "A", "keywords": []}, "en-x-tlh": {"name": "A", "description": "A", "keywords": []}}, "rules": []},
            {"id": "gen-b", "translations": {"en": {"name": "B", "description": "B", "keywords": []}, "en-x-tlh": {"name": "B", "description": "B", "keywords": []}}, "rules": []},
        ]
        provenance = {"source_file": "src.yaml", "expansion_id": "exp", "definition_id": "d", "profile_id": "p"}
        write_output_files(rgs, tmp_path, provenance)
        files = list(tmp_path.glob("*.yaml"))
        assert len(files) == 2
        ids = sorted([f.stem for f in files])
        assert "gen-a" in ids
        assert "gen-b" in ids

    def test_output_is_valid_yaml(self, tmp_path):
        """Written files should be valid YAML parseable by yaml.safe_load."""
        rgs = [
            {"id": "gen-test", "translations": {"en": {"name": "T", "description": "T", "keywords": []}, "en-x-tlh": {"name": "T", "description": "T", "keywords": []}}, "rules": [{"id": "r1", "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}]}]},
        ]
        provenance = {"source_file": "src.yaml"}
        write_output_files(rgs, tmp_path, provenance)
        f = tmp_path / "gen-test.yaml"
        assert f.exists()
        data = yaml.safe_load(f.read_text())
        assert data["ruleGroups"][0]["id"] == "gen-test"

    def test_empty_output_no_files_written(self, tmp_path):
        """Should write no files when rule groups list is empty."""
        provenance = {}
        write_output_files([], tmp_path, provenance)
        files = list(tmp_path.glob("*.yaml"))
        assert len(files) == 0
