'use strict';

var _ = require('lodash');
var async = require('async');

var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var log = require('npmlog');
log.debug = log.verbose;

var config = require('../test-config');
// var tingodb = require('tingodb')({
//   memStore: true
// });

var Bitcore = require('bitcore-lib');
var Bitcore_ = {
  btc: Bitcore,
  bch: require('bitcore-lib-cash')
};

var { ChainService } = require('../../ts_build/lib/chain/index');
var Common = require('../../ts_build/lib/common');
var Utils = Common.Utils;
var Constants = Common.Constants;
var Defaults = Common.Defaults;

var { Storage } = require('../../ts_build/lib/storage');
var { WalletService } = require('../../ts_build/lib/server');
var Model = require('../../ts_build/lib/model');
var TestData = require('../testdata');

var storage, blockchainExplorer;

// tinodb not longer supported
var useMongoDb =  true; // !!process.env.USE_MONGO_DB;
const CWC =  require('crypto-wallet-core');

var helpers = {};

helpers.CLIENT_VERSION = 'bwc-2.0.0';

helpers.before = function(cb) {
  function getDb(cb) {
    if (useMongoDb) {
      var mongodb = require('mongodb');
      mongodb.MongoClient.connect(config.mongoDb.uri, { useUnifiedTopology: true }, function(err, client) {
        if (err) throw err;
        return cb(client.db(config.mongoDb.dbname));
      });
    } else {
      throw "tingodb not longer supported";
      //var db = new tingodb.Db('./db/test', {});
      //return cb(db);
    }

  }
  getDb(function(db) {
    storage = new Storage({
      db: db
    });
    Storage.createIndexes(db);
    let be = blockchainExplorer = sinon.stub();
    be.register = sinon.stub().callsArgWith(1, null, null);
    be.addAddresses = sinon.stub().callsArgWith(2, null, null);
    be.getAddressUtxos = sinon.stub().callsArgWith(2, null, []);
    be.getCheckData = sinon.stub().callsArgWith(1, null, {sum: 100});
    be.getUtxos = sinon.stub().callsArgWith(1, null,[]);
    be.getBlockchainHeight = sinon.stub().callsArgWith(0, null, 1000, 'hash');
    be.estimateGas = sinon.stub().callsArgWith(1, null, Defaults.MIN_GAS_LIMIT);
    be.getBalance = sinon.stub().callsArgWith(1, null, {unconfirmed:0, confirmed: '10000000000', balance: '10000000000' });

    // just a number >0 (xrp does not accept 0)
    be.getTransactionCount = sinon.stub().callsArgWith(1, null, '5');


    var opts = {
      storage: storage,
      blockchainExplorer: blockchainExplorer,
      request: sinon.stub()
    };
    WalletService.initialize(opts, function() {
      return cb(opts);
    });
  });
};

helpers.beforeEach = function(cb) {
  if (!storage.db) return cb();

  // Left overs to be initalized
  let be = blockchainExplorer;
  be.register = sinon.stub().callsArgWith(1, null, null);
  be.addAddresses = sinon.stub().callsArgWith(2, null, null);

  // TODO
  const collections = {
    WALLETS: 'wallets',
    TXS: 'txs',
    ADDRESSES: 'addresses',
    NOTIFICATIONS: 'notifications',
    COPAYERS_LOOKUP: 'copayers_lookup',
    PREFERENCES: 'preferences',
    EMAIL_QUEUE: 'email_queue',
    CACHE: 'cache',
    FIAT_RATES2: 'fiat_rates2',
    TX_NOTES: 'tx_notes',
    SESSIONS: 'sessions',
    PUSH_NOTIFICATION_SUBS: 'push_notification_subs',
    TX_CONFIRMATION_SUBS: 'tx_confirmation_subs',
    LOCKS: 'locks'
  };


  async.each(_.values(collections), (x, icb)=> {
    storage.db.collection(x).deleteMany({}, icb);
  }, (err) => {
    should.not.exist(err);
    var opts = {
      storage: storage,
      blockchainExplorer: blockchainExplorer,
      request: sinon.stub()
    };
    WalletService.initialize(opts, function() {
      return cb(opts);
    });
  });
};

