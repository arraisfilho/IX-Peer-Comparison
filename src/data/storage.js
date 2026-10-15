// localStorage access can throw (storage blocked, private mode, quota full):
// every read and write goes through these helpers, so the app runs without it.

/** @param {string} key */
export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not persisted
  }
}
