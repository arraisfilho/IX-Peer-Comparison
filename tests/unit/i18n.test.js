// The three dictionaries must stay in sync: same keys, same continent codes,
// same {n} placeholders.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../../src/i18n/en.js';
import { es } from '../../src/i18n/es.js';
import { pt } from '../../src/i18n/pt.js';

const DICTS = { pt, en, es };
const placeholders = (text) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();

test('pt, en and es have the same keys', () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(pt).sort(), lang);
    assert.deepEqual(Object.keys(dict.cont_names).sort(), Object.keys(pt.cont_names).sort(), `${lang} cont_names`);
  }
});

test('translations keep the placeholders of the Portuguese text', () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    for (const [key, text] of Object.entries(pt)) {
      if (typeof text === 'string') assert.deepEqual(placeholders(dict[key]), placeholders(text), `${lang}.${key}`);
    }
  }
});
