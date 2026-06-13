#!/usr/bin/env python3
"""
Sync rule groups from YAML files to DynamoDB.

Usage:
    python sync_rule_groups.py --table <table-name> [--dry-run] [--verbose] [--data-dir <path>]
"""

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import boto3
import yaml
from botocore.exceptions import ClientError

# Constants
RULEGROUP_PK_PREFIX = "RULEGROUP#"
RULEGROUP_SK = "META#"
DIRECTORY_PK = "RULEGROUPDIRECTORY#"
DIRECTORY_SK_PREFIX = "CATEGORY#"
BATCH_WRITE_SIZE = 25

# Search index constants
SEARCHINDEX_TYPE = "SEARCHINDEX"
SEARCHINDEX_PK_PREFIX = "LANG#"
SEARCHINDEX_PK_PREFIX_SUFFIX = "#PREFIX#"
SEARCHINDEX_SK_PREFIX = "SCORE#"
SEARCHINDEX_SK_RULEGROUP_PREFIX = "#RULEGROUP#"
SEARCHINDEX_GSI1PK_PREFIX = "RULEGROUPDIRECTORY#"
SEARCHINDEX_GSI1SK_PREFIX = "UPDATEDAT#"
SCORE_NAME_MATCH = "0002"
SCORE_KEYWORD_MATCH = "0001"
PREFIX_MIN_LENGTH = 3
AUTO_GROUP_PREFIX = "_auto.fact."

# Version of the rule-output transform logic (auto-group computation in
# add_auto_groups / extract_fact_reads_writes, and any other transform applied
# to rules before upload). This is mixed into compute_category_hash so that a
# change to the transform logic invalidates the per-category content hash and
# forces a re-sync — even when the source YAML is unchanged. BUMP THIS whenever
# the transform logic changes in a way that alters the synced output.
RULE_TRANSFORM_VERSION = 2
PREFIX_MAX_LENGTH = 6

# Supported locales for translations - must match schema.json
SUPPORTED_LOCALES = ["en", "en-x-tlh"]


def _add_fact_from_condition(condition: dict[str, Any], reads: set[str]) -> None:
    """Extract fact name from a condition dict if present."""
    if "fact" in condition:
        reads.add(condition["fact"])


def _add_fact_from_source(source: dict[str, Any], reads: set[str]) -> None:
    """Extract fact name from a source dict if present (fact or condition.fact)."""
    if "fact" in source:
        reads.add(source["fact"])
    if "condition" in source:
        _add_fact_from_condition(source["condition"], reads)


def extract_fact_reads_writes(
    rule: dict[str, Any], include_offer_legalwhen: bool = True
) -> tuple[set[str], set[str]]:
    """
    Extract fact reads and writes from a single rule's conditions and activities.

    Does NOT recurse into nested rules (offerRule, generateRule, advertiseEffect).
    Returns (reads, writes) sets of fact name strings.

    When include_offer_legalwhen is False, a nested offerRule's legalWhen
    conditions are NOT counted as reads of this rule. This is used for effect
    rules: an effect forms the baseline (it is auto-joined to the __effects__
    group) and must not order itself after facts mutated by planned actions
    (e.g. actions.remaining). Attributing an offer's legalWhen reads to the
    emitting effect would create a __effects__ -> _auto.fact.X -> __effects__
    dependency cycle. The offered sub-rule still gets its own auto-groups when
    processed independently.
    """
    reads: set[str] = set()
    writes: set[str] = set()

    # Rule-level when conditions
    for condition in rule.get("when", []):
        _add_fact_from_condition(condition, reads)

    # Activities
    for activity in rule.get("activities", []):
        # Activity-level when condition
        if "when" in activity:
            _add_fact_from_condition(activity["when"], reads)

        activity_type = activity.get("type", "")

        # Reads from source fields
        if activity_type in ("numberSet", "numberCopy", "numberIncrement"):
            source = activity.get("source", {})
            _add_fact_from_source(source, reads)

        if activity_type in ("numberSum", "numberFunction"):
            for source in activity.get("sources", []):
                _add_fact_from_source(source, reads)

        # numberIncrement: implicit read of target.fact + max field
        if activity_type == "numberIncrement":
            target = activity.get("target", {})
            if "fact" in target:
                reads.add(target["fact"])
            if "max" in activity and isinstance(activity["max"], str):
                reads.add(activity["max"])

        # offerRule: legalWhen conditions (skipped for effect rules — see docstring)
        if activity_type == "offerRule" and include_offer_legalwhen:
            for entry in activity.get("legalWhen", []):
                condition = entry.get("condition", {})
                _add_fact_from_condition(condition, reads)

        # Writes from target.fact (NOT target.var)
        if activity_type in (
            "numberSet",
            "numberIncrement",
            "numberCopy",
            "numberSum",
            "numberFunction",
        ):
            target = activity.get("target", {})
            if "fact" in target:
                writes.add(target["fact"])

    return reads, writes


