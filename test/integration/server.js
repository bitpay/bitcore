'use strict';

var _ = require('lodash');
var async = require('async');
var inspect = require('util').inspect;

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;

var fs = require('fs');
var tingodb = require('tingodb')({
  memStore: true
});

var Utils = require('../../lib/utils');
var WalletUtils = require('bitcore-wallet-utils');
var Bitcore = WalletUtils.Bitcore;
var Storage = require('../../lib/storage');
var BlockchainMonitor = require('../../lib/blockchainmonitor');

var Model = require('../../lib/model');
var Wallet = Model.Wallet;
var TxProposal = Model.TxProposal;
var Address = Model.Address;
var Copayer = Model.Copayer;

var WalletService = require('../../lib/server');
var NotificationBroadcaster = require('../../lib/notificationbroadcaster');
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
    blockchainExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, null, utxos);

    return cb(utxos);
  });
};

helpers.stubBroadcast = function(txid) {
  blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, null, txid);
};

helpers.stubBroadcastFail = function() {
  blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, 'broadcast error');
};

helpers.stubHistory = function(txs) {
  blockchainExplorer.getTransactions = sinon.stub().callsArgWith(3, null, txs);
};

helpers.stubAddressActivity = function(activeAddresses) {
  blockchainExplorer.getAddressActivity = function(addresses, cb) {
    return cb(null, _.intersection(activeAddresses, addresses).length > 0);
  };
};

helpers.clientSign = WalletUtils.signTxp;

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

var db, storage, blockchainExplorer;

function openDb(cb) {
  db = new tingodb.Db('./db/test', {});
  return cb();
};

function resetDb(cb) {
  if (!db) return cb();
  db.dropDatabase(function(err) {
    return cb();
  });
};


