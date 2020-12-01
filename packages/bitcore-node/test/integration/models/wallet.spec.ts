import { Wallet } from 'bitcore-client';
import { expect } from 'chai';
import config from '../../../src/config';
import { WalletStorage } from '../../../src/models/wallet';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { AsyncRPC } from '../../../src/rpc';
import { Api } from '../../../src/services/api';
import { Event } from '../../../src/services/event';
import { intAfterHelper, intBeforeHelper } from '../../helpers/integration';

let lockedWallet: Wallet;
const walletName = 'Test Wallet';
const password = 'iamsatoshi';
const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

describe('Wallet Model', function() {
  const suite = this;
  this.timeout(50000);
  before(intBeforeHelper);
  after(async () => intAfterHelper(suite));

  before(async () => {
    await Event.start();
    await Api.start();
  });

  after(async () => {
    await Event.stop();
    await Api.stop();
  });

  describe('Wallet Create', () => {
    it('should return a locked wallet on create', async () => {
      const baseUrl = 'http://localhost:3000/api';

      lockedWallet = await Wallet.create({
        name: walletName,
        chain,
        network,
        baseUrl,
        password
      });

      expect(lockedWallet).to.have.includes({
        name: walletName,
        chain,
        network,
        baseUrl: 'http://localhost:3000/api'
      });
      expect(lockedWallet).to.have.property('pubKey');
      expect(lockedWallet).to.have.property('password');
      expect(lockedWallet).to.have.property('authKey');
      expect(lockedWallet).to.have.property('encryptionKey');

      const findCreatedWallet = await WalletStorage.collection
        .find({
          name: walletName,
          chain,
          network
        })
        .toArray();

      expect(findCreatedWallet[0]).to.includes({
        name: walletName,
        chain,
        network,
        path: null,
        singleAddress: null
      });
      expect(findCreatedWallet[0]).to.have.property('pubKey');
      expect(findCreatedWallet[0]).to.have.property('path');
      expect(findCreatedWallet[0]).to.have.property('singleAddress');
    });
  });

  describe('Wallet functions', () => {
    let address1: string;

    it('should generate addresses using rpc then import to wallet', async () => {
      address1 = await rpc.getnewaddress('');

      const importAddressJSON = {
        keys: [{ address: address1 }]
      };

      const unlockedWallet = await lockedWallet.unlock(password);

      await unlockedWallet.importKeys(importAddressJSON);

      const findWalletResult = await WalletStorage.collection.findOne({
        name: walletName,
        chain,
        network
      });

      if (findWalletResult && findWalletResult._id) {
        const findAddressResult = await WalletAddressStorage.collection
          .find({
            wallet: findWalletResult._id,
            chain,
            network,
            address: address1
          })
          .toArray();

        expect(findAddressResult[0]).to.have.deep.property('chain', chain);
        expect(findAddressResult[0]).to.have.deep.property('network', network);
        expect(findAddressResult[0]).to.have.deep.property('wallet', findWalletResult._id);
        expect(findAddressResult[0]).to.have.deep.property('address', address1);
        expect(findAddressResult[0]).to.have.deep.property('processed', true);
      }
    });
  });
});
