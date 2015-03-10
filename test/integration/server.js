'use strict';

var _ = require('lodash');
var async = require('async');
var inspect = require('util').inspect;

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var levelup = require('levelup');
var memdown = require('memdown');
var log = require('npmlog');
log.debug = log.verbose;
var Bitcore = require('bitcore');

var Utils = require('../../lib/utils');
var WalletUtils = require('bitcore-wallet-utils');
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

helpers._generateCopayersTestData = function(n) {
  console.log('var copayers = [');
  _.each(_.range(n), function(c) {
    var xpriv = new Bitcore.HDPrivateKey();
    var xpub = Bitcore.HDPublicKey(xpriv);

    var xpriv_45H = xpriv.derive(45, true);
    var xpub_45H = Bitcore.HDPublicKey(xpriv_45H);
    var id = WalletUtils.xPubToCopayerId(xpub_45H.toString());

    var xpriv_1H = xpriv.derive(1, true);
    var xpub_1H = Bitcore.HDPublicKey(xpriv_1H);
    var priv = xpriv_1H.derive(0).privateKey;
    var pub = xpub_1H.derive(0).publicKey;

    console.log('{id: ', "'" + id + "',");
    console.log('xPrivKey: ', "'" + xpriv.toString() + "',");
    console.log('xPubKey: ', "'" + xpub.toString() + "',");
    console.log('xPrivKey_45H: ', "'" + xpriv_45H.toString() + "',");
    console.log('xPubKey_45H: ', "'" + xpub_45H.toString() + "',");
    console.log('xPrivKey_1H: ', "'" + xpriv_1H.toString() + "',");
    console.log('xPubKey_1H: ', "'" + xpub_1H.toString() + "',");
    console.log('privKey_1H_0: ', "'" + priv.toString() + "',");
    console.log('pubKey_1H_0: ', "'" + pub.toString() + "'},");
  });
  console.log('];');
};