def add_auto_groups(rule: dict[str, Any], is_effect: bool = False) -> None:
    """
    Add auto-groups and auto-afters to a rule based on its fact reads/writes.

    - Writes a fact -> group "_auto.fact.{NAME}"
    - Reads a fact (not also written) -> after "_auto.fact.{NAME}"
    - Reads AND writes same fact -> group only (writer, no after)

    Recurses into nested rules in offerRule, generateRule, advertiseEffect.
    Each nesting level is processed independently. The nested rule of an
    advertiseEffect OR a generateRule is itself an effect (is_effect=True) —
    both are persisted into next.rules.effects and auto-joined to __effects__
    on the next evaluation. The nested rule of an offerRule is not an effect
    (it becomes a planned rule and manages its own ordering).

    For effect rules (is_effect=True), a nested offerRule's legalWhen reads do
    NOT contribute to this effect's auto-after — see extract_fact_reads_writes.
    """
    reads, writes = extract_fact_reads_writes(
        rule, include_offer_legalwhen=not is_effect
    )

    # Ensure lists exist (YAML empty key parses as None, not [])
    if not rule.get("group"):
        rule["group"] = []
    if not rule.get("after"):
        rule["after"] = []

    existing_groups = set(rule["group"])
    existing_after_groups = {a["group"] for a in rule["after"]}

    # Add groups for all writes
    for fact in sorted(writes):
        auto_group = f"{AUTO_GROUP_PREFIX}{fact}"
        if auto_group not in existing_groups:
            rule["group"].append(auto_group)
            existing_groups.add(auto_group)

    # Add afters for reads that are NOT also writes
    read_only = reads - writes
    for fact in sorted(read_only):
        auto_after = f"{AUTO_GROUP_PREFIX}{fact}"
        if auto_after not in existing_after_groups:
            rule["after"].append({"group": auto_after})
            existing_after_groups.add(auto_after)

    # Clean up empty lists
    if not rule["group"]:
        del rule["group"]
    if not rule["after"]:
        del rule["after"]

    # Recurse into nested rules (each level independent). advertiseEffect and
    # generateRule children both become __effects__ members on the next
    # evaluation (advertiseEffect → advertisedEffects, generateRule →
    # generatedRules; both flow into next.rules.effects via getPersistableEffects
    # in output.ts, which evaluate.ts auto-joins to __effects__), so they are
    # effects for auto-grouping. offerRule children become planned rules and
    # manage their own ordering, so they are not effects.
    for activity in rule.get("activities", []):
        activity_type = activity.get("type", "")
        if activity_type in ("offerRule", "generateRule", "advertiseEffect"):
            if "rule" in activity:
                add_auto_groups(
                    activity["rule"],
                    is_effect=activity_type in ("advertiseEffect", "generateRule"),
                )


def standardize_term(text: str) -> str:
    """
    Normalize text for search indexing/querying.

    - Normalizes to NFD to separate base characters from diacritics
    - Removes combining characters (diacritics)
    - Converts to lowercase
    - Removes non-alphanumeric characters

    This must match the frontend implementation exactly.
    """
    # Normalize to NFD, remove combining characters (diacritics)
    normalized = unicodedata.normalize("NFD", text)
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    # Lowercase and remove non-alphanumeric
    return re.sub(r"[^a-z0-9]", "", stripped.lower())


