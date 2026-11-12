// @solana/kit 2.3 renamed a lookup's writableIndices and readableIndices to writableIndexes and readonlyIndexes;
// crypto-wallet-core pins kit 2.1, which uses the old names
const writableIndexesOf = (lookup: AddressTableLookup) => lookup.writableIndexes ?? lookup.writableIndices;
const readonlyIndexesOf = (lookup: AddressTableLookup) => lookup.readonlyIndexes ?? lookup.readableIndices;

/** A compiled message's lookup into one address lookup table, with either Kit's old or new index names */
export interface AddressTableLookup {
  lookupTableAddress: string;
  writableIndexes?: readonly number[];
  readonlyIndexes?: readonly number[];
  writableIndices?: readonly number[];
  readableIndices?: readonly number[];
}

/** A tx's meta.loadedAddresses: the accounts it loaded from lookup tables */
export interface LoadedAddresses<TAddress extends string = string> {
  writable?: readonly TAddress[];
  readonly?: readonly TAddress[];
}

/**
 * Rebuilds, from a tx's meta.loadedAddresses, the entries of each lookup table that the tx used, in the form
 * decompileTransactionMessage takes as `addressesByLookupTableAddress`. The validator lists loaded accounts as every
 * lookup's writable accounts, then every lookup's readonly accounts, in the order of the tx's lookups.
 * @param {Array<Object>} addressTableLookups - The compiled message's lookups
 * @param {{ writable: string[], readonly: string[] }} loadedAddresses
 * @returns {Object<string, string[]>|null} null if loadedAddresses doesn't match the lookups
 */
export function addressesByLookupTableAddress<TAddress extends string>(
  addressTableLookups: readonly AddressTableLookup[],
  loadedAddresses: LoadedAddresses<TAddress>
): Record<string, TAddress[]> | null {
  const addressesByTable: Record<string, TAddress[]> = {};
  const accountsByIndexes: [typeof writableIndexesOf, readonly TAddress[] | undefined][] = [
    [writableIndexesOf, loadedAddresses.writable],
    [readonlyIndexesOf, loadedAddresses.readonly]
  ];
  for (const [indexesOf, accounts] of accountsByIndexes) {
    const indexes = addressTableLookups.map(indexesOf);
    if (!indexes.every(Array.isArray)) {
      return null;
    }
    // narrowed above: every entry is an array
    const lookupIndexes = indexes as (readonly number[])[];
    if (accounts?.length !== lookupIndexes.reduce((count, lookupIndexes) => count + lookupIndexes.length, 0)) {
      return null;
    }
    let next = 0;
    for (const [i, { lookupTableAddress }] of addressTableLookups.entries()) {
      const addresses = addressesByTable[lookupTableAddress] ||= [];
      for (const index of lookupIndexes[i]) {
        addresses[index] = accounts[next++];
      }
    }
  }
  return addressesByTable;
}
