export interface ValueSource {
  fact?: string;
  var?: string;
  number?: number;
  string?: string;
  array?: unknown[];
}

export interface DiceEntry {
  expression: string | { var: string };
  bonus?: ValueSource;
  damageType?: ValueSource;
}

export interface ControlBase {
  enabled?: {
    condition: import('$lib/rules-engine').Condition;
    button: string; // i18n key
  };
  annotationLabels?: string[];
}

export interface DiceLineControl extends ControlBase {
  type: 'dice-line';
  ranges?: ValueSource;
  advantage?: ValueSource;
  dice: DiceEntry[];
}

export interface SliderControl extends ControlBase {
  type: 'slider';
  var: string;
  min?: ValueSource;
  max?: ValueSource;
  step?: number;
  unit?: string;
}

export interface SelectOption {
  value: number;
  label: string;
  ariaLabel?: string;
}

export interface SelectControl extends ControlBase {
  type: 'select';
  var: string;
  options: ValueSource | SelectOption[];
  display?: ValueSource;
}

export type Control = DiceLineControl | SliderControl | SelectControl;

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
  name?: string; // i18n key
  primaryControl?: Control;
  secondaryControl?: Control;
  information?: Information[];
  followups?: import('$lib/rules-engine').Followup[];
}
