/**
 * Defines the order of sections in the choices column.
 * Sections in this array appear first, in this order.
 * Unknown sections appear after these, "Other" (undefined) always last.
 */
export const SECTION_ORDER: string[] = [
  'configuration',
  'health',
  'move',
  'action-spell',
  'action-attack',
  'action-other',
  'bonus-action-spell',
  'bonus-action-other',
  'ongoing',
  'reaction',
  'free',
  'rest',
  'senses'
];

/**
 * Defines the order of stat sections in the stats column.
 * Sections in this array appear first, in this order.
 * Unknown sections appear after these, sorted alphabetically.
 */
export const STAT_SECTION_ORDER: string[] = [
  'resources',
  'stats',
  'skills',
  'passive',
  'abilities',
  'magic'
];
