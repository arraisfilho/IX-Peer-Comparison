import { test, expect } from './support/fixtures.js';
import { DEPTH_ROW_LIMIT, FakePeeringDB } from '../fake-api/peeringdb.js';
import { FakeRipestat } from '../fake-api/ripestat.js';
import { CATALOG_OK_COUNT, IX, MISSING_NET_ID, dataset } from '../fixtures/dataset.js';

const ids = (entry) => entry.query.id__in.split(',');
const A_NET_IDS = [...Array.from({ length: 26 }, (_, i) => String(1001 + i)), '1028', '1029', '1030'];
const A_ORG_IDS = [...Array.from({ length: 20 }, (_, i) => String(i + 1)), '22', '23', '24', '25', '26', '29'];

test.describe('API contract', () => {
  test('no PeeringDB request ever uses depth=', async ({ app, api }) => {
    await app.open();
    for (const ix of [IX.A, IX.B, IX.D]) await app.addIX(ix.name);
    await app.removeIX(IX.B.name);
    await app.addIX(IX.B.name);
    await app.setLang('en');
    const urls = api.peeringdb.requests().map((r) => r.url);
    expect(urls.length).toBeGreaterThan(5);
    expect(urls.filter((url) => /[?&]depth=/i.test(url))).toEqual([]);
  });

  test('only GET /api/ix, /api/netixlan, /api/net and /api/org are used on PeeringDB', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    await app.addIX(IX.B.name);
    const calls = api.peeringdb.requests();
    expect(new Set(calls.map((r) => r.method))).toEqual(new Set(['GET']));
    expect(new Set(calls.map((r) => r.endpoint))).toEqual(new Set(['ix', 'netixlan', 'net', 'org']));
    expect(calls.every((r) => r.url.startsWith('https://www.peeringdb.com/api/'))).toBe(true);
  });

  test('RIPEstat is only asked for whois data by ASN', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    const calls = api.ripestat.requests();
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.method).toBe('GET');
      expect(call.url).toMatch(/^https:\/\/stat\.ripe\.net\/data\/whois\/data\.json\?resource=AS\d+$/);
    }
  });

  test('RIPEstat is not asked about the stub of a network missing from /net (ASN 0)', async ({ app, api }) => {
    await app.open();
    await app.addIX(IX.A.name);
    const asns = api.ripestat.requestedAsns();
    expect(asns.length).toBeGreaterThan(0);
    expect(asns).not.toContain('AS0');
    expect((await app.rows()).find((r) => r.name === `AS?? (net#${MISSING_NET_ID})`)).toMatchObject({ asn: '0', country: '—' });
  });

  test('requests carry the page origin ("null" from file://) and the fake PeeringDB echoes it', async ({ app, api, appMode }) => {
    await app.open();
    await app.addIX(IX.A.name);
    const origin = appMode === 'file' ? 'null' : 'https://ixpc.test';
    expect(new Set(api.requests().map((r) => r.origin))).toEqual(new Set([origin]));
  });

  test('the harness blocks and reports requests to unexpected hosts', async ({ app, api, page }) => {
    await app.open();
    const outcome = await page.evaluate(() => fetch('https://example.com/probe').then(() => 'loaded', (e) => e.name));
    expect(outcome).toBe('TypeError');
    expect(api.blocked).toEqual(['https://example.com/probe']);
    api.blocked.length = 0; // keep the fixture's own check green
  });

  test.describe('request budget and URL shapes today', { tag: '@request-budget' }, () => {
    test('a 2000-member IX costs 17 PeeringDB calls: 1 members + 8 networks + 8 organisations', async ({ app, api }) => {
      await app.open();
      await app.addIX(IX.C.name);
      const calls = api.peeringdb.requests().filter((r) => r.endpoint !== 'ix');
      expect(calls).toHaveLength(17);
      expect(api.peeringdb.requests('netixlan')).toHaveLength(1);
      const nets = api.peeringdb.requests('net');
      const orgs = api.peeringdb.requests('org');
      expect(nets).toHaveLength(8);
      expect(orgs).toHaveLength(8);
      expect(nets.every((r) => ids(r).length <= 250)).toBe(true);
      expect(orgs.every((r) => ids(r).length <= 250)).toBe(true);
      const netIds = nets.flatMap(ids);
      expect(netIds).toHaveLength(2000);
      expect(new Set(netIds).size).toBe(2000);
      expect(api.ripestat.requests()).toHaveLength(0);
    });

    test('a small IX costs 3 PeeringDB calls plus one RIPEstat call per network without country', async ({ app, api }) => {
      await app.open();
      await app.addIX(IX.A.name);
      const calls = api.peeringdb.requests();
      expect(calls.map((r) => r.endpoint)).toEqual(['ix', 'netixlan', 'net', 'org']);
      expect([...api.ripestat.requestedAsns()].sort()).toEqual(['AS64520', 'AS64521', 'AS64522', 'AS64523']);
      // calls are sequential, with a 150 ms pause after each response
      for (const [previous, next] of [[calls[1], calls[2]], [calls[2], calls[3]]]) {
        expect(next.startedAt - previous.startedAt).toBeGreaterThanOrEqual(150);
      }
    });

    test('URLs carry no fields= and no status filter; ids follow member order', async ({ app, api }) => {
      await app.open();
      await app.addIX(IX.A.name);
      const [catalog, members, nets, orgs] = api.peeringdb.requests();
      expect(catalog.search).toBe('');
      expect(members.search).toBe(`?ix_id=${IX.A.id}`);
      expect(Object.keys(nets.query)).toEqual(['id__in']);
      expect(ids(nets)).toEqual(A_NET_IDS);
      expect(Object.keys(orgs.query)).toEqual(['id__in']);
      expect(ids(orgs)).toEqual(A_ORG_IDS);
    });

    test('networks already known are not requested again for another IX', async ({ app, api }) => {
      await app.open();
      await app.addIX(IX.A.name);
      await app.addIX(IX.B.name);
      const [, forB] = api.peeringdb.requests('net');
      expect(ids(forB)).toEqual(['1101', '1102', '1103', '1104', '1105', '1106', '1107', '1108']);
    });
  });
});

