// A small key-value store in IndexedDB (database "peercomp", store "kv").
// Values are also kept in memory for the session, so the app keeps working
// when IndexedDB is unavailable or fails (blocked storage, private mode).

const DB_NAME = 'peercomp';
const STORE = 'kv';

/** @type {Map<string, unknown>} */
const memory = new Map();
/** @type {Promise<IDBDatabase | null> | undefined} */
let opening;

/** The database, or null when IndexedDB cannot be used. */
function openDb() {
  opening ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/**
 * Runs one request on the store; null when IndexedDB is unavailable or the
 * request fails.
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest} makeRequest
 * @returns {Promise<unknown>}
 */
async function run(mode, makeRequest) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = makeRequest(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * The value stored under `key`, or undefined.
 * @param {string} key
 * @returns {Promise<unknown>}
 */
export async function kvGet(key) {
  if (memory.has(key)) return memory.get(key);
  return (await run('readonly', (store) => store.get(key))) ?? undefined;
}

/**
 * Stores `value` (structured-cloneable) under `key`; never throws.
 * @param {string} key
 * @param {unknown} value
 */
export async function kvSet(key, value) {
  memory.set(key, value);
  await run('readwrite', (store) => store.put(value, key));
}
