import { SvelteMap, SvelteSet } from 'svelte/reactivity';

/**
 * Per-instance collapse state for the plan rows.
 *
 * A row opens expanded, and adding a NEW row collapses the rows that were
 * already there — the plan stays readable as it grows without the player
 * hunting for the row they just added. The exception is a row the player
 * expanded by hand: once they have done that, the stack stops touching it and
 * only their own chevron closes it again.
 */
export class PlanCollapseState {
  /**
   * instanceId → collapsed. Absent means "expanded" (the default). This is the
   * member the rows read, so it is the one that has to be reactive; the
   * bookkeeping below is sync()'s own, and callers drive sync() from the plan's
   * items (untracked) rather than from these.
   */
  #collapsed = new SvelteMap<string, boolean>();
  /** instanceIds the player has expanded by hand at some point. */
  #manuallyExpanded = new SvelteSet<string>();
  /** The instanceIds seen by the last sync(), so the next one can spot arrivals. */
  #known = new SvelteSet<string>();
  #primed = false;

  isCollapsed(instanceId: string): boolean {
    return this.#collapsed.get(instanceId) ?? false;
  }

  /**
   * A player-driven change from the row's own chevron. Expanding marks the row
   * as hand-expanded, which exempts it from every later auto-collapse — a
   * subsequent hand-collapse leaves that exemption in place, so the row simply
   * stays as the player last left it.
   */
  setCollapsed(instanceId: string, collapsed: boolean): void {
    this.#collapsed.set(instanceId, collapsed);
    if (!collapsed) this.#manuallyExpanded.add(instanceId);
  }

  /**
   * Reconcile with the plan's current rows. New arrivals collapse everything
   * else the player has not expanded by hand; the arrivals themselves stay
   * expanded.
   */
  sync(instanceIds: readonly string[]): void {
    // A plan is a handful of rows, so scanning the list beats keeping an index.
    const added = instanceIds.filter((id) => !this.#known.has(id));

    // The first sync is the baseline — the rows already on screen were not
    // "added" by the player in this session, so nothing collapses.
    if (added.length > 0 && this.#primed) {
      for (const id of instanceIds) {
        if (added.includes(id)) continue;
        if (this.#manuallyExpanded.has(id)) continue;
        this.#collapsed.set(id, true);
      }
    }

    for (const id of [...this.#known]) {
      if (instanceIds.includes(id)) continue;
      this.#known.delete(id);
      this.#collapsed.delete(id);
      this.#manuallyExpanded.delete(id);
    }
    for (const id of instanceIds) this.#known.add(id);
    this.#primed = true;
  }
}
