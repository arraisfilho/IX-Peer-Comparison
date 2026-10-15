// When to retry a PeeringDB request and how long to wait before sending one.
// Pure: no DOM, no network, no app state.

import { API_BACKOFF_MS } from '../config.js';

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

/**
 * HTTP statuses retried after a backoff (gateway errors). 429 has its own
 * wait; any other error status fails at once.
 * @param {number} status
 */
export function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Wait before retrying after the `failures`-th failed attempt (1, 2, 3…):
 * API_BACKOFF_MS doubled on each failure (2 s, 4 s, 8 s), plus up to 25 %
 * of random jitter so that clients do not retry in step.
 * @param {number} failures
 * @param {number} [random] in [0, 1)
 */
export function backoffMs(failures, random = Math.random()) {
  return Math.round(API_BACKOFF_MS * 2 ** (failures - 1) * (1 + 0.25 * random));
}

/**
 * The send times of `times` still inside the sliding window ending at `now`,
 * oldest first. Times in the future (clock moved back) are dropped.
 * @param {readonly number[]} times
 * @param {number} now
 * @param {number} windowMs
 */
export function inWindow(times, now, windowMs) {
  return times.filter((ts) => ts > now - windowMs && ts <= now).sort((a, b) => a - b);
}

/**
 * How long to wait before sending one more request so that no `windowMs`
 * period holds more than `max` of them: 0 while the window has room,
 * otherwise until enough of the oldest sends have left it.
 * @param {readonly number[]} times send times
 * @param {number} now
 * @param {number} max
 * @param {number} windowMs
 */
export function windowWaitMs(times, now, max, windowMs) {
  const recent = inWindow(times, now, windowMs);
  return recent.length < max ? 0 : recent[recent.length - max] + windowMs - now;
}
