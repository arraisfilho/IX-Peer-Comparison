import { test, expect } from './support/fixtures.js';
import { CATALOG_OK_COUNT, IX, catalogCache } from '../fixtures/dataset.js';

const DAY = 24 * 60 * 60 * 1000;
const readyStatus = (count) => new RegExp(`^● ${count} IXes · \\d{2}/\\d{2}/\\d{4}, \\d{2}:\\d{2}:\\d{2} UTC$`);

const CACHED = [
  { id: 901, name: 'Cached-IX One', name_long: '', city: 'Cacheville', country: 'BR', net_count: 3, aka: '' },
  { id: 902, name: 'Cached-IX Two', name_long: '', city: 'Cacheville', country: 'BR', net_count: 2, aka: '' },
  { id: 903, name: 'Cached-IX Three', name_long: '', city: 'Cacheville', country: 'BR', net_count: 1, aka: '' },
];

test.describe('IX catalog', () => {
  test('first visit fetches /api/ix once, drops IXes whose status is not "ok" and shows "N IXes · <timestamp>"', async ({ app, api }) => {
    await app.open();
    expect(await app.status()).toMatch(readyStatus(CATALOG_OK_COUNT));
    expect(await app.statusTone()).toBe('ok');
    expect(api.peeringdb.requests('ix')).toHaveLength(1);
    await app.search('paulo');
    expect(await app.searchResultNames()).toEqual([IX.A.name, IX.OMEGA.name]);
  });

  test('status reads "Carregando catálogo…" in amber while /api/ix is pending', async ({ app, api }) => {
    const gate = api.peeringdb.hold('ix');
    await app.open({ waitForCatalog: false });
    await gate.reached();
    await expect(app.statusLocator).toHaveText('● Carregando catálogo…');
    expect(await app.statusTone()).toBe('warning');
    gate.release();
    await app.waitForCatalog();
    expect(await app.statusHistory()).toEqual([
      'Inicializando…',
      '● Carregando catálogo…',
      expect.stringMatching(readyStatus(CATALOG_OK_COUNT)),
    ]);
  });

  test('the fetched catalog is cached in localStorage as { ts, data } with only the fields the app uses', async ({ app }) => {
    const before = Date.now();
    await app.open();
    const stored = await app.storedCatalog();
    expect(stored.ts).toBeGreaterThanOrEqual(before);
    expect(stored.ts).toBeLessThanOrEqual(Date.now());
    expect(stored.data).toHaveLength(CATALOG_OK_COUNT);
    expect(stored.data[0]).toEqual({
      id: IX.A.id, name: IX.A.name, name_long: 'Alpha Internet Exchange São Paulo',
      city: 'São Paulo', country: 'BR', net_count: 30, aka: 'AIX-SP',
    });
    // null fields become '' and a missing net_count becomes 0
    expect(stored.data.find((ix) => ix.id === IX.LAMBDA.id)).toEqual({
      id: IX.LAMBDA.id, name: IX.LAMBDA.name, name_long: '', city: '', country: '', net_count: 0, aka: '',
    });
    const ids = stored.data.map((ix) => ix.id);
    expect(ids).not.toContain(IX.DEFUNCT.id);
    expect(ids).not.toContain(IX.PENDING.id);
  });

  test('a cached catalog younger than 24 h is used without calling /api/ix', async ({ app, api }) => {
    await app.open({ catalogCache: catalogCache(CACHED, { ageMs: DAY - 60_000 }) });
    expect(await app.status()).toMatch(readyStatus(3));
    expect(api.peeringdb.requests('ix')).toHaveLength(0);
    await app.search('cacheville');
    expect(await app.searchResultNames()).toEqual(['Cached-IX One', 'Cached-IX Two', 'Cached-IX Three']);
  });

  const unusableCaches = [
    ['an expired cache (older than 24 h)', () => catalogCache(CACHED, { ageMs: DAY + 60_000 })],
    ['a corrupted cache', () => '{not json'],
    ['a cache with an empty list', () => catalogCache([])],
    ['a cache without timestamp', () => ({ data: CACHED })],
  ];
  for (const [label, cache] of unusableCaches) {
    test(`${label} is ignored: the catalog is refetched and the cache rewritten`, async ({ app, api }) => {
      const before = Date.now();
      await app.open({ catalogCache: cache() });
      expect(await app.status()).toMatch(readyStatus(CATALOG_OK_COUNT));
      expect(api.peeringdb.requests('ix')).toHaveLength(1);
      const stored = await app.storedCatalog();
      expect(stored.ts).toBeGreaterThanOrEqual(before);
      expect(stored.data).toHaveLength(CATALOG_OK_COUNT);
    });
  }

  test('a full localStorage (quota error) is ignored: the catalog loads but is not cached', async ({ app }) => {
    await app.open({ storageFull: true });
    expect(await app.status()).toMatch(readyStatus(CATALOG_OK_COUNT));
    expect(await app.storedCatalog()).toBeNull();
    await app.search('alpha-ix');
    expect(await app.searchResultNames()).toEqual([IX.A.name]);
  });

  test('typing before the catalog is ready does nothing and the query is not re-run once it loads', async ({ app, api, page }) => {
    const gate = api.peeringdb.hold('ix');
    await app.open({ clock: true, waitForCatalog: false });
    await gate.reached();
    await app.typeSearch('alpha');
    gate.release();
    await app.waitForCatalog();
    await page.clock.runFor(1000); // flush any debounce timer
    expect(await app.isDropdownOpen()).toBe(false);
    await app.search('alpha-ix');
    expect(await app.searchResultNames()).toEqual([IX.A.name]);
  });

  test.fail('ARQ-09: a failed catalog load keeps its error visible instead of a green "0 IXes"', async ({ app, api }) => {
    api.peeringdb.fail('ix', { status: 500 });
    await app.open({ waitForCatalog: false });
    await expect.poll(() => app.statusHistory()).toContainEqual(expect.stringContaining('HTTP 500'));
    await expect(app.statusLocator).toContainText('HTTP 500');
    expect(await app.statusTone()).toBe('error');
  });

  test.fail('ARQ-10: the app still starts and loads the catalog when localStorage access throws', async ({ app }) => {
    await app.open({ storageBlocked: true, waitForCatalog: false });
    await expect(app.statusLocator).toHaveText(readyStatus(CATALOG_OK_COUNT));
    await app.search('alpha-ix');
    expect(await app.searchResultNames()).toEqual([IX.A.name]);
  });
});
