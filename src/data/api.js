// PeeringDB API client. Every PeeringDB call goes through api(), which runs
// them one at a time from a single queue:
//   - API_DELAY_MS between the end of a response and the next request;
//   - at most API_WINDOW_MAX requests in any API_WINDOW_MS (sliding window,
//     kept in localStorage so that a reload does not reset it);
//   - HTTP 429 pauses the whole queue for Retry-After + 2 s, Retry-After capped
//     at 120 s. Retry-After is only readable when the response exposes it
//     (Access-Control-Expose-Headers, which PeeringDB does not send); otherwise
//     retryAfterSec() falls back to 30 s;
//   - HTTP 502/503/504, network errors, timeouts (API_TIMEOUT_MS) and 200
//     responses whose body is not JSON are retried after an exponential
//     backoff; other HTTP errors fail at once;
//   - at most API_MAX_ATTEMPTS requests per call;
//   - calls for the same path while one is in flight share its request.
// A 429 sent without CORS headers cannot be read: fetch() rejects as for a
// network error, so it gets the backoff.
//
// The depth parameter is never sent: with depth >= 1 PeeringDB truncates list
// results (a response with meta.truncated is an error); without it a list
// comes whole in one response.

import {
  API_BASE,
  API_DELAY_MS,
  API_MAX_ATTEMPTS,
  API_TIMEOUT_MS,
  API_WINDOW_KEY,
  API_WINDOW_MAX,
  API_WINDOW_MS,
} from '../config.js';
import { assertNoDepth } from '../core/batch.js';
import { backoffMs, inWindow, isRetryableStatus, retryAfterSec, windowWaitMs } from '../core/retry.js';
import { t } from '../i18n/index.js';
import { storageGet, storageSet } from './storage.js';

/**
 * @typedef {object} ApiOptions
 * @property {AbortSignal} [signal] cancels the call, including any wait in the queue
 * @property {(seconds: number) => void} [onRateLimit] the queue pauses after an
 *   HTTP 429: called with the wait in seconds before this call is sent
 * @property {() => void} [onGiveUp] HTTP 429 on the last attempt: called just
 *   before the call fails
 */

/** A failed PeeringDB call: an HTTP error status, or a network error or timeout. */
export class ApiError extends Error {
  /**
   * @param {string} detail untranslated cause: "HTTP 503", "Failed to fetch"…
   * @param {{ status?: number, network?: boolean }} [info]
   */
  constructor(detail, { status = 0, network = false } = {}) {
    super(network ? `${t('error_net')}: ${detail}` : detail);
    this.name = 'ApiError';
    this.detail = detail;
    /** HTTP status, 0 for a network error or timeout. */
    this.status = status;
    this.network = network;
  }
}

export function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

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
 * Waits `ms`; rejects with an AbortError as soon as `signal` aborts.
 * @param {number} ms
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * `promise`, or an AbortError as soon as `signal` aborts (then `onAbort` runs).
 * @template T
 * @param {Promise<T>} promise
 * @param {AbortSignal | undefined} signal
 * @param {() => void} [onAbort]
 * @returns {Promise<T>}
 */