def generate_prefixes(term: str) -> list[str]:
    """
    Generate all prefixes from PREFIX_MIN_LENGTH to PREFIX_MAX_LENGTH characters.

    Examples:
        "fireball" -> ["fir", "fire", "fireb", "fireba"]
        "walk" -> ["wal", "walk"]
    """
    if len(term) < PREFIX_MIN_LENGTH:
        return []

    max_len = min(len(term), PREFIX_MAX_LENGTH)
    return [term[:i] for i in range(PREFIX_MIN_LENGTH, max_len + 1)]


def build_rule_group_item(rg: dict[str, Any], now: str) -> dict[str, Any]:
    """
    Build a DynamoDB item from a rule group.

    Args:
        rg: Rule group dictionary from YAML
        now: Current timestamp for updatedAt

    Returns:
        DynamoDB item dictionary

    Raises:
        KeyError: If required fields are missing
    """
    # Validate required fields
    if "translations" not in rg:
        raise KeyError(f"Rule group {rg.get('id', 'unknown')} missing required 'translations' field")

    item = {
        "PK": f"{RULEGROUP_PK_PREFIX}{rg['id']}",
        "SK": RULEGROUP_SK,
        "type": "RULEGROUP",
        "ruleGroupId": rg["id"],
        "translations": rg["translations"],
        "requires": rg.get("requires", []),
        "rules": json.dumps(rg.get("rules", [])),
        "settings": json.dumps(rg.get("settings", [])),
        "condition": json.dumps(rg.get("condition", [])),
        "createdAt": rg.get("createdAt", now),
        "updatedAt": now,
    }

    return item


def build_search_index_entries(
    rule_groups: list[dict[str, Any]], category: str, now: str
) -> list[dict[str, Any]]:
    """
    Build search index entries from rule groups for all supported locales.

    For each rule group, creates entries for:
    - Name matches (SCORE#0002)
    - Keyword matches (SCORE#0001)

    Each term generates prefixes from 3-6 characters.
    """
    entries = []

    for rg in rule_groups:
        rg_id = rg["id"]
        translations = rg.get("translations", {})

        for locale in SUPPORTED_LOCALES:
            locale_trans = translations.get(locale, {})
            name = locale_trans.get("name", "")
            keywords = locale_trans.get("keywords", [])

            # Process name
            if name:
                standardized_name = standardize_term(name)
                for prefix in generate_prefixes(standardized_name):
                    pk = f"{SEARCHINDEX_PK_PREFIX}{locale}{SEARCHINDEX_PK_PREFIX_SUFFIX}{prefix}"
                    sk = f"{SEARCHINDEX_SK_PREFIX}{SCORE_NAME_MATCH}{SEARCHINDEX_SK_RULEGROUP_PREFIX}{rg_id}"
                    gsi1sk = f"{SEARCHINDEX_GSI1SK_PREFIX}{now}"

                    entries.append({
                        "PK": pk,
                        "SK": sk,
                        "type": SEARCHINDEX_TYPE,
                        "category": category,
                        "updatedAt": now,
                        "GSI1PK": f"{SEARCHINDEX_GSI1PK_PREFIX}{category}",
                        "GSI1SK": gsi1sk,
                    })

            # Process keywords
            for keyword in keywords:
                if keyword:
                    standardized_keyword = standardize_term(keyword)
                    for prefix in generate_prefixes(standardized_keyword):
                        pk = f"{SEARCHINDEX_PK_PREFIX}{locale}{SEARCHINDEX_PK_PREFIX_SUFFIX}{prefix}"
                        sk = f"{SEARCHINDEX_SK_PREFIX}{SCORE_KEYWORD_MATCH}{SEARCHINDEX_SK_RULEGROUP_PREFIX}{rg_id}"
                        gsi1sk = f"{SEARCHINDEX_GSI1SK_PREFIX}{now}"

                        entries.append({
                            "PK": pk,
                            "SK": sk,
                            "type": SEARCHINDEX_TYPE,
                            "category": category,
                            "updatedAt": now,
                            "GSI1PK": f"{SEARCHINDEX_GSI1PK_PREFIX}{category}",
                            "GSI1SK": gsi1sk,
                        })

    return entries


