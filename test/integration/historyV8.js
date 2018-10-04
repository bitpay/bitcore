'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
log.level = 'info';

var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};



var Common = require('../../lib/common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var Model = require('../../lib/model');

var WalletService = require('../../lib/server');

var HugeTxs = require('./hugetx');
var TestData = require('../testdata');
var helpers = require('./helpers');
var storage, blockchainExplorer, request;


describe('History V8', function() {
  before(function(done) {
    helpers.before(done);
  });
  beforeEach(function(done) {
    helpers.beforeEach(function(res) {
      storage = res.storage;
      blockchainExplorer = res.blockchainExplorer;
      helpers.setupGroupingBE(blockchainExplorer);
      request = res.request;
      done();
    });
  });
  after(function(done) {
    helpers.after(done);
  });

  var BCHEIGHT =  1000;

  describe('#getTxHistoryV8', function() {
    var server, wallet, mainAddresses, changeAddresses;
    beforeEach(function(done) {
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, BCHEIGHT);
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          helpers.stubFeeLevels({
            24: 10000,
          });
          done();
        });
      });
    });

    it('should get tx history from insight, 3 items page', function(done) {
      var _page = Defaults.V8_TX_PAGE_SIZE;
      Defaults.V8_TX_PAGE_SIZE = 3;
      helpers.stubHistoryV8(50, BCHEIGHT);
      server.getTxHistory({limit: 20}, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        var i = 0;
        _.each(txs, function(tx) {
          tx.txid.should.equal('txid' + i);
          tx.confirmations.should.equal(i);
          if (i) { 
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
          }  else {

            // The first one is unconfirmed
            should.not.exist(tx.blockheight);
          }
          i++;
        });
        Defaults.V8_TX_PAGE_SIZE = _page;
        done();
      });
    });

    it('should get tx history from cache', function(done) {
      var _page = Defaults.V8_TX_PAGE_SIZE;
      var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.V8_TX_PAGE_SIZE = 3;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
      helpers.stubHistoryV8(50, BCHEIGHT); //(0->49)

      // this call is to fill the cache
      server.getTxHistory({limit: 20}, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        _.first(txs).id.should.equal('id0');
        server.getTxHistory({skip: 20, limit: 10}, function(err, txs, fromCache) {
          // first TX result should be:
          // txid: 19 
          // confirmations: 19
          should.not.exist(err);
          fromCache.should.equal(true);
          should.exist(txs);
          txs.length.should.equal(10);
          _.first(txs).id.should.equal('id20');

          var i = 20;
          _.each(txs, function(tx) {
            tx.txid.should.equal('txid' + i);
            tx.confirmations.should.equal(i);
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
            i++;
          });
          Defaults.V8_TX_PAGE_SIZE = _page;
          Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
          done();
        });
      });
    });

    it('should get tx history from cache and bc mixed', function(done) {
      var _page = Defaults.V8_TX_PAGE_SIZE;
      var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.V8_TX_PAGE_SIZE = 3;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
      helpers.stubHistoryV8(50, BCHEIGHT); //(0->49)

      // this call is to fill the cache
      server.getTxHistory({limit: 20}, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        should.exist(txs);
        txs.length.should.equal(20);
        _.first(txs).id.should.equal('id0');
        server.getTxHistory({skip: 5, limit: 20}, function(err, txs, fromCache) {
          // first TX result should be:
          // txid: 19 
          // confirmations: 19
          should.not.exist(err);
          fromCache.should.equal(true);
          should.exist(txs);
          txs.length.should.equal(20);
          _.first(txs).id.should.equal('id5');

          var i = 5;
          _.each(txs, function(tx) {
            tx.txid.should.equal('txid' + i);
            tx.confirmations.should.equal(i);
            tx.blockheight.should.equal(BCHEIGHT - i + 1);
            i++;
          });
          Defaults.V8_TX_PAGE_SIZE = _page;
          Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
          done();
        });
      });
    });

    it('should get tx history from insight, in 2 overlapping pages', function(done) {
      helpers.stubHistoryV8(300);
      server.getTxHistory({limit: 25}, function(err, txs, fromCache) {
        console.log('[server.js.6215:err:]',err); //TODO
        should.not.exist(err);
        fromCache.should.equal(false);

        // no cache
        server.getTxHistory({skip:5, limit: 21}, function(err, txs2, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
//console.log('[historyV8.js.96:txs2:]',txs2); //TODO
          should.exist(txs2);
          txs2.length.should.equal(21);
          var i = 0;
          _.each(txs, function(tx) {
            tx.txid.should.equal('txid' + i++);
          });
          var i = 5;
          _.each(txs2, function(tx) {
            tx.txid.should.equal('txid' + i++);
          });
          done();
        });
      });
    });

    it('should get tx history from cache', function(done) {
      helpers.stubHistoryV8(300);
      server.getTxHistory({limit: 25}, function(err, txs) {
        should.not.exist(err);
        server.getTxHistory({skip:200, limit: 50}, function(err, txs2, fromCache) {
          should.exist(txs2);
          fromCache.should.equal(true);
          txs2.length.should.equal(50);
          var i = 0;
          _.each(txs, function(tx) {
            tx.txid.should.equal('txid' + i++);
          });
          var i = 5;
          _.each(txs2, function(tx) {
            tx.txid.should.equal('txid' + i++);
          });
        });
        done();
      });
    });

    it.skip('should get tx history with accepted proposal', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var external = '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7';

      helpers.stubUtxos(server, wallet, [1, 2], function(utxos) {
        var txOpts = {
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
            "test": true
          },
        };
        helpers.createAndPublishTx(server, txOpts, TestData.copayers[0].privKey_1H_0, function(tx) {
          should.exist(tx);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_44H_0H_0H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);

            helpers.stubBroadcast();
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              var txs = [{
                txid: txp.txid,
                confirmations: 1,
                fees: 5460,
                time: Date.now() / 1000,
                inputs: [{
                  address: tx.inputs[0].address,
                  amount: utxos[0].satoshis,
                }],
                outputs: [{
                  address: changeAddresses[0].address,
                  amount: 0.2e8 - 5460,
                }, {
                  address: external,
                  amount: 0.5e8,
                }, {
                  address: external,
                  amount: 0.3e8,
                }]
              }];
              helpers.stubHistoryV8(txs);

              server.getTxHistory({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(1);
                var tx = txs[0];
                tx.createdOn.should.equal(txp.createdOn);
                tx.action.should.equal('sent');
                tx.amount.should.equal(0.8e8);


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
                should.exist(tx.customData["test"]);
                done();
              });
            });
          });
        });
      });
    });
    it.skip('should get various paginated tx history', function(done) {
      var testCases = [{
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

      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var timestamps = [50, 40, 30, 20, 10];
      var txs = _.map(timestamps, function(ts, idx) {
        return {
          txid: (idx + 1).toString(),
          confirmations: ts / 10,
          fees: 100,
          time: ts,
          inputs: [{
            address: 'external',
            amount: 500,
          }],
          outputs: [{
            address: mainAddresses[0].address,
            amount: 200,
          }],
        };
      });
      helpers.stubHistoryV8(txs);

      async.each(testCases, function(testCase, next) {
        server.getTxHistory(testCase.opts, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          _.pluck(txs, 'time').should.deep.equal(testCase.expected);
          next();
        });
      }, done);
    });
    it.skip('should fail gracefully if unable to reach the blockchain', function(done) {
      blockchainExplorer.getTransactions = sinon.stub().callsArgWith(3, 'dummy error');
      server.getTxHistory({}, function(err, txs) {
        should.exist(err);
        err.toString().should.equal('dummy error');
        done();
      });
    });
    it.skip('should handle invalid tx in  history ', function(done) {
      var h = _.clone(TestData.history);
      h.push({
        txid: 'xx'
      })
      helpers.stubHistoryV8(h);
      var l = TestData.history.length;

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(l + 1);
        txs[l].action.should.equal('invalid');
        done();
      });
    });
    it.skip('should handle exceeded limit', function(done) {
      server.getTxHistory({
        limit: 1000
      }, function(err, txs) {
        err.code.should.equal('HISTORY_LIMIT_EXCEEDED');
        done();
      });
    });
    it.skip('should set lowFees atribute for sub-superEconomy level fees on unconfirmed txs', function(done) {
      helpers.stubFeeLevels({
        24: 10000,
      });
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
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
      helpers.stubHistoryV8(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        var tx = txs[0];
        tx.feePerKb.should.equal(200);
        tx.lowFees.should.be.true;
        tx = txs[1];
        tx.feePerKb.should.equal(12000);
        tx.lowFees.should.be.false;
        tx = txs[2];
        tx.feePerKb.should.equal(200);
        should.not.exist(tx.lowFees);
        done();
      });
    });
    it.skip('should get tx history even if fee levels are unavailable', function(done) {
      blockchainExplorer.estimateFee = sinon.stub().yields('dummy error');
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
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
      helpers.stubHistoryV8(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        var tx = txs[0];
        tx.feePerKb.should.equal(200);
        should.not.exist(tx.foreignCrafted);
        should.not.exist(tx.lowFees);
        done();
      });
    });

    it.skip('should handle outgoing txs where fee > amount', function(done) {
      var x = _.cloneDeep([HugeTxs[0]]);
      x[0].vin[118].addr = mainAddresses[0].address;
      helpers.stubHistoryV8(x);


//console.log('[server.js.7149]',HugeTxs[1].vin); //TODO
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
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
      var x = _.cloneDeep([HugeTxs[1]]);

      x[0].vout[43].scriptPubKey.addresses = [mainAddresses[0].address];
      helpers.stubHistoryV8(x);

      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(3002982);
        tx.fees.should.equal(130700);
        done();
      });
    });
  });

  describe.skip('#getTxHistory cache', function() {
    var server, wallet, mainAddresses, changeAddresses;
    var _threshold = Defaults.HISTORY_CACHE_ADDRESS_THRESOLD;
    beforeEach(function(done) {
      Defaults.HISTORY_CACHE_ADDRESS_THRESOLD = 1;
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          helpers.stubFeeLevels({
            24: 10000,
          });
          done();
        });
      });
    });
    afterEach(function() {
      Defaults.HISTORY_CACHE_ADDRESS_THRESOLD = _threshold;
    });

    it('should store partial cache tx history from insight', function(done) {
      var skip = 31;
      var limit = 10;
      var totalItems = 200;

      var h = helpers.historyCacheTest(totalItems);
      helpers.stubHistoryV8(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 200);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');


      server.getTxHistory({
        skip: skip,
        limit: limit,
      }, function(err, txs) {

        // FROM the END, we are getting items
        // End-1, end-2, end-3.

        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(limit);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        calls[0].args[1].should.equal(totalItems); // total
        calls[0].args[2].should.equal(totalItems - skip - limit); // position
        calls[0].args[3].length.should.equal(5); // 5 txs have confirmations>= 36

        // should be reversed!
        calls[0].args[3][0].confirmations.should.equal(skip + limit - 1);
        calls[0].args[3][0].txid.should.equal(h[skip + limit - 1].txid);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });


    it('should not cache tx history when requesting txs with low # of confirmations', function(done) {
      var h = helpers.historyCacheTest(200);
      helpers.stubHistoryV8(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');
      server.getTxHistory({
        skip: 0,
        limit: 10,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(0);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });


    it('should store cache all tx history from insight', function(done) {
      var skip = 195;
      var limit = 5;
      var totalItems = 200;

      var h = helpers.historyCacheTest(totalItems);
      helpers.stubHistoryV8(h);
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 200);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      server.getTxHistory({
        skip: skip,
        limit: limit,
      }, function(err, txs) {

        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(limit);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        calls[0].args[1].should.equal(totalItems); // total
        calls[0].args[2].should.equal(totalItems - skip - limit); // position
        calls[0].args[3].length.should.equal(5);

        // should be reversed!
        calls[0].args[3][0].confirmations.should.equal(totalItems - 1);
        calls[0].args[3][0].txid.should.equal(h[totalItems - 1].txid);
        server.storage.storeTxHistoryCache.restore();
        done();
      });
    });

    it('should get real # of confirmations based on current block height', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      _.each(h, function(x, i) {
        x.confirmations = 500 + i;
        x.blockheight = 1000 - i;
      });
      helpers.stubHistoryV8(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1500);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          _.first(txs).confirmations.should.equal(501);
          _.last(txs).confirmations.should.equal(520);

          blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 2000);
          server._notify('NewBlock', {
            coin: 'btc',
            network: 'livenet',
            hash: 'dummy hash',
          }, {
            isGlobal: true
          }, function(err) {
            should.not.exist(err);
            setTimeout(function() {
              server.getTxHistory({
                skip: 0,
                limit: 30,
              }, function(err, txs) {
                should.not.exist(err);
                _.first(txs).confirmations.should.equal(1001);
                _.last(txs).confirmations.should.equal(1020);

                server.storage.storeTxHistoryCache.restore();
                Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
                done();
              });
            }, 100);
          });
        });
      });
    });

    it('should get cached # of confirmations if current height unknown', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      _.each(h, function(x, i) {
        x.confirmations = 500 + i;
        x.blockheight = 1000 - i;
      });
      helpers.stubHistoryV8(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, null);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(20);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          _.first(txs).confirmations.should.equal(500);
          _.last(txs).confirmations.should.equal(519);

          server.storage.storeTxHistoryCache.restore();
          Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
          done();
        });
      });
    });

    it('should get returned # of confirmations for non cached txs', function(done) {
      var _confirmations = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 6;
      WalletService._cachedBlockheight = null;

      var h = helpers.historyCacheTest(20);
      helpers.stubHistoryV8(h);
      var storeTxHistoryCacheSpy = sinon.spy(server.storage, 'storeTxHistoryCache');

      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 500);

      // Cache txs
      server.getTxHistory({
        skip: 0,
        limit: 30,
      }, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(20);
        var calls = storeTxHistoryCacheSpy.getCalls();
        calls.length.should.equal(1);

        server.getTxHistory({
          skip: 0,
          limit: 30,
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(20);
          _.first(txs).confirmations.should.equal(0);
          _.last(txs).confirmations.should.equal(19);

          server.storage.storeTxHistoryCache.restore();
          Defaults.CONFIRMATIONS_TO_START_CACHING = _confirmations;
          done();
        });
      });
    });
  });

  describe.skip('Downloading history', function() {
      var h;
      beforeEach(function(done) {
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000);
        h = helpers.historyCacheTest(200);
        helpers.stubHistoryV8(h);
        server.storage.clearTxHistoryCache(server.walletId, function() {
          done();
        });
      });

      it('from 0 to 200, two times, in order', function(done) {
        async.eachSeries(_.range(0, 200, 5), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 200, 5), function(i, next) {
            server.getTxHistory({
              skip: i,
              limit: 5,
            }, function(err, txs, fromCache) {
              should.not.exist(err);
              should.exist(txs);
              txs.length.should.equal(5);
              var s = h.slice(i, i + 5);
              _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
              fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && i < 200);
              next();
            });
          }, done);
        });
      });

      it('from 0 to 200, two times, random', function(done) {
        var indexes = _.range(0, 200, 5);
        async.eachSeries(_.shuffle(indexes), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 190, 7), function(i, next) {
            server.getTxHistory({
              skip: i,
              limit: 7,
            }, function(err, txs, fromCache) {
              should.not.exist(err);
              should.exist(txs);
              txs.length.should.equal(7);
              var s = h.slice(i, i + 7);
              _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
              fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING);
              next();
            });
          }, done);
        });
      });


      it('from 0 to 200, two times, random, with resets', function(done) {
        var indexes = _.range(0, 200, 5);
        async.eachSeries(_.shuffle(indexes), function(i, next) {
          server.getTxHistory({
            skip: i,
            limit: 5,
          }, function(err, txs, fromCache) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(5);
            var s = h.slice(i, i + 5);
            _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
            fromCache.should.equal(false);
            next();
          });
        }, function() {
          async.eachSeries(_.range(0, 200, 5), function(i, next) {

            function resetCache(cb) {
              if (!(i % 25)) {
                storage.softResetTxHistoryCache(server.walletId, function() {
                  return cb(true);
                });
              } else {
                return cb(false);
              }
            }

            resetCache(function(reset) {
              server.getTxHistory({
                skip: i,
                limit: 5,
              }, function(err, txs, fromCache) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(5);
                var s = h.slice(i, i + 5);
                _.pluck(txs, 'txid').should.deep.equal(_.pluck(s, 'txid'));
                fromCache.should.equal(i >= Defaults.CONFIRMATIONS_TO_START_CACHING && !reset);
                next();
              });
            });
          }, done);
        });
      });
  });
});