export function abortable(promise, signal, onAbort) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const abort = () => {
      onAbort?.();
      reject(abortError());
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

// ── queue ────────────────────────────────────────────────────────────────

/** Settles when the last queued request has finished. */
let tail = Promise.resolve();
/** No request before this time (HTTP 429). */
let pausedUntil = 0;
/** No request before this time (courtesy gap after a response). */
let gapUntil = 0;
/** @type {number[] | undefined} Send times inside the window, oldest first. */
let sent;

/**
 * @typedef {object} SharedCall
 * @property {Promise<any>} promise
 * @property {AbortController} controller aborted when no caller wants the result any more
 * @property {number} users callers still waiting for it
 */

/** @type {Map<string, SharedCall>} Calls queued or in flight, by path. */
const calls = new Map();

/** Send times of the window, read from localStorage the first time. */
function windowTimes() {
  if (!sent) {
    let stored = [];
    try {
      stored = JSON.parse(storageGet(API_WINDOW_KEY) || '[]');
    } catch {
      // corrupt, start empty
    }
    sent = Array.isArray(stored) ? stored.filter(Number.isFinite) : [];
  }
  return sent;
}

/** @param {number} now */
function recordSend(now) {
  sent = [...inWindow(windowTimes(), now, API_WINDOW_MS), now];
  storageSet(API_WINDOW_KEY, JSON.stringify(sent));
}

/**
 * Resolves when the next request may be sent: after an HTTP 429 pause, the
 * courtesy gap and a free place in the sliding window.
 * @param {AbortSignal} signal
 * @param {ApiOptions['onRateLimit']} onRateLimit
 */
async function waitTurn(signal, onRateLimit) {
  for (;;) {
    if (signal.aborted) throw abortError();
    const now = Date.now();
    if (pausedUntil > now) {
      onRateLimit?.(Math.ceil((pausedUntil - now) / 1000));
      await wait(pausedUntil - now, signal);
      continue;
    }
    const ms = Math.max(gapUntil - now, windowWaitMs(windowTimes(), now, API_WINDOW_MAX, API_WINDOW_MS));
    if (ms <= 0) return;
    await wait(ms, signal);
  }
}

/**
 * One request. Resolves with the parsed body, or with the ApiError of a
 * failed response, a network error, a timeout or a body that is not JSON
 * (captive portal, proxy page); rejects on abort.
 * @param {string} path
 * @param {AbortSignal} signal
 * @returns {Promise<{ body: any } | { error: ApiError, retryAfter: string | null }>}
 */
async function send(path, signal) {
  if (signal.aborted) throw abortError();
  // A controller and a timer of our own: AbortSignal.any/timeout are missing
  // in some browsers this app still supports.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const forward = () => controller.abort();
  signal.addEventListener('abort', forward, { once: true });
  try {
    const r = await fetch(API_BASE + path, { signal: controller.signal });
    if (!r.ok) {
      const error = new ApiError(`HTTP ${r.status}`, { status: r.status });
      return { error, retryAfter: r.headers.get('retry-after') };
    }
    return { body: await r.json() };
  } catch (e) {
    if (signal.aborted) throw abortError();
    if (timedOut) return { error: new ApiError('timeout', { network: true }), retryAfter: null };
    const error = /** @type {Error} */ (e);
    if (error.name !== 'TypeError' && error.name !== 'SyntaxError') throw error;
    return { error: new ApiError(error.message, { network: true }), retryAfter: null };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', forward);
  }
}

/**
 * A call: waits for its turn, sends, and retries as described at the top.
 * @param {string} path
 * @param {AbortSignal} signal
 * @param {ApiOptions} options
 */
async function call(path, signal, { onRateLimit, onGiveUp }) {
  for (let attempt = 1; ; attempt++) {
    await waitTurn(signal, onRateLimit);
    recordSend(Date.now());
    const result = await send(path, signal);
    gapUntil = Date.now() + API_DELAY_MS;
    if ('body' in result) {
      const truncated = result.body?.meta?.truncated;
      if (truncated) throw new ApiError(`PeeringDB truncated the result: ${truncated}`);
      return result.body;
    }
    const { error, retryAfter } = result;
    const rateLimited = error.status === 429;
    if (rateLimited) pausedUntil = Date.now() + (retryAfterSec(retryAfter) + 2) * 1000;
    if (!rateLimited && !error.network && !isRetryableStatus(error.status)) throw error;
    if (attempt >= API_MAX_ATTEMPTS) {
      if (rateLimited) onGiveUp?.();
      throw error;
    }
    if (!rateLimited) await wait(backoffMs(attempt), signal);
  }
}

/**
 * GET API_BASE + path through the queue and return the parsed JSON body.
 * Throws an ApiError when PeeringDB keeps failing, an AbortError when
 * `signal` aborts.
 * @param {string} path
 * @param {ApiOptions} [options]
 * @returns {Promise<any>}
 */
export function api(path, options = {}) {
  assertNoDepth(path);
  let shared = calls.get(path);
  if (!shared) {
    const controller = new AbortController();
    const run = tail.then(() => call(path, controller.signal, options));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    const entry = { promise: run, controller, users: 0 };
    const forget = () => {
      if (calls.get(path) === entry) calls.delete(path);
    };
    run.then(forget, forget);
    calls.set(path, entry);
    shared = entry;
  }
  const entry = shared;
  entry.users++;
  return abortable(entry.promise, options.signal, () => {
    entry.users--;
    if (entry.users === 0) {
      entry.controller.abort();
      if (calls.get(path) === entry) calls.delete(path);
    }
  });
}
