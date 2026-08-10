#!/usr/bin/env python3
"""
Unit tests for sync_rule_groups.py

Run with: python -m pytest scripts/test_sync_rule_groups.py -v
"""

import json

import pytest
from pathlib import Path
from sync_rule_groups import (
    build_rule_group_item,
    cleanup_old_search_entries,
    load_shared_definitions,
    parse_rule_groups,
    compute_category_hash,
    output_json,
    remove_stale_categories,
)

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

    def test_strips_detail_block(self):
        """Should not include detail prose in DynamoDB item."""
        rule_group = {
            "id": "spell-sleep",
            "translations": {
                "en": {"name": "Sleep", "description": "desc", "keywords": ["sleep"]},
                "en-x-tlh": {"name": "Qong", "description": "desc", "keywords": ["Qong"]},
            },
            "detail": {
                "key": "spell/sleep",
                "source": "srd52",
                "body": "Prose that should not reach DynamoDB.",
            },
            "rules": [{"id": "r1", "activities": []}],
        }

        item = build_rule_group_item(rule_group, NOW)

        assert "detail" not in item


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


class TestOutputJson:
    """Tests for the output_json function."""

    def _create_rule_group(self, tmp_path, category, rg_id, rules_yaml):
        """Helper to create a rule group YAML file."""
        category_dir = tmp_path / category
        category_dir.mkdir(parents=True, exist_ok=True)
        rule_file = category_dir / f"{rg_id}.yaml"
        rule_file.write_text(
            f"ruleGroups:\n"
            f"  - id: {rg_id}\n"
            f"    translations:\n"
            f"      en:\n"
            f"        name: {rg_id}\n"
            f"        description: test\n"
            f"        keywords: []\n"
            f"    rules:\n{rules_yaml}"
        )

    def test_produces_valid_json(self, tmp_path):
        """Should produce valid JSON file."""
        self._create_rule_group(
            tmp_path, "test-cat", "test-rg",
            "      - id: rule1\n        activities: []\n"
        )
        output_path = str(tmp_path / "output.json")
        output_json(tmp_path, output_path)

        result = json.loads(Path(output_path).read_text())
        assert isinstance(result, dict)

    def test_keys_are_category_slash_id(self, tmp_path):
        """Keys should be formatted as category/rule-group-id."""
        self._create_rule_group(
            tmp_path, "test-cat", "my-group",
            "      - id: rule1\n        activities: []\n"
        )
        output_path = str(tmp_path / "output.json")
        output_json(tmp_path, output_path)

        result = json.loads(Path(output_path).read_text())
        assert "test-cat/my-group" in result

    def test_multiple_categories_and_groups(self, tmp_path):
        """Should handle multiple categories and rule groups."""
        self._create_rule_group(
            tmp_path, "cat-a", "rg-1",
            "      - id: rule1\n        activities: []\n"
        )
        self._create_rule_group(
            tmp_path, "cat-a", "rg-2",
            "      - id: rule2\n        activities: []\n"
        )
        self._create_rule_group(
            tmp_path, "cat-b", "rg-3",
            "      - id: rule3\n        activities: []\n"
        )
        output_path = str(tmp_path / "output.json")
        output_json(tmp_path, output_path)

        result = json.loads(Path(output_path).read_text())
        assert len(result) == 3
        assert "cat-a/rg-1" in result
        assert "cat-a/rg-2" in result
        assert "cat-b/rg-3" in result

    def test_resolves_shared_definitions(self, tmp_path):
        """Shared YAML anchors should be resolved in output."""
        shared_dir = tmp_path / "_shared"
        shared_dir.mkdir()
        (shared_dir / "definitions.yaml").write_text(
            "refs:\n  my-activity: &my-activity\n    type: setClear\n    target: {var: errors}\n"
        )
        self._create_rule_group(
            tmp_path, "test-cat", "test-rg",
            "      - id: rule1\n"
            "        activities:\n"
            "          - *my-activity\n"
        )
        output_path = str(tmp_path / "output.json")
        output_json(tmp_path, output_path)

        result = json.loads(Path(output_path).read_text())
        activities = result["test-cat/test-rg"]["rules"][0]["activities"]
        assert activities[0] == {"type": "setClear", "target": {"var": "errors"}}

    def test_creates_parent_directories(self, tmp_path):
        """Should create parent directories for output path."""
        self._create_rule_group(
            tmp_path, "cat", "rg",
            "      - id: rule1\n        activities: []\n"
        )
        output_path = str(tmp_path / "subdir" / "nested" / "output.json")
        output_json(tmp_path, output_path)

        assert Path(output_path).exists()

    def test_no_categories_exits(self, tmp_path):
        """Should exit with error when no categories found."""
        empty_dir = tmp_path / "empty"
        empty_dir.mkdir()
        output_path = str(tmp_path / "output.json")
        with pytest.raises(SystemExit):
            output_json(empty_dir, output_path)


