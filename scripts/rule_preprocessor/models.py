"""
Data models for the rule source preprocessor.

Dataclasses representing definitions, profiles, expansions, and their
sub-structures. These map directly to the source YAML structure.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class MatchCriteria:
    """Compile-time matching criteria used to select definitions.

    All declared criteria must match (all-of semantics).
    """

    kind: str | None = None
    tags: list[str] | None = None
    traits: dict[str, Any] | None = None


@dataclass
class Gating:
    """Visibility and legality conditions for a profile."""

    when: list[dict[str, Any]] | None = None
    legalWhen: list[dict[str, Any]] | None = None


@dataclass
class Wrapper:
    """Wrapper configuration applied around a definition's payload."""

    phase: str | None = None
    after: list[dict[str, Any]] | None = None
    group: list[str] | None = None
    activitiesBefore: list[dict[str, Any]] | None = None
    activitiesAfter: list[dict[str, Any]] | None = None


@dataclass
class EmitConfig:
    """Emission configuration for an expansion."""

    mode: str | None = None
    ruleGroupIdPattern: str | None = None
    ruleIdPattern: str | None = None
    offerRuleIdPattern: str | None = None
    phase: str | None = None
    when: list[dict[str, Any]] | None = None
    after: list[dict[str, Any]] | None = None
    group: list[str] | None = None
    translations: dict[str, dict[str, Any]] | None = None
    ui: dict[str, Any] | None = None
    vars: dict[str, Any] | None = None


@dataclass
class Definition:
    """A canonical reusable source object.

    Required fields: id, payload (with activities), translations.
    """

    id: str
    payload: dict[str, Any]
    translations: dict[str, dict[str, Any]]
    kind: str | None = None
    tags: list[str] | None = None
    traits: dict[str, Any] | None = None
    ui: dict[str, Any] | None = None
    vars: dict[str, Any] | None = None
    requires: list[str] | None = None
    hands: int | None = None


@dataclass
class Profile:
    """A reusable contextual overlay applied to matching definitions."""

    id: str
    kind: str | None = None
    match: MatchCriteria | None = None
    ui: dict[str, Any] | None = None
    gating: Gating | None = None
    wrapper: Wrapper | None = None
    emit: EmitConfig | None = None
    filterRanges: str | None = None


@dataclass
class Expansion:
    """A compile-time instruction that selects and emits concrete output."""

    id: str
    includeDefinitions: MatchCriteria | None = None
    includeProfiles: list[str] | None = None
    emit: EmitConfig | None = None
