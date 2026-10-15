// The comparison table: one row per network, one column per IX.

import { PALETTE } from '../config.js';
import { esc, fmtSpeed } from '../core/format.js';
import { ccName, flag, getCont } from '../core/geo.js';
import { buildNetMap } from '../core/net-map.js';
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';
import { renderGeoFilters } from './geo-filters.js';

/** Headers and rows; a single "loading" row while an IX is loading. */
export function renderTable() {
  renderThead();
  if (state.ixes.some((x) => x.loading)) {
    $('tbody').innerHTML = `<tr><td class="loading-cell" colspan="${3 + state.ixes.length + 1}">
        <span class="spin"></span>${t('loading_members')}
      </td></tr>`;
    $('count-lbl').textContent = '—';
    return;
  }
  renderGeoFilters(); // first: it may reset a continent/country the rows must not use
  renderTbody();
}

function renderThead() {
  /** @param {string} col */
  const sc = (col) => (state.sortCol === col ? (state.sortDir === 1 ? ' class="sa"' : ' class="sd"') : '');
  let html = `
    <th data-col="name"${sc('name')} style="min-width:160px">${t('col_net')}</th>
    <th data-col="asn"${sc('asn')} style="width:80px">${t('col_asn')}</th>
    <th data-col="country"${sc('country')} style="width:72px">${t('col_country')}</th>
    <th style="width:${state.ixes.length * 14 + 10}px">${t('col_presence')}</th>`;
  for (const ix of state.ixes) {
    const c = PALETTE[ix.ci];
    html += `<th style="color:${c.main};min-width:130px">
      <span style="display:block;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ix.name)}</span>
    </th>`;
  }
  $('thead').innerHTML = html;
}

function renderTbody() {
  const { ixes, netCache } = state;
  const allNets = buildNetMap(ixes);
  const q = state.netQ.toLowerCase();
  let entries = [...allNets.entries()];

  if (state.filter === 'all_ixes') entries = entries.filter(([, l]) => l.length === ixes.length);
  else if (state.filter.startsWith('only_')) {
    const onlyId = Number(state.filter.slice(5));
    entries = entries.filter(([, l]) => l.length === 1 && l[0] === onlyId);
  }
  if (q) {
    entries = entries.filter(([id]) => {
      const n = netCache[id];
      return n && (n.name.toLowerCase().includes(q) || String(n.asn).includes(q));
    });
  }
  if (state.polFilter !== 'all') {
    const target = state.polFilter.charAt(0).toUpperCase() + state.polFilter.slice(1);
    entries = entries.filter(([id]) => netCache[id]?.policy === target);
  }
  if (state.contFilter !== 'all')
    entries = entries.filter(([id]) => getCont(netCache[id]?.country) === state.contFilter);
  if (state.countryFilter !== 'all') entries = entries.filter(([id]) => netCache[id]?.country === state.countryFilter);

  const dir = state.sortDir;
  entries.sort(([aId], [bId]) => {
    const an = netCache[aId];
    const bn = netCache[bId];
    if (!an || !bn) return 0;
    if (state.sortCol === 'asn') return compare(an.asn, bn.asn, dir);
    if (state.sortCol === 'country') return compare(ccName(an.country || ''), ccName(bn.country || ''), dir);
    return compare(an.name.toLowerCase(), bn.name.toLowerCase(), dir);
  });

  let html = '';
  for (const [netId] of entries) {
    const net = netCache[netId];
    if (!net) continue;
    const cc = net.country || '';
    const countryCell = cc
      ? `<div class="ccell"><span class="cflag" title="${esc(ccName(cc))}">${flag(cc)}</span><span class="ccode">${esc(cc)}</span></div>`
      : `<span class="ccode">—</span>`;
    const dots = ixes
      .map((ix) => {
        const c = PALETTE[ix.ci];
        return `<span class="dot dot-${ix.members.has(netId) ? 'on' : 'off'}" style="background:${c.main}" title="${esc(ix.name)}"></span>`;
      })
      .join('');
    const ixCells = ixes
      .map((ix) => {
        if (!ix.members.has(netId)) return `<td><span class="cell-absent">—</span></td>`;
        const mbps = /** @type {number} */ (ix.members.get(netId));
        const pol = net.policy;
        // policy may be any string from PeeringDB (normPolicy passes unknown values through)
        const pCls = pol
          ? pol
              .toLowerCase()
              .replace(/ /g, '-')
              .replace(/[^a-z0-9-]/g, '')
          : '';
        const pHtml = pol ? `<span class="pol pol-${pCls}">${esc(pol)}</span>` : '';
        const sCls = mbps >= 100000 ? 'spd-hi' : mbps >= 10000 ? 'spd-md' : 'spd-lo';
        return `<td><div class="ix-cell">${pHtml}<span class="spd ${sCls}">${fmtSpeed(mbps)}</span></div></td>`;
      })
      .join('');
    html += `<tr>
      <td><span class="tname" title="${esc(net.name)}">${esc(net.name)}</span></td>
      <td><span class="tasn">${esc(net.asn)}</span></td>
      <td>${countryCell}</td>
      <td><div class="dots">${dots}</div></td>
      ${ixCells}
    </tr>`;
  }
  $('tbody').innerHTML =
    html ||
    `<tr><td colspan="${4 + ixes.length}" style="padding:24px;color:var(--muted);text-align:center;font-family:var(--mono);font-size:12px">${t('no_results')}</td></tr>`;
  $('count-lbl').textContent = `${entries.length} ${t('col_net').toLowerCase()}s`;
}

/**
 * Plain < / > comparison in direction `dir` (1 or -1); equal values keep
 * their order (Array#sort is stable).
 * @template {string | number} T
 * @param {T} va
 * @param {T} vb
 * @param {number} dir
 */
function compare(va, vb, dir) {
  return va < vb ? -dir : va > vb ? dir : 0;
}