def write_search_index(
    table: Any, entries: list[dict[str, Any]], dry_run: bool, verbose: bool
) -> int:
    """Batch write search index entries to DynamoDB. Returns count written."""
    if not entries:
        return 0

    # Deduplicate by PK+SK to avoid BatchWriteItem validation errors
    seen: set[tuple[str, str]] = set()
    unique_entries: list[dict[str, Any]] = []
    for entry in entries:
        key = (entry["PK"], entry["SK"])
        if key not in seen:
            seen.add(key)
            unique_entries.append(entry)

    written = 0

    # Process in batches of 25
    for i in range(0, len(unique_entries), BATCH_WRITE_SIZE):
        batch = unique_entries[i : i + BATCH_WRITE_SIZE]

        if dry_run:
            for entry in batch:
                if verbose:
                    print(f"    Would write search index: {entry['PK']} -> {entry['SK']}")
            written += len(batch)
            continue

        batch_items = [{"PutRequest": {"Item": entry}} for entry in batch]

        if batch_items:
            table.meta.client.batch_write_item(RequestItems={table.name: batch_items})
            written += len(batch_items)

    return written


def cleanup_old_search_entries(
    table: Any, category: str, sync_timestamp: str, dry_run: bool, verbose: bool
) -> int:
    """
    Delete search index entries older than sync_timestamp for a category.

    Uses gsi1 to query entries by category, then deletes those with
    updatedAt older than the current sync.
    """
    gsi1pk = f"{SEARCHINDEX_GSI1PK_PREFIX}{category}"
    deleted = 0

    try:
        # Query gsi1 for all entries in this category older than sync_timestamp
        response = table.query(
            IndexName="gsi1",
            KeyConditionExpression=boto3.dynamodb.conditions.Key("GSI1PK").eq(gsi1pk)
            & boto3.dynamodb.conditions.Key("GSI1SK").lt(
                f"{SEARCHINDEX_GSI1SK_PREFIX}{sync_timestamp}"
            ),
        )

        items = response.get("Items", [])

        for item in items:
            if dry_run:
                if verbose:
                    print(f"    Would delete stale search index: {item['PK']} -> {item['SK']}")
                deleted += 1
                continue

            try:
                table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                deleted += 1
            except ClientError as e:
                print(
                    f"  ERROR deleting search index {item['PK']}/{item['SK']}: {e}",
                    file=sys.stderr,
                )

    except ClientError as e:
        print(f"  ERROR querying gsi1 for cleanup: {e}", file=sys.stderr)

    return deleted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync rule groups to DynamoDB")
    parser.add_argument("--table", help="DynamoDB table name (required unless --json-out is used)")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument(
        "--data-dir",
        default="data/rule-groups",
        help="Path to rule groups data directory (default: data/rule-groups)",
    )
    parser.add_argument(
        "--data-dir2",
        default=None,
        help="Optional second data directory (e.g., build/rule-groups for generated rules)",
    )
    parser.add_argument(
        "--json-out",
        help="Output processed rule groups as JSON to this path (skips DynamoDB)",
    )
    return parser.parse_args()


def load_shared_definitions(category_path: Path) -> str:
    """Load shared YAML anchor definitions for a category."""
    shared_file = category_path.parent / "_shared" / "definitions.yaml"
    if shared_file.exists():
        return shared_file.read_text()
    return ""


def compute_category_hash(category_path: Path) -> str:
    """Compute a combined hash of all YAML files in a category.

    Includes RULE_TRANSFORM_VERSION so that changes to the rule-output transform
    logic (not just the source YAML) invalidate the hash and force a re-sync.
    """
    hasher = hashlib.sha256()

    hasher.update(b"__transform_version__")
    hasher.update(str(RULE_TRANSFORM_VERSION).encode())

    shared_defs = load_shared_definitions(category_path)
    if shared_defs:
        hasher.update(b"__shared__")
        hasher.update(shared_defs.encode())

    yaml_files = sorted(category_path.rglob("*.yaml"))
    for yaml_file in yaml_files:
        if "_shared" in yaml_file.parts:
            continue
        with open(yaml_file, "rb") as f:
            content = f.read()
            hasher.update(yaml_file.name.encode())
            hasher.update(content)

    return hasher.hexdigest()


