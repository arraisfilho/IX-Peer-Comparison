// What the user can do: add and remove IXes, switch language, change the
// table filters and sort. Each action updates the state, calls the data layer
// and re-renders.

import { LANG_STORAGE_KEY, LARGE_IX_THRESHOLD, MAX_IX, PALETTE } from './config.js';
import { freeColorIndex } from './core/colors.js';
import { getCont } from './core/geo.js';
import { ApiError, sleep } from './data/api.js';
import {
  fetchCatalog,
  fetchMembers,
  loadNets,
  readCachedCatalog,
  readIxRecord,
  writeIxRecord,
} from './data/peeringdb.js';
import { enrichCountries } from './data/ripestat.js';
import { storageGet, storageSet } from './data/storage.js';
import { isLang, setCurrentLang, t } from './i18n/index.js';
import { state } from './state.js';
import { renderChips } from './ui/chips.js';
import { renderGeoFilters } from './ui/geo-filters.js';
import { applyStaticStrings, renderLangButtons, sync } from './ui/render.js';
import {
  isRateLimitCountdownRunning,
  STATUS_ERROR,
  STATUS_OK,
  STATUS_WARNING,
  setReadyTimeStatus,
  setStatus,
  startRateLimitCountdown,
  stopRateLimitCountdown,
} from './ui/status.js';
import { renderTable } from './ui/table.js';
import { renderToolbar } from './ui/toolbar.js';

/** @import { Lang } from './i18n/index.js' */
/** @import { CatalogEntry, SelectedIx, SortColumn } from './types.js' */

// ── start-up ─────────────────────────────────────────────────────────────

/** Restores the stored language; anything but pt, en or es means Portuguese. */
export function initLang() {
  const stored = storageGet(LANG_STORAGE_KEY);
  setCurrentLang(isLang(stored) ? stored : 'pt');
}

/** Loads the IX catalog, then translates the page and shows the catalog status. */
export async function initCatalog() {
  renderLangButtons();
  setStatus(t('catalog_loading'), STATUS_WARNING);
  await loadCatalog();
  applyStaticStrings();
}

/** From the localStorage cache when it is fresh, otherwise from PeeringDB. */
async function loadCatalog() {
  const cached = readCachedCatalog();
  if (cached) {
    state.allIXes = cached;
    state.ixReady = true;
    return;
  }
  try {
    state.allIXes = await fetchCatalog();
  } catch (e) {
    console.warn('Failed to load IX catalog:', e);
    // applyStaticStrings() shows it after a translated "network error" prefix
    state.catalogError = e instanceof ApiError ? e.detail : /** @type {Error} */ (e).message;
    return;
  }
  state.ixReady = true;
}

// ── language ─────────────────────────────────────────────────────────────

/**
 * Switches the language and re-renders from memory (no API call).
 * @param {Lang} lang
 */
export function setLang(lang) {
  setCurrentLang(lang);
  storageSet(LANG_STORAGE_KEY, lang);
  renderLangButtons();
  applyStaticStrings();
  sync();
}

// ── IXes ─────────────────────────────────────────────────────────────────

/**
 * Adds an IX and loads its members, their networks and countries, from its
 * IndexedDB record when it is fresh, otherwise from PeeringDB. Members reach
 * the stats, table and filters (and the record) only once their networks
 * have loaded, so an IX that fails contributes no members. An IX whose
 * organisation countries failed to load is shown, marked partial, and not
 * recorded.
 * @param {CatalogEntry} info
 */
