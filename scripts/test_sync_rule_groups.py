#!/usr/bin/env python3
"""
Unit tests for sync_rule_groups.py

Run with: python -m pytest scripts/test_sync_rule_groups.py -v
"""

import pytest
from pathlib import Path
from sync_rule_groups import (
    build_rule_group_item,
    load_shared_definitions,
    parse_rule_groups,
    compute_category_hash,
    extract_fact_reads_writes,
    add_auto_groups,
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


class TestExtractFactReadsWrites:
    """Tests for the extract_fact_reads_writes function."""

    def test_number_set_writes_fact(self):
        """numberSet with target.fact counts as a write."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "hp.max"}, "source": {"number": 10}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == {"hp.max"}

    def test_number_set_reads_fact(self):
        """numberSet with source.fact counts as a read."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "hp.current"}, "source": {"fact": "hp.max"}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"hp.max"}
        assert writes == {"hp.current"}

    def test_number_set_source_number_not_read(self):
        """numberSet with source.number does NOT count as a read."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "hp.max"}, "source": {"number": 10}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == {"hp.max"}

    def test_number_increment_implicit_target_read(self):
        """numberIncrement target.fact counts as BOTH read and write."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberIncrement", "target": {"fact": "actions.remaining"}, "source": {"number": -1}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"actions.remaining"}
        assert writes == {"actions.remaining"}

    def test_number_increment_max_read(self):
        """numberIncrement max field counts as a read."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberIncrement",
                    "target": {"fact": "hp.current"},
                    "source": {"number": 5},
                    "max": "hp.max",
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert "hp.max" in reads
        assert "hp.current" in reads  # implicit target read
        assert writes == {"hp.current"}

    def test_number_copy_reads_and_writes(self):
        """numberCopy reads source.fact and writes target.fact."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberCopy", "target": {"fact": "hp.current"}, "source": {"fact": "hp.max"}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"hp.max"}
        assert writes == {"hp.current"}

    def test_number_sum_reads_multiple(self):
        """numberSum reads all sources[].fact and writes target.fact."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberSum",
                    "target": {"fact": "hp.max"},
                    "sources": [{"fact": "hp.base"}, {"fact": "hp.bonus"}],
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"hp.base", "hp.bonus"}
        assert writes == {"hp.max"}

    def test_number_function_reads_sources(self):
        """numberFunction reads sources[].fact and writes target.fact."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberFunction",
                    "function": "statToModifier",
                    "sources": [{"fact": "str.value"}],
                    "target": {"fact": "str.modifier"},
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"str.value"}
        assert writes == {"str.modifier"}

    def test_rule_level_when_reads_fact(self):
        """Rule-level when conditions count as reads."""
        rule = {
            "id": "test",
            "when": [{"fact": "hp.current", "operator": "greaterThan", "value": 0}],
            "activities": [],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"hp.current"}
        assert writes == set()

    def test_activity_level_when_reads_fact(self):
        """Activity-level when conditions count as reads."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberSet",
                    "target": {"fact": "hp.current"},
                    "source": {"number": 10},
                    "when": {"fact": "hp.max", "operator": "greaterThan", "value": 0},
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert "hp.max" in reads
        assert writes == {"hp.current"}

    def test_offer_rule_legal_when_reads(self):
        """offerRule legalWhen conditions count as reads for the parent rule."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "offerRule",
                    "legalWhen": [
                        {
                            "condition": {"fact": "str.value", "operator": "equals", "value": 0},
                            "illegalDiagnostics": [{"code": "test", "severity": "error"}],
                        }
                    ],
                    "rule": {"id": "nested", "activities": []},
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == {"str.value"}
        assert writes == set()

    def test_source_condition_reads_fact(self):
        """source.condition.fact counts as a read."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberSet",
                    "target": {"fact": "is_alive"},
                    "source": {"condition": {"fact": "hp.current", "operator": "greaterThan", "value": 0}},
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert "hp.current" in reads
        assert writes == {"is_alive"}

    def test_target_var_not_counted(self):
        """target.var does NOT count as a write."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"var": "result"}, "source": {"number": 5}},
                {"type": "setClear", "target": {"var": "errors"}},
                {"type": "setAdd", "target": {"var": "errors"}, "source": {"string": "err"}},
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == set()

    def test_source_var_not_counted(self):
        """source.var does NOT count as a read."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "result"}, "source": {"var": "score"}}
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == {"result"}

    def test_emit_event_no_reads_writes(self):
        """emitEvent does not read or write facts."""
        rule = {
            "id": "test",
            "activities": [{"type": "emitEvent", "event": "spell-cast"}],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == set()

    def test_nested_rule_activities_not_scanned(self):
        """extract_fact_reads_writes does NOT recurse into nested rules."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "offerRule",
                    "rule": {
                        "id": "nested",
                        "activities": [
                            {"type": "numberSet", "target": {"fact": "nested.fact"}, "source": {"number": 1}}
                        ],
                    },
                }
            ],
        }
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == set()

    def test_empty_activities(self):
        """Rule with no activities has no reads or writes."""
        rule = {"id": "test", "activities": []}
        reads, writes = extract_fact_reads_writes(rule)
        assert reads == set()
        assert writes == set()

    def test_null_after_handled(self):
        """Rule with after: null (empty YAML after:) doesn't crash."""
        rule = {"id": "test", "after": None, "activities": []}
        # Should not crash
        add_auto_groups(rule)

    def test_null_group_handled(self):
        """Rule with group: null (empty YAML group:) doesn't crash."""
        rule = {"id": "test", "group": None, "activities": []}
        add_auto_groups(rule)


