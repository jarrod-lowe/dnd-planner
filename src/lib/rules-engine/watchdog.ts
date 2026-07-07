/**
 * Termination watchdog.
 *
 * Rule modules are lint-banned from constant-condition loops (`while(true)` /
 * `for(;;)`), which removes the common way to author a non-terminating rule. This
 * is the runtime backstop: a wall-clock budget threaded through the engine's own
 * variable-length loop (the plan fold) and checked between passes, so a
 * pathological-but-terminating evaluation is bounded rather than wedging the UI's
 * what-if reprocessing.
 *
 * Note the honest limit of a synchronous engine: a check between iterations
 * cannot pre-empt a hard infinite loop *inside* a single module call — only the
 * lint ban guards that until M2, where modules load as chunks behind a Worker
 * boundary that can be terminated.
 */
export class EngineTimeoutError extends Error {
  constructor(where: string, budgetMs: number) {
    super(`Rules evaluation exceeded its ${budgetMs}ms time budget (at ${where})`);
    this.name = 'EngineTimeoutError';
  }
}

/** Generous default: real evaluations run in single-digit milliseconds. */
export const DEFAULT_BUDGET_MS = 2000;

/** An absolute deadline (epoch ms) `budgetMs` from now. */
export function deadlineFrom(budgetMs: number): number {
  return Date.now() + budgetMs;
}

/** Throw if the deadline has passed. No-op when `deadline` is undefined. */
export function checkDeadline(deadline: number | undefined, where: string, budgetMs: number): void {
  if (deadline !== undefined && Date.now() > deadline) {
    throw new EngineTimeoutError(where, budgetMs);
  }
}
