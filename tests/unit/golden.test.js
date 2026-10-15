// Runs tests/golden/pure-functions.json against the pure modules of src/.
// tests/e2e/pure-functions.spec.js runs the same cases against the globals of
// the frozen legacy app.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { filterIXes } from '../../src/core/catalog.js';
import { esc, fmtElapsed, fmtSpeed, normPolicy, shortName } from '../../src/core/format.js';
import { ccName, flag, getCont } from '../../src/core/geo.js';
import { translate } from '../../src/i18n/index.js';

const golden = JSON.parse(readFileSync(new URL('../golden/pure-functions.json', import.meta.url), 'utf8'));
const SIMPLE = { normPolicy, fmtSpeed, flag, getCont, ccName, fmtElapsed, shortName, esc };

test('every golden case set is run', () => {
  const sets = Object.keys(golden).filter((key) => key !== '$comment');
  assert.deepEqual(sets.sort(), [...Object.keys(SIMPLE), 'filterIXes', 't'].sort());
});

for (const [name, fn] of Object.entries(SIMPLE)) {
  test(name, () => {
    for (const c of golden[name]) assert.deepEqual(fn(...c.args), c.expected, `${name}(${JSON.stringify(c.args)})`);
  });
}

test('filterIXes', () => {
  const { catalog, cases } = golden.filterIXes;
  for (const c of cases) {
    const ids = filterIXes(catalog, ...c.args).map((ix) => ix.id);
    assert.deepEqual(ids, c.expectedIds, `filterIXes(${JSON.stringify(c.args)})`);
  }
});

test('t', () => {
  for (const c of golden.t) {
    assert.deepEqual(translate(c.lang, ...c.args), c.expected, `t(${JSON.stringify(c.args)}) in ${c.lang}`);
  }
});
