// Pure helpers behind the PeeringDB client (src/data/api.js, src/data/peeringdb.js).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNoDepth, chunks, pdbPath, splitOnError } from '../../src/core/batch.js';
import { backoffMs, inWindow, isRetryableStatus, retryAfterSec, windowWaitMs } from '../../src/core/retry.js';

test('retryAfterSec: delta-seconds, HTTP-date, and 30 s when absent, invalid or negative', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  assert.equal(retryAfterSec('5', now), 5);
  assert.equal(retryAfterSec(' 0 ', now), 0);
  assert.equal(retryAfterSec('3600', now), 120);
  assert.equal(retryAfterSec('Thu, 15 Oct 2026 12:00:10 GMT', now), 10);
  assert.equal(retryAfterSec('Thu, 15 Oct 2026 11:59:00 GMT', now), 30);
  for (const value of [null, undefined, '', 'soon', '-5', '1.5']) assert.equal(retryAfterSec(value, now), 30, String(value));
});

test('isRetryableStatus: only gateway errors', () => {
  assert.deepEqual([502, 503, 504].map(isRetryableStatus), [true, true, true]);
  assert.deepEqual([400, 404, 414, 429, 500, 501].map(isRetryableStatus), [false, false, false, false, false, false]);
});

test('backoffMs: 2 s, 4 s, 8 s, plus at most 25 % of jitter', () => {
  assert.deepEqual([1, 2, 3].map((n) => backoffMs(n, 0)), [2000, 4000, 8000]);
  assert.deepEqual([1, 2, 3].map((n) => backoffMs(n, 0.999999)), [2500, 5000, 10000]);
  for (let i = 0; i < 100; i++) {
    const ms = backoffMs(1);
    assert.ok(ms >= 2000 && ms <= 2500, String(ms));
  }
});

test('inWindow: keeps the times of the window, oldest first, without future times', () => {
  assert.deepEqual(inWindow([5000, 70_000, 10_001, 10_000, 90_000], 70_000, 60_000), [10_001, 70_000]);
});

test('windowWaitMs: 0 while the window has room, else until the oldest needed send leaves it', () => {
  const now = 100_000;
  const at = (...offsets) => offsets.map((o) => now - o);
  assert.equal(windowWaitMs([], now, 3, 60_000), 0);
  assert.equal(windowWaitMs(at(10_000, 5000), now, 3, 60_000), 0);
  assert.equal(windowWaitMs(at(50_000, 10_000, 5000), now, 3, 60_000), 10_000);
  // 5 sends, max 3: the three oldest must leave the window
  assert.equal(windowWaitMs(at(5000, 50_000, 40_000, 30_000, 1000), now, 3, 60_000), 30_000);
  // sends older than the window do not count
  assert.equal(windowWaitMs(at(60_000, 70_000, 10_000, 5000), now, 3, 60_000), 0);
  // 18 per minute: the 19th waits for the first to be 60 s old
  assert.equal(windowWaitMs(Array.from({ length: 18 }, (_, i) => now - 15_000 + i * 100), now, 18, 60_000), 45_000);
});

test('pdbPath: joins lists with commas and refuses depth=', () => {
  assert.equal(pdbPath('ix', { status: 'ok', fields: ['id', 'name'] }), '/ix?status=ok&fields=id,name');
  assert.equal(pdbPath('net', { id__in: [3, 1, 2], fields: ['id'] }), '/net?id__in=3,1,2&fields=id');
  assert.equal(pdbPath('netixlan', { ix_id: 171, fields: ['net_id', 'speed'] }), '/netixlan?ix_id=171&fields=net_id,speed');
  assert.throws(() => pdbPath('netixlan', { ix_id: 1, depth: 0 }), /depth=/);
  assert.throws(() => assertNoDepth('/net?depth=2&id__in=1'), /depth=/);
  assert.throws(() => assertNoDepth('/net?id__in=1&DEPTH=1'), /depth=/);
  assert.equal(assertNoDepth('/net?id__in=1&maxdepth=1'), '/net?id__in=1&maxdepth=1');
});

test('chunks: consecutive slices of at most size', () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunks([], 1000), []);
  assert.equal(chunks(Array.from({ length: 2000 }, (_, i) => i), 1000).length, 2);
});

test('splitOnError: halves a refused request recursively, in order', async () => {
  const seen = [];
  const tooLong = new Error('HTTP 414');
  const rows = await splitOnError(
    [1, 2, 3, 4, 5],
    async (ids) => {
      seen.push(ids);
      if (ids.length > 2) throw tooLong;
      return ids.map((id) => id * 10);
    },
    (e) => e === tooLong,
  );
  assert.deepEqual(rows, [10, 20, 30, 40, 50]);
  assert.deepEqual(seen, [[1, 2, 3, 4, 5], [1, 2, 3], [1, 2], [3], [4, 5]]);
});

test('splitOnError: other errors and a single refused id are thrown', async () => {
  const boom = new Error('HTTP 500');
  await assert.rejects(() => splitOnError([1, 2], () => Promise.reject(boom), () => false), boom);
  const seen = [];
  const tooLong = new Error('HTTP 414');
  await assert.rejects(
    () =>
      splitOnError(
        [1, 2, 3, 4],
        async (ids) => {
          seen.push(ids.length);
          throw tooLong;
        },
        () => true,
      ),
    tooLong,
  );
  // stops at the first single id: 4 → 2 → 1, the rest is never requested
  assert.deepEqual(seen, [4, 2, 1]);
});