helpers.after = function(cb) {
  WalletService.shutDown(() => {
    setImmediate(cb);
  });
};

helpers.getBlockchainExplorer = function() {
  return blockchainExplorer;
};

helpers.getStorage = function() {
  return storage;
};

helpers.signMessage = function(message, privKey) {
  var priv = new Bitcore.PrivateKey(privKey);
  const flattenedMessage = _.isArray(message)? _.join(message) : message;
  var hash = Utils.hashMessage(flattenedMessage);
  return Bitcore.crypto.ECDSA.sign(hash, priv, 'little').toString();
};

helpers.signRequestPubKey = function(requestPubKey, xPrivKey) {
  var priv = new Bitcore.HDPrivateKey(xPrivKey).deriveChild(Constants.PATHS.REQUEST_KEY_AUTH).privateKey;
  return helpers.signMessage(requestPubKey, priv);
};

helpers.getAuthServer = function(copayerId, cb) {
  var verifyStub = sinon.stub(WalletService.prototype, '_verifySignature');
  verifyStub.returns(true);

  WalletService.getInstanceWithAuth({
    copayerId: copayerId,
    message: 'dummy',
    signature: 'dummy',
    clientVersion: helpers.CLIENT_VERSION,
  }, function(err, server) {
    verifyStub.restore();
    if (err || !server) throw new Error('Could not login as copayerId ' + copayerId + ' err: ' + err);
    return cb(server);
  });
};

