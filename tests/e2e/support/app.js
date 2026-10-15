// Page object for index.html. Every selector and every piece of DOM knowledge
// used by the specs lives here, so UI rewrites only need to update this file.

import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { CATALOG_OK_COUNT } from '../../fixtures/dataset.js';

const S = {
  status: '#catalog-status',
  statusDot: '#catalog-status > span:first-child',
  title: '#hdr-title',
  subtitle: '#hdr-source',
  pickerLabel: '#picker-label-el',
  chip: '#chips .ix-chip',
  chipLoading: '#chips .ix-chip.chip-loading',
  chipsEmpty: '#chips .empty-chips',
  ixSearch: '#ix-search',
  dropdownOpen: '#ix-dropdown:not([data-empty])',
  dropdownItem: '#ix-dropdown .dd-item',
  dropdownMessage: '#ix-dropdown .dd-msg',
  maxNote: '#max-note',
  stat: '#stats .stat',
  toolbar: '#toolbar',
  presenceButton: '#filter-group .fbtn',
  policyButton: '#pol-group .fbtn',
  countLabel: '#count-lbl',
  exportButton: '#export-wrap .exp-btn',
  netSearch: '#net-search',
  geoBar: '#geo-bar',
  continentLabel: '#lbl-cont',
  continentButton: '#cont-group .fbtn',
  countryLabel: '#lbl-country',
  countrySelect: '#country-select',
  emptyState: '#empty-state',
  emptyTitle: '#empty-title-el',
  emptySub: '#empty-sub-el',
  table: '#table-wrap',
  header: '#thead th',
  row: '#tbody tr',
  tableMessage: '#tbody td[colspan]',
  modal: '#modal',
  modalTitle: '#mtitle',
  modalLabel: '#mlabel',
  modalContent: '#mcode',
  modalClose: '#modal .mclose',
  copyButton: '#mbtn-copy',
  downloadButton: '#mbtn-dl',
};

const langButton = (code) => `#lb-${code}`;
const POLICY_ORDER = ['all', 'open', 'selective', 'restrictive'];
const LANGS = ['pt', 'en', 'es'];
const STATUS_TONES = {
  'rgb(126, 178, 109)': 'ok',
  'rgb(234, 184, 57)': 'warning',
  'rgb(226, 77, 66)': 'error',
};

const normalize = (text) => (text ?? '').replace(/\s+/g, ' ').trim();

