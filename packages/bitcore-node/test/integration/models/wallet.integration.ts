import { expect } from 'chai';
import { Wallet } from 'bitcore-client';
import { Api } from '../../../src/services/api';
import { AsyncRPC } from '../../../src/rpc';
import { Event } from '../../../src/services/event';
import { WalletStorage } from '../../../src/models/wallet';
import config from '../../../src/config';
import { WalletAddressStorage } from '../../../src/models/walletAddress';

describe('Wallet Model', () => {
  describe('Wallet Create', () => {
    it('should return a locked wallet on create', async () => {
      const walletName = 'Test Wallet';
      const password = 'iamsatoshi';
      const chain = 'BTC';
      const network = 'regtest';
      const baseUrl = 'http://localhost:3000/api';
      let lockedWallet: Wallet;
      await Event.start();
      await Api.start();

      lockedWallet = await Wallet.create({
        name: walletName,
        chain,
        network,
        baseUrl,
        password
      });

      expect(lockedWallet).to.have.includes({
        name: 'Test Wallet',
        chain: 'BTC',
        network: 'regtest',
        baseUrl: 'http://localhost:3000/api/BTC/regtest'
      });
      expect(lockedWallet).to.have.property('pubKey');
      expect(lockedWallet).to.have.property('password');
      expect(lockedWallet).to.have.property('authKey');
      expect(lockedWallet).to.have.property('encryptionKey');

      let result = await WalletStorage.collection.findOne({
        name: 'Test Wallet',
        chain: 'BTC',
        network: 'regtest'
      });

      expect(result).to.includes({
        name: 'Test Wallet',
        chain: 'BTC',
        network: 'regtest',
        path: null,
        singleAddress: null
      });
      expect(result).to.have.property('pubKey');
      expect(result).to.have.property('path');
      expect(result).to.have.property('singleAddress');
    });

    it('should generate addresses using rpc then import to new wallet', async () => {
      const walletName = 'Test Wallet 2';
      const password = 'iamsatoshi2';
      const chain = 'BTC';
      const network = 'regtest';
      const baseUrl = 'http://localhost:3000/api';
      let lockedWallet: Wallet;
      const chainConfig = config.chains[chain][network];
      const creds = chainConfig.rpc;
      const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

      const address1 = await rpc.getnewaddress('');

      const importAddressJSON = {
        keys: [{ address: address1 }]
      };

      lockedWallet = await Wallet.create({
        name: walletName,
        chain,
        network,
        baseUrl,
        password
      });

      const unlockedWallet = await lockedWallet.unlock(password);

      await unlockedWallet.importKeys(importAddressJSON);

      let result = await WalletStorage.collection.findOne({
        name: walletName,
        chain,
        network
      });

      if (result && result._id) {
        const importResult = await WalletAddressStorage.collection
          .find({
            wallet: result._id,
            chain,
            network,
            address: address1
          })
          .toArray();

        expect(importResult[0]).to.have.deep.property('chain', chain);
        expect(importResult[0]).to.have.deep.property('network', network);
        expect(importResult[0]).to.have.deep.property('wallet', result._id);
        expect(importResult[0]).to.have.deep.property('address', address1);
        expect(importResult[0]).to.have.deep.property('processed', true);
      }
    });
  });
});
