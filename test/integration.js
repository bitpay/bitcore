'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var Bitcore = require('bitcore');

var Utils = require('../lib/utils');
var SignUtils = require('../lib/signutils');
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

// with keyPair.priv
var someXPubKeysSignatures = [
  '30440220192ae7345d980f45f908bd63ccad60ce04270d07b91f1a9d92424a07a38af85202201591f0f71dd4e79d9206d2306862e6b8375e13a62c193953d768e884b6fb5a46',
  '30440220134d13139323ba16ff26471c415035679ee18b2281bf85550ccdf6a370899153022066ef56ff97091b9be7dede8e40f50a3a8aad8205f2e3d8e194f39c20f3d15c62',
  '304402207a4e7067d823a98fa634f9c9d991b8c42cd0f82da24f686992acf96cdeb5e387022021ceba729bf763fc8e4277f6851fc2b856a82a22b35f20d2eeb23d99c5f5a41c',
  '304402203ae5bf7fa8935b8ab2ac33724dbb191356cecb47c8371d2c9389e918a3600918022073b48705306730c8fe4ab22d5f6ed3ca3def27eb6e8c5cc8f53e23c11fa5e5ef',
  '3045022100eabd2a605403b377a8db9eec57726da0309a7eb385e7e4e5273b9862046f25ef02204d18755a90580a98f45e162ae5d5dc39aa3aa708a0d79433ed259e70a832b49c',
  '3045022100c282254773c65025054e18a61ee550cbf78b88fc72ef66770050815b62502d9c02206e0df528203c9201c144f865df71f5d2471668f4ed8387979fcee20f6fa121a9',
];

//Copayer signature
var aText = 'hello world';
var aTextSignature = '3045022100addd20e5413865d65d561ad2979f2289a40d52594b1f804840babd9a63e4ebbf02204b86285e1fcab02df772e7a1325fc4b511ecad79a8f80a2bd1ad8bfa858ac3d4'; // with someXPrivKey[0].derive('m/1/0')=5c0e043a513032907d181325a8e7990b076c0af15ed13dc5e611cda9bb3ae52a;


var helpers = {};
helpers.getAuthServer = function(copayerId, cb) {
  var signatureStub = sinon.stub(CopayServer.prototype, '_verifySignature');
  signatureStub.returns(true);
  CopayServer.getInstanceWithAuth({
    copayerId: copayerId,
    message: 'dummy',
    signature: 'dummy',
  }, function(err, server) {
    if (err || !server) throw new Error('Could not login as copayerId ' + copayerId);
    signatureStub.restore();
    return cb(server);
  });
};

helpers.createAndJoinWallet = function(m, n, cb) {
  var server = new CopayServer();
  var copayerIds = [];

  var walletOpts = {
    name: 'a wallet',
    m: m,
    n: n,
    pubKey: keyPair.pub,
  };
  server.createWallet(walletOpts, function(err, walletId) {
    if (err) return cb(err);

    async.each(_.range(1, n + 1), function(i, cb) {

      var copayerOpts = {
        walletId: walletId,
        name: 'copayer ' + i,
        xPubKey: someXPubKeys[i - 1],
        xPubKeySignature: someXPubKeysSignatures[i - 1],
      };

      server.joinWallet(copayerOpts, function(err, copayerId) {
        copayerIds.push(copayerId);
        return cb(err);
      });
    }, function(err) {
      if (err) return new Error('Could not generate wallet');

      helpers.getAuthServer(copayerIds[0], function(s) {
        s.getWallet({}, function(err, w) {
          cb(s, w);
        });
      });
    });
  });
};

helpers.randomTXID = function() {
  return Bitcore.crypto.Hash.sha256(new Buffer(Math.random() * 100000)).toString('hex');;
};


helpers.toSatoshi = function(btc) {
  if (_.isArray(btc)) {
    return _.map(btc, helpers.toSatoshi);
  } else {
    return Utils.strip(btc * 1e8);
  }
};

