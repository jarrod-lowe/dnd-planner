#!/usr/bin/env python3
"""
Tests for resolver module — matching and emission.

Tests the core scenario: dagger definition + action/reaction profiles
generating different offerRule wrappers.

Run with: python -m pytest scripts/rule_preprocessor/tests/test_resolver.py -v
"""

import pytest

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
from rule_preprocessor.resolver import (
    matches,
    resolve_expansion,
)


# === Test fixtures (dagger definition + profiles) ===

DAGGER = Definition(
    id="dagger",
    kind="option",
    tags=["attack", "weapon", "melee"],
    traits={"weapon.light": True, "weapon.finesse": True},
    requires=["dagger"],
    ui={"model": "attack", "name": "rule.dnd-5e-2024.attack.dagger.name", "section": "action-attack"},
    vars={"target": {"capture": True}},
    payload={
        "phase": "normal",
        "activities": [
            {"type": "emitEvent", "event": "attack.made", "id": "dagger-emit"},
            {"type": "numberSet", "target": {"fact": "attack.last.weapon.light"}, "source": {"number": 1}, "id": "dagger-light"},
        ],
    },
    translations={
        "en": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger", "weapon"]},
        "en-x-tlh": {"name": "Dagger", "description": "Dagger", "keywords": ["dagger", "weapon"]},
    },
)

GREATAXE = Definition(
    id="greataxe",
    kind="option",
    tags=["attack", "weapon", "melee"],
    traits={"weapon.heavy": True, "weapon.twoHanded": True},
    requires=["greataxe"],
    ui={"model": "attack", "name": "rule.dnd-5e-2024.attack.greataxe.name", "section": "action-attack"},
    vars={"target": {"capture": True}},
    payload={
        "phase": "normal",
        "activities": [
            {"type": "emitEvent", "event": "attack.made", "id": "greataxe-emit"},
        ],
    },
    translations={
        "en": {"name": "Greataxe", "description": "Greataxe", "keywords": ["greataxe"]},
        "en-x-tlh": {"name": "Greataxe", "description": "Greataxe", "keywords": ["greataxe"]},
    },
)

SPELL_DEF = Definition(
    id="fireball",
    kind="option",
    tags=["spell"],
    traits={"spell.level": 3},
    ui={"model": "spell"},
    payload={"activities": [{"type": "emitEvent", "event": "spell.cast", "id": "fireball-emit"}]},
    translations={
        "en": {"name": "Fireball", "description": "Fireball", "keywords": ["fireball"]},
        "en-x-tlh": {"name": "Fireball", "description": "Fireball", "keywords": ["fireball"]},
    },
)

USE_ACTION = Profile(
    id="use-action",
    match=MatchCriteria(tags=["attack"]),
    ui={"section": "action-attack"},
    gating=Gating(
        legalWhen=[
            {
                "condition": {"fact": "actions.remaining", "operator": "greaterThanOrEqual", "value": 1},
                "illegalDiagnostics": [{"code": "no_action", "severity": "error"}],
            }
        ],
    ),
    wrapper=Wrapper(
        activitiesBefore=[
            {"type": "numberIncrement", "target": {"fact": "actions.remaining"}, "source": {"number": 1}, "subtract": True, "id": "use-action-cost"},
            {"type": "numberSet", "target": {"fact": "attack.last.activation.action"}, "source": {"number": 1}, "id": "use-action-flag"},
        ],
    ),
    emit=EmitConfig(mode="offerRule"),
)

USE_REACTION_WEAPON = Profile(
    id="use-reaction-weapon",
    match=MatchCriteria(tags=["weapon"]),
    ui={"section": "reaction"},
    gating=Gating(
        when=[{"fact": "capability.attack.reaction.weapon", "operator": "equals", "value": 1}],
        legalWhen=[
            {
                "condition": {"fact": "reactions.remaining", "operator": "greaterThanOrEqual", "value": 1},
                "illegalDiagnostics": [{"code": "no_reaction", "severity": "error"}],
            }
        ],
    ),
    wrapper=Wrapper(
        activitiesBefore=[
            {"type": "numberIncrement", "target": {"fact": "reactions.remaining"}, "source": {"number": 1}, "subtract": True, "id": "use-reaction-cost"},
        ],
    ),
    emit=EmitConfig(mode="offerRule"),
)

