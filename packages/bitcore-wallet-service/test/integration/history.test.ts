'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import util from 'util';
import sinon from 'sinon';
import log from 'npmlog';
import {
  BitcoreLib,
  BitcoreLibCash
} from 'crypto-wallet-core';
import { Common } from '../../src/lib/common';
import HugeTxs from './hugetx';
import * as TestData from '../testdata';
import helpers from './helpers';
import { WalletService } from '../../src/lib/server';
import { Wallet } from '../../src/lib/model';

log.debug = log.verbose;
const should = chai.should();
const { Defaults, Utils } = Common;
const Bitcore_ = {
  btc: BitcoreLib,
  bch: BitcoreLibCash
};

describe('History', function() {
  this.timeout(5000);
  let storage;
  let blockchainExplorer;
  let request;

  before(async function() {
    await helpers.before();
  });


  beforeEach(async function() {
    log.level = 'error';
    const res = await helpers.beforeEach();
    storage = res.storage;
    blockchainExplorer = res.blockchainExplorer;
    request = res.request;
  });

  after(async function() {
    await helpers.after();
  });

  const BCHEIGHT = 10000;

  describe('#getTxHistory', function() {
    let server: WalletService;
    let wallet: Wallet;
    let mainAddresses;
    let changeAddresses;

    beforeEach(async function() {
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, BCHEIGHT, 'hash');
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      ({ main: mainAddresses, change: changeAddresses } = await helpers.createAddresses(server, wallet, 1, 1));
      helpers.stubFeeLevels({ 24: 10000 });
      await helpers.stubCheckData(blockchainExplorer, server, wallet.coin == 'bch');
    });

    it('should get tx history from insight, 20 items', function(done) {
      helpers.stubHistory(50, BCHEIGHT);
      server.getTxHistory({ limit: 20 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          tx.txid.should.equal('txid' + i);
          tx.confirmations.should.equal(i);
          if (i) {
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
          } else {
            // The first one is unconfirmed
            should.not.exist(tx.blockheight);
          }
        }
        done();
      });
    });

    it('should filter out DUST amount', function(done) {
      const txs= helpers.createTxsV8(50, BCHEIGHT);
      txs[5].satoshis=100;
      txs[15].satoshis=10;
      txs[25].satoshis=1;

      helpers.stubHistory(null, null, txs);
      server.getTxHistory({ limit: 50 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(47);
        done();
      });
    });

    it('should handle 2 incoming payments on the same txs, 2 different addr', function(done) {
      const txs = helpers.createTxsV8(3, BCHEIGHT);
      txs[1].address = txs[0].address;
      txs[1].txid = txs[0].txid;
      txs[1].id = txs[0].id;
      txs[1].satoshis = 10000;
      txs[1].address = 'other address';
 
      helpers.stubHistory(null, null, txs);
      server.getTxHistory({ limit: 50 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(2);
        // one tx from 2 items
        txs[0].amount.should.equal(40001);
        txs[0].outputs.should.deep.equal([{
          address: 'muFJi3ZPfR5nhxyD7dfpx2nYZA8Wmwzgck',
          amount: 30001,
        }, {
          address: 'other address',
          amount: 10000,
        }]);
        txs[0].txid.should.equal('txid0');
        txs[1].amount.should.equal(30001);
        done();
      });
    });


    it('should handle 2 incoming payments on the same txs, 2 different addr, one dust', function(done) {
      const txs = helpers.createTxsV8(3, BCHEIGHT);
      txs[1].address = txs[0].address;
      txs[1].txid = txs[0].txid;
      txs[1].id = txs[0].id;
      txs[1].satoshis = 100;
      txs[1].address = 'other address';
 
      helpers.stubHistory(null, null, txs);
      server.getTxHistory({ limit: 50 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(2);
        // one tx from 2 items
        txs[0].amount.should.equal(30001);
        txs[0].outputs.should.deep.equal([{
          address: 'muFJi3ZPfR5nhxyD7dfpx2nYZA8Wmwzgck',
          amount: 30001,
        }]);
        txs[0].txid.should.equal('txid0');
        txs[1].amount.should.equal(30001);
        done();
      });
    });

    it('should handle moves, filtering change addresses (case 1)', function(done) {
      const txs = helpers.createTxsV8(20, 1000);
      helpers.createAddresses(server, wallet, 1, 1).then(({ main, change }) => {
        // 2 move tx.
        txs[0].address = change[0].address;
        txs[0].txid = txs[1].txid;
        txs[0].height = txs[1].height;
        txs[1].address = main[0].address;
        txs[0].category = txs[1].category = 'move';

        helpers.stubHistory(null, null, txs);

        server.getTxHistory({ limit: 10 }, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(10);
          // should filter out 1 move
          txs[0].action.should.equal('moved');
          txs[1].action.should.equal('received');
          // should keep the main address
          txs[0].outputs[0].address.should.equal(main[0].address);
          done();
        });
      });
    });


    it('should handle moves, filtering change addresses (case 2)', function(done) {
      const txs = helpers.createTxsV8(20, 1000);
      helpers.createAddresses(server, wallet, 1, 1).then(({ main, change }) => {
        // 2 move tx, inverted vouts
        txs[0].address = main[0].address;
        txs[0].txid = txs[1].txid;
        txs[0].height = txs[1].height;
        txs[1].address = change[0].address;
        txs[0].category = txs[1].category = 'move';

        helpers.stubHistory(null, null, txs);

        server.getTxHistory({ limit: 10 }, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(10);
          // should filter out 1 move
          txs[0].action.should.equal('moved');
          txs[1].action.should.equal('received');
          // should keep the main address
          txs[0].outputs[0].address.should.equal(main[0].address);
          done();
        });
      });
    });


    it('should handle moves, filtering change addresses in multisend', function(done) {
      const txs = helpers.createTxsV8(20, 1000);
      helpers.createAddresses(server, wallet, 2, 1).then(({ main, change }) => {
        txs[0].txid = txs[1].txid = txs[2].txid = txs[3].txid;
        txs[0].height = txs[1].height = txs[2].height = txs[3].height;
        txs[0].category = txs[1].category = txs[2].category = txs[3].category = 'move';
        txs[0].address = main[0].address;
        txs[1].address = main[0].address;
        txs[2].address = change[0].address;
        txs[3].address = main[1].address;

        helpers.stubHistory(null, null, txs);

        server.getTxHistory({ limit: 10 }, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(10);
          // should filter out 1 move
          txs[0].action.should.equal('moved');
          txs[1].action.should.equal('received');

          // should keep the main address
          txs[0].outputs.map(o => o.address).should.include(main[0].address, main[1].address);
          txs[0].outputs.map(o => o.address).should.not.include(change[0].address);
          done();
        });
      });
    });

    it('should get tx history from cache', function(done) {
      const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;
      helpers.stubHistory(50, BCHEIGHT); // (0->49)

      // this call is to fill the cache
      server.getTxHistory({ limit: 20 }, function(err, txs, fromCache) {
        fromCache = !!fromCache;
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        txs[0].id.should.equal('id0');
        server.getTxHistory({ skip: 20, limit: 10 }, function(err, txs, fromCache) {
          // first TX result should be:
          // txid: 19
          // confirmations: 19
          should.not.exist(err);
          fromCache.should.equal(true);
          should.exist(txs);
          txs.length.should.equal(10);
          txs[0].id.should.equal('id20');

          let i = 20;
          for (const tx of txs) {
            tx.txid.should.equal('txid' + i);
            tx.confirmations.should.equal(i);
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
            i++;
          }
          (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
          done();
        });
      });
    });

    it('should get tx history from cache and bc mixed', function(done) {
      const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;
      helpers.stubHistory(50, BCHEIGHT); // (0->49)

      // this call is to fill the cache
      server.getTxHistory({ limit: 20 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        txs[0].id.should.equal('id0');
        server.getTxHistory({ skip: 5, limit: 20 }, function(err, txs, fromCache) {
          // first TX result should be:
          // txid: 19
          // confirmations: 19
          should.not.exist(err);
          fromCache.should.equal(true);
          should.exist(txs);
          txs.length.should.equal(20);
          txs[0].id.should.equal('id5');

          let i = 5;
          for (const tx of txs) {
            tx.txid.should.equal('txid' + i);
            tx.confirmations.should.equal(i);
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
            i++;
          }
          (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
          done();
        });
      });
    });

    it('should get tx history from cache and bc mixed, updating confirmations', function(done) {
      const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      const _time = Defaults.BLOCKHEIGHT_CACHE_TIME.default;
      (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;

      // remove bc tip cache.
      (Defaults.BLOCKHEIGHT_CACHE_TIME as any) = { default: 0 };
      helpers.stubHistory(50, BCHEIGHT); // (0->49)

      // this call is to fill the cache
      server.getTxHistory({ limit: 20 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);

        // change height from 10000 to 10100
        const heightOffset = 100;
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 10000 + heightOffset, 'hash');
        server.getTxHistory({ skip: 5, limit: 20 }, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(true);
          let i = 5;
          for (const tx of txs) {
            tx.confirmations.should.equal(i + heightOffset);
            i++;
          }
          (Defaults.BLOCKHEIGHT_CACHE_TIME.default as any) = _time;
          (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
          done();
        });
      });
    });

    describe('Stream cache', () => {
      it('should not stream cache on first call', async function() {
        this.timeout(10000);
        const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;
        helpers.stubHistory(100, 10000);
        const limit = 20;
        let allTxs = [];

        // this call is to fill the cache
        const [txs, fromCache, useStream] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ limit: limit }, function(err, txs, fromCache, useStream) {
            if (err) return reject(err);
            resolve([txs, fromCache, useStream]);
          });
        });
        fromCache.should.equal(false);
        useStream.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(limit);
        txs[0].id.should.equal('id0');

        allTxs = allTxs.concat(txs);

        let i = limit;
        let cont = true;

        let x = false;
        do {
          const [txs, fromCache, useStream] = await new Promise<any>((resolve, reject) => {
            server.getTxHistory({ skip: i, limit: limit }, function(err, txs, fromCache, useStream) {
              if (err) return reject(err);
              resolve([txs, fromCache, useStream]);
            });
          });
          if (txs && txs.length < 20) {
            cont = false; 
          } else {
            fromCache.should.equal(true);
            useStream.should.equal(x);
            x = true;
            should.exist(txs);
            allTxs = allTxs.concat(txs);
            txs[0].id.should.equal('id' + i);
            i += limit;
          }
        } while (cont);

        i = 0;
        for (const x of allTxs) {
          x.id.should.equal('id' + i);
          i++;
        }
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
      });



      it('should get tx history from cache and bc mixed', async function() {
        this.timeout(10000);
        const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;
        helpers.stubHistory(1000, 10000); // (0->49)
        const limit = 20;
        let allTxs = [];

        // this call is to fill the cache
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ limit: limit }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(limit);
        txs[0].id.should.equal('id0');

        allTxs = allTxs.concat(txs);

        let i = limit;
        let cont = true;

        do {
          const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
            server.getTxHistory({ skip: i, limit: limit }, function(err, txs, fromCache) {
              if (err) return reject(err);
              resolve([txs, fromCache]);
            });
          });
          if (txs && txs.length < 20) {
            cont = false;
          } else {
            fromCache.should.equal(true);
            should.exist(txs);
            allTxs = allTxs.concat(txs);
            txs[0].id.should.equal('id' + i);
            i += limit;
          }
        } while (cont);

        i = 0;
        for (const x of allTxs) {
          x.id.should.equal('id' + i);
          i++;
        }
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
      });

      it('should download history with prime page size and total txs', async function() {
        this.timeout(10000);
        const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 10;
        helpers.stubHistory(997, 10000); // (0->49)
        const limit = 17;
        let allTxs = [];

        // this call is to fill the cache
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ limit: limit }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(limit);
        txs[0].id.should.equal('id0');

        allTxs = allTxs.concat(txs);

        let i = limit;
        let cont = true;

        do {
          const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
            server.getTxHistory({ skip: i, limit: limit }, function(err, txs, fromCache) {
              if (err) return reject(err);
              resolve([txs, fromCache]);
            });
          });
          if (txs && txs.length < limit) {
            cont = false;
          } else {
            fromCache.should.equal(true);
            should.exist(txs);
            allTxs = allTxs.concat(txs);
            txs[0].id.should.equal('id' + i);
            i += limit;
          }
        } while (cont);

        i = 0;
        for (const x of allTxs) {
          x.id.should.equal('id' + i);
          i++;
        }
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
      });


      it('should download history with stream cache> page', async function() {
        this.timeout(10000);
        const _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = 100;
        helpers.stubHistory(997, 10000); // (0->49)
        const limit = 17;
        let allTxs = [];

        // this call is to fill the cache
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ limit: limit }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(limit);
        txs[0].id.should.equal('id0');

        allTxs = allTxs.concat(txs);

        let i = limit;
        let cont = true;

        do {
          const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
            server.getTxHistory({ skip: i, limit: limit }, function(err, txs, fromCache) {
              if (err) return reject(err);
              resolve([txs, fromCache]);
            });
          });
          if (txs && txs.length < limit) {
            cont = false;
          } else {
            if (i > 100)
              fromCache.should.equal(true);
            should.exist(txs);
            allTxs = allTxs.concat(txs);
            txs[0].id.should.equal('id' + i);
            i += limit;
          }
        } while (cont);

        i = 0;
        for (const x of allTxs) {
          x.id.should.equal('id' + i);
          i++;
        }
        (Defaults.CONFIRMATIONS_TO_START_CACHING as any) = _cache;
      });
    });


    it('should get tx history from insight, in 2 overlapping pages', function(done) {
      helpers.stubHistory(300, BCHEIGHT);
      server.getTxHistory({ limit: 25 }, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        txs.length.should.equal(25);

        // no cache
        server.getTxHistory({ skip: 5, limit: 21 }, function(err, txs2, fromCache) {
          should.not.exist(err);
          fromCache = !!fromCache;
          fromCache.should.equal(false);
          should.exist(txs2);
          txs2.length.should.equal(21);
          let i = 0;
          for (const tx of txs) {
            tx.txid.should.equal('txid' + i++);
          }
          i = 5;
          for (const tx of txs2) {
            tx.txid.should.equal('txid' + i++);
          }
          done();
        });
      });
    });


    it('should include raw tx in includeExtendedInfo is passed', function(done) {
      const external = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';

      helpers.stubUtxos(server, wallet, [1, 2]).then((utxos) => {
        const txOpts = {
          outputs: [{
            toAddress: external,
            amount: 0.3e8,
          }],
          feePerKb: 100e2,
          customData: {
            'test': true
          },
        };

        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then((tx) => {
          should.exist(tx);
          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);
            helpers.stubBroadcast(tx.txid);
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              const t = (new Date).toISOString();
              const txs = [{
                id: 1,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                size: 226,
                category: 'send',
                address: external,
                satoshis: 0.5e8,
                height: 1000,
              }, {
                id: 2,
                txid: txp.txid,
                confirmations: 1,
                category: 'send',
                blockTime: t,
                satoshis: 0.3e8,
                address: external,
                height: 1000,
              }, {
                id: 3,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                satoshis: 5460,
                category: 'fee',
                height: 1000,
              }];

              helpers.stubHistory(null, null, txs);
              helpers.stubCheckData(blockchainExplorer, server, wallet.coin == 'bch').then(() => {
                server.getTxHistory({ includeExtendedInfo: true }, function(err, txs) {
                  should.not.exist(err);
                  should.exist(txs);
                  txs.length.should.equal(1);
                  const tx = txs[0];
                  tx.raw.should.contain('00000000');
                  tx.createdOn.should.equal(txp.createdOn);
                  tx.action.should.equal('sent');
                  tx.amount.should.equal(0.8e8);
                  tx.addressTo.should.equal(external);
                  tx.actions.length.should.equal(1);
                  tx.actions[0].type.should.equal('accept');
                  done();
                });
              });
            });
          });
        });
      });
    });


    it('should get tx history with accepted proposal, multisend', function(done) {
      const external = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';

      helpers.stubUtxos(server, wallet, [1, 2]).then(function(utxos) {
        const txOpts = {
          outputs: [{
            toAddress: external,
            amount: 0.5e8,
            message: undefined // no message
          }, {
            toAddress: external,
            amount: 0.3e8,
            message: 'message #2'
          }],
          feePerKb: 100e2,
          message: 'some message',
          customData: {
            test: true
          },
        };

        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0).then(function(tx) {
          should.exist(tx);
          const signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);
            helpers.stubBroadcast(tx.txid);
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              const t = (new Date).toISOString();
              const txs = [{
                id: 1,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                size: 226,
                category: 'send',
                address: external,
                satoshis: 0.5e8,
                height: 1000,
              }, {
                id: 2,
                txid: txp.txid,
                confirmations: 1,
                category: 'send',
                blockTime: t,
                satoshis: 0.3e8,
                address: external,
                height: 1000,
              }, {
                id: 3,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                satoshis: 5460,
                category: 'fee',
                height: 1000,
              }];

              helpers.stubHistory(null, null, txs);
              helpers.stubCheckData(blockchainExplorer, server, wallet.coin == 'bch').then(() => {
                server.getTxHistory({}, function(err, txs) {
                  should.not.exist(err);
                  should.exist(txs);
                  txs.length.should.equal(1);
                  const tx = txs[0];
                  tx.createdOn.should.equal(txp.createdOn);
                  tx.action.should.equal('sent');
                  tx.amount.should.equal(0.8e8);

                  should.not.exist(tx.raw);
                  tx.message.should.equal('some message');
                  tx.addressTo.should.equal(external);
                  tx.actions.length.should.equal(1);
                  tx.actions[0].type.should.equal('accept');
                  tx.actions[0].copayerName.should.equal('copayer 1');
                  tx.outputs[0].address.should.equal(external);
                  tx.outputs[0].amount.should.equal(0.5e8);
                  should.not.exist(tx.outputs[0].message);
                  should.not.exist(tx.outputs[0]['isMine']);
                  should.not.exist(tx.outputs[0]['isChange']);
                  tx.outputs[1].address.should.equal(external);
                  tx.outputs[1].amount.should.equal(0.3e8);
                  should.exist(tx.outputs[1].message);
                  tx.outputs[1].message.should.equal('message #2');
                  should.exist(tx.customData);
                  should.exist(tx.customData['test']);
                  done();
                });
              });
            });
          });
        });
      });
    });

    it.skip('should get various paginated tx history', async function() {
      const testCases = [{
        opts: {},
        expected: [50, 40, 30, 20, 10],
      }, {
        opts: {
          skip: 1,
          limit: 3,
        },
        expected: [40, 30, 20],
      }, {
        opts: {
          skip: 1,
          limit: 2,
        },
        expected: [40, 30],
      }, {
        opts: {
          skip: 2,
        },
        expected: [30, 20, 10],
      }, {
        opts: {
          limit: 4,
        },
        expected: [50, 40, 30, 20],
      }, {
        opts: {
          skip: 0,
          limit: 3,
        },
        expected: [50, 40, 30],
      }, {
        opts: {
          skip: 0,
          limit: 0,
        },
        expected: [],
      }, {
        opts: {
          skip: 4,
          limit: 10,
        },
        expected: [10],
      }, {
        opts: {
          skip: 20,
          limit: 1,
        },
        expected: [],
      }];

      const timestamps = [50, 40, 30, 20, 10];
      const txs = timestamps.map(function(ts, idx) {
        return {
          txid: (idx + 1).toString(),
          height: ts,
          confirmations: ts / 10,
          fees: 100,
          time: ts,
          inputs: [{
            address: 'external',
            amount: 5e8,
          }],
          outputs: [{
            address: mainAddresses[0].address,
            amount: 2e8,
          }],
        };
      });
      helpers.stubHistory(null, null, txs);

      for (const testCase of testCases) {
        const txs = await util.promisify(server.getTxHistory).call(server, testCase.opts);
        should.exist(txs);
        txs.map(t => t.time).should.deep.equal(testCase.expected);
      }
    });

    it.skip('should fail gracefully if unable to reach the blockchain', function(done) {
      blockchainExplorer.getTransactions = sinon.stub().callsArgWith(3, 'dummy error');
      server.getTxHistory({}, function(err, txs) {
        should.exist(err);
        err.toString().should.equal('dummy error');
        done();
      });
    });

    it('should handle ETH/w ERC20 history  history ', function(done) {
      helpers.stubHistory(null, null);
      helpers.stubHistory(null, null, TestData.historyETH);

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(9);
        txs[2].should.deep.equal({
          id: '5ddbf28d4ff191801711a948',
          txid: '0xf992febe3257518c00c09ae96cafe988dfe5b625bbf5515b679807f650f58e88',
          confirmations: 0,
          blockheight: 8999242,
          fees: 1100740000000000,
          time: 1574695599,
          size: undefined,
          amount: 0,
          action: 'sent',
          addressTo: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          outputs: [{
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: 0
          }],
          internal: [],
          dust: false,
          abiType: '{"type":"ERC20","name":"transfer","params":[{"name":"_to","value":"0xeca2486a6a213fb40537658d7360ab6221eb26be","type":"address"},{"name":"_tokenId","value":"3000000","type":"uint256"}]}',
          effects: undefined,
          error: undefined,
          network: 'sepolia',
          chain: 'ETH',
          data: '0x',
          nonce: 57,
          gasPrice: 2500000000,
          gasLimit: 163759,
          receipt: undefined,
          lowFees: false,
          maxGasFee: undefined,
          priorityGasFee: undefined,
          txType: undefined,
        });
        done();
      });
    });

    it.skip('should set lowFees atribute for sub-superEconomy level fees on unconfirmed txs', function(done) {
      helpers.stubFeeLevels({ 24: 10000 });
      const txs = [{
        txid: '1',
        confirmations: 0,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }, {
        txid: '2',
        confirmations: 0,
        fees: 6000,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }, {
        txid: '3',
        confirmations: 6,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }];
      helpers.stubHistory(null, BCHEIGHT, txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        txs[0].feePerKb.should.equal(200);
        txs[0].lowFees.should.be.true;
        txs[1].feePerKb.should.equal(12000);
        txs[1].lowFees.should.be.false;
        txs[2].feePerKb.should.equal(200);
        should.not.exist(txs[2].lowFees);
        done();
      });
    });

    it.skip('should get tx history even if fee levels are unavailable', function(done) {
      blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
      const txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        time: 20,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
        size: 500,
      }];
      helpers.stubHistory(null, 0, txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        txs[0].feePerKb.should.equal(200);
        should.not.exist(txs[0].foreignCrafted);
        should.not.exist(txs[0].lowFees);
        done();
      });
    });

    it.skip('should handle outgoing txs where fee > amount', function(done) {
      const x = JSON.parse(JSON.stringify([HugeTxs[0]]));
      x[0].vin[118].addr = mainAddresses[0].address;
      helpers.stubHistory(null, 0, x);


      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        const tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(3002982);
        tx.fees.should.equal(10000000);
        tx.outputs[0].address.should.equal('1DVhaBdbp5mx5Y8zR1qR9NBiQtrgL9ZNQs');
        tx.outputs[0].amount.should.equal(500000000);
        tx.foreignCrafted.should.equal(true);
        done();
      });
    });


    it.skip('should handle incoming txs with fee > incoming', function(done) {
      const x = JSON.parse(JSON.stringify([HugeTxs[1]]));
      x[0].vout[43].scriptPubKey.addresses = [mainAddresses[0].address];
      helpers.stubHistory(null, 0, x);

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        const tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(3002982);
        tx.fees.should.equal(130700);
        done();
      });
    });
  });


  describe.skip('Downloading history', function() {
    let h;
    let server;
    let wallet;

    beforeEach(async function() {
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000, 'hash');
      h = helpers.historyCacheTest(200);
      helpers.stubHistory(null, BCHEIGHT, h);
      ({ server, wallet } = await helpers.createAndJoinWallet(1, 1));
      await util.promisify(server.storage.clearTxHistoryStreamV8).call(server.storage, server.walletId);
    });

    it('from 0 to 200, two times, in order', async function() {
      for (let i = 0; i < 200; i += 5) {
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 5 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(5);
        const s = h.slice(i, i + 5);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(false);
      }
      for (let i = 0; i < 200; i += 5) { 
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 5 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(5);
        const s = h.slice(i, i + 5);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && i < 200);
      }
    });

    it('from 0 to 200, two times, random', async function() {
      const indexes = Array.from({ length: 40 }, (_, i) => i * 5); // 0 to 195 step 5
      for (const i of Utils.shuffle(indexes)) {
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 5 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(5);
        const s = h.slice(i, i + 5);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(false);
      }
      for (let i = 0; i < 190; i += 7) {
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 7 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(7);
        const s = h.slice(i, i + 7);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING);
      }
    });


    it('from 0 to 200, two times, random, with resets', async function() {
      const indexes = Array.from({ length: 40 }, (_, i) => i * 5); // 0 to 195 step 5
      for (const i of Utils.shuffle(indexes)) {
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 5 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(5);
        const s = h.slice(i, i + 5);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(false);
      }
      for (let i = 0; i < 200; i += 5) {
        let reset = false;
        if (!(i % 25)) {
          await util.promisify(storage.softResetTxHistoryCache).call(server, server.walletId);
          reset = true;
        }
        const [txs, fromCache] = await new Promise<any>((resolve, reject) => {
          server.getTxHistory({ skip: i, limit: 5 }, function(err, txs, fromCache) {
            if (err) return reject(err);
            resolve([txs, fromCache]);
          });
        });
        should.exist(txs);
        txs.length.should.equal(5);
        const s = h.slice(i, i + 5);
        txs.map(tx => tx.txid).should.deep.equal(s.map(tx => tx.txid));
        fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && !reset);
      }
    });
  });
});

