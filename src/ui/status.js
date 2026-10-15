// The status line in the header and the rate-limit countdown shown in it.

import { dateLocale, t } from '../i18n/index.js';
import { state } from '../state.js';
import { $ } from './dom.js';

/** Colours of the status dot. */
export const STATUS_OK = 'var(--open)';
export const STATUS_WARNING = 'var(--warning)';
export const STATUS_ERROR = 'var(--restrictive)';

/** @type {number | undefined} */
let countdownTimer;

/**
 * Shows "● msg" with a dot of the given colour. `msg` may hold external text
 * (IX names, error messages), so it is inserted as text, never as HTML.
 * @param {string} msg
 * @param {string} color
 */
export function setStatus(msg, color) {
  const dot = document.createElement('span');
  dot.style.color = color;
  dot.textContent = '●';
  $('catalog-status').replaceChildren(dot, document.createTextNode(` ${msg}`));
}

/** "N IXes · <time>" in green, once a rate-limit wait has ended or was cancelled. */
export function setReadyTimeStatus() {
  const ts = new Date().toLocaleString(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  setStatus(`${state.allIXes.length} IXes · ${ts}`, STATUS_OK);
}

/**
 * Counts down, second by second, the wait before a rate-limited call is
 * retried, then shows the ready status. Replaces a countdown already running.
 * @param {number} totalSec
 */
export function startRateLimitCountdown(totalSec) {
  if (countdownTimer) clearInterval(countdownTimer);
  let remaining = totalSec;
  const tick = () => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
      setReadyTimeStatus();
    } else {
      setStatus(`⏳ ${t('rate_wait', remaining)}`, STATUS_WARNING);
    }
  };
  setStatus(`⏳ ${t('rate_wait', remaining)}`, STATUS_WARNING);
  countdownTimer = setInterval(tick, 1000);
}

/** Stops the countdown, if one is running, and leaves the status line as it is. */
export function stopRateLimitCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = undefined;
  }
}

export function isRateLimitCountdownRunning() {
  return countdownTimer !== undefined;
}