export class App {
  constructor(page, { url, api }) {
    this.page = page;
    this.url = url;
    this.api = api;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────

  /**
   * Opens the app. Options:
   *   lang            value stored in localStorage before load ('pt' | 'en' | 'es' | any)
   *   catalogCache    object (JSON-encoded) or raw string for the catalog cache key
   *   storage         extra localStorage entries
   *   storageBlocked  make every localStorage access throw (private mode / blocked cookies)
   *   storageFull     make every localStorage write throw QuotaExceededError
   *   clipboardDenied make navigator.clipboard.writeText reject (the app then uses execCommand)
   * The clipboard is always an in-page recorder, so tests never touch the real one.
   *   clock           install Playwright's fake clock (true or install options)
   *   waitForCatalog  wait for the "N IXes ·" status, N being the size of the fake
   *                   catalog (default true); a number expects that N instead
   *                   (e.g. a cached catalog), false does not wait
   */
  async open({
    lang, catalogCache, storage = {}, storageBlocked = false, storageFull = false, clipboardDenied = false,
    clock = false, waitForCatalog = true,
  } = {}) {
    await this.page.addInitScript(recordStatusHistory);
    await this.page.addInitScript(installFakeClipboard, { denied: clipboardDenied });
    const seed = { ...storage };
    if (lang !== undefined) seed.peercomp_lang = lang;
    if (catalogCache !== undefined) {
      seed.peercomp_ix_catalog = typeof catalogCache === 'string' ? catalogCache : JSON.stringify(catalogCache);
    }
    if (Object.keys(seed).length) await this.page.addInitScript(seedStorageOnce, seed);
    if (storageBlocked) await this.page.addInitScript(throwOnStorageAccess);
    if (storageFull) await this.page.addInitScript(throwOnStorageWrite);
    if (clock) await this.page.clock.install(clock === true ? undefined : clock);
    await this.page.goto(this.url);
    if (waitForCatalog === true) await this.waitForCatalog();
    else if (typeof waitForCatalog === 'number') await this.waitForCatalog(waitForCatalog);
  }

  async reload() {
    await this.page.reload();
    await this.waitForCatalog();
  }

  /** Waits for the "N IXes ·" status of a loaded catalog (never "0 IXes", the failure state). */
  async waitForCatalog(count = CATALOG_OK_COUNT) {
    await expect(this.page.locator(S.status)).toHaveText(new RegExp(`● ${count} IXes · `));
  }

  /** Waits until no IX chip is loading (background RIPEstat calls may still run). */
  async waitUntilLoaded() {
    await expect(this.page.locator(S.chipLoading)).toHaveCount(0, { timeout: 15_000 });
  }

  /** Waits until no IX is loading and the fake API has gone quiet. */
  async settle() {
    await this.waitUntilLoaded();
    await this.api.waitForIdle();
  }

  /** The catalog cache the app keeps in localStorage, parsed (null if absent). */
  storedCatalog() {
    return this.page.evaluate(() => JSON.parse(localStorage.getItem('peercomp_ix_catalog')));
  }

  /** The language preference the app keeps in localStorage. */
  storedLang() {
    return this.page.evaluate(() => localStorage.getItem('peercomp_lang'));
  }

  documentLang() {
    return this.page.evaluate(() => document.documentElement.lang);
  }

  /** Current page time (follows the fake clock when installed). */
  pageNow() {
    return this.page.evaluate(() => Date.now());
  }

  // ── header ───────────────────────────────────────────────────────────────

  get statusLocator() {
    return this.page.locator(S.status);
  }

  async status() {
    return normalize(await this.page.locator(S.status).textContent());
  }

  /** 'ok' | 'warning' | 'error' from the colour of the status dot. */
  async statusTone() {
    const color = await this.page.locator(S.statusDot).evaluate((el) => getComputedStyle(el).color);
    return STATUS_TONES[color] ?? color;
  }

  /** Every distinct status text since the page started loading. */
  statusHistory() {
    return this.page.evaluate(() => window.__ixpcStatusLog ?? []);
  }

  async setLang(code) {
    await this.page.locator(langButton(code)).click();
  }

  async activeLang() {
    for (const code of LANGS) {
      if (await this.page.locator(langButton(code)).evaluate((el) => el.classList.contains('active'))) return code;
    }
    return null;
  }

  langButtonTitles() {
    return Promise.all(LANGS.map((code) => this.page.locator(langButton(code)).getAttribute('title')));
  }

  /** Static, translated texts of the page. */
  async texts() {
    return this.page.evaluate((s) => {
      const text = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
      return {
        title: text(s.title),
        subtitle: text(s.subtitle),
        pickerLabel: text(s.pickerLabel),
        searchPlaceholder: document.querySelector(s.ixSearch).placeholder,
        netSearchPlaceholder: document.querySelector(s.netSearch).placeholder,
        noIxSelected: text(s.chipsEmpty),
        emptyTitle: text(s.emptyTitle),
        emptySub: text(s.emptySub),
        continentLabel: text(s.continentLabel),
        countryLabel: text(s.countryLabel),
        allCountries: text(`${s.countrySelect} option`),
        copyButton: text(s.copyButton),
        downloadButton: text(s.downloadButton),
      };
    }, S);
  }

  /** The "PeeringDB" word of the subtitle is highlighted. */
  subtitleHighlight() {
    return this.page
      .locator(S.subtitle)
      .evaluate((el) => [...el.querySelectorAll(':scope > span > span')].map((span) => span.textContent));
  }

  // ── IX search ────────────────────────────────────────────────────────────

  get searchInput() {
    return this.page.locator(S.ixSearch);
  }

  /** Types into the IX search without waiting for results. */
  async typeSearch(query) {
    await this.searchInput.fill(query);
  }

  /** Types a query from scratch and waits for its (debounced) results. */
  async search(query) {
    await this.searchInput.fill('');
    await this.searchInput.fill(query);
    await this.page.locator(S.dropdownOpen).waitFor();
  }

  async pressInSearch(key) {
    await this.searchInput.press(key);
  }

  isDropdownOpen() {
    return this.page.locator(S.dropdownOpen).isVisible();
  }

  /** Rows of the result dropdown. */
  searchResults() {
    return this.page.locator(S.dropdownItem).evaluateAll((items) =>
      items.map((item) => {
        const nameEl = item.querySelector('.dd-name');
        const hint = nameEl.querySelector('span');
        return {
          name: nameEl.firstChild?.textContent ?? '',
          meta: item.querySelector('.dd-meta').textContent,
          peers: item.querySelector('.dd-count').textContent,
          added: item.classList.contains('is-added'),
          full: item.classList.contains('is-full'),
          largeHint: hint ? { text: hint.textContent, title: hint.getAttribute('title') } : null,
        };
      }),
    );
  }

  async searchResultNames() {
    return (await this.searchResults()).map((r) => r.name);
  }

  async searchMessage() {
    const message = this.page.locator(S.dropdownMessage);
    return (await message.count()) ? normalize(await message.textContent()) : null;
  }

  /**
   * Picks a result by its exact IX name with a real click (the app reacts to
   * the mousedown it produces). Dimmed results (already added, or 6 IXes
   * reached) ignore pointer events, so `{ dimmed: true }` sends them a bare
   * mousedown instead, to show that the app ignores it.
   */
  async pickResult(name, { dimmed = false } = {}) {
    const items = this.page.locator(S.dropdownItem);
    const names = await this.searchResultNames();
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`"${name}" is not in the results: ${JSON.stringify(names)}`);
    if (dimmed) await items.nth(index).dispatchEvent('mousedown', { button: 0 });
    else await items.nth(index).click();
  }

