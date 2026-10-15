// Shared plumbing for the fake HTTP services: request log, injected faults,
// hold gates and in-flight tracking (used by FakeNetwork.waitForIdle).

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Holds matching requests until release(), so a test can act mid-request. */
export class Gate {
  #open = false;
  #waiters = [];
  arrivals = 0;

  async pass() {
    this.arrivals++;
    if (!this.#open) await new Promise((resolve) => this.#waiters.push(resolve));
  }

  release() {
    this.#open = true;
    for (const resolve of this.#waiters.splice(0)) resolve();
  }

  /** Resolves once `count` requests have reached the gate. */
  async reached(count = 1, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (this.arrivals < count) {
      if (Date.now() > deadline) {
        throw new Error(`Gate reached by ${this.arrivals} of ${count} expected requests`);
      }
      await sleep(10);
    }
  }
}

/**
 * Base class for a fake HTTP JSON service. Subclasses implement
 * handles(url), endpointOf(url), respond(url) and corsHeaders(origin).
 *
 * Fault rules match a request by endpoint name ('net'), by a RegExp tested
 * against path + query ('/api/net?id__in=1,2'), or by a predicate over the
 * log entry. The first rule that matches and still has uses left applies;
 * `skip` lets the first N matching requests through untouched.
 */
export class FakeService {
  log = [];
  rules = [];
  inFlight = 0;
  lastActivity = 0;
  internalErrors = [];

  constructor({ name, sequence, onEntry }) {
    this.name = name;
    this.sequence = sequence;
    this.onEntry = onEntry;
  }

  addRule(match, action, { times = Infinity, skip = 0 } = {}) {
    const rule = { match, action, remaining: times, skip };
    this.rules.push(rule);
    return rule;
  }

  /** Responds with an HTTP error. `cors: false` mimics a proxy error page without CORS headers. */
  fail(match, { status = 500, headers = {}, body, cors = true, times, skip } = {}) {
    return this.addRule(match, { status, headers, body, cors }, { times, skip });
  }

  /**
   * HTTP 429. `retryAfter` may be seconds (number/string), a Date (sent as an
   * HTTP-date) or omitted. Browsers hide Retry-After from cross-origin scripts
   * unless it is listed in Access-Control-Expose-Headers; the real PeeringDB
   * does not send that header on its 200 responses, so exposure is opt-in.
   */
  rateLimit(match, { retryAfter, exposeRetryAfter = false, times, skip } = {}) {
    const headers = {};
    if (retryAfter !== undefined && retryAfter !== null) {
      headers['retry-after'] = retryAfter instanceof Date ? retryAfter.toUTCString() : String(retryAfter);
    }
    if (exposeRetryAfter) headers['access-control-expose-headers'] = 'Retry-After';
    return this.fail(match, { status: 429, headers, times, skip });
  }

  /** Fails at the network level (fetch rejects with TypeError). */
  networkError(match, { code = 'failed', times, skip } = {}) {
    return this.addRule(match, { abort: code }, { times, skip });
  }

  delay(match, ms, { times, skip } = {}) {
    return this.addRule(match, { delayMs: ms }, { times, skip });
  }

  /** Holds the matching request(s) until the returned gate is released. */
  hold(match, { times = 1, skip } = {}) {
    const gate = new Gate();
    this.addRule(match, { gate }, { times, skip });
    return gate;
  }

  releaseAll() {
    for (const rule of this.rules) rule.action.gate?.release();
  }

  requests(match) {
    return match === undefined ? [...this.log] : this.log.filter((entry) => matches(entry, match));
  }

  async handle(route, url) {
    const request = route.request();
    const entry = {
      seq: ++this.sequence.value,
      service: this.name,
      method: request.method(),
      url: url.href,
      host: url.host,
      path: url.pathname,
      search: url.search,
      endpoint: this.endpointOf(url),
      query: Object.fromEntries(url.searchParams),
      origin: await request.headerValue('origin'),
      startedAt: Date.now(),
      endedAt: null,
      status: null,
      outcome: 'pending',
      failure: null,
    };
    this.log.push(entry);
    this.onEntry?.(request, entry);
    this.inFlight++;
    this.lastActivity = Date.now();
    try {
      const action = this.#take(entry)?.action ?? {};
      if (action.delayMs) await sleep(action.delayMs);
      if (action.gate) {
        entry.outcome = 'held';
        await action.gate.pass();
      }
      if (action.abort) {
        entry.outcome = 'network-error';
        await route.abort(action.abort);
        return;
      }
      const response = action.status ? injected(action) : this.#safeRespond(url, entry);
      // Playwright adds Access-Control-Allow-Origin to fulfilled responses that
      // lack it, so a CORS-less error page is simulated with a foreign origin.
      const cors = action.cors === false ? { 'access-control-allow-origin': 'https://cors-mismatch.invalid' } : this.corsHeaders(entry.origin);
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        headers: { ...cors, ...response.headers },
        body: JSON.stringify(response.body),
      });
      entry.status = response.status;
      entry.outcome = 'fulfilled';
    } catch (error) {
      // The page navigated away or the request was already cancelled.
      entry.outcome = 'cancelled';
      entry.failure ??= error.message;
    } finally {
      entry.endedAt = Date.now();
      this.inFlight--;
      this.lastActivity = Date.now();
    }
  }

  #take(entry) {
    for (const rule of this.rules) {
      if (rule.remaining <= 0 || !matches(entry, rule.match)) continue;
      if (rule.skip > 0) {
        rule.skip--;
        continue;
      }
      rule.remaining--;
      return rule;
    }
    return null;
  }

  #safeRespond(url, entry) {
    try {
      return this.respond(url);
    } catch (error) {
      this.internalErrors.push(`${entry.url}: ${error.stack}`);
      return { status: 500, headers: {}, body: { meta: { error: `fake ${this.name} crashed` } } };
    }
  }
}

function injected({ status, headers = {}, body }) {
  return { status, headers, body: body ?? { meta: { error: `Injected HTTP ${status}` }, data: [] } };
}

function matches(entry, match) {
  if (typeof match === 'string') return entry.endpoint === match;
  if (match instanceof RegExp) return match.test(entry.path + entry.search);
  if (typeof match === 'function') return match(entry);
  throw new TypeError(`Unsupported request matcher: ${match}`);
}