def parse_rule_groups(category_path: Path, verbose: bool = False) -> list[dict[str, Any]]:
    """Parse all rule groups from YAML files in a category."""
    rule_groups = []
    shared_defs = load_shared_definitions(category_path)

    yaml_files = sorted(category_path.rglob("*.yaml"))
    for yaml_file in yaml_files:
        if "_shared" in yaml_file.parts:
            continue

        if verbose:
            print(f"  Parsing {yaml_file.relative_to(category_path.parent)}")

        with open(yaml_file) as f:
            content = f.read()

        if shared_defs:
            data = yaml.safe_load(shared_defs + "\n" + content)
        else:
            data = yaml.safe_load(content)

        if not data:
            continue

        file_rule_groups = data.get("ruleGroups", [])
        if not file_rule_groups:
            print(f"  WARNING: No ruleGroups found in {yaml_file}", file=sys.stderr)
            continue

        for rg in file_rule_groups:
            if "id" not in rg:
                print(f"  WARNING: Rule group missing 'id' in {yaml_file}", file=sys.stderr)
                continue
            rule_groups.append(rg)

    return rule_groups


def get_directory_records(table: Any) -> dict[str, dict]:
    """Fetch all directory records from DynamoDB."""
    records = {}

    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(DIRECTORY_PK)
        )

        for item in response.get("Items", []):
            sk = item.get("SK", "")
            if sk.startswith(DIRECTORY_SK_PREFIX):
                category = sk[len(DIRECTORY_SK_PREFIX) :]
                records[category] = item

    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise

    return records


def batch_write_rule_groups(
    table: Any, rule_groups: list[dict], dry_run: bool, verbose: bool, now: str
) -> int:
    """Batch write rule groups to DynamoDB. Returns count written."""
    if not rule_groups:
        return 0

    written = 0

    # Process in batches of 25
    for i in range(0, len(rule_groups), BATCH_WRITE_SIZE):
        batch = rule_groups[i : i + BATCH_WRITE_SIZE]

        if dry_run:
            for rg in batch:
                if verbose:
                    print(f"    Would write: {rg['id']}")
            written += len(batch)
            continue

        batch_items = []
        for rg in batch:
            item = build_rule_group_item(rg, now)
            batch_items.append({"PutRequest": {"Item": item}})

        if batch_items:
            table.meta.client.batch_write_item(RequestItems={table.name: batch_items})
            written += len(batch_items)

    return written


def delete_rule_groups(
    table: Any, ids_to_delete: list[str], dry_run: bool, verbose: bool
) -> int:
    """Delete rule groups from DynamoDB. Returns count deleted."""
    if not ids_to_delete:
        return 0

    deleted = 0

    for rg_id in ids_to_delete:
        if dry_run:
            if verbose:
                print(f"    Would delete: {rg_id}")
            deleted += 1
            continue

        try:
            table.delete_item(
                Key={"PK": f"{RULEGROUP_PK_PREFIX}{rg_id}", "SK": RULEGROUP_SK}
            )
            deleted += 1
        except ClientError as e:
            print(f"  ERROR deleting {rg_id}: {e}", file=sys.stderr)

    return deleted


def write_directory_record(
    table: Any,
    category: str,
    content_hash: str,
    ids: list[str],
    file_count: int,
    dry_run: bool,
) -> None:
    """Write or update the directory record for a category."""
    if dry_run:
        return

    now = datetime.now(timezone.utc).isoformat()

    table.put_item(
        Item={
            "PK": DIRECTORY_PK,
            "SK": f"{DIRECTORY_SK_PREFIX}{category}",
            "category": category,
            "contentHash": content_hash,
            "ids": ids,
            "syncedAt": now,
            "fileCount": file_count,
        }
    )