// Amounts in satoshis 
helpers.createUtxos = function(server, wallet, amounts, cb) {
  var addresses = [];

  async.each(amounts, function(a, next) {
      server.createAddress({}, function(err, address) {
        addresses.push(address);
        next(err);
      });
    },
    function(err) {
      amounts = [].concat(amounts);

      var i = 0;
      var utxos = _.map(amounts, function(amount) {
        return {
          txid: helpers.randomTXID(),
          vout: Math.floor((Math.random() * 10) + 1),
          satoshis: amount,
          scriptPubKey: addresses[i].getScriptPubKey(wallet.m).toBuffer().toString('hex'),
          address: addresses[i++].address,
        };
      });
      return cb(utxos);
    });
};


helpers.stubBlockExplorer = function(server, utxos, txid) {

  var bc = sinon.stub();
  bc.getUnspentUtxos = sinon.stub().callsArgWith(1, null, utxos);

  if (txid) {
    bc.broadcast = sinon.stub().callsArgWith(1, null, txid);
  } else {
    bc.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
  }

  server._getBlockExplorer = sinon.stub().returns(bc);
};



helpers.clientSign = function(tx, xpriv, n) {
  //Derive proper key to sign, for each input
  var privs = [],
    derived = {};
  var xpriv = new Bitcore.HDPrivateKey(someXPrivKey[0]);

  _.each(tx.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
    }
    privs.push(derived[i.path]);
  });

  var t = new Bitcore.Transaction();

  _.each(tx.inputs, function(i) {
    t.from(i, i.publicKeys, n);
  });

  t.to(tx.toAddress, tx.amount)
    .change(tx.changeAddress)
    .sign(privs);

  var signatures = [];
  _.each(privs, function(p) {
    var s = t.getSignatures(p)[0].signature.toDER().toString('hex');
    signatures.push(s);
  });
  //
  return signatures;
};

helpers.addProposalSignature = function(server, wallet, txOpts) {
  var msg = txOpts.toAddress + '|' + txOpts.amount + '|' + txOpts.message;
  var copayer = wallet.getCopayer(server.copayerId);
  txOpts.proposalSignature = SignUtils.sign(msg, copayer.signingPubKey);
};

var db, storage;


