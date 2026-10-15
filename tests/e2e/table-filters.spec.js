import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';
import { A_TABLE } from './support/expected.js';

const A_COUNTRIES = [
  { value: 'all', label: 'Todos os países', selected: true },
  ...[
    ['ZA', '🇿🇦 África do Sul'], ['DE', '🇩🇪 Alemanha'], ['AR', '🇦🇷 Argentina'], ['AU', '🇦🇺 Austrália'],
    ['BR', '🇧🇷 Brasil'], ['CA', '🇨🇦 Canadá'], ['CL', '🇨🇱 Chile'], ['US', '🇺🇸 Estados Unidos'],
    ['FR', '🇫🇷 França'], ['GL', '🇬🇱 GL'], ['JP', '🇯🇵 Japão'], ['MX', '🇲🇽 MX'], ['NZ', '🇳🇿 Nova Zelândia'],
    ['NL', '🇳🇱 Países Baixos'], ['PA', '🇵🇦 Panamá'], ['KE', '🇰🇪 Quênia'], ['GB', '🇬🇧 Reino Unido'],
    ['SG', '🇸🇬 Singapura'],
  ].map(([value, name]) => ({ value, label: `${name} (${value})`, selected: false })),
];

async function openWith(app, ...ixes) {
  await app.open();
  for (const ix of ixes) await app.addIX(ix.name);
}

test.describe('comparison table', () => {
  test('one row per member: name, ASN, country, presence and policy with the fastest port', async ({ app }) => {
    await openWith(app, IX.A);
    expect(await app.headers()).toEqual(['Rede', 'ASN', 'País', 'Presença', IX.A.name]);
    expect(await app.table()).toEqual(A_TABLE);
    expect(await app.countLabel()).toBe('29 redes');
  });

  test('speeds are formatted in M/G/T and coloured by tier', async ({ app }) => {
    await openWith(app, IX.A);
    const tiers = Object.fromEntries((await app.rows()).map((r) => [r.cells[0].speed, r.cells[0].tier]));
    expect(tiers).toEqual({ '100M': 'lo', '1G': 'lo', '1.5G': 'lo', '10G': 'md', '100G': 'hi', '400G': 'hi', '1T': 'hi' });
  });

  test('the country cell shows flag and code with the Portuguese name as tooltip, or "—"', async ({ app }) => {
    await openWith(app, IX.A);
    const byName = Object.fromEntries((await app.rows()).map((r) => [r.name, r]));
    expect(byName['Alpha Networks']).toMatchObject({ country: 'BR', flag: '🇧🇷', countryName: 'Brasil' });
    expect(byName['Golf Hosting']).toMatchObject({ country: 'MX', flag: '🇲🇽', countryName: 'MX' });
    expect(byName['Sierra Arctic']).toMatchObject({ country: 'GL', flag: '🇬🇱', countryName: 'GL' });
    expect(byName['Victor Systems']).toMatchObject({ country: '—', flag: '', countryName: null });
    expect(byName['Alpha Networks'].nameTitle).toBe('Alpha Networks');
  });

  test('countries missing from PeeringDB are filled from RIPEstat after the IX has loaded', async ({ app, api }) => {
    await app.open();
    const whois = api.ripestat.hold((r) => r.query.resource === 'AS64520');
    await app.addIX(IX.A.name, { wait: false });
    await whois.reached();
    await app.waitUntilLoaded();
    const before = Object.fromEntries((await app.rows()).map((r) => [r.name, r.country]));
    expect([before['Tango Services'], before['Uniform Labs'], before['Whiskey Hosting']]).toEqual(['—', '—', '—']);

    whois.release();
    await app.settle();
    const after = Object.fromEntries((await app.rows()).map((r) => [r.name, r.country]));
    expect([after['Tango Services'], after['Uniform Labs'], after['Whiskey Hosting'], after['Victor Systems']])
      .toEqual(['BR', 'DE', 'US', '—']);
  });

  test('with two IXes each row has one presence dot and one cell per IX, "—" where absent', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    expect(await app.headers()).toEqual(['Rede', 'ASN', 'País', 'Presença', IX.A.name, IX.B.name]);
    const table = await app.table();
    expect(table).toHaveLength(37);
    expect(table).toEqual(expect.arrayContaining([
      'Alpha Networks\t64501\tBR\t●●\tOpen 10G\tOpen 1G',
      'Alpha Backup\t4200000001\tBR\t●●\tOpen 10G\tOpen 100G',
      'Bogota Online\t64606\tCO\t○●\t—\tSelective 10G',
      'Delta Cloud\t64504\tCL\t●○\tSelective 1.5G\t—',
    ]));
  });

  test('IX column headers use the IX colour', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    expect(await app.ixHeaderColors()).toEqual((await app.chips()).map((c) => c.color));
  });
});

