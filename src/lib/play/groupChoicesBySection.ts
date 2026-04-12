import type { AvailableRuleEntry } from '$lib/rules-engine';
import { groupPackedChoices, type ChoiceGroup } from './groupPackedChoices';

/**
 * Represents a section group containing packed choice groups
 */
export interface SectionGroup {
  section: string | undefined;
  packedGroups: ChoiceGroup[];
  hasLegalEntries: boolean;
}

/**
 * Filters packed choice groups to remove illegal entries.
 * - Single illegal entries are removed
 * - Packed groups with an illegal leader: first legal follower is promoted to leader
 * - Packed groups with a legal leader: illegal followers are removed
 * - Empty groups are removed entirely
 */
function filterIllegalFromGroups(groups: ChoiceGroup[]): ChoiceGroup[] {
  const filtered: ChoiceGroup[] = [];

  for (const group of groups) {
    if (group.type === 'single') {
      if (group.entry.legal) {
        filtered.push(group);
      }
    } else if (group.type === 'packed') {
      const legalFollowers = group.followers.filter((f) => f.legal);

      if (group.leader.legal) {
        if (legalFollowers.length > 0) {
          filtered.push({ type: 'packed', leader: group.leader, followers: legalFollowers });
        } else {
          filtered.push({ type: 'single', entry: group.leader });
        }
      } else {
        // Leader is illegal — promote first legal follower
        if (legalFollowers.length > 1) {
          filtered.push({
            type: 'packed',
            leader: legalFollowers[0],
            followers: legalFollowers.slice(1)
          });
        } else if (legalFollowers.length === 1) {
          filtered.push({ type: 'single', entry: legalFollowers[0] });
        }
        // If no legal followers at all, the entire group is dropped
      }
    }
  }

  return filtered;
}

/**
 * Groups available rule entries by section, then applies packed grouping within each section.
 *
 * @param entries - Flat list of available rule entries
 * @param sectionOrder - Array defining the order of known sections
 * @param showIllegal - When false, illegal entries are filtered out with pack-aware logic
 * @returns Array of section groups, ordered by sectionOrder (unknown sections after, "Other" last)
 */
export function groupChoicesBySection(
  entries: AvailableRuleEntry[],
  sectionOrder: string[],
  showIllegal: boolean = true
): SectionGroup[] {
  if (entries.length === 0) {
    return [];
  }

  // Group entries by section
  const sectionMap = new Map<string | undefined, AvailableRuleEntry[]>();

  for (const entry of entries) {
    const section = entry.rule.ui?.section as string | undefined;
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }
    sectionMap.get(section)!.push(entry);
  }

  const buildSection = (section: string | undefined, sectionEntries: AvailableRuleEntry[]) => {
    let packedGroups = groupPackedChoices(sectionEntries);
    if (!showIllegal) {
      packedGroups = filterIllegalFromGroups(packedGroups);
    }
    if (packedGroups.length === 0) return null;
    const hasLegalEntries = packedGroups.some((g) => {
      if (g.type === 'single') return g.entry.legal;
      return g.leader.legal || g.followers.some((f) => f.legal);
    });
    return { section, packedGroups, hasLegalEntries };
  };

  // Build section groups
  const sections: SectionGroup[] = [];

  // First, add sections in the defined order
  for (const section of sectionOrder) {
    const sectionEntries = sectionMap.get(section);
    if (sectionEntries) {
      const result = buildSection(section, sectionEntries);
      if (result) sections.push(result);
      sectionMap.delete(section);
    }
  }

  // Then, add unknown sections (excluding undefined)
  const unknownSections = Array.from(sectionMap.keys()).filter((s): s is string => s !== undefined);
  for (const section of unknownSections) {
    const sectionEntries = sectionMap.get(section)!;
    const result = buildSection(section, sectionEntries);
    if (result) sections.push(result);
    sectionMap.delete(section);
  }

  // Finally, add "Other" (undefined section) last
  const otherEntries = sectionMap.get(undefined);
  if (otherEntries) {
    const result = buildSection(undefined, otherEntries);
    if (result) sections.push(result);
  }

  return sections;
}
