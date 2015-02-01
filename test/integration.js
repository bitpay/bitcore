'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');

var Storage = require('../lib/storage');

var Wallet = require('../lib/model/wallet');
var Address = require('../lib/model/address');
var Copayer = require('../lib/model/copayer');
var CopayServer = require('../lib/server');

var aPubKey = '042F65F56A6C06C2B651C473AC221B2460DA57859AFB72564E9781B655EBC0AFAF322B9A732324ECC92A3319DFB1F0D53F0CB7E6620C98BD1EF53106A7CF3F6DB9';

var helpers = {};
helpers.createAndJoinWallet = function (id, m, n, cb) {
  var walletOpts = {
    id: id,
    name: id + ' wallet',
    m: m,
    n: n,
    pubKey: aPubKey,
  };
  server.createWallet(walletOpts, function(err) {
    if (err) return cb(err);

    async.each(_.range(1, n + 1), function (i, cb) {
      var copayerOpts = {
        walletId: id,
        id: '' + i,
        name: 'copayer ' + i,
        xPubKey: 'dummy' + i,
        xPubKeySignature: 'dummy',
      };
      server.joinWallet(copayerOpts, function (err) {
        return cb(err);
      });
    }, function (err) {
      if (err) return cb(err);
      server.getWallet({ id: id, includeCopayers: true }, function (err, wallet) {
        return cb(err, wallet);
      });
    });
  });
};
helpers.createUtxos = function (amounts) {
  amounts = [].concat(amounts);

  return _.map(amounts, function (amount) {
    return {
      txid: 'dummy' + Math.random(),
      vout: Math.floor((Math.random() * 10) + 1),
      amount: amount,
    };
  });
};

var db, storage;
var server;