helpers._generateCopayersTestData = function() {
  var xPrivKeys = ['xprv9s21ZrQH143K2n4rV4AtAJFptEmd1tNMKCcSyQBCSuN5eq1dCUhcv6KQJS49joRxu8NNdFxy8yuwTtzCPNYUZvVGC7EPRm2st2cvE7oyTbB',
    'xprv9s21ZrQH143K3BwkLceWNLUsgES15JoZuv8BZfnmDRcCGtDooUAPhY8KovhCWcRLXUun5AYL5vVtUNRrmPEibtfk9ongxAGLXZzEHifpvwZ',
    'xprv9s21ZrQH143K3xgLzxd6SuWqG5Zp1iUmyGgSsJVhdQNeTzAqBFvXXLZqZzFZqocTx4HD9vUVYU27At5i8q46LmBXXL97fo4H9C3tHm4BnjY',
    'xprv9s21ZrQH143K48nfuK14gKJtML7eQzV2dAH1RaqAMj8v2zs79uaavA9UTWMxpBdgbMH2mhJLeKGq8AFA6GDnFyWP4rLmknqZAfgFFV718vo',
    'xprv9s21ZrQH143K44Bb9G3EVNmLfAUKjTBAA2YtKxF4zc8SLV1o15JBoddhGHE9PGLXePMbEsSjCCvTvP3fUv6yMXZrnHigBboRBn2DmNoJkJg',
    'xprv9s21ZrQH143K48PpVxrh71KdViTFhAaiDSVtNFkmbWNYjwwwPbTrcqoVXsgBfue3Gq9b71hQeEbk67JgtTBcpYgKLF8pTwVnGz56f1BaCYt',
    'xprv9s21ZrQH143K3pgRcRBRnmcxNkNNLmJrpneMkEXY6o5TWBuJLMfdRpAWdb2cG3yxbL4DxfpUnQpjfQUmwPdVrRGoDJmtAf5u8cyqKCoDV97',
    'xprv9s21ZrQH143K3nvcmdjDDDZbDJHpfWZCUiunwraZdcamYcafHvUnZfV51fivH9FPyfo12NyKH5JDxGLsQePyWKtTiJx3pkEaiwxsMLkVapp',
    'xprv9s21ZrQH143K2uYgqtYtphEQkFAgiWSqahFUWjgCdKykJagiNDz6Lf7xRVQdtZ7MvkhX9V3pEcK3xTAWZ6Y6ecJqrXnCpzrH9GSHn8wyrT5',
    'xprv9s21ZrQH143K2wcRMP75tAEL5JnUx4xU2AbUBQzVVUDP7DHZJkjF3kaRE7tcnPLLLL9PGjYTWTJmCQPaQ4GGzgWEUFJ6snwJG9YnQHBFRNR'
  ];

  console.log('var copayers = [');
  _.each(xPrivKeys, function(xPrivKeyStr, c) {
    var xpriv = Bitcore.HDPrivateKey(xPrivKeyStr);
    var xpub = Bitcore.HDPublicKey(xpriv);

    var xpriv_45H = xpriv.deriveChild(45, true);
    var xpub_45H = Bitcore.HDPublicKey(xpriv_45H);
    var id45 = Model.Copayer._xPubToCopayerId('btc', xpub_45H.toString());

    var xpriv_44H_0H_0H = xpriv.deriveChild(44, true).deriveChild(0, true).deriveChild(0, true);
    var xpub_44H_0H_0H = Bitcore.HDPublicKey(xpriv_44H_0H_0H);
    var id44btc = Model.Copayer._xPubToCopayerId('btc', xpub_44H_0H_0H.toString());
    var id44bch = Model.Copayer._xPubToCopayerId('bch', xpub_44H_0H_0H.toString());

    var xpriv_1H = xpriv.deriveChild(1, true);
    var xpub_1H = Bitcore.HDPublicKey(xpriv_1H);
    var priv = xpriv_1H.deriveChild(0).privateKey;
    var pub = xpub_1H.deriveChild(0).publicKey;

    console.log('{id44btc: ', "'" + id44btc + "',");
    console.log('id44bch: ', "'" + id44bch + "',");
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

/* ETH wallet use the provided key here, probably 44'/0'/0' */
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
    singleAddress: !!opts.singleAddress,
    coin: opts.coin || 'btc',
    network: opts.network || 'livenet',
    nativeCashAddr: opts.nativeCashAddr,
  };

  if (_.isBoolean(opts.supportBIP44AndP2PKH))
    walletOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

  server.createWallet(walletOpts, function(err, walletId) {
    if (err) throw err;

    async.eachSeries(_.range(n), function(i, cb) {
      var copayerData = TestData.copayers[i + offset];


      var pub = (_.isBoolean(opts.supportBIP44AndP2PKH) && !opts.supportBIP44AndP2PKH) ? copayerData.xPubKey_45H : copayerData.xPubKey_44H_0H_0H;

      if (opts.network == 'testnet') {
        if (opts.coin == 'btc' || opts.coin == 'bch') {
          pub = copayerData.xPubKey_44H_0H_0Ht;
        } else {
          pub = copayerData.xPubKey_44H_0H_0HtSAME;
        }
      }

      var copayerOpts = helpers.getSignedCopayerOpts({
        walletId: walletId,
        coin: opts.coin,
        name: 'copayer ' + (i + 1),
        xPubKey: pub,
        requestPubKey: copayerData.pubKey_1H_0,
        customData: 'custom data ' + (i + 1),
      });
      if (_.isBoolean(opts.supportBIP44AndP2PKH))
        copayerOpts.supportBIP44AndP2PKH = opts.supportBIP44AndP2PKH;

      server.joinWallet(copayerOpts, function(err, result) {
        if (err) throw err;
        copayerIds.push(result.copayerId);
        return cb(err);
      });
    }, function(err) {
      if (err) return new Error('Could not generate wallet');
      helpers.getAuthServer(copayerIds[0], function(s) {
        if (opts.earlyRet) return cb(s);
        s.getWallet({}, function(err, w) {

          // STUB for checkWalletSync.
          s.checkWalletSync = function(a,b, simple, cb) {
            if (simple) return cb(null, false);
            return cb(null, true);
          }
          cb(s, w);
        });
      });
    });
  });
};


helpers.randomTXID = function() {
  return Bitcore.crypto.Hash.sha256(Buffer.from((Math.random() * 100000).toString())).toString('hex');;
};

helpers.toSatoshi = function(btc) {
  if (_.isArray(btc)) {
    return _.map(btc, helpers.toSatoshi);
  } else {
    return Utils.strip(btc * 1e8);
  }
};

helpers._parseAmount = function(str) {
  var result = {
    amount: +0,
    confirmations: _.random(6, 100),
  };

  if (_.isNumber(str)) str = str.toString();

  var re = /^((?:\d+c)|u)?\s*([\d\.]+)\s*(btc|bit|sat)?$/;
  var match = str.match(re);
  if (!match) throw new Error('Could not parse amount ' + str);

  if (match[1]) {
    if (match[1] == 'u') result.confirmations = 0;
    if (_.endsWith(match[1], 'c')) result.confirmations = +match[1].slice(0, -1);
  }

  switch (match[3]) {
    default:
    case 'btc':
      result.amount = Utils.strip(+match[2] * 1e8);
      break;
    case 'bit':
      result.amount = Utils.strip(+match[2] * 1e2);
      break
    case 'sat':
      result.amount = Utils.strip(+match[2]);
      break;
  };

  return result;
};

helpers.stubUtxos = function(server, wallet, amounts, opts, cb) {
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }
  opts = opts || {};

  if (opts.tokenAddress) {
    amounts = _.isArray(amounts) ? amounts : [amounts];
    blockchainExplorer.getBalance = function(opts, cb) {
      if (opts.tokenAddress) {
        return cb(null, {unconfirmed:0, confirmed: 2e6, balance: 2e6 });
      }
      let conf =  _.sum(_.map(amounts, x =>  Number((x*1e18).toFixed(0))));
      return cb(null, {unconfirmed:0, confirmed: conf, balance: conf });
    }
    blockchainExplorer.estimateFee = sinon.stub().callsArgWith(1, null, 20000000000);
    return cb();
  }

  if (wallet.coin == 'eth') {
    amounts = _.isArray(amounts) ? amounts : [amounts];
    let conf =  _.sum(_.map(amounts, x =>  Number((x*1e18).toFixed(0))));
    blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, null, {unconfirmed:0, confirmed: conf, balance: conf });
    return cb();
  }

  if (wallet.coin == 'xrp') {
    amounts = _.isArray(amounts) ? amounts : [amounts];
    let conf =  _.sum(_.map(amounts, x =>  Number((x*1e6).toFixed(0))));
    conf =  conf + Defaults.MIN_XRP_BALANCE;
    blockchainExplorer.getBalance = sinon.stub().callsArgWith(1, null, {unconfirmed:0, confirmed: conf, balance: conf });
    return cb();
  }



  if (!helpers._utxos) helpers._utxos = {};

  var S = Bitcore_[wallet.coin].Script;
  async.waterfall([

    function(next) {
      if (opts.addresses) return next(null, [].concat(opts.addresses));
      async.mapSeries(_.range(0, amounts.length > 2 ? 2 : 1), function(i, next) {
        server.createAddress({}, next);
      }, next);
    },
    function(addresses, next) {
      addresses.should.not.be.empty;

      var utxos = _.compact(_.map([].concat(amounts), function(amount, i) {
        var parsed = helpers._parseAmount(amount);

        if (parsed.amount <= 0) return null;

        var address = addresses[i % addresses.length];

        var scriptPubKey;
        switch (wallet.addressType) {
          case Constants.SCRIPT_TYPES.P2SH:
            scriptPubKey = S.buildMultisigOut(address.publicKeys, wallet.m).toScriptHashOut();
            break;
          case Constants.SCRIPT_TYPES.P2PKH:
            scriptPubKey = S.buildPublicKeyHashOut(address.address);
            break;
        }
        should.exist(scriptPubKey);

        return {
          txid: helpers.randomTXID(),
          vout: _.random(0, 10),
          satoshis: parsed.amount,
          scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
          address: address.address,
          confirmations: parsed.confirmations,
          publicKeys: address.publicKeys,
          wallet: wallet.id,
        };
      }));

      if (opts.keepUtxos) {
        helpers._utxos = helpers._utxos.concat(utxos);
      } else {
        helpers._utxos = utxos;
      }

      blockchainExplorer.getUtxos = function(param1, height, cb) {

        var selected;
        selected = _.filter(helpers._utxos, {'wallet': param1.id});
        return cb(null, selected);
      };


      blockchainExplorer.getAddressUtxos = function(param1, height, cb) {
        var selected;
        selected = _.filter(helpers._utxos, {'address': param1});
        return cb(null, selected);
      };


      return next();
    },
  ], function(err) {
    should.not.exist(err);
    return cb(helpers._utxos);
  });
};

