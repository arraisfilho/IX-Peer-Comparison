// IX catalog search. Pure: no DOM, no network, no app state.

import { NET_CHUNK, ORG_CHUNK, SEARCH_MAX_RESULTS, SEARCH_MIN_CHARS } from '../config.js';

/** @import { CatalogEntry } from '../types.js' */

/**
 * The IXes of `catalog` whose name, long name, city, country or aka contain
 * every whitespace-separated term of `q`, case-insensitively, in catalog
 * order and at most SEARCH_MAX_RESULTS of them. Shorter queries than
 * SEARCH_MIN_CHARS match nothing.
 * @param {CatalogEntry[]} catalog
 * @param {string | null} q
 */
export function filterIXes(catalog, q) {
  if (!q || q.length < SEARCH_MIN_CHARS) return [];
  const parts = q.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog
    .filter((ix) => {
      const hay = [ix.name, ix.name_long, ix.city, ix.country, ix.aka].join(' ').toLowerCase();
      return parts.every((p) => hay.includes(p));
    })
    .slice(0, SEARCH_MAX_RESULTS);
}

/**
 * Rough load time of an IX with `netCount` members: one /netixlan call, one
 * /net call per NET_CHUNK networks and at most one /org call per ORG_CHUNK
 * networks, at 0.8 to 1.5 s per call.
 * @param {number} netCount
 */
export function estimateLoadTime(netCount) {
  const calls = 1 + Math.ceil(netCount / NET_CHUNK) + Math.ceil(netCount / ORG_CHUNK);
  const minTime = calls * 0.8;
  const maxTime = calls * 1.5;
  return { calls, minTime, maxTime };
}
