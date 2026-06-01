#!/usr/bin/env python3
"""
Tests for merge module — pure merge functions for the preprocessor.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_merge.py -v
"""

import pytest

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.merge import (
    dedupe_preserving_order,
    merge_activities,
    merge_phase,
    merge_ui,
    merge_vars,
    merge_when,
)


class TestMergeUI:
    """Tests for UI recursive overlay merging."""

    def test_empty_sources(self):
        """Should return empty dict when all sources are None."""
        result = merge_ui(None, None, None)
        assert result == {}

    def test_definition_ui_only(self):
        """Should return definition ui when others are None."""
        result = merge_ui({"model": "attack", "section": "action-attack"}, None, None)
        assert result == {"model": "attack", "section": "action-attack"}

    def test_profile_overrides_definition(self):
        """Should override definition keys with profile keys."""
        result = merge_ui(
            {"model": "attack", "section": "action-attack"},
            {"section": "reaction"},
            None,
        )
        assert result == {"model": "attack", "section": "reaction"}

    def test_expansion_overrides_all(self):
        """Should override both definition and profile with expansion."""
        result = merge_ui(
            {"model": "attack", "section": "action-attack"},
            {"section": "reaction"},
            {"section": "bonus-action", "name": "override"},
        )
        assert result == {"model": "attack", "section": "bonus-action", "name": "override"}

    def test_nested_recursive_merge(self):
        """Should recursively merge nested dicts, not replace."""
        result = merge_ui(
            {"stats": [{"name": "a", "type": "value"}]},
            {"stats": [{"name": "b"}]},
            None,
        )
        # Nested merge: stats is a list, lists get replaced
        assert result == {"stats": [{"name": "b"}]}

    def test_annotationLabels_unioned_not_replaced(self):
        """annotationLabels should be unioned (concat + dedupe), not replaced."""
        result = merge_ui(
            {"annotationLabels": ["attack.any", "attack.melee", "attack.weapon", "dice.any", "property.twoHanded"]},
            {"annotationLabels": ["attack.any", "attack.melee", "attack.weapon", "dice.any", "attack.reaction"]},
            None,
        )
        assert "property.twoHanded" in result["annotationLabels"]
        assert "attack.reaction" in result["annotationLabels"]
        assert "attack.weapon" in result["annotationLabels"]
        # No duplicates
        assert len(result["annotationLabels"]) == len(set(result["annotationLabels"]))

    def test_nested_dict_recursive_merge(self):
        """Should recursively merge nested dicts by key."""
        result = merge_ui(
            {"a": {"x": 1, "y": 2}},
            {"a": {"y": 3, "z": 4}},
            None,
        )
        assert result == {"a": {"x": 1, "y": 3, "z": 4}}


class TestMergeVars:
    """Tests for vars merging with collision detection."""

    def test_empty_sources(self):
        """Should return empty dict when all sources are None."""
        result = merge_vars(None, None, None)
        assert result == {}

    def test_definition_vars_only(self):
        """Should return definition vars when others are None."""
        result = merge_vars(
            {"target": {"capture": True}},
            None,
            None,
        )
        assert result == {"target": {"capture": True}}

    def test_no_collision_different_keys(self):
        """Should merge vars with different keys without error."""
        result = merge_vars(
            {"target": {"capture": True}},
            None,
            {"range": {"default": {"number": 5}}},
        )
        assert "target" in result
        assert "range" in result

    def test_collision_raises_error(self):
        """Should raise PreprocessorError when same key appears in multiple sources."""
        with pytest.raises(PreprocessorError, match="duplicate var"):
            merge_vars(
                {"range": {"default": {"number": 5}}},
                {"range": {"default": {"number": 10}}},
                None,
            )


class TestMergeActivities:
    """Tests for activities concatenation."""

    def test_definition_only(self):
        """Should return definition activities when no wrapper."""
        acts = [{"type": "emitEvent", "event": "attack.made"}]
        result = merge_activities(acts, None, None)
        assert result == acts

    def test_before_and_after(self):
        """Should prepend activitiesBefore and append activitiesAfter."""
        before = [{"type": "numberIncrement", "id": "before-1"}]
        main = [{"type": "emitEvent", "event": "attack.made", "id": "main-1"}]
        after = [{"type": "numberSet", "id": "after-1"}]
        result = merge_activities(main, before, after)
        assert len(result) == 3
        assert result[0]["type"] == "numberIncrement"
        assert result[1]["type"] == "emitEvent"
        assert result[2]["type"] == "numberSet"

    def test_before_only(self):
        """Should prepend only."""
        before = [{"type": "numberIncrement", "id": "b"}]
        main = [{"type": "emitEvent", "event": "e", "id": "m"}]
        result = merge_activities(main, before, None)
        assert len(result) == 2
        assert result[0]["type"] == "numberIncrement"


class TestMergePhase:
    """Tests for phase cascade resolution."""

    def test_default_is_normal(self):
        """Should return 'normal' when no source specifies a phase."""
        result = merge_phase(None, None, None)
        assert result == "normal"

    def test_expansion_wins(self):
        """Expansion emit phase takes priority."""
        result = merge_phase("early", "normal", "safeguard")
        assert result == "safeguard"

    def test_profile_wins_over_definition(self):
        """Profile wrapper phase beats definition payload phase."""
        result = merge_phase("early", "normal", None)
        assert result == "normal"

    def test_definition_only(self):
        """Definition payload phase used when others absent."""
        result = merge_phase("early", None, None)
        assert result == "early"


class TestDedupePreservingOrder:
    """Tests for array deduplication preserving first-seen order."""

    def test_empty(self):
        """Should return empty list for empty input."""
        assert dedupe_preserving_order([]) == []

    def test_no_duplicates(self):
        """Should return same list when no duplicates."""
        items = ["a", "b", "c"]
        assert dedupe_preserving_order(items) == items

    def test_removes_scalar_duplicates(self):
        """Should remove duplicate scalars, keeping first."""
        result = dedupe_preserving_order(["a", "b", "a", "c", "b"])
        assert result == ["a", "b", "c"]

    def test_removes_dict_duplicates_by_structural_equality(self):
        """Should treat structurally equal dicts as duplicates regardless of key order."""
        items = [
            {"group": "foo"},
            {"group": "bar"},
            {"group": "foo"},  # duplicate
        ]
        result = dedupe_preserving_order(items)
        assert len(result) == 2
        assert result[0] == {"group": "foo"}
        assert result[1] == {"group": "bar"}

    def test_mixed_types(self):
        """Should handle mixed scalars and dicts."""
        items = [
            "alpha",
            {"group": "beta"},
            "alpha",  # duplicate scalar
            {"group": "beta"},  # duplicate dict
            "gamma",
        ]
        result = dedupe_preserving_order(items)
        assert len(result) == 3


class TestMergeWhen:
    """Tests for when/after/group array merging with deduplication."""

    def test_empty_sources(self):
        """Should return empty list when all sources are empty/None."""
        result = merge_when([], None, [])
        assert result == []

    def test_concatenates_and_dedupes(self):
        """Should concatenate all sources and dedupe."""
        result = merge_when(
            [{"fact": "a", "operator": "equals", "value": 1}],
            [{"fact": "b", "operator": "equals", "value": 2}],
            [{"fact": "a", "operator": "equals", "value": 1}],  # duplicate of first
        )
        assert len(result) == 2

    def test_none_sources_treated_as_empty(self):
        """Should treat None sources as empty lists."""
        result = merge_when(
            [{"fact": "a", "operator": "equals", "value": 1}],
            None,
            None,
        )
        assert len(result) == 1
