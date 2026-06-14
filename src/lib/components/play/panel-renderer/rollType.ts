import type { DicePurpose } from './types';

/**
 * Shape used to infer a roll type when no `purpose` is authored. Mirrors the
 * relevant fields of {@link RollResult} / {@link DiceEntry}.
 */
interface RollShape {
  sides?: number;
  damageType?: string;
}

/**
 * Resolve the i18n key (under `play.toast.rollType.*`) that labels a roll.
 *
 * An authored `purpose` always wins. When a dice-line has not yet been migrated
 * to carry a purpose, the type is inferred from the die's shape — matching the
 * behaviour the UI relied on before purpose existed — so unmigrated lines keep
 * rendering correctly.
 */
export function rollTypeKey(purpose?: DicePurpose, fallback?: RollShape): string {
  switch (purpose) {
    case 'to-hit':
    case 'damage':
    case 'healing':
    case 'save':
    case 'check':
      return `play.toast.rollType.${purpose}`;
    default:
      if (fallback?.sides === 20) return 'play.toast.rollType.check';
      if (fallback?.damageType) return 'play.toast.rollType.damage';
      return 'play.toast.rollType.roll';
  }
}
