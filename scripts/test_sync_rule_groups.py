#!/usr/bin/env python3
"""
Unit tests for sync_rule_groups.py

Run with: python -m pytest scripts/test_sync_rule_groups.py -v
"""

import pytest
from sync_rule_groups import build_rule_group_item

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
