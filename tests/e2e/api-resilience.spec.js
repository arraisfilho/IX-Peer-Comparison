import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';

const timeOnlyStatus = /^● 32 IXes · \d{2}:\d{2}:\d{2} UTC$/;

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
    expect(await app.status()).toBe('● 32 IXes disponíveis');
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

  test.fail('API-04: a Retry-After HTTP-date is honoured, the countdown never shows NaN and then ends', async ({ app, api }) => {
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

  test.fail('API-04: a persistent 429 gives up after at most 4 attempts with a visible error', async ({ app, api, page }) => {
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

  test('a network failure on /net is reported as "Erro de rede"', async ({ app, api }) => {
    await app.open();
    api.peeringdb.networkError('net');
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: 'Erro de rede: Failed to fetch' });
    expect(await app.status()).toBe(`● ⚠ ${IX.A.name}: Erro de rede: Failed to fetch`);
  });

  test('a 5xx without CORS headers (proxy error page) also surfaces as a network error', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('netixlan', { status: 502, cors: false });
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: 'Erro de rede: Failed to fetch' });
  });

  test('a failure on /org fails the whole IX but its members stay listed without country', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('org', { status: 503 });
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: 'HTTP 503' });
    expect(await app.status()).toBe(`● ⚠ ${IX.A.name}: HTTP 503`);
    const rows = await app.rows();
    expect(rows).toHaveLength(29);
    expect(rows.every((r) => r.country === '—')).toBe(true);
    expect(api.ripestat.requests()).toHaveLength(0);
  });

  test('5xx and network errors are not retried today', { tag: '@request-budget' }, async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('netixlan', { status: 502, times: 1 });
    await app.addIX(IX.A.name);
    api.peeringdb.networkError('net', { times: 1 });
    await app.addIX(IX.B.name);
    expect(api.peeringdb.requests('netixlan')).toHaveLength(2);
    expect(api.peeringdb.requests('net')).toHaveLength(1);
  });

  test('RIPEstat failures are ignored silently', async ({ app, api }) => {
    await app.open();
    api.ripestat.fail((r) => r.query.resource === 'AS64520', { status: 500 });
    api.ripestat.networkError((r) => r.query.resource === 'AS64521');
    await app.addIX(IX.A.name);
    const country = Object.fromEntries((await app.rows()).map((r) => [r.name, r.country]));
    expect([country['Tango Services'], country['Uniform Labs'], country['Whiskey Hosting']]).toEqual(['—', '—', 'US']);
    expect(await app.status()).toBe('● 32 IXes disponíveis');
    expect(await app.chip(IX.A.name)).toMatchObject({ error: null });
  });
});

test.describe('members cache after failures', () => {
  test.fail('ARQ-02: a failure while re-adding from the members cache ends loading with a visible error', async ({ app, api }) => {
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

  test.fail('API (members cached before networks): an IX whose /net load failed adds no members to stats or table', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('net', { status: 500, times: 1 });
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ error: 'HTTP 500' });
    expect(await app.rows()).toEqual([]);
    expect((await app.stats()).total).toBe('0');
    expect(await app.countLabel()).toBe('0 redes');
  });

  test.fail('API (members cached before networks): re-adding an IX whose /net load failed refetches its members', async ({ app, api }) => {
    await app.open();
    api.peeringdb.fail('net', { status: 500, times: 1 });
    await app.addIX(IX.A.name);
    await app.removeIX(IX.A.name);
    await app.addIX(IX.A.name);
    expect(await app.rows()).toHaveLength(29);
    expect(api.peeringdb.requests('netixlan')).toHaveLength(2);
  });
});
