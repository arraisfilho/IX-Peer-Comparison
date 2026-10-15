// PeeringDB data: the IX catalog, IX members, networks and their countries,
// and the record of each fully loaded IX kept in IndexedDB.

import {
  IX_CACHE_TTL,
  IX_CATALOG_CACHE_KEY,
  IX_CATALOG_TTL,
  IX_RECORD_VERSION,
  NET_CHUNK,
  ORG_CHUNK,
} from '../config.js';
import { chunks, pdbPath, splitOnError } from '../core/batch.js';
import { normPolicy } from '../core/format.js';
import { validCC } from '../core/geo.js';
import { ApiError, abortable, api } from './api.js';
import { kvGet, kvSet } from './idb.js';
import { storageGet, storageSet } from './storage.js';

/** @import { ApiOptions } from './api.js' */
/** @import { CatalogEntry, IxRecord, Net, PdbIx, PdbList, PdbNet, PdbNetixlan, PdbOrg } from '../types.js' */

/** Fields requested from each endpoint: only what the app reads. */
const IX_FIELDS = ['id', 'name', 'name_long', 'city', 'country', 'net_count', 'aka'];
const NETIXLAN_FIELDS = ['net_id', 'speed'];
const NET_FIELDS = ['id', 'asn', 'name', 'policy_general', 'org_id'];
const ORG_FIELDS = ['id', 'country'];

/**
 * Ids being requested by some IX load, by id: the promise settles when the
 * request carrying the id has finished, successfully or not.
 * @type {Map<number, Promise<void>>}
 */
const netsInFlight = new Map();
/** @type {Map<number, Promise<void>>} */
const orgsInFlight = new Map();

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
 * Fetches the IXes with status "ok" (the whole list in one call, only the
 * fields the app uses) and caches them in localStorage (skipped when storage
 * is unavailable or full).
 * @returns {Promise<CatalogEntry[]>}
 */
export async function fetchCatalog() {
  /** @type {PdbList<PdbIx>} */
  const d = await api(pdbPath('ix', { status: 'ok', fields: IX_FIELDS }));
  const catalog = (d.data || [])
    .filter((ix) => (ix.status === undefined || ix.status === 'ok') && Number.isInteger(ix.id))
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
  const d = await api(pdbPath('netixlan', { ix_id: ixId, fields: NETIXLAN_FIELDS }), options);
  /** @type {Map<number, number>} */
  const members = new Map();
  for (const m of d.data || []) {
    const cur = members.get(m.net_id) || 0;
    members.set(m.net_id, Math.max(cur, m.speed || 0));
  }
  return members;
}

/**
 * Loads into the caches the networks of `ids` and the country of their
 * organisations, from /net and /org by id, NET_CHUNK and ORG_CHUNK ids per
 * request. Ids that another IX load is already requesting are awaited, not
 * requested again. A network missing from /net gets a stub named
 * "AS?? (net#<id>)" with ASN 0. A failed /net request fails the load; when
 * /org fails, the networks keep no country and the result is partial.
 * @param {number[]} ids
 * @param {Caches} caches
 * @param {ApiOptions & { onProgress?: (progress: NetsProgress) => void }} [options]
 * @returns {Promise<{ partial: boolean }>}
 */
