#!/usr/bin/env python3
"""
Tests for templating module — translation interpolation.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_templating.py -v
"""

import pytest

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.templating import substitute, substitute_translations


class TestSubstitute:
    """Tests for $(...) variable interpolation in strings."""

    def test_no_variables(self):
        """Should return string unchanged when no $(...) present."""
        context = {"definition.id": "dagger"}
        assert substitute("plain text", context) == "plain text"

    def test_definition_id(self):
        """Should substitute $(definition.id)."""
        context = {"definition.id": "dagger"}
        assert substitute("generated-$(definition.id)-use-action", context) == "generated-dagger-use-action"

    def test_profile_id(self):
        """Should substitute $(profile.id)."""
        context = {"profile.id": "use-action"}
        assert substitute("$(profile.id)", context) == "use-action"

    def test_expansion_id(self):
        """Should substitute $(expansion.id)."""
        context = {"expansion.id": "option-activations"}
        assert substitute("$(expansion.id)", context) == "option-activations"

    def test_deep_path(self):
        """Should substitute $(definition.translations.en.name) from context."""
        context = {"definition.translations.en.name": "Dagger"}
        assert substitute("$(definition.translations.en.name)", context) == "Dagger"

    def test_multiple_variables(self):
        """Should substitute multiple variables in one string."""
        context = {"definition.id": "dagger", "profile.id": "use-action"}
        assert substitute("$(definition.id)-$(profile.id)", context) == "dagger-use-action"

    def test_unknown_variable_raises(self):
        """Should raise PreprocessorError for unknown variable."""
        context = {"definition.id": "dagger"}
        with pytest.raises(PreprocessorError, match="unknown variable"):
            substitute("$(unknown.thing)", context)

    def test_empty_string(self):
        """Should return empty string unchanged."""
        context = {"definition.id": "dagger"}
        assert substitute("", context) == ""


class TestSubstituteInValue:
    """Tests for substitution applied recursively through data structures."""

    def test_substitute_in_list_of_strings(self):
        """Should substitute in each string in a list."""
        context = {"definition.id": "dagger", "profile.id": "use-action"}
        result = substitute(["$(definition.id)", "$(profile.id)"], context)
        assert result == ["dagger", "use-action"]

    def test_substitute_in_dict(self):
        """Should substitute in dict string values."""
        context = {"definition.translations.en.name": "Dagger"}
        result = substitute({"name": "$(definition.translations.en.name)"}, context)
        assert result == {"name": "Dagger"}

    def test_substitute_in_nested_structure(self):
        """Should substitute recursively through nested dicts and lists."""
        context = {
            "definition.translations.en.name": "Dagger",
            "definition.translations.en.description": "A small blade",
        }
        result = substitute(
            {
                "en": {
                    "name": "$(definition.translations.en.name)",
                    "description": "$(definition.translations.en.description)",
                }
            },
            context,
        )
        assert result["en"]["name"] == "Dagger"
        assert result["en"]["description"] == "A small blade"

    def test_non_string_values_preserved(self):
        """Should pass through non-string values unchanged."""
        context = {"definition.id": "dagger"}
        result = substitute({"count": 5, "flag": True, "name": "$(definition.id)"}, context)
        assert result == {"count": 5, "flag": True, "name": "dagger"}


class TestSubstituteTranslations:
    """Tests for full translation template substitution."""

    def test_complete_translations(self):
        """Should substitute all template variables and return complete translations."""
        context = {
            "definition.translations.en.name": "Dagger",
            "definition.translations.en.description": "Dagger attack",
            "definition.translations.en-x-tlh.name": "Dagger tlh",
            "definition.translations.en-x-tlh.description": "Dagger tlh desc",
            "definition.id": "dagger",
            "profile.id": "use-action",
        }
        template = {
            "en": {
                "name": "$(definition.translations.en.name)",
                "description": "$(definition.translations.en.description)",
                "keywords": ["$(definition.id)", "$(profile.id)"],
            },
            "en-x-tlh": {
                "name": "$(definition.translations.en-x-tlh.name)",
                "description": "$(definition.translations.en-x-tlh.description)",
                "keywords": ["$(definition.id)", "$(profile.id)"],
            },
        }
        result = substitute_translations(template, context)
        assert result["en"]["name"] == "Dagger"
        assert result["en"]["keywords"] == ["dagger", "use-action"]
        assert result["en-x-tlh"]["name"] == "Dagger tlh"

    def test_missing_translation_key_raises(self):
        """Should raise PreprocessorError if translation is incomplete after substitution."""
        context = {
            "definition.translations.en.name": "Dagger",
        }
        template = {
            "en": {
                "name": "$(definition.translations.en.name)",
                "description": "$(definition.translations.en.description)",  # missing
                "keywords": [],
            },
            "en-x-tlh": {
                "name": "T",
                "description": "T",
                "keywords": [],
            },
        }
        with pytest.raises(PreprocessorError, match="unknown variable"):
            substitute_translations(template, context)

    def test_missing_locale_raises(self):
        """Should raise PreprocessorError if a required locale is missing."""
        context = {
            "definition.translations.en.name": "Dagger",
        }
        template = {
            "en": {
                "name": "$(definition.translations.en.name)",
                "description": "D",
                "keywords": [],
            },
            # missing en-x-tlh
        }
        with pytest.raises(PreprocessorError, match="missing locale"):
            substitute_translations(template, context)