describe('Copay server', function() {
  beforeEach(function() {
    db = levelup(memdown, { valueEncoding: 'json' });
    storage = new Storage({ db: db });
  });

  describe('#getWallet', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
    });

    it('should get existing wallet', function (done) {

      var w1 = new Wallet({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      });

      var w2 = new Wallet({
        id: '234',
        name: 'my wallet 2',
        m: 3,
        n: 4,
        pubKey: aPubKey,
      });

      db.batch([{
        type: 'put',
        key: 'wallet-123',
        value: w1,
      }, {
        type: 'put',
        key: 'wallet-234',
        value: w2,
      }]);

      server.getWallet({ id: '123', includeCopayers: true }, function (err, wallet) {
        should.not.exist(err);
        wallet.id.should.equal('123');
        wallet.name.should.equal('my wallet');
        wallet.status.should.equal('pending');
        wallet.copayers.length.should.equal(0);
        done();
      });
    });

    it('should fail when requesting non-existent wallet', function (done) {
      var w1 = new Wallet({
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      });
      var w2 = new Wallet({
        id: '234',
        name: 'my wallet 2',
        m: 3,
        n: 4,
        pubKey: aPubKey,
      });
      db.batch([{
        type: 'put',
        key: 'wallet-123',
        value: w1,
      }, {
        type: 'put',
        key: 'wallet-234',
        value: w2,
      }]);

      server.getWallet({ id: '345' }, function (err, wallet) {
        should.exist(err);
        err.should.equal('Wallet not found');
        done();
      });
    });
  });

  describe('#createWallet', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
    });

    it('should create and store wallet', function(done) {
      var opts = {
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(opts, function(err) {
        should.not.exist(err);
        server.getWallet({ id: '123' }, function (err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal('123');
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should fail to recreate existing wallet', function(done) {
      var opts = {
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(opts, function(err) {
        should.not.exist(err);
        server.getWallet({ id: '123' }, function (err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal('123');
          wallet.name.should.equal('my wallet');
          server.createWallet(opts, function(err) {
            should.exist(err);
            done();
          });
        });
      });
    });
  });

  describe('#joinWallet', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
      server._verifySignature = sinon.stub().returns(true);
    });

    it('should join existing wallet', function (done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: '123',
          id: '999',
          name: 'me',
          xPubKey: 'dummy',
          xPubKeySignature: 'dummy',
        };
        server.joinWallet(copayerOpts, function (err) {
          should.not.exist(err);
          server.getWallet({ id: '123', includeCopayers: true }, function (err, wallet) {
            wallet.id.should.equal('123');
            wallet.copayers.length.should.equal(1);
            var copayer = wallet.copayers[0];
            copayer.id.should.equal('999');
            copayer.name.should.equal('me');
            done();
          });
        });
      });
    });

    it('should fail to join non-existent wallet', function (done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: '234',
          id: '999',
          name: 'me',
          xPubKey: 'dummy',
          xPubKeySignature: 'dummy',
        };
        server.joinWallet(copayerOpts, function (err) {
          should.exist(err);
          done();
        });
      });
    });

    it('should fail to join full wallet', function (done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: aPubKey,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayer1Opts = {
          walletId: '123',
          id: '111',
          name: 'me',
          xPubKey: 'dummy1',
          xPubKeySignature: 'dummy',
        };
        var copayer2Opts = {
          walletId: '123',
          id: '222',
          name: 'me 2',
          xPubKey: 'dummy2',
          xPubKeySignature: 'dummy',
        };
        server.joinWallet(copayer1Opts, function (err) {
          should.not.exist(err);
          server.getWallet({ id: '123' }, function (err, wallet) {
            wallet.status.should.equal('complete');
            server.joinWallet(copayer2Opts, function (err) {
              should.exist(err);
              err.should.equal('Wallet full');
              done();
            });
          });
        });
      });
    });

    it('should fail to re-join wallet', function (done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: aPubKey,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: '123',
          id: '111',
          name: 'me',
          xPubKey: 'dummy',
          xPubKeySignature: 'dummy',
        };
        server.joinWallet(copayerOpts, function (err) {
          should.not.exist(err);
          server.joinWallet(copayerOpts, function (err) {
            should.exist(err);
            err.should.equal('Copayer already in wallet');
            done();
          });
        });
      });
    });

    it('should set pkr and status = complete on last copayer joining', function (done) {
      helpers.createAndJoinWallet('123', 2, 3, function (err, wallet) {
        server.getWallet({ id: '123' }, function (err, wallet) {
          should.not.exist(err);
          wallet.status.should.equal('complete');
          wallet.publicKeyRing.length.should.equal(3);
          done();
        });
      });
    });    
  });



  describe('#verifyMessageSignature', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
    });

    it('should successfully verify message signature', function (done) {
      server._doVerifyMessageSignature = sinon.stub().returns(true);
      helpers.createAndJoinWallet('123', 2, 2, function (err, wallet) {
        var opts = {
          walletId: '123',
          copayerId: '1',
          message: 'hello world',
          signature: 'dummy',
        };
        server.verifyMessageSignature(opts, function (err, isValid) {
          should.not.exist(err);
          isValid.should.be.true;
          done();
        });
      });
    });

    it('should fail to verify message signature when copayer does not exist', function (done) {
      helpers.createAndJoinWallet('123', 2, 2, function (err, wallet) {
        var opts = {
          walletId: '123',
          copayerId: '999',
          message: 'hello world',
          signature: 'dummy',
        };
        server.verifyMessageSignature(opts, function (err, isValid) {
          err.should.equal('Copayer not found');
          done();
        });
      });
    });
  });

  describe('#createAddress', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
    });

    it('should create address', function (done) {
      server._doCreateAddress = sinon.stub().returns(new Address({ address: 'addr1', path: 'path1' }));
      helpers.createAndJoinWallet('123', 2, 2, function (err, wallet) {
        server.createAddress({ walletId: '123' }, function (err, address) {
          should.not.exist(err);
          address.should.exist;
          address.address.should.equal('addr1');
          address.path.should.equal('path1');
          done();
        });
      });
    });
  });

  describe('#createTx', function() {
    beforeEach(function(done) {
      server = new CopayServer({
        storage: storage,
      });
      server._doCreateAddress = sinon.stub().returns(new Address({ address: 'addr1', path: 'path1' }));
      helpers.createAndJoinWallet('123', 2, 2, function (err, wallet) {
        server.createAddress({ walletId: '123' }, function (err, address) {
          done();
        });
      });
    });

    it('should create tx', function (done) {
      var bc = sinon.stub();
      bc.getUnspentUtxos = sinon.stub().callsArgWith(1, null, helpers.createUtxos([100, 200]));
      server._getBlockExplorer = sinon.stub().returns(bc);

      server._createRawTx = sinon.stub().returns('raw');

      var txOpts = {
        copayerId: '1',
        walletId: '123',
        toAddress: 'dummy',
        amount: 80,
        message: 'some message',
        otToken: 'dummy',
        requestSignature: 'dummy',
      };
      server.createTx(txOpts, function (err, tx) {
        should.not.exist(err);
        tx.should.exist;
        tx.rawTx.should.equal('raw');
        tx.isAccepted().should.equal.false;
        tx.isRejected().should.equal.false;
        server.getPendingTxs({ walletId: '123' }, function (err, txs) {
          should.not.exist(err);
          txs.length.should.equal(1);
          server.getBalance({ walletId: '123' }, function (err, balance) {
            should.not.exist(err);
            balance.totalAmount.should.equal(300);
            balance.lockedAmount.should.equal(200);
            done();
          });
        });
      });
    });

    it.skip('should fail to create tx when insufficient funds', function (done) {
    });

    it.skip('should create tx when there is a pending tx and enough UTXOs', function (done) {
    });

    it.skip('should fail to create tx when there is a pending tx and not enough UTXOs', function (done) {
    });
  });
});
