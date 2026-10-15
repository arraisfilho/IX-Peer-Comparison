// The current language, dictionary lookup and language validation.

import { en } from './en.js';
import { es } from './es.js';
import { pt } from './pt.js';

/** @import { Dictionary } from './pt.js' */
/** @typedef {'pt' | 'en' | 'es'} Lang */

/** Supported languages, in button order. Portuguese is the default. */
export const LANGS = /** @type {const} */ (['pt', 'en', 'es']);

/** @type {Record<string, Dictionary>} */
const DICTIONARIES = { pt, en, es };

/** @type {Lang} */
let current = 'pt';

/**
 * @param {unknown} value
 * @returns {value is Lang}
 */
export function isLang(value) {
  return typeof value === 'string' && /** @type {readonly string[]} */ (LANGS).includes(value);
}

export function getLang() {
  return current;
}

/** @param {Lang} lang */
export function setCurrentLang(lang) {
  current = lang;
}

/**
 * Looks `key` up in the dictionary of `lang`, falling back to Portuguese and
 * then to the key itself, and replaces the first `{0}`, `{1}`… with `args`.
 * @param {string} lang
 * @param {string} key
 * @param {...(string | number)} args
 * @returns {string}
 */
export function translate(lang, key, ...args) {
  /** @type {Record<string, unknown>} */
  const dict = DICTIONARIES[lang] || pt;
  let s = /** @type {string} */ (dict[key] || /** @type {Record<string, unknown>} */ (pt)[key] || key);
  for (let i = 0; i < args.length; i++) s = s.replace(`{${i}}`, String(args[i]));
  return s;
}

/**
 * translate() in the current language.
 * @param {string} key
 * @param {...(string | number)} args
 */
export function t(key, ...args) {
  return translate(current, key, ...args);
}

/**
 * Continent names in the current language, by continent code.
 * @returns {Record<string, string>}
 */
export function contNames() {
  return (DICTIONARIES[current] || pt).cont_names || pt.cont_names;
}

/** Locale of the dates and times shown in the status line. */
export function dateLocale() {
  return current === 'en' ? 'en-GB' : current === 'es' ? 'es-ES' : 'pt-BR';
}
