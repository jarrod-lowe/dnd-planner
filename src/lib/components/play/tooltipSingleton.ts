let activeClose: (() => void) | null = null;

export function closeActiveTooltip() {
  activeClose?.();
  activeClose = null;
}

export function registerTooltipClose(fn: (() => void) | null) {
  activeClose = fn;
}