helpers.stubBroadcast = function(txid) {
  blockchainExplorer.broadcast = sinon.stub().callsArgWith(1, null, txid || '112233');
  blockchainExplorer.getTransaction = sinon.stub().callsArgWith(1, null, null);
};

helpers.createTxsV8 = function(nr, bcHeight, txs) {
  txs = txs || [];
  // Will generate
  // order / confirmations  / height / txid
  //  0.  => -1     / -1            /   txid0   / id0  <=  LAST ONE!
  //  1.  => 1      / bcHeight      /   txid1
  //  2.  => 2      / bcHeight - 1  /   txid2
  //  3.  => 3...   / bcHeight - 2  /   txid3

  var  i = 0;
  if (_.isEmpty(txs)) {
    while(i < nr) {
      txs.push({
        id: 'id' + i,
        txid: 'txid' + i,
        size: 226,
        category: 'receive',
        satoshis: 30001,
        // this is translated on V8.prototype.getTransactions
        amount: 30001 /1e8,
        height: (i == 0) ? -1 :  bcHeight - i + 1,
        address: 'muFJi3ZPfR5nhxyD7dfpx2nYZA8Wmwzgck',
        blockTime: '2018-09-21T18:08:31.000Z',
      });
      i++;
    }
  }

  return txs;
};


