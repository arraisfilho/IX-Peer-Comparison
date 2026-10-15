// How the current app renders the synthetic dataset. Shared by several specs.

// IX A alone, default sort (name ascending): name, ASN, country, presence, policy + speed.
export const A_TABLE = [
  '3D Networks\t64529\tDE\t●\tOpen 10G',
  'Alpha Backup\t4200000001\tBR\t●\tOpen 10G',
  'Alpha Networks\t64501\tBR\t●\tOpen 10G',
  'AS?? (net#1028)\t0\t—\t●\t1G', // referenced by netixlan, missing from /net
  'Bravo Telecom\t64502\tBR\t●\tSelective 1G',
  'Charlie Fibra\t64503\tAR\t●\tRestrictive 100M',
  'Delta Cloud\t64504\tCL\t●\tSelective 1.5G', // ' selective '
  'Echo Transit\t64505\tUS\t●\tNo 100G',
  'Foxtrot CDN\t64506\tCA\t●\t400G', // policy null
  'Golf Hosting\t64507\tMX\t●\t1T', // policy ''
  'Hotel ISP\t64508\tPA\t●\tCase by case 10G',
  'India Carrier\t64509\tDE\t●\tOpen 100G', // ports 1G + 100G
  'Juliett Mobile\t64510\tNL\t●\tOpen 400G', // ports 400G + 10G
  'Kilo Datacenter\t64511\tGB\t●\tSelective 10G',
  'Lima Broadband\t64512\tFR\t●\tRestrictive 10G',
  'Mike Online\t64513\tJP\t●\tOpen 10G',
  'November Net\t64514\tSG\t●\tOpen 10G',
  'Oscar Telecom\t64515\tZA\t●\tSelective 10G',
  'Papa Wireless\t64516\tKE\t●\tOpen 10G',
  'Quebec Internet\t64517\tAU\t●\tOpen 10G',
  'Romeo Fiber\t64518\tNZ\t●\tSelective 10G',
  'Sierra Arctic\t64519\tGL\t●\tOpen 10G',
  'Tango Services\t64520\tBR\t●\tOpen 10G', // country from RIPEstat
  'Uniform Labs\t64521\tDE\t●\tOpen 10G', // no org, country from RIPEstat
  'Victor Systems\t64522\t—\t●\tOpen 10G', // no country anywhere
  'Whiskey Hosting\t64523\tUS\t●\tOpen 10G', // org missing, country from RIPEstat
  'xray communications\t64524\tBR\t●\tOpen 10G',
  'Yankee Transit\t64526\tUS\t●\tRestrictive 10G',
  'Ébano Telecom\t64525\tBR\t●\tOpen 10G',
];

export const A_NAMES = A_TABLE.map((line) => line.split('\t')[0]);

/** ASNs of IX A as exported with the "Todos" filter (stub with ASN 0 left out). */
export const A_ASNS = [
  ...Array.from({ length: 26 }, (_, i) => String(64501 + i)),
  '64529',
  '4200000001',
];

/** ASNs of the networks present at both A and B. */
export const AB_SHARED_ASNS = [
  '64501', '64502', '64503', '64505', '64509', '64511', '64513', '64515', '64519', '64520', '64526', '4200000001',
];

/** ASNs of the networks only present at A when A and B are loaded. */
export const A_ONLY_ASNS = [
  '64504', '64506', '64507', '64508', '64510', '64512', '64514', '64516', '64517', '64518',
  '64521', '64522', '64523', '64524', '64525', '64529',
];

/** Export file body: one ASN per line, a comma after every line but the last. */
export const exportBody = (asns) => asns.map((asn, i) => (i < asns.length - 1 ? `${asn},` : asn)).join('\n');
