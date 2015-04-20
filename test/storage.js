'use strict';

var _ = require('lodash');
var async = require('async');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var mongodb = require('mongodb');

var Storage = require('../lib/storage');
var Model = require('../lib/model');


function initDb(cb) {
  var url = 'mongodb://localhost:27017/bws';
  mongodb.MongoClient.connect(url, function(err, db) {
    should.not.exist(err);
    db.dropDatabase(function(err) {
      return cb(null, db);
    });
  });
};


describe('Storage', function() {
  var storage;
  beforeEach(function(done) {
    initDb(function(err, db) {
      should.not.exist(err);
      storage = new Storage();
      storage.connect({
        db: db
      }, function(err) {
        should.not.exist(err);
        done();
      });
    });
  });
  describe('Store & fetch wallet', function() {
    it('should correctly store and fetch wallet', function(done) {
      var wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
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
        })
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
      var wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
      });
      _.each(_.range(3), function(i) {
        var copayer = Model.Copayer.create({
          name: 'copayer ' + i,
          xPubKey: 'xPubKey ' + i,
          requestPubKey: 'requestPubKey ' + i,
        });
        wallet.addCopayer(copayer);
      });

      should.exist(wallet);
      storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
        should.not.exist(err);
        storage.fetchCopayerLookup(wallet.copayers[1].id, function(err, lookup) {
          should.not.exist(err);
          should.exist(lookup);
          lookup.walletId.should.equal('123');
          lookup.requestPubKey.should.equal('requestPubKey 1');
          done();
        })
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

  describe('Transaction proposals', function() {
    var wallet, proposals;

    beforeEach(function(done) {
      wallet = Model.Wallet.create({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
      });
      _.each(_.range(3), function(i) {
        var copayer = Model.Copayer.create({
          name: 'copayer ' + i,
          xPubKey: 'xPubKey ' + i,
          requestPubKey: 'requestPubKey ' + i,
        });
        wallet.addCopayer(copayer);
      });
      should.exist(wallet);
      storage.storeWalletAndUpdateCopayersLookup(wallet, function(err) {
        should.not.exist(err);

        proposals = _.map(_.range(4), function(i) {
          var tx = Model.TxProposal.create({
            walletId: '123',
            creatorId: wallet.copayers[0].id,
            amount: i + 100,
          });
          if (i % 2 == 0) {
            tx.status = 'rejected';
            tx.isPending().should.be.false;
          }
          return tx;
        });
        async.each(proposals, function(tx, next) {
          storage.storeTx('123', tx, next);
        }, function(err) {
          should.not.exist(err);
          done();
        });
      });
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
    it('should fetch all pending txs', function(done) {
      storage.fetchPendingTxs('123', function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(2);
        txs = _.sortBy(txs, 'amount');
        txs[0].amount.should.equal(101);
        txs[1].amount.should.equal(103);
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
            _.any(txs, {
              id: proposals[0].id
            }).should.be.false;
            done();
          });
        });
      });
    });
  });
});