  /** Searches, picks the IX and (by default) waits for loading to settle. */
  async addIX(name, { query = name, wait = true } = {}) {
    await this.search(query);
    await this.pickResult(name);
    if (wait) await this.settle();
  }

  async clickOutsideSearch() {
    await this.page.locator(S.pickerLabel).click();
  }

  isSearchDisabled() {
    return this.searchInput.isDisabled();
  }

  async maxNote() {
    return normalize(await this.page.locator(S.maxNote).textContent());
  }

  // ── chips ────────────────────────────────────────────────────────────────

  /** Chips in order: name, loading/error state, progress text, tooltip, badge, colour. */
  chips() {
    return this.page.locator(S.chip).evaluateAll((chips) =>
      chips.map((chip) => {
        const errorEl = [...chip.querySelectorAll('span[title]')].find((s) => s.textContent.includes('⚠'));
        return {
          name: chip.firstChild.textContent.trim(),
          loading: chip.classList.contains('chip-loading'),
          progress: chip.querySelector('.chip-pct')?.textContent ?? null,
          tooltip: chip.getAttribute('title'),
          error: errorEl ? errorEl.getAttribute('title') : null,
          errorBadge: errorEl ? errorEl.textContent.trim() : null,
          badge: chip.querySelector('.chip-cached')?.textContent ?? null,
          color: getComputedStyle(chip).color,
          removeTitle: chip.querySelector('.chip-remove').getAttribute('title'),
        };
      }),
    );
  }

  async chip(name) {
    return (await this.chips()).find((c) => c.name === name);
  }

  async chipNames() {
    return (await this.chips()).map((c) => c.name);
  }

  async noIxText() {
    const empty = this.page.locator(S.chipsEmpty);
    return (await empty.count()) ? normalize(await empty.textContent()) : null;
  }

  async removeIX(name) {
    const index = await this.#ixIndex(name);
    await this.page.locator(S.chip).nth(index).locator('.chip-remove').click();
  }

