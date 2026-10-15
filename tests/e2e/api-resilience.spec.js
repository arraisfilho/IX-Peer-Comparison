import { test, expect } from './support/fixtures.js';
import { CATALOG_OK_COUNT, IX } from '../fixtures/dataset.js';

const timeOnlyStatus = new RegExp(`^● ${CATALOG_OK_COUNT} IXes · \\d{2}:\\d{2}:\\d{2} UTC$`);

test.describe('rate limiting (HTTP 429)', () => {
  test('a CORS-exposed numeric Retry-After shows a countdown, waits Retry-After + 2 s and retries', async ({ app, api }) => {
    await app.open();
    api.peeringdb.rateLimit('netixlan', { retryAfter: 1, exposeRetryAfter: true, times: 1 });
    await app.addIX(IX.A.name, { wait: false });
    await expect(app.statusLocator).toContainText('Rate limit — aguardando');
    expect(await app.statusTone()).toBe('warning');
    await app.settle();

    const [limited, retried] = api.peeringdb.requests('netixlan');
    expect(retried.startedAt - limited.startedAt).toBeGreaterThanOrEqual(2900);
    expect(await app.statusHistory()).toEqual(expect.arrayContaining([
      '● ⏳ ⏳ Rate limit — aguardando 3s…',
      '● ⏳ ⏳ Rate limit — aguardando 2s…',
      '● ⏳ ⏳ Rate limit — aguardando 1s…',
      expect.stringMatching(timeOnlyStatus),
    ]));
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null });
    expect(await app.rows()).toHaveLength(29);
  });

  // Real PeeringDB responses carry no Access-Control-Expose-Headers, so a
  // browser cannot read Retry-After and the app falls back to its default.
  for (const [label, options] of [
    ['without Retry-After', {}],
    ['whose Retry-After is not CORS-exposed', { retryAfter: 5 }],
  ]) {
    test(`a 429 ${label} waits the default 30 s + 2 s`, async ({ app, api, page }) => {
      await app.open({ clock: true });
      api.peeringdb.rateLimit('netixlan', { ...options, times: 1 });
      await app.search(IX.A.name);
      await page.clock.pauseAt((await app.pageNow()) + 1000);
      await app.pickResult(IX.A.name);
      await expect(app.statusLocator).toContainText('aguardando 32s…');
      await page.clock.runFor(31_000);
      expect(api.peeringdb.requests('netixlan')).toHaveLength(1);
      await page.clock.runFor(1_000);
      await page.clock.resume();
      await app.settle();
      expect(api.peeringdb.requests('netixlan')).toHaveLength(2);
      expect(await app.rows()).toHaveLength(29);
    });
  }

  test('removing the IX during a countdown stops it, restores the status and never retries', async ({ app, api, page }) => {
    await app.open({ clock: true });
    api.peeringdb.rateLimit('netixlan', { retryAfter: 30, exposeRetryAfter: true });
    await app.search(IX.A.name);
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.pickResult(IX.A.name);
    await expect(app.statusLocator).toContainText('aguardando 32s…');
    await app.removeIX(IX.A.name);
    expect(await app.status()).toMatch(timeOnlyStatus);
    await page.clock.runFor(60_000);
    await api.waitForIdle();
    expect(api.peeringdb.requests('netixlan')).toHaveLength(1);
    expect(await app.status()).toMatch(timeOnlyStatus);
    expect(await app.isEmptyStateVisible()).toBe(true);
  });

  // A 429 sent without CORS headers is unreadable: fetch() rejects as for any
  // network failure, so there is no countdown, but the backoff of network errors.
  test('a 429 without CORS headers is retried like a network error, after a backoff', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open();
    api.peeringdb.rateLimit('netixlan', { cors: false, times: 1 });
    await app.addIX(IX.A.name);
    const [limited, retried] = api.peeringdb.requests('netixlan');
    expect(retried.startedAt - limited.startedAt).toBeGreaterThanOrEqual(2000);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null });
    expect(await app.rows()).toHaveLength(29);
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    expect((await app.statusHistory()).filter((s) => s.includes('Rate limit'))).toEqual([]);
  });

  test('API-04: a Retry-After HTTP-date is honoured, the countdown never shows NaN and then ends', async ({ app, api }) => {
    test.setTimeout(20_000);
    await app.open();
    api.peeringdb.rateLimit('netixlan', { retryAfter: new Date(Date.now() + 3000), exposeRetryAfter: true, times: 1 });
    await app.addIX(IX.A.name, { wait: false });
    await app.waitUntilLoaded();
    const [limited, retried] = api.peeringdb.requests('netixlan');
    expect(retried.startedAt - limited.startedAt).toBeGreaterThanOrEqual(1500);
    expect((await app.statusHistory()).filter((s) => s.includes('NaN'))).toEqual([]);
    await expect(app.statusLocator).not.toContainText('Rate limit');
  });

  test('API-04: a persistent 429 gives up after at most 4 attempts with a visible error', async ({ app, api, page }) => {
    test.setTimeout(30_000);
    await app.open({ clock: true });
    api.peeringdb.rateLimit('netixlan', { retryAfter: 0, exposeRetryAfter: true });
    await app.addIX(IX.A.name, { wait: false });
    for (let second = 0; second < 120; second++) {
      const chip = await app.chip(IX.A.name);
      if (!chip.loading || api.peeringdb.requests('netixlan').length > 4) break;
      await page.clock.runFor(1000);
      await api.waitForIdle({ quietMs: 50 });
    }
    expect(api.peeringdb.requests('netixlan').length).toBeLessThanOrEqual(4);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: expect.any(String) });
    // today's limit: 4 requests, then the IX fails with the last status
    expect(api.peeringdb.requests('netixlan')).toHaveLength(4);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: 'HTTP 429' });
    expect(await app.status()).toBe(`● ⚠ ${IX.A.name}: HTTP 429`);
  });
});

