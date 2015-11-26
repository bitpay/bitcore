'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;
var tingodb = require('tingodb')({
  memStore: true
});

var Bitcore = require('bitcore-lib');

var Common = require('../../lib/common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var Storage = require('../../lib/storage');
var Model = require('../../lib/model');
var WalletService = require('../../lib/server');
var TestData = require('../testdata');

var storage, blockchainExplorer;

var helpers = {};

var useMongoDb = !!process.env.USE_MONGO_DB;

helpers.before = function(cb) {
  function getDb(cb) {
    if (useMongoDb) {
      var mongodb = require('mongodb');
      mongodb.MongoClient.connect('mongodb://localhost:27017/bws_test', function(err, db) {
        if (err) throw err;
        return cb(db);
      });
    } else {
      var db = new tingodb.Db('./db/test', {});
      return cb(db);
    }
  }
  getDb(function(db) {
    storage = new Storage({
      db: db
    });
    return cb();
  });
};

helpers.beforeEach = function(cb) {
  if (!storage.db) return cb();
  storage.db.dropDatabase(function(err) {
    if (err) return cb(err);
    blockchainExplorer = sinon.stub();
    var opts = {
      storage: storage,
      blockchainExplorer: blockchainExplorer
    };
    WalletService.initialize(opts, function() {
      return cb(opts);
    });
  });
};

helpers.after = function(cb) {
  WalletService.shutDown(cb);
};

helpers.getBlockchainExplorer = function() {
  return blockchainExplorer;
};

helpers.getStorage = function() {
  return storage;
};

helpers.signMessage = function(text, privKey) {
  var priv = new Bitcore.PrivateKey(privKey);
  var hash = Utils.hashMessage(text);
  return Bitcore.crypto.ECDSA.sign(hash, priv, 'little').toString();
};

helpers.signRequestPubKey = function(requestPubKey, xPrivKey) {
  var priv = new Bitcore.HDPrivateKey(xPrivKey).derive(Constants.PATHS.REQUEST_KEY_AUTH).privateKey;
  return helpers.signMessage(requestPubKey, priv);
};

helpers.getAuthServer = function(copayerId, cb) {
  var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
  verifyStub.returns(true);
  WalletService.getInstanceWithAuth({
    copayerId: copayerId,
    message: 'dummy',
    signature: 'dummy',
    clientVersion: 'bwc-0.1.0',
  }, function(err, server) {
    verifyStub.restore();
    if (err || !server) throw new Error('Could not login as copayerId ' + copayerId);
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
    var id45 = Copayer._xPubToCopayerId(xpub_45H.toString());

    var xpriv_44H_0H_0H = xpriv.derive(44, true).derive(0, true).derive(0, true);
    var xpub_44H_0H_0H = Bitcore.HDPublicKey(xpriv_44H_0H_0H);
    var id44 = Copayer._xPubToCopayerId(xpub_44H_0H_0H.toString());

    var xpriv_1H = xpriv.derive(1, true);
    var xpub_1H = Bitcore.HDPublicKey(xpriv_1H);
    var priv = xpriv_1H.derive(0).privateKey;
    var pub = xpub_1H.derive(0).publicKey;

    console.log('{id44: ', "'" + id44 + "',");
    console.log('id45: ', "'" + id45 + "',");
    console.log('xPrivKey: ', "'" + xpriv.toString() + "',");
    console.log('xPubKey: ', "'" + xpub.toString() + "',");
    console.log('xPrivKey_45H: ', "'" + xpriv_45H.toString() + "',");
    console.log('xPubKey_45H: ', "'" + xpub_45H.toString() + "',");
    console.log('xPrivKey_44H_0H_0H: ', "'" + xpriv_44H_0H_0H.toString() + "',");
    console.log('xPubKey_44H_0H_0H: ', "'" + xpub_44H_0H_0H.toString() + "',");
    console.log('xPrivKey_1H: ', "'" + xpriv_1H.toString() + "',");
    console.log('xPubKey_1H: ', "'" + xpub_1H.toString() + "',");
    console.log('privKey_1H_0: ', "'" + priv.toString() + "',");
    console.log('pubKey_1H_0: ', "'" + pub.toString() + "'},");
  });
  console.log('];');
};

helpers.getSignedCopayerOpts = function(opts) {
  var hash = WalletService._getCopayerHash(opts.name, opts.xPubKey, opts.requestPubKey);
  opts.copayerSignature = helpers.signMessage(hash, TestData.keyPair.priv);
  return opts;
};

helpers.createAndJoinWallet = function(m, n, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  var server = new WalletService();
  var copayerIds = [];
  var offset = opts.offset || 0;

  var walletOpts = {
    name: 'a wallet',
    m: m,
    n: n,
    pubKey: TestData.keyPair.pub,
  };
  if (_.isBoolean(opts.supportBIP44AndP2PKH))
    walletOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

  server.createWallet(walletOpts, function(err, walletId) {
    if (err) return cb(err);

    async.each(_.range(n), function(i, cb) {
      var copayerData = TestData.copayers[i + offset];
      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        name: 'copayer ' + (i + 1),
        xPubKey: (_.isBoolean(opts.supportBIP44AndP2PKH) && !opts.supportBIP44AndP2PKH) ? copayerData.xPubKey_45H : copayerData.xPubKey_44H_0H_0H,
        requestPubKey: copayerData.pubKey_1H_0,
        customData: 'custom data ' + (i + 1),
      });
      if (_.isBoolean(opts.supportBIP44AndP2PKH))
        copayerOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

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

helpers.stubUtxos = function(server, wallet, amounts, cb) {
  async.mapSeries(_.range(0, amounts.length > 2 ? 2 : 1), function(i, next) {
    server.createAddress({}, next);
  }, function(err, addresses) {
    should.not.exist(err);
    addresses.should.not.be.empty;
    var utxos = _.compact(_.map([].concat(amounts), function(amount, i) {
      var confirmations;
      if (_.isString(amount) && _.startsWith(amount, 'u')) {
        amount = parseFloat(amount.substring(1));
        confirmations = 0;
      } else {
        confirmations = Math.floor(Math.random() * 100 + 1);
      }
      if (amount <= 0) return null;

      var address = addresses[i % addresses.length];

      var scriptPubKey;
      switch (wallet.addressType) {
        case Constants.SCRIPT_TYPES.P2SH:
          scriptPubKey = Bitcore.Script.buildMultisigOut(address.publicKeys, wallet.m).toScriptHashOut();
          break;
        case Constants.SCRIPT_TYPES.P2PKH:
          scriptPubKey = Bitcore.Script.buildPublicKeyHashOut(address.address);
          break;
      }
      should.exist(scriptPubKey);

      return {
        txid: helpers.randomTXID(),
        vout: Math.floor(Math.random() * 10 + 1),
        satoshis: helpers.toSatoshi(amount),
        scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
        address: address.address,
        confirmations: confirmations
      };
    }));
    blockchainExplorer.getUnspentUtxos = function(addresses, cb) {
      var selected = _.filter(utxos, function(utxo) {
        return _.contains(addresses, utxo.address);
      });
      return cb(null, selected);
    };

    return cb(utxos);
  });
};

helpers.stubBroadcast = function(thirdPartyBroadcast) {
  blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, null, '112233');
  blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
};

helpers.stubHistory = function(txs) {
  blockchainExplorer.getTransactions = function(addresses, from, to, cb) {
    var MAX_BATCH_SIZE = 100;
    var nbTxs = txs.length;

    if (_.isUndefined(from) && _.isUndefined(to)) {
      from = 0;
      to = MAX_BATCH_SIZE;
    }
    if (!_.isUndefined(from) && _.isUndefined(to))
      to = from + MAX_BATCH_SIZE;

    if (!_.isUndefined(from) && !_.isUndefined(to) && to - from > MAX_BATCH_SIZE)
      to = from + MAX_BATCH_SIZE;

    if (from < 0) from = 0;
    if (to < 0) to = 0;
    if (from > nbTxs) from = nbTxs;
    if (to > nbTxs) to = nbTxs;

    var page = txs.slice(from, to);
    return cb(null, page);
  };
};

helpers.stubFeeLevels = function(levels) {
  blockchainExplorer.estimateFee = function(nbBlocks, cb) {
    var result = _.zipObject(_.map(_.pick(levels, nbBlocks), function(fee, n) {
      return [+n, fee > 0 ? fee / 1e8 : fee];
    }));
    return cb(null, result);
  };
};

helpers.stubAddressActivity = function(activeAddresses) {
  blockchainExplorer.getAddressActivity = function(address, cb) {
    return cb(null, _.contains(activeAddresses, address));
  };
};

helpers.clientSign = function(txp, derivedXPrivKey) {
  var self = this;

  //Derive proper key to sign, for each input
  var privs = [];
  var derived = {};

  var xpriv = new Bitcore.HDPrivateKey(derivedXPrivKey, txp.network);

  _.each(txp.inputs, function(i) {
    if (!derived[i.path]) {
      derived[i.path] = xpriv.derive(i.path).privateKey;
      privs.push(derived[i.path]);
    }
  });

  var t = txp.getBitcoreTx();

  var signatures = _.map(privs, function(priv, i) {
    return t.getSignatures(priv);
  });

  signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
    return s.signature.toDER().toString('hex');
  });

  return signatures;
};


helpers.createProposalOptsLegacy = function(toAddress, amount, message, signingKey, feePerKb) {
  var opts = {
    toAddress: toAddress,
    amount: helpers.toSatoshi(amount),
    message: message,
    proposalSignature: null,
  };
  if (feePerKb) opts.feePerKb = feePerKb;

  var hash = WalletService._getProposalHash(toAddress, opts.amount, message);

  try {
    opts.proposalSignature = helpers.signMessage(hash, signingKey);
  } catch (ex) {}

  return opts;
};

helpers.createSimpleProposalOpts = function(toAddress, amount, signingKey, opts) {
  var outputs = [{
    toAddress: toAddress,
    amount: amount,
  }];
  return helpers.createProposalOpts(Model.TxProposalLegacy.Types.SIMPLE, outputs, signingKey, opts);
};

helpers.createExternalProposalOpts = function(toAddress, amount, signingKey, moreOpts, inputs) {
  var outputs = [{
    toAddress: toAddress,
    amount: amount,
  }];
  if (_.isArray(moreOpts)) {
    inputs = moreOpts;
    moreOpts = null;
  }
  return helpers.createProposalOpts(Model.TxProposalLegacy.Types.EXTERNAL, outputs, signingKey, moreOpts, inputs);
};


helpers.createStandardProposalOpts = function(outputs, moreOpts, inputs) {
  _.each(outputs, function(output) {
    output.amount = helpers.toSatoshi(output.amount);
  });

  var opts = {
    type: Model.TxProposal.Types.STANDARD,
    outputs: outputs,
    inputs: inputs || [],
  };

  if (moreOpts) {
    moreOpts = _.pick(moreOpts, ['feePerKb', 'customData', 'message']);
    opts = _.assign(opts, moreOpts);
  }

  opts = _.defaults(opts, {
    message: null
  });

  return opts;
};

helpers.createProposalOpts = function(type, outputs, signingKey, moreOpts, inputs) {
  _.each(outputs, function(output) {
    output.amount = helpers.toSatoshi(output.amount);
  });

  var opts = {
    type: type,
    proposalSignature: null,
    inputs: inputs || []
  };

  if (moreOpts) {
    moreOpts = _.pick(moreOpts, ['feePerKb', 'customData', 'message']);
    opts = _.assign(opts, moreOpts);
  }

  opts = _.defaults(opts, {
    message: null
  });

  var hash;
  if (type == Model.TxProposalLegacy.Types.SIMPLE) {
    opts.toAddress = outputs[0].toAddress;
    opts.amount = outputs[0].amount;
    hash = WalletService._getProposalHash(opts.toAddress, opts.amount,
      opts.message, opts.payProUrl);
  } else if (type == Model.TxProposalLegacy.Types.MULTIPLEOUTPUTS || type == Model.TxProposalLegacy.Types.EXTERNAL) {
    opts.outputs = outputs;
    var header = {
      outputs: outputs,
      message: opts.message,
      payProUrl: opts.payProUrl
    };
    hash = WalletService._getProposalHash(header);
  }

  try {
    opts.proposalSignature = helpers.signMessage(hash, signingKey);
  } catch (ex) {}

  return opts;
};
helpers.createAddresses = function(server, wallet, main, change, cb) {
  var clock = sinon.useFakeTimers(Date.now(), 'Date');
  async.map(_.range(main + change), function(i, next) {
    clock.tick(1000);
    var address = wallet.createAddress(i >= main);
    server.storage.storeAddressAndWallet(wallet, address, function(err) {
      next(err, address);
    });
  }, function(err, addresses) {
    if (err) throw new Error('Could not generate addresses');
    clock.restore();
    return cb(_.take(addresses, main), _.takeRight(addresses, change));
  });
};

module.exports = helpers;
