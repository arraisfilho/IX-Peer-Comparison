// Shapes of the main data objects. JSDoc only: nothing here exists at runtime.

/**
 * An IX of the catalog, reduced to the fields the app uses. This is also the
 * shape cached in localStorage.
 * @typedef {object} CatalogEntry
 * @property {number} id PeeringDB ix id
 * @property {string} name
 * @property {string} name_long
 * @property {string} city
 * @property {string} country
 * @property {number} net_count
 * @property {string} aka
 */

/**
 * A network, from PeeringDB /net, with the country of its organisation.
 * @typedef {object} Net
 * @property {string} name
 * @property {number} asn 0 for a network missing from /net (stub)
 * @property {string | null} policy general peering policy, normalized by normPolicy()
 * @property {number | null} org_id
 * @property {string} country ISO 3166 alpha-2 code, or '' while unknown
 */

/**
 * An IX being compared.
 * @typedef {object} SelectedIx
 * @property {number} id PeeringDB ix id
 * @property {string} name
 * @property {number} ci palette index
 * @property {Map<number, number>} members net id → fastest port in Mbit/s (0 if
 *   unknown); stays empty until the networks of the IX have loaded
 * @property {boolean} loading
 * @property {boolean} error
 * @property {string} errorMsg
 * @property {number} progress 0–100
 * @property {string} progressLabel
 * @property {number | null} cacheAge minutes since the member list was fetched;
 *   null while loading and after a failure
 * @property {number} loadStart Date.now() when the IX was added
 * @property {number} loadElapsed seconds
 * @property {AbortController} controller aborted when the IX is removed
 */

/**
 * @typedef {object} MembersCacheEntry
 * @property {Map<number, number>} members net id → fastest port in Mbit/s
 * @property {number} ts Date.now() when fetched
 */

/** @typedef {'name' | 'asn' | 'country'} SortColumn */

/**
 * @typedef {object} PaletteColor
 * @property {string} main text and dot colour
 * @property {string} bg background
 * @property {string} bdr border
 */

// PeeringDB API rows, as far as the app reads them.

/**
 * @typedef {object} PdbIx
 * @property {number} id
 * @property {string | null} name
 * @property {string | null} name_long
 * @property {string | null} city
 * @property {string | null} country
 * @property {number | null} net_count
 * @property {string | null} aka
 * @property {string} status
 */

/**
 * @typedef {object} PdbNetixlan
 * @property {number} net_id
 * @property {number | null} speed Mbit/s
 */

/**
 * @typedef {object} PdbNet
 * @property {number} id
 * @property {string} name
 * @property {number} asn
 * @property {string | null} policy_general
 * @property {number | null} org_id
 */

/**
 * @typedef {object} PdbOrg
 * @property {number} id
 * @property {unknown} country
 */

/**
 * @template T
 * @typedef {object} PdbList
 * @property {T[]} [data]
 */

export {};
