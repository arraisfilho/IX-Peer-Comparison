// PeeringDB API client: sequential GETs with HTTP 429 handling.
//
// PeeringDB rate-limits anonymous clients with HTTP 429. On a 429 the call
// waits Retry-After + 2 s and tries again, up to API_MAX_ATTEMPTS requests in
// total. Retry-After is only readable when the response exposes it
// (Access-Control-Expose-Headers); otherwise retryAfterSec() falls back to 30 s.
// Other HTTP errors and network errors are not retried.
//
// The depth parameter is never sent: with depth >= 1 PeeringDB truncates list
// results to 250 rows, without it a list comes whole in one response.

import { API_BASE, API_DELAY_MS, API_MAX_ATTEMPTS } from '../config.js';
import { retryAfterSec } from '../core/retry.js';
import { t } from '../i18n/index.js';

/**
 * @typedef {object} ApiOptions
 * @property {AbortSignal} [signal] cancels the request and any wait before a retry
 * @property {(seconds: number) => void} [onRateLimit] HTTP 429: called with the
 *   wait in seconds before the next attempt
 * @property {() => void} [onGiveUp] HTTP 429 on the last attempt: called just
 *   before the call fails
 */

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * GET API_BASE + path and return the parsed JSON body.
 * @param {string} path
 * @param {ApiOptions} [options]
 * @returns {Promise<any>}
 */
export async function api(path, { signal, onRateLimit, onGiveUp } = {}) {
  let attempt = 0;
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let r;
    try {
      r = await fetch(API_BASE + path, signal ? { signal } : undefined);
    } catch (e) {
      const error = /** @type {Error} */ (e);
      if (error.name === 'AbortError') throw error;
      throw new Error(`${t('error_net')}: ${error.message}`);
    }

    if (r.status === 429) {
      attempt++;
      if (attempt >= API_MAX_ATTEMPTS) {
        onGiveUp?.();
        throw new Error(`HTTP ${r.status}`);
      }
      const retryAfter = retryAfterSec(r.headers.get('retry-after'));
      const waitMs = (retryAfter + 2) * 1000;
      onRateLimit?.(retryAfter + 2);
      // Sleep in steps of at most 1 s so that an abort ends the wait early
      const end = Date.now() + waitMs;
      while (Date.now() < end) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await sleep(Math.min(1000, end - Date.now()));
      }
      continue;
    }

    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (API_DELAY_MS > 0) await sleep(API_DELAY_MS);
    return r.json();
  }
}
