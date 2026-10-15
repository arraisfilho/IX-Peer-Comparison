// Deterministic synthetic data for the fake PeeringDB and RIPEstat services.
// Nothing here is real PeeringDB data: names are invented, ASNs come from the
// private/32-bit ranges and addresses from 100.64.0.0/10 and 2001:db8::/32.
// Changing a row changes literal expectations in the specs; prefer adding rows.

const created = '2020-01-01T00:00:00Z';
const updated = '2026-01-01T00:00:00Z';

/** IX handles used by the specs. */
export const IX = {
  A: { id: 101, name: 'Alpha-IX São Paulo' }, // 29 member nets, one of them missing from /net
  B: { id: 102, name: 'Beta-IX Rio de Janeiro' }, // 20 members, 12 shared with A
  C: { id: 103, name: 'Gamma-IX Frankfurt' }, // 2000 members (large IX)
  D: { id: 104, name: 'Delta-IX Amsterdam' },
  E: { id: 105, name: 'Epsilon-IX Greater London' },
  F: { id: 106, name: 'Zeta-IX Tokyo' },
  G: { id: 107, name: 'Kappa-IX' },
  H: { id: 108, name: 'Theta-IX Johannesburg' },
  I: { id: 109, name: 'Iota-IX Stockholm' },
  XSS: { id: 110, name: 'XSS <img src=x onerror="window.__xss=1"> "IX"' },
  PAYLOAD: { id: 111, name: 'Payload-IX' }, // members carry HTML in policy and country
  OMEGA: { id: 112, name: 'Omega Exchange São Paulo' },
  CAMPINAS: { id: 113, name: 'Campinas IX' },
  DEFUNCT: { id: 114, name: 'Defunct-IX São Paulo' }, // status 'deleted'
  PENDING: { id: 115, name: 'Pending-IX Lisbon' }, // status 'pending'
  LAMBDA: { id: 116, name: 'Lambda-IX' }, // null city/country/aka/net_count
  ZERO_SPEED: { id: 117, name: 'Mu-IX Curitiba' }, // ports with speed 0 or null (ARQ-13)
};

export const METRO_COUNT = 18;
export const metroName = (n) => `Metro-IX Springfield ${String(n).padStart(2, '0')}`;

// id, name, name_long, city, country, aka, net_count, status
const IX_TABLE = [
  [IX.A, 'Alpha Internet Exchange São Paulo', 'São Paulo', 'BR', 'AIX-SP', 29, 'ok'],
  [IX.B, 'Beta Internet Exchange Rio', 'Rio de Janeiro', 'BR', '', 20, 'ok'],
  [IX.C, 'Gamma Internet Exchange', 'Frankfurt', 'DE', '', 2000, 'ok'],
  [IX.D, '', 'Amsterdam', 'NL', '', 6, 'ok'],
  [IX.E, '', 'London', 'GB', '', 5, 'ok'],
  [IX.F, '', 'Tokyo', 'JP', '', 5, 'ok'],
  [IX.G, 'Kappa Exchange', 'Miami', 'US', '', 4, 'ok'],
  [IX.H, '', 'Johannesburg', 'ZA', '', 4, 'ok'],
  [IX.I, '', 'Stockholm', 'SE', 'Nordic Hub', 3, 'ok'],
  [IX.XSS, '', 'Testville', 'US', '', 2, 'ok'],
  [IX.PAYLOAD, '', 'Nowhere', 'US', '', 2, 'ok'],
  [IX.OMEGA, '', 'São Paulo', 'BR', '', 12, 'ok'],
  [IX.CAMPINAS, '', 'Campinas', 'BR', '', 7, 'ok'],
  [IX.DEFUNCT, '', 'São Paulo', 'BR', '', 3, 'deleted'],
  [IX.PENDING, '', 'Lisbon', 'PT', '', 0, 'pending'],
  [IX.LAMBDA, null, null, null, null, null, 'ok'],
  [IX.ZERO_SPEED, '', 'Curitiba', 'BR', '', 2, 'ok'],
];
for (let n = 1; n <= METRO_COUNT; n++) {
  IX_TABLE.push([{ id: 120 + n, name: metroName(n) }, '', 'Springfield', 'US', '', 1, 'ok']);
}

/** Number of IXes with status 'ok' (what the app lists). */
export const CATALOG_OK_COUNT = IX_TABLE.filter((row) => row[6] === 'ok').length;

