#!/usr/bin/env python3
"""
Rule source preprocessor CLI.

Compiles higher-level authored rule source documents into plain rule-group YAML
compatible with the existing rules engine and rule-group schema.

Usage:
    python -m rule_preprocessor --source-dir <path> --output-dir <path> [--shared-defs <path>]
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import Any

from rule_preprocessor.errors import PreprocessorError
from rule_preprocessor.loader import load_source_file
from rule_preprocessor.resolver import resolve_expansion
from rule_preprocessor.serializer import write_output_files
from rule_preprocessor.symbols import build_symbol_table
from rule_preprocessor.validator import validate_generated_output


def preprocess(
    source_dir: Path,
    output_dir: Path,
    shared_definitions_file: Path | None = None,
) -> list[dict[str, Any]]:
    """Run the full preprocessor pipeline.

    Returns the list of generated rule groups.
    Raises PreprocessorError on any validation or processing failure.
    """
    # Phase 1-2: Load and parse source files
    source_files = sorted(source_dir.glob("*.yaml"))
    if not source_files:
        return []

    documents = []
    for sf in source_files:
        doc = load_source_file(sf, shared_definitions_file=shared_definitions_file)
        documents.append(doc)

    # Phase 3: Build symbol tables and validate uniqueness
    symbols = build_symbol_table(documents)

    # If no expansions, nothing to generate
    if not symbols.expansions:
        return []

    # Phase 4-6: Resolve expansions and emit
    all_generated: list[dict[str, Any]] = []

    for exp_id, expansion in symbols.expansions.items():
        # Get definitions as list
        definitions = list(symbols.definitions.values())

        # Resolve
        results = resolve_expansion(expansion, definitions, symbols.profiles)
        all_generated.extend(results)

    # Phase 8: Validate generated output
    validate_generated_output(all_generated)

    # Phase 9: Write output into 'generated' category subdirectory
    # This matches the category-based structure expected by sync_rule_groups.py
    generated_dir = output_dir / "generated"
    if generated_dir.exists():
        shutil.rmtree(generated_dir)

    provenance = {
        "source_file": str(source_dir),
    }
    write_output_files(all_generated, generated_dir, provenance)

    return all_generated


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Compile rule source documents into plain rule-group YAML",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Directory containing source YAML files",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        required=True,
        help="Directory for generated output YAML files",
    )
    parser.add_argument(
        "--shared-defs",
        type=Path,
        default=None,
        help="Path to shared YAML definitions file for anchor resolution",
    )

    args = parser.parse_args()

    try:
        results = preprocess(args.source_dir, args.output_dir, args.shared_defs)
        print(f"Generated {len(results)} rule groups to {args.output_dir}")
    except PreprocessorError as e:
        print(f"error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