test.describe('fake PeeringDB fidelity (Node only)', () => {
  test.skip(({ appMode }) => appMode === 'file', 'pure Node checks run in one project');

  const pdb = () => new FakePeeringDB(dataset.peeringdb);
  const get = (path) => pdb().respond(new URL(`https://www.peeringdb.com/api/${path}`));

  test('lists return every matching row in { data, meta } without paging', () => {
    const res = get(`netixlan?ix_id=${IX.C.id}`);
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({});
    expect(new Set(res.body.data.map((r) => r.net_id)).size).toBe(2000);
  });

  test('depth >= 1 truncates lists to 250 rows and says so in meta.truncated; depth=0 equals no depth', () => {
    for (const depth of [1, 2]) {
      const res = get(`netixlan?ix_id=${IX.C.id}&depth=${depth}`);
      expect(res.body.data).toHaveLength(DEPTH_ROW_LIMIT);
      expect(res.body.meta.truncated).toEqual(expect.any(String));
    }
    expect(get(`netixlan?ix_id=${IX.C.id}&depth=0`).body).toEqual(get(`netixlan?ix_id=${IX.C.id}`).body);
  });

  test('fields= keeps only the requested keys', () => {
    const { data } = get('net?id__in=1001,1002&fields=id,asn,policy_general').body;
    expect(data).toEqual([
      { id: 1001, asn: 64501, policy_general: 'Open' },
      { id: 1002, asn: 64502, policy_general: 'Selective' },
    ]);
  });

  test('status=ok filters the catalog; without it every status is returned', () => {
    expect(get('ix?status=ok').body.data).toHaveLength(CATALOG_OK_COUNT);
    expect(new Set(get('ix').body.data.map((r) => r.status))).toEqual(new Set(['ok', 'deleted', 'pending']));
  });

  test('id__in ignores unknown ids; single objects and unknown endpoints answer 404; unknown filters 400', () => {
    expect(get('net?id__in=1001,1028').body.data.map((r) => r.id)).toEqual([1001]);
    expect(get('org?id__in=23').body.data).toEqual([]);
    expect(get('net/1001').body.data).toHaveLength(1);
    expect(get('net/1028').status).toBe(404);
    expect(get('nope').status).toBe(404);
    expect(get('net?name__contains=alpha').status).toBe(400);
    expect(get(`ixfac?ix_id=${IX.A.id}`).body.data.map((r) => r.fac_id)).toEqual([501, 502]);
    expect(get('netfac?fac_id=501').body.data.map((r) => r.net_id)).toEqual([1001]);
  });

  test('CORS: PeeringDB echoes the Origin, RIPEstat allows any origin', () => {
    expect(pdb().corsHeaders('null')).toMatchObject({ 'access-control-allow-origin': 'null' });
    expect(new FakeRipestat({}).corsHeaders('null')).toEqual({ 'access-control-allow-origin': '*' });
  });

  test('RIPEstat answers country records per ASN and nothing for unknown ones', () => {
    const ripe = new FakeRipestat(dataset.ripestat);
    const records = (asn) => ripe.respond(new URL(`https://stat.ripe.net/data/whois/data.json?resource=AS${asn}`)).body.data.records;
    expect(records(64520)).toEqual([[{ key: 'country', value: 'BR' }]]);
    expect(records(64521)[0]).toContainEqual({ key: 'Country', value: ' de ' });
    expect(records(64522)).toEqual([]);
  });
});
