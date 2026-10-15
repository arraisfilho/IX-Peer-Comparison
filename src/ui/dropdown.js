// The IX search dropdown.

import { LARGE_IX_THRESHOLD, MAX_IX, SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS } from '../config.js';
import { estimateLoadTime, filterIXes } from '../core/catalog.js';
import { esc } from '../core/format.js';
import { getLang, t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

/** @type {number | undefined} */
let debounceTimer;

/**
 * Reacts to the IX search input: a query shorter than SEARCH_MIN_CHARS (after
 * trimming) closes the dropdown, a longer one is searched SEARCH_DEBOUNCE_MS
 * after the last keystroke. Does nothing until the catalog has loaded.
 * @param {string} value
 */
export function onSearchInput(value) {
  clearTimeout(debounceTimer);
  const q = value.trim();
  if (!q || q.length < SEARCH_MIN_CHARS) {
    hideDd();
    return;
  }
  if (!state.ixReady) return;
  debounceTimer = setTimeout(() => {
    state.ddResults = filterIXes(state.allIXes, q);
    renderDd();
  }, SEARCH_DEBOUNCE_MS);
}

export function hideDd() {
  const dd = $('ix-dropdown');
  dd.innerHTML = '';
  dd.setAttribute('data-empty', '');
}

/**
 * Lists state.ddResults. IXes already added, or all of them once MAX_IX IXes
 * are shown, are dimmed and cannot be picked; large IXes carry a ⏳ hint.
 */
export function renderDd() {
  const dd = $('ix-dropdown');
  dd.removeAttribute('data-empty');
  if (!state.ddResults.length) {
    /** @type {Record<string, string>} */
    const noIX = { pt: 'Nenhum IX encontrado', en: 'No IX found', es: 'Ningún IX encontrado' };
    dd.innerHTML = `<div class="dd-msg">${noIX[getLang()] || noIX.en}</div>`;
    return;
  }
  const addedIds = new Set(state.ixes.map((x) => x.id));
  const full = state.ixes.length >= MAX_IX;
  dd.innerHTML = state.ddResults
    .map((ix) => {
      const added = addedIds.has(ix.id);
      const cls = added ? 'is-added' : full ? 'is-full' : '';
      const meta = [ix.city, ix.country].filter(Boolean).join(' · ');
      const large = (ix.net_count || 0) >= LARGE_IX_THRESHOLD;
      const warn = large
        ? `<span style="font-size:9px;color:var(--warning);font-family:var(--mono);margin-left:4px" title="${esc(ix.net_count)} peers · ~${Math.ceil(estimateLoadTime(ix.net_count).maxTime)}s">⏳</span>`
        : '';
      return `<div class="dd-item ${cls}" data-id="${esc(ix.id)}">
      <div>
        <div class="dd-name">${esc(ix.name)}${warn}</div>
        <div class="dd-meta">${esc(meta)}</div>
      </div>
      <span class="dd-count">${esc(ix.net_count || 0)} ${t('peers')}</span>
    </div>`;
    })
    .join('');
}
