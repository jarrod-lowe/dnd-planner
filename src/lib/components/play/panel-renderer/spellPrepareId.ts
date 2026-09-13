// Stable unique id prefix per PanelSpellPrepare instance.
//
// Each PanelSpellPrepare links its group to its counter through
// aria-describedby, so the counter element needs an id. Two pickers on the
// same page would collide on a fixed id like "spell-prepare-counter", so each
// instance gets a unique prefix.
//
// SSR-safe: the module loads once on the server and once on the client, and
// component instances mount in a deterministic order, so a given instance
// receives the same prefix across hydration.
let counter = 0;

export function nextSpellPrepareId(): string {
  return `psp-${counter++}`;
}
