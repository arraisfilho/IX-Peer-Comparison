// The toolbar: presence filter, policy filter and one export button per IX.

import { PALETTE } from '../config.js';
import { esc, shortName } from '../core/format.js';
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

export function renderToolbar() {
  const fg = $('filter-group');
  let btns = btnHtml('all', t('filter_all'));
  if (state.ixes.length >= 2) btns += btnHtml('all_ixes', t('filter_in_all'));
  for (const ix of state.ixes) {
    const fid = `only_${ix.id}`;
    const c = PALETTE[ix.ci];
    const isA = state.filter === fid;
    btns += `<button class="fbtn${isA ? ' active' : ''}"
              style="${isA ? `background:${c.bg};color:${c.main}` : ''}"
              data-action="presence" data-value="${fid}">${t('filter_only', esc(shortName(ix.name, 14)))}</button>`;
  }
  fg.innerHTML = btns;

  const pg = $('pol-group');
  pg.innerHTML = [
    ['all', 'pol_all'],
    ['open', 'pol_open'],
    ['selective', 'pol_sel'],
    ['restrictive', 'pol_rest'],
  ]
    .map(([val, tkey]) => {
      const isA = state.polFilter === val;
      let style = '';
      if (isA && val === 'open') style = 'background:var(--success-bg);color:var(--open)';
      if (isA && val === 'selective') style = 'background:var(--info-bg);color:var(--selective)';
      if (isA && val === 'restrictive') style = 'background:var(--error-bg);color:var(--restrictive)';
      return `<button class="fbtn${isA ? ' active' : ''}" style="${style}"
              data-action="policy" data-value="${val}">${t(tkey)}</button>`;
    })
    .join('');

  // The hover background comes from --exp-hover-bg (see .exp-btn:hover in app.css)
  const ew = $('export-wrap');
  ew.innerHTML = state.ixes
    .map((ix) => {
      const c = PALETTE[ix.ci];
      return `<button class="exp-btn"
              style="border-color:${c.bdr};color:${c.main};--exp-hover-bg:${c.bg}"
              data-action="export" data-id="${ix.id}">↓ ${esc(shortName(ix.name, 12))}</button>`;
    })
    .join('');
}

/**
 * @param {string} fid presence filter value
 * @param {string} label
 */
function btnHtml(fid, label) {
  return `<button class="fbtn${state.filter === fid ? ' active' : ''}" data-action="presence" data-value="${fid}">${label}</button>`;
}
