import { Wallet } from 'bitcore-client';
import { ParseApiStream } from 'bitcore-client';
import { expect } from 'chai';
import { ObjectId } from 'mongodb';
import * as io from 'socket.io-client';
import config from '../../src/config';
import { MongoBound } from '../../src/models/base';
import { CoinStorage, ICoin } from '../../src/models/coin';
import { TransactionStorage } from '../../src/models/transaction';
import { IWallet, WalletStorage } from '../../src/models/wallet';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { BitcoinP2PWorker } from '../../src/modules/bitcoin/p2p';
import { AsyncRPC } from '../../src/rpc';
import { Api } from '../../src/services/api';
import { Event } from '../../src/services/event';
import { wait } from '../../src/utils/wait';
import { createWallet } from '../benchmark/wallet-benchmark';
import { resetDatabase } from '../helpers';
import { intAfterHelper, intBeforeHelper } from '../helpers/integration';

const chain = 'BTC';
const network = 'regtest';
const chainConfig = config.chains[chain][network];
const creds = chainConfig.rpc;
const rpc = new AsyncRPC(creds.username, creds.password, creds.host, creds.port);

async function checkWalletExists(pubKey, expectedAddress) {
  // Check the database for the first wallet
  const dbWallet = await WalletStorage.collection.findOne({
    chain,
    network,
    pubKey
  });

  // Verify the addresses match
  const foundAddresses = await WalletAddressStorage.collection
    .find({
      chain,
      network,
      wallet: dbWallet!._id
    })
    .toArray();
  expect(foundAddresses.length).to.eq(1);
  expect(foundAddresses[0].address).to.eq(expectedAddress);
  return dbWallet;
}

async function getWalletUtxos(wallet: Wallet) {
  const utxos = new Array<MongoBound<ICoin>>();
  return new Promise<Array<MongoBound<ICoin>>>(resolve =>
    wallet
    .getUtxos()
    .pipe(new ParseApiStream())
    .on('data', (utxo: MongoBound<ICoin>) => {
      utxos.push(utxo);
    })
    .on('end', () => resolve(utxos))
  );
}

async function checkWalletUtxos(wallet: Wallet, expectedAddress: string) {
  const utxos = await getWalletUtxos(wallet);
  expect(utxos.length).to.eq(1);
  expect(utxos[0].address).to.eq(expectedAddress);
  return utxos;
}

async function verifyCoinSpent(coin: MongoBound<ICoin>, spentTxid: string, wallet: IWallet) {
  const wallet1Coin = await CoinStorage.collection.findOne({ _id: new ObjectId(coin._id) });
  expect(wallet1Coin!.spentTxid).to.eq(spentTxid);
  expect(wallet1Coin!.wallets[0].toHexString()).to.eq(wallet!._id!.toHexString());
}
async function checkWalletReceived(receivingWallet: IWallet, txid: string, address: string, sendingWallet: IWallet) {
  const broadcastedOutput = await CoinStorage.collection.findOne({
    chain,
    network,
    mintTxid: txid,
    address
  });

  expect(broadcastedOutput!.address).to.eq(address);
  expect(broadcastedOutput!.wallets.length).to.eq(1);
  expect(broadcastedOutput!.wallets[0].toHexString()).to.eq(receivingWallet!._id!.toHexString());

  const broadcastedTransaction = await TransactionStorage.collection.findOne({ chain, network, txid });
  expect(broadcastedTransaction!.txid).to.eq(txid);
  expect(broadcastedTransaction!.fee).gt(0);

  const txWallets = broadcastedTransaction!.wallets.map(w => w.toHexString());
  expect(txWallets.length).to.eq(2);
  expect(txWallets).to.include(receivingWallet!._id!.toHexString());
  expect(txWallets).to.include(sendingWallet!._id!.toHexString());
}

