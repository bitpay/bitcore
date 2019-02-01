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

      let addressList1 = new Array<string>();
      let addressList2 = new Array<string>();
      let addressList3 = new Array<string>();

      for (let i = 0; i < 10; i++) {
        let address = await rpc.getnewaddress('');
        addressList1.push(address);
      }

      expect(addressList1.length).to.deep.equal(10);

      for (let i = 0; i < 100; i++) {
        let address = await rpc.getnewaddress('');
        addressList2.push(address);
      }

      expect(addressList2.length).to.deep.equal(100);

      for (let i = 0; i < 1000; i++) {
        let address = await rpc.getnewaddress('');
        addressList3.push(address);
      }

      expect(addressList3.length).to.deep.equal(1000);

      const importedWallet1 = await createWallet(addressList1, 0);
      const importedWallet2 = await createWallet(addressList2, 1);
      const importedWallet3 = await createWallet(addressList3, 2);

      expect(importedWallet1).to.not.be.null;
      expect(importedWallet2).to.not.be.null;
      expect(importedWallet3).to.not.be.null;

      const foundAddressList1 = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: addressList1 }
        })
        .toArray();

      for (let address of addressList1) {
        expect(foundAddressList1.map(wa => wa.address).includes(address)).to.be.true;
      }
      expect(foundAddressList1.length).to.have.deep.equal(addressList1.length);

      const foundAddressList2 = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: addressList2 }
        })
        .toArray();

      for (let address of addressList2) {
        expect(foundAddressList2.map(wa => wa.address).includes(address)).to.be.true;
      }
      expect(foundAddressList2.length).to.have.deep.equal(addressList2.length);

      const foundAddressList3 = await WalletAddressStorage.collection
        .find({
          chain,
          network,
          address: { $in: addressList3 }
        })
        .toArray();

      for (let address of addressList3) {
        expect(foundAddressList3.map(wa => wa.address).includes(address)).to.be.true;
      }
      expect(foundAddressList3.length).to.have.deep.equal(addressList3.length);

      const { heapUsed } = process.memoryUsage();
      expect(heapUsed).to.be.below(3e8);
    });
  });
});
