// The mutable state of the app, in one object: importers cannot reassign an
// ES module binding, but they can change the properties of an object.
// Timers private to a widget (search debounce, rate-limit countdown) live in
// that widget's module; the current language lives in i18n/index.js.

/** @import { CatalogEntry, MembersCacheEntry, Net, SelectedIx, SortColumn } from './types.js' */

export const state = {
  // ── IX catalog ──
  /** @type {CatalogEntry[]} IXes with status "ok". */
  allIXes: [],
  /** Whether the catalog has loaded; the IX search does nothing before. */
  ixReady: false,
  /** @type {string | null} Why the catalog failed to load (shown in the status line), or null. */
  catalogError: null,

  // ── compared IXes and session caches ──
  /** @type {SelectedIx[]} In the order they were added. */
  ixes: [],
  /** @type {Record<number, Net>} Networks by net id, kept for the session. */
  netCache: {},
  /** @type {Record<number, string>} Organisation country ('' if unknown) by org id, kept for the session. */
  orgCache: {},
  /** @type {Map<number, MembersCacheEntry>} Member lists by IX id, written once their networks have loaded. */
  ixMembersCache: new Map(),

  // ── table filters and sort ──
  /** 'all' | 'all_ixes' | 'only_<ix id>' */
  filter: 'all',
  /** 'all' | 'open' | 'selective' | 'restrictive' */
  polFilter: 'all',
  /** 'all' or a continent code */
  contFilter: 'all',
  /** 'all' or a country code */
  countryFilter: 'all',
  /** Network search text, as typed. */
  netQ: '',
  /** @type {SortColumn} */
  sortCol: 'name',
  /** 1 ascending, -1 descending. */
  sortDir: 1,

  // ── IX search dropdown ──
  /** @type {CatalogEntry[]} Results currently listed. */
  ddResults: [],

  // ── export dialog ──
  /** Text shown, copied and downloaded. */
  expContent: '',
  /** Download file name. */
  expFile: '',
};
