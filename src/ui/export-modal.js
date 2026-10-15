// The ASN export dialog: shows the list, copies it or downloads it as .txt.

import { PALETTE } from '../config.js';
import { buildNetMap } from '../core/net-map.js';
import { t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

/**
 * Opens the dialog with the ASNs of an IX, sorted numerically, one per line
 * with a comma on all but the last. Which networks depends on the presence
 * filter only: "all" exports every member of the IX, "in all IXes" the
 * networks present at every IX, "only X" the networks exclusive to X (and
 * nothing for another IX).
 * @param {number} ixId
 */
export function openExport(ixId) {
  const { ixes, netCache } = state;
  const ix = ixes.find((x) => x.id === ixId);
  if (!ix) return;
  const c = PALETTE[ix.ci];
  const allNets = buildNetMap(ixes);

  let netIds;
  if (state.filter === 'all_ixes') {
    netIds = [...allNets.entries()].filter(([, l]) => l.length === ixes.length && l.includes(ixId)).map(([id]) => id);
  } else if (state.filter.startsWith('only_')) {
    const onlyId = Number(state.filter.slice(5));
    netIds =
      onlyId === ixId
        ? [...allNets.entries()].filter(([, l]) => l.length === 1 && l[0] === onlyId).map(([id]) => id)
        : [];
  } else {
    netIds = [...ix.members.keys()];
  }

  // Stubs (ASN 0) are left out
  const asns = /** @type {number[]} */ (netIds.map((id) => netCache[id]?.asn).filter(Boolean)).sort((a, b) => a - b);
  state.expContent = asns.map((a, i) => (i < asns.length - 1 ? `${a},` : String(a))).join('\n');
  state.expFile = `asns_${ix.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;

  $('mtitle').textContent = `Export ASNs — ${ix.name}`;
  $('mtitle').style.color = c.main;
  $('mlabel').textContent = t('asns_label', asns.length);
  $('mcode').textContent = state.expContent;
  const cb = $('mbtn-copy');
  cb.textContent = t('copy');
  cb.style.background = c.bg;
  cb.style.borderColor = c.bdr;
  cb.style.color = c.main;
  $('modal').classList.add('open');
}

export function closeModal() {
  $('modal').classList.remove('open');
}

/**
 * Copies the list with the Clipboard API and confirms on the button for 2 s;
 * when the API is refused, falls back to execCommand('copy'), without
 * confirmation.
 */
export async function cpExport() {
  try {
    await navigator.clipboard.writeText(state.expContent);
    const b = $('mbtn-copy');
    b.textContent = t('copied');
    setTimeout(() => {
      b.textContent = t('copy');
    }, 2000);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = state.expContent;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

export function dlExport() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([state.expContent], { type: 'text/plain' }));
  a.download = state.expFile;
  a.click();
}
