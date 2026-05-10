"""
Output validation for the rule source preprocessor.

Validates generated rule groups for:
- Unique rule-group ids
- Unique rule ids within each rule group
- Non-empty activities
- Complete translations (en + en-x-tlh)
- Required fields present
"""

from __future__ import annotations

from typing import Any

from rule_preprocessor.errors import PreprocessorError

REQUIRED_LOCALES = ["en", "en-x-tlh"]


def _collect_rule_ids(rule: dict[str, Any], ids: list[str]) -> None:
    """Recursively collect all rule ids, including nested rules."""
    if "id" in rule:
        ids.append(rule["id"])
    for activity in rule.get("activities", []):
        if "rule" in activity:
            _collect_rule_ids(activity["rule"], ids)


def _validate_effect_names(rule: dict[str, Any], rg_id: str) -> None:
    """Check that visible effects (with ui block) have ui.name."""
    for activity in rule.get("activities", []):
        if activity.get("type") == "advertiseEffect" and "rule" in activity:
            nested = activity["rule"]
            ui = nested.get("ui")
            if ui is not None and not ui.get("name"):
                raise PreprocessorError(
                    f"effect '{nested.get('id', '?')}' in rule group '{rg_id}' "
                    f"missing ui.name",
                )
            _validate_effect_names(nested, rg_id)


def validate_generated_output(output: list[dict[str, Any]]) -> None:
    """Validate the complete generated output.

    Raises PreprocessorError for any validation failure.
    """
    rg_ids: set[str] = set()

    for rg in output:
        # Check id present
        if "id" not in rg:
            raise PreprocessorError("generated rule group missing id")

        rg_id = rg["id"]

        # Check unique rule-group id
        if rg_id in rg_ids:
            raise PreprocessorError(
                f"duplicate rule-group id '{rg_id}'",
            )
        rg_ids.add(rg_id)

        # Check translations
        translations = rg.get("translations", {})
        for locale in REQUIRED_LOCALES:
            if locale not in translations:
                raise PreprocessorError(
                    f"missing locale '{locale}' in rule group '{rg_id}'",
                )

        # Collect and check rule ids
        rules = rg.get("rules", [])
        rule_ids: list[str] = []
        for rule in rules:
            _collect_rule_ids(rule, rule_ids)

        # Check unique rule ids
        seen_rule_ids: set[str] = set()
        for rid in rule_ids:
            if rid in seen_rule_ids:
                raise PreprocessorError(
                    f"duplicate rule id '{rid}' in rule group '{rg_id}'",
                )
            seen_rule_ids.add(rid)

        # Check non-empty activities on all rules
        for rule in rules:
            activities = rule.get("activities", [])
            if not activities:
                raise PreprocessorError(
                    f"empty activities on rule '{rule.get('id', '?')}' in rule group '{rg_id}'",
                )
            # Recurse into nested rules
            for activity in activities:
                if "rule" in activity:
                    nested = activity["rule"]
                    if not nested.get("activities"):
                        raise PreprocessorError(
                            f"empty activities on nested rule '{nested.get('id', '?')}'",
                        )
            # Check visible effects have ui.name
            _validate_effect_names(rule, rg_id)
