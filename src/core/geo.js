// Countries and continents. Pure: no DOM, no network, no app state.

/**
 * Continent code (NA, CA, SA, EU, AS, AF, OC) by ISO 3166 alpha-2 country code.
 * CA groups Central America and the Caribbean.
 * @type {Record<string, string>}
 */
// biome-ignore format: compact lookup table
export const CC2CONT = {
  US:'NA',CA:'NA',BM:'NA',
  MX:'CA',GT:'CA',BZ:'CA',SV:'CA',HN:'CA',NI:'CA',CR:'CA',PA:'CA',
  CU:'CA',JM:'CA',HT:'CA',DO:'CA',PR:'CA',TT:'CA',BB:'CA',LC:'CA',VC:'CA',GD:'CA',
  AG:'CA',DM:'CA',KN:'CA',BS:'CA',TC:'CA',KY:'CA',VG:'CA',VI:'CA',AW:'CA',CW:'CA',SX:'CA',MQ:'CA',GF:'CA',
  BR:'SA',AR:'SA',CL:'SA',CO:'SA',VE:'SA',PE:'SA',EC:'SA',BO:'SA',PY:'SA',UY:'SA',
  GY:'SA',SR:'SA',FK:'SA',
  GB:'EU',DE:'EU',FR:'EU',NL:'EU',IT:'EU',ES:'EU',PL:'EU',SE:'EU',NO:'EU',DK:'EU',
  FI:'EU',CH:'EU',AT:'EU',BE:'EU',PT:'EU',IE:'EU',CZ:'EU',SK:'EU',HU:'EU',RO:'EU',
  BG:'EU',HR:'EU',SI:'EU',RS:'EU',BA:'EU',MK:'EU',AL:'EU',ME:'EU',XK:'EU',GR:'EU',
  CY:'EU',MT:'EU',LU:'EU',LI:'EU',MC:'EU',AD:'EU',SM:'EU',EE:'EU',LV:'EU',LT:'EU',
  BY:'EU',UA:'EU',MD:'EU',RU:'EU',IS:'EU',GI:'EU',
  CN:'AS',JP:'AS',IN:'AS',KR:'AS',SG:'AS',HK:'AS',TW:'AS',TH:'AS',MY:'AS',ID:'AS',
  PH:'AS',VN:'AS',BD:'AS',PK:'AS',LK:'AS',NP:'AS',MM:'AS',KH:'AS',LA:'AS',BN:'AS',
  MN:'AS',KZ:'AS',UZ:'AS',TM:'AS',TJ:'AS',KG:'AS',AZ:'AS',GE:'AS',AM:'AS',TR:'AS',
  IL:'AS',SA:'AS',AE:'AS',QA:'AS',KW:'AS',BH:'AS',OM:'AS',YE:'AS',JO:'AS',LB:'AS',
  SY:'AS',IQ:'AS',IR:'AS',AF:'AS',MO:'AS',
  ZA:'AF',NG:'AF',KE:'AF',EG:'AF',ET:'AF',GH:'AF',TZ:'AF',UG:'AF',RW:'AF',ZM:'AF',
  ZW:'AF',MZ:'AF',BW:'AF',MG:'AF',MU:'AF',SC:'AF',CM:'AF',CI:'AF',SN:'AF',GN:'AF',
  ML:'AF',BF:'AF',NE:'AF',TD:'AF',SD:'AF',SO:'AF',DJ:'AF',ER:'AF',MA:'AF',TN:'AF',
  DZ:'AF',LY:'AF',AO:'AF',CG:'AF',CD:'AF',GA:'AF',GQ:'AF',
  AU:'OC',NZ:'OC',PG:'OC',FJ:'OC',SB:'OC',VU:'OC',WS:'OC',TO:'OC',KI:'OC',
  PW:'OC',MH:'OC',FM:'OC',NR:'OC',TV:'OC',
};

/** Order of the continent filter buttons. */
export const CONT_ORDER = ['NA', 'CA', 'SA', 'EU', 'AS', 'AF', 'OC'];

/**
 * Portuguese country names by ISO 3166 alpha-2 code.
 * @type {Record<string, string>}
 */