describe('Copay server', function() {
  beforeEach(function() {
    db = levelup(memdown, {
      valueEncoding: 'json'
    });
    storage = new Storage({
      db: db
    });
    CopayServer.initialize({
      storage: storage
    });
  });

  describe.skip('#getInstanceWithAuth', function() {
    beforeEach(function() {});

    it('should get server instance for existing copayer', function(done) {});

    it('should fail when requesting for non-existent copayer', function(done) {});

    it('should fail when message signature cannot be verified', function(done) {});
  });

  describe('#createWallet', function() {
    var server;
    beforeEach(function() {
      server = new CopayServer();
    });

    it('should create and store wallet', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet(walletId, function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should fail to create wallet with no name', function(done) {
      var opts = {
        name: '',
        m: 2,
        n: 3,
        pubKey: aPubKey,
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        err.should.exist;
        err.message.should.contain('name');
        done();
      });
    });

    it('should fail to create wallet with invalid copayer pairs', function(done) {
      var invalidPairs = [{
        m: 0,
        n: 0
      }, {
        m: 0,
        n: 2
      }, {
        m: 2,
        n: 1
      }, {
        m: 0,
        n: 10
      }, {
        m: 1,
        n: 20
      }, {
        m: 10,
        n: 10
      }, ];
      var opts = {
        id: '123',
        name: 'my wallet',
        pubKey: aPubKey,
      };
      async.each(invalidPairs, function(pair, cb) {
        opts.m = pair.m;
        opts.n = pair.n;
        server.createWallet(opts, function(err) {
          should.exist(err);
          err.message.should.equal('Invalid combination of required copayers / total copayers');
          return cb();
        });
      }, function(err) {
        done();
      });
    });
  });

  describe('#joinWallet', function() {
    var server, walletId;
    beforeEach(function(done) {
      server = new CopayServer();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, wId) {
        should.not.exist(err);
        should.exist.walletId;
        walletId = wId;
        done();
      });
    });

    it('should join existing wallet', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: aXPubKey,
        xPubKeySignature: aXPubKeySignature,
      };
      server.joinWallet(copayerOpts, function(err, copayerId) {
        should.not.exist(err);
        helpers.getAuthServer(copayerId, function(server) {
          server.getWallet({}, function(err, wallet) {
            wallet.id.should.equal(walletId);
            wallet.copayers.length.should.equal(1);
            var copayer = wallet.copayers[0];
            copayer.name.should.equal('me');
            copayer.id.should.equal(copayerId);
            done();
          });
        });
      });
    });

    it('should fail to join with no name', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: '',
        xPubKey: someXPubKeys[0],
        xPubKeySignature: someXPubKeysSignatures[0],
      };
      server.joinWallet(copayerOpts, function(err, copayerId) {
        should.not.exist(copayerId);
        err.should.exist;
        err.message.should.contain('name');
        done();
      });
    });

    it('should fail to join non-existent wallet', function(done) {
      var copayerOpts = {
        walletId: '123',
        name: 'me',
        xPubKey: 'dummy',
        xPubKeySignature: 'dummy',
      };
      server.joinWallet(copayerOpts, function(err) {
        should.exist(err);
        done();
      });
    });

    it('should fail to join full wallet', function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, wallet) {
        var copayerOpts = {
          walletId: wallet.id,
          name: 'me',
          xPubKey: someXPubKeys[1],
          xPubKeySignature: someXPubKeysSignatures[1],
        };
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.code.should.equal('WFULL');
          err.message.should.equal('Wallet full');
          done();
        });
      });
    });

    it('should fail to re-join wallet', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: someXPubKeys[0],
        xPubKeySignature: someXPubKeysSignatures[0],
      };
      server.joinWallet(copayerOpts, function(err) {
        should.not.exist(err);
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.code.should.equal('CINWALLET');
          err.message.should.equal('Copayer already in wallet');
          done();
        });
      });
    });

    it('should fail to join with bad formated signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: someXPubKeys[0],
        xPubKeySignature: 'bad sign',
      };
      server.joinWallet(copayerOpts, function(err) {
        err.message.should.equal('Bad request');
        done();
      });
    });

    it('should fail to join with null signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: someXPubKeys[0],
      };
      server.joinWallet(copayerOpts, function(err) {
        err.should.exist;
        err.message.should.contain('argument missing');
        done();
      });
    });

    it('should fail to join with wrong signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: someXPubKeys[0],
        xPubKeySignature: someXPubKeysSignatures[1],
      };
      server.joinWallet(copayerOpts, function(err) {
        err.message.should.equal('Bad request');
        done();
      });
    });

    it('should set pkr and status = complete on last copayer joining (2-3)', function(done) {
      helpers.createAndJoinWallet(2, 3, function(server) {
        server.getWallet({}, function(err, wallet) {
          should.not.exist(err);
          wallet.status.should.equal('complete');
          wallet.publicKeyRing.length.should.equal(3);
          done();
        });
      });
    });
  });


  describe('#verifyMessageSignature', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should successfully verify message signature', function(done) {
      var opts = {
        message: aText,
        signature: aTextSignature,
      };
      server.verifyMessageSignature(opts, function(err, isValid) {
        should.not.exist(err);
        isValid.should.equal(true);
        done();
      });
    });

    it('should fail to verify message signature for different copayer', function(done) {
      var opts = {
        message: aText,
        signature: aTextSignature,
      };
      helpers.getAuthServer(wallet.copayers[1].id, function(server) {
        server.verifyMessageSignature(opts, function(err, isValid) {
          should.not.exist(err);
          isValid.should.be.false;
          done();
        });
      });
    });
  });

  describe('#createAddress', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should create address', function(done) {
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        address.should.exist;
        address.address.should.equal('36JdLEUDa6UwCfMhhkdZ2VFnDrGUoLedsR');
        address.path.should.equal('m/2147483647/0/0');
        done();
      });
    });

    it('should fail to create address when wallet is not complete', function(done) {
      var server = new CopayServer();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: aXPubKey,
          xPubKeySignature: aXPubKeySignature,
        };
        server.joinWallet(copayerOpts, function(err, copayerId) {
          should.not.exist(err);
          helpers.getAuthServer(copayerId, function(server) {
            server.createAddress({}, function(err, address) {
              should.not.exist(address);
              err.should.exist;
              err.message.should.contain('not complete');
              done();
            });
          });
        });
      });
    });

    it('should create many addresses on simultaneous requests', function(done) {
      var N = 5;
      async.map(_.range(N), function(i, cb) {
        server.createAddress({}, cb);
      }, function(err, addresses) {
        addresses.length.should.equal(N);
        _.each(_.range(N), function(i) {
          addresses[i].path.should.equal('m/2147483647/0/' + i);
        });
        // No two identical addresses
        _.uniq(_.pluck(addresses, 'address')).length.should.equal(N);
        done();
      });
    });

    it('should not create address if unable to store it', function(done) {
      sinon.stub(server.storage, 'storeAddressAndWallet').yields('dummy error');
      server.createAddress({}, function(err, address) {
        err.should.exist;
        should.not.exist(address);

        server.getAddresses({}, function(err, addresses) {
          addresses.length.should.equal(0);

          server.storage.storeAddressAndWallet.restore();
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.should.exist;
            address.address.should.equal('36JdLEUDa6UwCfMhhkdZ2VFnDrGUoLedsR');
            address.path.should.equal('m/2147483647/0/0');
            done();
          });
        });
      });
    });
  });

  describe('#createTx', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          done();
        });
      });
    });

    it.only('should create a tx', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([100, 200]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: helpers.toSatoshi(80),
          message: 'some message',
        };
        helpers.addProposalSignature(txOpts, );
        console.log(txOpts);
        server.createTx(txOpts, function(err, tx) {
          console.log(err);
          should.not.exist(err);
          tx.should.exist;
          tx.message.should.equal('some message');
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(1);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.totalAmount.should.equal(helpers.toSatoshi(300));
              balance.lockedAmount.should.equal(helpers.toSatoshi(100));
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx when wallet is not complete', function(done) {
      var server = new CopayServer();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: aXPubKey,
          xPubKeySignature: aXPubKeySignature,
        };
        server.joinWallet(copayerOpts, function(err, copayerId) {
          should.not.exist(err);
          helpers.getAuthServer(copayerId, function(server, wallet) {
            var txOpts = {
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: helpers.toSatoshi(80),
              proposalSignature: 'dummy',
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              err.should.exist;
              err.message.should.contain('not complete');
              done();
            });
          });
        });
      });
    });

    it('should fail to create tx for address invalid address', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([100, 200]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: 'invalid address',
          amount: helpers.toSatoshi(80),
          proposalSignature: 'dummy',
        };

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          err.should.exist;
          err.code.should.equal('INVALIDADDRESS');
          err.message.should.equal('Invalid address');
          done();
        });
      });
    });

    it('should fail to create tx for address of different network', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([100, 200]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: 'myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD', // testnet
          amount: helpers.toSatoshi(80),
          proposalSignature: 'dummy',
        };

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          err.should.exist;
          err.code.should.equal('INVALIDADDRESS');
          err.message.should.equal('Incorrect address network');
          done();
        });
      });
    });

    it('should fail to create tx when insufficient funds', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([100]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: helpers.toSatoshi(120),
          proposalSignature: 'dummy',
        };

        server.createTx(txOpts, function(err, tx) {
          err.code.should.equal('INSUFFICIENTFUNDS');
          err.message.should.equal('Insufficient funds');
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(0);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.lockedAmount.should.equal(0);
              balance.totalAmount.should.equal(10000000000);
              done();
            });
          });
        });
      });
    });

    it.skip('should fail to create tx when insufficient funds for fee', function(done) {});

    it.skip('should fail to create tx for dust amount', function(done) {});

    it('should create tx when there is a pending tx and enough UTXOs', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([10.1, 10.2, 10.3]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: helpers.toSatoshi(12),
          proposalSignature: 'dummy',
        };
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          tx.should.exist;

          var txOpts2 = {
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: 8,
            proposalSignature: 'dummy',
          };
          server.createTx(txOpts2, function(err, tx) {
            should.not.exist(err);
            tx.should.exist;
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(2);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(3060000000);
                balance.lockedAmount.should.equal(3060000000);
                done();
              });
            });
          });
        });
      });
    });

    it('should fail to create tx when there is a pending tx and not enough UTXOs', function(done) {
      helpers.createUtxos(server, wallet, helpers.toSatoshi([10.1, 10.2, 10.3]), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        var txOpts = {
          toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
          amount: helpers.toSatoshi(12),
          proposalSignature: 'dummy',
        };
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          tx.should.exist;

          var txOpts2 = {
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: helpers.toSatoshi(24),
            proposalSignature: 'dummy',
          };
          server.createTx(txOpts2, function(err, tx) {
            err.code.should.equal('INSUFFICIENTFUNDS');
            err.message.should.equal('Insufficient funds');
            should.not.exist(tx);
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(1);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(helpers.toSatoshi(30.6));
                balance.lockedAmount.should.equal(helpers.toSatoshi(20.3));
                done();
              });
            });
          });
        });
      });
    });

    it('should create tx using different UTXOs for simultaneous requests', function(done) {
      var N = 5;
      helpers.createUtxos(server, wallet, helpers.toSatoshi(_.times(N, function() {
        return 100;
      })), function(utxos) {
        helpers.stubBlockExplorer(server, utxos);
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
          balance.lockedAmount.should.equal(helpers.toSatoshi(0));

          var txOpts = {
            toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
            amount: helpers.toSatoshi(80),
            proposalSignature: 'dummy',
          };
          async.map(_.range(N), function(i, cb) {
            server.createTx(txOpts, function(err, tx) {
              cb(err, tx);
            });
          }, function(err) {
            server.getPendingTxs({}, function(err, txs) {
              should.not.exist(err);
              txs.length.should.equal(N);
              _.uniq(_.pluck(txs, 'changeAddress')).length.should.equal(N);
              server.getBalance({}, function(err, balance) {
                should.not.exist(err);
                balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
                balance.lockedAmount.should.equal(balance.totalAmount);
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('#signTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.createUtxos(server, wallet, helpers.toSatoshi([1, 2, 3, 4, 5, 6, 7, 8]), function(utxos) {
            helpers.stubBlockExplorer(server, utxos);
            var txOpts = {
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: helpers.toSatoshi(10),
              proposalSignature: 'dummy',
            };
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              tx.should.exist;
              txid = tx.id;
              done();
            });
          });
        });
      });
    });

    it('should sign a TX with multiple inputs, different paths', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, someXPrivKey[0], wallet.n);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should fail if one signature is broken', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, someXPrivKey[0], wallet.n);
        signatures[0] = 1;

        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          err.message.should.contain('signatures');
          done();
        });
      });
    });
    it('should fail on invalid signature', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = ['11', '22', '33', '44'];
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          err.message.should.contain('signatures');
          done();
        });
      });
    });
  });


  describe('#signTx and broadcast', function() {
    var server, wallet, utxos;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.createUtxos(server, wallet, helpers.toSatoshi([1, 2, 3, 4, 5, 6, 7, 8]), function(inutxos) {
            utxos = inutxos;
            done();
          });
        });
      });
    });

    it('should sign and broadcast a tx', function(done) {
      helpers.stubBlockExplorer(server, utxos, '1122334455');
      var txOpts = {
        toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
        amount: helpers.toSatoshi(10),
      };
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        txp.should.exist;
        var txpid = txp.id;

        server.getPendingTxs({}, function(err, txps) {
          var txp = txps[0];
          txp.id.should.equal(txpid);
          var signatures = helpers.clientSign(txp, someXPrivKey[0], wallet.n);
          server.signTx({
            txProposalId: txpid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('broadcasted');
            txp.txid.should.equal('1122334455');
            done();
          });
        });
      });
    });


    it('should keep tx as *accepted* if unable to broadcast it', function(done) {
      helpers.stubBlockExplorer(server, utxos);
      var txOpts = {
        toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
        amount: helpers.toSatoshi(10),
      };
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        txp.should.exist;
        var txpid = txp.id;

        server.getPendingTxs({}, function(err, txps) {
          var txp = txps[0];
          txp.id.should.equal(txpid);
          var signatures = helpers.clientSign(txp, someXPrivKey[0], wallet.n);
          server.signTx({
            txProposalId: txpid,
            signatures: signatures,
          }, function(err, txp) {
            err.should.contain('broadcast');

            server.getPendingTxs({}, function(err, txps) {
              should.not.exist(err);
              txps.length.should.equal(1);
              var txp = txps[0];
              txp.status.should.equal('accepted');
              should.not.exist(txp.txid);
              done();
            });
          });
        });
      });
    });
  });

  describe('Tx proposal workflow', function() {
    var server, wallet, utxos;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.createUtxos(server, wallet, helpers.toSatoshi([1, 2, 3, 4, 5, 6, 7, 8]), function(inutxos) {
            utxos = inutxos;
            done();
          });
        });
      });
    });

    it('other copayers should see pending proposal created by one copayer', function(done) {
      helpers.stubBlockExplorer(server, utxos);
      var txOpts = {
        toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
        amount: helpers.toSatoshi(10),
        message: 'some message',
        proposalSignature: 'dummy',
      };
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        should.exist.txp;
        helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
          server2.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            txps[0].id.should.equal(txp.id);
            txps[0].message.should.equal('some message');
            done();
          });
        });
      });
    });

    it.skip('tx proposals should not be broadcast until quorum is reached', function(done) {

    });

    it.skip('tx proposals should accept as many rejections as possible without finally rejecting', function(done) {});

    it.skip('proposal creator should be able to delete proposal if there are no other signatures', function(done) {});
  });

  describe('#getTxs', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      if (server)
        return done();

      this.timeout(5000);
      console.log('\tCreating TXS...');
      clock = sinon.useFakeTimers();
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.createUtxos(server, wallet, helpers.toSatoshi(_.range(10)), function(utxos) {
            helpers.stubBlockExplorer(server, utxos);
            var txOpts = {
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: helpers.toSatoshi(0.1),
            };
            async.eachSeries(_.range(10), function(i, next) {
              clock.tick(10000);
              server.createTx(txOpts, function(err, tx) {
                next();
              });
            }, function(err) {
              return done(err);
            });
          });
        });
      });
    });
    afterEach(function() {
      clock.restore();
    });

    it('should pull 4 txs, down to to time 60', function(done) {
      server.getTxs({
        minTs: 60,
        limit: 8
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([90, 80, 70, 60]);
        done();
      });
    });

    it('should pull the first 5 txs', function(done) {
      server.getTxs({
        maxTs: 50,
        limit: 5
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([50, 40, 30, 20, 10]);
        done();
      });
    });

    it('should pull the last 4 txs', function(done) {
      server.getTxs({
        limit: 4
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([90, 80, 70, 60]);
        done();
      });
    });

    it('should pull all txs', function(done) {
      server.getTxs({}, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([90, 80, 70, 60, 50, 40, 30, 20, 10]);
        done();
      });
    });


    it('should txs from times 50 to 70', function(done) {
      server.getTxs({
        minTs: 50,
        maxTs: 70,
      }, function(err, txps) {
        should.not.exist(err);
        var times = _.pluck(txps, 'createdOn');
        times.should.deep.equal([70, 60, 50]);
        done();
      });
    });
  });
});
