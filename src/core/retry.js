// HTTP 429 handling. Pure: no DOM, no network, no app state.

/**
 * Seconds to wait according to a Retry-After header, which holds either
 * delta-seconds or an HTTP-date. Absent, invalid or negative → 30.
 * @param {string | null | undefined} value
 * @param {number} [now] current time in ms
 */
export function retryAfterSec(value, now = Date.now()) {
  const v = (value || '').trim();
  const sec = /^\d+$/.test(v) ? Number.parseInt(v, 10) : Math.ceil((Date.parse(v) - now) / 1000);
  return sec >= 0 ? sec : 30;
}