export async function loadNets(ids, caches, { onProgress, ...apiOptions } = {}) {
  const { netCache, orgCache } = caches;
  await loadIds(ids, (id) => id in netCache, netsInFlight, NET_CHUNK, apiOptions.signal, {
    fetchChunk: async (chunk) => {
      /** @type {PdbNet[]} */
      const rows = await fetchByIds('net', NET_FIELDS, chunk, apiOptions);
      for (const n of rows) {
        netCache[n.id] = {
          name: n.name,
          asn: n.asn,
          policy: normPolicy(n.policy_general),
          org_id: n.org_id || null,
          country: '',
        };
      }
      for (const id of chunk) {
        if (!netCache[id]) {
          netCache[id] = { name: `AS?? (net#${id})`, asn: 0, policy: null, org_id: null, country: '' };
        }
      }
    },
    onChunk: (done, count, loaded, total) => onProgress?.({ stage: 'nets', done, chunks: count, loaded, total }),
  });

  onProgress?.({ stage: 'orgs' });
  /** @type {number[]} */
  const orgIds = [];
  for (const id of ids) {
    const orgId = netCache[id]?.org_id;
    if (orgId) orgIds.push(orgId);
  }
  let partial = false;
  try {
    await loadIds(orgIds, (id) => id in orgCache, orgsInFlight, ORG_CHUNK, apiOptions.signal, {
      fetchChunk: async (chunk) => {
        /** @type {PdbOrg[]} */
        const rows = await fetchByIds('org', ORG_FIELDS, chunk, apiOptions);
        for (const o of rows) orgCache[o.id] = validCC(o.country);
        for (const id of chunk) if (!(id in orgCache)) orgCache[id] = '';
      },
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    console.warn('Organisation countries unavailable:', e);
    partial = true;
  }
  for (const net of Object.values(netCache)) {
    if (net.org_id && !net.country) net.country = orgCache[net.org_id] || '';
  }
  onProgress?.({ stage: 'done' });
  return { partial };
}

/**
 * Rows of /<endpoint>?id__in=<ids>. A request refused with HTTP 414 (URI too
 * long) or 400 is split in halves.
 * @param {string} endpoint
 * @param {string[]} fields
 * @param {number[]} ids
 * @param {ApiOptions} apiOptions
 * @returns {Promise<any[]>}
 */
function fetchByIds(endpoint, fields, ids, apiOptions) {
  return splitOnError(
    ids,
    async (part) => {
      /** @type {PdbList<unknown>} */
      const d = await api(pdbPath(endpoint, { id__in: part, fields }), apiOptions);
      return d.data || [];
    },
    (error) => error instanceof ApiError && (error.status === 414 || error.status === 400),
  );
}

/**
 * Makes `isKnown(id)` true for every id of `ids`. Ids that another load has
 * in flight are awaited; the others are registered in `inFlight` and passed
 * to `fetchChunk`, `size` at a time, which must make them known or throw.
 * Ids another load failed to get are then requested here.
 * @param {number[]} ids
 * @param {(id: number) => boolean} isKnown
 * @param {Map<number, Promise<void>>} inFlight
 * @param {number} size
 * @param {AbortSignal | undefined} signal
 * @param {{ fetchChunk: (chunk: number[]) => Promise<void>,
 *   onChunk?: (done: number, chunks: number, loaded: number, total: number) => void }} handlers
 */
async function loadIds(ids, isKnown, inFlight, size, signal, { fetchChunk, onChunk }) {
  for (;;) {
    const missing = [...new Set(ids)].filter((id) => !isKnown(id));
    if (!missing.length) return;
    const theirs = new Set(missing.flatMap((id) => inFlight.get(id) ?? []));
    const mine = missing.filter((id) => !inFlight.has(id));

    const parts = chunks(mine, size);
    /** @type {(() => void)[]} */
    const finish = parts.map((part) => {
      /** @type {() => void} */
      let settle = () => {};
      const settled = new Promise((resolve) => {
        settle = () => resolve(undefined);
      });
      for (const id of part) inFlight.set(id, settled);
      return () => {
        for (const id of part) if (inFlight.get(id) === settled) inFlight.delete(id);
        settle();
      };
    });
    try {
      for (let i = 0; i < parts.length; i++) {
        await fetchChunk(parts[i]);
        finish[i]();
        onChunk?.(i + 1, parts.length, Math.min((i + 1) * size, mine.length), mine.length);
      }
    } finally {
      for (const done of finish) done();
    }
    if (theirs.size) await abortable(Promise.all(theirs), signal);
  }
}

// ── IX records (IndexedDB) ───────────────────────────────────────────────

/** @param {number} ixId */
const recordKey = (ixId) => `ix:${ixId}`;

/**
 * The members of an IX from its IndexedDB record, when it is younger than
 * IX_CACHE_TTL and of the current version; its networks and organisations
 * are added to the caches. null otherwise.
 * @param {number} ixId
 * @param {Caches} caches
 * @returns {Promise<{ members: Map<number, number>, ts: number } | null>}
 */
export async function readIxRecord(ixId, { netCache, orgCache }) {
  const rec = /** @type {IxRecord | undefined} */ (await kvGet(recordKey(ixId)));
  const age = typeof rec?.ts === 'number' ? Date.now() - rec.ts : -1;
  const fresh =
    rec?.v === IX_RECORD_VERSION &&
    age >= 0 &&
    age < IX_CACHE_TTL &&
    Array.isArray(rec.members) &&
    !!rec.nets &&
    typeof rec.nets === 'object' &&
    !!rec.orgs &&
    typeof rec.orgs === 'object';
  if (!fresh) return null;
  // The record comes from storage the page does not control: validate all of
  // it like PeeringDB data before anything reaches the caches.
  /** @type {[number, number][]} */
  const members = [];
  for (const m of rec.members) {
    if (!Array.isArray(m) || !Number.isInteger(m[0]) || !Number.isFinite(m[1])) return null;
    members.push([m[0], m[1]]);
  }
  /** @type {[number, Net][]} */
  const nets = [];
  for (const [key, net] of Object.entries(rec.nets)) {
    const id = Number(key);
    if (!Number.isInteger(id) || !net || typeof net.name !== 'string' || !Number.isInteger(net.asn)) return null;
    nets.push([
      id,
      {
        name: net.name,
        asn: net.asn,
        policy: typeof net.policy === 'string' ? net.policy : null,
        org_id: Number.isInteger(net.org_id) ? net.org_id : null,
        country: validCC(net.country),
      },
    ]);
  }
  /** @type {[number, string][]} */
  const orgs = [];
  for (const [key, country] of Object.entries(rec.orgs)) {
    const id = Number(key);
    if (!Number.isInteger(id)) return null;
    orgs.push([id, validCC(country)]);
  }
  for (const [id, net] of nets) netCache[id] ??= net;
  for (const [id, country] of orgs) if (!(id in orgCache)) orgCache[id] = country;
  return { members: new Map(members), ts: /** @type {number} */ (rec.ts) };
}

/**
 * Stores (or replaces) the record of a fully loaded IX: its members, their
 * networks and organisation countries, as found in the caches now.
 * @param {number} ixId
 * @param {Map<number, number>} members
 * @param {Caches} caches
 * @param {number} ts when the members were fetched from PeeringDB
 */
export function writeIxRecord(ixId, members, { netCache, orgCache }, ts) {
  /** @type {IxRecord} */
  const rec = { v: IX_RECORD_VERSION, ts, members: [...members], nets: {}, orgs: {} };
  for (const id of members.keys()) {
    const net = netCache[id];
    if (!net) continue;
    rec.nets[id] = { ...net };
    if (net.org_id && net.org_id in orgCache) rec.orgs[net.org_id] = orgCache[net.org_id];
  }
  return kvSet(recordKey(ixId), rec);
}
