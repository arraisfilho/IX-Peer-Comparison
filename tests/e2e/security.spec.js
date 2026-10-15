import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';

const imageCount = (page) => page.evaluate(() => document.images.length);
const xssFlags = (page) => page.evaluate(() => [window.__xss, window.__xssPolicy, window.__xssCountry]);

test.describe('untrusted PeeringDB text', () => {
  test('HTML in an IX name is shown as text in the dropdown, chip, stats, buttons, table and export dialog', async ({ app, page }) => {
    await app.open();
    await app.search('xss');
    expect(await app.searchResultNames()).toEqual([IX.XSS.name]);
    await app.pickResult(IX.XSS.name);
    await app.settle();

    expect(await app.chipNames()).toEqual([IX.XSS.name]);
    expect((await app.stats()).perIx).toEqual([{ name: IX.XSS.name, label: 'XSS <img src=x onerro…', value: '2' }]);
    expect((await app.presenceFilters()).map((b) => b.label)).toEqual(['Todos', 'Só XSS <img src=…']);
    expect(await app.exportButtons()).toEqual(['↓ XSS <img sr…']);
    expect((await app.headers()).at(-1)).toBe(IX.XSS.name);
    await app.openExport(IX.XSS.name);
    expect((await app.exportDialog()).title).toBe(`Export ASNs — ${IX.XSS.name}`);

    expect(await imageCount(page)).toBe(0);
    expect(await xssFlags(page)).toEqual([undefined, undefined, undefined]);
  });

  test.fail('ARQ-03: an IX name is not interpreted as HTML in the status bar when its load fails', async ({ app, api, page }) => {
    await app.open();
    api.peeringdb.fail('netixlan', { status: 500 });
    await app.addIX(IX.XSS.name, { query: 'xss' });
    expect(await imageCount(page)).toBe(0);
    expect(await xssFlags(page)).toEqual([undefined, undefined, undefined]);
    await expect(app.statusLocator).toHaveText(`● ⚠ ${IX.XSS.name}: HTTP 500`);
  });

  test.fail('ARQ-04: HTML in a network policy or organisation country is not interpreted', async ({ app, page }) => {
    await app.open();
    await app.addIX(IX.PAYLOAD.name);
    expect(await imageCount(page)).toBe(0);
    expect(await xssFlags(page)).toEqual([undefined, undefined, undefined]);
    const policy = (await app.rows()).find((r) => r.name === 'Policy Payload Net').cells[0].policy;
    expect(policy).toBe('<img src=x onerror="window.__xssPolicy=1">');
  });
});