helpers.stubHistory = function(nr, bcHeight, txs) {
  txs= helpers.createTxsV8(nr,bcHeight, txs);
  blockchainExplorer.getTransactions = function(walletId, startBlock, cb) {
    startBlock = startBlock || 0;
    var page = _.filter(txs, (x) => {
      return x.height >=startBlock || x.height == -1
    });
    return cb(null, page);
  };
};


helpers.stubCheckData = function(bc, server, isBCH, cb) {
  server.storage.walletCheck({walletId:server.walletId, bch: isBCH}).then((x) => {
    bc.getCheckData = sinon.stub().callsArgWith(1, null, {sum: x.sum});
    return cb();
  });
};


// fill => fill intermediary levels
helpers.stubFeeLevels = function(levels, fill, coin) {
  coin = coin || 'btc';
  let div = 1;
  if (coin == 'btc' || coin == 'bch') {
    div = 1e8;  // bitcoind returns values in BTC amounts
  }

  blockchainExplorer.estimateFee = function(nbBlocks, cb) {
    var result = _.fromPairs(_.map(_.pick(levels, nbBlocks), function(fee, n) {
      return [+n, fee > 0 ? fee / div : fee];
    }));

    if (fill) {
      let last;
      _.each(nbBlocks, (n) => {
        if (result[n]) {
          last = result[n];
        }
        result[n] = last;
      });
    }
    return cb(null, result);
  };
};




var stubAddressActivityFailsOn = null;
var stubAddressActivityFailsOnCount=1;
helpers.stubAddressActivity = function(activeAddresses, failsOn) {

  stubAddressActivityFailsOnCount=1;

  // could be null
  stubAddressActivityFailsOn = failsOn;

  blockchainExplorer.getAddressActivity = function(address, cb) {
    if (stubAddressActivityFailsOnCount === stubAddressActivityFailsOn)
      return cb('failed on request');

    stubAddressActivityFailsOnCount++;

    return cb(null, _.includes(activeAddresses, address));
  };
};

