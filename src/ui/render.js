// Whole-page rendering: sync() redraws everything from the state.

import { MAX_IX } from '../config.js';
import { dateLocale, getLang, LANGS, t } from '../i18n/index.js';
import { state } from '../state.js';
import { renderChips, renderMaxNote } from './chips.js';
import { $ } from './dom.js';
import { renderGeoFilters } from './geo-filters.js';
import { renderStats } from './stats.js';
import { STATUS_ERROR, STATUS_OK, setStatus } from './status.js';
import { renderTable } from './table.js';
import { renderToolbar } from './toolbar.js';

/** Re-renders everything from the state and the caches; never calls the API. */
export function sync() {
  renderChips();
  renderMaxNote();
  renderStats();
  renderToolbar();
  if (state.ixes.length === 0) showEmpty();
  else {
    showTable();
    renderTable();
    renderGeoFilters();
  }
}

export function showEmpty() {
  $('empty-state').style.display = 'flex';
  $('table-wrap').style.display = 'none';
  $('toolbar').style.display = 'none';
  $('geo-bar').style.display = 'none';
}

export function showTable() {
  $('empty-state').style.display = 'none';
  $('table-wrap').style.display = '';
  $('toolbar').style.display = 'flex';
  $('geo-bar').style.display = 'flex';
}

/** Marks the button of the current language as active. */
export function renderLangButtons() {
  const lang = getLang();
  for (const code of LANGS) $(`lb-${code}`).classList.toggle('active', code === lang);
}

/**
 * Translates the texts that are not redrawn by sync() and resets the status
 * line: the catalog error if the catalog failed to load, otherwise
 * "N IXes · <date and time>".
 */
export function applyStaticStrings() {
  $('ix-search', HTMLInputElement).placeholder = t('search_ph');
  $('picker-label-el').textContent = t('ixes_label');
  $('net-search', HTMLInputElement).placeholder = t('search_net');
  $('empty-title-el').textContent = t('empty_title');
  $('empty-sub-el').textContent = t('empty_sub', MAX_IX);
  // #chips-empty-el and #country-all-opt only exist until renderChips() and
  // renderGeoFilters() first replace them with their own markup.
  const chipsEmpty = document.getElementById('chips-empty-el');
  if (chipsEmpty) chipsEmpty.textContent = t('no_ix');
  $('hdr-title').textContent = t('title');
  $('hdr-source').innerHTML = `<span style="color:var(--muted);opacity:.6">${t('subtitle').replace(
    'PeeringDB',
    '<span style="color:var(--c0);opacity:.8">PeeringDB</span>',
  )}</span>`;
  const allCountries = document.getElementById('country-all-opt');
  if (allCountries) allCountries.textContent = t('all_countries');
  $('mbtn-dl').textContent = t('download');
  $('mbtn-copy').textContent = t('copy');
  const ts = new Date().toLocaleString(dateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  if (state.catalogError !== null) setStatus(`⚠ ${t('error_net')}: ${state.catalogError}`, STATUS_ERROR);
  else setStatus(`${state.allIXes.length} IXes · ${ts}`, STATUS_OK);
}
