"""
Symbol table construction for the rule source preprocessor.

Collects definitions, profiles, and expansions from all source documents
and validates uniqueness of ids and reference integrity.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.loader import SourceDocument
from rule_preprocessor.models import Definition, Expansion, Profile


@dataclass
class SymbolTable:
    """Complete symbol table with all definitions, profiles, and expansions."""

    definitions: dict[str, Definition] = field(default_factory=dict)
    profiles: dict[str, Profile] = field(default_factory=dict)
    expansions: dict[str, Expansion] = field(default_factory=dict)
    definition_sources: dict[str, str] = field(default_factory=dict)
    profile_sources: dict[str, str] = field(default_factory=dict)
    expansion_sources: dict[str, str] = field(default_factory=dict)


def build_symbol_table(documents: list[SourceDocument]) -> SymbolTable:
    """Build a symbol table from all source documents.

    Validates:
    - All definition ids are unique
    - All profile ids are unique
    - All expansion ids are unique
    - All profile references in expansions exist
    """
    symbols = SymbolTable()

    for doc in documents:
        for defn in doc.definitions:
            if defn.id in symbols.definitions:
                raise PreprocessorError(
                    f"duplicate definition id '{defn.id}'",
                    source_file=doc.source_file,
                    kind="definition",
                    obj_id=defn.id,
                    field="id",
                )
            symbols.definitions[defn.id] = defn
            symbols.definition_sources[defn.id] = doc.source_file

        for prof in doc.profiles:
            if prof.id in symbols.profiles:
                raise PreprocessorError(
                    f"duplicate profile id '{prof.id}'",
                    source_file=doc.source_file,
                    kind="profile",
                    obj_id=prof.id,
                    field="id",
                )
            symbols.profiles[prof.id] = prof
            symbols.profile_sources[prof.id] = doc.source_file

        for exp in doc.expansions:
            if exp.id in symbols.expansions:
                raise PreprocessorError(
                    f"duplicate expansion id '{exp.id}'",
                    source_file=doc.source_file,
                    kind="expansion",
                    obj_id=exp.id,
                    field="id",
                )
            symbols.expansions[exp.id] = exp
            symbols.expansion_sources[exp.id] = doc.source_file

    # Validate profile references in expansions
    for exp_id, exp in symbols.expansions.items():
        if exp.includeProfiles:
            for pid in exp.includeProfiles:
                if pid not in symbols.profiles:
                    raise PreprocessorError(
                        f"unknown profile '{pid}' referenced in expansion",
                        source_file=symbols.expansion_sources.get(exp_id),
                        kind="expansion",
                        obj_id=exp_id,
                        field="includeProfiles",
                    )

    return symbols