// id, name, country
const ORG_TABLE = [
  [1, 'Alpha Group', 'BR'], [2, 'Bravo Holding', 'BR'], [3, 'Charlie SA', 'AR'],
  [4, 'Delta SpA', 'CL'], [5, 'Echo Inc', 'US'], [6, 'Foxtrot Ltd', 'CA'],
  [7, 'Golf SA de CV', 'MX'], [8, 'Hotel Corp', 'PA'], [9, 'India GmbH', 'DE'],
  [10, 'Juliett BV', 'NL'], [11, 'Kilo Ltd', 'GB'], [12, 'Lima SAS', 'FR'],
  [13, 'Mike KK', 'JP'], [14, 'November Pte', 'SG'], [15, 'Oscar Pty', 'ZA'],
  [16, 'Papa Ltd', 'KE'], [17, 'Quebec Pty', 'AU'], [18, 'Romeo Ltd', 'NZ'],
  [19, 'Sierra ApS', 'GL'], // GL is not in the app's country → continent table
  [20, 'Tango Org', ''], // no country: RIPEstat fills BR
  [22, 'Victor Org', null], // no country: RIPEstat has nothing
  // org 23 is referenced by net 1023 but missing from /org
  [24, 'Xray Org', 'BR'], [25, 'Ébano Org', 'BR'], [26, 'Yankee Inc', 'US'],
  [27, 'Zulu Org', 'BR'], [29, '3D Org', 'DE'],
  [101, 'Carioca Org', 'BR'], [102, 'Guanabara Org', 'BR'], [103, 'Niteroi Org', 'BR'],
  [104, 'Lisbon Org', 'PT'], [105, 'Madrid Org', 'ES'], [106, 'Bogota Org', 'CO'],
  [107, 'Lagos Org', 'NG'], [108, 'Seoul Org', 'KR'],
  [201, 'Amstel Org', 'NL'], [202, 'Dam Org', 'NL'], [203, 'Rotterdam Org', 'NL'],
  [204, 'Utrecht Org', 'NL'], [205, 'Thames Org', 'GB'], [206, 'Camden Org', 'GB'],
  [207, 'Soho Org', 'GB'], [208, 'Croydon Org', 'GB'], [209, 'Shibuya Org', 'JP'],
  [210, 'Ginza Org', 'JP'], [211, 'Akihabara Org', 'JP'], [212, 'Biscayne Org', 'US'],
  [213, 'Everglades Org', 'US'], [214, 'Soweto Org', 'ZA'], [215, 'Sandton Org', 'ZA'],
  [216, 'Gamla Org', 'SE'], [217, 'Södermalm Org', 'SE'], [218, 'Kista Org', 'SE'],
  [219, 'Testville Org', 'US'], [220, 'Testville Hosting Org', 'US'], [221, 'Payload Org', 'US'],
  [222, 'Payload Country Org', '<img src=x onerror="window.__xssCountry=1">'],
];

