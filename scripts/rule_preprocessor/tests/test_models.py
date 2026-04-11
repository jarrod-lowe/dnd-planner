#!/usr/bin/env python3
"""
Tests for models module — dataclasses for the preprocessor.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_models.py -v
"""

import pytest

from rule_preprocessor.models import (
    Definition,
    EmitConfig,
    Expansion,
    Gating,
    MatchCriteria,
    Profile,
    Wrapper,
)


class TestDefinition:
    """Tests for the Definition dataclass."""

    def test_minimal_definition(self):
        """Should create a definition with required fields only."""
        d = Definition(
            id="dagger",
            payload={"activities": [{"type": "emitEvent", "event": "attack.made"}]},
            translations={
                "en": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                "en-x-tlh": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
            },
        )
        assert d.id == "dagger"
        assert d.kind is None
        assert d.tags is None
        assert d.traits is None
        assert d.ui is None
        assert d.vars is None

    def test_full_definition(self):
        """Should create a definition with all fields."""
        d = Definition(
            id="dagger",
            kind="option",
            tags=["attack", "weapon", "melee"],
            traits={"weapon.light": True, "weapon.finesse": True},
            ui={"model": "attack", "section": "action-attack"},
            vars={"target": {"capture": True}},
            payload={
                "phase": "normal",
                "activities": [{"type": "emitEvent", "event": "attack.made"}],
            },
            translations={
                "en": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
                "en-x-tlh": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger"]},
            },
        )
        assert d.kind == "option"
        assert "attack" in d.tags
        assert d.traits["weapon.light"] is True
        assert d.ui["model"] == "attack"

    def test_payload_activities_required(self):
        """Should have activities in payload."""
        d = Definition(
            id="test",
            payload={"activities": []},
            translations={
                "en": {"name": "T", "description": "T", "keywords": []},
                "en-x-tlh": {"name": "T", "description": "T", "keywords": []},
            },
        )
        assert d.payload["activities"] == []


class TestProfile:
    """Tests for the Profile dataclass."""

    def test_minimal_profile(self):
        """Should create a profile with required id only."""
        p = Profile(id="use-action")
        assert p.id == "use-action"
        assert p.kind is None
        assert p.match is None
        assert p.gating is None
        assert p.wrapper is None
        assert p.emit is None

    def test_profile_with_match(self):
        """Should create a profile with match criteria."""
        p = Profile(
            id="use-action",
            match=MatchCriteria(tags=["attack"]),
        )
        assert p.match.tags == ["attack"]

    def test_profile_with_gating(self):
        """Should create a profile with gating conditions."""
        p = Profile(
            id="use-action",
            gating=Gating(
                when=[{"fact": "actions.remaining", "operator": "greaterThanOrEqual", "value": 1}],
                legalWhen=[
                    {
                        "condition": {"fact": "actions.remaining", "operator": "greaterThanOrEqual", "value": 1},
                        "illegalDiagnostics": [{"code": "no_action", "severity": "error"}],
                    }
                ],
            ),
        )
        assert p.gating.when is not None
        assert len(p.gating.legalWhen) == 1

    def test_profile_with_wrapper(self):
        """Should create a profile with wrapper config."""
        p = Profile(
            id="use-action",
            wrapper=Wrapper(
                activitiesBefore=[
                    {"type": "numberIncrement", "target": {"fact": "actions.remaining"}, "source": {"number": 1}, "subtract": True}
                ],
            ),
        )
        assert len(p.wrapper.activitiesBefore) == 1


class TestExpansion:
    """Tests for the Expansion dataclass."""

    def test_minimal_expansion(self):
        """Should create an expansion with required id only."""
        e = Expansion(id="option-activations")
        assert e.id == "option-activations"
        assert e.includeDefinitions is None
        assert e.includeProfiles is None
        assert e.emit is None

    def test_expansion_with_emit(self):
        """Should create an expansion with emit config."""
        e = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action", "use-reaction-weapon"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-$(profile.id)",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
            ),
        )
        assert e.includeDefinitions.kind == "option"
        assert len(e.includeProfiles) == 2
        assert e.emit.mode == "offerRule"
        assert e.emit.ruleGroupIdPattern == "generated-$(definition.id)-$(profile.id)"


class TestMatchCriteria:
    """Tests for the MatchCriteria dataclass."""

    def test_empty_criteria(self):
        """Should create criteria with no constraints."""
        m = MatchCriteria()
        assert m.kind is None
        assert m.tags is None
        assert m.traits is None

    def test_full_criteria(self):
        """Should create criteria with all constraints."""
        m = MatchCriteria(
            kind="option",
            tags=["attack", "weapon"],
            traits={"weapon.light": True},
        )
        assert m.kind == "option"
        assert m.tags == ["attack", "weapon"]
        assert m.traits == {"weapon.light": True}


class TestEmitConfig:
    """Tests for the EmitConfig dataclass."""

    def test_minimal_emit(self):
        """Should create emit config with defaults."""
        e = EmitConfig()
        assert e.mode is None
        assert e.ruleGroupIdPattern is None
        assert e.ruleIdPattern is None
        assert e.offerRuleIdPattern is None
        assert e.phase is None
        assert e.when is None
        assert e.after is None
        assert e.group is None
        assert e.translations is None
        assert e.ui is None
        assert e.vars is None

    def test_emit_with_patterns(self):
        """Should create emit config with id patterns."""
        e = EmitConfig(
            mode="offerRule",
            ruleGroupIdPattern="gen-$(definition.id)",
            ruleIdPattern="$(definition.id)-rule",
            offerRuleIdPattern="$(definition.id)-offer",
        )
        assert e.mode == "offerRule"
        assert e.ruleGroupIdPattern == "gen-$(definition.id)"
