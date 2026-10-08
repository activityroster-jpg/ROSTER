/**
 * Cloudflare D1 refuses a statement with more than 100 bound parameters
 * ("too many SQL variables"). A list of ids in one `IN (...)` is one
 * parameter each, so long lists are read in pieces.
 */
export const D1_MAX_PARAMS = 100;

/** Split `values` into pieces small enough for one statement with a few other parameters. */
export function paramChunks<T>(values: readonly T[], size = 80): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
