// DOM lookup.

/**
 * The element with this id. Throws when it is missing, or not a `type` when a
 * type is given, so that a broken page fails loudly instead of half-rendering.
 * @template {HTMLElement} [T=HTMLElement]
 * @param {string} id
 * @param {new (...args: any[]) => T} [type]
 * @returns {T}
 */
export function $(id, type) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  if (type && !(el instanceof type)) throw new Error(`#${id} is not a ${type.name}`);
  return /** @type {T} */ (el);
}
