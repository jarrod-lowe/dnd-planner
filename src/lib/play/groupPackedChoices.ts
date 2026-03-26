import type { AvailableRuleEntry } from '$lib/rules-engine';

/**
 * Represents a single (non-packed) choice entry
 */
export interface SingleChoiceGroup {
  type: 'single';
  entry: AvailableRuleEntry;
}

/**
 * Represents a packed group with a leader and followers
 */
export interface PackedChoiceGroup {
  type: 'packed';
  leader: AvailableRuleEntry;
  followers: AvailableRuleEntry[];
}

/**
 * Union type for all choice groups
 */
export type ChoiceGroup = SingleChoiceGroup | PackedChoiceGroup;

/**
 * Groups available rule entries based on their packBehind UI field.
 *
 * Rules with ui.packBehind set will be "packed" behind the specified leader rule.
 * - If the leader exists (even if illegal), followers are grouped with it
 * - If the leader doesn't exist, the follower renders as a single entry
 * - Order is preserved: groups appear at the leader's original position
 *
 * @param entries - Flat list of available rule entries
 * @returns Grouped entries ready for rendering
 */
export function groupPackedChoices(entries: AvailableRuleEntry[]): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  const packed = new Map<string, AvailableRuleEntry[]>(); // leaderId → followers
  const leaderIds = new Set<string>();
  const processed = new Set<string>();

  // First pass: identify leaders and map followers
  for (const entry of entries) {
    const packBehind = entry.rule.ui?.packBehind as string | undefined;
    if (packBehind) {
      if (!packed.has(packBehind)) {
        packed.set(packBehind, []);
      }
      packed.get(packBehind)!.push(entry);
      leaderIds.add(packBehind);
    }
  }

  // Second pass: build groups in order
  for (const entry of entries) {
    if (processed.has(entry.rule.id)) continue;

    const packBehind = entry.rule.ui?.packBehind as string | undefined;

    // Check if this entry has a packBehind pointing to a non-existent leader
    if (packBehind && !entries.find((e) => e.rule.id === packBehind)) {
      // Leader doesn't exist, render as single
      groups.push({ type: 'single', entry });
      processed.add(entry.rule.id);
      continue;
    }

    const followers = packed.get(entry.rule.id);

    if (followers && followers.length > 0) {
      // This entry is a leader with followers
      groups.push({ type: 'packed', leader: entry, followers });
      processed.add(entry.rule.id);
      for (const follower of followers) {
        processed.add(follower.rule.id);
      }
    } else if (!leaderIds.has(entry.rule.id)) {
      // Standalone entry (not a leader, not a follower)
      groups.push({ type: 'single', entry });
      processed.add(entry.rule.id);
    }
    // Entry is a follower with existing leader - handled when we process the leader
  }

  return groups;
}
