#!/usr/bin/env python3
"""
Entry point for the rule source preprocessor.

Usage:
    python scripts/preprocess_rule_sources.py --source-dir <path> --output-dir <path> [--shared-defs <path>]
"""

import sys
from pathlib import Path

# Add scripts directory to path so rule_preprocessor package is importable
sys.path.insert(0, str(Path(__file__).parent))

from rule_preprocessor.__main__ import main

if __name__ == "__main__":
    main()
