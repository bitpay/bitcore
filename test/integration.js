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

var keyPair = {
  priv: '0dea92f1df6675085b5cdd965487bb862f84f2755bcb56fa45dbf5b387a6c4a0',
  pub: '026092daeed8ecb2212869395770e956ffc9bf453f803e700f64ffa70c97a00d80',
};


var aPubKey = '042F65F56A6C06C2B651C473AC221B2460DA57859AFB72564E9781B655EBC0AFAF322B9A732324ECC92A3319DFB1F0D53F0CB7E6620C98BD1EF53106A7CF3F6DB9';
var aXPubKey = 'xpub661MyMwAqRbcFHFFvUP6HaKdd2FYzNcZCGagxMzQEf1J3x2DeASBW2JWox7ToGwPM7V2yRzQAxcD6MdPid9C8kwhKkVWBxQ3dMo8zu3pub7';
var aXPubKeySignature = '3045022100f988737147894bbfdc196c1289e4d970b391c0d8e9d1fcc0397f16e6a31c9df2022014d9af9aceccb540f4a5a2680e2aebb1f3df55bcf3778599b78314a02064c592'; // with keyPair.priv

// Copayers

var someXPrivKey = [
  'xprv9s21ZrQH143K2rMHbXTJmWTuFx6ssqn1vyRoZqPkCXYchBSkp5ey8kMJe84sxfXq5uChWH4gk94rWbXZt2opN9kg4ufKGvUM7HQSLjnoh7e',
];

var someXPubKeys = [
  'xpub661MyMwAqRbcFLRkhYzK8eQdoywNHJVsJCMQNDoMks5bZymuMcyDgYfnVQYq2Q9npnVmdTAthYGc3N3uxm5sEdnTpSqBc4YYTAhNnoSxCm9',
  'xpub661MyMwAqRbcEzHgVwwxoXksq21rRNsJsn7AFy4VD4PzsEmjjWwsyEiTjsdQviXbqZ5yHVWJR8zFUDgUKkq4R97su3UyNo36Z8hSaCPrv6o',
  'xpub661MyMwAqRbcFXUfkjfSaRwxJbAPpzNUvTiNFjgZwDJ8sZuhyodkP24L4LvsrgThYAAwKkVVSSmL7Ts7o9EHEHPB3EE89roAra7njoSeiMd',
  'xpub661MyMwAqRbcGpExxHEzAWxBQX3k76NyerSpjqucSXXfTqH6Wq9sUVRwTjpHZHwapDbG16KEB9w9r3LT2jKYqU9xJf1YBAaZFikbUHiV1tg',
  'xpub661MyMwAqRbcEvKQnt9ELHHcangXssm174sWr5gNTSmQYsAtvQJNUpLETDTm1vDxwtABvB4SRjGkNMm37NnMerKg4e3ygqmWEr75Fka4dK7',
  'xpub661MyMwAqRbcG67ioS7rz3fFg7EDQNLJ9m1etAPwBecZhL5kKAKe4JU5jCTzRcEWp28XCYA1gKh7jyficSr97gcR2pjDL5jbWua1CwTKWV4',
];


var someXPubKeysSignatures = [
  '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46',
  '30440220134d13139323ba16ff26471c415035679ee18b2281bf85550ccdf6a370899153022066ef56ff97091b9be7dede8e40f50a3a8aad8205f2e3d8e194f39c20f3d15c62',
  '304402207a4e7067d823a98fa634f9c9d991b8c42cd0f82da24f686992acf96cdeb5e387022021ceba729bf763fc8e4277f6851fc2b856a82a22b35f20d2eeb23d99c5f5a41c',
  '304402203ae5bf7fa8935b8ab2ac33724dbb191356cecb47c8371d2c9389e918a3600918022073b48705306730c8fe4ab22d5f6ed3ca3def27eb6e8c5cc8f53e23c11fa5e5ef',
  '3045022100eabd2a605403b377a8db9eec57726da0309a7eb385e7e4e5273b9862046f25ef02204d18755a90580a98f45e162ae5d5dc39aa3aa708a0d79433ed259e70a832b49c',
  '3045022100c282254773c65025054e18a61ee550cbf78b88fc72ef66770050815b62502d9c02206e0df528203c9201c144f865df71f5d2471668f4ed8387979fcee20f6fa121a9',
]; // with keyPair.priv