helpers.clientSign = function(txp, derivedXPrivKey) {
  var self = this;

  //Derive proper key to sign, for each input
  var privs = [];
  var derived = {};
  var signatures;

  var xpriv = new Bitcore.HDPrivateKey(derivedXPrivKey, txp.network);

  switch(txp.coin) {
    case 'eth':
    case 'xrp':

      // For eth => account, 0, change = 0
      const priv =  xpriv.derive('m/0/0').privateKey;
      const privKey = priv.toString('hex');
      let tx = ChainService.getBitcoreTx(txp).uncheckedSerialize();
      const isERC20 = txp.tokenAddress && !txp.payProUrl;
      const chain = isERC20 ? 'ERC20' : ChainService.getChain(txp.coin);
      tx = typeof tx === 'string'? [tx] : tx;
      signatures = [];
      for (const rawTx of tx) {
        const signed = CWC.Transactions.getSignature({
          chain,
          tx: rawTx,
          key: { privKey: privKey.toString('hex') },
        });
        signatures.push(signed);
      }
      break;
    default:
      _.each(txp.inputs, function(i) {
        if (!derived[i.path]) {
          derived[i.path] = xpriv.deriveChild(i.path).privateKey;
          privs.push(derived[i.path]);
        }
      });

      var t = ChainService.getBitcoreTx(txp);
      signatures = _.map(privs, function(priv, i) {
        return t.getSignatures(priv, undefined, txp.signingMethod);
      });

      signatures = _.map(_.sortBy(_.flatten(signatures), 'inputIndex'), function(s) {
        return s.signature.toDER(txp.signingMethod).toString('hex');
      });
  };

  return signatures;
};

helpers.getProposalSignatureOpts = function(txp, signingKey) {
  var raw = txp.getRawTx();
  var proposalSignature = helpers.signMessage(raw, signingKey);

  return {
    txProposalId: txp.id,
    proposalSignature: proposalSignature,
  }
};


helpers.createAddresses = function(server, wallet, main, change, cb) {
  // var clock = sinon.useFakeTimers('Date');

  async.mapSeries(_.range(main + change), function(i, next) {
    // clock.tick(1000);
    var address = wallet.createAddress(i >= main);
    server.storage.storeAddressAndWallet(wallet, address, function(err) {
      next(err, address);
    });
  }, function(err, addresses) {
    should.not.exist(err);
    // clock.restore();

    return cb(_.take(addresses, main), _.takeRight(addresses, change));
  });
};

helpers.createAndPublishTx = function(server, txOpts, signingKey, cb) {

  server.createTx(txOpts, function(err, txp) {
    if (err) console.log(err);
    should.not.exist(err, "Error creating a TX");
    should.exist(txp,"Error... no txp");
    var publishOpts = helpers.getProposalSignatureOpts(txp, signingKey);
    server.publishTx(publishOpts, function(err) {
      if (err) console.log(err);
      should.not.exist(err);
      return cb(txp);
    });
  });
};


helpers.historyCacheTest = function(items) {
  var template = {
    txid: "fad88682ccd2ff34cac6f7355fe9ecd8addd9ef167e3788455972010e0d9d0de",
    vin: [{
      txid: "0279ef7b21630f859deb723e28beac9e7011660bd1346c2da40321d2f7e34f04",
      vout: 0,
      n: 0,
      addr: "2NAVFnsHqy5JvqDJydbHPx393LFqFFBQ89V",
      valueSat: 45753,
      value: 0.00045753,
    }],
    vout: [{
      value: "0.00011454",
      n: 0,
      scriptPubKey: {
        addresses: [
          "2N7GT7XaN637eBFMmeczton2aZz5rfRdZso"
        ]
      }
    }, {
      value: "0.00020000",
      n: 1,
      scriptPubKey: {
        addresses: [
          "mq4D3Va5mYHohMEHrgHNGzCjKhBKvuEhPE"
        ]
      }
    }],
    confirmations: 1,
    blockheight: 423499,
    time: 1424472242,
    blocktime: 1424472242,
    valueOut: 0.00031454,
    valueIn: 0.00045753,
    fees: 0.00014299
  };

  var ret = [];
  _.each(_.range(0, items), function(i) {
    var t = _.clone(template);
    t.txid = 'txid:' + i;
    t.confirmations = items - i - 1;
    t.blockheight = i;
    t.time = t.blocktime = i;
    ret.unshift(t);
  });

  return ret;
};

module.exports = helpers;