helpers.getSignedCopayerOpts = function(opts) {
  var hash = WalletUtils.getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
  opts.copayerSignature = WalletUtils.signMessage(hash, TestData.keyPair.priv);
  return opts;
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
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'copayer ' + (i + 1),
        xPubKey: TestData.copayers[i + offset].xPubKey_45H,
        requestPubKey: TestData.copayers[i + offset].pubKey_1H_0,
      });

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

  async.map(_.range(1, Math.ceil(amounts.length / 2) + 1), function(i, next) {
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

helpers.stubHistory = function(txs) {
  blockExplorer.getTransactions = sinon.stub().callsArgWith(1, null, txs);
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

helpers.createAddresses = function(server, wallet, main, change, cb) {
  async.map(_.range(main + change), function(i, next) {
    var address = wallet.createAddress(i >= main);
    server.storage.storeAddressAndWallet(wallet, address, function(err) {
      if (err) return next(err);
      next(null, address);
    });
  }, function(err, addresses) {
    if (err) throw new Error('Could not generate addresses');
    return cb(_.take(addresses, main), _.takeRight(addresses, change));
  });
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
        var priv = TestData.copayers[0].privKey_1H_0;

        var sig = WalletUtils.signMessage('hello world', priv);

        WalletService.getInstanceWithAuth({
          copayerId: wallet.copayers[0].id,
          message: 'hello world',
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
        should.exist(err);
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

    it('should fail to create wallet with invalid pubKey argument', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: 'dummy',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(walletId);
        should.exist(err);
        err.message.should.contain('Invalid public key');
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
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
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
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: '',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(result);
        should.exist(err);
        err.message.should.contain('name');
        done();
      });
    });

    it('should fail to join non-existent wallet', function(done) {
      var copayerOpts = {
        walletId: '123',
        name: 'me',
        xPubKey: 'dummy',
        requestPubKey: 'dummy',
        copayerSignature: 'dummy',
      };
      server.joinWallet(copayerOpts, function(err) {
        should.exist(err);
        done();
      });
    });

    it('should fail to join full wallet', function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, wallet) {
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: wallet.id,
          name: 'me',
          xPubKey: TestData.copayers[1].xPubKey_45H,
          requestPubKey: TestData.copayers[1].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err) {
          should.exist(err);
          err.code.should.equal('WFULL');
          err.message.should.equal('Wallet full');
          done();
        });
      });
    });

    it('should fail to re-join wallet', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
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

    it('should fail two wallets with same xPubKey', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      server.joinWallet(copayerOpts, function(err) {
        should.not.exist(err);

        var walletOpts = {
          name: 'my other wallet',
          m: 1,
          n: 1,
          pubKey: TestData.keyPair.pub,
        };
        server.createWallet(walletOpts, function(err, walletId) {
          should.not.exist(err);
          copayerOpts = helpers.getSignedCopayerOpts({
            walletId: walletId,
            name: 'me',
            xPubKey: TestData.copayers[0].xPubKey_45H,
            requestPubKey: TestData.copayers[0].pubKey_1H_0,
          });
          server.joinWallet(copayerOpts, function(err) {
            should.exist(err);
            err.code.should.equal('CREGISTERED');
            err.message.should.equal('Copayer ID already registered on server');
            done();
          });
        });
      });
    });

    it('should fail to join with bad formated signature', function(done) {
      var copayerOpts = {
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
        copayerSignature: 'bad sign',
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
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      };
      server.joinWallet(copayerOpts, function(err) {
        should.exist(err);
        err.message.should.contain('argument missing');
        done();
      });
    });

    it('should fail to join with wrong signature', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      copayerOpts.name = 'me2';
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
        address.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
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
        should.exist(err);
        should.not.exist(address);

        server.getMainAddresses({}, function(err, addresses) {
          addresses.length.should.equal(0);

          server.storage.storeAddressAndWallet.restore();
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.should.exist;
            address.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
            address.path.should.equal('m/2147483647/0/0');
            done();
          });
        });
      });
    });
  });

  describe('#getBalance', function() {
    var server, wallet;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });

    it('should get balance', function(done) {
      helpers.stubUtxos(server, wallet, [1, 2, 3], function() {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(helpers.toSatoshi(6));
          balance.lockedAmount.should.equal(0);
          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(2);
          balance.byAddress[0].amount.should.equal(helpers.toSatoshi(4));
          balance.byAddress[1].amount.should.equal(helpers.toSatoshi(2));
          server.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            var addresses = _.uniq(_.pluck(addresses, 'address'));
            _.intersection(addresses, _.pluck(balance.byAddress, 'address')).length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get balance when there are no addresses', function(done) {
      server.getBalance({}, function(err, balance) {
        should.not.exist(err);
        should.exist(balance);
        balance.totalAmount.should.equal(0);
        balance.lockedAmount.should.equal(0);
        should.exist(balance.byAddress);
        balance.byAddress.length.should.equal(0);
        done();
      });
    });
    it('should get balance when there are no funds', function(done) {
      blockExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, null, []);
      server.createAddress({}, function(err, address) {
        should.not.exist(err);
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          should.exist(balance);
          balance.totalAmount.should.equal(0);
          balance.lockedAmount.should.equal(0);
          should.exist(balance.byAddress);
          balance.byAddress.length.should.equal(0);
          done();
        });
      });
    });
    it('should only include addresses with balance', function(done) {
      helpers.stubUtxos(server, wallet, 1, function(utxos) {
        server.createAddress({}, function(err, address) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.byAddress.length.should.equal(1);
            balance.byAddress[0].amount.should.equal(helpers.toSatoshi(1));
            balance.byAddress[0].address.should.equal(utxos[0].address);
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
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server) {
            server.createAddress({}, function(err, address) {
              should.not.exist(address);
              should.exist(err);
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
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[0].xPubKey_45H,
          requestPubKey: TestData.copayers[0].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server, wallet) {
            var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey);
            server.createTx(txOpts, function(err, tx) {
              should.not.exist(tx);
              should.exist(err);
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
        done();
      });
    });

    it('should create a tx', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
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

    it('should create a tx using the uxtos with minimum amount first', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200, 300], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 150, 'some message', TestData.copayers[0].privKey);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.length.should.equal(1);
            server.getBalance({}, function(err, balance) {
              should.not.exist(err);
              balance.totalAmount.should.equal(helpers.toSatoshi(600));
              balance.lockedAmount.should.equal(helpers.toSatoshi(300));
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
          should.exist(err);
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx with proposal signed by another copayer', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[1].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.message.should.equal('Invalid proposal signature');
          done();
        });
      });
    });

    it('should fail to create tx for invalid address', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('invalid address', 80, null, TestData.copayers[0].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.code.should.equal('INVALIDADDRESS');
          err.message.should.equal('Invalid address');
          done();
        });
      });
    });

    it('should fail to create tx for address of different network', function(done) {
      helpers.stubUtxos(server, wallet, [100, 200], function() {
        var txOpts = helpers.createProposalOpts('myE38JHdxmQcTJGP1ZiX4BiGhDxMJDvLJD', 80, null, TestData.copayers[0].privKey_1H_0);

        server.createTx(txOpts, function(err, tx) {
          should.not.exist(tx);
          should.exist(err);
          err.code.should.equal('INVALIDADDRESS');
          err.message.should.equal('Incorrect address network');
          done();
        });
      });
    });

    it('should fail to create tx for invalid amount', function(done) {
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0, null, TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, tx) {
        should.not.exist(tx);
        should.exist(err);
        err.message.should.equal('Invalid amount');
        done();
      });
    });

    it('should fail to create tx when insufficient funds', function(done) {
      helpers.stubUtxos(server, wallet, [100], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 120, null, TestData.copayers[0].privKey_1H_0);
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
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 100, null, TestData.copayers[0].privKey_1H_0);
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
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.00000001, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('DUSTAMOUNT');
          err.message.should.equal('Amount below dust threshold');
          done();
        });
      });
    });

    it('should fail gracefully when bitcore throws exception on raw tx creation', function(done) {
      helpers.stubUtxos(server, wallet, [10], function() {
        var bitcoreStub = sinon.stub(Bitcore, 'Transaction');
        bitcoreStub.throws({
          name: 'dummy',
          message: 'dummy exception'
        });
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 2, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.message.should.equal('dummy exception');
          bitcoreStub.restore();
          done();
        });
      });
    });

    it('should create tx when there is a pending tx and enough UTXOs', function(done) {
      helpers.stubUtxos(server, wallet, [10.1, 10.2, 10.3], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var txOpts2 = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 8, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts2, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
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
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 12, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var txOpts2 = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 24, null, TestData.copayers[0].privKey_1H_0);
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
      helpers.stubUtxos(server, wallet, _.range(100, 100 + N, 0), function(utxos) {
        server.getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(helpers.toSatoshi(N * 100));
          balance.lockedAmount.should.equal(helpers.toSatoshi(0));
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, null, TestData.copayers[0].privKey_1H_0);
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
      helpers.createAndJoinWallet(2, 2, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            txid = tx.id;
            done();
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
            txs.should.be.empty;
            server.getTx({
              txProposalId: txid
            }, function(err, tx) {
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

    it('should fail to reject non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            var tx = txs[0];
            tx.id.should.equal(txid);
            next();
          });
        },
        function(next) {
          server.rejectTx({
            txProposalId: txid,
            reason: 'some reason',
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some other reason',
            }, function(err) {
              should.exist(err);
              err.code.should.equal('TXNOTPENDING');
              done();
            });
          });
        },
      ]);
    });
  });

  describe('#signTx', function() {
    var server, wallet, txid;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, null, TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            should.not.exist(err);
            should.exist(tx);
            txid = tx.id;
            done();
          });
        });
      });
    });

    it('should sign a TX with multiple inputs, different paths', function(done) {
      server.getPendingTxs({}, function(err, txs) {
        var tx = txs[0];
        tx.id.should.equal(txid);

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
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
        var signatures = helpers.clientSign(tx, TestData.copayers[1].xPrivKey_45H);
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

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
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

        var signatures = _.take(helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H), 2);
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

        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
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
          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
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

    it('should fail to sign a non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          server.rejectTx({
            txProposalId: txid,
            reason: 'some reason',
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txid,
              reason: 'some reason',
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[2].id, function(server) {
            server.getTx({
              txProposalId: txid
            }, function(err, tx) {
              should.not.exist(err);
              var signatures = helpers.clientSign(tx, TestData.copayers[2].xPrivKey_45H);
              server.signTx({
                txProposalId: txid,
                signatures: signatures,
              }, function(err) {
                should.exist(err);
                err.code.should.equal('TXNOTPENDING');
                done();
              });
            });
          });
        },
      ]);
    });
  });

  describe('#broadcastTx', function() {
    var server, wallet, txpid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [10, 10], function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_45H);
            server.signTx({
              txProposalId: txp.id,
              signatures: signatures,
            }, function(err, txp) {
              should.not.exist(err);
              should.exist(txp);
              txp.isAccepted().should.be.true;
              txp.isBroadcasted().should.be.false;
              txpid = txp.id;
              done();
            });
          });
        });
      });
    });

    it('should brodcast a tx', function(done) {
      var clock = sinon.useFakeTimers(1234000);
      helpers.stubBroadcast('999');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          txp.txid.should.equal('999');
          txp.isBroadcasted().should.be.true;
          txp.broadcastedOn.should.equal(1234);
          clock.restore();
          done();
        });
      });
    });

    it('should fail to brodcast an already broadcasted tx', function(done) {
      helpers.stubBroadcast('999');
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.not.exist(err);
        server.broadcastTx({
          txProposalId: txpid
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TXALREADYBROADCASTED');
          done();
        });
      });
    });

    it('should fail to brodcast a not yet accepted tx', function(done) {
      helpers.stubBroadcast('999');
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some other message', TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        server.broadcastTx({
          txProposalId: txp.id
        }, function(err) {
          should.exist(err);
          err.code.should.equal('TXNOTACCEPTED');
          done();
        });
      });
    });

    it('should keep tx as accepted if unable to broadcast it', function(done) {
      helpers.stubBroadcastFail();
      server.broadcastTx({
        txProposalId: txpid
      }, function(err) {
        should.exist(err);
        server.getTx({
          txProposalId: txpid
        }, function(err, txp) {
          should.not.exist(err);
          should.not.exist(txp.txid);
          txp.isBroadcasted().should.be.false;
          should.not.exist(txp.broadcastedOn);
          txp.isAccepted().should.be.true;
          done();
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
        helpers.stubUtxos(server, wallet, _.range(1, 9), function() {
          helpers.stubBroadcast('999');
          done();
        });
      });
    });

    it('other copayers should see pending proposal created by one copayer', function(done) {
      var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
      server.createTx(txOpts, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
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

    it('tx proposals should not be finally accepted until quorum is reached', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist(txp);
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
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_45H);
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
            txp.isAccepted().should.be.false;
            txp.isRejected().should.be.false;
            txp.isBroadcasted().should.be.false;
            txp.actions.length.should.equal(1);
            var action = txp.getActionBy(wallet.copayers[0].id);
            action.type.should.equal('accept');
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.not.equal('TxProposalFinallyAccepted');
              next(null, txp);
            });
          });
        },
        function(txp, next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server, wallet) {
            var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_45H);
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
            txps.length.should.equal(1);
            var txp = txps[0];
            txp.isPending().should.be.true;
            txp.isAccepted().should.be.true;
            txp.isBroadcasted().should.be.false;
            should.not.exist(txp.txid);
            txp.actions.length.should.equal(2);
            server.getNotifications({}, function(err, notifications) {
              should.not.exist(err);
              var last = _.last(notifications);
              last.type.should.equal('TxProposalFinallyAccepted');
              last.data.txProposalId.should.equal(txp.id);
              done();
            });
          });
        },
      ]);
    });

    it('tx proposals should accept as many rejections as possible without finally rejecting', function(done) {
      var txpId;
      async.waterfall([

        function(next) {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 10, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            txpId = txp.id;
            should.not.exist(err);
            should.exist(txp);
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
            txProposalId: txpId
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

  describe('#getTx', function() {
    var server, wallet, txpid;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, 10, function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 9, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, txp) {
            should.not.exist(err);
            should.exist(txp);
            txpid = txp.id;
            done();
          });
        });
      });
    });

    it('should get own transaction proposal', function(done) {
      server.getTx({
        txProposalId: txpid
      }, function(err, txp) {
        should.not.exist(err);
        should.exist(txp);
        txp.id.should.equal(txpid);
        done();
      });
    });
    it('should get someone elses transaction proposal', function(done) {
      helpers.getAuthServer(wallet.copayers[1].id, function(server2, wallet) {
        server2.getTx({
          txProposalId: txpid
        }, function(err, res) {
          should.not.exist(err);
          res.id.should.equal(txpid);
          done();
        });
      });

    });
    it('should fail to get non-existent transaction proposal', function(done) {
      server.getTx({
        txProposalId: 'dummy'
      }, function(err, txp) {
        should.exist(err);
        should.not.exist(txp);
        err.message.should.contain('not found');
        done();
      });
    });
    it.skip('should get accepted/rejected transaction proposal', function(done) {});
    it.skip('should get broadcasted transaction proposal', function(done) {});
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
        helpers.stubUtxos(server, wallet, _.range(10), function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, null, TestData.copayers[0].privKey_1H_0);
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
        helpers.stubUtxos(server, wallet, helpers.toSatoshi(_.range(4)), function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.01, null, TestData.copayers[0].privKey_1H_0);
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
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
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
        var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
        sinon.spy(server, 'emit');
        server.signTx({
          txProposalId: tx.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          helpers.stubBroadcast('1122334455');
          server.broadcastTx({
            txProposalId: tx.id
          }, function(err, txp) {
            should.not.exist(err);
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
  });

  describe('#removeWallet', function() {
    var server, wallet, clock;

    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;

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
      }, cat);
    });
  });

  describe('#removePendingTx', function() {
    var server, wallet, txp;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(2, 3, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, [100, 200], function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 80, 'some message', TestData.copayers[0].privKey_1H_0);
          server.createTx(txOpts, function(err, tx) {
            server.getPendingTxs({}, function(err, txs) {
              txp = txs[0];
              done();
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
      var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_45H);
      server.signTx({
        txProposalId: txp.id,
        signatures: signatures,
      }, function(err) {
        should.not.exist(err);
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

    it('should fail to remove non-pending TX', function(done) {
      async.waterfall([

        function(next) {
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey_45H);
          server.signTx({
            txProposalId: txp.id,
            signatures: signatures,
          }, function(err) {
            should.not.exist(err);
            next();
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[1].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          helpers.getAuthServer(wallet.copayers[2].id, function(server) {
            server.rejectTx({
              txProposalId: txp.id,
            }, function(err) {
              should.not.exist(err);
              next();
            });
          });
        },
        function(next) {
          server.getPendingTxs({}, function(err, txs) {
            should.not.exist(err);
            txs.should.be.empty;
            next();
          });
        },
        function(next) {
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            should.exist(err);
            err.code.should.equal('TXNOTPENDING');
            done();
          });
        },
      ]);
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
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey_45H);
        server2.signTx({
          txProposalId: txp.id,
          signatures: signatures,
        }, function(err) {
          should.not.exist(err);
          server.removePendingTx({
            txProposalId: txp.id
          }, function(err) {
            err.code.should.equal('TXACTIONED');
            err.message.should.contain('other copayers');
            done();
          });
        });
      });
    });
  });

  describe('#getTxHistory', function() {
    var server, wallet, mainAddresses, changeAddresses;
    beforeEach(function(done) {
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.createAddresses(server, wallet, 1, 1, function(main, change) {
          mainAddresses = main;
          changeAddresses = change;
          done();
        });
      });
    });

    it('should get tx history from insight', function(done) {
      helpers.stubHistory(TestData.history);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(2);
        done();
      });
    });
    it('should get tx history for incoming txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        minedTs: 1,
        inputs: [{
          address: 'external',
          amount: 500,
        }],
        outputs: [{
          address: mainAddresses[0].address,
          amount: 200,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('received');
        tx.amount.should.equal(200);
        tx.fees.should.equal(100);
        done();
      });
    });
    it('should get tx history for outgoing txs', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        minedTs: 1,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 400,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(400);
        tx.fees.should.equal(100);
        done();
      });
    });
    it('should get tx history for outgoing txs + change', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);
      var txs = [{
        txid: '1',
        confirmations: 1,
        fees: 100,
        minedTs: 1,
        inputs: [{
          address: mainAddresses[0].address,
          amount: 500,
        }],
        outputs: [{
          address: 'external',
          amount: 300,
        }, {
          address: changeAddresses[0].address,
          amount: 100,
        }],
      }];
      helpers.stubHistory(txs);
      server.getTxHistory({}, function(err, txs) {
        should.not.exist(err);
        should.exist(txs);
        txs.length.should.equal(1);
        var tx = txs[0];
        tx.action.should.equal('sent');
        tx.amount.should.equal(300);
        tx.fees.should.equal(100);
        done();
      });
    });
    it('should get tx history with accepted proposal', function(done) {
      server._normalizeTxHistory = sinon.stub().returnsArg(0);

      helpers.stubUtxos(server, wallet, [100, 200], function(utxos) {
        var txOpts = helpers.createProposalOpts(mainAddresses[0].address, 80, 'some message', TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey_45H);
          server.signTx({
            txProposalId: tx.id,
            signatures: signatures,
          }, function(err, tx) {
            should.not.exist(err);

            helpers.stubBroadcast('1122334455');
            server.broadcastTx({
              txProposalId: tx.id
            }, function(err, txp) {
              should.not.exist(err);
              var txs = [{
                txid: '1122334455',
                confirmations: 1,
                fees: 5460,
                minedTs: 1,
                inputs: [{
                  address: tx.inputs[0].address,
                  amount: utxos[0].satoshis,
                }],
                outputs: [{
                  address: 'external',
                  amount: helpers.toSatoshi(80) - 5460,
                }, {
                  address: changeAddresses[0].address,
                  amount: helpers.toSatoshi(20) - 5460,
                }],
              }];
              helpers.stubHistory(txs);

              server.getTxHistory({}, function(err, txs) {
                should.not.exist(err);
                should.exist(txs);
                txs.length.should.equal(1);
                var tx = txs[0];
                tx.action.should.equal('sent');
                tx.amount.should.equal(helpers.toSatoshi(80));
                tx.message.should.equal('some message');
                tx.actions.length.should.equal(1);
                tx.actions[0].type.should.equal('accept');
                tx.actions[0].copayerName.should.equal('copayer 1');
                done();
              });
            });
          });
        });
      });
    });
  });
});
