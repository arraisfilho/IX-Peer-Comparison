import { test, expect } from './support/fixtures.js';
import { CATALOG_OK_COUNT, IX } from '../fixtures/dataset.js';
import { A_TABLE } from './support/expected.js';

const PALETTE = [
  'rgb(87, 148, 242)', 'rgb(239, 132, 60)', 'rgb(184, 119, 217)',
  'rgb(126, 178, 109)', 'rgb(234, 184, 57)', 'rgb(155, 138, 196)',
];
const SIX = [IX.A, IX.B, IX.D, IX.E, IX.F, IX.G];
const peeringdbCalls = (api) => api.peeringdb.requests().filter((r) => r.endpoint !== 'ix');

/**
 * Opens the app and adds the six IXes of SIX. They cost 19 PeeringDB requests
 * with the catalog, one more than the app sends in a minute, so the fake clock
 * skips a minute before the last one instead of the test waiting for it.
 */
async function addSix(app, page) {
  await app.open({ clock: true });
  for (const ix of SIX.slice(0, 5)) await app.addIX(ix.name);
  await page.clock.fastForward(60_000);
  await app.addIX(SIX[5].name);
}

test.describe('adding and removing IXes', () => {
  test('a loading IX shows progress on its chip, "…" in its stat and a loading row in the table', async ({ app, api }) => {
    await app.open();
    const nets = api.peeringdb.hold('net');
    await app.addIX(IX.A.name, { wait: false });
    await nets.reached();

    const chip = await app.chip(IX.A.name);
    expect(chip).toMatchObject({ loading: true, tooltip: '29 membros — carregando redes…', error: null, removeTitle: 'Remover' });
    expect(chip.progress).toMatch(/^18%( · \d+s)?$/);
    // members count only once their networks have loaded
    expect(await app.stats()).toEqual({
      total: '0', totalLabel: 'Total únicos', inAll: null, inAllLabel: null,
      perIx: [{ name: IX.A.name, label: IX.A.name, value: '…' }],
    });
    expect(await app.headers()).toEqual(['Rede', 'ASN', 'País', 'Presença', IX.A.name]);
    expect(await app.tableMessage()).toBe('Carregando membros…');
    expect(await app.countLabel()).toBe('—');

    nets.release();
    await app.settle();
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, progress: null, tooltip: null, error: null });
    expect((await app.stats()).perIx).toEqual([{ name: IX.A.name, label: IX.A.name, value: '29' }]);
    expect(await app.tableMessage()).toBeNull();
    expect(await app.countLabel()).toBe('29 redes');
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
  });

  test('progress stages: members 5 %, networks 18 %, countries 92 %', async ({ app, api }) => {
    await app.open();
    const members = api.peeringdb.hold('netixlan');
    const nets = api.peeringdb.hold('net');
    const orgs = api.peeringdb.hold('org');
    await app.addIX(IX.A.name, { wait: false });

    const stages = [
      [members, nets, /^5%( · \d+s)?$/, 'Buscando membros…'],
      [nets, orgs, /^18%( · \d+s)?$/, '29 membros — carregando redes…'],
      [orgs, null, /^92%( · \d+s)?$/, 'Países…'],
    ];
    for (const [gate, next, progress, tooltip] of stages) {
      await gate.reached();
      const chip = await app.chip(IX.A.name);
      expect(chip.progress).toMatch(progress);
      expect(chip.tooltip).toBe(tooltip);
      gate.release();
      if (next) await next.reached();
    }
    await app.settle();
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, tooltip: null });
  });

  test('a large IX first shows its peer count, then network progress per batch of 1000', { tag: '@api-v2' }, async ({ app, api, page }) => {
    await app.open({ clock: true });
    const secondBatch = api.peeringdb.hold('net', { skip: 1 });
    await app.search('gamma');
    await page.clock.pauseAt((await app.pageNow()) + 1000);
    await app.pickResult(IX.C.name);
    expect(await app.chip(IX.C.name)).toMatchObject({ loading: true, progress: '0%', tooltip: '2000 peers' });
    await page.clock.resume();

    await secondBatch.reached();
    const chip = await app.chip(IX.C.name);
    expect(chip.tooltip).toBe('Redes 1000/2000');
    expect(chip.progress).toMatch(/^42%( · \d+s)?$/);
    secondBatch.release();
    await app.settle();
    expect((await app.stats()).perIx).toEqual([{ name: IX.C.name, label: IX.C.name, value: '2000' }]);
  });

  test('elapsed time shows while loading and stays on the chip afterwards', async ({ app, api, page }) => {
    await app.open({ clock: true });
    // every attempt: within 61 s the 30 s request timeout makes the app retry
    const nets = api.peeringdb.hold('net', { times: Infinity });
    await app.addIX(IX.A.name, { wait: false });
    await nets.reached();
    await page.clock.runFor(61_000);
    expect((await app.chip(IX.A.name)).progress).toMatch(/^18% · 1m\d{1,2}s$/);
    nets.release();
    await app.settle();
    expect((await app.chip(IX.A.name)).badge).toMatch(/^·1m\d{1,2}s$/);
  });

  test('two IXes: unique total, "in all IXes" and one count per IX', async ({ app }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.addIX(IX.B.name);
    expect(await app.stats()).toEqual({
      total: '37', totalLabel: 'Total únicos', inAll: '12', inAllLabel: 'Em todos IXes',
      perIx: [
        { name: IX.A.name, label: IX.A.name, value: '29' },
        { name: IX.B.name, label: IX.B.name, value: '20' },
      ],
    });
  });

  test('three IXes: "in all IXes" counts networks present at every one of them', async ({ app }) => {
    await app.open();
    for (const ix of [IX.A, IX.B, IX.D]) await app.addIX(ix.name);
    const stats = await app.stats();
    expect([stats.total, stats.inAll]).toEqual(['41', '1']);
    expect(stats.perIx.map((s) => s.value)).toEqual(['29', '20', '6']);
  });

  test('IX stat labels are cut at 22 characters and keep the full name as tooltip', async ({ app }) => {
    await app.open();
    await app.addIX(IX.B.name);
    await app.addIX(IX.E.name);
    expect((await app.stats()).perIx).toEqual([
      { name: IX.B.name, label: 'Beta-IX Rio de Janeiro', value: '20' }, // exactly 22
      { name: IX.E.name, label: 'Epsilon-IX Greater Lo…', value: '5' },
    ]);
  });

  test('six IXes get the six palette colours in order; the search is then disabled with a note', async ({ app, page }) => {
    await addSix(app, page);
    expect((await app.chips()).map((c) => c.color)).toEqual(PALETTE);
    expect(await app.ixHeaderColors()).toEqual(PALETTE);
    expect(await app.isSearchDisabled()).toBe(true);
    expect(await app.maxNote()).toBe('Máximo de 6 IXes atingido');

    await app.removeIX(IX.G.name);
    expect(await app.isSearchDisabled()).toBe(false);
    expect(await app.maxNote()).toBe('');
  });

  test('ARQ-12: a newly added IX never reuses a colour that is still in use', async ({ app, page }) => {
    await addSix(app, page);
    await app.removeIX(IX.G.name);
    await app.addIX(IX.H.name);
    const colors = (await app.chips()).map((c) => c.color);
    expect(new Set(colors).size).toBe(6);
  });

  test('removing an IX drops its chip, column, stat and buttons; removing the last restores the empty state', async ({ app }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.addIX(IX.B.name);

    await app.removeIX(IX.A.name);
    expect(await app.chipNames()).toEqual([IX.B.name]);
    expect(await app.headers()).toEqual(['Rede', 'ASN', 'País', 'Presença', IX.B.name]);
    expect(await app.stats()).toMatchObject({ total: '20', inAll: null, perIx: [{ name: IX.B.name, value: '20' }] });
    expect(await app.presenceFilters()).toEqual([
      { label: 'Todos', active: true },
      { label: 'Só Beta-IX Rio d…', active: false },
    ]);
    expect(await app.exportButtons()).toEqual(['↓ Beta-IX Rio…']);
    const rows = await app.rows();
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.presence === '●')).toBe(true);

    await app.removeIX(IX.B.name);
    expect(await app.isEmptyStateVisible()).toBe(true);
    expect(await app.isTableVisible()).toBe(false);
    expect(await app.isToolbarVisible()).toBe(false);
    expect(await app.isGeoBarVisible()).toBe(false);
    expect(await app.noIxText()).toBe('Nenhum IX selecionado — use a busca abaixo');
    expect((await app.stats()).total).toBeNull();
  });

  test('removing an IX resets the continent and country filters but keeps presence and policy', async ({ app }) => {
    await app.open();
    for (const ix of [IX.A, IX.B, IX.D]) await app.addIX(ix.name);
    await app.setPresence('inAll');
    await app.setPolicy('open');
    await app.setContinent('Europa');
    await app.setCountry('DE');
    expect(await app.rowNames()).toEqual(['India Carrier']);

    await app.removeIX(IX.D.name);
    expect(await app.continents()).toContainEqual({ label: 'Todos', active: true });
    expect(await app.selectedCountry()).toBe('all');
    expect(await app.presenceFilters()).toContainEqual({ label: 'Em todos IXes', active: true });
    expect(await app.policyFilters()).toContainEqual({ label: 'Open', active: true });
    expect(await app.rowNames()).toEqual([
      'Alpha Backup', 'Alpha Networks', 'India Carrier', 'Mike Online', 'Sierra Arctic', 'Tango Services',
    ]);
  });

  test('removing an IX while it loads cancels its requests silently and leaves the other IXes intact', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.B.name);
    const nets = api.peeringdb.hold('net');
    await app.addIX(IX.A.name, { wait: false });
    await nets.reached();
    const held = api.peeringdb.requests('net').at(-1);

    await app.removeIX(IX.A.name);
    await expect.poll(() => held.failure).toBe('net::ERR_ABORTED');
    nets.release();
    await api.waitForIdle();

    expect(await app.chipNames()).toEqual([IX.B.name]);
    expect(await app.status()).toBe(`● ${CATALOG_OK_COUNT} IXes disponíveis`);
    expect(await app.statusTone()).toBe('ok');
    expect(await app.tableMessage()).toBeNull();
    expect(await app.rows()).toHaveLength(20);
    // nothing else was requested for the removed IX
    expect(api.peeringdb.requests('org')).toHaveLength(1);
  });

  test('re-adding an IX within the cache TTL reuses its cached members and networks', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.removeIX(IX.A.name);
    const before = peeringdbCalls(api).length;
    await app.addIX(IX.A.name);

    expect(peeringdbCalls(api)).toHaveLength(before);
    expect(await app.rows()).toHaveLength(29);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null });
    // RIPEstat is asked again only for networks still without a country
    // (batches of 4 run concurrently, so order within a batch is not fixed)
    const asns = api.ripestat.requestedAsns();
    expect(asns.slice(0, 4).sort()).toEqual(['AS64520', 'AS64521', 'AS64522', 'AS64523']);
    expect(asns.slice(4)).toEqual(['AS64522']);
  });

  test('a re-added IX shows how old its cached members are', async ({ app, page }) => {
    await app.open({ clock: true });
    await app.addIX(IX.A.name);
    await app.removeIX(IX.A.name);
    await page.clock.fastForward(2 * 60_000);
    await app.addIX(IX.A.name);
    expect(await app.chip(IX.A.name)).toMatchObject({ badge: '·2min', tooltip: 'Cache local (2 min)' });
  });

  test('a re-added IX comes from the cache for 60 min, then refetches its members but not its networks', { tag: '@api-v2' }, async ({ app, api, page }) => {
    await app.open({ clock: true });
    await app.addIX(IX.A.name);
    await app.removeIX(IX.A.name);
    await page.clock.fastForward(59 * 60_000);
    await app.addIX(IX.A.name);
    expect(peeringdbCalls(api)).toHaveLength(3);
    expect(await app.chip(IX.A.name)).toMatchObject({ badge: '·59min', tooltip: 'Cache local (59 min)' });

    await app.removeIX(IX.A.name);
    await page.clock.fastForward(2 * 60_000);
    await app.addIX(IX.A.name);
    expect(api.peeringdb.requests('netixlan')).toHaveLength(2);
    expect(api.peeringdb.requests('net')).toHaveLength(1);
    expect(api.peeringdb.requests('org')).toHaveLength(1);
    expect(await app.rows()).toHaveLength(29);
  });

  test('after a reload within 60 min, re-adding an IX makes no PeeringDB request', { tag: '@api-v2' }, async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    const before = api.peeringdb.requests().length;
    await app.reload(); // the catalog comes from localStorage
    await app.addIX(IX.A.name);
    expect(api.peeringdb.requests()).toHaveLength(before);
    expect(await app.table()).toEqual(A_TABLE);
    expect(await app.chip(IX.A.name)).toMatchObject({ loading: false, error: null, partial: null });
  });
});
