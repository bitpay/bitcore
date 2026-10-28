// @solana/kit 2.3 renamed a lookup's writableIndices and readableIndices to writableIndexes and readonlyIndexes;
// crypto-wallet-core pins kit 2.1, which uses the old names
const writableIndexesOf = lookup => lookup.writableIndexes ?? lookup.writableIndices;
const readonlyIndexesOf = lookup => lookup.readonlyIndexes ?? lookup.readableIndices;

/**
 * Rebuilds, from a tx's meta.loadedAddresses, the entries of each lookup table that the tx used, in the form
 * decompileTransactionMessage takes as `addressesByLookupTableAddress`. The validator lists loaded accounts as every
 * lookup's writable accounts, then every lookup's readonly accounts, in the order of the tx's lookups.
 * @param {Array<Object>} addressTableLookups - The compiled message's lookups
 * @param {{ writable: string[], readonly: string[] }} loadedAddresses
 * @returns {Object<string, string[]>|null} null if loadedAddresses doesn't match the lookups
 */
export function addressesByLookupTableAddress(addressTableLookups, loadedAddresses) {
  const addressesByTable = {};
  for (const [indexesOf, accounts] of [[writableIndexesOf, loadedAddresses.writable], [readonlyIndexesOf, loadedAddresses.readonly]]) {
    const indexes = addressTableLookups.map(indexesOf);
    if (!indexes.every(Array.isArray)) {
      return null;
    }
    if (accounts?.length !== indexes.reduce((count, lookupIndexes) => count + lookupIndexes.length, 0)) {
      return null;
    }
    let next = 0;
    for (const [i, { lookupTableAddress }] of addressTableLookups.entries()) {
      const addresses = addressesByTable[lookupTableAddress] ||= [];
      for (const index of indexes[i]) {
        addresses[index] = accounts[next++];
      }
    }
  }
  return addressesByTable;
}