  async #ixIndex(name) {
    const names = await this.chipNames();
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`No chip named "${name}": ${JSON.stringify(names)}`);
    return index;
  }

  // ── stats ────────────────────────────────────────────────────────────────

  /** { total, totalLabel, inAll, inAllLabel, perIx: [{ name, label, value }] } */
  async stats() {
    const items = await this.page.locator(S.stat).evaluateAll((stats) =>
      stats.map((stat) => ({
        value: stat.querySelector('.stat-n').textContent.trim(),
        label: stat.querySelector('.stat-l').textContent.trim(),
        title: stat.querySelector('.stat-l').getAttribute('title'),
      })),
    );
    const general = items.filter((s) => s.title === null);
    return {
      total: general[0]?.value ?? null,
      totalLabel: general[0]?.label ?? null,
      inAll: general[1]?.value ?? null,
      inAllLabel: general[1]?.label ?? null,
      perIx: items.filter((s) => s.title !== null).map((s) => ({ name: s.title, label: s.label, value: s.value })),
    };
  }

  // ── toolbar ──────────────────────────────────────────────────────────────

  isToolbarVisible() {
    return this.page.locator(S.toolbar).isVisible();
  }

  isGeoBarVisible() {
    return this.page.locator(S.geoBar).isVisible();
  }

  presenceFilters() {
    return buttonsState(this.page.locator(S.presenceButton));
  }

  /** kind: 'all' | 'inAll' | 'only' (with the IX name). */
  async setPresence(kind, ixName) {
    const buttons = this.page.locator(S.presenceButton);
    if (kind === 'all') return buttons.nth(0).click();
    const ixCount = await this.page.locator(S.chip).count();
    if (kind === 'inAll') {
      if (ixCount < 2) throw new Error('"In all IXes" needs at least two IXes');
      return buttons.nth(1).click();
    }
    const offset = ixCount >= 2 ? 2 : 1;
    return buttons.nth(offset + (await this.#ixIndex(ixName))).click();
  }

  policyFilters() {
    return buttonsState(this.page.locator(S.policyButton));
  }

  /** value: 'all' | 'open' | 'selective' | 'restrictive' */
  async setPolicy(value) {
    await this.page.locator(S.policyButton).nth(POLICY_ORDER.indexOf(value)).click();
  }

  async searchNetworks(query) {
    await this.page.locator(S.netSearch).fill(query);
  }

  async countLabel() {
    return normalize(await this.page.locator(S.countLabel).textContent());
  }

  // ── geo filters ──────────────────────────────────────────────────────────

  continents() {
    return buttonsState(this.page.locator(S.continentButton));
  }

  async setContinent(label) {
    await this.page.locator(S.continentButton).getByText(label, { exact: true }).click();
  }

  countryOptions() {
    return this.page.locator(`${S.countrySelect} option`).evaluateAll((options) =>
      options.map((o) => ({ value: o.value, label: o.textContent, selected: o.selected })),
    );
  }

  async setCountry(value) {
    await this.page.locator(S.countrySelect).selectOption(value);
  }

  selectedCountry() {
    return this.page.locator(S.countrySelect).inputValue();
  }

  // ── table ────────────────────────────────────────────────────────────────

  isEmptyStateVisible() {
    return this.page.locator(S.emptyState).isVisible();
  }

  isTableVisible() {
    return this.page.locator(S.table).isVisible();
  }

  headers() {
    return this.page.locator(S.header).evaluateAll((ths) => ths.map((th) => th.textContent.replace(/\s+/g, ' ').trim()));
  }

  /** Colour of each IX column header, in IX order. */
  ixHeaderColors() {
    return this.page.locator(S.header).evaluateAll((ths) => ths.slice(4).map((th) => getComputedStyle(th).color));
  }

  /** { column: 'name' | 'asn' | 'country', direction: 'asc' | 'desc' } */
  sortState() {
    return this.page.locator(S.header).evaluateAll((ths) => {
      const th = ths.find((h) => h.classList.contains('sa') || h.classList.contains('sd'));
      return th ? { column: th.dataset.col, direction: th.classList.contains('sa') ? 'asc' : 'desc' } : null;
    });
  }

  /** column: 'name' | 'asn' | 'country' */
  async sortBy(column) {
    await this.page.locator(`${S.header}[data-col="${column}"]`).click();
  }

  /** Text of the single-cell row (loading or "no results"), or null. */
  async tableMessage() {
    const cell = this.page.locator(S.tableMessage);
    return (await cell.count()) ? normalize(await cell.first().textContent()) : null;
  }

  /**
   * Data rows. `presence` has one ● (member) or ○ (absent) per IX and `cells`
   * one entry per IX column: { text: 'Open 10G' | '—', policy, speed, tier }.
   */
  rows() {
    return this.page.locator(S.row).evaluateAll((trs) =>
      trs
        .filter((tr) => tr.cells.length > 1)
        .map((tr) => {
          const [name, asn, country, presence, ...ixCells] = [...tr.cells];
          const flagEl = country.querySelector('.cflag');
          return {
            name: name.textContent.trim(),
            nameTitle: name.querySelector('.tname')?.getAttribute('title') ?? null,
            asn: asn.textContent.trim(),
            country: country.querySelector('.ccode')?.textContent.trim() ?? country.textContent.trim(),
            flag: flagEl?.textContent ?? '',
            countryName: flagEl?.getAttribute('title') ?? null,
            presence: [...presence.querySelectorAll('.dot')].map((d) => (d.classList.contains('dot-on') ? '●' : '○')).join(''),
            cells: ixCells.map((td) => {
              if (td.querySelector('.cell-absent')) return { text: '—', policy: null, speed: null, tier: null };
              const policy = td.querySelector('.pol')?.textContent ?? null;
              const speedEl = td.querySelector('.spd');
              const speed = speedEl?.textContent ?? null;
              const tier = speedEl ? ['hi', 'md', 'lo'].find((t) => speedEl.classList.contains(`spd-${t}`)) : null;
              return { text: [policy, speed].filter(Boolean).join(' '), policy, speed, tier };
            }),
          };
        }),
    );
  }

  async rowNames() {
    return (await this.rows()).map((r) => r.name);
  }

  /** Rows as tab-separated text: name, ASN, country, presence, one cell per IX. */
  async table() {
    return (await this.rows()).map((r) => [r.name, r.asn, r.country, r.presence, ...r.cells.map((c) => c.text)].join('\t'));
  }

  // ── export ───────────────────────────────────────────────────────────────

  async exportButtons() {
    return (await this.page.locator(S.exportButton).allTextContents()).map(normalize);
  }

  async openExport(ixName) {
    await this.page.locator(S.exportButton).nth(await this.#ixIndex(ixName)).click();
  }

  isExportOpen() {
    return this.page.locator(S.modal).isVisible();
  }

  /** { title, titleColor, label, content, lines, copyLabel, downloadLabel } of the open export dialog. */
  async exportDialog() {
    const content = await this.page.locator(S.modalContent).textContent();
    return {
      title: normalize(await this.page.locator(S.modalTitle).textContent()),
      titleColor: await this.page.locator(S.modalTitle).evaluate((el) => getComputedStyle(el).color),
      label: normalize(await this.page.locator(S.modalLabel).textContent()),
      content,
      lines: content === '' ? [] : content.split('\n'),
      copyLabel: normalize(await this.page.locator(S.copyButton).textContent()),
      downloadLabel: normalize(await this.page.locator(S.downloadButton).textContent()),
    };
  }

  get copyButton() {
    return this.page.locator(S.copyButton);
  }

  async copyExport() {
    await this.copyButton.click();
  }

  /** Text last written to the (fake) clipboard, or null. */
  clipboardText() {
    return this.page.evaluate(() => window.__ixpcClipboard);
  }

  /** Clicks download and returns { filename, content } of the saved file. */
  async downloadExport() {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.page.locator(S.downloadButton).click()]);
    return { filename: download.suggestedFilename(), content: await readFile(await download.path(), 'utf8') };
  }

  async closeExport() {
    await this.page.locator(S.modalClose).click();
  }

  async pressInExport(key) {
    await this.page.keyboard.press(key);
  }

  async clickExportBackdrop() {
    await this.page.locator(S.modal).click({ position: { x: 5, y: 5 } });
  }

  async clickInsideExport() {
    await this.page.locator(S.modalLabel).click();
  }
}

