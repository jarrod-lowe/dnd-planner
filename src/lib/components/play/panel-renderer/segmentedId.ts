// Stable unique id prefix per PanelSegmented instance.
//
// Each PanelSegmented renders radio inputs with associated labels (and an
// optional prefix label) that need ids and a radio `name`. Two segmented
// controls sharing the same `var` on one page (e.g. Grapple and a save record
// both use "passed") would collide on fixed ids like "passed--1" and on the
// "passed" radio name — crossing up label[for] associations and merging the two
// into a single native radio group — so each instance gets a unique prefix.
//
// SSR-safe: the module loads once on the server and once on the client, and
// component instances mount in a deterministic order, so a given instance
// receives the same prefix across hydration.
let counter = 0;

export function nextSegmentedId(): string {
  return `ps-${counter++}`;
}
