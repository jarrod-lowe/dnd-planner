/**
 * Rules engine — panel-entry declarations (the subject UI contract).
 *
 * A panel entry is PURE DATA describing one chip/row of the play UI (top bar
 * or resources ledger): an i18n label key plus the facts that drive it. These
 * types are the contract between rule modules — which DECLARE their subject's
 * entries as data (`RuleModule.panels`) — and the play layer, which aggregates
 * (`derivePanels`) and renders them. Like an offer's `ui`, declarations are
 * inert to the engine: display metadata, never logic.
 *
 * The entry payload mirrors the shapes the play renderer consumes (`UiEntry`),
 * so declaring a subject needs no rendering code anywhere — adding a companion
 * (steed, vehicle) is a declaration on its module.
 */

// ── Unified UI Entry Types ──

export type UiEntryType =
  | 'usedMax'
  | 'value'
  | 'modifier'
  | 'hitDie'
  | 'slotLevels'
  | 'actionPools'
  | 'concentration'
  | 'ability';

interface UiEntryBase {
  label: string;
  nameParams?: Record<string, unknown>;
  subject?: string;
}

export interface UiEntryUsedMax extends UiEntryBase {
  type: 'usedMax';
  total: string;
  remaining: string;
}

export interface UiEntryValue extends UiEntryBase {
  type: 'value';
  fact: string;
  /**
   * A textual state's label map: numeric fact value → i18n key. A value
   * entry without one renders the raw fact (the number); with one, the
   * render sites translate the mapped key ("Soul Coin", never "1") and fall
   * back to the raw value for unmapped ordinals. The engine's facts are
   * numbers, so this map is the only way a panel chip states a textual mode.
   */
  valueLabels?: Record<number, string>;
}

export interface UiEntryModifier extends UiEntryBase {
  type: 'modifier';
  fact: string;
  proficiencyFact?: string;
}

export interface UiEntryHitDie extends UiEntryBase {
  type: 'hitDie';
  total: string;
  remaining: string;
  dieSize: number;
}

/**
 * Per-level spell slots, rendered as a row of tiles plus a breakdown tray.
 *
 * Only the level numbers are stored: the driving facts are
 * `spellcasting.slots.level{n}.total` / `.spent` by construction, exactly as
 * `hitDie` carries only its `dieSize`.
 */
export interface UiEntrySlotLevels extends UiEntryBase {
  type: 'slotLevels';
  levels: number[];
}

/**
 * Per-pool action economy (Actions / Bonus Actions / Reactions), rendered as a
 * row of tiles plus a breakdown tray — the same display as `slotLevels`.
 *
 * `factPrefix` selects subject: '' (player) reads `actions.max` etc.;
 * 'companion.steed.' reads `companion.steed.actions.max` etc. Each pool carries
 * its own label (full, for the tray), shortLabel (compact, for tray rows), and tile
 * (single-letter i18n key, for cell tiles).
 */
export interface UiEntryActionPools extends UiEntryBase {
  type: 'actionPools';
  /** Fact prefix: '' for the player, 'companion.steed.' for the steed. */
  factPrefix: string;
  pools: Array<{ key: string; label: string; shortLabel: string; tile: string }>;
}

export interface UiEntryConcentration extends UiEntryBase {
  type: 'concentration';
  activeLabel: string;
  noneLabel: string;
}

export interface UiEntryAbility extends UiEntryBase {
  type: 'ability';
  abilities: Array<{
    name: string;
    fact: string;
    saveFact?: string;
    proficiencyFact?: string;
  }>;
}

export type UiEntry =
  | UiEntryUsedMax
  | UiEntryValue
  | UiEntryModifier
  | UiEntryHitDie
  | UiEntrySlotLevels
  | UiEntryActionPools
  | UiEntryConcentration
  | UiEntryAbility;

// ── Type Guard ──

