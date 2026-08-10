/**
 * Engine ↔ module contract version.
 *
 * Bump this whenever the shape a module is built against (builder API, fact
 * conventions, EngineOutput contract) changes incompatibly. A chunk built for a
 * different value must not be loaded against this engine — the metadata carries
 * the value a group was built with, and the client refuses a mismatch before
 * loading the chunk.
 *
 * Under the co-bundled delivery model chosen for M2 (chunks ship with the app),
 * versions can't skew within one deploy, so this is mostly defensive — but it
 * guards stale cached metadata and keeps the door open for independently-deployed
 * chunks later.
 */
export const ENGINE_API_VERSION = 1;

/** Whether a chunk built for `builtForVersion` is safe to load against this engine. */
export function isEngineCompatible(builtForVersion: number): boolean {
  return builtForVersion === ENGINE_API_VERSION;
}
