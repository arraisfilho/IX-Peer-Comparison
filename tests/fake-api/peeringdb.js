// Fake PeeringDB REST API (https://www.peeringdb.com/api/<table>) over a
// synthetic dataset. Mimics the server behaviour the app depends on:
//   - list endpoints return { data: [...], meta: {} } with every row (no paging);
//   - `<field>=v` and `<field>__in=a,b` filters, `fields=` projection,
//     `limit`/`skip`;
//   - depth >= 1 truncates a list to 250 rows and sets meta.truncated, depth=0
//     behaves like no depth (verified against the real server on 2026-10-15);
//   - CORS: echoes the request Origin, so file:// pages receive "null".
// Rows with status != 'ok' are returned unless the query filters on status, so
// the app's own client-side status filter stays observable.

import { FakeService } from './service.js';

export const DEPTH_ROW_LIMIT = 250;
const CONTROL_PARAMS = new Set(['fields', 'depth', 'limit', 'skip']);

export class FakePeeringDB extends FakeService {
  constructor(tables, options = {}) {
    super({ name: 'peeringdb', ...options });
    this.tables = { ...tables };
  }

  handles(url) {
    return url.hostname === 'www.peeringdb.com' && url.pathname.startsWith('/api/');
  }

  endpointOf(url) {
    return url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  }

  corsHeaders(origin) {
    return { 'access-control-allow-origin': origin ?? '*', vary: 'Origin' };
  }

  /** Replaces a table for the current test only. */
  setTable(name, rows) {
    this.tables[name] = rows;
  }

  respond(url) {
    const [table, id] = this.endpointOf(url).split('/');
    const rows = this.tables[table];
    if (!rows) return notFound();

    let result = id === undefined ? rows : rows.filter((row) => String(row.id) === id);
    if (id !== undefined && result.length === 0) return notFound();

    for (const [key, value] of url.searchParams) {
      if (CONTROL_PARAMS.has(key)) continue;
      const filter = buildFilter(key, value);
      if (!filter) return badRequest(`Unsupported filter: ${key}`);
      result = result.filter(filter);
    }

    const meta = {};
    const skip = Number(url.searchParams.get('skip') || 0);
    const limit = Number(url.searchParams.get('limit') || 0);
    if (skip) result = result.slice(skip);
    if (limit) result = result.slice(0, limit);

    const depth = Number(url.searchParams.get('depth') || 0);
    if (id === undefined && depth > 0 && result.length > DEPTH_ROW_LIMIT) {
      result = result.slice(0, DEPTH_ROW_LIMIT);
      meta.truncated =
        `Result set truncated to ${DEPTH_ROW_LIMIT} rows because depth=${depth}; ` +
        'drop the depth parameter or page with limit/skip.';
    }

    const fields = url.searchParams.get('fields');
    if (fields) {
      const keep = fields.split(',').map((f) => f.trim()).filter(Boolean);
      result = result.map((row) => Object.fromEntries(keep.filter((k) => k in row).map((k) => [k, row[k]])));
    }

    return { status: 200, headers: {}, body: { data: result, meta } };
  }
}

function buildFilter(key, value) {
  const [field, modifier] = key.split('__');
  if (modifier === undefined) return (row) => String(row[field]) === value;
  if (modifier === 'in') {
    const wanted = new Set(value.split(','));
    return (row) => wanted.has(String(row[field]));
  }
  return null;
}

function notFound() {
  return { status: 404, headers: {}, body: { meta: { error: 'Not found' }, data: [] } };
}

function badRequest(message) {
  return { status: 400, headers: {}, body: { meta: { error: message }, data: [] } };
}
