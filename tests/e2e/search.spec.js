import { test, expect } from './support/fixtures.js';
import { IX, metroName } from '../fixtures/dataset.js';

test.describe('IX search', () => {
  test('opens from two characters and closes again below two, after trimming', async ({ app }) => {
    await app.open();
    await app.search('al');
    expect(await app.isDropdownOpen()).toBe(true);
    await app.typeSearch('a');
    expect(await app.isDropdownOpen()).toBe(false);
    await app.search('al');
    await app.typeSearch(' a ');
    expect(await app.isDropdownOpen()).toBe(false);
  });

  test('results appear 120 ms after the last keystroke (debounce)', async ({ app, page }) => {
    await app.open({ clock: true });
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.typeSearch('al');
    await page.clock.runFor(100);
    await app.typeSearch('alpha');
    await page.clock.runFor(119);
    expect(await app.isDropdownOpen()).toBe(false);
    await page.clock.runFor(1);
    expect(await app.searchResultNames()).toEqual([IX.A.name]);
  });

  test('every term must match (AND), case-insensitively, across name, long name, city, country and aka', async ({ app }) => {
    await app.open();
    const cases = [
      ['paulo', [IX.A.name, IX.OMEGA.name]],
      ['paulo omega', [IX.OMEGA.name]],
      ['omega paulo', [IX.OMEGA.name]],
      ['br paulo', [IX.A.name, IX.OMEGA.name]],
      ['exchange rio', [IX.B.name]], // long name
      ['miami', [IX.G.name]], // city only
      ['jp', [IX.F.name]], // country code only
      ['aix-sp', [IX.A.name]], // aka
      ['nordic hub', [IX.I.name]], // aka, two terms
      ['ALPHA-ix', [IX.A.name]],
    ];
    for (const [query, names] of cases) {
      await app.search(query);
      expect(await app.searchResultNames(), `query "${query}"`).toEqual(names);
    }
  });

  test('matching is accent-sensitive: "sao paulo" finds nothing, "são paulo" does', async ({ app }) => {
    await app.open();
    await app.search('sao paulo');
    expect(await app.searchResults()).toEqual([]);
    expect(await app.searchMessage()).toBe('Nenhum IX encontrado');
    await app.search('são paulo');
    expect(await app.searchResultNames()).toEqual([IX.A.name, IX.OMEGA.name]);
  });

  test('shows at most 16 results, in catalog order', async ({ app }) => {
    await app.open();
    await app.search('springfield');
    expect(await app.searchResultNames()).toEqual(Array.from({ length: 16 }, (_, i) => metroName(i + 1)));
  });

  test('IXes whose status is not "ok" are never offered', async ({ app }) => {
    await app.open();
    for (const query of ['defunct', 'pending-ix']) {
      await app.search(query);
      expect(await app.searchMessage(), `query "${query}"`).toBe('Nenhum IX encontrado');
    }
  });

  test('a result shows the IX name, "city · country" and its peer count', async ({ app }) => {
    await app.open();
    await app.search('alpha-ix');
    expect(await app.searchResults()).toEqual([
      { name: IX.A.name, meta: 'São Paulo · BR', peers: '29 peers', added: false, full: false, largeHint: null },
    ]);
    await app.search('lambda');
    expect(await app.searchResults()).toEqual([
      { name: IX.LAMBDA.name, meta: '', peers: '0 peers', added: false, full: false, largeHint: null },
    ]);
  });

  test('IXes with 2000 or more peers carry an hourglass with the load estimate', async ({ app }) => {
    await app.open();
    await app.search('gamma');
    expect(await app.searchResults()).toEqual([
      {
        name: IX.C.name, meta: 'Frankfurt · DE', peers: '2000 peers', added: false, full: false,
        largeHint: { text: '⏳', title: '2000 peers · ~26s' },
      },
    ]);
  });

  test('the "no IX found" message follows the language', async ({ app }) => {
    await app.open();
    for (const [lang, message] of [['pt', 'Nenhum IX encontrado'], ['en', 'No IX found'], ['es', 'Ningún IX encontrado']]) {
      await app.setLang(lang);
      await app.search('zz');
      expect(await app.searchMessage(), lang).toBe(message);
    }
  });

  test('Escape closes the dropdown', async ({ app }) => {
    await app.open();
    await app.search('paulo');
    await app.pressInSearch('Escape');
    expect(await app.isDropdownOpen()).toBe(false);
  });

  test('a click outside the search closes the dropdown, a click in the input keeps it', async ({ app }) => {
    await app.open();
    await app.search('paulo');
    await app.searchInput.click();
    expect(await app.isDropdownOpen()).toBe(true);
    await app.clickOutsideSearch();
    expect(await app.isDropdownOpen()).toBe(false);
  });

  test('picking a result adds the IX, clears the input and closes the dropdown', async ({ app }) => {
    await app.open();
    await app.search('paulo');
    await app.pickResult(IX.A.name);
    expect(await app.searchInput.inputValue()).toBe('');
    expect(await app.isDropdownOpen()).toBe(false);
    expect(await app.chipNames()).toEqual([IX.A.name]);
    await app.settle();
  });

  test('an IX already added is dimmed and picking it again does nothing', async ({ app }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.search('paulo');
    expect(await app.searchResults()).toMatchObject([
      { name: IX.A.name, added: true, full: false },
      { name: IX.OMEGA.name, added: false, full: false },
    ]);
    await app.pickResult(IX.A.name, { dimmed: true });
    expect(await app.chipNames()).toEqual([IX.A.name]);
    expect(await app.isDropdownOpen()).toBe(true);
  });

  test('picking the 6th IX while a newer query is debouncing reopens stale results marked as full', async ({ app, page }) => {
    await app.open({ clock: true });
    for (const ix of [IX.A, IX.B, IX.D, IX.E, IX.F]) await app.addIX(ix.name);
    await app.search('springfield');
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.typeSearch('springfield 0'); // debounce pending, previous results still shown
    await app.pickResult(metroName(1));
    expect(await app.isDropdownOpen()).toBe(false);
    expect(await app.isSearchDisabled()).toBe(true);
    await page.clock.runFor(120);
    const results = await app.searchResults();
    expect(results.map((r) => r.name)).toEqual(Array.from({ length: 10 }, (_, i) => metroName(i + 1)));
    expect(results[0]).toMatchObject({ added: true, full: false });
    expect(results.slice(1).every((r) => r.full && !r.added)).toBe(true);
    await app.pickResult(metroName(2), { dimmed: true });
    expect(await app.chipNames()).toHaveLength(6);
  });
});