// id, name, asn, policy_general, org_id
const NET_TABLE = [
  [1001, 'Alpha Networks', 64501, 'Open', 1],
  [1002, 'Bravo Telecom', 64502, 'Selective', 2],
  [1003, 'Charlie Fibra', 64503, 'Restrictive', 3],
  [1004, 'Delta Cloud', 64504, ' selective ', 4],
  [1005, 'Echo Transit', 64505, 'No', 5],
  [1006, 'Foxtrot CDN', 64506, null, 6],
  [1007, 'Golf Hosting', 64507, '', 7],
  [1008, 'Hotel ISP', 64508, 'Case by case', 8],
  [1009, 'India Carrier', 64509, 'Open', 9],
  [1010, 'Juliett Mobile', 64510, 'Open', 10],
  [1011, 'Kilo Datacenter', 64511, 'Selective', 11],
  [1012, 'Lima Broadband', 64512, 'Restrictive', 12],
  [1013, 'Mike Online', 64513, 'Open', 13],
  [1014, 'November Net', 64514, 'Open', 14],
  [1015, 'Oscar Telecom', 64515, 'Selective', 15],
  [1016, 'Papa Wireless', 64516, 'Open', 16],
  [1017, 'Quebec Internet', 64517, 'Open', 17],
  [1018, 'Romeo Fiber', 64518, 'Selective', 18],
  [1019, 'Sierra Arctic', 64519, 'Open', 19],
  [1020, 'Tango Services', 64520, 'Open', 20],
  [1021, 'Uniform Labs', 64521, 'Open', null],
  [1022, 'Victor Systems', 64522, 'Open', 22],
  [1023, 'Whiskey Hosting', 64523, 'Open', 23],
  [1024, 'xray communications', 64524, 'Open', 24],
  [1025, 'Ébano Telecom', 64525, 'Open', 25],
  [1026, 'Yankee Transit', 64526, 'Restrictive', 26],
  [1027, 'Zulu Networks', 64527, 'Open', 27],
  // net 1028 is referenced by A's netixlan but missing from /net
  [1029, '3D Networks', 64529, 'Open', 29],
  [1030, 'Alpha Backup', 4200000001, 'Open', 1],
  [1031, 'Omicron Networks', 64531, 'Open', 27],
  [1101, 'Carioca Net', 64601, 'Open', 101],
  [1102, 'Guanabara Telecom', 64602, 'Selective', 102],
  [1103, 'Niteroi Fibra', 64603, 'Restrictive', 103],
  [1104, 'Lisbon Link', 64604, 'Open', 104],
  [1105, 'Madrid Carrier', 64605, 'Open', 105],
  [1106, 'Bogota Online', 64606, 'Selective', 106],
  [1107, 'Lagos Connect', 64607, 'Open', 107],
  [1108, 'Seoul Transit', 64608, 'Open', 108],
  [1201, 'Amstel Hosting', 64701, 'Open', 201],
  [1202, 'Dam Square Telecom', 64702, 'Selective', 202],
  [1203, 'Rotterdam Port Net', 64703, 'Open', 203],
  [1204, 'Utrecht Online', 64704, 'Restrictive', 204],
  [1205, 'Thames Transit', 64705, 'Open', 205],
  [1206, 'Camden Cloud', 64706, 'Open', 206],
  [1207, 'Soho Broadband', 64707, 'Selective', 207],
  [1208, 'Croydon Fibre', 64708, 'Open', 208],
  [1209, 'Shibuya Net', 64709, 'Open', 209],
  [1210, 'Ginza Telecom', 64710, 'Selective', 210],
  [1211, 'Akihabara Services', 64711, 'Open', 211],
  [1212, 'Biscayne Online', 64712, 'Open', 212],
  [1213, 'Everglades Carrier', 64713, 'Selective', 213],
  [1214, 'Soweto Connect', 64714, 'Open', 214],
  [1215, 'Sandton Cloud', 64715, 'Open', 215],
  [1216, 'Gamla Stan Net', 64716, 'Open', 216],
  [1217, 'Södermalm Fiber', 64717, 'Open', 217],
  [1218, 'Kista Hosting', 64718, 'Selective', 218],
  [1219, 'Testville Telecom', 64719, 'Open', 219],
  [1220, 'Testville Hosting', 64720, 'Open', 220],
  [1221, 'Policy Payload Net', 64721, '<img src=x onerror="window.__xssPolicy=1">', 221],
  [1222, 'Country Payload Net', 64722, 'Open', 222],
];

/** The net id that appears in A's member list but not in /net. */
export const MISSING_NET_ID = 1028;
const MISSING_NET_ASN = 64528;

// Large IX C: 5 nets shared with A and B, then generated members.
export const C_GENERATED = 1995;
const C_COUNTRIES = ['DE', 'NL', 'GB', 'FR', 'US', 'BR', 'JP', 'ZA', 'AU'];
const C_POLICIES = ['Open', 'Selective', 'Restrictive', 'Open'];
for (let i = 1; i <= C_GENERATED; i++) {
  const id = 20000 + i;
  NET_TABLE.push([id, `Gamma Member ${String(i).padStart(4, '0')}`, 100000 + i, C_POLICIES[i % 4], id]);
  ORG_TABLE.push([id, `Gamma Org ${i}`, C_COUNTRIES[i % C_COUNTRIES.length]]);
}

// ixId → [[netId, ...port speeds in Mbps]]
const MEMBERSHIP = {
  [IX.A.id]: [
    [1001, 10000], [1002, 1000], [1003, 100], [1004, 1500], [1005, 100000],
    [1006, 400000], [1007, 1000000], [1008, 10000],
    [1009, 1000, 100000], // two ports, larger one second
    [1010, 400000, 10000], // two ports, larger one first
    [1011, 10000], [1012, 10000], [1013, 10000], [1014, 10000], [1015, 10000],
    [1016, 10000], [1017, 10000], [1018, 10000], [1019, 10000], [1020, 10000],
    [1021, 10000], [1022, 10000], [1023, 10000], [1024, 10000], [1025, 10000],
    [1026, 10000],
    [MISSING_NET_ID, 1000],
    [1029, 10000], [1030, 10000],
  ],
  [IX.B.id]: [
    [1001, 1000], [1002, 10000], [1003, 10000], [1005, 10000], [1009, 10000],
    [1011, 10000], [1013, 10000], [1015, 10000], [1019, 10000], [1020, 10000],
    [1026, 10000], [1030, 100000],
    [1101, 10000], [1102, 10000], [1103, 10000], [1104, 10000], [1105, 10000],
    [1106, 10000], [1107, 10000], [1108, 10000],
  ],
  [IX.C.id]: [
    [1001, 100000], [1002, 100000], [1005, 100000], [1009, 100000], [1013, 100000],
    ...Array.from({ length: C_GENERATED }, (_, i) => [20001 + i, 10000]),
  ],
  [IX.D.id]: [[1009, 10000], [1010, 10000], [1201, 10000], [1202, 10000], [1203, 10000], [1204, 10000]],
  [IX.E.id]: [[1011, 10000], [1205, 10000], [1206, 10000], [1207, 10000], [1208, 10000]],
  [IX.F.id]: [[1013, 10000], [1014, 10000], [1209, 10000], [1210, 10000], [1211, 10000]],
  [IX.G.id]: [[1005, 10000], [1026, 10000], [1212, 10000], [1213, 10000]],
  [IX.H.id]: [[1015, 10000], [1016, 10000], [1214, 10000], [1215, 10000]],
  [IX.I.id]: [[1216, 10000], [1217, 10000], [1218, 10000]],
  [IX.XSS.id]: [[1219, 10000], [1220, 10000]],
  [IX.PAYLOAD.id]: [[1221, 10000], [1222, 10000]],
  [IX.ZERO_SPEED.id]: [
    [1027, 0], // only port has speed 0
    [1031, null], // only port has no speed
  ],
};

