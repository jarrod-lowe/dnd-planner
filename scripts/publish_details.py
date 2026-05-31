"""Publish detail JSON files from inline YAML detail blocks."""

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

_SPAN_RE = re.compile(r"\*\*(.+?)\*\*|\*(.+?)\*")
_HTML_TAG_RE = re.compile(r"<[a-zA-Z]")


def _parse_spans(text: str) -> list:
    """Parse inline bold/italic into Span list."""
    spans: list = []
    last = 0
    for m in _SPAN_RE.finditer(text):
        if m.start() > last:
            spans.append(text[last : m.start()])
        if m.group(1):
            spans.append({"strong": m.group(1)})
        elif m.group(2):
            spans.append({"em": m.group(2)})
        last = m.end()
    if last < len(text):
        spans.append(text[last:])
    return spans


def parse_markdown_body(md: str) -> list[dict]:
    """Parse Markdown body text into a list of Line dicts."""
    if not md.strip():
        return []

    if _HTML_TAG_RE.search(md):
        raise ValueError("HTML tags are not allowed in detail body")

    lines: list[dict] = []
    blocks = re.split(r"\n\n+", md.strip())
    for block in blocks:
        raw_lines = block.split("\n")
        # Check if this block is a list: any line starts with "- "
        is_list = any(ln.lstrip().startswith("- ") for ln in raw_lines)
        if is_list:
            # Accumulate wrapped list items: a "- ..." line may continue on
            # subsequent non-bullet lines
            current: str | None = None
            for ln in raw_lines:
                stripped = ln.strip()
                if stripped.startswith("- "):
                    if current is not None:
                        lines.append({"bullet": True, "text": _parse_spans(current)})
                    current = stripped[2:]
                elif current is not None and stripped:
                    current += " " + stripped
                elif stripped:
                    # Non-bullet line before any bullet — treat as paragraph
                    lines.append({"text": _parse_spans(stripped)})
            if current is not None:
                lines.append({"bullet": True, "text": _parse_spans(current)})
        else:
            text = " ".join(ln.strip() for ln in raw_lines).strip()
            if text:
                lines.append({"text": _parse_spans(text)})
    return lines


def extract_details(rule_group_docs: list[dict]) -> list[tuple[str, dict]]:
    """Extract detail blocks from parsed rule-group documents.

    Args:
        rule_group_docs: List of dicts, each with a "ruleGroups" key.

    Returns:
        List of (detail_key, item_detail_dict) tuples.
    """
    results: list[tuple[str, dict]] = []
    for doc in rule_group_docs:
        for rg in doc.get("ruleGroups", []):
            detail = rg.get("detail")
            if detail is None:
                continue
            for field in ("key", "source", "body"):
                if field not in detail:
                    raise ValueError(
                        f"Rule group '{rg.get('id', '?')}' detail missing required field: {field}"
                    )
            item: dict = {"source": detail["source"], "body": parse_markdown_body(detail["body"])}
            if "meta" in detail:
                item["meta"] = detail["meta"]
            if "fields" in detail:
                item["fields"] = detail["fields"]
            results.append((detail["key"], item))
    return results


def publish_to_dir(
    details: list[tuple[str, dict]], output_dir: Path, locale: str = "en"
) -> None:
    """Write detail JSON files and clean up orphans."""
    locale_dir = output_dir / locale
    published_keys: set[str] = set()

    for key, item_detail in details:
        published_keys.add(key)
        out_path = locale_dir / f"{key}.json"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(item_detail, indent=2, ensure_ascii=False) + "\n")

    # Orphan cleanup: remove JSON files not in the published set
    if locale_dir.exists():
        for json_file in locale_dir.rglob("*.json"):
            relative = json_file.relative_to(locale_dir)
            key = str(relative.with_suffix(""))
            if key not in published_keys:
                json_file.unlink()


def _load_shared_defs(category_path: Path) -> str:
    """Load shared YAML anchor definitions for a category."""
    shared_file = category_path.parent / "_shared" / "definitions.yaml"
    if shared_file.exists():
        return shared_file.read_text()
    return ""


def _load_yaml_docs(data_dir: Path) -> list[dict]:
    """Scan a directory for YAML rule-group files and return parsed docs."""
    docs: list[dict] = []
    if not data_dir.exists():
        return docs
    for yaml_file in sorted(data_dir.rglob("*.yaml")):
        if "_shared" in yaml_file.parts:
            continue
        shared_defs = _load_shared_defs(yaml_file.parent)
        with open(yaml_file) as f:
            content = f.read()
        if shared_defs:
            data = yaml.safe_load(shared_defs + "\n" + content)
        else:
            data = yaml.safe_load(content)
        if data and "ruleGroups" in data:
            docs.append(data)
    return docs


def run(data_dir: Path, output_dir: Path, data_dir2: Path | None = None, locale: str = "en") -> None:
    """Main entry point: scan YAML, extract details, write JSON."""
    docs = _load_yaml_docs(data_dir)
    if data_dir2:
        docs.extend(_load_yaml_docs(data_dir2))
    details = extract_details(docs)
    publish_to_dir(details, output_dir, locale=locale)


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish detail JSON from YAML rule groups")
    parser.add_argument("--data-dir", required=True, help="Path to rule groups data directory")
    parser.add_argument("--data-dir2", default=None, help="Optional second data directory")
    parser.add_argument("--output-dir", default="static/details", help="Output directory for detail JSON")
    parser.add_argument("--locale", default="en", help="Locale to publish (default: en)")
    args = parser.parse_args()
    run(Path(args.data_dir), Path(args.output_dir), Path(args.data_dir2) if args.data_dir2 else None, args.locale)


if __name__ == "__main__":
    main()