test.describe('HTTP and network errors', () => {
  test('HTTP 500 on /netixlan marks only that IX as failed', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.B.name);
    api.peeringdb.fail('netixlan', { status: 500 });
    await app.addIX(IX.A.name);

    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: 'HTTP 500' });
    expect((await app.chip(IX.A.name)).errorBadge).toMatch(/^⚠( · \d+s)?$/);
    expect(await app.status()).toBe(`● ⚠ ${IX.A.name}: HTTP 500`);
    expect(await app.statusTone()).toBe('error');
    expect(await app.stats()).toMatchObject({ total: '20', inAll: '0', perIx: [{ value: '20' }, { value: '0' }] });
    const rows = await app.rows();
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.presence === '●○' && r.cells[1].text === '—')).toBe(true);
  });

  test('a network failure on /net is retried, then reported as "Erro de rede" after 4 attempts', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open({ clock: true });
    api.peeringdb.networkError('net');
    await app.addIX(IX.A.name, { wait: false });
    await app.runClockUntilLoaded(IX.A.name);
    expect(api.peeringdb.requests('net')).toHaveLength(4);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: 'Erro de rede: Failed to fetch' });
    expect(await app.status()).toBe(`● ⚠ ${IX.A.name}: Erro de rede: Failed to fetch`);
  });

  test('a 5xx without CORS headers (proxy error page) is retried as a network error', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open({ clock: true });
    api.peeringdb.fail('netixlan', { status: 502, cors: false });
    await app.addIX(IX.A.name, { wait: false });
    await app.runClockUntilLoaded(IX.A.name);
    expect(api.peeringdb.requests('netixlan')).toHaveLength(4);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: 'Erro de rede: Failed to fetch' });
  });

  test('when /org keeps failing the IX still loads, without countries, marked partial', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open({ clock: true });
    api.peeringdb.fail('org', { status: 503 });
    await app.addIX(IX.A.name, { wait: false });
    await app.runClockUntilLoaded(IX.A.name);
    expect(api.peeringdb.requests('org')).toHaveLength(4);
    const partial = 'Parcial: países das organizações indisponíveis no PeeringDB';
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null, partial });
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    const rows = await app.rows();
    expect(rows).toHaveLength(29);
    expect(rows.every((r) => r.country === '—')).toBe(true);
    expect(await app.stats()).toMatchObject({ total: '29', perIx: [{ value: '29' }] });
    expect(api.ripestat.requests()).toHaveLength(0);
    await app.setLang('en');
    expect((await app.chip(IX.A.name)).partial).toBe('Partial: organisation countries unavailable from PeeringDB');
  });

  test('HTTP 503 is retried after a backoff of 2 to 2.5 s, then the IX loads', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('netixlan', { status: 503, times: 1 });
    await app.addIX(IX.A.name);
    const [failed, retried] = api.peeringdb.requests('netixlan');
    expect([failed.status, retried.status]).toEqual([503, 200]);
    expect(retried.startedAt - failed.startedAt).toBeGreaterThanOrEqual(2000);
    expect(retried.startedAt - failed.startedAt).toBeLessThan(4000);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null });
    expect(await app.rows()).toHaveLength(29);
  });

  test('502/503/504 and network errors are retried with a backoff; 500 and other 4xx are not', { tag: ['@request-budget', '@api-v2'] }, async ({ app, api }) => {
    await app.open({ clock: true });
    api.peeringdb.fail('netixlan', { status: 502, times: 1 });
    api.peeringdb.fail('net', { status: 504, times: 1 });
    api.peeringdb.networkError('org', { times: 1 });
    await app.addIX(IX.A.name, { wait: false });
    await app.runClockUntilLoaded(IX.A.name);
    expect(['netixlan', 'net', 'org'].map((e) => api.peeringdb.requests(e).length)).toEqual([2, 2, 2]);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: null, partial: null });

    for (const [status, ix] of [[500, IX.B], [404, IX.D]]) {
      api.peeringdb.fail((r) => r.endpoint === 'netixlan' && r.query.ix_id === String(ix.id), { status });
      await app.addIX(ix.name, { wait: false });
      await app.runClockUntilLoaded(ix.name);
      expect(api.peeringdb.requests((r) => r.query.ix_id === String(ix.id))).toHaveLength(1);
      expect(await app.chip(ix.name)).toMatchObject({ error: `HTTP ${status}` });
    }
  });

  test('the 19th PeeringDB request within 60 s, counting those of a previous page load, waits for the window', { tag: '@api-v2' }, async ({ app, api, page }) => {
    const t0 = Date.now();
    // 17 requests sent 10 s before this page load; the catalog is the 18th
    const storage = { peercomp_pdb_window: JSON.stringify(Array(17).fill(t0 - 10_000)) };
    await app.open({ clock: { time: t0 }, storage });
    expect(api.peeringdb.requests('ix')).toHaveLength(1);
    await app.search(IX.A.name);
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.pickResult(IX.A.name);
    await page.clock.runFor(t0 + 49_000 - (await app.pageNow()));
    expect(api.peeringdb.requests('netixlan')).toHaveLength(0);
    await page.clock.runFor(2_000); // the 17 old requests leave the window at t0 + 50 s
    await expect.poll(() => api.peeringdb.requests('netixlan').length).toBe(1);
    await page.clock.resume();
    await app.settle();
    expect(await app.rows()).toHaveLength(29);
  });

  test('RIPEstat failures are ignored silently', async ({ app, api }) => {
    await app.open();
    api.ripestat.fail((r) => r.query.resource === 'AS64520', { status: 500 });
    api.ripestat.networkError((r) => r.query.resource === 'AS64521');
    await app.addIX(IX.A.name);
    const country = Object.fromEntries((await app.rows()).map((r) => [r.name, r.country]));
    expect([country['Tango Services'], country['Uniform Labs'], country['Whiskey Hosting']]).toEqual(['—', '—', 'US']);
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: null });
  });
});

