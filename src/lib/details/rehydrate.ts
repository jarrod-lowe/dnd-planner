import { prefetchDetail } from '$lib/details/index';
import { browser } from '$app/environment';
import type { Rule } from '$lib/rules-engine';

export function prefetchDetailsForEffects(effects: Rule[]): void {
  if (!browser) return;
  for (const effect of effects) {
    const ui = effect.ui as Record<string, unknown> | undefined;
    const detailKey = ui?.detailKey as string | undefined;
    if (detailKey) {
      prefetchDetail(detailKey);
    }
  }
}
