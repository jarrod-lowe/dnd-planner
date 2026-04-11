"""
Translation templating with $(...) interpolation for the rule source preprocessor.

Supports three interpolation variable types:
- $(definition.id), $(profile.id), $(expansion.id) — top-level ids
- $(definition.translations.en.name) — deep paths into definition translations

Substitution is mechanical string replacement only. No expressions or conditionals.
"""

from __future__ import annotations

import re
from typing import Any

from rule_preprocessor.errors import PreprocessorError

REQUIRED_LOCALES = ["en", "en-x-tlh"]

_VARIABLE_RE = re.compile(r"\$\(([^)]+)\)")


def _build_context(definition: Any = None, profile: Any = None, expansion: Any = None) -> dict[str, str]:
    """Build a flat context map from definition, profile, and expansion objects."""
    context: dict[str, str] = {}
    if definition:
        context["definition.id"] = definition.id
        for locale, translation in definition.translations.items():
            for field, value in translation.items():
                if isinstance(value, str):
                    context[f"definition.translations.{locale}.{field}"] = value
    if profile:
        context["profile.id"] = profile.id
    if expansion:
        context["expansion.id"] = expansion.id
    return context


def substitute_string(text: str, context: dict[str, str]) -> str:
    """Substitute all $(...) variables in a string using the provided context.

    Raises PreprocessorError if any variable is unknown.
    """
    def replace_var(match: re.Match) -> str:
        var_name = match.group(1)
        if var_name not in context:
            raise PreprocessorError(f"unknown variable '$({var_name})'")
        return context[var_name]

    return _VARIABLE_RE.sub(replace_var, text)


def substitute(value: Any, context: dict[str, str]) -> Any:
    """Recursively substitute $(...) variables in a data structure.

    Handles strings, lists, dicts, and passes through other types unchanged.
    """
    if isinstance(value, str):
        return substitute_string(value, context)
    if isinstance(value, list):
        return [substitute(item, context) for item in value]
    if isinstance(value, dict):
        return {k: substitute(v, context) for k, v in value.items()}
    return value


def substitute_translations(
    template: dict[str, dict[str, Any]],
    context: dict[str, str],
) -> dict[str, dict[str, Any]]:
    """Substitute translation templates and validate completeness.

    Requires both 'en' and 'en-x-tlh' locales to be present.
    Raises PreprocessorError if any locale is missing or any variable is unknown.
    """
    for locale in REQUIRED_LOCALES:
        if locale not in template:
            raise PreprocessorError(f"missing locale '{locale}' in translation template")

    return substitute(template, context)
