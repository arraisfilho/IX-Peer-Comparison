// Presence of networks across IXes. Pure: no DOM, no network, no app state.

/** @import { SelectedIx } from '../types.js' */

/**
 * The IXes each network is a member of: net id → ids of those IXes, in IX
 * order. Networks are listed in the order they are first met.
 * @param {SelectedIx[]} ixes
 * @returns {Map<number, number[]>}
 */
export function buildNetMap(ixes) {
  /** @type {Map<number, number[]>} */
  const m = new Map();
  for (const ix of ixes) {
    for (const [netId] of ix.members) {
      let list = m.get(netId);
      if (!list) {
        list = [];
        m.set(netId, list);
      }
      list.push(ix.id);
    }
  }
  return m;
}
