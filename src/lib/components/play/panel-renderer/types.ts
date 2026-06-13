export type RollMode = 'normal' | 'advantage' | 'disadvantage';

export interface RollResult {
  total: number;
  natural: number;
  mode?: RollMode;
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
  /** Original die value (1 or 2) before GWF floor applied */
  gwfFloor?: number;
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
}

export interface DiceEntry {
  /** Die sides (e.g. 20 for d20, 8 for d8). Can be a number or a var reference. */
  sides: number | { var: string };
  /** Number of dice to roll (default 1). */
  count?: number;
  bonus?: ValueSource;
  damageType?: ValueSource;
}

export interface ControlBase {
  enabled?: {
    condition: import('$lib/rules-engine').Condition;
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
  followups?: import('$lib/rules-engine').Followup[];
}
