import type { RollPurpose } from '$lib/rules-view';

export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/**
 * Critical-hit mode for damage dice. On 'critical' the number of dice rolled is
 * doubled (the modifier is not). Parallel to {@link RollMode} but on a separate
 * axis: a roll is either adv/disadv (d20) or normal/critical (damage), never
 * both, because the two apply to different die types.
 */
export type CritMode = 'normal' | 'critical';

/**
 * Semantic role of a die within a dice-line. Authored per die so the UI can
 * label/group rolls by intent rather than inferring from die size or damageType.
 * Aliases the view contract's `RollPurpose` so a rider's `appliesTo` and a die's
 * `purpose` are the same closed set by construction.
 */
export type DicePurpose = RollPurpose;

/**
 * A toggleable modifier offered on a dice line — one chip. Derived by
 * PanelRenderer from annotations whose rider carries a `value`; `key` is the
 * annotation key, and is what the toggle state is keyed on.
 */
export interface RollModifier {
  key: string;
  /** i18n key for the chip label. */
  label: string;
  /** Which die (by purpose) this applies to. */
  appliesTo: DicePurpose;
  /** Resolved numeric contribution to the total. */
  value: number;
  /** Whether the chip starts switched on. */
  defaultOn: boolean;
}

export interface RollResult {
  total: number;
  natural: number;
  mode?: RollMode;
  /** True when this damage roll was a critical hit (dice doubled, modifier not). */
  critical?: boolean;
  /** The roll that was NOT kept (for advantage/disadvantage) */
  droppedRoll?: number;
  /** Resolved bonus value */
  bonus?: number;
  /** Die sides (20, 12, 6, etc.) */
  sides?: number;
  /** Individual die results when rolling multiple dice (count > 1) */
  rolls?: number[];
  /** Number of dice rolled (when > 1) */
  count?: number;
  /** Resolved damage type string (e.g. "slashing") */
  damageType?: string;
  /** Unit key for non-damage rolls (e.g. "hp" for healing) */
  unit?: string;
  /** Semantic role of this roll, mirrored from the authored die. */
  purpose?: DicePurpose;
  /** Original die value (1 or 2) before GWF floor applied */
  gwfFloor?: number;
  /**
   * The value that actually lands after the roll's own math is replaced — e.g.
   * a hit-die heal floored at 1 or capped by missing HP. Only carried when it
   * DIFFERS from `total` (the raw natural + bonus math the equation shows);
   * the toast strikes the raw total and renders this beside it.
   */
  effective?: number;
  /** Active roll modifiers folded into `total` (over and above `bonus`). */
  modifiers?: { label: string; value: number }[];
}

export interface ValueSource {
  fact?: string;
  var?: string;
  number?: number;
  string?: string;
  array?: unknown[];
  /** Multiply the resolved numeric value by this factor. */
  scale?: number;
  /** Add this to the resolved value (after scale). */
  offset?: number;
  /** Clamp the final numeric result to at least this value (applied after scale+offset). */
  min?: number;
  /** Clamp the final numeric result to at most this value (applied after scale+offset). */
  max?: number;
}

export interface DiceEntry {
  /** Die sides (e.g. 20 for d20, 8 for d8). Can be a number or a var reference. */
  sides: number | { var: string };
  /**
   * Number of dice to roll (default 1). Either a fixed number, or a
   * ValueSource resolved from a var/fact/selection at render time (e.g. a
   * spell whose dice scale with the chosen slot level).
   */
  count?: number | ValueSource;
  bonus?: ValueSource;
  damageType?: ValueSource;
  /** Unit key for non-damage rolls (e.g. "hp" for healing). */
  unit?: string;
  /** Optional i18n key rendered as a small label before this chip (e.g. "Fiend/Undead"). */
  label?: string;
  /** Semantic role of this die (e.g. "to-hit", "damage", "healing", "save", "check"). */
  purpose?: DicePurpose;
}