test.describe('members cache after failures', () => {
  test('ARQ-02: a failure while re-adding from the members cache ends loading with a visible error', async ({ app, api }) => {
    test.setTimeout(20_000);
    await app.open();
    api.peeringdb.fail('net', { status: 500 });
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: 'HTTP 500' });
    await app.removeIX(IX.A.name);

    await app.addIX(IX.A.name, { wait: false });
    await expect.poll(() => app.chip(IX.A.name)).toMatchObject({ loading: false, error: expect.any(String) });
    expect(await app.tableMessage()).not.toBe('Carregando membros…');
  });

  test('API (members cached before networks): an IX whose /net load failed adds no members to stats or table', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('net', { status: 500, times: 1 });
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: 'HTTP 500' });
    expect(await app.rows()).toEqual([]);
    expect((await app.stats()).total).toBe('0');
    expect(await app.countLabel()).toBe('0 redes');
  });

  test('API (members cached before networks): re-adding an IX whose /net load failed refetches its members', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('net', { status: 500, times: 1 });
    await app.addIX(IX.A.name);
    await app.removeIX(IX.A.name);
    await app.addIX(IX.A.name);
    expect(await app.rows()).toHaveLength(29);
    expect(api.peeringdb.requests('netixlan')).toHaveLength(2);
  });
});