class FakeTable:
    """Minimal stand-in for a boto3 Table that records delete_item calls."""

    def __init__(self, search_items=None, search_pages=None):
        self.deleted_keys = []
        if search_pages is None:
            search_pages = [search_items] if search_items else []
        self.search_pages = search_pages

    def _page_keys(self):
        return [{"PK": page[-1]["PK"], "SK": page[-1]["SK"]} for page in self.search_pages]

    def query(self, **kwargs):
        # Serves the configured search-index pages like DynamoDB: page N+1 is
        # only reachable by passing page N's LastEvaluatedKey back as
        # ExclusiveStartKey; omitting it always restarts from the first page.
        start = kwargs.get("ExclusiveStartKey")
        index = 0 if start is None else self._page_keys().index(start) + 1
        if index >= len(self.search_pages):
            return {"Items": []}
        response = {"Items": list(self.search_pages[index])}
        if index + 1 < len(self.search_pages):
            response["LastEvaluatedKey"] = self._page_keys()[index]
        return response

    def delete_item(self, Key):
        self.deleted_keys.append(Key)


class TestCleanupOldSearchEntriesPagination:
    """Tests for cleanup_old_search_entries across paginated gsi1 queries."""

    def test_follows_last_evaluated_key_across_pages(self):
        """Every page of stale entries is deleted, not just the first."""
        page1 = [
            {"PK": "LANG#en#PREFIX#gen", "SK": "SCORE#0002#RULEGROUP#gen-a"},
            {"PK": "LANG#en#PREFIX#gene", "SK": "SCORE#0002#RULEGROUP#gen-a"},
        ]
        page2 = [{"PK": "LANG#en#PREFIX#gen", "SK": "SCORE#0001#RULEGROUP#gen-b"}]
        table = FakeTable(search_pages=[page1, page2])

        deleted = cleanup_old_search_entries(
            table, "generated", "2026-01-01T00:00:00+00:00", dry_run=False, verbose=False
        )

        assert deleted == 3
        for item in page1 + page2:
            assert {"PK": item["PK"], "SK": item["SK"]} in table.deleted_keys


class TestRemoveStaleCategories:
    """Tests for the remove_stale_categories function."""

    def _records(self):
        return {
            "dnd-5e-2024": {"ids": ["rg-keep"], "contentHash": "x"},
            "generated": {"ids": ["gen-a", "gen-b"], "contentHash": "y"},
        }

    def test_deletes_rule_groups_search_entries_and_directory_record(self):
        """A stored category absent from disk loses its rows, index, and record."""
        search_item = {"PK": "LANG#en#PREFIX#gen", "SK": "SCORE#0002#RULEGROUP#gen-a"}
        table = FakeTable(search_items=[search_item])

        stats = remove_stale_categories(
            table, self._records(), {"dnd-5e-2024"}, dry_run=False, verbose=False
        )

        assert {"PK": "RULEGROUP#gen-a", "SK": "META#"} in table.deleted_keys
        assert {"PK": "RULEGROUP#gen-b", "SK": "META#"} in table.deleted_keys
        assert {"PK": search_item["PK"], "SK": search_item["SK"]} in table.deleted_keys
        assert {"PK": "RULEGROUPDIRECTORY#", "SK": "CATEGORY#generated"} in table.deleted_keys
        assert stats == {"categoriesRemoved": 1, "deleted": 2, "searchDeleted": 1}

    def test_noop_when_all_stored_categories_still_exist(self):
        """Nothing is deleted when every stored category is still on disk."""
        table = FakeTable()

        stats = remove_stale_categories(
            table, self._records(), {"dnd-5e-2024", "generated"}, dry_run=False, verbose=False
        )

        assert table.deleted_keys == []
        assert stats == {"categoriesRemoved": 0, "deleted": 0, "searchDeleted": 0}

    def test_dry_run_reports_but_deletes_nothing(self):
        """Dry run counts what it would delete without touching the table."""
        search_item = {"PK": "LANG#en#PREFIX#gen", "SK": "SCORE#0002#RULEGROUP#gen-a"}
        table = FakeTable(search_items=[search_item])

        stats = remove_stale_categories(
            table, self._records(), {"dnd-5e-2024"}, dry_run=True, verbose=False
        )

        assert table.deleted_keys == []
        assert stats == {"categoriesRemoved": 1, "deleted": 2, "searchDeleted": 1}
