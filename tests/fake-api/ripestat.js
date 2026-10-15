// Fake RIPEstat whois endpoint:
//   GET https://stat.ripe.net/data/whois/data.json?resource=AS<asn>
// Answers from a per-ASN map whose values are either a country code (served as
// [[{ key: 'country', value }]]) or a raw `records` array. Unknown ASNs get no
// records. RIPEstat sends `access-control-allow-origin: *`.

import { FakeService } from './service.js';

export class FakeRipestat extends FakeService {
  constructor(countriesByAsn, options = {}) {
    super({ name: 'ripestat', ...options });
    this.countriesByAsn = countriesByAsn;
  }

  handles(url) {
    return url.hostname === 'stat.ripe.net';
  }

  endpointOf(url) {
    return url.pathname === '/data/whois/data.json' ? 'whois' : url.pathname;
  }

  corsHeaders() {
    return { 'access-control-allow-origin': '*' };
  }

  /** ASN numbers requested so far, in request order. */
  requestedAsns() {
    return this.requests('whois').map((entry) => entry.query.resource);
  }

  respond(url) {
    if (url.pathname !== '/data/whois/data.json') {
      return { status: 404, headers: {}, body: { status: 'error', messages: [['error', 'Not found']] } };
    }
    const resource = url.searchParams.get('resource') ?? '';
    const asn = resource.replace(/^AS/i, '');
    const known = this.countriesByAsn[asn];
    const records = known === undefined ? [] : typeof known === 'string' ? [[{ key: 'country', value: known }]] : known;
    return {
      status: 200,
      headers: {},
      body: { status: 'ok', data: { resource: asn, records, irr_records: [] } },
    };
  }
}
