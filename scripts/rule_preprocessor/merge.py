"""
Pure merge functions for the rule source preprocessor.

Implements the merge rules from the spec:
- UI: recursive overlay (definition → profile → expansion.emit)
- Vars: overlay with collision detection
- Activities: concatenation (before + definition + after)
- Phase: first-wins cascade (expansion → profile → definition → "normal")
- when/after/group: concatenate and dedupe preserving first-seen order
"""

from __future__ import annotations

from typing import Any

from rule_preprocessor.errors import PreprocessorError


def _recursive_merge(base: dict, overlay: dict) -> dict:
    """Recursively merge overlay into base. Lists are replaced, dicts are merged.

    Exception: annotationLabels lists are unioned (concat + dedupe) so that
    weapon property labels from definitions are preserved when profiles add
    their own labels (e.g. attack.reaction).
    """
    result = dict(base)
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _recursive_merge(result[key], value)
        elif key == "annotationLabels" and isinstance(value, list):
            base_list = result.get(key, [])
            if isinstance(base_list, list):
                result[key] = dedupe_preserving_order(base_list + value)
            else:
                result[key] = value
        else:
            result[key] = value
    return result


def merge_ui(
    definition_ui: dict[str, Any] | None,
    profile_ui: dict[str, Any] | None,
    expansion_ui: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge UI from definition, profile, and expansion. Later values override."""
    result: dict[str, Any] = {}
    if definition_ui:
        result = _recursive_merge(result, definition_ui)
    if profile_ui:
        result = _recursive_merge(result, profile_ui)
    if expansion_ui:
        result = _recursive_merge(result, expansion_ui)
    return result


def merge_vars(
    definition_vars: dict[str, Any] | None,
    profile_vars: dict[str, Any] | None,
    expansion_vars: dict[str, Any] | None,
) -> dict[str, Any]:
    """Merge vars from all sources. Duplicate keys are a compile-time error."""
    result: dict[str, Any] = {}
    sources = [
        ("definition", definition_vars),
        ("profile", profile_vars),
        ("expansion", expansion_vars),
    ]
    for source_name, source_vars in sources:
        if not source_vars:
            continue
        for key, value in source_vars.items():
            if key in result:
                raise PreprocessorError(
                    f"duplicate var '{key}' in {source_name} (already defined)"
                )
            result[key] = value
    return result


def merge_activities(
    definition_activities: list[dict[str, Any]],
    activities_before: list[dict[str, Any]] | None,
    activities_after: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Concatenate activities: before + definition + after."""
    result: list[dict[str, Any]] = []
    if activities_before:
        result.extend(activities_before)
    result.extend(definition_activities)
    if activities_after:
        result.extend(activities_after)
    return result


def merge_phase(
    definition_phase: str | None,
    profile_phase: str | None,
    expansion_phase: str | None,
) -> str:
    """Resolve phase using first-wins cascade: expansion → profile → definition → 'normal'."""
    if expansion_phase:
        return expansion_phase
    if profile_phase:
        return profile_phase
    if definition_phase:
        return definition_phase
    return "normal"


def _item_key(item: Any) -> Any:
    """Create a hashable key for deduplication.

    Scalars use their value directly.
    Dicts use a sorted tuple of items for structural equality.
    """
    if isinstance(item, dict):
        return tuple(sorted(item.items()))
    return item


def dedupe_preserving_order(items: list[Any]) -> list[Any]:
    """Deduplicate items preserving first-seen order.

    Scalars compare by exact value.
    Dicts compare by structural equality after key sorting.
    """
    seen: set[Any] = set()
    result: list[Any] = []
    for item in items:
        key = _item_key(item)
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result


def merge_when(
    source1: list[Any] | None,
    source2: list[Any] | None,
    source3: list[Any] | None,
) -> list[Any]:
    """Concatenate and dedupe when/after/group arrays from up to three sources."""
    combined: list[Any] = []
    if source1:
        combined.extend(source1)
    if source2:
        combined.extend(source2)
    if source3:
        combined.extend(source3)
    return dedupe_preserving_order(combined)
