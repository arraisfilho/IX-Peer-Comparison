// Country enrichment from RIPEstat (stat.ripe.net answers any origin).

import { RIPESTAT_CONCURRENCY, RIPESTAT_WHOIS_URL } from '../config.js';
import { validCC } from '../core/geo.js';

/** @import { Net } from '../types.js' */

/**
 * Looks up in RIPEstat whois, RIPESTAT_CONCURRENCY at a time, the networks of
 * `netIds` that PeeringDB gave no country. Stubs (ASN 0) are skipped and
 * failed lookups ignored. A country found for an ASN is given to every cached
 * network with that ASN still without one. Calls onDone when every lookup has
 * finished; not at all when there was nothing to look up.
 * @param {number[]} netIds
 * @param {Record<number, Net>} netCache
 * @param {{ onDone?: () => void }} [options]
 */
export async function enrichCountries(netIds, netCache, { onDone } = {}) {
  const missing = netIds
    .map((id) => netCache[id])
    .filter((n) => n && !n.country && n.asn > 0)
    .map((n) => n.asn);
  if (!missing.length) return;

  for (let i = 0; i < missing.length; i += RIPESTAT_CONCURRENCY) {
    const batch = missing.slice(i, i + RIPESTAT_CONCURRENCY);
    await Promise.all(
      batch.map(async (asn) => {
        try {
          const r = await fetch(`${RIPESTAT_WHOIS_URL}?resource=AS${asn}`);
          const cc = whoisCountry(await r.json());
          if (cc) {
            for (const net of Object.values(netCache)) {
              if (net.asn === asn && !net.country) net.country = cc;
            }
          }
        } catch {
          // lookups are best effort
        }
      }),
    );
  }
  onDone?.();
}

/**
 * The first "country" attribute of a whois answer that holds a valid ISO
 * code. A block whose first country attribute is invalid is skipped.
 * @param {any} d RIPEstat /data/whois/data.json body
 * @returns {string}
 */
function whoisCountry(d) {
  let cc = '';
  for (const block of d?.data?.records || []) {
    for (const rec of block) {
      if (rec.key?.trim().toLowerCase() === 'country') {
        cc = validCC(rec.value.trim().toUpperCase().slice(0, 2));
        break;
      }
    }
    if (cc) break;
  }
  return cc;
}
