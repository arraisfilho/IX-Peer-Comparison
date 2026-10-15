// IX colours. Pure: no DOM, no network, no app state.

/**
 * The lowest palette index not in `used`, or 0 when every index is taken.
 * @param {Iterable<number>} used palette indexes of the IXes already shown
 * @param {number} size palette size
 */
export function freeColorIndex(used, size) {
  const taken = new Set(used);
  for (let i = 0; i < size; i++) {
    if (!taken.has(i)) return i;
  }
  return 0;
}
