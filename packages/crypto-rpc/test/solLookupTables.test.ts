import { expect } from 'chai';
import { addressesByLookupTableAddress } from '../lib/sol/lookup-tables.js';

describe('SOL lookup tables', () => {
  describe('addressesByLookupTableAddress', () => {
    // Two lookups as @solana/kit 2.1 decodes them, and the same with the names kit 2.3 uses
    const lookupsBefore23 = [
      { lookupTableAddress: 'tableA', writableIndices: [3, 0], readableIndices: [5] },
      { lookupTableAddress: 'tableB', writableIndices: [1], readableIndices: [2, 4] }
    ];
    const lookups23 = lookupsBefore23.map(({ lookupTableAddress, writableIndices, readableIndices }) => ({
      lookupTableAddress,
      writableIndexes: writableIndices,
      readonlyIndexes: readableIndices
    }));
    // Every lookup's writable accounts, then every lookup's readonly accounts, in lookup order
    const loadedAddresses = { writable: ['a3', 'a0', 'b1'], readonly: ['a5', 'b2', 'b4'] };
    const expected = {
      tableA: Object.assign([], { 0: 'a0', 3: 'a3', 5: 'a5' }),
      tableB: Object.assign([], { 1: 'b1', 2: 'b2', 4: 'b4' })
    };

    it('places each loaded account at its index in its table', () => {
      expect(addressesByLookupTableAddress(lookupsBefore23, loadedAddresses)).to.deep.equal(expected);
    });

    it('reads the index names @solana/kit 2.3 uses', () => {
      expect(addressesByLookupTableAddress(lookups23, loadedAddresses)).to.deep.equal(expected);
    });

    it('merges two lookups of the same table', () => {
      const lookups = [
        { lookupTableAddress: 'tableA', writableIndices: [0], readableIndices: [] },
        { lookupTableAddress: 'tableA', writableIndices: [], readableIndices: [2] }
      ];
      expect(addressesByLookupTableAddress(lookups, { writable: ['a0'], readonly: ['a2'] }))
        .to.deep.equal({ tableA: Object.assign([], { 0: 'a0', 2: 'a2' }) });
    });

    it('returns null when there are fewer writable accounts than writable indexes', () => {
      expect(addressesByLookupTableAddress(lookupsBefore23, { ...loadedAddresses, writable: ['a3', 'a0'] })).to.be.null;
    });

    it('returns null when there are more readonly accounts than readonly indexes', () => {
      expect(addressesByLookupTableAddress(lookupsBefore23, { ...loadedAddresses, readonly: [...loadedAddresses.readonly, 'extra'] })).to.be.null;
    });

    it('returns null when loadedAddresses has no readonly list', () => {
      expect(addressesByLookupTableAddress(lookupsBefore23, { writable: loadedAddresses.writable })).to.be.null;
    });

    it('returns null when a lookup has neither name for its indexes', () => {
      const lookups = [{ lookupTableAddress: 'tableA', readableIndices: [5] }];
      expect(addressesByLookupTableAddress(lookups, { writable: [], readonly: ['a5'] })).to.be.null;
    });
  });
});