test.describe('presence filter', () => {
  test('"Todos", "Em todos IXes" and one "Só X" per IX filter rows by presence', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    expect(await app.presenceFilters()).toEqual([
      { label: 'Todos', active: true },
      { label: 'Em todos IXes', active: false },
      { label: 'Só Alpha-IX São …', active: false },
      { label: 'Só Beta-IX Rio d…', active: false },
    ]);

    await app.setPresence('inAll');
    expect(await app.rowNames()).toEqual([
      'Alpha Backup', 'Alpha Networks', 'Bravo Telecom', 'Charlie Fibra', 'Echo Transit', 'India Carrier',
      'Kilo Datacenter', 'Mike Online', 'Oscar Telecom', 'Sierra Arctic', 'Tango Services', 'Yankee Transit',
    ]);
    expect(await app.countLabel()).toBe('12 redes');
    expect((await app.presenceFilters())[1].active).toBe(true);

    await app.setPresence('only', IX.A.name);
    expect(await app.rowNames()).toEqual([
      '3D Networks', 'AS?? (net#1028)', 'Delta Cloud', 'Foxtrot CDN', 'Golf Hosting', 'Hotel ISP', 'Juliett Mobile',
      'Lima Broadband', 'November Net', 'Papa Wireless', 'Quebec Internet', 'Romeo Fiber', 'Uniform Labs',
      'Victor Systems', 'Whiskey Hosting', 'xray communications', 'Ébano Telecom',
    ]);

    await app.setPresence('only', IX.B.name);
    expect(await app.rowNames()).toEqual([
      'Bogota Online', 'Carioca Net', 'Guanabara Telecom', 'Lagos Connect', 'Lisbon Link', 'Madrid Carrier',
      'Niteroi Fibra', 'Seoul Transit',
    ]);
    expect((await app.presenceFilters()).map((b) => b.active)).toEqual([false, false, false, true]);

    await app.setPresence('all');
    expect(await app.rows()).toHaveLength(37);
  });

  test('"Em todos IXes" is only offered with two or more IXes', async ({ app }) => {
    await openWith(app, IX.A);
    expect(await app.presenceFilters()).toEqual([
      { label: 'Todos', active: true },
      { label: 'Só Alpha-IX São …', active: false },
    ]);
  });

  test.fail('ARQ-05: removing the IX of the active "Só X" filter falls back to "Todos"', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    await app.setPresence('only', IX.A.name);
    await app.removeIX(IX.A.name);
    expect(await app.presenceFilters()).toEqual([
      { label: 'Todos', active: true },
      { label: 'Só Beta-IX Rio d…', active: false },
    ]);
    expect(await app.rows()).toHaveLength(20);
  });
});

