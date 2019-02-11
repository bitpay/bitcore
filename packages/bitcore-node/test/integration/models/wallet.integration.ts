import { expect } from 'chai';
import { Wallet, ParseApiStream } from 'bitcore-client';
import { Api } from '../../../src/services/api';
import { AsyncRPC } from '../../../src/rpc';
import { Event } from '../../../src/services/event';
import { WalletStorage } from '../../../src/models/wallet';
import config from '../../../src/config';
import { BlockStorage } from '../../../src/models/block';
import { WalletAddressStorage } from '../../../src/models/walletAddress';
import { TransactionStorage } from '../../../src/models/transaction';
import { CoinStorage, ICoin } from '../../../src/models/coin';
import { P2pWorker } from '../../../src/services/p2p';
import { wait } from '../../../src/utils/wait';

let lockedWallet: Wallet;
const walletName = 'Test Wallet';
const password = 'iamsatoshi';
const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

describe('Wallet Model', function() {
  this.timeout(50000);
  describe('Wallet Create', () => {
    it('should return a locked wallet on create', async () => {
      const baseUrl = 'http://localhost:3000/api';
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
        name: walletName,
        chain,
        network,
        baseUrl: 'http://localhost:3000/api/BTC/regtest'
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

    it('should return correct coin and tx to verify mempool tx, utxos stream, and wallet balance', async () => {
      const p2pWorker = new P2pWorker({ chain, network, chainConfig });
      const value = 0.1;

      const sawEvents = new Promise(resolve => Event.addressCoinEvent.on('coin', resolve));

      await p2pWorker.start();
      await rpc.generate(5);
      await p2pWorker.syncDone();

      const beforeGenTip = await BlockStorage.getLocalTip({ chain, network });
      if (beforeGenTip && beforeGenTip.height && beforeGenTip.height < 100) {
        await rpc.generate(100);
      }

      await rpc.generate(1);
      await p2pWorker.syncDone();
      await wait(3000);

      const sentTxId = await rpc.sendtoaddress(address1, value);

      await sawEvents;

      const confirmTx = await TransactionStorage.collection
        .find({
          chain,
          network,
          txid: sentTxId
        })
        .toArray();

      expect(confirmTx[0]).to.have.deep.property('chain', chain);
      expect(confirmTx[0]).to.have.deep.property('network', network);
      expect(confirmTx[0]).to.have.deep.property('txid', sentTxId);
      expect(confirmTx[0]).to.have.property('value');
      expect(confirmTx[0]).to.have.property('blockHeight');

      if (confirmTx) {
        const confirmCoin = await CoinStorage.collection.findOne({
          chain,
          network,
          mintTxid: confirmTx[0].txid,
          address: address1,
          mintHeight: confirmTx[0].blockHeight,
          spentHeight: -2
        });

        expect(confirmCoin).to.have.deep.property('chain', chain);
        expect(confirmCoin).to.have.deep.property('network', network);
        expect(confirmCoin).to.have.deep.property('mintTxid', sentTxId);
        expect(confirmCoin).to.have.deep.property('address', address1);
        expect(confirmCoin).to.have.deep.property('mintHeight', confirmTx[0].blockHeight);
        expect(confirmCoin).to.have.deep.property('spentHeight', -2);
        expect(confirmCoin).to.have.property('mintIndex');
        expect(confirmCoin).to.have.property('value');
      }
      const getUtxosResult = await lockedWallet.getUtxos({ includeSpent: true });

      getUtxosResult.pipe(new ParseApiStream()).on('data', (coin: ICoin) => {
        expect(coin).to.have.deep.property('chain', chain);
        expect(coin).to.have.deep.property('network', network);
        expect(coin).to.have.deep.property('mintTxid', sentTxId);
        expect(coin).to.have.deep.property('address', address1);
        expect(coin).to.have.deep.property('spentHeight', -2);
      });

      const getWalletBalance = await lockedWallet.getBalance();
      expect(getWalletBalance.confirmed).to.deep.equal(0);
      expect(getWalletBalance.unconfirmed).to.deep.equal(value * 1e8);
      expect(getWalletBalance.balance).to.deep.equal(getWalletBalance.unconfirmed + getWalletBalance.confirmed);

      await p2pWorker.stop();
    });
  });
});
