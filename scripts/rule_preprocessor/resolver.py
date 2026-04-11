"""
Matching and emission for the rule source preprocessor.

Handles:
- Profile matching against definitions (all-of exact semantics)
- Definition selection via includeDefinitions criteria
- Emission for offerRule and rule modes with full merge rules
"""

from __future__ import annotations

import copy
from typing import Any

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.merge import (
    merge_activities,
    merge_phase,
    merge_ui,
    merge_vars,
    merge_when,
)
from rule_preprocessor.models import (
    Definition,
    EmitConfig,
    Expansion,
    MatchCriteria,
    Profile,
)
from rule_preprocessor.templating import _build_context, substitute, substitute_string


def matches(definition: Definition, profile: Profile) -> bool:
    """Check if a profile matches a definition using all-of exact semantics.

    Every declared match criterion must be satisfied:
    - match.kind: definition.kind must equal
    - match.tags: every listed tag must be present in definition.tags
    - match.traits: every trait key must exist with exact value

    Missing fields on the definition mean no match.
    """
    if profile.match is None:
        return True

    if profile.match.kind is not None:
        if definition.kind != profile.match.kind:
            return False

    if profile.match.tags is not None:
        if definition.tags is None:
            return False
        for tag in profile.match.tags:
            if tag not in definition.tags:
                return False

    if profile.match.traits is not None:
        if definition.traits is None:
            return False
        for key, value in profile.match.traits.items():
            if key not in definition.traits or definition.traits[key] != value:
                return False

    return True


def _select_definitions(
    definitions: list[Definition], criteria: MatchCriteria | None
) -> list[Definition]:
    """Select definitions matching includeDefinitions criteria."""
    if criteria is None:
        return definitions
    # Reuse matching logic by creating a temporary profile
    temp_profile = Profile(id="__selector__", match=criteria)
    return [d for d in definitions if matches(d, temp_profile)]


def _assign_activity_ids(activities: list[dict[str, Any]], rule_id: str) -> list[dict[str, Any]]:
    """Assign deterministic activity IDs if missing."""
    result = []
    for i, act in enumerate(activities):
        act = dict(act)
        if "id" not in act:
            act["id"] = f"{rule_id}-act-{i}"
        result.append(act)
    return result


def _emit_offer_rule(
    definition: Definition,
    profile: Profile,
    expansion: Expansion,
    emit: EmitConfig,
    context: dict[str, str],
) -> dict[str, Any]:
    """Emit a rule group with offerRule wrapper structure.

    Outer rule: phase, when (from expansion + profile gating), after (expansion + profile wrapper),
                 group (expansion + profile wrapper), one offerRule activity.
    Inner offered rule: id, ui, vars, when/after/group from definition payload,
                        merged activities.
    """
    # Resolve IDs from patterns
    offer_rule_id = substitute_string(
        emit.offerRuleIdPattern or "$(definition.id)-$(profile.id)-offer", context
    )
    rule_id = substitute_string(
        emit.ruleIdPattern or "$(definition.id)-$(profile.id)", context
    )

    # Phase resolution
    phase = merge_phase(
        definition.payload.get("phase"),
        profile.wrapper.phase if profile.wrapper else None,
        emit.phase,
    )

    # Outer rule when: expansion.emit.when + profile.gating.when
    outer_when = merge_when(
        emit.when,
        profile.gating.when if profile.gating else None,
        None,
    )

    # Outer rule after: expansion.emit.after + profile.wrapper.after
    outer_after = merge_when(
        emit.after,
        profile.wrapper.after if profile.wrapper else None,
        None,
    )

    # Outer rule group: expansion.emit.group + profile.wrapper.group
    outer_group = merge_when(
        emit.group,
        profile.wrapper.group if profile.wrapper else None,
        None,
    )

    # Inner rule: merged activities
    inner_activities = merge_activities(
        definition.payload["activities"],
        profile.wrapper.activitiesBefore if profile.wrapper else None,
        profile.wrapper.activitiesAfter if profile.wrapper else None,
    )
    inner_activities = _assign_activity_ids(inner_activities, rule_id)

    # Inner rule: merged UI
    inner_ui = merge_ui(
        definition.ui,
        profile.ui,
        emit.ui,
    )

    # Inner rule: merged vars
    inner_vars = merge_vars(
        definition.vars,
        None,  # profile vars not in spec for v1
        emit.vars,
    )

    # Build inner rule
    inner_rule: dict[str, Any] = {
        "id": rule_id,
        "activities": inner_activities,
    }
    if inner_ui:
        inner_rule["ui"] = inner_ui
    if inner_vars:
        inner_rule["vars"] = inner_vars
    if definition.payload.get("when"):
        inner_rule["when"] = copy.deepcopy(definition.payload["when"])
    if definition.payload.get("after"):
        inner_rule["after"] = copy.deepcopy(definition.payload["after"])
    if definition.payload.get("group"):
        inner_rule["group"] = copy.deepcopy(definition.payload["group"])

    # Build offerRule activity
    offer_activity: dict[str, Any] = {
        "type": "offerRule",
        "id": f"{offer_rule_id}-offer",
        "rule": inner_rule,
    }
    if profile.gating and profile.gating.legalWhen:
        offer_activity["legalWhen"] = copy.deepcopy(profile.gating.legalWhen)

    # Build outer rule
    outer_rule: dict[str, Any] = {
        "id": offer_rule_id,
        "phase": phase,
        "activities": [offer_activity],
    }
    if outer_when:
        outer_rule["when"] = outer_when
    if outer_after:
        outer_rule["after"] = outer_after
    if outer_group:
        outer_rule["group"] = [g for g in outer_group if isinstance(g, str)]
        # Filter out non-string group entries (shouldn't happen for group, but be safe)

    # Fix: group should be list of strings, not list of dicts
    if "group" in outer_rule and not outer_rule["group"]:
        del outer_rule["group"]

    return outer_rule


