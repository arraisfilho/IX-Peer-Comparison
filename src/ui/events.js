// DOM event wiring. Rendered markup carries data-action (plus data-id for an
// IX id or data-value for a filter value); a few listeners on containers that
// are never replaced dispatch on those attributes.

import {
  addIX,
  doSort,
  removeIX,
  setContFilter,
  setCountryFilter,
  setFilter,
  setLang,
  setNetQuery,
  setPolFilter,
} from '../actions.js';
import { isLang } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';
import { hideDd, onSearchInput } from './dropdown.js';
import { closeModal, cpExport, dlExport, openExport } from './export-modal.js';

/** @type {Record<string, (el: HTMLElement) => void>} */
const CLICK_ACTIONS = {
  lang: (el) => {
    const lang = data(el, 'value');
    if (isLang(lang)) setLang(lang);
  },
  'remove-ix': (el) => removeIX(Number(data(el, 'id'))),
  presence: (el) => setFilter(data(el, 'value')),
  policy: (el) => setPolFilter(data(el, 'value')),
  continent: (el) => setContFilter(data(el, 'value')),
  export: (el) => openExport(Number(data(el, 'id'))),
  'close-modal': () => closeModal(),
  download: () => dlExport(),
  copy: () => cpExport(),
};

/**
 * Value of a data-* attribute the markup always sets.
 * @param {HTMLElement} el
 * @param {string} name
 */
function data(el, name) {
  const value = el.dataset[name];
  if (value === undefined) throw new Error(`data-${name} missing on <${el.tagName.toLowerCase()}>`);
  return value;
}

/**
 * The closest element to the event target matching `selector`, inside the
 * element the listener is on.
 * @param {Event} e
 * @param {string} selector
 */
function closestIn(e, selector) {
  const { target, currentTarget } = e;
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) return null;
  const el = target.closest(selector);
  return el instanceof HTMLElement && currentTarget.contains(el) ? el : null;
}

/** @param {MouseEvent} e */
function onActionClick(e) {
  const el = closestIn(e, '[data-action]');
  if (el) CLICK_ACTIONS[data(el, 'action')]?.(el);
}

export function bindEvents() {
  // ── IX search ──
  const search = $('ix-search', HTMLInputElement);
  search.addEventListener('input', () => onSearchInput(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDd();
  });
  // mousedown, not click: preventDefault keeps the focus in the search input
  $('ix-dropdown').addEventListener('mousedown', (e) => {
    const item = closestIn(e, '.dd-item');
    if (!item || item.matches('.is-added, .is-full')) return;
    e.preventDefault();
    const id = Number(data(item, 'id'));
    const ix = state.ddResults.find((r) => r.id === id);
    if (ix) {
      addIX(ix);
      hideDd();
      search.value = '';
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element && e.target.closest('.search-wrap'))) hideDd();
  });

  // ── buttons rendered with data-action ──
  for (const id of ['lang-sel', 'chips', 'toolbar', 'cont-group', 'modal']) {
    $(id).addEventListener('click', onActionClick);
  }

  // ── table ──
  const net = $('net-search', HTMLInputElement);
  net.addEventListener('input', () => setNetQuery(net.value));
  const country = $('country-select', HTMLSelectElement);
  country.addEventListener('change', () => setCountryFilter(country.value));
  $('thead').addEventListener('click', (e) => {
    const col = closestIn(e, 'th[data-col]')?.dataset.col;
    if (col === 'name' || col === 'asn' || col === 'country') doSort(col);
  });

  // ── export dialog: a click on the backdrop closes it ──
  $('modal').addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.id === 'modal') closeModal();
  });
}
