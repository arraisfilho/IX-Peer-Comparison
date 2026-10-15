// The continent buttons and the country select.

import { esc } from '../core/format.js';
import { CONT_ORDER, ccName, flag, getCont } from '../core/geo.js';
import { buildNetMap } from '../core/net-map.js';
import { contNames, getLang, t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

/**
 * Offers only the continents and countries of the networks that pass the
 * presence, policy and search filters. A continent or country that is no
 * longer offered falls back to "all". Not rebuilt while an IX is loading.
 */
export function renderGeoFilters() {
  if (state.ixes.some((x) => x.loading)) return;
  const { ixes, netCache } = state;

  $('lbl-cont').textContent = t('cont_label');
  $('lbl-country').textContent = t('country_label');

  const allNets = buildNetMap(ixes);
  let entries = [...allNets.entries()];
  if (state.filter === 'all_ixes') entries = entries.filter(([, l]) => l.length === ixes.length);
  else if (state.filter.startsWith('only_')) {
    const onlyId = Number(state.filter.slice(5));
    entries = entries.filter(([, l]) => l.length === 1 && l[0] === onlyId);
  }
  if (state.polFilter !== 'all') {
    const target = state.polFilter.charAt(0).toUpperCase() + state.polFilter.slice(1);
    entries = entries.filter(([id]) => netCache[id]?.policy === target);
  }
  if (state.netQ) {
    const q = state.netQ.toLowerCase();
    entries = entries.filter(([id]) => {
      const n = netCache[id];
      return n && (n.name.toLowerCase().includes(q) || String(n.asn).includes(q));
    });
  }

  /** @type {Set<string>} */
  const ccsInSet = new Set();
  /** @type {Set<string>} */
  const contsInSet = new Set();
  for (const [id] of entries) {
    const cc = netCache[id]?.country;
    if (cc) {
      ccsInSet.add(cc);
      contsInSet.add(getCont(cc));
    }
  }
  // A continent that left the filtered set falls back to "all" (the country below too)
  if (state.contFilter !== 'all' && !contsInSet.has(state.contFilter)) state.contFilter = 'all';

  // ── continent buttons ──
  const names = contNames();
  let cbHtml = `<button class="fbtn${state.contFilter === 'all' ? ' active' : ''}" data-action="continent" data-value="all">${t('filter_all')}</button>`;
  for (const cid of CONT_ORDER) {
    if (!contsInSet.has(cid)) continue;
    const isA = state.contFilter === cid;
    cbHtml += `<button class="fbtn${isA ? ' active' : ''}" data-action="continent" data-value="${cid}">${names[cid] || cid}</button>`;
  }
  $('cont-group').innerHTML = cbHtml;

  // ── country select ──
  const sel = $('country-select', HTMLSelectElement);
  const visibleCCs = [...ccsInSet]
    .filter((cc) => state.contFilter === 'all' || getCont(cc) === state.contFilter)
    .sort((a, b) => ccName(a).localeCompare(ccName(b), getLang()));
  if (!visibleCCs.includes(state.countryFilter) && state.countryFilter !== 'all') state.countryFilter = 'all';
  let opts = `<option value="all">${t('all_countries')}</option>`;
  for (const cc of visibleCCs) {
    const selected = state.countryFilter === cc ? ' selected' : '';
    opts += `<option value="${esc(cc)}"${selected}>${flag(cc)} ${esc(ccName(cc))} (${esc(cc)})</option>`;
  }
  sel.innerHTML = opts;
  sel.value = state.countryFilter;
}
