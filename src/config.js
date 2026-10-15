// Limits, endpoints and tuning constants shared by the whole app.

/** @import { PaletteColor } from './types.js' */

/** Maximum number of IXes compared at once (one palette colour each). */
export const MAX_IX = 6;

export const API_BASE = 'https://www.peeringdb.com/api';
export const RIPESTAT_WHOIS_URL = 'https://stat.ripe.net/data/whois/data.json';

/**
 * One colour set per IX slot; the custom properties are defined in app.css.
 * @type {PaletteColor[]}
 */
export const PALETTE = [
  { main: 'var(--c0)', bg: 'var(--c0-bg)', bdr: 'var(--c0-border)' },
  { main: 'var(--c1)', bg: 'var(--c1-bg)', bdr: 'var(--c1-border)' },
  { main: 'var(--c2)', bg: 'var(--c2-bg)', bdr: 'var(--c2-border)' },
  { main: 'var(--c3)', bg: 'var(--c3-bg)', bdr: 'var(--c3-border)' },
  { main: 'var(--c4)', bg: 'var(--c4-bg)', bdr: 'var(--c4-border)' },
  { main: 'var(--c5)', bg: 'var(--c5-bg)', bdr: 'var(--c5-border)' },
];

/** localStorage keys. */
export const LANG_STORAGE_KEY = 'peercomp_lang';
export const IX_CATALOG_CACHE_KEY = 'peercomp_ix_catalog';
/** Send times of the PeeringDB requests of the last API_WINDOW_MS, so a reload keeps the window. */
export const API_WINDOW_KEY = 'peercomp_pdb_window';

/** The IX catalog cached in localStorage is reused for 24 h. */
export const IX_CATALOG_TTL = 24 * 60 * 60 * 1000;
/**
 * An IX loaded completely is kept in IndexedDB and reused for 60 min: adding
 * it again, also after a reload, makes no PeeringDB request. PeeringDB allows an
 * identical anonymous request with a response over 100 kB once per hour
 * (https://docs.peeringdb.com/howto/work_within_peeringdbs_query_limits/).
 */
export const IX_CACHE_TTL = 60 * 60 * 1000;
/** Version of the IX record kept in IndexedDB; bump it when the record shape changes. */
export const IX_RECORD_VERSION = 1;

// PeeringDB allows anonymous clients 20 requests per minute per IP. Its calls
// go one at a time through the queue of data/api.js.

/** Pause between the end of a PeeringDB response and the next request. */
export const API_DELAY_MS = 150;
/** At most API_WINDOW_MAX PeeringDB requests in any API_WINDOW_MS (sliding window). */
export const API_WINDOW_MAX = 18;
export const API_WINDOW_MS = 60 * 1000;
/** Requests per PeeringDB call, counting the first one, while it keeps failing with a retryable error. */
export const API_MAX_ATTEMPTS = 4;
/** Backoff before the first retry after HTTP 502/503/504, a network error or a timeout; doubles on each retry. */
export const API_BACKOFF_MS = 2000;
/** A PeeringDB request (response body included) that takes longer is cancelled and retried. */
export const API_TIMEOUT_MS = 30 * 1000;

/**
 * Ids per /net?id__in= and /org?id__in= request (about 6 kB of URL with
 * 5-digit ids). A request answered with HTTP 414 or 400 is split in halves.
 * PeeringDB only truncates lists when depth >= 1, a parameter the app never sends.
 */
export const NET_CHUNK = 1000;
export const ORG_CHUNK = 1000;

/** RIPEstat lookups run in batches of this many concurrent requests. */
export const RIPESTAT_CONCURRENCY = 4;

/** IXes with at least this many members get the ⏳ hint and a short pause before loading. */
export const LARGE_IX_THRESHOLD = 2000;

/** IX search: minimum query length, debounce after the last keystroke, maximum results. */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 120;
export const SEARCH_MAX_RESULTS = 16;
