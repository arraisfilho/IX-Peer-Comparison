// Routes every request of a browser context: serves the app, answers PeeringDB
// and RIPEstat from the fakes, stubs Google Fonts and blocks (and records) any
// other host, so a test can never reach the real network.

import { FakePeeringDB } from './peeringdb.js';
import { FakeRipestat } from './ripestat.js';
import { sleep } from './service.js';

// HTTPS like GitHub Pages, so the page is a secure context as in production.
// (The clipboard does not depend on it: the page object always fakes it.)
export const APP_ORIGIN = 'https://ixpc.test';

const PASS_THROUGH = new Set(['file:', 'data:', 'blob:', 'about:']);

export class FakeNetwork {
  blocked = [];
  #entries = new WeakMap();

  constructor({ dataset, appHtml }) {
    const shared = {
      sequence: { value: 0 },
      onEntry: (request, entry) => this.#entries.set(request, entry),
    };
    this.peeringdb = new FakePeeringDB(dataset.peeringdb, shared);
    this.ripestat = new FakeRipestat(dataset.ripestat, shared);
    this.services = [this.peeringdb, this.ripestat];
    this.appHtml = appHtml;
  }

  async install(context) {
    await context.route('**/*', (route) => this.#dispatch(route));
    // Lets tests see that the page itself cancelled a request (AbortController).
    context.on('requestfailed', (request) => {
      const entry = this.#entries.get(request);
      if (entry) entry.failure = request.failure()?.errorText ?? 'failed';
    });
  }

  async #dispatch(route) {
    const url = new URL(route.request().url());
    if (PASS_THROUGH.has(url.protocol)) return route.continue();
    if (url.origin === APP_ORIGIN) {
      return url.pathname === '/'
        ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: this.appHtml })
        : route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
    }
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.hostname === 'fonts.gstatic.com') return route.fulfill({ status: 200, body: '' });
    const service = this.services.find((s) => s.handles(url));
    if (service) return service.handle(route, url);
    this.blocked.push(url.href);
    return route.abort('blockedbyclient');
  }

  /** Every PeeringDB and RIPEstat request, in the order they were received. */
  requests() {
    return this.services.flatMap((s) => s.log).sort((a, b) => a.seq - b.seq);
  }

  internalErrors() {
    return this.services.flatMap((s) => s.internalErrors);
  }

  releaseAll() {
    for (const service of this.services) service.releaseAll();
  }

  /**
   * Resolves when no fake request is in flight and none started or ended
   * during the last `quietMs` (RIPEstat enrichment runs after a load ends).
   */
  async waitForIdle({ quietMs = 250, timeoutMs = 15_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const busy = this.services.some((s) => s.inFlight > 0);
      const last = Math.max(...this.services.map((s) => s.lastActivity));
      if (!busy && Date.now() - last >= quietMs) return;
      if (Date.now() > deadline) {
        const pending = this.requests().filter((e) => e.endedAt === null).map((e) => e.url);
        throw new Error(`Fake API still busy after ${timeoutMs} ms; pending: ${pending.join(', ') || 'none'}`);
      }
      await sleep(20);
    }
  }
}
