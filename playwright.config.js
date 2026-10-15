import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));

// The page under test. Override to run the same suite against a frozen legacy
// copy, a build artifact or a mutated copy: APP_FILE=/abs/path/index.html
const appFile = path.resolve(root, process.env.APP_FILE || 'index.html');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Locally: PW_CHANNEL=chrome uses the installed Google Chrome. CI uses bundled Chromium.
    channel: process.env.PW_CHANNEL || undefined,
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
    appFile,
  },
  projects: [
    // Served by a route from a fake HTTPS origin (https://ixpc.test/).
    { name: 'http', use: { appMode: 'http' } },
    // Opened straight from disk, as the README tells users to do.
    { name: 'file', use: { appMode: 'file' } },
  ],
});