describe('Wallet Benchmark', function() {
  const suite = this;
  this.timeout(5000000);
  let p2pWorker: BitcoinP2PWorker;

  before(async () => {
    await intBeforeHelper();
    await Event.start();
    await Api.start();
  });

  after(async () => {
    await Event.stop();
    await Api.stop();
    await intAfterHelper(suite);
  });

  beforeEach(async () => {
    await resetDatabase();
  });
  afterEach(async () => {
    if (p2pWorker) {
      await p2pWorker.stop();
    }
  });
  describe('Wallet import', () => {
    it('should be able to create two wallets and have them interact', async () => {
      const seenCoins = new Set();
      const socket = io.connect('http://localhost:3000', { transports: ['websocket'] });
      const connected = new Promise(r => {
        socket.on('connect', () => {
          const room = `/${chain}/${network}/inv`;
          socket.emit('room', room);
          console.log('Connected to socket');
          r();
        });
      });
      await connected;
      socket.on('coin', (coin: ICoin) => {
        seenCoins.add(coin.mintTxid);
      });

      p2pWorker = new BitcoinP2PWorker({
        chain,
        network,
        chainConfig
      });
      await p2pWorker.start();

      const address1 = await rpc.getnewaddress('');
      const address2 = await rpc.getnewaddress('');
      const anAddress = 'mkzAfSHtmTh5Xsc352jf6TBPj55Lne5g21';

      try {
        await rpc.call('generatetoaddress', [1, address1]);
        await rpc.call('generatetoaddress', [1, address2]);
        await rpc.call('generatetoaddress', [100, anAddress]);
        await p2pWorker.syncDone();

        const wallet1 = await createWallet([address1], 0, network);
        const wallet2 = await createWallet([address2], 1, network);
        const dbWallet1 = await checkWalletExists(wallet1.authPubKey, address1);
        const dbWallet2 = await checkWalletExists(wallet2.authPubKey, address2);
        const utxos = await checkWalletUtxos(wallet1, address1);
        await checkWalletUtxos(wallet2, address2);
        const tx = await rpc.call('createrawtransaction', [
          utxos.map(utxo => ({ txid: utxo.mintTxid, vout: utxo.mintIndex })),
          { [address1]: 0.1, [address2]: 0.1 }
        ]);
        const fundedTx = await rpc.call('fundrawtransaction', [tx]);
        const signedTx = await rpc.signrawtx(fundedTx.hex);
        const broadcastedTx = await rpc.call('sendrawtransaction', [signedTx.hex]);
        while (!seenCoins.has(broadcastedTx)) {
          console.log('...WAITING...'); // TODO
          await wait(1000);
        }
        await verifyCoinSpent(utxos[0], broadcastedTx, dbWallet1!);
        await checkWalletReceived(dbWallet1!, broadcastedTx, address1, dbWallet2!);
        await checkWalletReceived(dbWallet2!, broadcastedTx, address2, dbWallet1!);
        await wait(1000);
        await socket.disconnect();
        await p2pWorker.stop();
      } catch (e) {
        console.log('Error : ', e);
        expect(e).to.be.undefined;
      }
    });

    it('should be able to create two wallets and have them interact, while syncing', async () => {
      const seenCoins = new Set();
      const socket = io.connect('http://localhost:3000', { transports: ['websocket'] });
      const connected = new Promise(r => {
        socket.on('connect', () => {
          const room = `/${chain}/${network}/inv`;
          socket.emit('room', room);
          console.log('Connected to socket');
          r();
        });
      });
      await connected;
      socket.on('coin', (coin: ICoin) => {
        seenCoins.add(coin.mintTxid);
      });

      p2pWorker = new BitcoinP2PWorker({
        chain,
        network,
        chainConfig
      });
      await p2pWorker.start();

      const address1 = await rpc.getnewaddress('');
      const address2 = await rpc.getnewaddress('');
      const anAddress = 'mkzAfSHtmTh5Xsc352jf6TBPj55Lne5g21';

      try {
        await rpc.call('generatetoaddress', [1, address1]);
        await rpc.call('generatetoaddress', [1, address2]);

        // mature coins
        await rpc.call('generatetoaddress', [100, anAddress]);
        await p2pWorker.syncDone();

        const wallet1 = await createWallet([address1], 2, network);
        const wallet2 = await createWallet([address2], 3, network);
        const dbWallet1 = await checkWalletExists(wallet1.authPubKey, address1);
        const dbWallet2 = await checkWalletExists(wallet2.authPubKey, address2);
        const utxos = await checkWalletUtxos(wallet1, address1);
        await checkWalletUtxos(wallet2, address2);
        const tx = await rpc.call('createrawtransaction', [
          utxos.map(utxo => ({ txid: utxo.mintTxid, vout: utxo.mintIndex })),
          { [address1]: 0.1, [address2]: 0.1 }
        ]);
        const fundedTx = await rpc.call('fundrawtransaction', [tx]);
        const signedTx = await rpc.signrawtx(fundedTx.hex);

        await rpc.call('generatetoaddress', [100, anAddress]);
        p2pWorker.sync();
        expect(p2pWorker.isSyncing).to.be.true;

        // Generate some blocks for the node to process
        const broadcastedTx = await rpc.call('sendrawtransaction', [signedTx.hex]);
        expect(p2pWorker.isSyncing).to.be.true;
        while (!seenCoins.has(broadcastedTx)) {
          console.log('...WAITING...'); // TODO
          await wait(1000);
        }
        await verifyCoinSpent(utxos[0], broadcastedTx, dbWallet1!);
        await checkWalletReceived(dbWallet1!, broadcastedTx, address1, dbWallet2!);
        await checkWalletReceived(dbWallet2!, broadcastedTx, address2, dbWallet1!);
        await wait(1000);
        await socket.disconnect();
        await p2pWorker.stop();
      } catch (e) {
        console.log('Error : ', e);
        expect(e).to.be.undefined;
      }
    });

    it('should import all addresses and verify in database while below 300 mb of heapUsed memory', async () => {
      let smallAddressBatch = new Array<string>();
      let mediumAddressBatch = new Array<string>();
      let largeAddressBatch = new Array<string>();

      console.log('Generating small batch of addresses');
      for (let i = 0; i < 10; i++) {
        let address = await rpc.getnewaddress('');
        smallAddressBatch.push(address);
      }

      console.log('Generating medium batch of addresses');
      expect(smallAddressBatch.length).to.deep.equal(10);

      for (let i = 0; i < 100; i++) {
        let address = await rpc.getnewaddress('');
        mediumAddressBatch.push(address);
      }
      expect(mediumAddressBatch.length).to.deep.equal(100);

      console.log('Generating large batch of addresses');
      for (let i = 0; i < 1000; i++) {
        let address = await rpc.getnewaddress('');
        largeAddressBatch.push(address);
      }

      expect(largeAddressBatch.length).to.deep.equal(1000);

      console.log('Checking');
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