test.describe('policy filter and network search', () => {
  test('policy buttons keep only networks with that normalized policy', async ({ app }) => {
    await openWith(app, IX.A);
    expect(await app.policyFilters()).toEqual([
      { label: 'Política: Todas', active: true },
      { label: 'Open', active: false },
      { label: 'Selective', active: false },
      { label: 'Restrictive', active: false },
    ]);

    await app.setPolicy('open');
    expect(await app.rowNames()).toEqual([
      '3D Networks', 'Alpha Backup', 'Alpha Networks', 'India Carrier', 'Juliett Mobile', 'Mike Online',
      'November Net', 'Papa Wireless', 'Quebec Internet', 'Sierra Arctic', 'Tango Services', 'Uniform Labs',
      'Victor Systems', 'Whiskey Hosting', 'xray communications', 'Ébano Telecom',
    ]);
    expect((await app.policyFilters()).map((b) => b.active)).toEqual([false, true, false, false]);

    await app.setPolicy('selective');
    expect(await app.rowNames()).toEqual(['Bravo Telecom', 'Delta Cloud', 'Kilo Datacenter', 'Oscar Telecom', 'Romeo Fiber']);

    await app.setPolicy('restrictive');
    expect(await app.rowNames()).toEqual(['Charlie Fibra', 'Lima Broadband', 'Yankee Transit']);
    expect(await app.countLabel()).toBe('3 redes');

    // "No", empty, unknown policies and stubs only show under "all"
    await app.setPolicy('all');
    expect(await app.rows()).toHaveLength(29);
  });

  test('network search matches a name or ASN substring, case-insensitively', async ({ app }) => {
    await openWith(app, IX.A);
    await app.searchNetworks('ALPHA');
    expect(await app.rowNames()).toEqual(['Alpha Backup', 'Alpha Networks']);
    await app.searchNetworks('6451');
    expect(await app.rowNames()).toEqual([
      'Juliett Mobile', 'Kilo Datacenter', 'Lima Broadband', 'Mike Online', 'November Net',
      'Oscar Telecom', 'Papa Wireless', 'Quebec Internet', 'Romeo Fiber', 'Sierra Arctic',
    ]);
    await app.searchNetworks('4200');
    expect(await app.rowNames()).toEqual(['Alpha Backup']);
    await app.searchNetworks('zzz');
    expect(await app.rows()).toEqual([]);
    expect(await app.tableMessage()).toBe('Nenhum resultado');
    expect(await app.countLabel()).toBe('0 redes');
    await app.searchNetworks('');
    expect(await app.rows()).toHaveLength(29);
  });
});

