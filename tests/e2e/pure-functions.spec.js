// Runs the golden cases against the helpers that the legacy app
// (tests/legacy/index.html) exposes as globals; the built app has none.
// Tagged @legacy-globals: only the "legacy" project runs it. tests/unit runs
// the same cases against the modules of src/.

import { readFileSync } from 'node:fs';
import { test, expect } from './support/fixtures.js';

const golden = JSON.parse(readFileSync(new URL('../golden/pure-functions.json', import.meta.url), 'utf8'));
const SIMPLE = ['normPolicy', 'fmtSpeed', 'flag', 'getCont', 'ccName', 'fmtElapsed', 'shortName', 'esc'];

const mismatches = (cases, actual, key = 'expected') =>
  cases.map((c, i) => ({ ...c, actual: actual[i] })).filter((c) => JSON.stringify(c.actual) !== JSON.stringify(c[key]));

test.describe('pure helpers (golden cases)', { tag: '@legacy-globals' }, () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  for (const name of SIMPLE) {
    test(`${name}`, async ({ page }) => {
      const cases = golden[name];
      const actual = await page.evaluate(({ fn, list }) => list.map((c) => window[fn](...c.args)), { fn: name, list: cases });
      expect(mismatches(cases, actual)).toEqual([]);
    });
  }

  test('filterIXes', async ({ page }) => {
    const { catalog, cases } = golden.filterIXes;
    // `allIXes` is a top-level `let` of the app script, reachable by name.
    const actual = await page.evaluate(({ catalog, list }) => {
      const saved = allIXes;
      allIXes = catalog;
      try {
        return list.map((c) => filterIXes(...c.args).map((ix) => ix.id));
      } finally {
        allIXes = saved;
      }
    }, { catalog, list: cases });
    expect(mismatches(cases, actual, 'expectedIds')).toEqual([]);
  });

  test('t', async ({ page }) => {
    const cases = golden.t;
    // `lang` is a top-level `let` of the app script, reachable by name.
    const actual = await page.evaluate((list) => {
      const saved = lang;
      try {
        return list.map((c) => {
          lang = c.lang;
          return t(...c.args);
        });
      } finally {
        lang = saved;
      }
    }, cases);
    expect(mismatches(cases, actual)).toEqual([]);
  });
});
