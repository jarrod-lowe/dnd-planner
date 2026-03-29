#!/usr/bin/env python3
"""
Unit tests for sync_rule_groups.py

Run with: python -m pytest scripts/test_sync_rule_groups.py -v
"""

import pytest
from pathlib import Path
from sync_rule_groups import build_rule_group_item, load_shared_definitions, parse_rule_groups, compute_category_hash

NOW = "2024-01-15T12:00:00Z"


class TestBuildRuleGroupItem:
    """Tests for the build_rule_group_item function."""

    def test_builds_item_with_translations(self):
        """Should build DynamoDB item with translations object."""
        rule_group = {
            "id": "test-rule-group",
            "translations": {
                "en": {
                    "name": "Test Rule Group",
                    "description": "A test rule group",
                    "keywords": ["test", "example"]
                },
                "en-x-tlh": {
                    "name": "Test raD naQ",
                    "description": "Test DIvI' Hol",
                    "keywords": ["ratlh"]
                }
            },
            "rules": [{"id": "rule1", "activities": []}]
        }

        item = build_rule_group_item(rule_group, NOW)

        assert item["PK"] == "RULEGROUP#test-rule-group"
        assert item["SK"] == "META#"
        assert item["type"] == "RULEGROUP"
        assert item["ruleGroupId"] == "test-rule-group"
        assert "translations" in item
        assert item["translations"]["en"]["name"] == "Test Rule Group"
        assert item["translations"]["en-x-tlh"]["name"] == "Test raD naQ"
        assert "name" not in item  # Old field should not exist

    def test_translations_required(self):
        """Should require translations field in rule group."""
        rule_group = {
            "id": "test-rule-group",
            "rules": []
        }

        with pytest.raises(KeyError):
            build_rule_group_item(rule_group, NOW)

    def test_preserves_created_at(self):
        """Should preserve createdAt if provided."""
        rule_group = {
            "id": "test-rule-group",
            "translations": {
                "en": {
                    "name": "Test",
                    "description": "Test",
                    "keywords": []
                },
                "en-x-tlh": {
                    "name": "Test",
                    "description": "Test",
                    "keywords": []
                }
            },
            "createdAt": "2024-01-01T00:00:00Z"
        }

        item = build_rule_group_item(rule_group, NOW)

        assert item["createdAt"] == "2024-01-01T00:00:00Z"


class TestLoadSharedDefinitions:
    """Tests for the load_shared_definitions function."""

    def test_returns_empty_string_when_no_shared_dir(self, tmp_path):
        """Should return empty string when no _shared directory exists."""
        # tmp_path acts as category dir; _shared would be in its parent
        category_dir = tmp_path / "category"
        category_dir.mkdir()
        result = load_shared_definitions(category_dir)
        assert result == ""

    def test_returns_empty_string_when_no_definitions_file(self, tmp_path):
        """Should return empty string when _shared dir exists but no definitions.yaml."""
        (tmp_path / "_shared").mkdir()
        category_dir = tmp_path / "category"
        category_dir.mkdir()
        result = load_shared_definitions(category_dir)
        assert result == ""

    def test_returns_content_when_definitions_exist(self, tmp_path):
        """Should return file content when _shared/definitions.yaml exists."""
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()
        definitions = shared_dir / "definitions.yaml"
        definitions.write_text("refs:\n  my-anchor: &my-anchor\n    key: value\n")

        category_dir = tmp_path / "category"
        category_dir.mkdir()
        result = load_shared_definitions(category_dir)
        assert "my-anchor" in result
        assert "key: value" in result


class TestParseRuleGroupsWithSharedDefinitions:
    """Tests for parse_rule_groups with shared anchor definitions."""

    def test_resolves_shared_anchors(self, tmp_path):
        """Should resolve YAML anchors from shared definitions."""
        # Create shared definitions at parent level
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()
        definitions = shared_dir / "definitions.yaml"
        definitions.write_text(
            "refs:\n"
            "  error-clear: &error-clear\n"
            "    type: setClear\n"
            "    target:\n"
            "      var: errors\n"
        )

        # category_dir is the category (e.g., dnd-5e-2024)
        category_dir = tmp_path / "dnd-5e-2024"
        category_dir.mkdir()

        # Create a rule group file using the anchor
        rule_file = category_dir / "test.yaml"
        rule_file.write_text(
            "ruleGroups:\n"
            "  - id: test-group\n"
            "    translations:\n"
            "      en:\n"
            "        name: Test\n"
            "        description: Test\n"
            "        keywords: []\n"
            "    rules:\n"
            "      - id: test-rule\n"
            "        activities:\n"
            "          - *error-clear\n"
        )

        result = parse_rule_groups(category_dir)

        assert len(result) == 1
        activities = result[0]["rules"][0]["activities"]
        assert len(activities) == 1
        assert activities[0] == {"type": "setClear", "target": {"var": "errors"}}

    def test_skips_shared_directory(self, tmp_path):
        """Should not parse YAML files in the _shared directory."""
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()
        definitions = shared_dir / "definitions.yaml"
        definitions.write_text("refs:\n  x: &x\n    key: value\n")

        category_dir = tmp_path / "category"
        category_dir.mkdir()

        # No other YAML files in category - should return empty
        result = parse_rule_groups(category_dir)
        assert result == []

    def test_works_without_shared_definitions(self, tmp_path):
        """Should still work normally when no shared definitions exist."""
        category_dir = tmp_path / "category"
        category_dir.mkdir()
        rule_file = category_dir / "test.yaml"
        rule_file.write_text(
            "ruleGroups:\n"
            "  - id: test-group\n"
            "    translations:\n"
            "      en:\n"
            "        name: Test\n"
            "        description: Test\n"
            "        keywords: []\n"
            "    rules: []\n"
        )

        result = parse_rule_groups(category_dir)
        assert len(result) == 1
        assert result[0]["id"] == "test-group"


class TestComputeCategoryHashWithSharedDefinitions:
    """Tests for compute_category_hash with shared definitions."""

    def test_hash_includes_shared_definitions(self, tmp_path):
        """Hash should change when shared definitions change."""
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()

        category_dir = tmp_path / "category"
        category_dir.mkdir()

        # Create a rule file
        rule_file = category_dir / "test.yaml"
        rule_file.write_text("ruleGroups: []\n")

        # Hash with first version of definitions
        definitions = shared_dir / "definitions.yaml"
        definitions.write_text("refs:\n  x: &x\n    key: value1\n")
        hash1 = compute_category_hash(category_dir)

        # Hash with changed definitions
        definitions.write_text("refs:\n  x: &x\n    key: value2\n")
        hash2 = compute_category_hash(category_dir)

        assert hash1 != hash2

    def test_hash_excludes_shared_from_file_scanning(self, tmp_path):
        """Should not include _shared files in individual file hashing."""
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()
        definitions = shared_dir / "definitions.yaml"
        definitions.write_text("refs:\n  x: &x\n    key: value\n")

        category_dir = tmp_path / "category"
        category_dir.mkdir()
        rule_file = category_dir / "test.yaml"
        rule_file.write_text("ruleGroups: []\n")

        hash1 = compute_category_hash(category_dir)

        # Change definitions (but hash already includes it separately)
        definitions.write_text("refs:\n  y: &y\n    key: other\n")
        hash2 = compute_category_hash(category_dir)

        # Hashes should differ because shared defs are included
        assert hash1 != hash2
