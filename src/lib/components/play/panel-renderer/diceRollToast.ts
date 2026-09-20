import { get } from 'svelte/store';
import { t } from '$lib/i18n';
import { toast } from 'svelte-sonner';
import DiceRollToast from './DiceRollToast.svelte';
import { rollTypeKey } from './rollType';
import type { RollResult } from './types';

/**
 * Fire the standard dice-roll toast for a roll that has already happened.
 *
 * Extracted verbatim from `PanelRenderer.handleDiceRoll` so every parent that
 * mounts a roller (panel rows today, notice rollers next) produces a
 * byte-identical toast: translated roll type from the roll's `purpose`
 * (`rollTypeKey`), the advantage/disadvantage label, then
 * `extraModifierLabels` (i18n KEYS — PanelRenderer passes its informational
 * rider labels here), then each of `result.modifiers` as `label +N`.
 */
export function showDiceRollToast(
  title: string,
  result: RollResult,
  extraModifierLabels?: string[]
): void {
  const $t = get(t);

  const rollType = $t(rollTypeKey(result.purpose, result));

  const modifiers: string[] = [];
  if (result.mode === 'advantage') modifiers.push($t('play.toast.modifier.advantage'));
  if (result.mode === 'disadvantage') modifiers.push($t('play.toast.modifier.disadvantage'));
  for (const label of extraModifierLabels ?? []) {
    modifiers.push($t(label));
  }
  for (const m of result.modifiers ?? []) {
    modifiers.push(`${$t(m.label)} ${m.value >= 0 ? '+' : ''}${m.value}`);
  }

  toast.custom(DiceRollToast, {
    componentProps: {
      title,
      rollType,
      result,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      damageTypeKey: result.damageType,
      unitKey: result.unit
    },
    duration: 4000,
    unstyled: true
  });
}