def sync_category(
    table: Any,
    category: str,
    category_path: Path,
    directory_records: dict[str, dict],
    dry_run: bool,
    verbose: bool,
) -> dict[str, int]:
    """Sync a single category. Returns stats dict."""
    stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0, "searchAdded": 0, "searchDeleted": 0}
    now = datetime.now(timezone.utc).isoformat()

    # Compute current hash
    current_hash = compute_category_hash(category_path)

    # Get stored record
    stored_record = directory_records.get(category)
    stored_hash = stored_record.get("contentHash") if stored_record else None
    stored_ids = set(stored_record.get("ids", [])) if stored_record else set()

    # Check if unchanged
    if stored_hash == current_hash:
        stats["skipped"] = len(stored_ids)
        if verbose:
            print(f"  Skipping {category} (unchanged)")
        return stats

    print(f"  Syncing {category}...")

    # Parse all rule groups from files
    rule_groups = parse_rule_groups(category_path, verbose)

    # Apply auto-groups to all rules
    for rg in rule_groups:
        for rule in rg.get("rules", []):
            add_auto_groups(rule)

    current_ids = {rg["id"] for rg in rule_groups}

    # Determine changes
    added_ids = current_ids - stored_ids
    deleted_ids = stored_ids - current_ids

    if verbose:
        if added_ids:
            print(f"    Added: {added_ids}")
        if deleted_ids:
            print(f"    Deleted: {deleted_ids}")

    # Write rule groups (batch write handles both add and update)
    written = batch_write_rule_groups(table, rule_groups, dry_run, verbose, now)
    stats["added"] = len(added_ids)
    stats["updated"] = len(current_ids) - len(added_ids)

    # Delete removed rule groups
    deleted = delete_rule_groups(table, list(deleted_ids), dry_run, verbose)
    stats["deleted"] = deleted

    # Build and write search index entries
    search_entries = build_search_index_entries(rule_groups, category, now)
    search_written = write_search_index(table, search_entries, dry_run, verbose)
    stats["searchAdded"] = search_written

    # Cleanup old search index entries
    search_deleted = cleanup_old_search_entries(table, category, now, dry_run, verbose)
    stats["searchDeleted"] = search_deleted

    # Update directory record
    if not dry_run:
        write_directory_record(
            table,
            category,
            current_hash,
            list(current_ids),
            len(rule_groups),
            dry_run,
        )

    return stats


def compute_merged_hash(category_path: Path, generated_path: Path | None = None) -> str:
    """Compute hash including both base files and generated files.

    This ensures that changes to generated rule groups trigger a re-sync
    of the base categories they merge into.
    """
    hasher = hashlib.sha256()

    # Hash base category files
    base_hash = compute_category_hash(category_path)
    hasher.update(base_hash.encode())

    # Hash generated files if provided
    if generated_path and generated_path.exists():
        gen_hash = compute_category_hash(generated_path)
        hasher.update(gen_hash.encode())

    return hasher.hexdigest()


def sync_category_with_groups(
    table: Any,
    category: str,
    category_path: Path,
    rule_groups: list[dict[str, Any]],
    directory_records: dict[str, dict],
    dry_run: bool,
    verbose: bool,
    generated_path: Path | None = None,
) -> dict[str, int]:
    """Sync a category using pre-parsed rule groups (already auto-grouped).

    Similar to sync_category but accepts pre-parsed groups instead of reading files.
    Used when generated groups have been merged into bases before syncing.
    If generated_path is provided, the hash includes generated files so changes
    to generated groups trigger a re-sync.
    """
    stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0, "searchAdded": 0, "searchDeleted": 0}
    now = datetime.now(timezone.utc).isoformat()

    # Compute hash including generated files if applicable
    current_hash = compute_merged_hash(category_path, generated_path)

    # Get stored record
    stored_record = directory_records.get(category)
    stored_hash = stored_record.get("contentHash") if stored_record else None
    stored_ids = set(stored_record.get("ids", [])) if stored_record else set()

    # Check if unchanged
    if stored_hash == current_hash:
        stats["skipped"] = len(stored_ids)
        if verbose:
            print(f"  Skipping {category} (unchanged)")
        return stats

    print(f"  Syncing {category}...")

    current_ids = {rg["id"] for rg in rule_groups}

    # Determine changes
    added_ids = current_ids - stored_ids
    deleted_ids = stored_ids - current_ids

    if verbose:
        if added_ids:
            print(f"    Added: {added_ids}")
        if deleted_ids:
            print(f"    Deleted: {deleted_ids}")

    # Write rule groups (batch write handles both add and update)
    written = batch_write_rule_groups(table, rule_groups, dry_run, verbose, now)
    stats["added"] = len(added_ids)
    stats["updated"] = len(current_ids) - len(added_ids)

    # Delete removed rule groups
    deleted = delete_rule_groups(table, list(deleted_ids), dry_run, verbose)
    stats["deleted"] = deleted

    # Build and write search index entries
    search_entries = build_search_index_entries(rule_groups, category, now)
    search_written = write_search_index(table, search_entries, dry_run, verbose)
    stats["searchAdded"] = search_written

    # Cleanup old search index entries
    search_deleted = cleanup_old_search_entries(table, category, now, dry_run, verbose)
    stats["searchDeleted"] = search_deleted

    # Update directory record
    if not dry_run:
        write_directory_record(
            table,
            category,
            current_hash,
            list(current_ids),
            len(rule_groups),
            dry_run,
        )

    return stats


