import { expect } from 'chai';
import { AsyncRPC } from '../../src/rpc';
import config from '../../src/config';
import { createWallet } from '../benchmark/wallet-benchmark';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';
import { WalletAddressStorage } from '../../src/models/walletAddress';

describe('Wallet Benchmark', function() {
  this.timeout(50000);
  describe('Wallet import', () => {
    it('should import all addresses and verify in database while below 300 mb of heapUsed memory', async () => {
      const chain = 'BTC';
      const network = 'regtest';
      const chainConfig = config.chains[chain][network];
      const creds = chainConfig.rpc;
      const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

      await Event.start();
      await Api.start();

      let smallAddressBatch = new Array<string>();
      let mediumAddressBatch = new Array<string>();
      let largeAddressBatch = new Array<string>();

      for (let i = 0; i < 10; i++) {
        let address = await rpc.getnewaddress('');
        smallAddressBatch.push(address);
      }

      expect(smallAddressBatch.length).to.deep.equal(10);

      for (let i = 0; i < 100; i++) {
        let address = await rpc.getnewaddress('');
        mediumAddressBatch.push(address);
      }

      expect(mediumAddressBatch.length).to.deep.equal(100);

      for (let i = 0; i < 1000; i++) {
        let address = await rpc.getnewaddress('');
        largeAddressBatch.push(address);
      }

      expect(largeAddressBatch.length).to.deep.equal(1000);

      const importedWallet1 = await createWallet(smallAddressBatch, 0, network);
      const importedWallet2 = await createWallet(mediumAddressBatch, 1, network);
      const importedWallet3 = await createWallet(largeAddressBatch, 2, network);

      expect(importedWallet1).to.not.be.null;
      expect(importedWallet2).to.not.be.null;
      expect(importedWallet3).to.not.be.null;

      const foundSmallAddressBatch = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: smallAddressBatch }
        })
        .toArray();

      const smallAddresses = foundSmallAddressBatch.map(wa => wa.address);

      for (let address of smallAddressBatch) {
        expect(smallAddresses.includes(address)).to.be.true;
      }
      expect(foundSmallAddressBatch.length).to.have.deep.equal(smallAddressBatch.length);

      const foundMediumAddressBatch = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: mediumAddressBatch }
        })
        .toArray();

      const mediumAddresses = foundMediumAddressBatch.map(wa => wa.address);

      for (let address of mediumAddressBatch) {
        expect(mediumAddresses.includes(address)).to.be.true;
      }
      expect(foundMediumAddressBatch.length).to.have.deep.equal(mediumAddressBatch.length);

      const foundLargeAddressBatch = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: largeAddressBatch }
        })
        .toArray();

      const largeAddresses = foundLargeAddressBatch.map(wa => wa.address);

      for (let address of largeAddressBatch) {
        expect(largeAddresses.includes(address)).to.be.true;
      }
      expect(foundLargeAddressBatch.length).to.have.deep.equal(largeAddressBatch.length);

      const { heapUsed } = process.memoryUsage();
      expect(heapUsed).to.be.below(3e8);
    });
  });
});
