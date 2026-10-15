import { test, expect } from './support/fixtures.js';
import { IX } from '../fixtures/dataset.js';
import { A_NAMES } from './support/expected.js';

const BY_ASN = [
  ['AS?? (net#1028)', '0'], ['Alpha Networks', '64501'], ['Bravo Telecom', '64502'], ['Charlie Fibra', '64503'],
  ['Delta Cloud', '64504'], ['Echo Transit', '64505'], ['Foxtrot CDN', '64506'], ['Golf Hosting', '64507'],
  ['Hotel ISP', '64508'], ['India Carrier', '64509'], ['Juliett Mobile', '64510'], ['Kilo Datacenter', '64511'],
  ['Lima Broadband', '64512'], ['Mike Online', '64513'], ['November Net', '64514'], ['Oscar Telecom', '64515'],
  ['Papa Wireless', '64516'], ['Quebec Internet', '64517'], ['Romeo Fiber', '64518'], ['Sierra Arctic', '64519'],
  ['Tango Services', '64520'], ['Uniform Labs', '64521'], ['Victor Systems', '64522'], ['Whiskey Hosting', '64523'],
  ['xray communications', '64524'], ['Ébano Telecom', '64525'], ['Yankee Transit', '64526'], ['3D Networks', '64529'],
  ['Alpha Backup', '4200000001'],
];

// Countries compare by Portuguese name with < and >: no country first, accented
// initials ('África do Sul') after Z, and 'Panamá' before 'Países Baixos'.
const BY_COUNTRY = [
  '—', '—', 'DE', 'DE', 'DE', 'AR', 'AU', 'BR', 'BR', 'BR', 'BR', 'BR', 'BR', 'CA', 'CL', 'US', 'US', 'US',
  'FR', 'GL', 'JP', 'MX', 'NZ', 'PA', 'NL', 'KE', 'GB', 'SG', 'ZA',
];

const reversed = (list) => [...list].reverse();
const columns = async (app) => (await app.rows()).map((r) => [r.name, r.asn, r.country]);

test.describe('sorting', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.addIX(IX.A.name);
  });

  test('defaults to network name ascending, case-insensitive, accented initials last', async ({ app }) => {
    expect(await app.sortState()).toEqual({ column: 'name', direction: 'asc' });
    expect(await app.rowNames()).toEqual(A_NAMES);
  });

  test('clicking the active column toggles the direction', async ({ app }) => {
    await app.sortBy('name');
    expect(await app.sortState()).toEqual({ column: 'name', direction: 'desc' });
    expect(await app.rowNames()).toEqual(reversed(A_NAMES));
    await app.sortBy('name');
    expect(await app.sortState()).toEqual({ column: 'name', direction: 'asc' });
    expect(await app.rowNames()).toEqual(A_NAMES);
  });

  test('ASN sorts numerically, ascending first', async ({ app }) => {
    await app.sortBy('asn');
    expect(await app.sortState()).toEqual({ column: 'asn', direction: 'asc' });
    expect((await columns(app)).map(([name, asn]) => [name, asn])).toEqual(BY_ASN);
    await app.sortBy('asn');
    expect((await columns(app)).map(([name, asn]) => [name, asn])).toEqual(reversed(BY_ASN));
  });

  test('country sorts by the Portuguese country name with plain string comparison', async ({ app }) => {
    await app.sortBy('country');
    expect(await app.sortState()).toEqual({ column: 'country', direction: 'asc' });
    expect((await columns(app)).map(([, , country]) => country)).toEqual(BY_COUNTRY);
    await app.sortBy('country');
    expect((await columns(app)).map(([, , country]) => country)).toEqual(reversed(BY_COUNTRY));
  });

  test('ties keep member order in both directions (no secondary key)', async ({ app }) => {
    const brazil = async () => (await columns(app)).filter(([, , c]) => c === 'BR').map(([name]) => name);
    const memberOrder = ['Alpha Networks', 'Bravo Telecom', 'Tango Services', 'xray communications', 'Ébano Telecom', 'Alpha Backup'];
    await app.sortBy('country');
    expect(await brazil()).toEqual(memberOrder);
    await app.sortBy('country');
    expect(await brazil()).toEqual(memberOrder);
  });

  test('switching to another column starts ascending', async ({ app }) => {
    await app.sortBy('name'); // name desc
    await app.sortBy('asn');
    expect(await app.sortState()).toEqual({ column: 'asn', direction: 'asc' });
  });

  test('the sort survives filter changes and language switches', async ({ app }) => {
    await app.sortBy('asn');
    await app.sortBy('asn');
    await app.setPolicy('restrictive');
    expect(await app.rowNames()).toEqual(['Yankee Transit', 'Lima Broadband', 'Charlie Fibra']);
    await app.setLang('en');
    expect(await app.sortState()).toEqual({ column: 'asn', direction: 'desc' });
    expect(await app.rowNames()).toEqual(['Yankee Transit', 'Lima Broadband', 'Charlie Fibra']);
  });
});
