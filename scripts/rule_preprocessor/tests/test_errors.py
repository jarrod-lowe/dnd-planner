#!/usr/bin/env python3
"""
Tests for errors module.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_errors.py -v
"""

import pytest

from rule_preprocessor.errors import PreprocessorError


class TestPreprocessorError:
    """Tests for the PreprocessorError exception class."""

    def test_error_with_all_context(self):
        """Should format error with file, kind, id, field, and message."""
        err = PreprocessorError(
            message="duplicate id",
            source_file="data/rule-sources/weapons.yaml",
            kind="definition",
            obj_id="dagger",
            field="id",
        )
        result = str(err)
        assert "duplicate id" in result
        assert "data/rule-sources/weapons.yaml" in result
        assert "definition: dagger" in result
        assert "field: id" in result

    def test_error_with_minimal_context(self):
        """Should format error with message only if no context provided."""
        err = PreprocessorError(message="unknown failure")
        result = str(err)
        assert "unknown failure" in result

    def test_error_with_partial_context(self):
        """Should omit missing context fields from output."""
        err = PreprocessorError(
            message="missing field",
            source_file="data/rule-sources/weapons.yaml",
        )
        result = str(err)
        assert "missing field" in result
        assert "data/rule-sources/weapons.yaml" in result
        assert "definition:" not in result
        assert "field:" not in result

    def test_error_is_exception(self):
        """Should be raisable and catchable as an exception."""
        with pytest.raises(PreprocessorError, match="bad input"):
            raise PreprocessorError(message="bad input")

    def test_error_preserves_attributes(self):
        """Should store all context as attributes."""
        err = PreprocessorError(
            message="test",
            source_file="f.yaml",
            kind="profile",
            obj_id="use-action",
            field="emit.mode",
        )
        assert err.message == "test"
        assert err.source_file == "f.yaml"
        assert err.kind == "profile"
        assert err.obj_id == "use-action"
        assert err.field == "emit.mode"
