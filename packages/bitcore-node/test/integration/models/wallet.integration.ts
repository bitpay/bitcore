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
import { IEvent } from '../../../src/models/events';

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

    it('should return correct coin and tx to verify 50 benchmark mempool tx, utxos stream, and wallet balance', async () => {
      const p2pWorker = new P2pWorker({ chain, network, chainConfig });
      const value = 0.1;
      const numTransactions = 25;
      let sentTransactionIds = new Array<string>();
      let lastTxid;

      /**
       * Gets a stream of coins then splices each index of coin txid in newTxidList
       * addressCoinEvent stream does not return coins in order of creation
       */
      let sawEvents = new Promise(resolve => {
        const seenTxids = new Array<string>();
        Event.addressCoinEvent.on('coin', async (addressCoin: IEvent.CoinEvent) => {
          const { coin } = addressCoin;
          const mintTxid = coin.mintTxid!;
          if (!seenTxids.includes(mintTxid) && sentTransactionIds.includes(mintTxid)) {
            seenTxids.push(mintTxid);
            if (seenTxids.length === numTransactions) {
              resolve();
            }
          }
        });
      });

      await p2pWorker.start();
      await rpc.generate(5);
      await p2pWorker.syncDone();

      const beforeGenTip = await BlockStorage.getLocalTip({ chain, network });
      if (beforeGenTip && beforeGenTip.height && beforeGenTip.height < 100) {
        await rpc.generate(100);
      }

      await rpc.generate(10);
      await p2pWorker.syncDone();
      await wait(3000);

      for (let i = 0; i < numTransactions; i++) {
        let sentTxId = await rpc.sendtoaddress(address1, value);
        lastTxid = sentTxId;
        sentTransactionIds.push(sentTxId);
      }

      // Slice keeps txidList intact and creates a new array
      await sawEvents;
      await wait(5000);

      expect(lastTxid).to.deep.equal(sentTransactionIds[numTransactions - 1]);

      const confirmTx = await TransactionStorage.collection
        .find({
          chain,
          network,
          txid: { $in: sentTransactionIds }
        })
        .toArray();

      const txids = confirmTx.map(tx => tx.txid);
      const txChain = confirmTx.map(tx => tx.chain);
      const txNetwork = confirmTx.map(tx => tx.network);

      for (let txid of sentTransactionIds) {
        expect(txids).to.include(txid);
        expect(txChain.includes(chain)).to.be.true;
        expect(txNetwork.includes(network)).to.be.true;
        expect(confirmTx.length).to.deep.equal(sentTransactionIds.length);
      }

      let confirmTxBlockHeight = confirmTx.map(tx => tx.blockHeight);
      const confirmCoin = await CoinStorage.collection
        .find({
          chain,
          network,
          mintTxid: { $in: sentTransactionIds },
          address: address1,
          mintHeight: { $in: confirmTxBlockHeight }
        })
        .toArray();

      const coinMintTxid = confirmCoin.map(tx => tx.mintTxid);
      const coinChain = confirmCoin.map(tx => tx.chain);
      const coinNetwork = confirmCoin.map(tx => tx.network);
      const coinAddress = confirmCoin.map(tx => tx.address);
      const coinMintHeight = confirmCoin.map(tx => tx.mintHeight);

      for (let tx of confirmTx) {
        if (tx && tx.blockHeight) {
          expect(coinMintTxid.includes(tx.txid)).to.be.true;
          expect(coinChain.includes(tx.chain)).to.be.true;
          expect(coinNetwork.includes(tx.network)).to.be.true;
          expect(coinAddress.includes(address1)).to.be.true;
          expect(coinMintHeight.includes(tx.blockHeight)).to.be.true;
        }
      }

      const getUtxosResult = await lockedWallet.getUtxos({ includeSpent: true });

      getUtxosResult.pipe(new ParseApiStream()).on('data', (coin: ICoin) => {
        expect(sentTransactionIds).to.include(coin.mintTxid);
        expect(coin).to.have.deep.property('chain', chain);
        expect(coin).to.have.deep.property('network', network);
        expect(coin).to.have.deep.property('address', address1);
      });

      const getWalletBalance = await lockedWallet.getBalance();
      expect(getWalletBalance.confirmed).to.deep.equal(0);
      expect(getWalletBalance.unconfirmed).to.deep.equal(value * numTransactions * 1e8);
      expect(getWalletBalance.balance).to.deep.equal(getWalletBalance.unconfirmed + getWalletBalance.confirmed);

      const { heapUsed } = process.memoryUsage();
      expect(heapUsed).to.be.below(3e8);
      await p2pWorker.stop();
    });
  });
});