export async function addIX(info) {
  if (state.ixes.find((x) => x.id === info.id) || state.ixes.length >= MAX_IX) return;

  const isLarge = (info.net_count || 0) >= LARGE_IX_THRESHOLD;
  const controller = new AbortController();
  /** @type {SelectedIx} */
  const ix = {
    id: info.id,
    name: info.name,
    ci: freeColorIndex(
      state.ixes.map((x) => x.ci),
      PALETTE.length,
    ),
    members: new Map(),
    loading: true,
    error: false,
    errorMsg: '',
    progress: 0,
    progressLabel: t('fetching'),
    cacheAge: null,
    partial: false,
    loadStart: Date.now(),
    loadElapsed: 0,
    controller,
  };
  state.ixes.push(ix);
  sync();

  const signal = controller.signal;
  const apiOptions = { signal, onRateLimit: startRateLimitCountdown, onGiveUp: stopRateLimitCountdown };

  // Elapsed-time ticker: redraws the chips every second while loading
  const tickerHandle = setInterval(() => {
    if (!ix.loading || signal.aborted) {
      clearInterval(tickerHandle);
      return;
    }
    ix.loadElapsed = Math.floor((Date.now() - ix.loadStart) / 1000);
    renderChips();
  }, 1000);

  let removed = false;
  try {
    if (isLarge) {
      ix.progressLabel = `${info.net_count} ${t('peers')}`;
      sync();
      await sleep(100);
    }

    let members;
    const cached = await readIxRecord(info.id, state);
    signal.throwIfAborted();
    if (cached) {
      members = cached.members;
      ix.progressLabel = t('cache_local');
      ix.progress = 35;
      sync();
    } else {
      ix.progressLabel = t('fetching');
      ix.progress = 5;
      sync();
      members = await fetchMembers(info.id, apiOptions);
      ix.progress = 18;
      ix.progressLabel = t('loading_nets', members.size);
      sync();
    }
    const { partial } = await loadNets([...members.keys()], state, {
      ...apiOptions,
      onProgress: (p) => {
        if (p.stage === 'nets') {
          ix.progress = 18 + Math.round((p.done / (p.chunks + 1)) * 72);
          ix.progressLabel = t('nets_prog', p.loaded, p.total);
        } else if (p.stage === 'orgs') {
          ix.progressLabel = t('loading_cc');
          ix.progress = 92;
        } else {
          ix.progress = 98;
        }
        sync();
      },
    });
    ix.members = members;
    ix.partial = partial;
    const ts = cached ? cached.ts : Date.now();
    ix.cacheAge = Math.round((Date.now() - ts) / 60000);
    if (!partial) {
      if (!cached) writeIxRecord(info.id, members, state, ts);
      // Not awaited: countries arrive in the background, redraw the table and update the record
      enrichCountries([...members.keys()], state.netCache, {
        onDone: () => {
          sync();
          writeIxRecord(info.id, members, state, ts);
        },
      });
    }
    setStatus(t('catalog_ok', state.allIXes.length), STATUS_OK);
  } catch (e) {
    const error = /** @type {Error} */ (e);
    if (error.name === 'AbortError' || signal.aborted) {
      removed = true; // removed while loading: nothing to show
      return;
    }
    ix.error = true;
    ix.errorMsg = error.message || t('error_net');
    console.warn(`IX ${info.name}:`, e);
    setStatus(`⚠ ${ix.name}: ${ix.errorMsg}`, STATUS_ERROR);
  } finally {
    clearInterval(tickerHandle);
    if (!removed) {
      ix.loading = false;
      ix.progress = 100;
      ix.progressLabel = '';
      ix.loadElapsed = Math.floor((Date.now() - ix.loadStart) / 1000);
      sync();
    }
  }
}

/**
 * Removes an IX, cancelling its requests if it is still loading. Resets the
 * continent and country filters, and a presence filter that no longer applies.
 * @param {number} id
 */
export function removeIX(id) {
  const ix = state.ixes.find((x) => x.id === id);
  ix?.controller.abort(); // cancel in-flight API calls
  state.ixes = state.ixes.filter((x) => x.id !== id);
  state.contFilter = 'all';
  state.countryFilter = 'all';
  if (state.filter === `only_${id}` || (state.filter === 'all_ixes' && state.ixes.length < 2)) state.filter = 'all';
  // A rate-limit countdown only matters while some IX is still loading
  if (!state.ixes.some((x) => x.loading) && isRateLimitCountdownRunning()) {
    stopRateLimitCountdown();
    setReadyTimeStatus();
  }
  sync();
}

// ── table filters and sort ───────────────────────────────────────────────

/**
 * Presence filter: 'all', 'all_ixes' or 'only_<ix id>' (an IX no longer shown means 'all').
 * @param {string} value
 */
export function setFilter(value) {
  let f = value;
  if (f.startsWith('only_')) {
    const id = Number(f.slice(5));
    if (!state.ixes.find((x) => x.id === id)) f = 'all';
  }
  state.filter = f;
  renderToolbar();
  renderTable();
}

/**
 * Policy filter: 'all', 'open', 'selective' or 'restrictive'.
 * @param {string} value
 */
export function setPolFilter(value) {
  state.polFilter = value;
  renderToolbar();
  renderTable();
  renderGeoFilters(); // repopulate the country list after a policy change
}

/**
 * Continent filter: 'all' or a continent code. A selected country outside
 * the continent is reset.
 * @param {string} value
 */
export function setContFilter(value) {
  state.contFilter = value;
  if (state.countryFilter !== 'all' && getCont(state.countryFilter) !== value && value !== 'all') {
    state.countryFilter = 'all';
  }
  renderGeoFilters();
  renderTable();
}

/**
 * Country filter: 'all' or a country code.
 * @param {string} value
 */
export function setCountryFilter(value) {
  state.countryFilter = value;
  renderTable();
}

/**
 * Network search (name or ASN substring).
 * @param {string} value
 */
export function setNetQuery(value) {
  state.netQ = value;
  renderTable();
}

/**
 * Sorts by a column; the active column toggles its direction, another one
 * starts ascending.
 * @param {SortColumn} col
 */
export function doSort(col) {
  if (state.sortCol === col) state.sortDir *= -1;
  else {
    state.sortCol = col;
    state.sortDir = 1;
  }
  renderTable();
}
