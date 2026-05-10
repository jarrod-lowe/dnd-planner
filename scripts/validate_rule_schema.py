#!/usr/bin/env python3
"""
Validate rule YAML files against the JSON Schema.

Usage:
    python validate_rule_schema.py [--data-dir <path>] [--data-dir2 <path>] [--schema <path>] [--verbose]
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft7Validator


def load_schema(schema_path: Path) -> dict[str, Any]:
    """Load and parse the JSON Schema."""
    return json.loads(schema_path.read_text())


def load_shared_definitions(data_dir: Path) -> str:
    """Load shared YAML anchor definitions from the data directory."""
    shared_file = data_dir / "_shared" / "definitions.yaml"
    if shared_file.exists():
        return shared_file.read_text()
    return ""


def discover_categories(data_dir: Path) -> list[tuple[str, Path]]:
    """Discover category subdirectories in a data directory."""
    if not data_dir.exists():
        return []
    categories = []
    for d in sorted(data_dir.iterdir()):
        if d.is_dir() and not d.name.startswith(".") and d.name != "_shared":
            categories.append((d.name, d))
    return categories


def discover_yaml_files(category_path: Path) -> list[Path]:
    """Find all YAML files in a category, excluding _shared."""
    return sorted(f for f in category_path.rglob("*.yaml") if "_shared" not in f.parts)


def load_yaml_file(yaml_path: Path, shared_defs: str) -> dict[str, Any] | None:
    """Load a YAML file with shared anchor definitions prepended."""
    content = yaml_path.read_text()
    full_content = (shared_defs + "\n" + content) if shared_defs else content
    return yaml.safe_load(full_content)


def format_path(path: list[Any]) -> str:
    """Format a JSON schema error path as a readable string."""
    if not path:
        return "(root)"
    parts = []
    for p in path:
        if isinstance(p, int):
            parts.append(f"[{p}]")
        else:
            if parts and not isinstance(parts[-1], str):
                parts.append(f".{p}")
            else:
                parts.append(str(p))
    return "".join(parts)


def validate_file(
    yaml_path: Path,
    schema: dict[str, Any],
    shared_defs: str,
    validator: Draft7Validator,
) -> list[str]:
    """Validate a single YAML file against the schema. Returns list of error strings."""
    data = load_yaml_file(yaml_path, shared_defs)
    if data is None:
        return []

    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    schema_errors = [
        f"  {yaml_path}: {format_error(error)}" for error in errors
    ]
    effect_errors = validate_effect_names(data, yaml_path)
    return schema_errors + effect_errors


def format_error(error: Any) -> str:
    """Format a jsonschema validation error."""
    path_str = format_path(list(error.path))
    return f"{path_str}: {error.message}"


def validate_effect_names(data: dict[str, Any], yaml_path: Path) -> list[str]:
    """Check that visible advertiseEffect rules have ui.name.

    Effects with a ui block must have ui.name. Hidden effects without ui are exempt.
    """
    if not isinstance(data, dict):
        return []
    errors: list[str] = []

    def walk(rule: dict[str, Any], path: str) -> None:
        for i, activity in enumerate(rule.get("activities", [])):
            if "rule" not in activity:
                continue
            nested = activity["rule"]
            act_path = f"{path}.activities[{i}].rule"
            if activity.get("type") == "advertiseEffect":
                ui = nested.get("ui")
                if ui is not None and not ui.get("name"):
                    errors.append(
                        f"  {yaml_path}: {act_path} ({nested.get('id', '?')}): "
                        f"visible effect missing ui.name"
                    )
            walk(nested, act_path)

    for ri, rg in enumerate(data.get("ruleGroups", [])):
        for rj, rule in enumerate(rg.get("rules", [])):
            walk(rule, f"ruleGroups[{ri}].rules[{rj}]")

    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate rule YAML files against JSON Schema")
    parser.add_argument(
        "--data-dir",
        default="data/rule-groups",
        help="Path to rule groups data directory (default: data/rule-groups)",
    )
    parser.add_argument(
        "--data-dir2",
        default=None,
        help="Optional second data directory (e.g., generated/rule-groups)",
    )
    parser.add_argument(
        "--schema",
        default="data/rule-groups/schema.json",
        help="Path to JSON Schema file (default: data/rule-groups/schema.json)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each file as it is validated",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    schema_path = Path(args.schema)
    if not schema_path.exists():
        print(f"ERROR: Schema file not found: {schema_path}", file=sys.stderr)
        sys.exit(1)

    schema = load_schema(schema_path)
    validator = Draft7Validator(schema)

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    # Load shared definitions from the primary data directory
    shared_defs = load_shared_definitions(data_dir)

    # Collect all directories to validate
    dirs = [data_dir]
    if args.data_dir2:
        data_dir2 = Path(args.data_dir2)
        if data_dir2.exists():
            dirs.append(data_dir2)

    all_errors: list[str] = []
    files_validated = 0

    for d in dirs:
        categories = discover_categories(d)
        for _category_name, category_path in categories:
            yaml_files = discover_yaml_files(category_path)
            # Try to load category-specific shared defs
            cat_shared = load_shared_definitions(category_path.parent)
            effective_shared = cat_shared if cat_shared else shared_defs

            for yaml_file in yaml_files:
                if args.verbose:
                    print(f"  Validating {yaml_file}")

                errors = validate_file(yaml_file, schema, effective_shared, validator)
                all_errors.extend(errors)
                files_validated += 1

    print(f"Validated {files_validated} rule files against schema.")

    if all_errors:
        print(f"\n{len(all_errors)} schema violation(s) found:")
        for error in all_errors:
            print(error)
        sys.exit(1)
    else:
        print("All files pass schema validation.")


if __name__ == "__main__":
    main()