test.describe('continent and country filters', () => {
  test('continent buttons list only continents present in the filtered set, in a fixed order', async ({ app }) => {
    await openWith(app, IX.A);
    expect(await app.continents()).toEqual([
      { label: 'Todos', active: true },
      { label: 'América do Norte', active: false },
      { label: 'América Central', active: false },
      { label: 'América do Sul', active: false },
      { label: 'Europa', active: false },
      { label: 'Ásia', active: false },
      { label: 'África', active: false },
      { label: 'Oceania', active: false },
    ]);
    await app.setPolicy('restrictive'); // AR, FR, US
    expect((await app.continents()).map((c) => c.label)).toEqual(['Todos', 'América do Norte', 'América do Sul', 'Europa']);
  });

  test('a continent narrows the rows and the country list; unmapped countries only show under "Todos"', async ({ app }) => {
    await openWith(app, IX.A);
    await app.setContinent('Europa');
    expect(await app.rowNames()).toEqual(['3D Networks', 'India Carrier', 'Juliett Mobile', 'Kilo Datacenter', 'Lima Broadband', 'Uniform Labs']);
    expect((await app.continents()).find((c) => c.active).label).toBe('Europa');
    expect(await app.countryOptions()).toEqual([
      { value: 'all', label: 'Todos os países', selected: true },
      { value: 'DE', label: '🇩🇪 Alemanha (DE)', selected: false },
      { value: 'FR', label: '🇫🇷 França (FR)', selected: false },
      { value: 'NL', label: '🇳🇱 Países Baixos (NL)', selected: false },
      { value: 'GB', label: '🇬🇧 Reino Unido (GB)', selected: false },
    ]);
    // GL (not in the continent table) and networks without country are hidden by any continent
    await app.setContinent('América do Norte');
    expect(await app.rowNames()).toEqual(['Echo Transit', 'Foxtrot CDN', 'Whiskey Hosting', 'Yankee Transit']);
    await app.setContinent('Todos');
    expect(await app.rowNames()).toContain('Sierra Arctic');
    expect(await app.rows()).toHaveLength(29);
  });

  test('the country select lists "flag name (code)" sorted by the Portuguese name', async ({ app }) => {
    await openWith(app, IX.A);
    expect(await app.countryOptions()).toEqual(A_COUNTRIES);
    await app.setCountry('BR');
    expect(await app.rowNames()).toEqual(['Alpha Backup', 'Alpha Networks', 'Bravo Telecom', 'Tango Services', 'xray communications', 'Ébano Telecom']);
    expect(await app.selectedCountry()).toBe('BR');
  });

  test('switching to a continent that does not contain the selected country resets the country', async ({ app }) => {
    await openWith(app, IX.A);
    await app.setCountry('BR');
    await app.setContinent('Europa');
    expect(await app.selectedCountry()).toBe('all');
    expect(await app.rows()).toHaveLength(6);
    await app.setCountry('DE');
    await app.setContinent('Europa');
    expect(await app.selectedCountry()).toBe('DE');
    expect(await app.rowNames()).toEqual(['3D Networks', 'India Carrier', 'Uniform Labs']);
  });

  test('presence, policy, continent, country and search combine', async ({ app }) => {
    await openWith(app, IX.A, IX.B);
    await app.setPresence('inAll');
    await app.setPolicy('open');
    expect(await app.rowNames()).toEqual(['Alpha Backup', 'Alpha Networks', 'India Carrier', 'Mike Online', 'Sierra Arctic', 'Tango Services']);
    expect((await app.continents()).map((c) => c.label)).toEqual(['Todos', 'América do Sul', 'Europa', 'Ásia']);
    await app.setContinent('América do Sul');
    expect(await app.countryOptions()).toEqual([
      { value: 'all', label: 'Todos os países', selected: true },
      { value: 'BR', label: '🇧🇷 Brasil (BR)', selected: false },
    ]);
    await app.setCountry('BR');
    expect(await app.rowNames()).toEqual(['Alpha Backup', 'Alpha Networks', 'Tango Services']);
    await app.searchNetworks('alpha');
    expect(await app.rowNames()).toEqual(['Alpha Backup', 'Alpha Networks']);
    await app.searchNetworks('4200');
    expect(await app.table()).toEqual(['Alpha Backup\t4200000001\tBR\t●●\tOpen 10G\tOpen 100G']);
    expect(await app.countLabel()).toBe('1 redes');
  });

  test('the continent and country controls are not rebuilt while an IX is loading', async ({ app, api }) => {
    await openWith(app, IX.A);
    await app.setContinent('Europa');
    const nets = api.peeringdb.hold('net');
    await app.addIX(IX.B.name, { wait: false });
    await nets.reached();
    expect((await app.continents()).find((c) => c.active).label).toBe('Europa');
    expect((await app.countryOptions()).map((o) => o.value)).toEqual(['all', 'DE', 'FR', 'NL', 'GB']);
    nets.release();
    await app.settle();
    expect((await app.countryOptions()).map((o) => o.value)).toEqual(['all', 'DE', 'ES', 'FR', 'NL', 'PT', 'GB']);
  });

  test.fail('ARQ-06: a policy with no networks in the chosen country resets the country and lists that policy', async ({ app }) => {
    await openWith(app, IX.A);
    await app.setCountry('BR');
    await app.setPolicy('restrictive'); // no restrictive network in BR
    expect(await app.selectedCountry()).toBe('all');
    expect(await app.rowNames()).toEqual(['Charlie Fibra', 'Lima Broadband', 'Yankee Transit']);
  });
});

test.fail('ARQ-13: a member whose only port has speed 0 is listed with "—" as speed', async ({ app }) => {
  await openWith(app, IX.A);
  const zulu = (await app.rows()).find((r) => r.name === 'Zulu Networks');
  expect(zulu).toBeDefined();
  expect(zulu.cells[0].speed).toBe('—');
});
