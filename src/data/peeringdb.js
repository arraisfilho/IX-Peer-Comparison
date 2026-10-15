// PeeringDB data: the IX catalog, IX members, networks and their countries.

import { API_BASE, IX_CATALOG_CACHE_KEY, IX_CATALOG_TTL, NET_CHUNK, ORG_CHUNK } from '../config.js';
import { normPolicy } from '../core/format.js';
import { validCC } from '../core/geo.js';
import { api } from './api.js';
import { storageGet, storageSet } from './storage.js';

/** @import { ApiOptions } from './api.js' */
/** @import { CatalogEntry, Net, PdbIx, PdbList, PdbNet, PdbNetixlan, PdbOrg } from '../types.js' */

/**
 * @typedef {object} Caches
 * @property {Record<number, Net>} netCache networks by net id
 * @property {Record<number, string>} orgCache organisation country by org id
 */

/**
 * Progress of loadNets(): after each /net chunk, before the organisations are
 * fetched, and at the end.
 * @typedef {{ stage: 'nets', done: number, chunks: number, loaded: number, total: number }
 *   | { stage: 'orgs' } | { stage: 'done' }} NetsProgress
 */

/**
 * The catalog cached in localStorage, or null when it is missing, older than
 * IX_CATALOG_TTL, empty or unreadable.
 * @returns {CatalogEntry[] | null}
 */
export function readCachedCatalog() {
  try {
    const raw = storageGet(IX_CATALOG_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached.ts && Date.now() - cached.ts < IX_CATALOG_TTL && cached.data?.length) {
        // ids end up in HTML attributes and URLs: drop entries a tampered cache could abuse
        return cached.data.filter((/** @type {CatalogEntry} */ ix) => Number.isInteger(ix?.id));
      }
    }
  } catch {
    // corrupt cache, ignore
  }
  return null;
}

/**
 * Fetches /api/ix (the whole list in one call), keeps the IXes with status
 * "ok" and only the fields the app uses, and caches the result in
 * localStorage (skipped when storage is unavailable or full).
 * @returns {Promise<CatalogEntry[]>}
 */
export async function fetchCatalog() {
  const r = await fetch(`${API_BASE}/ix`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  /** @type {PdbList<PdbIx>} */
  const d = await r.json();
  const catalog = (d.data || [])
    .filter((ix) => ix.status === 'ok' && Number.isInteger(ix.id))
    .map((ix) => ({
      id: ix.id,
      name: ix.name || '',
      name_long: ix.name_long || '',
      city: ix.city || '',
      country: ix.country || '',
      net_count: ix.net_count || 0,
      aka: ix.aka || '',
    }));
  storageSet(IX_CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: catalog }));
  return catalog;
}

/**
 * Members of an IX, from one /netixlan call: net id → fastest port in Mbit/s.
 * A network whose ports all report speed 0 or none is still a member (0).
 * @param {number} ixId
 * @param {ApiOptions} [options]
 * @returns {Promise<Map<number, number>>}
 */
export async function fetchMembers(ixId, options) {
  /** @type {PdbList<PdbNetixlan>} */
  const d = await api(`/netixlan?ix_id=${ixId}`, options);
  /** @type {Map<number, number>} */
  const members = new Map();
  for (const m of d.data || []) {
    const cur = members.get(m.net_id) || 0;
    members.set(m.net_id, Math.max(cur, m.speed || 0));
  }
  return members;
}

/**
 * Loads into `netCache` the networks of `ids` it does not have yet, from /net
 * by id, NET_CHUNK ids per request, then the country of their organisations.
 * A network missing from /net gets a stub named "AS?? (net#<id>)" with ASN 0.
 * @param {number[]} ids
 * @param {Caches} caches
 * @param {ApiOptions & { onProgress?: (progress: NetsProgress) => void }} [options]
 */
export async function loadNets(ids, caches, { onProgress, ...apiOptions } = {}) {
  const { netCache } = caches;
  const missing = ids.filter((id) => !netCache[id]);
  const total = missing.length;
  const chunks = Math.ceil(total / NET_CHUNK);
  /** @type {Set<number>} */
  const orgIds = new Set();

  for (let i = 0; i < missing.length; i += NET_CHUNK) {
    const chunk = missing.slice(i, i + NET_CHUNK);
    /** @type {PdbList<PdbNet>} */
    const d = await api(`/net?id__in=${chunk.join(',')}`, apiOptions);
    for (const n of d.data || []) {
      netCache[n.id] = {
        name: n.name,
        asn: n.asn,
        policy: normPolicy(n.policy_general),
        org_id: n.org_id || null,
        country: '',
      };
      if (n.org_id) orgIds.add(n.org_id);
    }
    for (const id of chunk) {
      if (!netCache[id]) {
        netCache[id] = { name: `AS?? (net#${id})`, asn: 0, policy: null, org_id: null, country: '' };
      }
    }
    const done = Math.floor(i / NET_CHUNK) + 1;
    onProgress?.({ stage: 'nets', done, chunks, loaded: Math.min(done * NET_CHUNK, total), total });
  }

  onProgress?.({ stage: 'orgs' });
  await loadOrgCountries([...orgIds], caches, apiOptions);
  onProgress?.({ stage: 'done' });
}

/**
 * Loads into `orgCache` the country of each organisation it does not have yet,
 * from /org by id, ORG_CHUNK ids per request, then gives every cached network
 * without a country the country of its organisation.
 * @param {number[]} orgIds
 * @param {Caches} caches
 * @param {ApiOptions} apiOptions
 */
async function loadOrgCountries(orgIds, { netCache, orgCache }, apiOptions) {
  const missing = orgIds.filter((id) => !(id in orgCache));
  for (let i = 0; i < missing.length; i += ORG_CHUNK) {
    const chunk = missing.slice(i, i + ORG_CHUNK);
    /** @type {PdbList<PdbOrg>} */
    const d = await api(`/org?id__in=${chunk.join(',')}`, apiOptions);
    for (const o of d.data || []) orgCache[o.id] = validCC(o.country);
    for (const id of chunk) if (!(id in orgCache)) orgCache[id] = '';
  }
  for (const net of Object.values(netCache)) {
    if (net.org_id && !net.country) net.country = orgCache[net.org_id] || '';
  }
}
