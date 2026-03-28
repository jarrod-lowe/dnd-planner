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
PREFIX_MAX_LENGTH = 6

# Supported locales for translations - must match schema.json
SUPPORTED_LOCALES = ["en", "en-x-tlh"]


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
        "rules": json.dumps(rg.get("rules", [])),
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
    parser.add_argument("--table", required=True, help="DynamoDB table name")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument(
        "--data-dir",
        default="data/rule-groups",
        help="Path to rule groups data directory (default: data/rule-groups)",
    )
    return parser.parse_args()


def compute_category_hash(category_path: Path) -> str:
    """Compute a combined hash of all YAML files in a category."""
    hasher = hashlib.sha256()

    yaml_files = sorted(category_path.rglob("*.yaml"))
    for yaml_file in yaml_files:
        with open(yaml_file, "rb") as f:
            content = f.read()
            hasher.update(yaml_file.name.encode())
            hasher.update(content)

    return hasher.hexdigest()


def parse_rule_groups(category_path: Path, verbose: bool = False) -> list[dict[str, Any]]:
    """Parse all rule groups from YAML files in a category."""
    rule_groups = []

    yaml_files = sorted(category_path.rglob("*.yaml"))
    for yaml_file in yaml_files:
        if verbose:
            print(f"  Parsing {yaml_file.relative_to(category_path.parent)}")

        with open(yaml_file) as f:
            data = yaml.safe_load(f)

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


def main():
    args = parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    # Initialize DynamoDB
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(args.table)

    print(f"Syncing rule groups from {data_dir} to table {args.table}")
    if args.dry_run:
        print("DRY RUN - no changes will be made")
    print()

    # Get all directory records
    directory_records = get_directory_records(table)
    if args.verbose:
        print(f"Found {len(directory_records)} existing directory records")

    # Find all categories
    categories = sorted([d for d in data_dir.iterdir() if d.is_dir() and not d.name.startswith(".")])
    if not categories:
        print("No categories found in data directory")
        sys.exit(0)

    print(f"Found {len(categories)} categories to sync")
    print()

    # Sync each category
    total_stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0, "searchAdded": 0, "searchDeleted": 0}

    for category_path in categories:
        category = category_path.name
        stats = sync_category(
            table, category, category_path, directory_records, args.dry_run, args.verbose
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
