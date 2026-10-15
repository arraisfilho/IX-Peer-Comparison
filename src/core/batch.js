// PeeringDB request paths and id batches. Pure: no DOM, no network, no app state.

/**
 * Throws if `path` carries the depth parameter: with depth >= 1 PeeringDB
 * truncates list results. Returns `path` otherwise.
 * @param {string} path
 */
export function assertNoDepth(path) {
  if (/[?&]depth=/i.test(path)) throw new Error(`PeeringDB requests must not use depth=: ${path}`);
  return path;
}

/**
 * Path of a PeeringDB list request, `/<endpoint>?<key>=<value>&…`, with list
 * values joined by commas (ids and field names need no escaping).
 * @param {string} endpoint
 * @param {Record<string, string | number | readonly (string | number)[]>} params
 */
export function pdbPath(endpoint, params) {
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
    .join('&');
  return assertNoDepth(`/${endpoint}?${query}`);
}

/**
 * `items` cut into consecutive slices of at most `size`.
 * @template T
 * @param {readonly T[]} items
 * @param {number} size
 * @returns {T[][]}
 */
export function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * `request(items)`; when it fails with an error that `canSplit` accepts
 * (a URL too long for the server), requests each half instead, recursively,
 * one after the other. A single item that still fails throws that error.
 * @template T, R
 * @param {T[]} items
 * @param {(items: T[]) => Promise<R[]>} request
 * @param {(error: unknown) => boolean} canSplit
 * @returns {Promise<R[]>}
 */
export async function splitOnError(items, request, canSplit) {
  try {
    return await request(items);
  } catch (error) {
    if (items.length < 2 || !canSplit(error)) throw error;
    const mid = Math.ceil(items.length / 2);
    const first = await splitOnError(items.slice(0, mid), request, canSplit);
    const second = await splitOnError(items.slice(mid), request, canSplit);
    return [...first, ...second];
  }
}
