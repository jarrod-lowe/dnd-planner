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
 * Groups available rule entries by section, then applies packed grouping within each section.
 *
 * @param entries - Flat list of available rule entries
 * @param sectionOrder - Array defining the order of known sections
 * @returns Array of section groups, ordered by sectionOrder (unknown sections after, "Other" last)
 */
export function groupChoicesBySection(
  entries: AvailableRuleEntry[],
  sectionOrder: string[]
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

  // Build section groups
  const sections: SectionGroup[] = [];

  // First, add sections in the defined order
  for (const section of sectionOrder) {
    const sectionEntries = sectionMap.get(section);
    if (sectionEntries) {
      const hasLegalEntries = sectionEntries.some((e) => e.legal);
      sections.push({
        section,
        packedGroups: groupPackedChoices(sectionEntries),
        hasLegalEntries
      });
      sectionMap.delete(section);
    }
  }

  // Then, add unknown sections (excluding undefined)
  const unknownSections = Array.from(sectionMap.keys()).filter(
    (s): s is string => s !== undefined
  );
  for (const section of unknownSections) {
    const sectionEntries = sectionMap.get(section)!;
    const hasLegalEntries = sectionEntries.some((e) => e.legal);
    sections.push({
      section,
      packedGroups: groupPackedChoices(sectionEntries),
      hasLegalEntries
    });
    sectionMap.delete(section);
  }

  // Finally, add "Other" (undefined section) last
  const otherEntries = sectionMap.get(undefined);
  if (otherEntries) {
    const hasLegalEntries = otherEntries.some((e) => e.legal);
    sections.push({
      section: undefined,
      packedGroups: groupPackedChoices(otherEntries),
      hasLegalEntries
    });
  }

  return sections;
}