def _collect_categories(*data_dirs: Path) -> list[tuple[str, Path]]:
    """Collect (category_name, category_path) tuples from one or more data directories."""
    categories: list[tuple[str, Path]] = []
    seen: set[str] = set()
    for data_dir in data_dirs:
        if not data_dir.exists():
            continue
        for d in sorted(data_dir.iterdir()):
            if d.is_dir() and not d.name.startswith(".") and d.name not in seen:
                categories.append((d.name, d))
                seen.add(d.name)
    return categories


def merge_generated_into_bases(
    base_groups_by_id: dict[str, dict[str, Any]],
    generated_groups: list[dict[str, Any]],
) -> None:
    """Merge generated activation rules into their base rule groups.

    For each generated group, looks up its base via requires[0] and appends
    the generated group's rules to the base group. Generated groups without
    a matching base are skipped with a warning.
    """
    for gen_rg in generated_groups:
        requires = gen_rg.get("requires", [])
        if not requires:
            print(
                f"  WARNING: Generated group {gen_rg['id']} has no requires, skipping merge",
                file=sys.stderr,
            )
            continue

        base_id = requires[0]
        if base_id not in base_groups_by_id:
            print(
                f"  WARNING: Generated group {gen_rg['id']} requires '{base_id}', but no base group found",
                file=sys.stderr,
            )
            continue

        base = base_groups_by_id[base_id]
        gen_rules = gen_rg.get("rules", [])
        base["rules"].extend(gen_rules)

        # Merge requires from generated group into base group
        gen_requires = gen_rg.get("requires", [])
        base_requires = base.get("requires", [])
        for req in gen_requires:
            if req not in base_requires and req != base_id:
                base_requires.append(req)
        if base_requires:
            base["requires"] = base_requires

        print(f"  Merged {len(gen_rules)} rules from {gen_rg['id']} into {base_id}")


def output_json(data_dir: Path, output_path: str, verbose: bool = False, data_dir2: Path | None = None) -> None:
    """Process rule groups and output as JSON, skipping DynamoDB."""
    dirs = [data_dir]
    if data_dir2:
        dirs.append(data_dir2)

    categories = _collect_categories(*dirs)
    if not categories:
        print("No categories found in data directory", file=sys.stderr)
        sys.exit(1)

    # Parse all rule groups by category
    category_groups: dict[str, list[dict[str, Any]]] = {}
    for category_name, category_path in categories:
        if verbose:
            print(f"Processing {category_name}...")

        rule_groups = parse_rule_groups(category_path, verbose)
        for rg in rule_groups:
            for rule in rg.get("rules", []):
                add_auto_groups(rule)
        category_groups[category_name] = rule_groups

    # Merge generated groups into their bases
    generated_groups = category_groups.pop("generated", [])
    if generated_groups:
        base_groups_by_id: dict[str, dict[str, Any]] = {}
        for rgs in category_groups.values():
            for rg in rgs:
                base_groups_by_id[rg["id"]] = rg
        merge_generated_into_bases(base_groups_by_id, generated_groups)

    result: dict[str, dict] = {}
    for category_name, rule_groups in category_groups.items():
        for rg in rule_groups:
            rg_id = rg["id"]
            key = f"{category_name}/{rg_id}"
            entry: dict[str, Any] = {"rules": rg.get("rules", [])}
            if rg.get("requires"):
                entry["requires"] = rg["requires"]
            result[key] = entry

            if verbose:
                print(f"  {key}: {len(rg.get('rules', []))} rules")

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(result, indent=2))

    print(f"Wrote {len(result)} rule groups to {output_path}")