// biome-ignore format: compact lookup table
export const CC_NAMES = {
  AD:'Andorra',AE:'Emirados Árabes',AF:'Afeganistão',AG:'Antígua e Barbuda',AL:'Albânia',
  AM:'Armênia',AO:'Angola',AR:'Argentina',AT:'Áustria',AU:'Austrália',AW:'Aruba',AZ:'Azerbaijão',
  BA:'Bósnia-Herzegovina',BB:'Barbados',BD:'Bangladesh',BE:'Bélgica',BF:'Burkina Faso',
  BG:'Bulgária',BH:'Bahrein',BM:'Bermuda',BN:'Brunei',BO:'Bolívia',BR:'Brasil',BS:'Bahamas',
  BW:'Botsuana',BY:'Bielorrússia',BZ:'Belize',CA:'Canadá',CD:'Congo (RDC)',CG:'Congo',
  CH:'Suíça',CI:'Costa do Marfim',CL:'Chile',CM:'Camarões',CN:'China',CO:'Colômbia',
  CR:'Costa Rica',CU:'Cuba',CW:'Curaçao',CY:'Chipre',CZ:'Tchéquia',DE:'Alemanha',
  DJ:'Djibuti',DK:'Dinamarca',DM:'Dominica',DO:'Rep. Dominicana',DZ:'Argélia',
  EC:'Equador',EE:'Estônia',EG:'Egito',ER:'Eritreia',ES:'Espanha',ET:'Etiópia',
  FI:'Finlândia',FJ:'Fiji',FK:'Ilhas Malvinas',FM:'Micronésia',FR:'França',
  GA:'Gabão',GB:'Reino Unido',GD:'Granada',GE:'Geórgia',GF:'Guiana Francesa',GH:'Gana',
  GI:'Gibraltar',GN:'Guiné',GQ:'Guiné Equatorial',GR:'Grécia',GT:'Guatemala',GY:'Guiana',
  HK:'Hong Kong',HN:'Honduras',HR:'Croácia',HT:'Haiti',HU:'Hungria',ID:'Indonésia',
  IE:'Irlanda',IL:'Israel',IN:'Índia',IQ:'Iraque',IR:'Irã',IS:'Islândia',IT:'Itália',
  JM:'Jamaica',JO:'Jordânia',JP:'Japão',KE:'Quênia',KG:'Quirguistão',KH:'Camboja',
  KI:'Quiribati',KN:'São Cristóvão',KR:'Coreia do Sul',KW:'Kuwait',KY:'Ilhas Cayman',
  KZ:'Cazaquistão',LA:'Laos',LB:'Líbano',LC:'Santa Lúcia',LI:'Liechtenstein',LK:'Sri Lanka',
  LT:'Lituânia',LU:'Luxemburgo',LV:'Letônia',LY:'Líbia',MA:'Marrocos',MC:'Mônaco',
  MD:'Moldávia',ME:'Montenegro',MG:'Madagascar',MH:'Ilhas Marshall',MK:'Macedônia do Norte',
  ML:'Mali',MM:'Mianmar',MN:'Mongólia',MO:'Macau',MT:'Malta',MU:'Maurício',MZ:'Moçambique',
  NA:'Namíbia',NE:'Níger',NG:'Nigéria',NI:'Nicarágua',NL:'Países Baixos',NO:'Noruega',
  NP:'Nepal',NR:'Nauru',NZ:'Nova Zelândia',OM:'Omã',PA:'Panamá',PE:'Peru',PG:'Papua N. Guiné',
  PH:'Filipinas',PK:'Paquistão',PL:'Polônia',PR:'Porto Rico',PT:'Portugal',PW:'Palau',
  PY:'Paraguai',QA:'Catar',RO:'Romênia',RS:'Sérvia',RU:'Rússia',RW:'Ruanda',SA:'Arábia Saudita',
  SB:'Ilhas Salomão',SC:'Seicheles',SD:'Sudão',SE:'Suécia',SG:'Singapura',SI:'Eslovênia',
  SK:'Eslováquia',SM:'San Marino',SN:'Senegal',SO:'Somália',SR:'Suriname',SV:'El Salvador',
  SY:'Síria',TC:'Turks e Caicos',TD:'Chade',TJ:'Tajiquistão',TH:'Tailândia',TM:'Turcomenistão',
  TN:'Tunísia',TO:'Tonga',TR:'Turquia',TT:'Trinidad e Tobago',TV:'Tuvalu',TW:'Taiwan',
  TZ:'Tanzânia',UA:'Ucrânia',UG:'Uganda',US:'Estados Unidos',UY:'Uruguai',UZ:'Uzbequistão',
  VA:'Vaticano',VC:'São Vicente',VE:'Venezuela',VG:'Ilhas Virgens Brit.',VI:'Ilhas Virgens EUA',
  VN:'Vietnã',VU:'Vanuatu',WS:'Samoa',XK:'Kosovo',YE:'Iêmen',ZA:'África do Sul',
  ZM:'Zâmbia',ZW:'Zimbábue',
};

/**
 * Flag emoji of a two-letter country code; '' for anything else.
 * @param {string | null | undefined} cc
 */
export function flag(cc) {
  if (cc?.length !== 2) return '';
  const o = 0x1f1e6 - 65;
  return String.fromCodePoint(cc.charCodeAt(0) + o) + String.fromCodePoint(cc.charCodeAt(1) + o);
}

/**
 * Continent code of a country; '??' when unknown or missing.
 * @param {string | null | undefined} cc
 */
export function getCont(cc) {
  return CC2CONT[cc ?? ''] || '??';
}

/**
 * Portuguese name of a country, or the code itself when unknown.
 * @param {string} cc
 */
export function ccName(cc) {
  return CC_NAMES[cc] || cc;
}

/**
 * Country codes from /org and RIPEstat are kept only if they look like
 * ISO 3166 alpha-2 (two capital letters); anything else becomes ''.
 * @param {unknown} cc
 */
export function validCC(cc) {
  return typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) ? cc : '';
}
