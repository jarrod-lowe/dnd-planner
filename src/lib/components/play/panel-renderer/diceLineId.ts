// Stable unique id prefix per PanelDiceLine instance.
//
// Each PanelDiceLine renders popover/trigger elements that need ids (for
// aria-controls). Two dice-line panels on the same page would collide on
// fixed ids like "dice-options-0", so each instance gets a unique prefix.
//
// SSR-safe: the module loads once on the server and once on the client, and
// component instances mount in a deterministic order, so a given instance
// receives the same prefix across hydration.
let counter = 0;

export function nextDiceLineId(): string {
  return `pdl-${counter++}`;
}
