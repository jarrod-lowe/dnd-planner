#!/usr/bin/env python3
"""
Tests for symbols and validator modules.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_validation.py -v
"""

import pytest

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.models import (
    Definition,
    EmitConfig,
    Expansion,
    Profile,
)
from rule_preprocessor.symbols import SymbolTable, build_symbol_table
from rule_preprocessor.validator import validate_generated_output


def _make_definition(id: str, **kwargs) -> Definition:
    """Helper to create a minimal definition."""
    defaults = {
        "payload": {"activities": [{"type": "emitEvent", "event": "x", "id": "x"}]},
        "translations": {
            "en": {"name": id, "description": id, "keywords": []},
            "en-x-tlh": {"name": id, "description": id, "keywords": []},
        },
    }
    defaults.update(kwargs)
    return Definition(id=id, **defaults)


class TestSymbolTable:
    """Tests for symbol table construction and uniqueness checks."""

    def test_build_from_documents(self):
        """Should collect all definitions, profiles, expansions from documents."""
        from rule_preprocessor.loader import SourceDocument

        docs = [
            SourceDocument(
                source_file="a.yaml",
                definitions=[_make_definition("dagger")],
                profiles=[Profile(id="use-action")],
                expansions=[Expansion(id="expand")],
            ),
            SourceDocument(
                source_file="b.yaml",
                definitions=[_make_definition("longsword")],
            ),
        ]
        symbols = build_symbol_table(docs)
        assert len(symbols.definitions) == 2
        assert len(symbols.profiles) == 1
        assert len(symbols.expansions) == 1

    def test_duplicate_definition_id_raises(self):
        """Should raise PreprocessorError for duplicate definition ids."""
        from rule_preprocessor.loader import SourceDocument

        docs = [
            SourceDocument(
                source_file="a.yaml",
                definitions=[_make_definition("dagger")],
            ),
            SourceDocument(
                source_file="b.yaml",
                definitions=[_make_definition("dagger")],
            ),
        ]
        with pytest.raises(PreprocessorError, match="duplicate definition id"):
            build_symbol_table(docs)

    def test_duplicate_profile_id_raises(self):
        """Should raise PreprocessorError for duplicate profile ids."""
        from rule_preprocessor.loader import SourceDocument

        docs = [
            SourceDocument(
                source_file="a.yaml",
                profiles=[Profile(id="use-action"), Profile(id="use-action")],
            ),
        ]
        with pytest.raises(PreprocessorError, match="duplicate profile id"):
            build_symbol_table(docs)

    def test_duplicate_expansion_id_raises(self):
        """Should raise PreprocessorError for duplicate expansion ids."""
        from rule_preprocessor.loader import SourceDocument

        docs = [
            SourceDocument(
                source_file="a.yaml",
                expansions=[Expansion(id="expand"), Expansion(id="expand")],
            ),
        ]
        with pytest.raises(PreprocessorError, match="duplicate expansion id"):
            build_symbol_table(docs)

    def test_expansion_references_nonexistent_profile(self):
        """Should raise PreprocessorError for referencing unknown profile."""
        from rule_preprocessor.loader import SourceDocument

        docs = [
            SourceDocument(
                source_file="a.yaml",
                expansions=[
                    Expansion(id="bad", includeProfiles=["nonexistent"]),
                ],
            ),
        ]
        with pytest.raises(PreprocessorError, match="unknown profile"):
            build_symbol_table(docs)


class TestValidateGeneratedOutput:
    """Tests for output validation."""

    def test_valid_output_passes(self):
        """Should not raise for valid generated output."""
        output = [
            {
                "id": "gen-dagger-action",
                "translations": {
                    "en": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                    "en-x-tlh": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                },
                "rules": [
                    {
                        "id": "dagger-action-offer",
                        "activities": [
                            {"type": "offerRule", "id": "offer-1", "rule": {"id": "dagger-action", "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}]}},
                        ],
                    }
                ],
            }
        ]
        validate_generated_output(output)  # should not raise

    def test_duplicate_rule_group_id_raises(self):
        """Should raise for duplicate rule group ids."""
        rg = {
            "id": "dup",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [{"id": "r1", "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}]}],
        }
        with pytest.raises(PreprocessorError, match="duplicate rule-group id"):
            validate_generated_output([rg, rg])

    def test_missing_rule_group_id_raises(self):
        """Should raise for rule group without id."""
        rg = {
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [],
        }
        with pytest.raises(PreprocessorError, match="missing id"):
            validate_generated_output([rg])

    def test_missing_translations_raises(self):
        """Should raise for missing translations."""
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                # missing en-x-tlh
            },
            "rules": [],
        }
        with pytest.raises(PreprocessorError, match="missing locale"):
            validate_generated_output([rg])

    def test_duplicate_rule_id_raises(self):
        """Should raise for duplicate rule ids within a rule group."""
        rule = {"id": "dup-rule", "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}]}
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [rule, rule],
        }
        with pytest.raises(PreprocessorError, match="duplicate rule id"):
            validate_generated_output([rg])

    def test_empty_activities_raises(self):
        """Should raise for a rule with empty activities."""
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [{"id": "r1", "activities": []}],
        }
        with pytest.raises(PreprocessorError, match="empty activities"):
            validate_generated_output([rg])

    def test_empty_output_passes(self):
        """Should not raise for empty output list."""
        validate_generated_output([])

    def test_effect_with_ui_but_no_name_raises(self):
        """Should raise for an advertiseEffect rule with ui block but no name."""
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [
                {
                    "id": "cast-spell",
                    "activities": [
                        {
                            "type": "advertiseEffect",
                            "rule": {
                                "id": "effect-spell",
                                "ui": {"section": "ongoing"},
                                "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}],
                            },
                        }
                    ],
                }
            ],
        }
        with pytest.raises(PreprocessorError, match="missing ui.name"):
            validate_generated_output([rg])

    def test_effect_with_ui_and_name_passes(self):
        """Should not raise for an advertiseEffect rule with ui block and name."""
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [
                {
                    "id": "cast-spell",
                    "activities": [
                        {
                            "type": "advertiseEffect",
                            "rule": {
                                "id": "effect-spell",
                                "ui": {"section": "ongoing", "name": "play.spell.name"},
                                "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}],
                            },
                        }
                    ],
                }
            ],
        }
        validate_generated_output([rg])

    def test_effect_without_ui_passes(self):
        """Should not raise for an advertiseEffect rule without any ui block (hidden bookkeeping)."""
        rg = {
            "id": "test",
            "translations": {
                "en": {"name": "N", "description": "D", "keywords": []},
                "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
            },
            "rules": [
                {
                    "id": "rest-handler",
                    "activities": [
                        {
                            "type": "advertiseEffect",
                            "rule": {
                                "id": "effect-rest",
                                "activities": [{"type": "emitEvent", "id": "a1", "event": "x"}],
                            },
                        }
                    ],
                }
            ],
        }
        validate_generated_output([rg])
