"""
YAML serialization and file output for the rule source preprocessor.

Handles:
- Serializing generated rule groups to YAML with provenance comments
- Writing output files to the build directory
- Schema comment for yaml-language-server
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml


def serialize_rule_groups(
    rule_groups: list[dict[str, Any]],
    source_file: str | None = None,
    expansion_id: str | None = None,
    definition_id: str | None = None,
    profile_id: str | None = None,
) -> str:
    """Serialize rule groups to YAML with provenance comments.

    Returns the YAML string with header comments.
    """
    lines: list[str] = []

    # Schema comment
    lines.append("# yaml-language-server: $schema=../data/rule-groups/schema.json")
    lines.append("")

    # Provenance comments
    lines.append("# GENERATED FILE - DO NOT EDIT")
    if source_file:
        lines.append(f"# source: {source_file}")
    if expansion_id:
        lines.append(f"# expansion: {expansion_id}")
    if definition_id:
        lines.append(f"# definition: {definition_id}")
    if profile_id:
        lines.append(f"# profile: {profile_id}")
    lines.append("")

    # Serialize the rule groups
    data = {"ruleGroups": rule_groups}
    yaml_content = yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)
    lines.append(yaml_content)

    return "\n".join(lines)


def write_output_files(
    rule_groups: list[dict[str, Any]],
    output_dir: Path,
    provenance: dict[str, str],
) -> list[Path]:
    """Write generated rule groups to individual YAML files in the output directory.

    One file per rule group, named by the rule group id.

    Returns list of written file paths.
    """
    if not rule_groups:
        return []

    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    for rg in rule_groups:
        rg_id = rg["id"]
        filename = f"{rg_id}.yaml"
        filepath = output_dir / filename

        content = serialize_rule_groups(
            [rg],
            source_file=provenance.get("source_file"),
            expansion_id=provenance.get("expansion_id"),
            definition_id=provenance.get("definition_id"),
            profile_id=provenance.get("profile_id"),
        )
        filepath.write_text(content)
        written.append(filepath)

    return written
