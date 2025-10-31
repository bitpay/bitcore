'use strict';

import chai from 'chai';
import 'chai/register-should';
import mongodb from 'mongodb';
import util from 'util';
import { Storage } from '../src/lib/storage';
import * as Model from '../src/lib/model';
import config from './test-config';
import helpers from './integration/helpers';

const should = chai.should();

describe('Storage', function() {
  let client, storage;
  before(function(done) {
    mongodb.MongoClient.connect(config.mongoDb.uri, { useUnifiedTopology: true }, function(err, inclient) {
      if (err) throw err;
      client = inclient;
      const db1 = client.db(config.mongoDb.dbname);
      storage = new Storage({
        db: db1,
      });
      done();
    });
  });
  beforeEach(function(done) {
    if (!client) return done();
    const db1 = client.db(config.mongoDb.dbname);
    db1.dropDatabase(function(err) {
      return done();
    });
  });

  describe('Store & fetch wallet', function() {
    it('should correctly store and fetch wallet', function(done) {
      const wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        coin: 'btc',
        chain: 'btc',
        network: 'livenet',
        pubKey: '',
        singleAddress: false,
        derivationStrategy: 'BIP45',
        addressType: 'P2SH',
      });
      should.exist(wallet);
      storage.storeWallet(wallet, function(err) {
        should.not.exist(err);
        storage.fetchWallet('123', function(err, w) {
          should.not.exist(err);
          should.exist(w);
          w.id.should.equal(wallet.id);
          w.name.should.equal(wallet.name);
          w.m.should.equal(wallet.m);
          w.n.should.equal(wallet.n);
          done();
        });
      });
    });
    it('should not return error if wallet not found', function(done) {
      storage.fetchWallet('123', function(err, w) {
        should.not.exist(err);
        should.not.exist(w);
        done();
      });
    });
  });

  describe('Copayer lookup', function() {
    it('should correctly store and fetch copayer lookup', function(done) {
      const wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        coin: 'btc',
        chain: 'btc',
        network: 'livenet',
        pubKey: '',
        singleAddress: false,
        derivationStrategy: 'BIP45',
        addressType: 'P2SH',
      });
      for (let i = 0; i < 3; i++) {
        const copayer = Model.Copayer.create({
          coin: 'btc',
          name: 'copayer ' + i,
          xPubKey: 'xPubKey ' + i,
          requestPubKey: 'requestPubKey ' + i,
          signature: 'xxx',
        });
        wallet.addCopayer(copayer);
      }

      should.exist(wallet);
      storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
        should.not.exist(err);
        storage.fetchCopayerLookup(wallet.copayers[1].id, function(err, lookup) {
          should.not.exist(err);
          should.exist(lookup);
          lookup.walletId.should.equal('123');
          lookup.requestPubKeys[0].key.should.equal('requestPubKey 1');
          lookup.requestPubKeys[0].signature.should.equal('xxx');
          done();
        });
      });
    });
    it('should not return error if copayer not found', function(done) {
      storage.fetchCopayerLookup('2', function(err, lookup) {
        should.not.exist(err);
        should.not.exist(lookup);
        done();
      });
    });
  });

  describe.skip('Advertisements', function() {
    // not yet implemented
  });

  describe('Transaction proposals', function() {
    let wallet, proposals;

    beforeEach(async function() {
      wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        coin: 'btc',
        chain: 'btc',
        network: 'livenet',
        pubKey: '',
        singleAddress: false,
        derivationStrategy: 'BIP45',
        addressType: 'P2SH',
      });
      for (let i = 0; i < 3; i++) {
        const copayer = Model.Copayer.create({
          coin: 'btc',
          name: 'copayer ' + i,
          xPubKey: 'xPubKey ' + i,
          requestPubKey: 'requestPubKey ' + i,
          signature: 'signarture ' + i,
        });
        wallet.addCopayer(copayer);
      }
      should.exist(wallet);
      await util.promisify(storage.storeWalletAndUpdateCopayersLookup).call(storage, wallet);

      proposals = [];
      for (let i = 0; i < 4; i++) {
        const tx = Model.TxProposal.create({
          walletId: '123',
          coin: 'btc',
          network: 'livenet',
          outputs: [{
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: i + 100,
          }],
          feePerKb: 100e2,
          creatorId: wallet.copayers[0].id,
        });
        if (i % 2 == 0) {
          tx.status = 'pending';
          tx.isPending().should.be.true;
        } else {
          tx.status = 'rejected';
          tx.isPending().should.be.false;
        }
        tx.txid = 'txid' + i;
        proposals.push(tx);
      }
      for (const tx of proposals) {
        await util.promisify(storage.storeTx).call(storage, '123', tx);
      }
    });
    it('should fetch tx', function(done) {
      storage.fetchTx('123', proposals[0].id, function(err, tx) {
        should.not.exist(err);
        should.exist(tx);
        tx.id.should.equal(proposals[0].id);
        tx.walletId.should.equal(proposals[0].walletId);
        tx.creatorName.should.equal('copayer 0');
        done();
      });
    });
    it('should fetch tx by hash', function(done) {
      storage.fetchTxByHash('txid0', function(err, tx) {
        should.not.exist(err);
        should.exist(tx);
        tx.id.should.equal(proposals[0].id);
        tx.walletId.should.equal(proposals[0].walletId);
        tx.creatorName.should.equal('copayer 0');
        done();
      });
    });

    it('should fetch all pending txs', function(done) {
      storage.fetchPendingTxs('123', function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(2);
        txs.sort((a, b) => a.amount - b.amount);
        txs[0].amount.should.equal(100);
        txs[1].amount.should.equal(102);
        done();
      });
    });
    it('should remove tx', function(done) {
      storage.removeTx('123', proposals[0].id, function(err) {
        should.not.exist(err);
        storage.fetchTx('123', proposals[0].id, function(err, tx) {
          should.not.exist(err);
          should.not.exist(tx);
          storage.fetchTxs('123', {}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(3);
            txs.some(tx => tx.id === proposals[0].id).should.be.false;
            done();
          });
        });
      });
    });
  });
  describe('History Cache v8', () => {
    it('should fail is TX does not have blochchain height', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [{ txid: '1234' }]; // a single tx.
      const updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        err.toString().should.contain('missing blockheight');
        done();
      });
    });


    it('should store a single tx on the cache and update status correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [{ txid: '1234', blockheight: 800 }]; // a single tx.
      const updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.getTxHistoryCacheStatusV8('xx', (err, inCacheStatus) => {
          should.not.exist(err);
          inCacheStatus.tipIndex.should.equal(81);
          inCacheStatus.tipTxId.should.equal('1234');
          inCacheStatus.tipHeight.should.equal(800);
          inCacheStatus.updatedHeight.should.equal(1000);
          done();
        });
      });
    });


    it('should store a 5 txs on the cache and update status correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [
        { txid: '1234', blockheight: 803 },    // / <=== Latests
        { txid: '1235', blockheight: 802 },
        { txid: '1236', blockheight: 801 },
        { txid: '1237', blockheight: 801 },
        { txid: '1238', blockheight: 800 },
      ];
      const updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.getTxHistoryCacheStatusV8('xx', (err, inCacheStatus) => {
          should.not.exist(err);
          inCacheStatus.tipIndex.should.equal(85);
          inCacheStatus.tipTxId.should.equal('1234');
          inCacheStatus.tipHeight.should.equal(803);
          inCacheStatus.updatedHeight.should.equal(1000);
          done();
        });
      });
    });

    it('should prevent to store txs on wrong order', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [
        { txid: '1234', blockheight: 803 },    // / <=== Latests
        { txid: '1235', blockheight: 802 },
        { txid: '1236', blockheight: 801 },
        { txid: '1237', blockheight: 801 },
        { txid: '1238', blockheight: 800 },
      ];
      const updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items.reverse(), updateHeight, (err) => {
        err.toString().should.contain('wrong order');
        done();
      });
    });

    it('should store a 100 txs on the cache and update status correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = helpers.createTxsV8(101, 1000);

      // this is done by _normalizeV8TxHistory
      for (const x of items) {
        x.blockheight = x.height;
      }

      // remove unconfirmed
      items.shift();

      const updateHeight = 50000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.getTxHistoryCacheStatusV8('xx', (err, inCacheStatus) => {
          should.not.exist(err);
          inCacheStatus.tipIndex.should.equal(80 + 100);
          inCacheStatus.tipTxId.should.equal('txid1');
          inCacheStatus.tipHeight.should.equal(1000);
          inCacheStatus.updatedHeight.should.equal(updateHeight);
          done();
        });
      });
    });

    it('should store a 1tx on the cache and retreive them correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [{ txid: '1234', blockheight: 800, amount: 100 }]; // a single tx.
      const updateHeight = 1000;

      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.getTxHistoryCacheV8('xx', 0, 5, (err, txs) => {
          should.not.exist(err);
          txs.length.should.equal(1);
          txs[0].blockheight.should.equal(800);
          done();
        });
      });
    });

    it('should clear all cache on deregistration', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [{ txid: '1234', blockheight: 800, amount: 100 }]; // a single tx.
      const updateHeight = 1000;

      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.deregisterWallet('xx', (err) => {
          should.not.exist(err);
          storage.getTxHistoryCacheV8('xx', 0, 5, (err, txs) => {
            should.not.exist(err);
            txs.length.should.equal(0);
            done();
          });
        });
      });
    });



    it('should store a 5 txs on the cache and retreive them correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [
        { txid: '1234', blockheight: 803 },    // / <=== Latests
        { txid: '1235', blockheight: 802 },
        { txid: '1236', blockheight: 801 },
        { txid: '1237', blockheight: 800 },
        { txid: '1238', blockheight: 800 },
      ];
      const updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);
        storage.getTxHistoryCacheV8('xx', 0, 5, (err, txs) => {
          should.not.exist(err);
          txs.length.should.equal(5);
          txs[0].blockheight.should.equal(803);
          txs[4].blockheight.should.equal(800);
          txs[4].txid.should.equal('1238'); // should preserve order
          done();
        });
      });
    });


    it('should store a 10 txs on the cache and retreive them correctly', (done) => {
      const tipIndex = 80; // current cache tip
      const items = [
        { txid: '1234', blockheight: 803 },    // / <=== Latests
        { txid: '1235', blockheight: 802 },
        { txid: '1236', blockheight: 801 },
        { txid: '1237', blockheight: 800 },
        { txid: '1238', blockheight: 800 },
      ];
      let updateHeight = 1000;
      storage.storeTxHistoryCacheV8('xx', tipIndex, items, updateHeight, (err) => {
        should.not.exist(err);

        // time passes
        updateHeight = 2000;
        const items2 = [
          { txid: '124', blockheight: 1803 },    // / <=== Latests
          { txid: '125', blockheight: 1802 },
          { txid: '126', blockheight: 1801 },
          { txid: '127', blockheight: 1800 },
          { txid: '128', blockheight: 1800 },
        ];

        storage.getTxHistoryCacheStatusV8('xx', (err, inCacheStatus) => {
          should.not.exist(err);
          inCacheStatus.tipIndex.should.equal(85);
          storage.storeTxHistoryCacheV8('xx', inCacheStatus.tipIndex, items2, updateHeight, (err) => {
            should.not.exist(err);

            storage.getTxHistoryCacheV8('xx', 0, 100, (err, txs) => {
              should.not.exist(err);
              txs.length.should.equal(10);
              txs[0].blockheight.should.equal(1803);
              txs[9].blockheight.should.equal(800);
              txs[9].txid.should.equal('1238'); // should preserve order
              done();
            });
          });
        });
      });
    });


  });
});