//Copayer signature
var aText = 'hello world';
var aTextSignature = '3045022100addd20e5413865d65d561ad2979f2289a40d52594b1f804840babd9a63e4ebbf02204b86285e1fcab02df772e7a1325fc4b511ecad79a8f80a2bd1ad8bfa858ac3d4';  // with someXPrivKey[0].derive('m/1/0')=5c0e043a513032907d181325a8e7990b076c0af15ed13dc5e611cda9bb3ae52a;


var helpers = {};
helpers.createAndJoinWallet = function(id, m, n, cb) {
  var walletOpts = {
    id: id,
    name: id + ' wallet',
    m: m,
    n: n,
    pubKey: keyPair.pub,
  };
  server.createWallet(walletOpts, function(err) {
    if (err) return cb(err);

    async.each(_.range(1, n + 1), function(i, cb) {

      var copayerOpts = {
        walletId: id,
        id: '' + i,
        name: 'copayer ' + i,
        xPubKey: someXPubKeys[i - 1],
        xPubKeySignature: someXPubKeysSignatures[i - 1],
      };

      server.joinWallet(copayerOpts, function(err) {
        return cb(err);
      });
    }, function(err) {
      if (err) return cb(err);

      server.getWallet({
        id: id,
        includeCopayers: true
      }, function(err, wallet) {
        return cb(err, wallet);
      });
    });
  });
};
helpers.createUtxos = function(amounts) {
  amounts = [].concat(amounts);

  return _.map(amounts, function(amount) {
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
    db = levelup(memdown, {
      valueEncoding: 'json'
    });
    storage = new Storage({
      db: db
    });
  });

  describe('#getWallet', function() {
    beforeEach(function() {
      server = new CopayServer({
        storage: storage,
      });
    });

    it('should get existing wallet', function(done) {

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

      server.getWallet({
        id: '123',
        includeCopayers: true
      }, function(err, wallet) {
        should.not.exist(err);
        wallet.id.should.equal('123');
        wallet.name.should.equal('my wallet');
        wallet.status.should.equal('pending');
        wallet.copayers.length.should.equal(0);
        done();
      });
    });

    it('should fail when requesting non-existent wallet', function(done) {
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

      server.getWallet({
        id: '345'
      }, function(err, wallet) {
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
        server.getWallet({
          id: '123'
        }, function(err, wallet) {
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
        server.getWallet({
          id: '123'
        }, function(err, wallet) {
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
    });

    it('should join existing wallet', function(done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: keyPair.pub,
      };

      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: '123',
          id: '999',
          name: 'me',
          xPubKey: aXPubKey,
          xPubKeySignature: aXPubKeySignature,
        };
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);
          server.getWallet({
            id: '123',
            includeCopayers: true
          }, function(err, wallet) {
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

    it('should fail to join non-existent wallet', function(done) {
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
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          done();
        });
      });
    });

    it('should fail to join full wallet', function(done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: keyPair.pub,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayer1Opts = {
          walletId: '123',
          id: '111',
          name: 'me',
          xPubKey: someXPubKeys[0],
          xPubKeySignature: someXPubKeysSignatures[0],
        };
        var copayer2Opts = {
          walletId: '123',
          id: '222',
          name: 'me 2',
          xPubKey: someXPubKeys[1],
          xPubKeySignature: someXPubKeysSignatures[1],
        };
        server.joinWallet(copayer1Opts, function(err) {
          should.not.exist(err);
          server.getWallet({
            id: '123'
          }, function(err, wallet) {
            wallet.status.should.equal('complete');
            server.joinWallet(copayer2Opts, function(err) {
              should.exist(err);
              err.should.equal('Wallet full');
              done();
            });
          });
        });
      });
    });

    it('should fail to re-join wallet', function(done) {
      var walletOpts = {
        id: '123',
        name: 'my wallet',
        m: 1,
        n: 1,
        pubKey: keyPair.pub,
      };
      server.createWallet(walletOpts, function(err) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: '123',
          id: '111',
          name: 'me',
          xPubKey: someXPubKeys[0],
          xPubKeySignature: someXPubKeysSignatures[0],
        };
        server.joinWallet(copayerOpts, function(err) {
          should.not.exist(err);
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.should.equal('Copayer already in wallet');
            done();
          });
        });
      });
    });


    it('should fail to join with bad formated signature', function(done) {
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
          xPubKey: someXPubKeys[0],
          xPubKeySignature: 'bad sign',
        };
        server.joinWallet(copayerOpts, function(err) {
          err.should.contain('Bad request');
          done();
        });
      });
    });


    it('should fail to join with null signature', function(done) {
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
          xPubKey: someXPubKeys[0],
        };
        try {
        server.joinWallet(copayerOpts, function(err) {});
        } catch (e) {
          e.should.contain('xPubKeySignature');
          done();
        }
      });
    });

    it('should fail to join with wrong signature', function(done) {
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
          xPubKey: someXPubKeys[0],
          xPubKeySignature: someXPubKeysSignatures[0],
        };
        server.joinWallet(copayerOpts, function(err) {
          err.should.contain('Bad request');
          done();
        });
      });
    });

    it('should set index in 1-1 wallet creation.', function(done) {
      helpers.createAndJoinWallet('123', 1, 1, function(err, wallet) {
        wallet.receiveAddressIndex.should.equal(0);
        wallet.changeAddressIndex.should.equal(0);
        wallet.copayerIndex.should.equal(0x80000000 - 1);

        var copayer = wallet.copayers[0];
        copayer.receiveAddressIndex.should.equal(0);
        copayer.changeAddressIndex.should.equal(0);
        copayer.copayerIndex.should.equal(0);
        done();
      });
    });
 

    it('should set pkr and status = complete on last copayer joining (2-3)', function(done) {
      helpers.createAndJoinWallet('123', 2, 3, function(err, wallet) {
        server.getWallet({
          id: '123'
        }, function(err, wallet) {
          should.not.exist(err);
          wallet.status.should.equal('complete');
          wallet.publicKeyRing.length.should.equal(3);
          _.each([0,1,2], function(i) {
            var copayer = wallet.copayers[i];
            copayer.receiveAddressIndex.should.equal(0);
            copayer.changeAddressIndex.should.equal(0);
            copayer.copayerIndex.should.equal(i);
          });
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

    it('should successfully verify message signature', function(done) {
      helpers.createAndJoinWallet('123', 2, 2, function(err, wallet) {
        var opts = {
          walletId: '123',
          copayerId: '1',
          message: aText,
          signature: aTextSignature,
        };
        server.verifyMessageSignature(opts, function(err, isValid) {
          should.not.exist(err);
          isValid.should.equal(true);
          done();
        });
      });
    });

    it('should fail to verify message signature when copayer does not exist', function(done) {
      helpers.createAndJoinWallet('123', 2, 2, function(err, wallet) {
        var opts = {
          walletId: '123',
          copayerId: '999',
          message: 'hello world',
          signature: 'dummy',
        };
        server.verifyMessageSignature(opts, function(err, isValid) {
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

    it('should create main address', function(done) {
      helpers.createAndJoinWallet('123', 2, 2, function(err, wallet) {
        server.createAddress({
          walletId: '123',
          isChange: false,
        }, function(err, address) {
          should.not.exist(err);
          address.should.exist;
          address.address.should.equal('3BPfHzwq5j72TBYtYv3Uggk3vyHFHX3QpA');
          address.path.should.equal('m/0/0/1');
          done();
        });
      });
    });


    it('should create change address', function(done) {
      helpers.createAndJoinWallet('123', 2, 2, function(err, wallet) {
        server.createAddress({
          walletId: '123',
          isChange: true,
        }, function(err, address) {
          should.not.exist(err);
          address.should.exist;
          address.address.should.equal('39Dzj5mBJWvzH7bDfmYzXDvTbZS5HdQ4a4');
          address.path.should.equal('m/0/1/1');
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
      server._doCreateAddress = sinon.stub().returns(new Address({
        address: 'addr1',
        path: 'path1'
      }));
      helpers.createAndJoinWallet('123', 2, 2, function(err, wallet) {
        server.createAddress({
          walletId: '123'
        }, function(err, address) {
          done();
        });
      });
    });

    it.skip('should create tx', function(done) {
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
      server.createTx(txOpts, function(err, tx) {
        should.not.exist(err);
        tx.should.exist;
        tx.rawTx.should.equal('raw');
        tx.isAccepted().should.equal.false;
        tx.isRejected().should.equal.false;
        server.getPendingTxs({
          walletId: '123'
        }, function(err, txs) {
          should.not.exist(err);
          txs.length.should.equal(1);
          server.getBalance({
            walletId: '123'
          }, function(err, balance) {
            should.not.exist(err);
            balance.totalAmount.should.equal(300);
            balance.lockedAmount.should.equal(200);
            done();
          });
        });
      });
    });

    it.skip('should fail to create tx when insufficient funds', function(done) {});

    it.skip('should create tx when there is a pending tx and enough UTXOs', function(done) {});

    it.skip('should fail to create tx when there is a pending tx and not enough UTXOs', function(done) {});
  });
});