def main():
    args = parse_args()

    if not args.json_out and not args.table:
        print("ERROR: --table is required when --json-out is not specified", file=sys.stderr)
        sys.exit(1)

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    data_dir2 = Path(args.data_dir2) if args.data_dir2 else None

    # JSON output mode
    if args.json_out:
        output_json(data_dir, args.json_out, args.verbose, data_dir2)
        return

    # Initialize DynamoDB
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(args.table)

    print(f"Syncing rule groups from {data_dir}" + (f" and {data_dir2}" if data_dir2 else "") + f" to table {args.table}")
    if args.dry_run:
        print("DRY RUN - no changes will be made")
    print()

    # Get all directory records
    directory_records = get_directory_records(table)
    if args.verbose:
        print(f"Found {len(directory_records)} existing directory records")

    # Find all categories from both directories
    dirs = [data_dir]
    if data_dir2:
        dirs.append(data_dir2)
    categories = _collect_categories(*dirs)
    if not categories:
        print("No categories found in data directory")
        sys.exit(0)

    print(f"Found {len(categories)} categories to sync")
    print()

    # Parse and merge generated groups into their bases before syncing
    category_groups: dict[str, list[dict[str, Any]]] = {}
    category_paths: dict[str, Path] = {}
    for category_name, category_path in categories:
        rule_groups = parse_rule_groups(category_path, args.verbose)
        # Apply auto-groups to all rules before merge
        for rg in rule_groups:
            for rule in rg.get("rules", []):
                add_auto_groups(rule)
        category_groups[category_name] = rule_groups
        category_paths[category_name] = category_path

    generated_groups = category_groups.pop("generated", [])
    generated_path = category_paths.pop("generated", None)
    now = datetime.now(timezone.utc).isoformat()
    if generated_groups:
        base_groups_by_id: dict[str, dict[str, Any]] = {}
        for rgs in category_groups.values():
            for rg in rgs:
                base_groups_by_id[rg["id"]] = rg
        merge_generated_into_bases(base_groups_by_id, generated_groups)

        # Delete stale generated rule groups from DynamoDB
        # (they were merged into bases, no longer exist as separate groups)
        generated_ids = [rg["id"] for rg in generated_groups]
        deleted = delete_rule_groups(table, generated_ids, args.dry_run, args.verbose)
        print(f"  Cleaned up {deleted} stale generated groups")
        # Clean up search index entries for the generated category
        search_deleted = cleanup_old_search_entries(
            table, "generated", now, args.dry_run, args.verbose
        )
        if search_deleted:
            print(f"  Cleaned up {search_deleted} stale generated search entries")
        # Also clean up the generated category directory record
        if not args.dry_run:
            table.delete_item(
                Key={"PK": DIRECTORY_PK, "SK": f"{DIRECTORY_SK_PREFIX}generated"}
            )

    # Sync each base category with merged content
    total_stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0, "searchAdded": 0, "searchDeleted": 0}

    for category_name, category_path in category_paths.items():
        stats = sync_category_with_groups(
            table, category_name, category_path, category_groups[category_name],
            directory_records, args.dry_run, args.verbose,
            generated_path=generated_path if generated_groups else None,
        )
        for key in total_stats:
            total_stats[key] += stats[key]

    # Summary
    print()
    print("Summary:")
    print(f"  Categories synced: {len(categories)}")
    print(f"  Rule groups added: {total_stats['added']}")
    print(f"  Rule groups updated: {total_stats['updated']}")
    print(f"  Rule groups deleted: {total_stats['deleted']}")
    print(f"  Rule groups skipped (unchanged): {total_stats['skipped']}")
    print(f"  Search index entries added: {total_stats['searchAdded']}")
    print(f"  Search index entries deleted: {total_stats['searchDeleted']}")

    if args.dry_run:
        print()
        print("This was a dry run. Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
