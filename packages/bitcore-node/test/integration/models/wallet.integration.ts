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

    it('should return correct coin and tx to verify 100 benchmark mempool tx, utxos stream, and wallet balance', async () => {
      const p2pWorker = new P2pWorker({ chain, network, chainConfig });
      let txidList = new Array<string>();
      const value = 0.1;
      let lastTxid;
      let setOnce = false;
      let newTxidList = new Array<string>();
      let updatedList = new Array<string>();

      let sawEvents = new Promise(resolve => {
        Event.addressCoinEvent.on('coin', async addressCoin => {
          const { coin } = addressCoin;
          if (setOnce) {
            newTxidList = txidList.map(e => e);
            setOnce = true;
          }
          const foundIndex = newTxidList.indexOf(coin.mintTxid);
          updatedList = newTxidList.slice(foundIndex, 1);
          console.log(updatedList.length);
          // if (notSeen.length === 0) {
          await wait(20000);
          resolve();
          // }
        });
      });

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

      for (let i = 0; i < 100; i++) {
        const sentTxId = await rpc.sendtoaddress(address1, value);
        lastTxid = sentTxId;
        txidList.push(sentTxId);
      }

      await sawEvents;

      expect(lastTxid).to.deep.equal(txidList[99]);

      const confirmTx = await TransactionStorage.collection
        .find({
          chain,
          network,
          txid: { $in: txidList }
        })
        .toArray();

      for (let txid of txidList) {
        expect(confirmTx.map(tx => tx.txid)).to.include(txid);
        expect(confirmTx.map(tx => tx.chain).includes(chain)).to.be.true;
        expect(confirmTx.map(tx => tx.network).includes(network)).to.be.true;
        expect(confirmTx.length).to.deep.equal(txidList.length);
      }

      for (let tx of confirmTx) {
        if (tx && tx.blockHeight) {
          const confirmCoin = await CoinStorage.collection
            .find({
              chain,
              network,
              mintTxid: { $in: txidList },
              address: address1,
              mintHeight: { $in: confirmTx.map(tx => tx.blockHeight) },
              spentHeight: -2
            })
            .toArray();

          expect(confirmCoin.map(tx => tx.mintTxid).includes(tx.txid)).to.be.true;
          expect(confirmCoin.map(tx => tx.chain).includes(tx.chain)).to.be.true;
          expect(confirmCoin.map(tx => tx.network).includes(tx.network)).to.be.true;
          expect(confirmCoin.map(tx => tx.address).includes(address1)).to.be.true;
          expect(confirmCoin.map(tx => tx.mintHeight).includes(tx.blockHeight)).to.be.true;
          expect(confirmCoin.map(tx => tx.spentHeight).includes(-2)).to.be.true;
        }
      }

      const getUtxosResult = await lockedWallet.getUtxos({ includeSpent: true });

      getUtxosResult.pipe(new ParseApiStream()).on('data', (coin: ICoin) => {
        expect(txidList.map(txid => txid)).to.include(coin.mintTxid);
        expect(coin).to.have.deep.property('chain', chain);
        expect(coin).to.have.deep.property('network', network);
        expect(coin).to.have.deep.property('address', address1);
        expect(coin).to.have.deep.property('spentHeight', -2);
      });

      const getWalletBalance = await lockedWallet.getBalance(null);
      console.log(getWalletBalance);
      expect(getWalletBalance.confirmed).to.deep.equal(0);
      expect(getWalletBalance.unconfirmed).to.deep.equal(value * 100 * 1e8);
      expect(getWalletBalance.balance).to.deep.equal(getWalletBalance.unconfirmed + getWalletBalance.confirmed);

      const { heapUsed } = process.memoryUsage();
      expect(heapUsed).to.be.below(3e8);

      await p2pWorker.stop();
    });
  });
});
