// The counters bar: unique networks, networks at every IX, members per IX.

import { PALETTE } from '../config.js';
import { esc, shortName } from '../core/format.js';
import { buildNetMap } from '../core/net-map.js';
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

export function renderStats() {
  const el = $('stats');
  const { ixes } = state;
  if (!ixes.length) {
    el.innerHTML = '';
    return;
  }

  const allNets = buildNetMap(ixes);
  const total = allNets.size;
  const inAll = ixes.length >= 2 ? [...allNets.values()].filter((l) => l.length === ixes.length).length : 0;

  let html = `<div class="stat">
    <span class="stat-n" style="color:var(--head)">${total}</span>
    <span class="stat-l">${t('total_unique')}</span>
  </div>`;

  if (ixes.length >= 2) {
    html += `<div class="stat">
      <span class="stat-n" style="color:var(--c2)">${inAll}</span>
      <span class="stat-l">${t('in_all_ixes')}</span>
    </div>`;
  }

  for (const ix of ixes) {
    const c = PALETTE[ix.ci];
    const cnt = ix.loading ? '…' : ix.members.size;
    html += `<div class="stat">
      <span class="stat-n" style="color:${c.main}">${cnt}</span>
      <span class="stat-l" title="${esc(ix.name)}">${esc(shortName(ix.name))}</span>
    </div>`;
  }

  el.innerHTML = html;
}