async function buttonsState(locator) {
  return locator.evaluateAll((buttons) =>
    buttons.map((b) => ({ label: b.textContent.replace(/\s+/g, ' ').trim(), active: b.classList.contains('active') })),
  );
}

// ── init scripts (run in the page before the app's own script) ─────────────

function recordStatusHistory() {
  const log = (window.__ixpcStatusLog = []);
  new MutationObserver(() => {
    const el = document.getElementById('catalog-status');
    if (!el) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (log[log.length - 1] !== text) log.push(text);
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

function seedStorageOnce(entries) {
  try {
    if (sessionStorage.getItem('__ixpcSeeded')) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    sessionStorage.setItem('__ixpcSeeded', '1');
  } catch {
    // Storage may be unavailable in this document; the test will notice.
  }
}

function throwOnStorageWrite() {
  Storage.prototype.setItem = function setItem() {
    throw new DOMException("Failed to execute 'setItem' on 'Storage': quota exceeded.", 'QuotaExceededError');
  };
}

function installFakeClipboard({ denied }) {
  window.__ixpcClipboard = null;
  const clipboard = {
    async writeText(text) {
      if (denied) throw new DOMException('Write permission denied.', 'NotAllowedError');
      window.__ixpcClipboard = String(text);
    },
    async readText() {
      return window.__ixpcClipboard ?? '';
    },
  };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clipboard });
  const execCommand = Document.prototype.execCommand;
  Document.prototype.execCommand = function (command, ...rest) {
    if (command !== 'copy') return execCommand.call(this, command, ...rest);
    const field = this.activeElement?.value !== undefined ? this.activeElement : this.querySelector('textarea');
    window.__ixpcClipboard = field ? field.value : String(getSelection());
    return true;
  };
}

function throwOnStorageAccess() {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.", 'SecurityError');
    },
  });
}