export function isUiEntry(entry: unknown): entry is UiEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const obj = entry as Record<string, unknown>;

  if (obj.type === 'usedMax') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.total === 'string' &&
      typeof obj.remaining === 'string'
    );
  }

  if (obj.type === 'value') {
    if (typeof obj.label !== 'string' || typeof obj.fact !== 'string') return false;
    if (obj.valueLabels === undefined) return true;
    if (typeof obj.valueLabels !== 'object' || obj.valueLabels === null) return false;
    return Object.values(obj.valueLabels).every((v) => typeof v === 'string');
  }

  if (obj.type === 'modifier') {
    if (typeof obj.label !== 'string') return false;
    if (typeof obj.fact !== 'string') return false;
    if (obj.proficiencyFact !== undefined && typeof obj.proficiencyFact !== 'string') return false;
    return true;
  }

  if (obj.type === 'hitDie') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.total === 'string' &&
      typeof obj.remaining === 'string' &&
      typeof obj.dieSize === 'number'
    );
  }

  if (obj.type === 'slotLevels') {
    if (typeof obj.label !== 'string') return false;
    if (!Array.isArray(obj.levels)) return false;
    return obj.levels.every((level: unknown) => typeof level === 'number');
  }

  if (obj.type === 'actionPools') {
    if (typeof obj.label !== 'string') return false;
    if (typeof obj.factPrefix !== 'string') return false;
    if (!Array.isArray(obj.pools)) return false;
    return obj.pools.every(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).key === 'string' &&
        typeof (p as Record<string, unknown>).label === 'string' &&
        typeof (p as Record<string, unknown>).shortLabel === 'string' &&
        typeof (p as Record<string, unknown>).tile === 'string'
    );
  }

  if (obj.type === 'concentration') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.activeLabel === 'string' &&
      typeof obj.noneLabel === 'string'
    );
  }

  if (obj.type === 'ability') {
    if (typeof obj.label !== 'string') return false;
    if (!Array.isArray(obj.abilities)) return false;
    return obj.abilities.every(
      (a: unknown) =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as Record<string, unknown>).name === 'string' &&
        typeof (a as Record<string, unknown>).fact === 'string' &&
        ((a as Record<string, unknown>).saveFact === undefined ||
          typeof (a as Record<string, unknown>).saveFact === 'string') &&
        ((a as Record<string, unknown>).proficiencyFact === undefined ||
          typeof (a as Record<string, unknown>).proficiencyFact === 'string')
    );
  }

  return false;
}

// ── Subject panel declarations ──

/** Which play panel a declared entry belongs to. */
export type SubjectPanel = 'topBar' | 'resources';

/**
 * When a declared entry surfaces, as a function of the evaluated facts:
 * - a plain string — the fact is present (the owning module is loaded and its
 *   derive produced the value)
 * - `{ any }` — any listed fact is present (e.g. a pool row that must surface
 *   when either of two pool maxima exists)
 * - `{ fact, equals }` — the fact holds exactly this numeric value (e.g. the
 *   creature-type-selected ability pool: only the matching type's row shows)
 *
 * A LIST of gates is a conjunction — every gate must hold.
 */
export type SubjectPanelGate = string | { any: string[] } | { fact: string; equals: number };

/** Does this gate hold in `facts`? (A list of gates is a conjunction.) */
export function gateHolds(
  facts: Record<string, unknown>,
  gate: SubjectPanelGate | SubjectPanelGate[]
): boolean {
  const holds = (g: SubjectPanelGate): boolean => {
    if (typeof g === 'string') return facts[g] !== undefined;
    if ('any' in g) return g.any.some((f) => facts[f] !== undefined);
    return facts[g.fact] === g.equals;
  };
  return Array.isArray(gate) ? gate.every(holds) : holds(gate);
}

/**
 * One panel entry a module declares for its SUBJECT (a companion / vehicle
 * view, e.g. the steed's HP chip). Pure data: the entry payload is a
 * `UiEntry` MINUS `subject` — the aggregation seam stamps the declaration's
 * `subject` onto the emitted entry, so the subject-filtering UI (top bar,
 * ledger) stays generic.
 */
export interface SubjectPanelDeclaration {
  /** The subject view the entry belongs to (e.g. 'steed') — stamped on the entry. */
  subject: string;
  /** Which panel: the play top bar or the resources ledger. */
  panel: SubjectPanel;
  /** When the entry surfaces; several gates combine as a conjunction. */
  gate: SubjectPanelGate | SubjectPanelGate[];
  /** The rendered entry (label keys + fact names), without `subject`. */
  entry: UiEntry;
}
