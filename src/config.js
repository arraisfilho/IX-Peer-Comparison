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

/** The IX catalog cached in localStorage is reused for 24 h. */
export const IX_CATALOG_TTL = 24 * 60 * 60 * 1000;
/** The member list of a removed IX is reused for 30 min if it is added again. */
export const IX_CACHE_TTL = 30 * 60 * 1000;

/** Pause after each successful PeeringDB response; PeeringDB calls are sequential. */
export const API_DELAY_MS = 150;
/** Requests per PeeringDB call while it keeps answering HTTP 429, counting the first one. */
export const API_MAX_ATTEMPTS = 4;

/**
 * Ids per /net?id__in= and /org?id__in= request. This keeps the URL short; it
 * is not a server limit (PeeringDB only truncates lists when depth >= 1, a
 * parameter the app never sends).
 */
export const NET_CHUNK = 250;
export const ORG_CHUNK = 250;

/** RIPEstat lookups run in batches of this many concurrent requests. */
export const RIPESTAT_CONCURRENCY = 4;

/** IXes with at least this many members get the ⏳ hint and a short pause before loading. */
export const LARGE_IX_THRESHOLD = 2000;

/** IX search: minimum query length, debounce after the last keystroke, maximum results. */
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_DEBOUNCE_MS = 120;
export const SEARCH_MAX_RESULTS = 16;
