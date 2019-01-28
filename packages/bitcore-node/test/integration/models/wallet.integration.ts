import { expect } from 'chai';
import { Wallet } from 'bitcore-client';
import { Api } from '../../../src/services/api';
import { Event } from '../../../src/services/event';
import { WalletStorage } from '../../../src/models/wallet';

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
  });
});