describe('Wallet service', function() {
  before(function(done) {
    openDb(function() {
      storage = new Storage({
        db: db
      });
      done();
    });
  });
  beforeEach(function(done) {
    resetDb(function() {
      blockchainExplorer = sinon.stub();
      WalletService.initialize({
        storage: storage,
        blockchainExplorer: blockchainExplorer,
      }, function() {
        helpers.offset = 0;
        done();
      });
    });
  });
  after(function(done) {
    WalletService.shutDown(done);
  });

  describe('#getInstanceWithAuth', function() {

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


    it('should create  wallet with given id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        server.storage.fetchWallet('1234', function(err, wallet) {
          should.not.exist(err);
          wallet.id.should.equal(walletId);
          wallet.name.should.equal('my wallet');
          done();
        });
      });
    });

    it('should fail to create wallets with same id', function(done) {
      var opts = {
        name: 'my wallet',
        m: 2,
        n: 3,
        pubKey: TestData.keyPair.pub,
        id: '1234',
      };
      server.createWallet(opts, function(err, walletId) {
        server.createWallet(opts, function(err, walletId) {
          err.message.should.contain('Wallet already exists');
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
        server.getNotifications({}, function(err, notifications) {
          should.not.exist(err);
          var notif = _.find(notifications, {
            type: 'NewAddress'
          });
          should.exist(notif);
          notif.data.address.should.equal('3KxttbKQQPWmpsnXZ3rB4mgJTuLnVR7frg');
          done();
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
      blockchainExplorer.getUnspentUtxos = sinon.stub().callsArgWith(1, null, []);
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
          tx.walletId.should.equal(wallet.id);
          tx.creatorId.should.equal(wallet.copayers[0].id);
          tx.message.should.equal('some message');
          tx.isAccepted().should.equal.false;
          tx.isRejected().should.equal.false;
          tx.amount.should.equal(helpers.toSatoshi(80));
          tx.fee.should.equal(Bitcore.Transaction.FEE_PER_KB);
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
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 150, 'some message', TestData.copayers[0].privKey_1H_0);
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
          err.message.should.equal('Insufficient funds for fee');
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

    it('should fail to create tx that would return change for dust amount', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var fee = Bitcore.Transaction.FEE_PER_KB / 1e8;
        var change = 0.00000001;
        var amount = 1 - fee - change;

        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.exist(err);
          err.code.should.equal('DUSTAMOUNT');
          err.message.should.equal('Amount below dust threshold');
          done();
        });
      });
    });

    it('should fail with different error for insufficient funds and locked funds', function(done) {
      helpers.stubUtxos(server, wallet, [10, 10], function() {
        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 11, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          server.getBalance({}, function(err, balance) {
            should.not.exist(err);
            balance.totalAmount.should.equal(helpers.toSatoshi(20));
            balance.lockedAmount.should.equal(helpers.toSatoshi(20));
            txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 8, null, TestData.copayers[0].privKey_1H_0);
            server.createTx(txOpts, function(err, tx) {
              should.exist(err);
              err.code.should.equal('LOCKEDFUNDS');
              err.message.should.equal('Funds are locked by pending transaction proposals');
              done();
            });
          });
        });
      });
    });

    it('should create tx with 0 change output', function(done) {
      helpers.stubUtxos(server, wallet, [1], function() {
        var fee = Bitcore.Transaction.FEE_PER_KB / 1e8;
        var amount = 1 - fee;

        var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', amount, null, TestData.copayers[0].privKey_1H_0);
        server.createTx(txOpts, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          var bitcoreTx = tx.getBitcoreTx();
          bitcoreTx.outputs.length.should.equal(1);
          bitcoreTx.outputs[0].satoshis.should.equal(tx.amount);
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
            err.code.should.equal('LOCKEDFUNDS');
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
              var signatures = helpers.clientSign(tx, TestData.copayers[2].xPrivKey);
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
            var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
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
              last.walletId.should.equal(wallet.id);
              last.creatorId.should.equal(wallet.copayers[1].id);
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
      this.timeout(5000);
      clock = sinon.useFakeTimers();
      helpers.createAndJoinWallet(1, 1, function(s, w) {
        server = s;
        wallet = w;
        helpers.stubUtxos(server, wallet, _.range(10), function() {
          var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, null, TestData.copayers[0].privKey_1H_0);
          async.eachSeries(_.range(10), function(i, next) {
            clock.tick(10 * 1000);
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


    it('should txs from times 50 to 70',
      function(done) {
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
        var walletIds = _.uniq(_.pluck(notifications, 'walletId'));
        walletIds.length.should.equal(1);
        walletIds[0].should.equal(wallet.id);
        var creators = _.uniq(_.pluck(notifications, 'creatorId'));
        creators.length.should.equal(1);
        creators[0].should.equal(wallet.copayers[0].id);
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

    it('should contain walletId & creatorId on NewCopayer', function(done) {
      server.getNotifications({
        minTs: 0,
      }, function(err, notifications) {
        should.not.exist(err);
        var newCopayer = notifications[0];
        newCopayer.type.should.equal('NewCopayer');
        newCopayer.walletId.should.equal(wallet.id);
        newCopayer.creatorId.should.equal(wallet.copayers[0].id);
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
        sinon.spy(server, '_emit');
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
              server._emit.getCall(0).args[1].type.should.equal('TxProposalAcceptedBy');
              server._emit.getCall(1).args[1].type.should.equal('TxProposalFinallyAccepted');;
              server._emit.getCall(2).args[1].type.should.equal('NewOutgoingTx');

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
      server.removeWallet({}, function(err) {
        should.not.exist(err);
        server.getWallet({}, function(err, w) {
          should.exist(err);
          err.message.should.equal('Wallet not found');
          should.not.exist(w);
          async.parallel([

            function(next) {
              server.storage.fetchAddresses(wallet.id, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchTxs(wallet.id, {}, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
            function(next) {
              server.storage.fetchNotifications(wallet.id, {}, function(err, items) {
                items.length.should.equal(0);
                next();
              });
            },
          ], function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    // creates 2 wallet, and deletes only 1.
    it('should delete a wallet, and only that wallet', function(done) {
      var server2, wallet2;
      async.series([

        function(next) {
          helpers.offset = 1;
          helpers.createAndJoinWallet(1, 1, function(s, w) {
            server2 = s;
            wallet2 = w;

            helpers.stubUtxos(server2, wallet2, _.range(1, 3), function() {
              var txOpts = helpers.createProposalOpts('18PzpUFkFZE8zKWUPvfykkTxmB9oMR8qP7', 0.1, 'some message', TestData.copayers[1].privKey_1H_0);
              async.eachSeries(_.range(2), function(i, next) {
                server2.createTx(txOpts, function(err, tx) {
                  should.not.exist(err);
                  next(err);
                });
              }, next);
            });
          });
        },
        function(next) {
          server.removeWallet({}, next);
        },
        function(next) {
          server.getWallet({}, function(err, wallet) {
            should.exist(err);
            err.message.should.contain('not found');
            next();
          });
        },
        function(next) {
          server2.getWallet({}, function(err, wallet) {
            should.not.exist(err);
            should.exist(wallet);
            wallet.id.should.equal(wallet2.id);
            next();
          });
        },
        function(next) {
          server2.getMainAddresses({}, function(err, addresses) {
            should.not.exist(err);
            should.exist(addresses);
            addresses.length.should.above(0);
            next();
          });
        },
        function(next) {
          server2.getTxs({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            next();
          });
        },
        function(next) {
          server2.getNotifications({}, function(err, notifications) {
            should.not.exist(err);
            should.exist(notifications);
            notifications.length.should.above(0);
            next();
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
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
      var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
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
          var signatures = helpers.clientSign(txp, TestData.copayers[0].xPrivKey);
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
        var signatures = helpers.clientSign(txp, TestData.copayers[1].xPrivKey);
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
        time: 1,
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
        time: 1,
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
        time: 1,
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

          var signatures = helpers.clientSign(tx, TestData.copayers[0].xPrivKey);
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
                time: 1,
                inputs: [{
                  address: tx.inputs[0].address,
                  amount: utxos[0].satoshis,
                }],
                outputs: [{
                  address: changeAddresses[0].address,
                  amount: helpers.toSatoshi(20) - 5460,
                }, {
                  address: 'external',
                  amount: helpers.toSatoshi(80) - 5460,
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
                tx.addressTo.should.equal('external');
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
    it('should get various paginated tx history', function(done) {
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
          limit: 20,
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
      var timestamps = [10, 50, 30, 40, 20];
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
      helpers.stubHistory(txs);

      async.each(testCases, function(testCase, next) {
        server.getTxHistory(testCase.opts, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          _.pluck(txs, 'time').should.deep.equal(testCase.expected);
          next();
        });
      }, done);
    });
  });

  describe('#scan', function() {
    var server, wallet;
    var scanConfigOld = WalletService.scanConfig;
    beforeEach(function(done) {
      this.timeout(5000);
      WalletService.scanConfig.SCAN_WINDOW = 2;
      WalletService.scanConfig.DERIVATION_DELAY = 0;

      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      WalletService.scanConfig = scanConfigOld;
    });

    it('should scan main addresses', function(done) {
      helpers.stubAddressActivity(
        ['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
          '3NezgtNbuDzL2sFhnfxyVy8bHp4v6ud252', // m/2147483647/0/2
          '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/0
        ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/0/2',
        'm/2147483647/0/3',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
      ];
      server.scan({}, function(err) {
        should.not.exist(err);
        server.storage.fetchAddresses(wallet.id, function(err, addresses) {
          should.exist(addresses);
          addresses.length.should.equal(expectedPaths.length);
          var paths = _.pluck(addresses, 'path');
          _.difference(paths, expectedPaths).length.should.equal(0);
          server.createAddress({}, function(err, address) {
            should.not.exist(err);
            address.path.should.equal('m/2147483647/0/4');
            done();
          });
        })
      });
    });
    it('should scan main addresses & copayer addresses', function(done) {
      helpers.stubAddressActivity(
        ['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
          '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/0
          '3BYHznBmosYxUj1NWcjdFKX2tdsH7UT1YG', // m/0/0/1
          '3Eg1uPkGnwyU42bRiaDuo6Cu9bjjhoG7Sh', // m/1/1/0
          '3AYmZ63tMd2AHN8QLfu5D2nfRzCH66psWx', // m/1/0/0
        ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
        'm/0/0/0',
        'm/0/0/1',
        'm/1/0/0',
        'm/1/0/1',
        'm/1/1/0',
        'm/1/1/1',
      ];
      server.scan({
        includeCopayerBranches: true
      }, function(err) {
        should.not.exist(err);
        server.storage.fetchAddresses(wallet.id, function(err, addresses) {
          should.exist(addresses);
          addresses.length.should.equal(expectedPaths.length);
          var paths = _.pluck(addresses, 'path');
          _.difference(paths, expectedPaths).length.should.equal(0);
          done();
        })
      });
    });
    it('should restore wallet balance', function(done) {
      async.waterfall([

        function(next) {
          helpers.stubUtxos(server, wallet, [1, 2, 3], function(utxos) {
            should.exist(utxos);
            helpers.stubAddressActivity(_.pluck(utxos, 'address'));
            server.getBalance({}, function(err, balance) {
              balance.totalAmount.should.equal(helpers.toSatoshi(6));
              next(null, server, wallet);
            });
          });
        },
        function(server, wallet, next) {
          server.removeWallet({}, function(err) {
            next(err);
          });
        },
        function(next) {
          // NOTE: this works because it creates the exact same wallet!
          helpers.createAndJoinWallet(1, 2, function(server, wallet) {
            server.getBalance({}, function(err, balance) {
              balance.totalAmount.should.equal(0);
              next(null, server, wallet);
            });
          });
        },
        function(server, wallet, next) {
          server.scan({}, function(err) {
            should.not.exist(err);
            server.getBalance(wallet.id, function(err, balance) {
              balance.totalAmount.should.equal(helpers.toSatoshi(6));
              next();
            })
          });
        },
      ], function(err) {
        should.not.exist(err);
        done();
      });
    });
    it.skip('should abort scan if there is an error checking address activity', function(done) {});

  });

  describe('#startScan', function() {
    var server, wallet;
    var scanConfigOld = WalletService.scanConfig;
    beforeEach(function(done) {
      this.timeout(5000);
      WalletService.scanConfig.SCAN_WINDOW = 2;
      WalletService.scanConfig.DERIVATION_DELAY = 0;

      helpers.createAndJoinWallet(1, 2, function(s, w) {
        server = s;
        wallet = w;
        done();
      });
    });
    afterEach(function() {
      WalletService.scanConfig = scanConfigOld;
      NotificationBroadcaster.removeAllListeners();
    });

    it('should start an asynchronous scan', function(done) {
      helpers.stubAddressActivity([
        '3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A', // m/2147483647/0/0
        '3NezgtNbuDzL2sFhnfxyVy8bHp4v6ud252', // m/2147483647/0/2
        '3CQ2hCMUu1SCPVPMpfCCuT3nAfHGiHV1o7', // m/2147483647/1/1
      ]);
      var expectedPaths = [
        'm/2147483647/0/0',
        'm/2147483647/0/1',
        'm/2147483647/0/2',
        'm/2147483647/0/3',
        'm/2147483647/1/0',
        'm/2147483647/1/1',
      ];
      WalletService.onNotification(function(n) {
        if (n.type == 'ScanFinished') {
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('success');
            should.not.exist(n.creatorId);
            server.storage.fetchAddresses(wallet.id, function(err, addresses) {
              should.exist(addresses);
              addresses.length.should.equal(expectedPaths.length);
              var paths = _.pluck(addresses, 'path');
              _.difference(paths, expectedPaths).length.should.equal(0);
              server.createAddress({}, function(err, address) {
                should.not.exist(err);
                address.path.should.equal('m/2147483647/0/4');
                done();
              });
            })
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should set scan status error when unable to reach blockchain', function(done) {
      blockchainExplorer.getAddressActivity = sinon.stub().yields('dummy error');
      WalletService.onNotification(function(n) {
        if (n.type == 'ScanFinished') {
          should.exist(n.data.error);
          server.getWallet({}, function(err, wallet) {
            should.exist(wallet.scanStatus);
            wallet.scanStatus.should.equal('error');
            done();
          });
        }
      });
      server.startScan({}, function(err) {
        should.not.exist(err);
      });
    });
    it('should start multiple asynchronous scans for different wallets', function(done) {
      helpers.stubAddressActivity(['3K2VWMXheGZ4qG35DyGjA2dLeKfaSr534A']);
      WalletService.scanConfig.SCAN_WINDOW = 1;

      var scans = 0;
      WalletService.onNotification(function(n) {
        if (n.type == 'ScanFinished') {
          scans++;
          if (scans == 2) done();
        }
      });

      // Create a second wallet
      var server2 = new WalletService();
      var opts = {
        name: 'second wallet',
        m: 1,
        n: 1,
        pubKey: TestData.keyPair.pub,
      };
      server2.createWallet(opts, function(err, walletId) {
        should.not.exist(err);
        var copayerOpts = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'copayer 1',
          xPubKey: TestData.copayers[3].xPubKey_45H,
          requestPubKey: TestData.copayers[3].pubKey_1H_0,
        });
        server.joinWallet(copayerOpts, function(err, result) {
          should.not.exist(err);
          helpers.getAuthServer(result.copayerId, function(server2) {
            server.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            server2.startScan({}, function(err) {
              should.not.exist(err);
              scans.should.equal(0);
            });
            scans.should.equal(0);
          });
        });
      });
    });
  });

  describe('#replaceTemporaryRequestKey', function() {
    var server, walletId;
    beforeEach(function(done) {
      server = new WalletService();
      var walletOpts = {
        name: 'my wallet',
        m: 2,
        n: 2,
        pubKey: TestData.keyPair.pub,
      };
      server.createWallet(walletOpts, function(err, wId) {
        should.not.exist(err);
        should.exist.walletId;
        walletId = wId;
        done();
      });
    });

    it('should join existing wallet with temporaryRequestKey', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1H_0,
      });
      copayerOpts.isTemporaryRequestKey = true;

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;
        helpers.getAuthServer(copayerId, function(server) {
          server.getWallet({}, function(err, wallet) {
            wallet.id.should.equal(walletId);
            var copayer = wallet.copayers[0];
            copayer.isTemporaryRequestKey.should.equal(true);
            done();
          });
        });
      });
    });

    it('should fail to replace a temporaryRequestKey on a not-complete wallet', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1_0,
      });
      copayerOpts.isTemporaryRequestKey = true;

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;
        helpers.getAuthServer(copayerId, function(server) {
          server.getWallet({}, function(err, wallet) {

            var copayerOpts = helpers.getSignedCopayerOpts({
              walletId: walletId,
              name: 'me',
              xPubKey: TestData.copayers[0].xPubKey_45H,
              requestPubKey: TestData.copayers[0].pubKey_1H_0,
            });
            copayerOpts.isTemporaryRequestKey = false;
            server.replaceTemporaryRequestKey(copayerOpts, function(err, wallet) {
              err.code.should.equal('WNOTFULL');
              done();
            });
          });
        });
      });
    });


    it('should fail to replace a temporaryRequestKey is Copayer is not in wallet', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1_0,
      });
      copayerOpts.isTemporaryRequestKey = true;

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;
        helpers.getAuthServer(copayerId, function(server) {
          server.getWallet({}, function(err, wallet) {

            var copayerOpts = helpers.getSignedCopayerOpts({
              walletId: walletId,
              name: 'me',
              xPubKey: TestData.copayers[1].xPubKey_45H,
              requestPubKey: TestData.copayers[1].pubKey_1H_0,
            });
            copayerOpts.isTemporaryRequestKey = false;
            server.replaceTemporaryRequestKey(copayerOpts, function(err, wallet) {
              err.code.should.equal('CDATAMISMATCH');
              done();
            });
          });
        });
      });
    });

    it('should fail replace a temporaryRequestKey with invalid copayer', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1_0,
      });
      copayerOpts.isTemporaryRequestKey = true;

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);

        var copayerOpts2 = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[1].xPubKey_45H,
          requestPubKey: TestData.copayers[1].pubKey_1H_0,
        });
        copayerOpts2.isTemporaryRequestKey = false;

        server.joinWallet(copayerOpts2, function(err, result) {
          should.not.exist(err);

          var copayerId = result.copayerId;
          helpers.getAuthServer(copayerId, function(server) {
            server.getWallet({}, function(err, wallet) {

              var copayerOpts = helpers.getSignedCopayerOpts({
                walletId: walletId,
                name: 'me',
                xPubKey: TestData.copayers[1].xPubKey_45H,
                requestPubKey: TestData.copayers[1].pubKey_1H_0,
              });
              copayerOpts.isTemporaryRequestKey = false;
              server.replaceTemporaryRequestKey(copayerOpts, function(err, wallet) {
                err.code.should.equal('CDATAMISMATCH');
                done();
              });
            });
          });
        });
      });
    });

    it('should replace a temporaryRequestKey', function(done) {
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'me',
        xPubKey: TestData.copayers[0].xPubKey_45H,
        requestPubKey: TestData.copayers[0].pubKey_1_0,
      });
      copayerOpts.isTemporaryRequestKey = true;

      server.joinWallet(copayerOpts, function(err, result) {
        should.not.exist(err);
        var copayerId = result.copayerId;

        var copayerOpts2 = helpers.getSignedCopayerOpts({
          walletId: walletId,
          name: 'me',
          xPubKey: TestData.copayers[1].xPubKey_45H,
          requestPubKey: TestData.copayers[1].pubKey_1H_0,
        });
        copayerOpts2.isTemporaryRequestKey = false;

        server.joinWallet(copayerOpts2, function(err, result) {
          should.not.exist(err);
          var copayerId2 = result.copayerId;


          helpers.getAuthServer(copayerId, function(server) {
            server.getWallet({}, function(err, wallet) {

              var copayerOpts = helpers.getSignedCopayerOpts({
                walletId: walletId,
                name: 'me',
                xPubKey: TestData.copayers[0].xPubKey_45H,
                requestPubKey: TestData.copayers[0].pubKey_1H_0,
              });
              copayerOpts.isTemporaryRequestKey = false;
              server.replaceTemporaryRequestKey(copayerOpts, function(err, wallet) {
                should.not.exist(err);
                server.getWallet({}, function(err, wallet) {
                  wallet.copayers[0].isTemporaryRequestKey.should.equal(false);
                  wallet.copayers[1].isTemporaryRequestKey.should.equal(false);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });
});


describe('Blockchain monitor', function() {
  var addressSubscriber;

  before(function(done) {
    openDb(function() {
      storage = new Storage({
        db: db
      });
      done();
    });
  });

  beforeEach(function(done) {
    addressSubscriber = sinon.stub();
    addressSubscriber.subscribe = sinon.stub();
    sinon.stub(BlockchainMonitor.prototype, '_getAddressSubscriber').onFirstCall().returns(addressSubscriber);

    resetDb(function() {
      blockchainExplorer = sinon.stub();
      WalletService.initialize({
        storage: storage,
        blockchainExplorer: blockchainExplorer,
      }, function() {
        helpers.offset = 0;
        done();
      });
    });
  });
  afterEach(function() {
    BlockchainMonitor.prototype._getAddressSubscriber.restore();
  });
  after(function(done) {
    WalletService.shutDown(done);
  });

  it('should subscribe wallet', function(done) {
    var monitor = new BlockchainMonitor();
    helpers.createAndJoinWallet(2, 2, function(server, wallet) {
      server.createAddress({}, function(err, address1) {
        should.not.exist(err);
        server.createAddress({}, function(err, address2) {
          should.not.exist(err);
          monitor.subscribeWallet(server, function(err) {
            should.not.exist(err);
            addressSubscriber.subscribe.calledTwice.should.be.true;
            addressSubscriber.subscribe.calledWith(address1.address).should.be.true;
            addressSubscriber.subscribe.calledWith(address2.address).should.be.true;
            done();
          });
        });
      });
    });
  });

  it('should be able to subscribe new address', function(done) {
    var monitor = new BlockchainMonitor();
    helpers.createAndJoinWallet(2, 2, function(server, wallet) {
      server.createAddress({}, function(err, address1) {
        should.not.exist(err);
        monitor.subscribeWallet(server, function(err) {
          should.not.exist(err);
          addressSubscriber.subscribe.calledOnce.should.be.true;
          addressSubscriber.subscribe.calledWith(address1.address).should.be.true;
          server.createAddress({}, function(err, address2) {
            should.not.exist(err);
            monitor.subscribeAddresses(wallet.id, address2.address);
            addressSubscriber.subscribe.calledTwice.should.be.true;
            addressSubscriber.subscribe.calledWith(address2.address).should.be.true;
            done();
          });
        });
      });
    });
  });

  it('should create NewIncomingTx notification when a new tx arrives on registered address', function(done) {
    var monitor = new BlockchainMonitor();
    helpers.createAndJoinWallet(2, 2, function(server, wallet) {
      server.createAddress({}, function(err, address1) {
        should.not.exist(err);
        monitor.subscribeWallet(server, function(err) {
          should.not.exist(err);
          addressSubscriber.subscribe.calledOnce.should.be.true;
          addressSubscriber.subscribe.getCall(0).args[0].should.equal(address1.address);
          var handler = addressSubscriber.subscribe.getCall(0).args[1];
          _.isFunction(handler).should.be.true;

          monitor.on('notification', function(notification) {
            notification.type.should.equal('NewIncomingTx');
            notification.data.address.should.equal(address1.address);
            notification.data.txid.should.equal('txid');
            done();
          });

          handler('txid');
        });
      });
    });
  });
});
