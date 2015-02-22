'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var Bitcore = require('bitcore');

var Utils = require('../../lib/utils');
var WalletUtils = require('../../lib/walletutils');
var Storage = require('../../lib/storage');

var Wallet = require('../../lib/model/wallet');
var Address = require('../../lib/model/address');
var Copayer = require('../../lib/model/copayer');
var WalletService = require('../../lib/server');
var TestData = require('../testdata');

var helpers = {};
helpers.getAuthServer = function(copayerId, cb) {
  var signatureStub = sinon.stub(WalletService.prototype, '_verifySignature');
  signatureStub.returns(true);
  WalletService.getInstanceWithAuth({
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
  var server = new WalletService();
  var copayerIds = [];
  var offset = helpers.offset || 0;

  var walletOpts = {
    name: 'a wallet',
    m: m,
    n: n,
    pubKey: TestData.keyPair.pub,
  };
  server.createWallet(walletOpts, function(err, walletId) {
    if (err) return cb(err);

    async.each(_.range(n), function(i, cb) {
      var copayerOpts = {
        walletId: walletId,
        name: 'copayer ' + (i + 1),
        xPubKey: TestData.copayers[i + offset].xPubKey,
        xPubKeySignature: TestData.copayers[i + offset].xPubKeySignature,
      };

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        copayerIds.push(result.copayerId);
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
helpers.stubUtxos = function(server, wallet, amounts, cb) {
  var amounts = [].concat(amounts);

  async.map(_.range(Math.ceil(amounts.length / 2)), function(i, next) {
    server.createAddress({}, function(err, address) {
      next(err, address);
    });
  }, function(err, addresses) {
    if (err) throw new Error('Could not generate addresses');

    var utxos = _.map(amounts, function(amount, i) {
      var address = addresses[i % addresses.length];
      var obj = {
        txid: helpers.randomTXID(),
        vout: Math.floor((Math.random() * 10) + 1),
        satoshis: helpers.toSatoshi(amount).toString(),
        scriptPubKey: address.getScriptPubKey(wallet.m).toBuffer().toString('hex'),
        address: address.address,
      };
      obj.toObject = function() {
        return obj;
      };
      return obj;
    });
    blockExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, null, utxos);

    return cb(utxos);
  });
};

helpers.stubBroadcast = function(txid) {
  blockExplorer.broadcast = sinon.stub().callsArgWith(1, null, txid);
};

helpers.stubBroadcastFail = function() {
  blockExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
};


helpers.clientSign = function(txp, xprivHex) {
  //Derive proper key to sign, for each input
  var privs = [],
    derived = {};
  var xpriv = new Bitcore.HDPrivateKey(xprivHex);

  _.each(txp.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = new Bitcore.Transaction();

  _.each(txp.inputs, function(i) {
    t.from(i, i.publicKeys, txp.requiredSignatures);
  });

  t.to(txp.toAddress, txp.amount)
    .change(txp.changeAddress.address);

  var signatures = _.map(privs, function(priv, i) {
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};

helpers.createProposalOpts = function(toAddress, amount, message, signingKey) {
  var opts = {
    toAddress: toAddress,
    amount: helpers.toSatoshi(amount),
    message: message,
    proposalSignature: null,
  };
  var hash = WalletUtils.getProposalHash(opts.toAddress, opts.amount, opts.message);
  try {
    opts.proposalSignature = WalletUtils.signMessage(hash, signingKey);
  } catch (ex) {}

  return opts;
};

var db, storage, blockExplorer;


describe('Copay server', function() {
  beforeEach(function() {
    db = levelup(memdown, {
      valueEncoding: 'json'
    });
    storage = new Storage({
      db: db
    });
    blockExplorer = sinon.stub();

    WalletService.initialize({
      storage: storage,
      blockExplorer: blockExplorer,
    });
    helpers.offset = 0;
  });


  describe('#getInstanceWithAuth', function() {
    beforeEach(function() {});

    it('should get server instance for existing copayer', function(done) {

      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        var xpriv = TestData.copayers[0].xPrivKey;
        var priv = Bitcore.HDPrivateKey
          .fromString(xpriv)
          .derive('m/1/1')
          .privateKey
          .toString();

        var message = 'hola';
        var sig = WalletUtils.signMessage(message, priv);

        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: message,
          signature: sig,
        }, function(err, server) {
          should.not.exist(err);
          done();
        });
      });
    });

    it('should fail when requesting for non-existent copayer', function(done) {
      WalletService.getInstanceWithAuth({
        copayerId: 'ads',
        message: TestData.message.text,
        signature: TestData.message.signature,
      }, function(err, server) {
        err.code.should.equal('NOTAUTHORIZED');
        err.message.should.contain('Copayer not found');
        done();
      });
    });

    it('should fail when message signature cannot be verified', function(done) {
      helpers.createAndJoinWallet(1, 2, function(s, wallet) {
        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'dummy',
          signature: 'dummy',
        }, function(err, server) {
          err.code.should.equal('NOTAUTHORIZED');
          err.message.should.contain('Invalid signature');
          done();
        });
      });
    });
  });

  describe('#createWallet', function() {
    var server;
    beforeEach(function() {
      server = new WalletService();
    });

    it('should create and store wallet', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
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
        pubKey: TestData.keyPair.pub,
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
        pubKey: TestData.keyPair.pub,
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
      server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
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
        xPubKey: TestData.copayers[0].xPubKey,
        xPubKeySignature: TestData.copayers[0].xPubKeySignature,
      };
      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;
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
        xPubKey: TestData.copayers[0].xPubKey,
        xPubKeySignature: TestData.copayers[0].xPubKeySignature,
      };
      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(result);
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
          xPubKey: TestData.copayers[1].xPubKey,
          xPubKeySignature: TestData.copayers[1].xPubKeySignature,
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
        xPubKey: TestData.copayers[0].xPubKey,
        xPubKeySignature: TestData.copayers[0].xPubKeySignature,
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
        xPubKey: TestData.copayers[0].xPubKey,
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
        xPubKey: TestData.copayers[0].xPubKey[0],
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
        xPubKey: TestData.copayers[0].xPubKey,
        xPubKeySignature: TestData.copayers[1].xPubKeySignature,
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
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should successfully verify message signature', function(done) {
      var opts = {
        message: TestData.message.text,
        signature: TestData.message.signature,
      };
      server.verifyMessageSignature(opts, function(err, isValid) {
        should.not.exist(err);
        isValid.should.equal(true);
        done();
      });
    });

    it('should fail to verify message signature for different copayer', function(done) {
      var opts = {
        message: TestData.message.text,
        signature: TestData.message.signature,
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
        address.address.should.equal('38Jf1QE7ddXscW76ACgJrNkMWBwDAgMm6M');
        address.isChange.should.be.false;
        address.path.should.equal('m/2147483647/0/0');
        done();
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

        server.getMainAddresses({}, function(err, addresses) {
          addresses.length.should.equal(0);

          server.storage.storeAddressAndWallet.restore();
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.should.exist;
            address.address.should.equal('38Jf1QE7ddXscW76ACgJrNkMWBwDAgMm6M');
            address.path.should.equal('m/2147483647/0/0');
            done();
          });
        });
      });
    });
  });


  describe('Wallet not complete tests', function() {
    it('should fail to create address when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey,
          xPubKeySignature: TestData.copayers[0].xPubKeySignature,
        };
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server) {
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

    it('should fail to create tx when wallet is not complete', function(done) {
      var server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = {
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey,
          xPubKeySignature: TestData.copayers[0].xPubKeySignature,
        };
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server, wallet) {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey);
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
  });


  describe('#createTx', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          done();
        });
      });
    });

    it('should create a tx', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
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
              server.storage.fetchAddresses(wallet.id, function(err, addresses) {
                should.not.exist(err);
                var change = _.filter(addresses, {
                  isChange: true
                });
                change.length.should.equal(1);
              });
              done();
            });
          });
        });
      });
    });


    it('should fail to create tx with invalid proposal signature', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, 'dummy');

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          err.should.exist;
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx with proposal signed by another copayer', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[1].privKey);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          err.should.exist;
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx for invalid address', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('invalid address', 80, null, TestData.copayers[0].privKey);

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
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD', 80, null, TestData.copayers[0].privKey);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.code.should.equal('INVALIDADDRESS');
          err.message.should.equal('Incorrect address network');
          done();
        });
      });
    });

    it('should fail to create tx when insufficient funds', function(done) {
      helpers.stubUtxos(server, wallet, [100], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 120, null, TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
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

    it('should fail to create tx when insufficient funds for fee', function(done) {
      helpers.stubUtxos(server, wallet, [100], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 100, null, TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENTFUNDS');
          err.message.should.equal('Insufficient funds');
          done();
        });
      });
    });

    it('should fail to create tx for dust amount', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.00000001, null, TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('DUSTAMOUNT');
          err.message.should.equal('Amount below dust threshold');
          done();
        });
      });
    });

    it('should create tx when there is a pending tx and enough UTXOs', function(done) {
      helpers.stubUtxos(server, wallet, [10.1, 10.2, 10.3], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          tx.should.exist;
          var txOpts2 = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 8, null, TestData.copayers[0].privKey);
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
      helpers.stubUtxos(server, wallet, [10.1, 10.2, 10.3], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          tx.should.exist;
          var txOpts2 = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 24, null, TestData.copayers[0].privKey);
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
      helpers.stubUtxos(server, wallet, _.times(N, function() {
        return 100;
      }), function(utxos) {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
          balance.lockedAmount.should.equal(helpers.toSatoshi(0));
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey);
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


  describe('#rejectTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey);
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

    it('should reject a TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        server.rejectTx({
          txProposalId: txid,
          reason: 'some reason',
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            var tx = txs[0];
            tx.id.should.equal(txid);

            var actors = tx.getActors();
            actors.length.should.equal(1);
            actors[0].should.equal(wallet.copayers[0].id);
            var action = tx.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('reject');
            action.comment.should.equal('some reason');
            done();
          });
        });
      });
    });
  });

  describe('#signTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(err);
              should.exist(tx);
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

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            var tx = txs[0];
            tx.id.should.equal(txid);

            var actors = tx.getActors();
            actors.length.should.equal(1);
            actors[0].should.equal(wallet.copayers[0].id);
            tx.getActionBy(wallet.copayers[0].id).type.should.equal('accept');

            done();
          });
        });
      });
    });


    it('should fail to sign with a xpriv from other copayer', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);
        var signatures = helpers.clientSign(tx, TestData.copayers[1].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          err.code.should.contain('BADSIG');
          done();
        });
      });
    });

    it('should fail if one signature is broken', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
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

        var signatures = ['11', '22', '33', '44', '55'];
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.exist(err);
          err.message.should.contain('Bad signatures');
          done();
        });
      });
    });

    it('should fail on wrong number of invalid signatures', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = _.take(helpers.clientSign(tx, TestData.copayers[0].xPrivKey), 2);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          should.exist(err);
          err.message.should.contain('Bad signatures');
          done();
        });
      });
    });

    it('should fail when signing a TX previously rejected', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: txid,
          signatures: signatures,
        }, function(err) {
          server.rejectTx({
            txProposalId: txid,
          }, function(err) {
            err.code.should.contain('CVOTED');
            done();
          });
        });
      });
    });

    it('should fail when rejected a previously signed TX', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        server.rejectTx({
          txProposalId: txid,
        }, function(err) {
          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txid,
            signatures: signatures,
          }, function(err) {
            err.code.should.contain('CVOTED');
            done();
          });
        });
      });
    });

  });


  describe('#signTx and broadcast', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
            done();
          });
        });
      });
    });

    it('should sign and broadcast a tx', function(done) {
      helpers.stubBroadcast('1122334455');
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        txp.should.exist;
        var txpid = txp.id;

        server.getPendingTxs({}, function(err, txps) {
          var txp = txps[0];
          txp.id.should.equal(txpid);
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txpid,
            signatures: signatures,
          }, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('broadcasted');
            txp.txid.should.equal('1122334455');
            server.getTx({
              id: txp.id
            }, function(err, txp) {
              txp.actions.length.should.equal(1);
              txp.actions[0].copayerId.should.equal(wallet.copayers[0].id);
              txp.actions[0].copayerName.should.equal(wallet.copayers[0].name);
              done();
            });
          });
        });
      });
    });


    it('should keep tx as *accepted* if unable to broadcast it', function(done) {
      helpers.stubBroadcastFail();
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        txp.should.exist;
        var txpid = txp.id;

        server.getPendingTxs({}, function(err, txps) {
          var txp = txps[0];
          txp.id.should.equal(txpid);
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
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
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
            helpers.stubBroadcast('999');
            done();
          });
        });
      });
    });

    it('other copayers should see pending proposal created by one copayer', function(done) {
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey);
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

    it('tx proposals should not be broadcast until quorum is reached', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist.txp;
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next(null, txp);
          });
        },
        function(txp, next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
          server.signTx({
            txProposalId: txpId,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isRejected().should.be.false;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('accept');
            next(null, txp);
          });
        },
        function(txp, next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
            server.signTx({
              txProposalId: txpId,
              signatures: signatures,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(0);
            next();
          });
        },
        function(next) {
          server.getTx({
            id: txpId
          }, function(err, txp) {
            should.not.exist(err);
            txp.isPending().should.be.false;
            txp.isRejected().should.be.false;
            txp.isAccepted().should.be.true;
            txp.isBroadcasted().should.be.true;
            txp.txid.should.equal('999');
            txp.actions.length.should.equal(2);
            done();
          });
        },
      ]);
    });

    it('tx proposals should accept as many rejections as possible without finally rejecting', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist.txp;
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.actions.should.be.empty;
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txpId,
            reason: 'just because'
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isRejected().should.be.false;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('reject');
            action.comment.should.equal('just because');
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            server.rejectTx({
              txProposalId: txpId,
              reason: 'some other reason'
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txps) {
            should.not.exist(err);
            txps.length.should.equal(0);
            next();
          });
        },
        function(next) {
          server.getTx({
            id: txpId
          }, function(err, txp) {
            should.not.exist(err);
            txp.isPending().should.be.false;
            txp.isRejected().should.be.true;
            txp.isAccepted().should.be.false;
            txp.actions.length.should.equal(2);
            done();
          });
        },
      ]);
    });
  });


  describe('#getTxs', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      if (server) return done();
      this.timeout(5000);
      console.log('\tCreating TXS...');
      clock = sinon.useFakeTimers();
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(10), function() {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, null, TestData.copayers[0].privKey);
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



  describe('Notifications', function() {
    var server, wallet;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, helpers.toSatoshi(_.range(4)), function() {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.01, null, TestData.copayers[0].privKey);
            async.eachSeries(_.range(3), function(i, next) {
              server.createTx(txOpts, function(err, tx) {
                should.not.exist(err);
                next();
              });
            }, function(err) {
              return done(err);
            });
          });
        });
      });
    });

    it('should pull the last 4 notifications after 3 TXs', function(done) {
      server.getNotifications({
        limit: 4,
        reverse: true,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewTxProposal', 'NewAddress']);
        done();
      });
    });

    it('should pull the last 4 notifications, using now', function(done) {
      server.getNotifications({
        limit: 4,
        reverse: true,
        maxTs: Date.now() / 1000,
        minTs: Date.now() / 1000 - 1000,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types.should.deep.equal(['NewTxProposal', 'NewTxProposal', 'NewTxProposal', 'NewAddress']);
        done();
      });
    });

    it('should pull all notifications after wallet creation', function(done) {
      server.getNotifications({
        minTs: 0,
      }, function(err, notifications) {
        should.not.exist(err);
        var types = _.pluck(notifications, 'type');
        types[0].should.equal('NewCopayer');
        types[types.length - 1].should.equal('NewTxProposal');
        done();
      });
    });

    it('should notify sign and acceptance', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        helpers.stubBroadcastFail();
        var tx = txs[0];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          server.getNotifications({
            limit: 3,
            reverse: true,
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.pluck(notifications, 'type');
            types.should.deep.equal(['TxProposalFinallyAccepted', 'TxProposalAcceptedBy', 'NewTxProposal']);
            done();
          });
        });
      });
    });

    it('should notify rejection', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[1];
        server.rejectTx({
          txProposalId: tx.id,
        }, function(err) {
          should.not.exist(err);
          server.getNotifications({
            limit: 2,
            reverse: true,
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.pluck(notifications, 'type');
            types.should.deep.equal(['TxProposalFinallyRejected', 'TxProposalRejectedBy']);
            done();
          });
        });
      });
    });


    it('should notify sign, acceptance, and broadcast, and emit', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[2];
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
        helpers.stubBroadcast('1122334455');
        sinon.spy(server, 'emit');
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          server.getNotifications({
            limit: 3,
            reverse: true,
          }, function(err, notifications) {
            should.not.exist(err);
            var types = _.pluck(notifications, 'type');
            types.should.deep.equal(['NewOutgoingTx', 'TxProposalFinallyAccepted', 'TxProposalAcceptedBy']);
            // Check also events
            server.emit.getCall(0).args[0].type.should.equal('TxProposalAcceptedBy');
            server.emit.getCall(1).args[0].type.should.equal('TxProposalFinallyAccepted');;
            server.emit.getCall(2).args[0].type.should.equal('NewOutgoingTx');

            done();
          });
        });
      });
    });
  });

  describe('#removeWallet', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;

        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, _.range(2), function() {
            var txOpts = {
              toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
              amount: helpers.toSatoshi(0.1),
            };
            async.eachSeries(_.range(2), function(i, next) {
              server.createTx(txOpts, function(err, tx) {
                next();
              });
            }, done);
          });
        });
      });
    });
    it('should delete a wallet', function(done) {
      var i = 0;
      var count = function() {
        return ++i;
      };
      server.storage._dump(function() {
        i.should.above(1);
        server.removeWallet({}, function(err) {
          i = 0;
          server.storage._dump(function() {
            server.storage._dump();
            i.should.equal(0);
            done();
          }, count);
        });
      }, count);
    });

    // creates 2 wallet, and deletes only 1.
    it('should delete a wallet, and only that wallet', function(done) {
      var i = 0;
      var db = [];
      var cat = function(data) {
        db.push(data);
      };
      server.storage._dump(function() {
        var before = _.clone(db);
        db.length.should.above(1);

        helpers.offset = 1;
        helpers.createAndJoinWallet(2, 3, function(s, w) {
          server = s;
          wallet = w;

          server.createAddress({}, function(err, address) {
            helpers.stubUtxos(server, wallet, _.range(2), function() {
              var txOpts = {
                toAddress: '18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7',
                amount: helpers.toSatoshi(0.1),
              };
              async.eachSeries(_.range(2), function(i, next) {
                server.createTx(txOpts, function(err, tx) {
                  next();
                });
              }, function() {
                server.removeWallet({}, function(err) {
                  db = [];
                  server.storage._dump(function() {
                    var after = _.clone(db);
                    after.should.deep.equal(before);
                    done();
                  }, cat);
                });
              }, cat);
            });
          });
        });
      }, cat);
    });
  });


  describe('#removePendingTx', function() {
    var server, wallet, txp;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        server.createAddress({}, function(err, address) {
          helpers.stubUtxos(server, wallet, [100, 200], function() {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey);
            server.createTx(txOpts, function(err, tx) {
              server.getPendingTxs({}, function(err, txs) {
                txp = txs[0];
                done();
              });
            });
          });
        });
      });
    });

    it('should allow creator to remove an unsigned TX', function(done) {
      server.removePendingTx({
        txProposalId: txp.id
      }, function(err) {
        should.not.exist(err);
        server.getPendingTxs({}, function(err, txs) {
          txs.length.should.equal(0);
          done();
        });
      });
    });

    it('should allow creator to remove an signed TX by himself', function(done) {
      var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
      server.signTx({
        txProposalId: txp[0],
        signatures: signatures,
      }, function(err) {
        server.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          should.not.exist(err);
          server.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(0);
            done();
          });
        });
      });
    });

    it('should not allow non-creator copayer to remove an unsigned TX ', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        server2.removePendingTx({
          txProposalId: txp.id
        }, function(err) {
          err.message.should.contain('creators');
          server2.getPendingTxs({}, function(err, txs) {
            txs.length.should.equal(1);
            done();
          });
        });
      });
    });

    it('should not allow creator copayer to remove an TX signed by other copayer', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2) {
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            err.message.should.contain('other copayers');
            done();
          });
        });
      });
    });
  });
});
