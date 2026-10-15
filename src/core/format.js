// Text formatting helpers. Pure: no DOM, no network, no app state.

/**
 * Normalizes a PeeringDB general peering policy: the three known values get
 * their usual casing, any other value containing "no" becomes "No" and the
 * rest passes through trimmed. Empty or missing → null.
 * @param {string | null | undefined} p
 * @returns {string | null}
 */
export function normPolicy(p) {
  if (!p) return null;
  const s = p.trim().toLowerCase();
  if (s === 'open') return 'Open';
  if (s === 'selective') return 'Selective';
  if (s === 'restrictive') return 'Restrictive';
  if (s.includes('no')) return 'No';
  return p.trim();
}

/**
 * A port speed in Mbit/s as "100M", "1.5G" or "1T"; 0 or missing → "—".
 * @param {number | null | undefined} mbps
 */
export function fmtSpeed(mbps) {
  if (!mbps) return '—';
  if (mbps >= 1000000) return `${mbps / 1000000}T`;
  if (mbps >= 1000) return `${mbps / 1000}G`;
  return `${mbps}M`;
}

/**
 * Seconds as "59s", "1m" or "1m5s".
 * @param {number} sec
 */
export function fmtElapsed(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m${sec % 60 > 0 ? `${sec % 60}s` : ''}`;
}

/**
 * Cuts a name to `max` characters, the last one being "…".
 * @param {string} n
 * @param {number} [max]
 */
export function shortName(n, max = 22) {
  return n.length > max ? `${n.slice(0, max - 1)}…` : n;
}

/**
 * Escapes text for HTML element content and double-quoted attribute values.
 * @param {unknown} s
 */
export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
