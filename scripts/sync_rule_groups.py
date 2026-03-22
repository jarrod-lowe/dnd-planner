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
import sys
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
    table: Any, rule_groups: list[dict], dry_run: bool, verbose: bool
) -> int:
    """Batch write rule groups to DynamoDB. Returns count written."""
    if not rule_groups:
        return 0

    now = datetime.now(timezone.utc).isoformat()
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
            item = {
                "PK": f"{RULEGROUP_PK_PREFIX}{rg['id']}",
                "SK": RULEGROUP_SK,
                "type": "RULEGROUP",
                "ruleGroupId": rg["id"],
                "name": rg.get("name", ""),
                "rules": json.dumps(rg.get("rules", [])),
                "createdAt": rg.get("createdAt", now),
                "updatedAt": now,
            }

            # Preserve createdAt if it exists in the rule group
            if "createdAt" in rg:
                item["createdAt"] = rg["createdAt"]

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
    stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0}

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
    written = batch_write_rule_groups(table, rule_groups, dry_run, verbose)
    stats["added"] = len(added_ids)
    stats["updated"] = len(current_ids) - len(added_ids)

    # Delete removed rule groups
    deleted = delete_rule_groups(table, list(deleted_ids), dry_run, verbose)
    stats["deleted"] = deleted

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
    total_stats = {"added": 0, "updated": 0, "deleted": 0, "skipped": 0}

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

    if args.dry_run:
        print()
        print("This was a dry run. Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()