def _emit_rule(
    definition: Definition,
    profile: Profile,
    expansion: Expansion,
    emit: EmitConfig,
    context: dict[str, str],
) -> dict[str, Any]:
    """Emit a single flat rule (no offerRule wrapper).

    Merges when/after/group from all three sources.
    """
    rule_id = substitute_string(
        emit.ruleIdPattern or "$(definition.id)-$(profile.id)", context
    )

    # Phase
    phase = merge_phase(
        definition.payload.get("phase"),
        profile.wrapper.phase if profile.wrapper else None,
        emit.phase,
    )

    # Merged when: definition.payload + profile.gating + expansion.emit
    rule_when = merge_when(
        definition.payload.get("when"),
        profile.gating.when if profile.gating else None,
        emit.when,
    )

    # Merged after: definition.payload + profile.wrapper + expansion.emit
    rule_after = merge_when(
        definition.payload.get("after"),
        profile.wrapper.after if profile.wrapper else None,
        emit.after,
    )

    # Merged group: definition.payload + profile.wrapper + expansion.emit
    rule_group = merge_when(
        definition.payload.get("group"),
        profile.wrapper.group if profile.wrapper else None,
        emit.group,
    )

    # Merged activities
    activities = merge_activities(
        definition.payload["activities"],
        profile.wrapper.activitiesBefore if profile.wrapper else None,
        profile.wrapper.activitiesAfter if profile.wrapper else None,
    )
    activities = _assign_activity_ids(activities, rule_id)

    # Merged UI
    ui = merge_ui(definition.ui, profile.ui, emit.ui)

    # Merged vars
    merged_vars = merge_vars(definition.vars, None, emit.vars)

    # Build rule
    rule: dict[str, Any] = {
        "id": rule_id,
        "phase": phase,
        "activities": activities,
    }
    if ui:
        rule["ui"] = ui
    if merged_vars:
        rule["vars"] = merged_vars
    if rule_when:
        rule["when"] = rule_when
    if rule_after:
        rule["after"] = rule_after
    if rule_group:
        # Filter to strings only for group
        str_groups = [g for g in rule_group if isinstance(g, str)]
        if str_groups:
            rule["group"] = str_groups

    return rule


def resolve_expansion(
    expansion: Expansion,
    definitions: list[Definition],
    profiles: dict[str, Profile],
) -> list[dict[str, Any]]:
    """Resolve an expansion into generated rule groups.

    Groups all matching profile outputs per definition into a single rule group.
    This ensures one generated rule group per definition, containing all activation
    variants (action, reaction, bonus). Each generated rule group gets `requires`
    pointing to the base definition's rule group so it auto-chains dependencies.

    Returns a list of rule group dicts ready for serialization.
    """
    emit = expansion.emit or EmitConfig()

    # Select matching definitions
    selected = _select_definitions(definitions, expansion.includeDefinitions)

    # Resolve profiles
    profile_list: list[Profile] = []
    if expansion.includeProfiles:
        for pid in expansion.includeProfiles:
            if pid not in profiles:
                raise PreprocessorError(
                    f"unknown profile '{pid}'",
                    kind="expansion",
                    obj_id=expansion.id,
                    field="includeProfiles",
                )
            profile_list.append(profiles[pid])

    results: list[dict[str, Any]] = []
    seen_rg_ids: set[str] = set()

    for definition in selected:
        # Collect all matching profiles for this definition
        matched_rules: list[dict[str, Any]] = []
        for profile in profile_list:
            if not matches(definition, profile):
                continue

            # Build context for templating (profile-specific for IDs)
            context = _build_context(definition, profile, expansion)

            # Determine emission mode
            mode = emit.mode or (profile.emit.mode if profile.emit else None) or "offerRule"

            if mode == "offerRule":
                rule = _emit_offer_rule(definition, profile, expansion, emit, context)
            elif mode == "rule":
                rule = _emit_rule(definition, profile, expansion, emit, context)
            else:
                raise PreprocessorError(
                    f"unsupported emission mode '{mode}'",
                    kind="expansion",
                    obj_id=expansion.id,
                    field="emit.mode",
                )

            matched_rules.append(rule)

        if not matched_rules:
            continue

        # Build definition-level context (no profile) for the rule group ID
        def_context = _build_context(definition, None, expansion)

        # Rule group ID: per-definition, not per-definition+profile
        rg_id = substitute_string(
            emit.ruleGroupIdPattern or "generated-$(definition.id)-activations",
            def_context,
        )

        # Check for duplicate rule group IDs
        if rg_id in seen_rg_ids:
            raise PreprocessorError(
                f"duplicate generated rule-group id '{rg_id}'",
                kind="expansion",
                obj_id=expansion.id,
            )
        seen_rg_ids.add(rg_id)

        # Resolve translations at definition level
        if emit.translations:
            translations = substitute(copy.deepcopy(emit.translations), def_context)
        elif definition.translations:
            translations = copy.deepcopy(definition.translations)
        else:
            raise PreprocessorError(
                "no translations available for emitted rule group",
                kind="expansion",
                obj_id=expansion.id,
            )

        # Build rule group with all matched rules and requires
        rg: dict[str, Any] = {
            "id": rg_id,
            "translations": translations,
            "rules": matched_rules,
        }
        if definition.requires:
            rg["requires"] = definition.requires

        results.append(rg)

    return results
