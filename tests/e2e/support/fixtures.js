import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test as base, expect } from '@playwright/test';
import { APP_ORIGIN, FakeNetwork } from '../../fake-api/network.js';
import { dataset } from '../../fixtures/dataset.js';
import { App } from './app.js';

const DEFAULT_APP_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../index.html');

export const test = base.extend({
  appMode: ['http', { option: true, scope: 'worker' }],
  appFile: [DEFAULT_APP_FILE, { option: true, scope: 'worker' }],

  // Installed for every test so nothing ever reaches the real network.
  api: [
    async ({ context, appFile }, use) => {
      const network = new FakeNetwork({ dataset, appHtml: readFileSync(appFile, 'utf8') });
      await network.install(context);
      await use(network);
      network.releaseAll();
      expect(network.blocked, 'requests to unexpected hosts').toEqual([]);
      expect(network.internalErrors(), 'fake API errors').toEqual([]);
      const withDepth = network.requests().filter((r) => /[?&]depth=/i.test(r.search));
      expect(withDepth.map((r) => r.url), 'PeeringDB calls must never use depth=').toEqual([]);
    },
    { auto: true },
  ],

  app: async ({ page, api, appMode, appFile }, use) => {
    const url = appMode === 'file' ? pathToFileURL(appFile).href : `${APP_ORIGIN}/`;
    await use(new App(page, { url, api }));
  },
});

export { expect };
