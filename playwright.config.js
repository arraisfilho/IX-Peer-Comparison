import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));

// The page under test: the index.html built from src/. Override to run the
// suite against another copy: APP_FILE=/abs/path/index.html
const appFile = path.resolve(root, process.env.APP_FILE || 'index.html');
// Frozen copy of the app before src/ existed (differential check).
const legacyAppFile = path.resolve(root, 'tests/legacy/index.html');

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
  },
  projects: [
    // Served by a route from a fake HTTPS origin (https://ixpc.test/).
    { name: 'http', use: { appMode: 'http', appFile }, grepInvert: /@legacy-globals/ },
    // Opened straight from disk, as the README tells users to do.
    { name: 'file', use: { appMode: 'file', appFile }, grepInvert: /@legacy-globals/ },
    // The same suite against the legacy copy, served like "http". Only this
    // project runs the specs that read the legacy app's globals; it skips the
    // specs of the PeeringDB client rewrite (@api-v2), whose network behaviour
    // differs from the legacy app on purpose.
    { name: 'legacy', use: { appMode: 'http', appFile: legacyAppFile }, grepInvert: /@api-v2/ },
  ],
});
