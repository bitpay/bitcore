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

  var BCHEIGHT =  10000;

  describe('#getTxHistoryV8', function() {
    var server, wallet, mainAddresses, changeAddresses;
    beforeEach(function(done) {
      blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, BCHEIGHT, 'hash');
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
        done();
      });
    });

    it('should get tx history from cache', function(done) {
      var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
      Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
      helpers.stubHistoryV8(50, BCHEIGHT); //(0->49)

      // this call is to fill the cache
      server.getTxHistory({limit: 20}, function(err, txs, fromCache) {
        fromCache = !!fromCache;
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
          Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
          done();
        });
      });
    });

    it('should get tx history from cache and bc mixed', function(done) {
      var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
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
          Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
          done();
        });
      });
    });


    
    describe("Stream cache", () => {
      it('should not stream cache on first call', function(done) {
        this.timeout(10000);
        var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
        helpers.stubHistoryV8(100, 10000);
        let limit =20;
        let allTxs = [];

        // this call is to fill the cache
        server.getTxHistory({limit: limit}, function(err, txs, fromCache, useStream) {
          should.not.exist(err);
          fromCache.should.equal(false);
          useStream.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(limit);
          _.first(txs).id.should.equal('id0');

          allTxs = allTxs.concat(txs);

          let i=limit;
          let cont = true;

          let x=false;
          async.doWhilst(
            (next) => {
              server.getTxHistory({skip: i, limit: limit}, function(err, txs, fromCache, useStream) {
                should.not.exist(err);
                if (txs && txs.length < 20) {
                  cont = false;
                  return next();
                }
                fromCache.should.equal(true);
                useStream.should.equal(x);
                x=true;
                should.exist(txs);
                allTxs = allTxs.concat(txs);
                _.first(txs).id.should.equal('id' + i);
                i+=limit;
                next();
              });
            },
            () => {
              return cont;
            },
            (err) => {
              should.not.exist(err);
              let i = 0;
              _.each(allTxs, function(x) {
                x.id.should.equal('id' + i);
                i++;
              });
              Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
              done();
            });
          });
      });



      it('should get tx history from cache and bc mixed', function(done) {
        this.timeout(10000);
        var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
        helpers.stubHistoryV8(1000, 10000); //(0->49)
        let limit =20;
        let allTxs = [];

        // this call is to fill the cache
        server.getTxHistory({limit: limit}, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(limit);
          _.first(txs).id.should.equal('id0');

          allTxs = allTxs.concat(txs);

          let i=limit;
          let cont = true;

          async.doWhilst(
            (next) => {
              server.getTxHistory({skip: i, limit: limit}, function(err, txs, fromCache) {
                should.not.exist(err);
                if (txs && txs.length < 20) {
                  cont = false;
                  return next();
                }
                fromCache.should.equal(true);
                should.exist(txs);
                allTxs = allTxs.concat(txs);
                _.first(txs).id.should.equal('id' + i);
                i+=limit;
                next();
              });
            },
            () => {
              return cont;
            },
            (err) => {
              should.not.exist(err);
              let i = 0;
              _.each(allTxs, function(x) {
                x.id.should.equal('id' + i);
                i++;
              });
              Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
              done();
            });
          });
      });

      it('should download history with prime page size and total txs', function(done) {
        this.timeout(10000);
        var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        Defaults.CONFIRMATIONS_TO_START_CACHING = 10;
        helpers.stubHistoryV8(997, 10000); //(0->49)
        let limit =17;
        let allTxs = [];

        // this call is to fill the cache
        server.getTxHistory({limit: limit}, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(limit);
          _.first(txs).id.should.equal('id0');

          allTxs = allTxs.concat(txs);

          let i=limit;
          let cont = true;

          async.doWhilst(
            (next) => {
              server.getTxHistory({skip: i, limit: limit}, function(err, txs, fromCache) {
                should.not.exist(err);
                if (txs && txs.length < limit) {
                  cont = false;
                  return next();
                }
                fromCache.should.equal(true);
                should.exist(txs);
                allTxs = allTxs.concat(txs);
                _.first(txs).id.should.equal('id' + i);
                i+=limit;
                next();
              });
            },
            () => {
              return cont;
            },
            (err) => {
              should.not.exist(err);
              let i = 0;
              _.each(allTxs, function(x) {
                x.id.should.equal('id' + i);
                i++;
              });
              Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
              done();
            });
          });
      });


      it('should download history with stream cache> page', function(done) {
        this.timeout(10000);
        var _cache = Defaults.CONFIRMATIONS_TO_START_CACHING;
        Defaults.CONFIRMATIONS_TO_START_CACHING = 100;
        helpers.stubHistoryV8(997, 10000); //(0->49)
        let limit =17;
        let allTxs = [];

        // this call is to fill the cache
        server.getTxHistory({limit: limit}, function(err, txs, fromCache) {
          should.not.exist(err);
          fromCache.should.equal(false);
          should.exist(txs);
          txs.length.should.equal(limit);
          _.first(txs).id.should.equal('id0');

          allTxs = allTxs.concat(txs);

          let i=limit;
          let cont = true;

          async.doWhilst(
            (next) => {
              server.getTxHistory({skip: i, limit: limit}, function(err, txs, fromCache) {
                should.not.exist(err);
                if (txs && txs.length < limit) {
                  cont = false;
                  return next();
                }
                if (i>100)
                  fromCache.should.equal(true);
                should.exist(txs);
                allTxs = allTxs.concat(txs);
                _.first(txs).id.should.equal('id' + i);
                i+=limit;
                next();
              });
            },
            () => {
              return cont;
            },
            (err) => {
              should.not.exist(err);
              let i = 0;
              _.each(allTxs, function(x) {
                x.id.should.equal('id' + i);
                i++;
              });
              Defaults.CONFIRMATIONS_TO_START_CACHING = _cache;
              done();
            });
          });
      });


    });


    it('should get tx history from insight, in 2 overlapping pages', function(done) {
      helpers.stubHistoryV8(300, BCHEIGHT);
      server.getTxHistory({limit: 25}, function(err, txs, fromCache) {
        should.not.exist(err);
        fromCache.should.equal(false);
        txs.length.should.equal(25);

        // no cache
        server.getTxHistory({skip:5, limit: 21}, function(err, txs2, fromCache) {
          should.not.exist(err);
          fromCache = !!fromCache;
          fromCache.should.equal(false);
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

    it('should get tx history with accepted proposal, multisend', function(done) {
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
console.log('[historyV8.js.450:err:]',err); //TODO
            should.not.exist(err);

            helpers.stubBroadcast();
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              var t = (new Date).toISOString();
              var txs = [{
                id: 1,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                size: 226,
                category: 'send',
                address: external,
                satoshis: 0.5e8,
                height: 1000,
               },
              {
                id: 2,
                txid: txp.txid,
                confirmations: 1,
                category: 'send',
                blockTime: t,
                satoshis: 0.3e8,
                address: external,
                height: 1000,
              },
              {
                id: 3,
                txid: txp.txid,
                confirmations: 1,
                blockTime: t,
                satoshis: 5460,
                category: 'fee',
                height: 1000,
               },
              ]; 
 
              helpers.stubHistoryV8(null, null,txs);

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
      helpers.stubHistoryV8(h, BCHEIGHT);
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
      helpers.stubHistoryV8(txs, BCHEIGHT);
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


  describe.skip('Downloading history', function() {
      var h;
      beforeEach(function(done) {
        blockchainExplorer.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000, 'hash');
        h = helpers.historyCacheTest(200);
        helpers.stubHistoryV8(h, BCHEIGHT);
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