USE_BONUS_FOLLOWUP_LIGHT = Profile(
    id="use-bonus-followup-light",
    match=MatchCriteria(tags=["weapon"], traits={"weapon.light": True}),
    ui={"section": "bonus-action"},
    gating=Gating(
        when=[{"fact": "capability.attack.bonus.light", "operator": "equals", "value": 1}],
        legalWhen=[
            {
                "condition": {"fact": "bonusActions.remaining", "operator": "greaterThanOrEqual", "value": 1},
                "illegalDiagnostics": [{"code": "no_bonus", "severity": "error"}],
            }
        ],
    ),
    wrapper=Wrapper(
        activitiesBefore=[
            {"type": "numberIncrement", "target": {"fact": "bonusActions.remaining"}, "source": {"number": 1}, "subtract": True, "id": "use-bonus-cost"},
        ],
    ),
    emit=EmitConfig(mode="offerRule"),
)

# A flat-rule mode profile
FLAT_ATTACK_RULE = Profile(
    id="flat-attack-rule",
    match=MatchCriteria(tags=["attack"]),
    ui={"section": "auto-attack"},
    wrapper=Wrapper(
        activitiesBefore=[
            {"type": "emitEvent", "event": "auto.attack", "id": "flat-before"},
        ],
    ),
    emit=EmitConfig(mode="rule"),
)


# === Matching Tests ===

class TestMatches:
    """Tests for profile matching against definitions."""

    def test_tag_match(self):
        """Profile with tags: [attack] should match definition with tags including attack."""
        assert matches(DAGGER, USE_ACTION) is True

    def test_tag_no_match(self):
        """Profile with tags: [attack] should not match definition with only tags: [spell]."""
        assert matches(SPELL_DEF, USE_ACTION) is False

    def test_trait_match(self):
        """Profile with traits: {weapon.light: true} should match dagger."""
        assert matches(DAGGER, USE_BONUS_FOLLOWUP_LIGHT) is True

    def test_trait_no_match(self):
        """Profile with traits: {weapon.light: true} should not match greataxe."""
        assert matches(GREATAXE, USE_BONUS_FOLLOWUP_LIGHT) is False

    def test_kind_match(self):
        """Profile with kind: 'option' should match definition with kind: 'option'."""
        profile = Profile(id="test", match=MatchCriteria(kind="option"))
        assert matches(DAGGER, profile) is True

    def test_kind_no_match(self):
        """Profile with kind: 'effect' should not match definition with kind: 'option'."""
        profile = Profile(id="test", match=MatchCriteria(kind="effect"))
        assert matches(DAGGER, profile) is False

    def test_missing_field_no_match(self):
        """Profile matching on a field absent from definition should not match."""
        no_tags = Definition(
            id="no-tags",
            payload={"activities": [{"type": "emitEvent", "event": "x", "id": "x"}]},
            translations={"en": {"name": "T", "description": "T", "keywords": []}, "en-x-tlh": {"name": "T", "description": "T", "keywords": []}},
        )
        assert matches(no_tags, USE_ACTION) is False

    def test_all_criteria_must_match(self):
        """All declared criteria must match for a profile to match."""
        # Has both tags and traits match
        assert matches(DAGGER, USE_BONUS_FOLLOWUP_LIGHT) is True
        # Has tags but not traits match
        assert matches(GREATAXE, USE_BONUS_FOLLOWUP_LIGHT) is False

    def test_no_criteria_always_matches(self):
        """Profile with no match criteria should match everything."""
        profile = Profile(id="catch-all")
        assert matches(DAGGER, profile) is True
        assert matches(SPELL_DEF, profile) is True


# === Emission Tests ===