export interface ControlBase {
  enabled?: {
    condition: import('$lib/rules-view').Condition;
    button?: string;
  };
}

export interface DiceLineControl extends ControlBase {
  type: 'dice-line';
  ranges?: ValueSource;
  advantage?: ValueSource;
  label?: string; // i18n key - inline text rendered like range text (e.g. "5ft")
  dice: DiceEntry[];
}

/** One die-size pool on a hit-dice control, resolved from facts at render time. */
export interface HitDicePool {
  /** Die size (6, 8, 10, 12). */
  sides: number;
  /** Total dice ever owned at this size — the pool renders this many slot rollers. */
  total: ValueSource;
  /** Unspent dice — slots at index >= `remaining` are spent and render disabled. */
  remaining: ValueSource;
}

/**
 * The hit-dice roller on a rest panel: one die roller per hit-die slot, grouped
 * by size (d6/d8/d10/d12 pools whose `total` resolves > 0; others are skipped).
 * Rolling slot i of size n writes `selections.rolls['d${n}'][i] = <natural
 * roll>` — the natural value only; the CON bonus and the 1-HP floor are applied
 * by the engine's `apply`, not folded into the roll.
 *
 * Note: `bonus` and `unit` are generic ValueSources, but today's UI labels
 * hardcode "CON" and the hp unit in its strings (play.hitDice.*) — the only
 * authored control is the CON-modulated short-rest heal. A differently-authored
 * control must generalize those labels first.
 */
export interface HitDiceControl extends ControlBase {
  type: 'hit-dice';
  pools: HitDicePool[];
  /** Bonus added to each die's heal (e.g. the CON modifier). */
  bonus?: ValueSource;
  /** Unit key for the heal (e.g. "hp"). */
  unit?: string;
}

export interface SliderNotch {
  value: number;
  enabled?: ValueSource; // when undefined or truthy, notch is active
}

export interface SliderControl extends ControlBase {
  type: 'slider';
  var: string;
  min?: ValueSource;
  max?: ValueSource;
  step?: number;
  unit?: string;
  // When set to 'spellLevel', the displayed value renders as "Free Use" (0) or
  // "Level N" (>=1) instead of a raw number. Used by spell upcast sliders.
  valueFormat?: string;
  // When set, the slider shows these explicit values instead of a sequential
  // min/max/step range. Each notch can be gated by an `enabled` condition.
  // Useful for spells with non-sequential valid levels (e.g. Free Use + L2-L5).
  notches?: SliderNotch[];
}

export interface SelectOption {
  value: number;
  label: string;
  ariaLabel?: string;
}

export interface SegmentedOption {
  value: number;
  label: string;
}

export interface SegmentedControl extends ControlBase {
  type: 'segmented';
  var: string;
  options: SegmentedOption[];
  /** Optional i18n key rendered as a label before the segments (e.g. "Enemy:" for a target's save). */
  prefix?: string;
}

export interface SelectControl extends ControlBase {
  type: 'select';
  var: string;
  options: ValueSource | SelectOption[];
  display?: ValueSource;
}

export interface TextInputControl extends ControlBase {
  type: 'text';
  var: string;
  placeholder?: string;
  multiline?: boolean;
}

export type Control =
  | DiceLineControl
  | HitDiceControl
  | SliderControl
  | SelectControl
  | TextInputControl
  | SegmentedControl;

export interface TextInformation {
  type: 'text';
  label: string; // i18n key
  labelValues?: Record<string, ValueSource>;
}

export interface CountdownInformation {
  type: 'countdown';
  filled: ValueSource;
  total: ValueSource;
}

export type Information = TextInformation | CountdownInformation;

export interface PanelDescriptor {
  section?: string;
  name?: string;
  description?: string;
  descriptionValues?: Record<string, ValueSource>;
  annotationLabels?: string[];
  primaryControl?: Control;
  secondaryControl?: Control;
  information?: Information[];
  followups?: import('$lib/rules-view').Followup[];
}