class TestAddAutoGroups:
    """Tests for the add_auto_groups function."""

    def test_write_only_gets_group(self):
        """Rule that only writes a fact gets group but no after."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "hp.max"}, "source": {"number": 10}}
            ],
        }
        add_auto_groups(rule)
        assert "_auto.fact.hp.max" in rule.get("group", [])
        assert not any(
            a["group"] == "_auto.fact.hp.max" for a in rule.get("after", [])
        )

    def test_read_only_gets_after(self):
        """Rule that only reads a fact gets after but no group."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberSet",
                    "target": {"var": "result"},
                    "source": {"fact": "hp.max"},
                }
            ],
        }
        add_auto_groups(rule)
        assert not any(g == "_auto.fact.hp.max" for g in rule.get("group", []))
        assert any(a["group"] == "_auto.fact.hp.max" for a in rule.get("after", []))

    def test_read_write_same_fact_gets_group_only(self):
        """Rule that reads and writes the same fact gets group but NOT after."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberIncrement", "target": {"fact": "proficiency.bonus"}, "source": {"number": 2}}
            ],
        }
        add_auto_groups(rule)
        assert "_auto.fact.proficiency.bonus" in rule.get("group", [])
        assert not any(
            a["group"] == "_auto.fact.proficiency.bonus" for a in rule.get("after", [])
        )

    def test_multiple_writes_get_multiple_groups(self):
        """Rule that writes multiple facts gets multiple groups."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "str.value"}, "source": {"number": 0}},
                {"type": "numberSet", "target": {"fact": "str.modifier"}, "source": {"number": 0}},
            ],
        }
        add_auto_groups(rule)
        assert "_auto.fact.str.value" in rule.get("group", [])
        assert "_auto.fact.str.modifier" in rule.get("group", [])

    def test_multiple_reads_get_multiple_afters(self):
        """Rule that reads multiple facts gets multiple afters."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberSum",
                    "target": {"var": "total"},
                    "sources": [{"fact": "hp.base"}, {"fact": "hp.bonus"}],
                }
            ],
        }
        add_auto_groups(rule)
        after_groups = {a["group"] for a in rule.get("after", [])}
        assert "_auto.fact.hp.base" in after_groups
        assert "_auto.fact.hp.bonus" in after_groups

    def test_read_one_write_other(self):
        """Rule that reads X and writes Y gets after for X and group for Y."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "numberCopy",
                    "target": {"fact": "actions.remaining"},
                    "source": {"fact": "actions.max"},
                }
            ],
        }
        add_auto_groups(rule)
        assert "_auto.fact.actions.remaining" in rule.get("group", [])
        assert not any(
            a["group"] == "_auto.fact.actions.remaining" for a in rule.get("after", [])
        )
        assert any(a["group"] == "_auto.fact.actions.max" for a in rule.get("after", []))
        assert not any(g == "_auto.fact.actions.max" for g in rule.get("group", []))

    def test_deduplication(self):
        """Auto-groups/afters are not added if already present."""
        rule = {
            "id": "test",
            "group": ["_auto.fact.hp.max"],
            "after": [{"group": "_auto.fact.hp.base"}],
            "activities": [
                {
                    "type": "numberSum",
                    "target": {"fact": "hp.max"},
                    "sources": [{"fact": "hp.base"}, {"fact": "hp.bonus"}],
                }
            ],
        }
        add_auto_groups(rule)
        # Should not have duplicates
        assert rule["group"].count("_auto.fact.hp.max") == 1
        after_groups = [a["group"] for a in rule["after"]]
        assert after_groups.count("_auto.fact.hp.base") == 1

    def test_preserves_existing_groups_and_afters(self):
        """Auto-groups are added alongside existing manual groups/afters."""
        rule = {
            "id": "test",
            "group": ["manual-group"],
            "after": [{"group": "manual-after"}],
            "activities": [
                {"type": "numberSet", "target": {"fact": "hp.max"}, "source": {"number": 10}}
            ],
        }
        add_auto_groups(rule)
        assert "manual-group" in rule["group"]
        assert "_auto.fact.hp.max" in rule["group"]
        assert any(a["group"] == "manual-after" for a in rule["after"])

    def test_nested_offer_rule_processed_independently(self):
        """Nested rules in offerRule get their own auto-groups."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "offerRule",
                    "legalWhen": [
                        {
                            "condition": {"fact": "str.value", "operator": "equals", "value": 0},
                            "illegalDiagnostics": [{"code": "test", "severity": "error"}],
                        }
                    ],
                    "rule": {
                        "id": "nested",
                        "activities": [
                            {"type": "numberSet", "target": {"fact": "str.value"}, "source": {"var": "score"}},
                            {
                                "type": "numberFunction",
                                "function": "statToModifier",
                                "sources": [{"var": "score"}],
                                "target": {"fact": "str.modifier"},
                            },
                        ],
                    },
                }
            ],
        }
        add_auto_groups(rule)

        # Parent reads str.value from legalWhen
        parent_after_groups = {a["group"] for a in rule.get("after", [])}
        assert "_auto.fact.str.value" in parent_after_groups

        # Nested rule writes str.value and str.modifier
        nested = rule["activities"][0]["rule"]
        assert "_auto.fact.str.value" in nested.get("group", [])
        assert "_auto.fact.str.modifier" in nested.get("group", [])
        # Nested rule does NOT have after for str.value (not read by nested)

    def test_nested_advertise_effect_processed_independently(self):
        """Nested rules in advertiseEffect get their own auto-groups."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "advertiseEffect",
                    "rule": {
                        "id": "effect",
                        "activities": [
                            {
                                "type": "numberIncrement",
                                "target": {"fact": "str.save"},
                                "source": {"fact": "proficiency.bonus"},
                            }
                        ],
                    },
                }
            ],
        }
        add_auto_groups(rule)

        effect = rule["activities"][0]["rule"]
        assert "_auto.fact.str.save" in effect.get("group", [])
        after_groups = {a["group"] for a in effect.get("after", [])}
        assert "_auto.fact.proficiency.bonus" in after_groups

    def test_advertise_effect_self_true_no_crash(self):
        """advertiseEffect with self: true does not crash (no nested rule)."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "advertiseEffect", "self": True},
                {"type": "numberSet", "target": {"fact": "hp.max"}, "source": {"number": 10}},
            ],
        }
        add_auto_groups(rule)
        assert "_auto.fact.hp.max" in rule.get("group", [])

    def test_empty_rule_no_auto_groups(self):
        """Rule with no activities gets no auto-groups."""
        rule = {"id": "test", "activities": []}
        add_auto_groups(rule)
        assert "group" not in rule
        assert "after" not in rule

    def test_parent_reads_not_propagated_to_nested(self):
        """Parent's reads/writes do not affect nested rule's auto-groups."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "parent.write"}, "source": {"number": 1}},
                {
                    "type": "offerRule",
                    "rule": {
                        "id": "nested",
                        "activities": [
                            {
                                "type": "numberCopy",
                                "target": {"fact": "nested.target"},
                                "source": {"fact": "nested.source"},
                            }
                        ],
                    },
                },
            ],
        }
        add_auto_groups(rule)

        # Parent has write for parent.write
        assert "_auto.fact.parent.write" in rule.get("group", [])
        # Parent does NOT have nested's facts
        assert not any("_auto.fact.nested" in g for g in rule.get("group", []))

        # Nested has its own
        nested = rule["activities"][1]["rule"]
        assert "_auto.fact.nested.target" in nested.get("group", [])
        after_groups = {a["group"] for a in nested.get("after", [])}
        assert "_auto.fact.nested.source" in after_groups

    def test_deeply_nested_rules(self):
        """Auto-groups work for deeply nested rules (offer -> effect)."""
        rule = {
            "id": "test",
            "activities": [
                {
                    "type": "offerRule",
                    "rule": {
                        "id": "offered",
                        "activities": [
                            {
                                "type": "advertiseEffect",
                                "rule": {
                                    "id": "effect",
                                    "activities": [
                                        {
                                            "type": "numberIncrement",
                                            "target": {"fact": "deep.fact"},
                                            "source": {"fact": "deep.source"},
                                        }
                                    ],
                                },
                            }
                        ],
                    },
                }
            ],
        }
        add_auto_groups(rule)

        effect = rule["activities"][0]["rule"]["activities"][0]["rule"]
        assert "_auto.fact.deep.fact" in effect.get("group", [])
        after_groups = {a["group"] for a in effect.get("after", [])}
        assert "_auto.fact.deep.source" in after_groups

    def test_deterministic_ordering(self):
        """Auto-groups are added in sorted order for determinism."""
        rule = {
            "id": "test",
            "activities": [
                {"type": "numberSet", "target": {"fact": "z.fact"}, "source": {"number": 1}},
                {"type": "numberSet", "target": {"fact": "a.fact"}, "source": {"number": 2}},
            ],
        }
        add_auto_groups(rule)
        groups = rule.get("group", [])
        assert groups.index("_auto.fact.a.fact") < groups.index("_auto.fact.z.fact")