class TestResolveExpansionOfferRule:
    """Tests for offerRule emission mode."""

    def test_dagger_action_emits_rule_group(self):
        """Dagger + use-action should emit a rule group with offerRule wrapper."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                after=[{"group": "option-capabilities"}],
                translations={
                    "en": {
                        "name": "$(definition.translations.en.name)",
                        "description": "$(definition.translations.en.description)",
                        "keywords": ["$(definition.id)"],
                    },
                    "en-x-tlh": {
                        "name": "$(definition.translations.en-x-tlh.name)",
                        "description": "$(definition.translations.en-x-tlh.description)",
                        "keywords": ["$(definition.id)"],
                    },
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        assert len(results) == 1
        rg = results[0]
        assert rg["id"] == "generated-dagger-activations"
        assert "en" in rg["translations"]
        assert "en-x-tlh" in rg["translations"]
        assert rg["translations"]["en"]["name"] == "Dagger"

    def test_dagger_action_has_requires(self):
        """Generated rule group should have requires from definition."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        rg = results[0]
        assert rg["requires"] == ["dagger"]

    def test_no_requires_when_not_set(self):
        """Generated rule group should not have requires when definition has none."""
        no_requires_def = Definition(
            id="no-req",
            kind="option",
            tags=["attack"],
            payload={"activities": [{"type": "emitEvent", "event": "x", "id": "x"}]},
            translations={
                "en": {"name": "T", "description": "T", "keywords": []},
                "en-x-tlh": {"name": "T", "description": "T", "keywords": []},
            },
        )
        expansion = Expansion(
            id="test",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [no_requires_def], profiles)
        assert "requires" not in results[0]

    def test_dagger_action_outer_rule_structure(self):
        """Outer rule should have offerRule activity with legalWhen from profile."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        rules = results[0]["rules"]
        assert len(rules) == 1
        outer = rules[0]
        assert outer["id"] == "dagger-use-action-offer"
        # Outer should have offerRule activity
        assert len(outer["activities"]) == 1
        assert outer["activities"][0]["type"] == "offerRule"
        # legalWhen from profile gating
        assert "legalWhen" in outer["activities"][0]
        assert len(outer["activities"][0]["legalWhen"]) == 1

    def test_dagger_action_inner_rule_has_merged_activities(self):
        """Inner offered rule should have profile activitiesBefore + definition activities."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert inner["id"] == "dagger-use-action"
        # activitiesBefore (2) + definition (2) = 4
        assert len(inner["activities"]) == 4
        # First two from profile wrapper
        assert inner["activities"][0]["type"] == "numberIncrement"
        assert inner["activities"][1]["type"] == "numberSet"
        # Last two from definition
        assert inner["activities"][2]["type"] == "emitEvent"
        assert inner["activities"][3]["type"] == "numberSet"

    def test_dagger_action_inner_has_merged_ui(self):
        """Inner rule should have UI from definition overlaid with profile."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        # Definition has model: attack, profile has section: action-attack
        assert inner["ui"]["model"] == "attack"
        assert inner["ui"]["section"] == "action-attack"

    def test_dagger_reaction_different_gating(self):
        """Dagger + use-reaction-weapon should have different gating than action."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-reaction-weapon"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-reaction-weapon": USE_REACTION_WEAPON}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        outer = results[0]["rules"][0]
        # Reaction profile has when from gating
        assert "when" in outer
        assert len(outer["when"]) == 1
        assert outer["when"][0]["fact"] == "capability.attack.reaction.weapon"
        # Different legalWhen
        outer_activity = outer["activities"][0]
        assert outer_activity["legalWhen"][0]["condition"]["fact"] == "reactions.remaining"
        # Different activitiesBefore
        inner = outer_activity["rule"]
        assert inner["activities"][0]["target"]["fact"] == "reactions.remaining"

    def test_multiple_profiles_grouped_per_definition(self):
        """One definition with multiple profiles should emit ONE rule group with multiple rules."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action", "use-reaction-weapon"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION, "use-reaction-weapon": USE_REACTION_WEAPON}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        # Per-definition grouping: 1 rule group with 2 rules
        assert len(results) == 1
        rg = results[0]
        assert rg["id"] == "generated-dagger-activations"
        assert len(rg["rules"]) == 2
        rule_ids = [r["id"] for r in rg["rules"]]
        assert "dagger-use-action-offer" in rule_ids
        assert "dagger-use-reaction-weapon-offer" in rule_ids

    def test_multiple_definitions_multiple_groups(self):
        """Multiple definitions should each produce their own rule group."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER, GREATAXE], profiles)
        assert len(results) == 2
        ids = sorted([r["id"] for r in results])
        assert ids == ["generated-dagger-activations", "generated-greataxe-activations"]

    def test_profile_skips_non_matching_definitions(self):
        """Profile with trait match should skip definitions that don't match."""
        expansion = Expansion(
            id="light-only",
            includeDefinitions=MatchCriteria(kind="option", tags=["weapon"]),
            includeProfiles=["use-bonus-followup-light"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-bonus-followup-light": USE_BONUS_FOLLOWUP_LIGHT}
        # Dagger matches (weapon.light: true), greataxe does not
        results = resolve_expansion(expansion, [DAGGER, GREATAXE], profiles)
        assert len(results) == 1
        assert results[0]["id"] == "generated-dagger-activations"

    def test_expansion_after_merged_to_outer(self):
        """Expansion emit.after should appear in outer rule after array."""
        expansion = Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                after=[{"group": "option-capabilities"}],
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        outer = results[0]["rules"][0]
        after_groups = [a["group"] for a in outer.get("after", [])]
        assert "option-capabilities" in after_groups


class TestResolveExpansionRuleMode:
    """Tests for flat rule emission mode."""

    def test_flat_rule_emits_single_rule(self):
        """rule mode should emit a single rule, not an offerRule wrapper."""
        expansion = Expansion(
            id="auto-attacks",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["flat-attack-rule"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                mode="rule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"flat-attack-rule": FLAT_ATTACK_RULE}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        assert len(results) == 1
        rules = results[0]["rules"]
        assert len(rules) == 1
        rule = rules[0]
        assert rule["id"] == "dagger-flat-attack-rule"
        # No offerRule wrapper — just concatenated activities
        assert rule["activities"][0]["type"] == "emitEvent"
        assert rule["activities"][0]["event"] == "auto.attack"
        assert rule["activities"][1]["type"] == "emitEvent"
        assert rule["activities"][1]["event"] == "attack.made"

    def test_flat_rule_has_merged_ui(self):
        """rule mode should merge ui from definition and profile."""
        expansion = Expansion(
            id="auto-attacks",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["flat-attack-rule"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                mode="rule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"flat-attack-rule": FLAT_ATTACK_RULE}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        rule = results[0]["rules"][0]
        assert rule["ui"]["model"] == "attack"  # from definition
        assert rule["ui"]["section"] == "auto-attack"  # from profile


class TestTraitPromotion:
    """Tests for automatic promotion of boolean traits to vars."""

    def _make_expansion(self):
        return Expansion(
            id="option-activations",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                offerRuleIdPattern="$(definition.id)-$(profile.id)-offer",
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )

    def test_boolean_trait_promoted_to_var_in_offer_rule(self):
        """Boolean traits (weapon.twoHanded: true) should appear as vars in generated rules."""
        expansion = self._make_expansion()
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [GREATAXE], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert "vars" in inner
        assert inner["vars"]["weapon.twoHanded"] == {"default": {"number": 1}}

    def test_multiple_boolean_traits_promoted(self):
        """All boolean traits should be promoted to vars."""
        expansion = self._make_expansion()
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [GREATAXE], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert inner["vars"]["weapon.heavy"] == {"default": {"number": 1}}
        assert inner["vars"]["weapon.twoHanded"] == {"default": {"number": 1}}

    def test_string_traits_not_promoted(self):
        """String-valued traits (weapon.mastery: cleave) should NOT be promoted."""
        expansion = self._make_expansion()
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [GREATAXE], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert "weapon.mastery" not in inner.get("vars", {})

    def test_definition_vars_preserved(self):
        """Existing definition vars should still be present after trait promotion."""
        expansion = self._make_expansion()
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [GREATAXE], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert inner["vars"]["target"] == {"capture": True}

    def test_trait_promotion_in_flat_rule_mode(self):
        """Trait promotion should also work in flat rule mode."""
        expansion = Expansion(
            id="auto-attacks",
            includeDefinitions=MatchCriteria(kind="option", tags=["attack"]),
            includeProfiles=["flat-attack-rule"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-activations",
                ruleIdPattern="$(definition.id)-$(profile.id)",
                mode="rule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"flat-attack-rule": FLAT_ATTACK_RULE}
        results = resolve_expansion(expansion, [GREATAXE], profiles)
        rule = results[0]["rules"][0]
        assert rule["vars"]["weapon.twoHanded"] == {"default": {"number": 1}}

    def test_no_traits_no_promotion(self):
        """Definitions without traits should not get any promoted vars."""
        no_traits = Definition(
            id="no-traits",
            kind="option",
            tags=["attack"],
            payload={"activities": [{"type": "emitEvent", "event": "x", "id": "x"}]},
            translations={
                "en": {"name": "T", "description": "T", "keywords": []},
                "en-x-tlh": {"name": "T", "description": "T", "keywords": []},
            },
        )
        expansion = self._make_expansion()
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [no_traits], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        assert "weapon.twoHanded" not in inner.get("vars", {})


class TestVariableSubstitutionInActivities:
    """Tests for $(definition.id) substitution in wrapper activities and gating."""

    def test_substitution_in_wrapper_activities(self):
        """$(definition.id) in wrapper activities should be resolved."""
        profile = Profile(
            id="don-offer",
            match=MatchCriteria(tags=["weapon"]),
            wrapper=Wrapper(
                activitiesAfter=[
                    {
                        "type": "numberSet",
                        "target": {"fact": "weapon.$(definition.id).equipped"},
                        "source": {"number": 1},
                    },
                    {
                        "type": "advertiseEffect",
                        "rule": {
                            "id": "effect-$(definition.id)",
                            "activities": [
                                {
                                    "type": "numberSet",
                                    "target": {"fact": "weapon.$(definition.id).equipped"},
                                    "source": {"number": 1},
                                },
                                {"type": "advertiseEffect", "self": True},
                            ],
                        },
                    },
                ],
            ),
            ui={"section": "configuration"},
            emit=EmitConfig(mode="offerRule"),
        )
        expansion = Expansion(
            id="weapon-don-doff",
            includeDefinitions=MatchCriteria(kind="option", tags=["weapon"]),
            includeProfiles=["don-offer"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-don-doff",
                ruleIdPattern="don-$(definition.id)",
                offerRuleIdPattern="don-$(definition.id)-offer",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"don-offer": profile}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        inner = results[0]["rules"][0]["activities"][0]["rule"]
        activities = inner["activities"]
        # Definition activities (2) come before wrapper activitiesAfter (2)
        # First wrapper activity: numberSet with substituted fact name
        assert activities[2]["target"]["fact"] == "weapon.dagger.equipped"
        # Second wrapper activity: advertiseEffect with substituted nested rule
        effect_rule = activities[3]["rule"]
        assert effect_rule["id"] == "effect-dagger"
        assert effect_rule["activities"][0]["target"]["fact"] == "weapon.dagger.equipped"

    def test_substitution_in_gating_legalWhen(self):
        """$(definition.id) in gating legalWhen should be resolved."""
        profile = Profile(
            id="don-offer",
            match=MatchCriteria(tags=["weapon"]),
            gating=Gating(
                legalWhen=[
                    {
                        "condition": {
                            "fact": "weapon.$(definition.id).equipped",
                            "operator": "notEquals",
                            "value": 1,
                        },
                        "illegalDiagnostics": [
                            {"code": "already-equipped", "severity": "error"},
                        ],
                    },
                ],
            ),
            emit=EmitConfig(mode="offerRule"),
        )
        expansion = Expansion(
            id="weapon-don-doff",
            includeDefinitions=MatchCriteria(kind="option", tags=["weapon"]),
            includeProfiles=["don-offer"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-don-doff",
                ruleIdPattern="don-$(definition.id)",
                offerRuleIdPattern="don-$(definition.id)-offer",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"don-offer": profile}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        outer = results[0]["rules"][0]
        offer_activity = outer["activities"][0]
        assert offer_activity["legalWhen"][0]["condition"]["fact"] == "weapon.dagger.equipped"

    def test_substitution_in_gating_when(self):
        """$(definition.id) in gating when should be resolved."""
        profile = Profile(
            id="gated",
            match=MatchCriteria(tags=["weapon"]),
            gating=Gating(
                when=[
                    {
                        "fact": "weapon.$(definition.id).equipped",
                        "operator": "equals",
                        "value": 1,
                    },
                ],
            ),
            emit=EmitConfig(mode="offerRule"),
        )
        expansion = Expansion(
            id="test",
            includeDefinitions=MatchCriteria(kind="option", tags=["weapon"]),
            includeProfiles=["gated"],
            emit=EmitConfig(
                ruleGroupIdPattern="generated-$(definition.id)-test",
                ruleIdPattern="$(definition.id)-gated",
                offerRuleIdPattern="$(definition.id)-gated-offer",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"gated": profile}
        results = resolve_expansion(expansion, [DAGGER], profiles)
        outer = results[0]["rules"][0]
        assert outer["when"][0]["fact"] == "weapon.dagger.equipped"


class TestResolveExpansionEdgeCases:
    """Edge cases for expansion resolution."""

    def test_no_matching_definitions(self):
        """Should return empty list when no definitions match."""
        expansion = Expansion(
            id="empty",
            includeDefinitions=MatchCriteria(kind="spell"),
            includeProfiles=["use-action"],
            emit=EmitConfig(
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        profiles = {"use-action": USE_ACTION}
        results = resolve_expansion(expansion, [DAGGER], profiles)  # dagger is not a spell
        assert results == []

    def test_missing_profile_raises(self):
        """Should raise PreprocessorError when referenced profile doesn't exist."""
        expansion = Expansion(
            id="bad",
            includeDefinitions=MatchCriteria(kind="option"),
            includeProfiles=["nonexistent-profile"],
            emit=EmitConfig(
                mode="offerRule",
                translations={
                    "en": {"name": "N", "description": "D", "keywords": []},
                    "en-x-tlh": {"name": "N", "description": "D", "keywords": []},
                },
            ),
        )
        with pytest.raises(PreprocessorError, match="unknown profile"):
            resolve_expansion(expansion, [DAGGER], {})
