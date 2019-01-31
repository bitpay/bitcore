import { expect } from 'chai';
import { AsyncRPC } from '../../src/rpc';
import config from '../../src/config';
import { createWallet } from '../benchmark/wallet-benchmark';

describe('Wallet Benchmark', function() {
  this.timeout(50000);
  describe('Wallet import', () => {
    it('should import all addresses and verify in database', async () => {
      const chain = 'BTC';
      const network = 'regtest';
      const chainConfig = config.chains[chain][network];
      const creds = chainConfig.rpc;
      const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

      let addressList1 = new Array<string>();
      let addressList2 = new Array<string>();
      let addressList3 = new Array<string>();

      for (let i = 0; i < 10; i++) {
        let address = await rpc.getnewaddress('');
        addressList1.push(address);
      }

      console.log(addressList1);
      expect(addressList1).to.have.property('address');
      expect(addressList1.length).to.deep.equal(10);

      for (let i = 0; i < 100; i++) {
        let address = await rpc.getnewaddress('');
        addressList2.push(address);
      }

      expect(addressList2).to.have.property('address');
      expect(addressList2.length).to.deep.equal(100);

      for (let i = 0; i < 1000; i++) {
        let address = await rpc.getnewaddress('');
        addressList3.push(address);
      }

      expect(addressList3).to.have.property('address');
      expect(addressList3.length).to.deep.equal(1000);

      const importedWallet1 = await createWallet(addressList1, 0);
      const importedWallet2 = await createWallet(addressList2, 1);
      const importedWallet3 = await createWallet(addressList3, 2);

      console.log(importedWallet1);

      expect(importedWallet1).to.not.be.null;
      expect(importedWallet2).to.not.be.null;
      expect(importedWallet3).to.not.be.null;
    });
  });
});