// ASN → country code or raw whois `records`.
const RIPESTAT = {
  64520: 'BR',
  64521: [[{ key: 'aut-num', value: 'AS64521' }, { key: 'Country', value: ' de ' }]],
  64523: [[{ key: 'as-name', value: 'WHISKEY' }], [{ key: 'country', value: 'US' }]],
};

function buildTables() {
  const ixRows = IX_TABLE.map(([{ id, name }, nameLong, city, country, aka, netCount, status]) => ({
    id, org_id: 9000 + id, name, aka, name_long: nameLong, city, country,
    region_continent: null, media: 'Ethernet', website: `https://ix${id}.example.net/`,
    net_count: netCount, fac_count: 1, status, created, updated,
  }));
  const ixName = new Map(ixRows.map((r) => [r.id, r.name]));

  const netRows = NET_TABLE.map(([id, name, asn, policy, orgId]) => ({
    id, org_id: orgId, name, aka: '', asn, irr_as_set: '', info_type: 'NSP',
    policy_general: policy, policy_url: '', website: '', status: 'ok', created, updated,
  }));
  const asnOf = new Map(netRows.map((n) => [n.id, n.asn]));

  const orgRows = ORG_TABLE.map(([id, name, country]) => ({
    id, name, country, city: '', website: '', status: 'ok', created, updated,
  }));

  const netixlan = [];
  for (const [ixId, members] of Object.entries(MEMBERSHIP)) {
    for (const [netId, ...speeds] of members) {
      for (const speed of speeds) {
        const n = netixlan.length;
        netixlan.push({
          id: 50000 + n, net_id: netId, ix_id: Number(ixId), ixlan_id: Number(ixId),
          name: ixName.get(Number(ixId)), asn: asnOf.get(netId) ?? MISSING_NET_ASN, speed,
          ipaddr4: `100.64.${Math.floor(n / 250)}.${(n % 250) + 1}`,
          ipaddr6: `2001:db8:${ixId}::${(n + 1).toString(16)}`,
          is_rs_peer: n % 2 === 0, operational: true, status: 'ok', created, updated,
        });
      }
    }
  }

  const ixfac = [
    { id: 701, ix_id: IX.A.id, fac_id: 501, name: 'Alpha DC One - São Paulo', city: 'São Paulo', country: 'BR', status: 'ok', created, updated },
    { id: 702, ix_id: IX.A.id, fac_id: 502, name: 'Alpha DC Two - São Paulo', city: 'São Paulo', country: 'BR', status: 'ok', created, updated },
  ];
  const netfac = [
    { id: 801, net_id: 1001, fac_id: 501, local_asn: 64501, name: 'Alpha DC One - São Paulo', city: 'São Paulo', country: 'BR', status: 'ok', created, updated },
    { id: 802, net_id: 1002, fac_id: 502, local_asn: 64502, name: 'Alpha DC Two - São Paulo', city: 'São Paulo', country: 'BR', status: 'ok', created, updated },
  ];

  return { ix: ixRows, net: netRows, org: orgRows, netixlan, ixfac, netfac };
}

export const dataset = deepFreeze({ peeringdb: buildTables(), ripestat: RIPESTAT });

/** A localStorage value for the app's catalog cache (`peercomp_ix_catalog`). */
export function catalogCache(entries, { ageMs = 0 } = {}) {
  return { ts: Date.now() - ageMs, data: entries };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
