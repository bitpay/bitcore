import * as io from 'socket.io-client';
import { wait } from '../../src/utils/wait';
import { expect } from 'chai';
import { AsyncRPC } from '../../src/rpc';
import config from '../../src/config';
import { createWallet } from '../benchmark/wallet-benchmark';
import { Event } from '../../src/services/event';
import { Api } from '../../src/services/api';
import { WalletAddressStorage } from '../../src/models/walletAddress';
import { WalletStorage, IWallet } from '../../src/models/wallet';
import { ParseApiStream } from 'bitcore-client';
import { P2pWorker } from '../../src/services/p2p';
import { resetDatabase } from '../helpers';
import { Wallet } from 'bitcore-client';
import { ICoin, CoinStorage } from '../../src/models/coin';
import { MongoBound } from '../../src/models/base';
import { ObjectId } from 'mongodb';

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
async function checkWalletReceived(wallet: IWallet, txid: string, address: string) {
  const broadcastedOutput = await CoinStorage.collection.findOne({
    chain,
    network,
    mintTxid: txid,
    address: address
  });

  expect(broadcastedOutput!.address).to.eq(address);
  expect(broadcastedOutput!.wallets.length).to.eq(1);
  expect(broadcastedOutput!.wallets[0].toHexString()).to.eq(wallet!._id!.toHexString());
}

describe('Wallet Benchmark', function() {
  this.timeout(50000);
  before(async () => {
    await resetDatabase();
  });
  describe('Wallet import', () => {
    it('should be able to create two wallets and have them interact', async () => {
      await Event.start();
      await Api.start();
      const p2pWorker = new P2pWorker({
        chain,
        network,
        chainConfig
      });
      await p2pWorker.start();

      const seenCoins = new Set();
      const socket = io.connect(
        'http://localhost:3000',
        { transports: ['websocket'] }
      );
      socket.on('connect', () => {
        const room = `/${chain}/${network}/inv`;
        socket.emit('room', room);
      });
      socket.on('coin', (coin: ICoin) => {
        seenCoins.add(coin.mintTxid);
      });

      const address1 = await rpc.getnewaddress('');
      const address2 = await rpc.getnewaddress('');
      await rpc.call('generatetoaddress', [1, address1]);
      await rpc.call('generatetoaddress', [1, address2]);
      await rpc.generate(100);
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
      const signedTx = await rpc.call('signrawtransaction', [fundedTx.hex]);
      const broadcastedTx = await rpc.call('sendrawtransaction', [signedTx.hex]);
      while (!seenCoins.has(broadcastedTx)) {
        await wait(1000);
      }
      await verifyCoinSpent(utxos[0], broadcastedTx, dbWallet1!);
      await checkWalletReceived(dbWallet1!, broadcastedTx, address1);
      await checkWalletReceived(dbWallet2!, broadcastedTx, address2);
      await wait(1000);
      await socket.disconnect();
      await p2pWorker.stop();
      await Event.stop();
      await Api.stop();
    });

    it('should import all addresses and verify in database while below 300 mb of heapUsed memory', async () => {
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
