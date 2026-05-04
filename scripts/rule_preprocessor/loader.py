"""
YAML source file loading and parsing for the rule source preprocessor.

Handles:
- Parsing YAML source documents
- Resolving YAML anchors via shared definitions
- Constructing Definition, Profile, Expansion model objects
- Pass-through of plain ruleGroups
- Validation of top-level keys
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.models import (
    Definition,
    EmitConfig,
    Expansion,
    Gating,
    MatchCriteria,
    Profile,
    Wrapper,
)

ALLOWED_TOP_LEVEL_KEYS = {"ruleGroups", "definitions", "profiles", "expansions"}
# Keys from shared definitions files that are used for YAML anchors only
IGNORED_KEYS = {"refs", "sharedRefs"}


@dataclass
class SourceDocument:
    """A parsed source document containing any mix of ruleGroups and preprocessor constructs."""

    source_file: str
    rule_groups: list[dict[str, Any]] | None = None
    definitions: list[Definition] = field(default_factory=list)
    profiles: list[Profile] = field(default_factory=list)
    expansions: list[Expansion] = field(default_factory=list)


def _parse_match_criteria(data: dict[str, Any] | None) -> MatchCriteria | None:
    """Parse match criteria from a dict."""
    if data is None:
        return None
    return MatchCriteria(
        kind=data.get("kind"),
        tags=data.get("tags"),
        traits=data.get("traits"),
    )


def _parse_gating(data: dict[str, Any] | None) -> Gating | None:
    """Parse gating config from a dict."""
    if data is None:
        return None
    return Gating(
        when=data.get("when"),
        legalWhen=data.get("legalWhen"),
    )


def _parse_wrapper(data: dict[str, Any] | None) -> Wrapper | None:
    """Parse wrapper config from a dict."""
    if data is None:
        return None
    return Wrapper(
        phase=data.get("phase"),
        after=data.get("after"),
        group=data.get("group"),
        activitiesBefore=data.get("activitiesBefore"),
        activitiesAfter=data.get("activitiesAfter"),
    )


def _parse_emit_config(data: dict[str, Any] | None) -> EmitConfig | None:
    """Parse emit config from a dict."""
    if data is None:
        return None
    return EmitConfig(
        mode=data.get("mode"),
        ruleGroupIdPattern=data.get("ruleGroupIdPattern"),
        ruleIdPattern=data.get("ruleIdPattern"),
        offerRuleIdPattern=data.get("offerRuleIdPattern"),
        phase=data.get("phase"),
        when=data.get("when"),
        after=data.get("after"),
        group=data.get("group"),
        translations=data.get("translations"),
        ui=data.get("ui"),
        vars=data.get("vars"),
    )


def _parse_definition(data: dict[str, Any]) -> Definition:
    """Parse a definition from a dict."""
    payload = data.get("payload", {})
    return Definition(
        id=data["id"],
        kind=data.get("kind"),
        tags=data.get("tags"),
        traits=data.get("traits"),
        ui=data.get("ui"),
        vars=data.get("vars"),
        payload=payload,
        translations=data.get("translations", {}),
        requires=data.get("requires"),
    )


def _parse_profile(data: dict[str, Any]) -> Profile:
    """Parse a profile from a dict."""
    return Profile(
        id=data["id"],
        kind=data.get("kind"),
        match=_parse_match_criteria(data.get("match")),
        ui=data.get("ui"),
        gating=_parse_gating(data.get("gating")),
        wrapper=_parse_wrapper(data.get("wrapper")),
        emit=_parse_emit_config(data.get("emit")),
        filterRanges=data.get("filterRanges"),
    )


def _parse_expansion(data: dict[str, Any]) -> Expansion:
    """Parse an expansion from a dict."""
    return Expansion(
        id=data["id"],
        includeDefinitions=_parse_match_criteria(data.get("includeDefinitions")),
        includeProfiles=data.get("includeProfiles"),
        emit=_parse_emit_config(data.get("emit")),
    )


def load_source_file(
    source_file: Path,
    shared_definitions_file: Path | None = None,
) -> SourceDocument:
    """Load and parse a YAML source file.

    If shared_definitions_file is provided, its contents are prepended
    to the source file content for YAML anchor resolution.

    Raises PreprocessorError for unsupported top-level keys.
    """
    raw = source_file.read_text()

    # Prepend shared definitions for anchor resolution
    if shared_definitions_file and shared_definitions_file.exists():
        shared_raw = shared_definitions_file.read_text()
        combined = shared_raw + "\n" + raw
    else:
        combined = raw

    data = yaml.safe_load(combined)

    if data is None:
        return SourceDocument(source_file=str(source_file))

    if not isinstance(data, dict):
        raise PreprocessorError(
            f"source file must be a YAML mapping, got {type(data).__name__}",
            source_file=str(source_file),
        )

    # Check for unsupported keys (ignore anchor container keys from shared defs)
    unsupported = set(data.keys()) - ALLOWED_TOP_LEVEL_KEYS - IGNORED_KEYS
    if unsupported:
        raise PreprocessorError(
            f"unsupported top-level keys: {', '.join(sorted(unsupported))}",
            source_file=str(source_file),
        )

    doc = SourceDocument(
        source_file=str(source_file),
        rule_groups=data.get("ruleGroups"),
    )

    for defn_data in data.get("definitions", []):
        doc.definitions.append(_parse_definition(defn_data))

    for prof_data in data.get("profiles", []):
        doc.profiles.append(_parse_profile(prof_data))

    for exp_data in data.get("expansions", []):
        doc.expansions.append(_parse_expansion(exp_data))

    return doc
