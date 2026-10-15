// The chips of the selected IXes and the "maximum reached" note.

import { MAX_IX, PALETTE } from '../config.js';
import { esc, fmtElapsed } from '../core/format.js';
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

/**
 * One chip per IX: progress and elapsed time while loading, then the error,
 * the age of cached members or how long the load took, and ⚠ when the load
 * was partial.
 */
export function renderChips() {
  const el = $('chips');
  if (!state.ixes.length) {
    el.innerHTML = `<span class="empty-chips">${t('no_ix')}</span>`;
    return;
  }
  el.innerHTML = state.ixes
    .map((ix) => {
      const c = PALETTE[ix.ci];
      const cls = ix.loading ? ' chip-loading' : '';

      let suffix = '';
      if (ix.loading) {
        const pct = ix.progress || 0;
        const elapsed = ix.loadElapsed || 0;
        const timeStr = elapsed > 0 ? ` · ${fmtElapsed(elapsed)}` : '';
        suffix = `<span class="chip-pct">${pct}%${timeStr}</span>`;
      } else if (ix.error) {
        const elapsed = ix.loadElapsed > 0 ? ` · ${fmtElapsed(ix.loadElapsed)}` : '';
        suffix = ` <span title="${esc(ix.errorMsg)}" style="opacity:.6;font-size:10px;cursor:help">⚠${elapsed}</span>`;
      } else if (ix.cacheAge !== null && ix.cacheAge > 0) {
        suffix = `<span class="chip-cached">·${ix.cacheAge}min</span>`;
      } else if (ix.loadElapsed > 0) {
        // Loaded: how long it took
        suffix = `<span class="chip-cached">·${fmtElapsed(ix.loadElapsed)}</span>`;
      }
      if (!ix.loading && !ix.error && ix.partial) {
        suffix += ` <span class="chip-partial" title="${esc(t('partial_cc'))}">⚠</span>`;
      }

      const bar = ix.loading ? `<span class="chip-bar" style="width:${ix.progress || 0}%"></span>` : '';

      const titleAttr =
        ix.loading && ix.progressLabel
          ? ` title="${esc(ix.progressLabel)}"`
          : ix.cacheAge !== null && ix.cacheAge > 0
            ? ` title="${t('cache_local')} (${ix.cacheAge} min)"`
            : '';

      return `<span class="ix-chip${cls}" style="color:${c.main};background:${c.bg};border-color:${c.bdr}"${titleAttr}>
      ${esc(ix.name)}${suffix}
      <button class="chip-remove" data-action="remove-ix" data-id="${ix.id}" title="Remover">×</button>
      ${bar}
    </span>`;
    })
    .join('');
}

/** At MAX_IX IXes the search is disabled and a note says why. */
export function renderMaxNote() {
  const el = $('max-note');
  if (state.ixes.length >= MAX_IX) {
    el.textContent = t('max_ix', MAX_IX);
    $('ix-search', HTMLInputElement).disabled = true;
  } else {
    el.textContent = '';
    $('ix-search', HTMLInputElement).disabled = false;
  }
}
