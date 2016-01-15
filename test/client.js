'use strict';

var _ = require('lodash');
var $ = require('preconditions').singleton();
var chai = require('chai');
chai.config.includeStack = true;
var sinon = require('sinon');
var should = chai.should();
var async = require('async');
var request = require('supertest');
var Uuid = require('uuid');
var tingodb = require('tingodb')({
  memStore: true
});

var log = require('../lib/log');

var Bitcore = require('bitcore-lib');
var BitcorePayPro = require('bitcore-payment-protocol');

var BWS = require('bitcore-wallet-service');

var Common = require('../lib/common');
var Constants = Common.Constants;
var Utils = Common.Utils;
var Client = require('../lib');
var ExpressApp = BWS.ExpressApp;
var Storage = BWS.Storage;
var TestData = require('./testdata');
var ImportData = require('./legacyImportData.js');

var helpers = {};

helpers.toSatoshi = function(btc) {
  if (_.isArray(btc)) {
    return _.map(btc, helpers.toSatoshi);
  } else {
    return parseFloat((btc * 1e8).toPrecision(12));
  }
};

helpers.getRequest = function(app) {
  $.checkArgument(app);
  return function(args, cb) {
    var req = request(app);
    var r = req[args.method](args.relUrl);

    if (args.headers) {
      _.each(args.headers, function(v, k) {
        if (k && v) {
          r.set(k, v);
        }
      });
    }
    if (!_.isEmpty(args.body)) {
      r.send(args.body);
    };
    r.end(function(err, res) {
      return cb(err, res, res.body);
    });
  };
};

helpers.newClient = function(app) {
  $.checkArgument(app);
  return new Client({
    request: helpers.getRequest(app),
  });
};

helpers.newDb = function() {
  this.dbCounter = (this.dbCounter || 0) + 1;
  return new tingodb.Db('./db/test' + this.dbCounter, {});
};

helpers.generateUtxos = function(scriptType, publicKeyRing, path, requiredSignatures, amounts) {
  var amounts = [].concat(amounts);
  var utxos = _.map(amounts, function(amount, i) {

    var address = Utils.deriveAddress(scriptType, publicKeyRing, path, requiredSignatures, 'testnet');

    var scriptPubKey;
    switch (scriptType) {
      case Constants.SCRIPT_TYPES.P2SH:
        scriptPubKey = Bitcore.Script.buildMultisigOut(address.publicKeys, requiredSignatures).toScriptHashOut();
        break;
      case Constants.SCRIPT_TYPES.P2PKH:
        scriptPubKey = Bitcore.Script.buildPublicKeyHashOut(address.address);
        break;
    }
    should.exist(scriptPubKey);

    var obj = {
      txid: Bitcore.crypto.Hash.sha256(new Buffer(i)).toString('hex'),
      vout: 100,
      satoshis: helpers.toSatoshi(amount),
      scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
      address: address.address,
      path: path,
      publicKeys: address.publicKeys,
    };
    return obj;
  });
  return utxos;
};

helpers.createAndJoinWallet = function(clients, m, n, cb) {
  clients[0].seedFromRandomWithMnemonic({
    network: 'testnet'
  });
  clients[0].createWallet('wallet name', 'creator', m, n, {
    network: 'testnet'
  }, function(err, secret) {
    should.not.exist(err);

    if (n > 1) {
      should.exist(secret);
    }

    async.series([

        function(next) {
          async.each(_.range(1, n), function(i, cb) {
            clients[i].seedFromRandomWithMnemonic({
              network: 'testnet'
            });
            clients[i].joinWallet(secret, 'copayer ' + i, {}, cb);
          }, next);
        },
        function(next) {
          async.each(_.range(n), function(i, cb) {
            clients[i].openWallet(cb);
          }, next);
        },
      ],
      function(err) {
        should.not.exist(err);
        return cb({
          m: m,
          n: n,
          secret: secret,
        });
      });
  });
};

helpers.tamperResponse = function(clients, method, url, args, tamper, cb) {
  clients = [].concat(clients);
  // Use first client to get a clean response from server
  clients[0]._doRequest(method, url, args, function(err, result) {
    should.not.exist(err);
    tamper(result);
    // Return tampered data for every client in the list
    _.each(clients, function(client) {
      client._doRequest = sinon.stub().withArgs(method, url).yields(null, result);
    });
    return cb();
  });
};


var blockchainExplorerMock = {};

blockchainExplorerMock.getUnspentUtxos = function(addresses, cb) {
  var selected = _.filter(blockchainExplorerMock.utxos, function(utxo) {
    return _.contains(addresses, utxo.address);
  });
  return cb(null, selected);
};

blockchainExplorerMock.setUtxo = function(address, amount, m, confirmations) {
  var scriptPubKey;
  switch (address.type) {
    case Constants.SCRIPT_TYPES.P2SH:
      scriptPubKey = address.publicKeys ? Bitcore.Script.buildMultisigOut(address.publicKeys, m).toScriptHashOut() : '';
      break;
    case Constants.SCRIPT_TYPES.P2PKH:
      scriptPubKey = Bitcore.Script.buildPublicKeyHashOut(address.address);
      break;
  }
  should.exist(scriptPubKey);
  blockchainExplorerMock.utxos.push({
    txid: Bitcore.crypto.Hash.sha256(new Buffer(Math.random() * 100000)).toString('hex'),
    vout: Math.floor((Math.random() * 10) + 1),
    amount: amount,
    address: address.address,
    scriptPubKey: scriptPubKey.toBuffer().toString('hex'),
    confirmations: _.isUndefined(confirmations) ? Math.floor((Math.random() * 100) + 1) : +confirmations,
  });
};

blockchainExplorerMock.broadcast = function(raw, cb) {
  blockchainExplorerMock.lastBroadcasted = raw;
  return cb(null, (new Bitcore.Transaction(raw)).id);
};

blockchainExplorerMock.setHistory = function(txs) {
  blockchainExplorerMock.txHistory = txs;
};

blockchainExplorerMock.getTransactions = function(addresses, from, to, cb) {
  var list = [].concat(blockchainExplorerMock.txHistory);
  list = _.slice(list, from, to);
  return cb(null, list);
};

blockchainExplorerMock.getAddressActivity = function(address, cb) {
  var activeAddresses = _.pluck(blockchainExplorerMock.utxos || [], 'address');
  return cb(null, _.contains(activeAddresses, address));
};

blockchainExplorerMock.setFeeLevels = function(levels) {
  blockchainExplorerMock.feeLevels = levels;
};

blockchainExplorerMock.estimateFee = function(nbBlocks, cb) {
  return cb(null, {
    feePerKB: blockchainExplorerMock.feeLevels[nbBlocks] / 1e8
  });
};

blockchainExplorerMock.reset = function() {
  blockchainExplorerMock.utxos = [];
  blockchainExplorerMock.txHistory = [];
  blockchainExplorerMock.feeLevels = [];
};



describe('client API', function() {
  var clients, app, sandbox;
  var i = 0;
  beforeEach(function(done) {
    var storage = new Storage({
      db: helpers.newDb(),
    });
    var expressApp = new ExpressApp();
    expressApp.start({
        storage: storage,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      },
      function() {
        app = expressApp.app;

        // Generates 5 clients
        clients = _.map(_.range(5), function(i) {
          return helpers.newClient(app);
        });
        blockchainExplorerMock.reset();
        sandbox = sinon.sandbox.create();

        if (!process.env.BWC_SHOW_LOGS) {
          sandbox.stub(log, 'warn');
          sandbox.stub(log, 'info');
          sandbox.stub(log, 'error');
        }
        done();
      });
  });
  afterEach(function(done) {
    sandbox.restore();
    done();
  });

  describe('Client Internals', function() {
    it('should expose bitcore', function() {
      should.exist(Client.Bitcore);
      should.exist(Client.Bitcore.HDPublicKey);
    });
  });

  describe('Server internals', function() {
    it('should allow cors', function(done) {
      clients[0].credentials = {};
      clients[0]._doRequest('options', '/', {}, function(err, x, headers) {
        headers['access-control-allow-origin'].should.equal('*');
        should.exist(headers['access-control-allow-methods']);
        should.exist(headers['access-control-allow-headers']);
        done();
      });
    });

    it('should handle critical errors', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields('bigerror');
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            err.code.should.equal('ERROR');
            done();
          });
      });
    });

    it('should handle critical errors (Case2)', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields({
        code: 501,
        message: 'wow'
      });
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            err.code.should.equal('ERROR');
            done();
          });
      });
    });

    it('should handle critical errors (Case3)', function(done) {
      var s = sinon.stub();
      s.storeWallet = sinon.stub().yields({
        code: 404,
        message: 'wow'
      });
      s.fetchWallet = sinon.stub().yields(null);
      var expressApp = new ExpressApp();
      expressApp.start({
        storage: s,
        blockchainExplorer: blockchainExplorerMock,
        disableLogs: true,
      }, function() {
        var s2 = sinon.stub();
        s2.load = sinon.stub().yields(null);
        var client = helpers.newClient(app);
        client.storage = s2;
        client.createWallet('1', '2', 1, 1, {
            network: 'testnet'
          },
          function(err) {
            err.code.should.equal('NOT_FOUND');
            done();
          });
      });
    });

    it('should handle critical errors (Case4)', function(done) {
      var body = {
        code: 999,
        message: 'unexpected body'
      };
      var ret = Client._parseError(body);
      ret.toString().indexOf('ClientError').should.not.equal(-1);
      done();
    });

    it('should handle critical errors (Case5)', function(done) {
      var err = 'some error';
      var res, body; // leave them undefined to simulate no-response
      var requestStub = function(args, cb) {
        cb(err, res, body);
      };
      var request = sinon.stub(clients[0], 'request', requestStub);
      clients[0].createWallet('wallet name', 'creator', 1, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.exist(err);
        err.code.should.equal('CONNECTION_ERROR');
        request.restore();
        done();
      });
    });
  });

  describe('Build & sign txs', function() {
    var masterPrivateKey = 'tprv8ZgxMBicQKsPdPLE72pfSo7CvzTsWddGHdwSuMNrcerr8yQZKdaPXiRtP9Ew8ueSe9M7jS6RJsp4DiAVS2xmyxcCC9kZV6X1FMsX7EQX2R5';
    var derivedPrivateKey = {
      'BIP44': new Bitcore.HDPrivateKey(masterPrivateKey).derive("m/44'/1'/0'").toString(),
      'BIP45': new Bitcore.HDPrivateKey(masterPrivateKey).derive("m/45'").toString(),
      'BIP48': new Bitcore.HDPrivateKey(masterPrivateKey).derive("m/48'/1'/0'").toString(),
    };

    describe('#buildTx', function() {
      it('should build a tx correctly (BIP44)', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true,
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build a tx correctly (BIP48)', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP48']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          version: '2.0.0',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10050,
          derivationStrategy: 'BIP48',
          addressType: 'P2PKH',
        };
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true,
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(10050);
      });
      it('should build a legacy (v1.*) tx correctly', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP45']),
        }];

        var utxos = helpers.generateUtxos('P2SH', publicKeyRing, 'm/2147483647/0/0', 1, [1000, 2000]);
        var txp = {
          version: '1.0.1',
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          feePerKb: 40000,
          fee: 10050,
          derivationStrategy: 'BIP45',
          addressType: 'P2SH',
        };
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
          disableSmallFees: true,
          disableLargeFees: true,
        });

        should.not.exist(bitcoreError);
        t.getFee().should.equal(40000);
      });
      it('should protect from creating excessive fee', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1, 2]);
        var txp = {
          inputs: utxos,
          toAddress: toAddress,
          amount: 1.5e8,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 1.2e8,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };

        var x = Utils.newBitcoreTransaction;

        Utils.newBitcoreTransaction = function() {
          return {
            from: sinon.stub(),
            to: sinon.stub(),
            change: sinon.stub(),
            outputs: [{
              satoshis: 1000,
            }],
            fee: sinon.stub(),
          }
        };

        (function() {
          var t = Client.buildTx(txp);
        }).should.throw('Illegal State');

        Utils.newBitcoreTransaction = x;
      });
      it('should build a tx with multiple outputs', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          type: 'multiple_outputs',
          outputs: [{
            toAddress: toAddress,
            amount: 800,
            message: 'first output'
          }, {
            toAddress: toAddress,
            amount: 900,
            message: 'second output'
          }],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
        });
        should.not.exist(bitcoreError);
      });

      it('should build a tx with provided output scripts', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp = {
          inputs: utxos,
          type: 'external',
          outputs: [{
            "toAddress": "18433T2TSgajt9jWhcTBw4GoNREA6LpX3E",
            "amount": 700,
            "script": "512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae"
          }, {
            "amount": 600,
            "script": "76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac"
          }, {
            "amount": 0,
            "script": "6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210"
          }],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
        });
        should.not.exist(bitcoreError);
        t.outputs.length.should.equal(4);
        t.outputs[0].script.toHex().should.equal(txp.outputs[0].script);
        t.outputs[0].satoshis.should.equal(txp.outputs[0].amount);
        t.outputs[1].script.toHex().should.equal(txp.outputs[1].script);
        t.outputs[1].satoshis.should.equal(txp.outputs[1].amount);
        t.outputs[2].script.toHex().should.equal(txp.outputs[2].script);
        t.outputs[2].satoshis.should.equal(txp.outputs[2].amount);
        var changeScript = Bitcore.Script.fromAddress(txp.changeAddress.address).toHex();
        t.outputs[3].script.toHex().should.equal(changeScript);
      });
      it('should fail if provided output has no either toAddress or script', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp = {
          inputs: utxos,
          type: 'external',
          outputs: [{
            "amount": 700,
          }, {
            "amount": 600,
            "script": "76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac"
          }, {
            "amount": 0,
            "script": "6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210"
          }],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        (function() {
          var t = Client.buildTx(txp);
        }).should.throw('Output should have either toAddress or script specified');

        txp.outputs[0].toAddress = "18433T2TSgajt9jWhcTBw4GoNREA6LpX3E";
        var t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
        });
        should.not.exist(bitcoreError);

        delete txp.outputs[0].toAddress;
        txp.outputs[0].script = "512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae";
        t = Client.buildTx(txp);
        var bitcoreError = t.getSerializationError({
          disableIsFullySigned: true,
        });
        should.not.exist(bitcoreError);
      });
    });

    describe('#signTxp', function() {
      it('should sign BIP45 P2SH correctly', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP45']),
        }];

        var utxos = helpers.generateUtxos('P2SH', publicKeyRing, 'm/2147483647/0/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10000,
          derivationStrategy: 'BIP45',
          addressType: 'P2SH',
        };
        var signatures = Client.signTxp(txp, derivedPrivateKey['BIP45']);
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign BIP44 P2PKH correctly', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          toAddress: toAddress,
          amount: 1200,
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var signatures = Client.signTxp(txp, derivedPrivateKey['BIP44']);
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign multiple-outputs proposal correctly', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [1000, 2000]);
        var txp = {
          inputs: utxos,
          type: 'multiple_outputs',
          outputs: [{
            toAddress: toAddress,
            amount: 800,
            message: 'first output'
          }, {
            toAddress: toAddress,
            amount: 900,
            message: 'second output'
          }],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var signatures = Client.signTxp(txp, derivedPrivateKey['BIP44']);
        signatures.length.should.be.equal(utxos.length);
      });
      it('should sign proposal with provided output scripts correctly', function() {
        var toAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';
        var changeAddress = 'msj42CCGruhRsFrGATiUuh25dtxYtnpbTx';

        var publicKeyRing = [{
          xPubKey: new Bitcore.HDPublicKey(derivedPrivateKey['BIP44']),
        }];

        var utxos = helpers.generateUtxos('P2PKH', publicKeyRing, 'm/1/0', 1, [0.001]);
        var txp = {
          inputs: utxos,
          type: 'external',
          outputs: [{
            "amount": 700,
            "script": "512103ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff210314a96cd6f5a20826070173fe5b7e9797f21fc8ca4a55bcb2d2bde99f55dd352352ae"
          }, {
            "amount": 600,
            "script": "76a9144d5bd54809f846dc6b1a14cbdd0ac87a3c66f76688ac"
          }, {
            "amount": 0,
            "script": "6a1e43430102fa9213bc243af03857d0f9165e971153586d3915201201201210"
          }],
          changeAddress: {
            address: changeAddress
          },
          requiredSignatures: 1,
          outputOrder: [0, 1, 2, 3],
          fee: 10000,
          derivationStrategy: 'BIP44',
          addressType: 'P2PKH',
        };
        var signatures = Client.signTxp(txp, derivedPrivateKey['BIP44']);
        signatures.length.should.be.equal(utxos.length);
      });
    });
  });

  describe('Wallet secret round trip', function() {
    it('should create secret and parse secret', function() {
      var i = 0;
      while (i++ < 100) {
        var walletId = Uuid.v4();
        var walletPrivKey = new Bitcore.PrivateKey();
        var network = i % 2 == 0 ? 'testnet' : 'livenet';
        var secret = Client._buildSecret(walletId, walletPrivKey, network);
        var result = Client.parseSecret(secret);
        result.walletId.should.equal(walletId);
        result.walletPrivKey.toString().should.equal(walletPrivKey.toString());
        result.network.should.equal(network);
      };
    });
    it('should fail on invalid secret', function() {
      (function() {
        Client.parseSecret('invalidSecret');
      }).should.throw('Invalid secret');
    });

    it('should create secret and parse secret from string ', function() {
      var walletId = Uuid.v4();
      var walletPrivKey = new Bitcore.PrivateKey();
      var network = 'testnet';
      var secret = Client._buildSecret(walletId, walletPrivKey.toString(), network);
      var result = Client.parseSecret(secret);
      result.walletId.should.equal(walletId);
      result.walletPrivKey.toString().should.equal(walletPrivKey.toString());
      result.network.should.equal(network);
    });
  });

  describe('Notification polling', function() {
    var clock, interval;
    beforeEach(function() {
      clock = sinon.useFakeTimers(1234000, 'Date');
    });
    afterEach(function() {
      clock.restore();
    });
    it('should fetch notifications at intervals', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function() {
        clients[0].on('notification', function(data) {
          notifications.push(data);
        });

        var notifications = [];
        clients[0]._fetchLatestNotifications(5, function() {
          _.pluck(notifications, 'type').should.deep.equal(['NewCopayer', 'WalletComplete']);
          clock.tick(2000);
          notifications = [];
          clients[0]._fetchLatestNotifications(5, function() {
            notifications.length.should.equal(0);
            clock.tick(2000);
            clients[1].createAddress(function(err, x) {
              should.not.exist(err);
              clients[0]._fetchLatestNotifications(5, function() {
                _.pluck(notifications, 'type').should.deep.equal(['NewAddress']);
                clock.tick(2000);
                notifications = [];
                clients[0]._fetchLatestNotifications(5, function() {
                  notifications.length.should.equal(0);
                  clients[1].createAddress(function(err, x) {
                    should.not.exist(err);
                    clock.tick(60 * 1000);
                    clients[0]._fetchLatestNotifications(5, function() {
                      notifications.length.should.equal(0);
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
  });

  describe('Wallet Creation', function() {
    it('should check balance in a 1-1 ', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].getBalance({}, function(err, balance) {
          should.not.exist(err);
          balance.totalAmount.should.equal(0);
          balance.availableAmount.should.equal(0);
          balance.lockedAmount.should.equal(0);
          balance.totalBytesToSendMax.should.equal(0);
          done();
        })
      });
    });
    it('should be able to complete wallet in copayer that joined later', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function() {
        clients[0].getBalance({}, function(err, x) {
          should.not.exist(err);
          clients[1].getBalance({}, function(err, x) {
            should.not.exist(err);
            clients[2].getBalance({}, function(err, x) {
              should.not.exist(err);
              done();
            })
          })
        })
      });
    });
    it('should fire event when wallet is complete', function(done) {
      var checks = 0;
      clients[0].on('walletCompleted', function(wallet) {
        wallet.name.should.equal('wallet name');
        wallet.status.should.equal('complete');
        clients[0].isComplete().should.equal(true);
        clients[0].credentials.isComplete().should.equal(true);
        if (++checks == 2) done();
      });
      clients[0].createWallet('wallet name', 'creator', 2, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        clients[0].isComplete().should.equal(false);
        clients[0].credentials.isComplete().should.equal(false);
        clients[1].joinWallet(secret, 'guest', {}, function(err) {
          should.not.exist(err);
          clients[0].openWallet(function(err, walletStatus) {
            should.not.exist(err);
            should.exist(walletStatus);
            _.difference(_.pluck(walletStatus.copayers, 'name'), ['creator', 'guest']).length.should.equal(0);
            if (++checks == 2) done();
          });
        });
      });
    });

    it('should fill wallet info in a incomplete wallets', function(done) {
      clients[0].seedFromRandomWithMnemonic();
      clients[0].createWallet('XXX', 'creator', 2, 3, {}, function(err, secret) {
        should.not.exist(err);
        clients[1].seedFromMnemonic(clients[0].getMnemonic());
        clients[1].openWallet(function(err) {
          clients[1].credentials.walletName.should.equal('XXX');
          clients[1].credentials.m.should.equal(2);
          clients[1].credentials.n.should.equal(3);
          should.not.exist(err);
          done();
        });
      });
    });

    it('should not allow to join a full wallet ', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        should.exist(w.secret);
        clients[4].joinWallet(w.secret, 'copayer', {}, function(err, result) {
          err.code.should.contain('WALLET_FULL');
          done();
        });
      });
    });
    it('should fail with an invalid secret', function(done) {
      // Invalid
      clients[0].joinWallet('dummy', 'copayer', {}, function(err, result) {
        err.message.should.contain('Invalid secret');
        // Right length, invalid char for base 58
        clients[0].joinWallet('DsZbqNQQ9LrTKU8EknR7gFKyCQMPg2UUHNPZ1BzM5EbJwjRZaUNBfNtdWLluuFc0f7f7sTCkh7T', 'copayer', {}, function(err, result) {
          err.message.should.contain('Invalid secret');
          done();
        });
      });
    });
    it('should fail with an unknown secret', function(done) {
      // Unknown walletId
      var oldSecret = '3bJKRn1HkQTpwhVaJMaJ22KwsjN24ML9uKfkSrP7iDuq91vSsTEygfGMMpo6kWLp1pXG9wZSKcT';
      clients[0].joinWallet(oldSecret, 'copayer', {}, function(err, result) {
        err.code.should.equal('WALLET_NOT_FOUND');
        done();
      });
    });

    it('should detect wallets with bad signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          status.wallet.copayers[0].xPubKey = status.wallet.copayers[1].xPubKey;
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });
    });

    it('should detect wallets with missing signatures', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          delete status.wallet.copayers[1].xPubKey;
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });
    });

    it('should detect wallets missing callers pubkey', function(done) {
      // Do not complete clients[1] pkr
      var openWalletStub = sinon.stub(clients[1], 'openWallet').yields();

      helpers.createAndJoinWallet(clients, 2, 3, function() {
        helpers.tamperResponse([clients[0], clients[1]], 'get', '/v1/wallets/', {}, function(status) {
          // Replace caller's pubkey
          status.wallet.copayers[1].xPubKey = (new Bitcore.HDPrivateKey()).publicKey;
          // Add a correct signature
          status.wallet.copayers[1].xPubKeySignature = Utils.signMessage(
            status.wallet.copayers[1].xPubKey.toString(),
            clients[0].credentials.walletPrivKey
          );
        }, function() {
          openWalletStub.restore();
          clients[1].openWallet(function(err, x) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });
    });
    it('should perform a dry join without actually joining', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 2, {}, function(err, secret) {
        should.not.exist(err);
        should.exist(secret);
        clients[1].joinWallet(secret, 'dummy', {
          dryRun: true
        }, function(err, wallet) {
          should.not.exist(err);
          should.exist(wallet);
          wallet.status.should.equal('pending');
          wallet.copayers.length.should.equal(1);
          done();
        });
      });
    });

    it('should return wallet status even if wallet is not yet complete', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 2, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        should.exist(secret);

        clients[0].getStatus({}, function(err, status) {
          should.not.exist(err);
          should.exist(status);
          status.wallet.status.should.equal('pending');
          should.exist(status.wallet.secret);
          status.wallet.secret.should.equal(secret);
          done();
        });
      });
    });
    it('should return status using v2 version', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        clients[0].getStatus({}, function(err, status) {
          should.not.exist(err);
          should.not.exist(status.wallet.publicKeyRing);
          status.wallet.status.should.equal('complete');
          done();
        });
      });
    });
    it('should return extended status using v2 version', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err, secret) {
        should.not.exist(err);
        clients[0].getStatus({
          includeExtendedInfo: true
        }, function(err, status) {
          should.not.exist(err);
          status.wallet.publicKeyRing.length.should.equal(1);
          status.wallet.status.should.equal('complete');
          done();
        });
      });
    });

    it('should store walletPrivKey', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err) {

        var key = clients[0].credentials.walletPrivKey;
        should.not.exist(err);
        clients[0].getStatus({
          includeExtendedInfo: true
        }, function(err, status) {
          should.not.exist(err);
          status.wallet.publicKeyRing.length.should.equal(1);
          status.wallet.status.should.equal('complete');
          var key2 = status.customData.walletPrivKey;
          key2.should.be.equal(key2);
          done();
        });
      });
    });

    it('should set walletPrivKey from BWS', function(done) {
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err) {

        var wkey = clients[0].credentials.walletPrivKey;
        var skey = clients[0].credentials.sharedEncryptingKey;
        delete clients[0].credentials.walletPrivKey;
        delete clients[0].credentials.sharedEncryptingKey;
        should.not.exist(err);
        clients[0].getStatus({
          includeExtendedInfo: true
        }, function(err, status) {
          should.not.exist(err);
          clients[0].credentials.walletPrivKey.should.equal(wkey);
          clients[0].credentials.sharedEncryptingKey.should.equal(skey);
          done();
        });
      });
    });

    it('should prepare wallet with external xpubkey', function(done) {
      var client = helpers.newClient(app);
      client.seedFromExtendedPublicKey('xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq', 'ledger', '1a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f00', {
        account: 1,
        derivationStrategy: 'BIP48',
      });
      client.isPrivKeyExternal().should.equal(true);
      client.credentials.account.should.equal(1);
      client.credentials.derivationStrategy.should.equal('BIP48');
      client.credentials.requestPrivKey.should.equal('36a4504f0c6651db30484c2c128304a7ea548ef5935f19ed6af99db8000c75a4');
      client.credentials.personalEncryptingKey.should.equal('wYI1597BfOv06NI6Uye3tA==');
      client.getPrivKeyExternalSourceName().should.equal('ledger');
      done();
    });

    it('should create a 1-1 wallet with random mnemonic', function(done) {
      clients[0].seedFromRandomWithMnemonic();
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
          network: 'livenet'
        },
        function(err) {
          should.not.exist(err);
          clients[0].openWallet(function(err) {
            should.not.exist(err);
            should.not.exist(err);
            clients[0].credentials.network.should.equal('livenet');
            clients[0].getMnemonic().split(' ').length.should.equal(12);
            done();
          });
        });
    });

    it('should create a 1-1 wallet with given mnemonic', function(done) {
      var words = 'forget announce travel fury farm alpha chaos choice talent sting eagle supreme';
      clients[0].seedFromMnemonic(words);
      clients[0].createWallet('wallet name', 'creator', 1, 1, {
          network: 'livenet',
          derivationStrategy: 'BIP48',
        },
        function(err) {
          should.not.exist(err);
          clients[0].openWallet(function(err) {
            should.not.exist(err);
            should.not.exist(clients[0].getMnemonic()); // mnemonics are *not* stored
            clients[0].credentials.xPrivKey.should.equal('xprv9s21ZrQH143K4X2frJxRmGsmef9UfXhmfL4hdTGLm5ruSX46gekuSTspJX63d5nEi9q2wqUgg4KZ4yhSPy13CzVezAH6t6gCox1DN2hXV3L')
            done();
          });
        });
    });

    it('should create a 2-3 wallet with given mnemonic', function(done) {
      var words = 'forget announce travel fury farm alpha chaos choice talent sting eagle supreme';
      clients[0].seedFromMnemonic(words);
      clients[0].createWallet('wallet name', 'creator', 2, 3, {
          network: 'livenet'
        },
        function(err, secret) {
          should.not.exist(err);
          should.exist(secret);
          clients[0].openWallet(function(err) {
            should.not.exist(err);
            should.not.exist(clients[0].getMnemonic()); // mnemonics are *not* stored
            clients[0].credentials.xPrivKey.should.equal('xprv9s21ZrQH143K4X2frJxRmGsmef9UfXhmfL4hdTGLm5ruSX46gekuSTspJX63d5nEi9q2wqUgg4KZ4yhSPy13CzVezAH6t6gCox1DN2hXV3L')
            done();
          });
        });
    });
  });

  describe('Network fees', function() {
    it('should get current fee levels', function(done) {
      blockchainExplorerMock.setFeeLevels({
        1: 40000,
        3: 20000,
        10: 18000,
      });
      clients[0].credentials = {};
      clients[0].getFeeLevels('livenet', function(err, levels) {
        should.not.exist(err);
        should.exist(levels);
        _.difference(['priority', 'normal', 'economy'], _.pluck(levels, 'level')).should.be.empty;
        done();
      });
    });
  });

  describe('Version', function() {
    it('should get version of bws', function(done) {
      clients[0].credentials = {};
      clients[0].getVersion(function(err, version) {
        if (err) {
          // if bws is older version without getVersion support
          err.code.should.equal('NOT_FOUND');
        } else {
          // if bws is up-to-date
          should.exist(version);
          should.exist(version.serviceVersion);
          version.serviceVersion.should.contain('bws-');
        }
        done();
      });
    });
  });

  describe('Preferences', function() {
    it('should save and retrieve preferences', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].getPreferences(function(err, preferences) {
          should.not.exist(err);
          preferences.should.be.empty;
          clients[0].savePreferences({
            email: 'dummy@dummy.com'
          }, function(err) {
            should.not.exist(err);
            clients[0].getPreferences(function(err, preferences) {
              should.not.exist(err);
              should.exist(preferences);
              preferences.email.should.equal('dummy@dummy.com');
              done();
            });
          });
        });
      });
    });
  });

  describe('Fiat rates', function() {
    it('should get fiat exchange rate', function(done) {
      var now = Date.now();
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].getFiatRate({
          code: 'USD',
          ts: now,
        }, function(err, res) {
          should.not.exist(err);
          should.exist(res);
          res.ts.should.equal(now);
          should.not.exist(res.rate);
          done();
        });
      });
    });
  });

  describe('Address Creation', function() {
    it('should be able to create address in 1-of-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x) {
          should.not.exist(err);
          should.exist(x.address);
          x.address.charAt(0).should.not.equal('2');
          done();
        });
      });
    });
    it('should be able to create address in all copayers in a 2-3 wallet', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, 2, 3, function() {
        clients[0].createAddress(function(err, x) {
          should.not.exist(err);
          should.exist(x.address);
          x.address.charAt(0).should.equal('2');
          clients[1].createAddress(function(err, x) {
            should.not.exist(err);
            should.exist(x.address);
            clients[2].createAddress(function(err, x) {
              should.not.exist(err);
              should.exist(x.address);
              done();
            });
          });
        });
      });
    });
    it('should see balance on address created by others', function(done) {
      this.timeout(5000);
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);

          blockchainExplorerMock.setUtxo(x0, 10, w.m);
          clients[0].getBalance({}, function(err, bal0) {
            should.not.exist(err);
            bal0.totalAmount.should.equal(10 * 1e8);
            bal0.lockedAmount.should.equal(0);
            bal0.totalBytesToSendMax.should.be.within(300, 400);
            clients[1].getBalance({}, function(err, bal1) {
              bal1.totalAmount.should.equal(10 * 1e8);
              bal1.lockedAmount.should.equal(0);
              done();
            });
          });
        });
      });
    });
    it('should detect fake addresses', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        helpers.tamperResponse(clients[0], 'post', '/v1/addresses/', {}, function(address) {
          address.address = '2N86pNEpREGpwZyHVC5vrNUCbF9nM1Geh4K';
        }, function() {
          clients[0].createAddress(function(err, x0) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });
    });
    it('should detect fake public keys', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        helpers.tamperResponse(clients[0], 'post', '/v1/addresses/', {}, function(address) {
          address.publicKeys = [
            '0322defe0c3eb9fcd8bc01878e6dbca7a6846880908d214b50a752445040cc5c54',
            '02bf3aadc17131ca8144829fa1883c1ac0a8839067af4bca47a90ccae63d0d8037'
          ];
        }, function() {
          clients[0].createAddress(function(err, x0) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });
    });
    it('should be able to derive 25 addresses', function(done) {
      this.timeout(5000);
      var num = 25;
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        function create(callback) {
          clients[0].createAddress({
            ignoreMaxGap: true
          }, function(err, x) {
            should.not.exist(err);
            should.exist(x.address);
            callback(err, x);
          });
        }

        var tasks = [];
        for (var i = 0; i < num; i++) {
          tasks.push(create);
        }

        async.parallel(tasks, function(err, results) {
          should.not.exist(err);
          results.length.should.equal(num);
          done();
        });
      });
    });
  });

  describe('Notifications', function() {
    var clock;
    beforeEach(function(done) {
      this.timeout(5000);
      clock = sinon.useFakeTimers(1234000, 'Date');
      helpers.createAndJoinWallet(clients, 2, 2, function() {
        clock.tick(25 * 1000);
        clients[0].createAddress(function(err, x) {
          should.not.exist(err);
          clock.tick(25 * 1000);
          clients[1].createAddress(function(err, x) {
            should.not.exist(err);
            done();
          });
        });
      });
    });
    afterEach(function() {
      clock.restore();
    });
    it('should receive notifications', function(done) {
      clients[0].getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        notifications.length.should.equal(3);
        _.pluck(notifications, 'type').should.deep.equal(['NewCopayer', 'WalletComplete', 'NewAddress']);
        clients[0].getNotifications({
          lastNotificationId: _.last(notifications).id
        }, function(err, notifications) {
          should.not.exist(err);
          notifications.length.should.equal(0, 'should only return unread notifications');
          done();
        });
      });
    });
    it('should not receive old notifications', function(done) {
      clock.tick(61 * 1000); // more than 60 seconds
      clients[0].getNotifications({}, function(err, notifications) {
        should.not.exist(err);
        notifications.length.should.equal(0);
        done();
      });
    });
  });

  describe('Transaction Proposals Creation and Locked funds', function() {
    it('Should create proposal and get it', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 30000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              x2.creatorName.should.equal('creator');
              x2.message.should.equal('hello');
              x2.amount.should.equal(30000);
              x2.fee.should.equal(3720);
              x2.toAddress.should.equal('n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5');
              x2.hasUnconfirmedInputs.should.equal(false);
              done();
            });
          });
        });
      });
    });

    it('Should create proposal with unconfirmed inputs', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2, 0);
          var opts = {
            amount: 30000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              x2.hasUnconfirmedInputs.should.equal(true);
              done();
            });
          });
        });
      });
    });

    it('Should fail to create proposal with insufficient funds', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 300000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.exist(err);
            err.code.should.contain('INSUFFICIENT_FUNDS');
            done();
          });
        });
      });
    });
    it('Should fail to create proposal with insufficient funds for fee', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 2 * 1e8 - 2000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.exist(err);
            err.code.should.contain('INSUFFICIENT_FUNDS_FOR_FEE');
            err.message.should.contain('for fee');
            opts.feePerKb = 2000;
            clients[0].sendTxProposal(opts, function(err, x) {
              should.not.exist(err);
              clients[0].getTx(x.id, function(err, x2) {
                should.not.exist(err);
                x2.fee.should.equal(1290);
                done();
              });
            });
          });
        });
      });
    });
    it('Should lock and release funds through rejection', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('LOCKED_FUNDS');

              clients[0].rejectTxProposal(x, 'no', function(err, z) {
                should.not.exist(err);
                z.status.should.equal('rejected');
                clients[0].sendTxProposal(opts, function(err, x) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });
    it('Should lock and release funds through removal', function(done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          var opts = {
            amount: 120000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            clients[0].sendTxProposal(opts, function(err, y) {
              err.code.should.contain('LOCKED_FUNDS');

              clients[0].removeTxProposal(x, function(err) {
                should.not.exist(err);

                clients[0].sendTxProposal(opts, function(err, x) {
                  should.not.exist(err);
                  done();
                });
              });
            });
          });
        });
      });
    });
    it('Should keep message and refusal texts', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].rejectTxProposal(x, 'rejection comment', function(err, tx1) {
              should.not.exist(err);

              clients[2].getTxProposals({}, function(err, txs) {
                should.not.exist(err);
                txs[0].message.should.equal('some message');
                txs[0].actions[0].comment.should.equal('rejection comment');
                done();
              });
            });
          });
        });
      });
    });
    it('Should encrypt proposal message', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          var spy = sinon.spy(clients[0], '_doPostRequest');
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            spy.calledOnce.should.be.true;
            JSON.stringify(spy.getCall(0).args).should.not.contain('some message');
            done();
          });
        });
      });
    });
    it('Should encrypt proposal refusal comment', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            var spy = sinon.spy(clients[1], '_doPostRequest');
            clients[1].rejectTxProposal(x, 'rejection comment', function(err, tx1) {
              should.not.exist(err);
              spy.calledOnce.should.be.true;
              JSON.stringify(spy.getCall(0).args).should.not.contain('rejection comment');
              done();
            });
          });
        });
      });
    });
    it('should detect fake tx proposals (wrong signature)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].proposalSignature = '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });
    });

    it('should detect fake tx proposals (tampered amount)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].amount = 100000;
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
    it('should detect fake tx proposals (change address not it wallet)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 1);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);

            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].changeAddress.address = 'n2tbmpzpecgufct2ebyitj12tpzkhn2mn5';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                should.exist(err);
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
    it('Should return only main addresses (case 1)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getMainAddresses({}, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
    it('Should return only main addresses (case 2)', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            clients[0].getMainAddresses({
              doNotVerify: true
            }, function(err, addr) {
              should.not.exist(err);
              addr.length.should.equal(2);
              done();
            });
          });
        });
      });
    });
    it('Should return UTXOs', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].getUtxos({}, function(err, utxos) {
          should.not.exist(err);
          utxos.length.should.equal(0);
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 1);
            clients[0].getUtxos({}, function(err, utxos) {
              should.not.exist(err);
              utxos.length.should.equal(1);
              done();
            });
          });
        });
      });
    });
    it('Should return UTXOs for specific addresses', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        async.map(_.range(3), function(i, next) {
          clients[0].createAddress(function(err, x) {
            should.not.exist(err);
            should.exist(x.address);
            blockchainExplorerMock.setUtxo(x, 1, 1);
            next(null, x.address);
          });
        }, function(err, addresses) {
          var opts = {
            addresses: _.take(addresses, 2),
          };
          clients[0].getUtxos(opts, function(err, utxos) {
            should.not.exist(err);
            utxos.length.should.equal(2);
            _.sum(utxos, 'satoshis').should.equal(2 * 1e8);
            done();
          });

        });
      });
    });
  });

  describe('Payment Protocol', function() {
    var http;

    describe('Shared wallet', function() {

      beforeEach(function(done) {
        http = sinon.stub();
        http.yields(null, TestData.payProBuf);
        helpers.createAndJoinWallet(clients, 2, 2, function(w) {
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 2);
            blockchainExplorerMock.setUtxo(x0, 1, 2);
            var opts = {
              payProUrl: 'dummy',
            };
            clients[0].payProHttp = clients[1].payProHttp = http;

            clients[0].fetchPayPro(opts, function(err, paypro) {
              clients[0].sendTxProposal({
                toAddress: paypro.toAddress,
                amount: paypro.amount,
                message: paypro.memo,
                payProUrl: opts.payProUrl,
              }, function(err, x) {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });

      it('Should Create and Verify a Tx from PayPro', function(done) {

        clients[1].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          var tx = txps[0];
          // From the hardcoded paypro request
          tx.amount.should.equal(404500);
          tx.toAddress.should.equal('mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE');
          tx.message.should.equal('Payment request for BitPay invoice CibEJJtG1t9H77KmM61E2t for merchant testCopay');
          tx.payProUrl.should.equal('dummy');
          done();
        });
      });

      it('Should Detect tampered PayPro Proposals at getTxProposals', function(done) {
        helpers.tamperResponse(clients[1], 'get', '/v1/txproposals/', {}, function(txps) {
          txps[0].amount++;
          // Generate the right signature (with client 0)
          var sig = clients[0]._computeProposalSignature(txps[0]);
          txps[0].proposalSignature = sig;

          return txps;
        }, function() {
          clients[1].getTxProposals({}, function(err, txps) {
            err.code.should.contain('SERVER_COMPROMISED');
            done();
          });
        });
      });

      it('Should Detect tampered PayPro Proposals at signTx', function(done) {
        helpers.tamperResponse(clients[1], 'get', '/v1/txproposals/', {}, function(txps) {
          txps[0].amount++;
          // Generate the right signature (with client 0)
          var sig = clients[0]._computeProposalSignature(txps[0]);
          txps[0].proposalSignature = sig;
          return txps;
        }, function() {
          clients[1].getTxProposals({
            doNotVerify: true
          }, function(err, txps) {
            should.not.exist(err);
            clients[1].signTxProposal(txps[0], function(err, txps) {
              err.code.should.contain('SERVER_COMPROMISED');
              done();
            });
          });
        });
      });

      it('Should handle broken paypro data', function(done) {
        http = sinon.stub();
        http.yields(null, 'a broken data');
        clients[0].payProHttp = http;
        var opts = {
          payProUrl: 'dummy',
        };
        clients[0].fetchPayPro(opts, function(err, paypro) {
          should.exist(err);
          err.should.contain('parse');
          done();
        });
      });

      it('Should ignore PayPro at getTxProposals if instructed', function(done) {
        http.yields(null, 'kaka');
        clients[1].doNotVerifyPayPro = true;
        clients[1].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          var tx = txps[0];
          // From the hardcoded paypro request
          tx.amount.should.equal(404500);
          tx.toAddress.should.equal('mjfjcbuYwBUdEyq2m7AezjCAR4etUBqyiE');
          tx.message.should.equal('Payment request for BitPay invoice CibEJJtG1t9H77KmM61E2t for merchant testCopay');
          tx.payProUrl.should.equal('dummy');
          done();
        });
      });

      it('Should ignore PayPro at signTxProposal if instructed', function(done) {
        http.yields(null, 'kaka');
        clients[1].doNotVerifyPayPro = true;
        clients[1].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          clients[1].signTxProposal(txps[0], function(err, txps) {
            should.not.exist(err);
            done();
          });
        });
      });

      it('Should send the "payment message" when last copayer sign', function(done) {
        clients[0].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
            should.not.exist(err);
            clients[1].signTxProposal(xx, function(err, yy, paypro) {
              should.not.exist(err);
              yy.status.should.equal('accepted');
              http.onCall(5).yields(null, TestData.payProAckBuf);

              clients[1].broadcastTxProposal(yy, function(err, zz, memo) {
                should.not.exist(err);
                var args = http.lastCall.args[0];
                args.method.should.equal('POST');
                args.body.length.should.equal(302);
                memo.should.equal('Transaction received by BitPay. Invoice will be marked as paid if the transaction is confirmed.');
                done();
              });
            });
          });
        });
      });


      it('Should send correct refund address', function(done) {
        clients[0].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          var changeAddress = txps[0].changeAddress.address;
          clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
            should.not.exist(err);
            clients[1].signTxProposal(xx, function(err, yy, paypro) {
              should.not.exist(err);
              yy.status.should.equal('accepted');
              http.onCall(5).yields(null, TestData.payProAckBuf);

              clients[1].broadcastTxProposal(yy, function(err, zz, memo) {
                should.not.exist(err);
                var args = http.lastCall.args[0];
                var data = BitcorePayPro.Payment.decode(args.body);
                var pay = new BitcorePayPro();
                var p = pay.makePayment(data);
                var refund_to = p.get('refund_to');
                refund_to.length.should.equal(1);

                refund_to = refund_to[0];

                var amount = refund_to.get('amount')
                amount.low.should.equal(404500);
                amount.high.should.equal(0);
                var s = refund_to.get('script');
                s = new Bitcore.Script(s.buffer.slice(s.offset, s.limit));
                var addr = new Bitcore.Address.fromScript(s, 'testnet');
                addr.toString().should.equal(changeAddress);
                done();
              });
            });
          });
        });
      });
    });
    describe('1-of-1 wallet', function() {
      beforeEach(function(done) {
        http = sinon.stub();
        http.yields(null, TestData.payProBuf);
        helpers.createAndJoinWallet(clients, 1, 1, function(w) {
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 2);
            blockchainExplorerMock.setUtxo(x0, 1, 2);
            var opts = {
              payProUrl: 'dummy',
            };
            clients[0].payProHttp = clients[1].payProHttp = http;

            clients[0].fetchPayPro(opts, function(err, paypro) {
              clients[0].sendTxProposal({
                toAddress: paypro.toAddress,
                amount: paypro.amount,
                message: paypro.memo,
                payProUrl: opts.payProUrl,
              }, function(err, x) {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });

      it('Should send correct refund address', function(done) {
        clients[0].getTxProposals({}, function(err, txps) {
          should.not.exist(err);
          var changeAddress = txps[0].changeAddress.address;
          clients[0].signTxProposal(txps[0], function(err, xx, paypro) {
            should.not.exist(err);
            xx.status.should.equal('accepted');
            http.onCall(5).yields(null, TestData.payProAckBuf);

            clients[0].broadcastTxProposal(xx, function(err, zz, memo) {
              should.not.exist(err);
              var args = http.lastCall.args[0];
              var data = BitcorePayPro.Payment.decode(args.body);
              var pay = new BitcorePayPro();
              var p = pay.makePayment(data);
              var refund_to = p.get('refund_to');
              refund_to.length.should.equal(1);

              refund_to = refund_to[0];

              var amount = refund_to.get('amount')
              amount.low.should.equal(404500);
              amount.high.should.equal(0);
              var s = refund_to.get('script');
              s = new Bitcore.Script(s.buffer.slice(s.offset, s.limit));
              var addr = new Bitcore.Address.fromScript(s, 'testnet');
              addr.toString().should.equal(changeAddress);
              done();
            });
          });
        });
      });

    });
  });

  describe('Multiple output proposals', function() {
    var toAddress = 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5';
    var opts = {
      type: 'multiple_outputs',
      message: 'hello',
      outputs: [{
        amount: 10000,
        toAddress: toAddress,
        message: 'world',
      }, {
        amount: 20000,
        toAddress: toAddress,
        message: null,
      }, {
        amount: 30000,
        toAddress: toAddress,
      }]
    };

    beforeEach(function(done) {
      var http = sinon.stub();
      http.yields(null, TestData.payProBuf);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          clients[0].payProHttp = clients[1].payProHttp = http;
          done();
        });
      });
    });

    it('should support txs with no change address', function(done) {
      var opts2 = _.cloneDeep(opts);
      opts2.outputs.push({
        amount: 1e8 - _.sum(opts.outputs, 'amount') - 3650, // Fee for this tx
        toAddress: toAddress,
      });
      clients[0].sendTxProposal(opts2, function(err, txp) {
        should.not.exist(err);
        var t = Client.buildTx(txp);
        t.toObject().outputs.length.should.equal(opts2.outputs.length);
        should.not.exist(t.getChangeOutput());
        done();
      });
    });

    function doit(opts, doNotVerifyPayPro, doBroadcast, done) {
      clients[0].sendTxProposal(opts, function(err, x) {
        should.not.exist(err);
        clients[0].getTx(x.id, function(err, x2) {
          should.not.exist(err);
          x2.creatorName.should.equal('creator');
          x2.message.should.equal('hello');
          x2.fee.should.equal(3300);
          x2.outputs[0].toAddress.should.equal(toAddress);
          x2.outputs[0].amount.should.equal(10000);
          x2.outputs[0].message.should.equal('world');
          x2.outputs[1].toAddress.should.equal(toAddress);
          x2.outputs[1].amount.should.equal(20000);
          should.not.exist(x2.outputs[1].message);
          x2.outputs[2].toAddress.should.equal(toAddress);
          x2.outputs[2].amount.should.equal(30000);
          should.not.exist(x2.outputs[2].message);
          clients[0].doNotVerifyPayPro = doNotVerifyPayPro;
          clients[0].signTxProposal(x2, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('accepted');
            if (doBroadcast) {
              clients[0].broadcastTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                done();
              });
            } else {
              done();
            }
          });
        });
      });
    };
    it('should create, get, sign, and broadcast proposal with no payProUrl', function(done) {
      delete opts.payProUrl;
      doit(opts, false, true, done);
    });
    it('should create, get, sign, and broadcast proposal with null payProUrl', function(done) {
      opts.payProUrl = null;
      doit(opts, false, true, done);
    });
    it('should create, get, sign, and broadcast proposal with empty string payProUrl', function(done) {
      opts.payProUrl = '';
      doit(opts, false, true, done);
    });
    it('should create, get, and sign proposal with mal-formed payProUrl', function(done) {
      opts.payProUrl = 'dummy';
      doit(opts, true, false, done);
    });
    it('should create, get, and sign proposal with well-formed payProUrl', function(done) {
      opts.payProUrl = 'https://merchant.com/pay.php?h%3D2a8628fc2fbe';
      doit(opts, true, false, done);
    });
  });

  describe('Optional Proposal Fields', function() {
    var opts;
    beforeEach(function(done) {
      opts = {
        type: 'simple',
        amount: 10000,
        toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
        message: 'some message',
        payProUrl: 'dummy'
      };
      done();
    });

    function doTest(opts, done) {
      helpers.createAndJoinWallet(clients, 2, 2, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 2);
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[1].getTx(x.id, function(err, x2) {
              should.not.exist(err);
              should.exist(x2);
              clients[0].removeTxProposal(x2, function(err) {
                done();
              });
            });
          });
        });
      });
    };

    it('should pass with complete simple header', function(done) {
      doTest(opts, done);
    });
    it('should pass with null message', function(done) {
      opts.message = null;
      doTest(opts, done);
    });
    it('should pass with no message', function(done) {
      delete opts.message;
      doTest(opts, done);
    });
    it('should pass with null payProUrl', function(done) {
      opts.payProUrl = '';
      doTest(opts, done);
    });
    it('should pass with no payProUrl', function(done) {
      delete opts.payProUrl;
      doTest(opts, done);
    });
    it('should pass with complete multi-output header', function(done) {
      opts.type = 'multiple_outputs';
      opts.outputs = [{
        toAddress: opts.toAddress,
        amount: opts.amount,
        message: opts.message
      }];
      delete opts.toAddress;
      delete opts.amount;
      doTest(opts, done);
    });
    it('should pass with multi-output header and no message', function(done) {
      opts.type = 'multiple_outputs';
      opts.outputs = [{
        toAddress: opts.toAddress,
        amount: opts.amount
      }];
      delete opts.toAddress;
      delete opts.amount;
      doTest(opts, done);
    });
  });

  describe('Transactions Signatures and Rejection', function() {
    this.timeout(5000);
    it('Send and broadcast in 1-1 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 1, 1);
          var opts = {
            amount: 10000000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.requiredRejections.should.equal(1);
            txp.requiredSignatures.should.equal(1);
            txp.status.should.equal('pending');
            txp.changeAddress.path.should.equal('m/1/0');
            clients[0].signTxProposal(txp, function(err, txp) {
              should.not.exist(err);
              txp.status.should.equal('accepted');
              clients[0].broadcastTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('broadcasted');
                txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                done();
              });
            });
          });
        });
      });
    });
    it('Send and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[0].getStatus({}, function(err, st) {
              should.not.exist(err);
              var txp = st.pendingTxps[0];
              txp.status.should.equal('pending');
              txp.requiredRejections.should.equal(2);
              txp.requiredSignatures.should.equal(2);
              var w = st.wallet;
              w.copayers.length.should.equal(3);
              w.status.should.equal('complete');
              var b = st.balance;
              b.totalAmount.should.equal(1000000000);
              b.lockedAmount.should.equal(1000000000);
              clients[0].signTxProposal(txp, function(err, txp) {
                should.not.exist(err, err);
                txp.status.should.equal('pending');
                clients[1].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[1].broadcastTxProposal(txp, function(err, txp) {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it.skip('Send, reject actions in 2-3 wallet much have correct copayerNames', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                done();
              });
            });
          });
        });
      });
    });



    it('Send, reject, 2 signs and broadcast in 2-3 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              txp.status.should.equal('pending');
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                clients[2].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[2].broadcastTxProposal(txp, function(err, txp) {
                    txp.status.should.equal('broadcasted');
                    txp.txid.should.equal((new Bitcore.Transaction(blockchainExplorerMock.lastBroadcasted)).id);
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Send, reject in 3-4 wallet', function(done) {
      helpers.createAndJoinWallet(clients, 3, 4, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 3);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(3);

            clients[0].rejectTxProposal(txp, 'wont sign', function(err, txp) {
              should.not.exist(err, err);
              txp.status.should.equal('pending');
              clients[1].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                txp.status.should.equal('pending');
                clients[2].rejectTxProposal(txp, 'me neither', function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('rejected');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should not allow to reject or sign twice', function(done) {
      helpers.createAndJoinWallet(clients, 2, 3, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          blockchainExplorerMock.setUtxo(x0, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'hello 1-1',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            txp.status.should.equal('pending');
            txp.requiredRejections.should.equal(2);
            txp.requiredSignatures.should.equal(2);
            clients[0].signTxProposal(txp, function(err, txp) {
              should.not.exist(err);
              txp.status.should.equal('pending');
              clients[0].signTxProposal(txp, function(err) {
                should.exist(err);
                err.code.should.contain('COPAYER_VOTED');
                clients[1].rejectTxProposal(txp, 'xx', function(err, txp) {
                  should.not.exist(err);
                  clients[1].rejectTxProposal(txp, 'xx', function(err) {
                    should.exist(err);
                    err.code.should.contain('COPAYER_VOTED');
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

  describe('Broadcast raw transaction', function() {
    it('should broadcast raw tx', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        var opts = {
          network: 'testnet',
          rawTx: '0100000001b1b1b1b0d9786e237ec6a4b80049df9e926563fee7bdbc1ac3c4efc3d0af9a1c010000006a47304402207c612d36d0132ed463526a4b2370de60b0aa08e76b6f370067e7915c2c74179b02206ae8e3c6c84cee0bca8521704eddb40afe4590f14fd5d6434da980787ba3d5110121031be732b984b0f1f404840f2479bcc81f90187298efecc67dd83e1f93d9b2860dfeffffff0200ab9041000000001976a91403383bd4cff200de3690db1ed17d0b1a228ea43f88ac25ad6ed6190000001976a9147ccbaf7bcc1e323548bd1d57d7db03f6e6daf76a88acaec70700',
        };
        clients[0].broadcastRawTx(opts, function(err, txid) {
          should.not.exist(err);
          txid.should.equal('d19871cf7c123d413ac71f9240ea234fac77bc95bcf41015d8bf5c03f221b92c');
          done();
        });
      });
    });
  });

  describe('Transaction history', function() {
    it('should get transaction history', function(done) {
      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          clients[0].getTxHistory({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            done();
          });
        });
      });
    });
    it('should get empty transaction history when there are no addresses', function(done) {
      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].getTxHistory({}, function(err, txs) {
          should.not.exist(err);
          should.exist(txs);
          txs.length.should.equal(0);
          done();
        });
      });
    });
    it('should get transaction history decorated with proposal', function(done) {
      async.waterfall([

        function(next) {
          helpers.createAndJoinWallet(clients, 2, 3, function(w) {
            clients[0].createAddress(function(err, address) {
              should.not.exist(err);
              should.exist(address);
              next(null, address);
            });
          });
        },
        function(address, next) {
          blockchainExplorerMock.setUtxo(address, 10, 2);
          var opts = {
            amount: 10000,
            toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
            message: 'some message',
          };
          clients[0].sendTxProposal(opts, function(err, txp) {
            should.not.exist(err);
            clients[1].rejectTxProposal(txp, 'some reason', function(err, txp) {
              should.not.exist(err);
              clients[2].signTxProposal(txp, function(err, txp) {
                should.not.exist(err);
                clients[0].signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  txp.status.should.equal('accepted');
                  clients[0].broadcastTxProposal(txp, function(err, txp) {
                    should.not.exist(err);
                    txp.status.should.equal('broadcasted');
                    next(null, txp);
                  });
                });
              });
            });
          });
        },
        function(txp, next) {
          var history = _.cloneDeep(TestData.history);
          history[0].txid = txp.txid;
          blockchainExplorerMock.setHistory(history);
          clients[0].getTxHistory({}, function(err, txs) {
            should.not.exist(err);
            should.exist(txs);
            txs.length.should.equal(2);
            var decorated = _.find(txs, {
              txid: txp.txid
            });
            should.exist(decorated);
            decorated.proposalId.should.equal(txp.id);
            decorated.message.should.equal('some message');
            decorated.actions.length.should.equal(3);
            var rejection = _.find(decorated.actions, {
              type: 'reject'
            });
            should.exist(rejection);
            rejection.comment.should.equal('some reason');
            done();
          });
        }
      ]);
    });
    it('should get paginated transaction history', function(done) {
      var testCases = [{
        opts: {},
        expected: [20, 10]
      }, {
        opts: {
          skip: 1,
        },
        expected: [10]
      }, {
        opts: {
          limit: 1,
        },
        expected: [20]
      }, {
        opts: {
          skip: 3,
        },
        expected: []
      }, {
        opts: {
          skip: 1,
          limit: 10,
        },
        expected: [10]
      }, ];

      blockchainExplorerMock.setHistory(TestData.history);
      helpers.createAndJoinWallet(clients, 1, 1, function(w) {
        clients[0].createAddress(function(err, x0) {
          should.not.exist(err);
          should.exist(x0.address);
          async.each(testCases, function(testCase, next) {
            clients[0].getTxHistory(testCase.opts, function(err, txs) {
              should.not.exist(err);
              should.exist(txs);
              var times = _.pluck(txs, 'time');
              times.should.deep.equal(testCase.expected);
              next();
            });
          }, done);
        });
      });
    });
  });

  describe('Mobility, backup & restore', function() {
    describe('Export & Import', function() {
      var address, importedClient;
      beforeEach(function(done) {
        importedClient = null;
        helpers.createAndJoinWallet(clients, 1, 1, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr.address);
            address = addr.address;
            done();
          });
        });
      });
      afterEach(function(done) {
        importedClient.getMainAddresses({}, function(err, list) {
          should.not.exist(err);
          should.exist(list);
          list.length.should.equal(1);
          list[0].address.should.equal(address);
          done();
        });
      });

      it('should export & import', function() {
        var exported = clients[0].export();

        importedClient = helpers.newClient(app);
        importedClient.import(exported);
      });
      it('should export without signing rights', function() {
        clients[0].canSign().should.be.true;
        var exported = clients[0].export({
          noSign: true,
        });

        importedClient = helpers.newClient(app);
        importedClient.import(exported);
        importedClient.canSign().should.be.false;
      });

      it('should export & import with mnemonics + BWS', function(done) {
        var c = clients[0].credentials;
        var walletId = c.walletId;
        var walletName = c.walletName;
        var copayerName = c.copayerName;
        var key = c.xPrivKey;

        var exported = clients[0].getMnemonic();
        importedClient = helpers.newClient(app);
        importedClient.importFromMnemonic(exported, {
          network: c.network,
        }, function(err) {
          var c2 = importedClient.credentials;
          c2.xPrivKey.should.equal(key);
          should.not.exist(err);
          c2.walletId.should.equal(walletId);
          c2.walletName.should.equal(walletName);
          c2.copayerName.should.equal(copayerName);
          done();
        });
      });


      it('should export & import with xprivkey + BWS', function(done) {
        var c = clients[0].credentials;
        var walletId = c.walletId;
        var walletName = c.walletName;
        var copayerName = c.copayerName;
        var network = c.network;
        var key = c.xPrivKey;

        var exported = clients[0].getMnemonic();
        importedClient = helpers.newClient(app);
        importedClient.importFromExtendedPrivateKey(key, function(err) {
          var c2 = importedClient.credentials;
          c2.xPrivKey.should.equal(key);
          should.not.exist(err);
          c2.walletId.should.equal(walletId);
          c2.walletName.should.equal(walletName);
          c2.copayerName.should.equal(copayerName);
          done();
        });
      });
    });

    describe('Mnemonic related tests', function() {
      var importedClient;

      it('should import with mnemonics livenet', function(done) {
        var client = helpers.newClient(app);
        client.seedFromRandomWithMnemonic();
        var exported = client.getMnemonic();
        client.createWallet('wallet name', 'creator', 1, 1, {
          network: 'livenet'
        }, function(err) {
          should.not.exist(err);
          var c = client.credentials;
          importedClient = helpers.newClient(app);
          importedClient.importFromMnemonic(exported, {}, function(err) {
            should.not.exist(err);
            var c2 = importedClient.credentials;
            c2.network.should.equal('livenet');
            c2.xPubKey.should.equal(client.credentials.xPubKey);
            c2.personalEncryptingKey.should.equal(c.personalEncryptingKey);
            c2.walletId.should.equal(c.walletId);
            c2.walletName.should.equal(c.walletName);
            c2.copayerName.should.equal(c.copayerName);
            done();
          });
        });
      });
      // Generated with https://dcpos.github.io/bip39/
      it('should fail to import from words if not at BWS', function(done) {
        var exported = 'bounce tonight little spy earn void nominee ankle walk ten type update';
        importedClient = helpers.newClient(app);
        importedClient.importFromMnemonic(exported, {
          network: 'testnet',
        }, function(err) {
          err.code.should.contain('WALLET_DOES_NOT_EXIST');
          importedClient.mnemonicHasPassphrase().should.equal(false);
          importedClient.credentials.xPrivKey.should.equal('tprv8ZgxMBicQKsPdTYGTn3cPvTJJuuKHCYbfH1fbu4ceZ5tzYrcjYMKY1JfZiEFDDpEXWquSpX6jRsEoVPoaSw82tQ1Wn1U3K1bQDZBj3UGuEG');
          done();
        });
      });
      it('should fail to import from words if not at BWS, with passphrase', function(done) {
        var exported = 'bounce tonight little spy earn void nominee ankle walk ten type update';
        importedClient = helpers.newClient(app);
        importedClient.importFromMnemonic(exported, {
          network: 'testnet',
          passphrase: 'hola',
        }, function(err) {
          err.code.should.contain('WALLET_DOES_NOT_EXIST');
          importedClient.mnemonicHasPassphrase().should.equal(true);
          importedClient.credentials.xPrivKey.should.equal('tprv8ZgxMBicQKsPdVijVxEu7gVDi86PUZqbCe7xTGLwVXwZpsG3HuxLDjXL3DXRSaaNymMD7gRpXimxnUDYa5N7pLTKLQymdSotrb4co7Nwrs7');
          done();
        });
      });
      it('should import with external priv key', function(done) {
        var client = helpers.newClient(app);
        client.seedFromExtendedPublicKey('xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq', 'ledger', '1a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f00');
        client.createWallet('wallet name', 'creator', 1, 1, {
          network: 'livenet'
        }, function(err) {
          should.not.exist(err);
          var c = client.credentials;
          importedClient = helpers.newClient(app);
          importedClient.importFromExtendedPublicKey('xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq', 'ledger', '1a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f001a1f00', {}, function(err) {
            should.not.exist(err);
            var c2 = importedClient.credentials;
            c2.account.should.equal(0);
            c2.xPubKey.should.equal(client.credentials.xPubKey);
            c2.personalEncryptingKey.should.equal(c.personalEncryptingKey);
            c2.walletId.should.equal(c.walletId);
            c2.walletName.should.equal(c.walletName);
            c2.copayerName.should.equal(c.copayerName);
            done();
          });
        });
      });
      it('should fail to import with external priv key when not enought entropy', function() {
        var client = helpers.newClient(app);
        (function() {
          client.seedFromExtendedPublicKey('xpub661MyMwAqRbcGVyYUcHbZi9KNhN9Tdj8qHi9ZdoUXP1VeKiXDGGrE9tSoJKYhGFE2rimteYdwvoP6e87zS5LsgcEvsvdrpPBEmeWz9EeAUq', 'ledger', '1a1f00');
        }).should.throw('entropy');
      });


    });

    describe('Recovery', function() {
      it('should be able to gain access to a 1-1 wallet with just the xPriv', function(done) {
        helpers.createAndJoinWallet(clients, 1, 1, function() {
          var xpriv = clients[0].credentials.xPrivKey;
          var walletName = clients[0].credentials.walletName;
          var copayerName = clients[0].credentials.copayerName;

          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var recoveryClient = helpers.newClient(app);
            recoveryClient.seedFromExtendedPrivateKey(xpriv);
            recoveryClient.openWallet(function(err) {
              should.not.exist(err);
              recoveryClient.credentials.walletName.should.equal(walletName);
              recoveryClient.credentials.copayerName.should.equal(copayerName);
              recoveryClient.getMainAddresses({}, function(err, list) {
                should.not.exist(err);
                should.exist(list);
                list[0].address.should.equal(addr.address);
                done();
              });
            });
          });
        });
      });

      it('should be able to see txp messages after gaining access', function(done) {
        helpers.createAndJoinWallet(clients, 1, 1, function() {
          var xpriv = clients[0].credentials.xPrivKey;
          var walletName = clients[0].credentials.walletName;
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            should.exist(x0.address);
            blockchainExplorerMock.setUtxo(x0, 1, 1, 0);
            var opts = {
              amount: 30000,
              toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
              message: 'hello',
            };
            clients[0].sendTxProposal(opts, function(err, x) {
              should.not.exist(err);
              var recoveryClient = helpers.newClient(app);
              recoveryClient.seedFromExtendedPrivateKey(xpriv);
              recoveryClient.openWallet(function(err) {
                should.not.exist(err);
                recoveryClient.credentials.walletName.should.equal(walletName);
                recoveryClient.getTx(x.id, function(err, x2) {
                  should.not.exist(err);
                  x2.message.should.equal(opts.message);
                  done();
                });
              });
            });
          });
        });
      });

      it('should be able to recreate wallet 2-2', function(done) {
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: helpers.newDb(),
            });

            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
              storage: storage,
              blockchainExplorer: blockchainExplorerMock,
              disableLogs: true,
            }, function() {
              newApp = expressApp.app;

              var oldPKR = _.clone(clients[0].credentials.publicKeyRing);
              var recoveryClient = helpers.newClient(newApp);
              recoveryClient.import(clients[0].export());

              recoveryClient.getStatus({}, function(err, status) {
                should.exist(err);
                err.code.should.equal('NOT_AUTHORIZED');
                recoveryClient.recreateWallet(function(err) {
                  should.not.exist(err);
                  recoveryClient.getStatus({}, function(err, status) {
                    should.not.exist(err);
                    _.difference(_.pluck(status.wallet.copayers, 'name'), ['creator', 'copayer 1']).length.should.equal(0);
                    recoveryClient.createAddress(function(err, addr2) {
                      should.not.exist(err);
                      should.exist(addr2);
                      addr2.address.should.equal(addr.address);
                      addr2.path.should.equal(addr.path);

                      var recoveryClient2 = helpers.newClient(newApp);
                      recoveryClient2.import(clients[1].export());
                      recoveryClient2.getStatus({}, function(err, status) {
                        should.not.exist(err);
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

      it('should be able to recover funds from recreated wallet', function(done) {
        this.timeout(10000);
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);
            blockchainExplorerMock.setUtxo(addr, 1, 2);

            var storage = new Storage({
              db: helpers.newDb(),
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true,
              },
              function() {
                newApp = expressApp.app;

                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.import(clients[0].export());

                recoveryClient.getStatus({}, function(err, status) {
                  should.exist(err);
                  err.code.should.equal('NOT_AUTHORIZED');
                  recoveryClient.recreateWallet(function(err) {
                    should.not.exist(err);
                    recoveryClient.getStatus({}, function(err, status) {
                      should.not.exist(err);
                      recoveryClient.startScan({}, function(err) {
                        should.not.exist(err);
                        var balance = 0;
                        async.whilst(function() {
                          return balance == 0;
                        }, function(next) {
                          setTimeout(function() {
                            recoveryClient.getBalance({}, function(err, b) {
                              balance = b.totalAmount;
                              next(err);
                            });
                          }, 200);
                        }, function(err) {
                          should.not.exist(err);
                          balance.should.equal(1e8);
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

      it('should be able call recreate wallet twice', function(done) {
        helpers.createAndJoinWallet(clients, 2, 2, function() {
          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: helpers.newDb(),
            });
            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
                storage: storage,
                blockchainExplorer: blockchainExplorerMock,
                disableLogs: true,
              },
              function() {
                newApp = expressApp.app;

                var oldPKR = _.clone(clients[0].credentials.publicKeyRing);
                var recoveryClient = helpers.newClient(newApp);
                recoveryClient.import(clients[0].export());

                recoveryClient.getStatus({}, function(err, status) {
                  should.exist(err);
                  err.code.should.equal('NOT_AUTHORIZED');
                  recoveryClient.recreateWallet(function(err) {
                    should.not.exist(err);
                    recoveryClient.recreateWallet(function(err) {
                      should.not.exist(err);
                      recoveryClient.getStatus({}, function(err, status) {
                        should.not.exist(err);
                        _.difference(_.pluck(status.wallet.copayers, 'name'), ['creator', 'copayer 1']).length.should.equal(0);
                        recoveryClient.createAddress(function(err, addr2) {
                          should.not.exist(err);
                          should.exist(addr2);
                          addr2.address.should.equal(addr.address);
                          addr2.path.should.equal(addr.path);

                          var recoveryClient2 = helpers.newClient(newApp);
                          recoveryClient2.import(clients[1].export());
                          recoveryClient2.getStatus({}, function(err, status) {
                            should.not.exist(err);
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
      });

      it('should be able to recreate 1-of-1 wallet with external key (m/48) account 2', function(done) {
        clients[0].seedFromExtendedPublicKey('tprv8ZgxMBicQKsPdeZR4tV14PAJmzrWGsmafRVaHXUVYezrSbtnFM1CnqdbQuXfmSLxwr71axKewd3LTRDcQmtttUnZe27TQoGmGMeddv1H9JQ', 'ledger', 'b0937662dddea83b0ce037ff3991dd', {
          account: 2,
          derivationStrategy: 'BIP48',
        });
        clients[0].createWallet('wallet name', 'creator', 1, 1, {
          network: 'testnet'
        }, function(err, secret) {
          should.not.exist(err);

          clients[0].createAddress(function(err, addr) {
            should.not.exist(err);
            should.exist(addr);

            var storage = new Storage({
              db: helpers.newDb(),
            });

            var newApp;
            var expressApp = new ExpressApp();
            expressApp.start({
              storage: storage,
              blockchainExplorer: blockchainExplorerMock,
              disableLogs: true,
            }, function() {
              newApp = expressApp.app;

              var oldPKR = _.clone(clients[0].credentials.publicKeyRing);
              var recoveryClient = helpers.newClient(newApp);
              recoveryClient.import(clients[0].export());
              recoveryClient.credentials.derivationStrategy.should.equal('BIP48');
              recoveryClient.credentials.account.should.equal(2);
              recoveryClient.getStatus({}, function(err, status) {
                should.exist(err);
                err.code.should.equal('NOT_AUTHORIZED');
                recoveryClient.recreateWallet(function(err) {
                  should.not.exist(err);
                  recoveryClient.getStatus({}, function(err, status) {
                    should.not.exist(err);
                    recoveryClient.createAddress(function(err, addr2) {
                      should.not.exist(err);
                      should.exist(addr2);
                      addr2.address.should.equal(addr.address);
                      addr2.path.should.equal(addr.path);
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
  });

  describe('Air gapped related flows', function() {
    it('should create wallet in proxy from airgapped', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({
        network: 'testnet'
      });
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sinon.spy(proxy, 'seedFromRandom');
      proxy.createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet'
      }, function(err) {
        should.not.exist(err);
        seedSpy.called.should.be.false;
        proxy.getStatus({}, function(err, status) {
          should.not.exist(err);
          status.wallet.name.should.equal('wallet name');
          done();
        });
      });
    });
    it('should fail to create wallet in proxy from airgapped when networks do not match', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({
        network: 'testnet'
      });
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      var seedSpy = sinon.spy(proxy, 'seedFromRandom');
      should.not.exist(proxy.credentials.xPrivKey);
      proxy.createWallet('wallet name', 'creator', 1, 1, {
        network: 'livenet'
      }, function(err) {
        should.exist(err);
        err.message.should.equal('Existing keys were created for a different network');
        done();
      });
    });
    it('should be able to sign from airgapped client and broadcast from proxy', function(done) {
      var airgapped = new Client();
      airgapped.seedFromRandom({
        network: 'testnet'
      });
      var exported = airgapped.export({
        noSign: true
      });

      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);

      async.waterfall([

          function(next) {
            proxy.createWallet('wallet name', 'creator', 1, 1, {
              network: 'testnet'
            }, function(err) {
              should.not.exist(err);
              proxy.createAddress(function(err, address) {
                should.not.exist(err);
                should.exist(address.address);
                blockchainExplorerMock.setUtxo(address, 1, 1);
                var opts = {
                  amount: 1200000,
                  toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                  message: 'hello 1-1',
                };
                proxy.sendTxProposal(opts, next);
              });
            });
          },
          function(txp, next) {
            should.exist(txp);
            proxy.signTxProposal(txp, function(err, txp) {
              should.exist(err);
              should.not.exist(txp);
              err.message.should.equal('You do not have the required keys to sign transactions');
              next(null, txp);
            });
          },
          function(txp, next) {
            proxy.getTxProposals({
              forAirGapped: true
            }, next);
          },
          function(bundle, next) {
            var signatures = airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
            next(null, signatures);
          },
          function(signatures, next) {
            proxy.getTxProposals({}, function(err, txps) {
              should.not.exist(err);
              var txp = txps[0];
              txp.signatures = signatures;
              async.each(txps, function(txp, cb) {
                proxy.signTxProposal(txp, function(err, txp) {
                  should.not.exist(err);
                  proxy.broadcastTxProposal(txp, function(err, txp) {
                    should.not.exist(err);
                    txp.status.should.equal('broadcasted');
                    should.exist(txp.txid);
                    cb();
                  });
                });
              }, function(err) {
                next(err);
              });
            });
          },
        ],
        function(err) {
          should.not.exist(err);
          done();
        }
      );
    });
    describe('Failure and tampering', function() {
      var airgapped, proxy, bundle;

      beforeEach(function(done) {
        airgapped = new Client();
        airgapped.seedFromRandom({
          network: 'testnet'
        });
        var exported = airgapped.export({
          noSign: true
        });

        proxy = helpers.newClient(app);
        proxy.import(exported);
        should.not.exist(proxy.credentials.xPrivKey);

        async.waterfall([

            function(next) {
              proxy.createWallet('wallet name', 'creator', 1, 1, {
                network: 'testnet'
              }, function(err) {
                should.not.exist(err);
                proxy.createAddress(function(err, address) {
                  should.not.exist(err);
                  should.exist(address.address);
                  blockchainExplorerMock.setUtxo(address, 1, 1);
                  var opts = {
                    amount: 1200000,
                    toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
                    message: 'hello 1-1',
                  };
                  proxy.sendTxProposal(opts, next);
                });
              });
            },
            function(txp, next) {
              proxy.getTxProposals({
                forAirGapped: true
              }, function(err, result) {
                should.not.exist(err);
                bundle = result;
                next();
              });
            },
          ],
          function(err) {
            should.not.exist(err);
            done();
          }
        );
      });
      it('should fail to sign from airgapped client when there is no extended private key', function(done) {
        delete airgapped.credentials.xPrivKey;
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Missing private keys');
        done();
      });
      it('should fail gracefully when PKR cannot be decrypted in airgapped client', function(done) {
        bundle.encryptedPkr = 'dummy';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Could not decrypt public key ring');
        done();
      });
      it('should be able to detect invalid or tampered PKR when signing on airgapped client', function(done) {
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, 2);
        }).should.throw('Invalid public key ring');
        done();
      });
      it('should be able to detect tampered proposal when signing on airgapped client', function(done) {
        bundle.txps[0].encryptedMessage = 'tampered message';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Fake transaction proposal');
        done();
      });
      it('should be able to detect tampered change address when signing on airgapped client', function(done) {
        bundle.txps[0].changeAddress.address = 'mqNkvNuhzZKeXYNRZ1bdj55smmW3acr6K7';
        (function() {
          airgapped.signTxProposalFromAirGapped(bundle.txps[0], bundle.encryptedPkr, bundle.m, bundle.n);
        }).should.throw('Fake transaction proposal');
        done();
      });
    });
  });

  describe('Legacy Copay Import', function() {
    it('Should get wallets from profile', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      var ids = c.getWalletIdsFromOldCopay(t.username, t.password, t.ls['profile::4872dd8b2ceaa54f922e8e6ba6a8eaa77b488721']);
      ids.should.deep.equal([
        '8f197244e661f4d0',
        '4d32f0737a05f072',
        'e2c2d72024979ded',
        '7065a73486c8cb5d'
      ]);
      done();
    });
    it('Should import a 1-1 wallet', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::e2c2d72024979ded'], function(err) {
        should.not.exist(err);
        c.credentials.m.should.equal(1);
        c.credentials.n.should.equal(1);

        c.createAddress(function(err, x0) {
          // This is the first 'shared' address, created automatically
          // by old copay
          x0.address.should.equal('2N3w8sJUyAXCQirqNsTayWr7pWADFNdncmf');
          c.getStatus({}, function(err, status) {
            should.not.exist(err);
            status.wallet.status.should.equal('complete');
            c.credentials.walletId.should.equal('e2c2d72024979ded');
            c.credentials.walletPrivKey.should.equal('c3463113c6e1d0fc2f2bd520f7d9d62f8e1fdcdd96005254571c64902aeb1648');
            c.credentials.sharedEncryptingKey.should.equal('x3D/7QHa4PkKMbSXEvXwaw==');
            // TODO?
            // bal1.totalAmount.should.equal(18979980);
            done();
          });
        });
      });
    });

    it('Should to import the same wallet twice with different clients', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus({}, function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.walletId.should.equal('4d32f0737a05f072');
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            c2.getStatus({}, function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');
              c2.credentials.walletId.should.equal('4d32f0737a05f072');
              done();
            });
          });
        });
      });
    });

    it('Should not fail when importing the same wallet twice, same copayer', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus({}, function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.walletId.should.equal('4d32f0737a05f072');
          c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            done();
          });
        });
      });
    });

    it('Should import and complete 2-2 wallet from 2 copayers, and create addresses', function(done) {
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls['wallet::4d32f0737a05f072'], function(err) {
        should.not.exist(err);
        c.getStatus({}, function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.sharedEncryptingKey.should.equal('Ou2j4kq3z1w4yTr9YybVxg==');

          var t2 = ImportData.copayers[1];
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls['wallet::4d32f0737a05f072'], function(err) {
            should.not.exist(err);
            c2.credentials.sharedEncryptingKey.should.equal('Ou2j4kq3z1w4yTr9YybVxg==');

            // This should pull the non-temporary keys
            c2.getStatus({}, function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');
              c2.createAddress(function(err, x0) {
                x0.address.should.be.equal('2Mv1DHpozzZ9fup2nZ1kmdRXoNnDJ8b1JF2');
                c.createAddress(function(err, x0) {
                  x0.address.should.be.equal('2N2dZ1HogpxHVKv3CD2R4WrhWRwqZtpDc2M');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should import and complete 2-3 wallet from 2 copayers, and create addresses', function(done) {
      var w = 'wallet::7065a73486c8cb5d';
      var key = 'fS4HhoRd25KJY4VpNpO1jg==';
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls[w], function(err) {
        should.not.exist(err);
        c.getStatus({}, function(err, status) {
          should.not.exist(err);
          status.wallet.status.should.equal('complete');
          c.credentials.sharedEncryptingKey.should.equal(key);

          var t2 = ImportData.copayers[1];
          var c2 = helpers.newClient(app);
          c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
            should.not.exist(err);
            c2.credentials.sharedEncryptingKey.should.equal(key);

            c2.getStatus({}, function(err, status) {
              should.not.exist(err);
              status.wallet.status.should.equal('complete');

              var t3 = ImportData.copayers[2];
              var c3 = helpers.newClient(app);
              c3.createWalletFromOldCopay(t3.username, t3.password, t3.ls[w], function(err) {
                should.not.exist(err);
                c3.credentials.sharedEncryptingKey.should.equal(key);

                // This should pull the non-temporary keys
                c3.getStatus({}, function(err, status) {
                  should.not.exist(err);
                  status.wallet.status.should.equal('complete');
                  done();
                });
              });
            });
          });
        });
      });
    });

    it('Should import a 2-3 wallet from 2 copayers, and recreate it, and then on the recreated other copayers should be able to access', function(done) {
      var w = 'wallet::7065a73486c8cb5d';
      var key = 'fS4HhoRd25KJY4VpNpO1jg==';
      var t = ImportData.copayers[0];
      var c = helpers.newClient(app);
      c.createWalletFromOldCopay(t.username, t.password, t.ls[w], function(err) {
        should.not.exist(err);
        var t2 = ImportData.copayers[1];
        var c2 = helpers.newClient(app);
        c2.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
          should.not.exist(err);

          // New BWS server...
          var storage = new Storage({
            db: helpers.newDb(),
          });
          var newApp;
          var expressApp = new ExpressApp();
          expressApp.start({
              storage: storage,
              blockchainExplorer: blockchainExplorerMock,
              disableLogs: true,
            },
            function() {
              newApp = expressApp.app;
            });
          var recoveryClient = helpers.newClient(newApp);
          recoveryClient.import(c.export());
          recoveryClient.recreateWallet(function(err) {
            should.not.exist(err);
            recoveryClient.getStatus({}, function(err, status) {
              should.not.exist(err);
              _.pluck(status.wallet.copayers, 'name').sort().should.deep.equal(['123', '234', '345']);
              var t2 = ImportData.copayers[1];
              var c2p = helpers.newClient(newApp);
              c2p.createWalletFromOldCopay(t2.username, t2.password, t2.ls[w], function(err) {
                should.not.exist(err);
                c2p.getStatus({}, function(err, status) {
                  should.not.exist(err);
                  _.pluck(status.wallet.copayers, 'name').sort().should.deep.equal(['123', '234', '345']);
                  done();
                });
              });
            });
          });
        });
      });
    });
  });

  describe('Private key encryption', function() {
    var password = 'jesuissatoshi';
    var c1, c2;
    var importedClient;

    beforeEach(function(done) {
      c1 = clients[1];
      clients[1].seedFromRandomWithMnemonic({
        network: 'testnet'
      });
      clients[1].createWallet('wallet name', 'creator', 1, 1, {
        network: 'testnet',
      }, function() {
        clients[1].setPrivateKeyEncryption(password);
        clients[1].lock();
        done();
      });
    });
    it('should not lock if not encrypted', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        (function() {
          clients[0].lock();
        }).should.throw('encrypted');
        done();
      });
    });

    it('should return priv key is not encrypted', function(done) {
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        clients[0].isPrivKeyEncrypted().should.equal(false);
        clients[0].hasPrivKeyEncrypted().should.equal(false);
        done();
      });
    });
    it('should return priv key is encrypted', function() {
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
    });
    it('should prevent to reencrypt the priv key', function() {
      (function() {
        c1.setPrivateKeyEncryption('pepe');
      }).should.throw('Already');
    });
    it('should prevent to disable priv key encryption when locked', function() {
      (function() {
        c1.disablePrivateKeyEncryption();
      }).should.throw('locked');
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
    });
    it('should allow to disable priv key encryption when unlocked', function() {
      c1.unlock(password);
      c1.disablePrivateKeyEncryption();
      c1.isPrivKeyEncrypted().should.equal(false);
      c1.hasPrivKeyEncrypted().should.equal(false);
    });

    it('should prevent to encrypt airgapped\'s proxy credentials', function() {
      var airgapped = new Client();
      airgapped.seedFromRandom({
        network: 'testnet'
      });
      var exported = airgapped.export({
        noSign: true
      });
      var proxy = helpers.newClient(app);
      proxy.import(exported);
      should.not.exist(proxy.credentials.xPrivKey);
      (function() {
        proxy.setPrivateKeyEncryption('pepe');
      }).should.throw('No private key');
    });
    it('should lock and delete unencrypted fields', function() {
      c1.unlock(password);
      var xpriv = c1.credentials.xPrivKey;
      var mnemonic = c1.getMnemonic();
      c1.isPrivKeyEncrypted().should.equal(false);
      c1.hasPrivKeyEncrypted().should.equal(true);
      c1.lock();
      c1.isPrivKeyEncrypted().should.equal(true);
      c1.hasPrivKeyEncrypted().should.equal(true);
      var str = JSON.stringify(c1);
      str.indexOf(xpriv).should.equal(-1);
      str.indexOf(mnemonic).should.equal(-1);
    });
    it('should unlock and restore encrypted fields', function() {
      c1.unlock(password);
      var xpriv = c1.credentials.xPrivKey;
      var mnemonic = c1.getMnemonic();
      c1.lock();
      var str = JSON.stringify(c1);
      str.indexOf(xpriv).should.equal(-1);
      str.indexOf(mnemonic).should.equal(-1);
      (function() {
        c1.getMnemonic();
      }).should.throw('encrypted');
      c1.unlock(password);
      c1.credentials.xPrivKey.should.equal(xpriv);
      c1.getMnemonic().should.equal(mnemonic);
    });

    it('should fail to unlock with wrong password', function() {
      (function() {
        c1.unlock('hola')
      }).should.throw('Could not unlock');
    });


    it('should export & import locked', function(done) {
      var walletId = c1.credentials.walletId;
      var walletName = c1.credentials.walletName;
      var copayerName = c1.credentials.copayerName;
      var exported = c1.export({});
      importedClient = helpers.newClient(app);
      importedClient.import(exported, {});
      importedClient.openWallet(function(err) {
        should.not.exist(err);
        importedClient.credentials.walletId.should.equal(walletId);
        importedClient.credentials.walletName.should.equal(walletName);
        importedClient.credentials.copayerName.should.equal(copayerName);
        importedClient.isPrivKeyEncrypted().should.equal(true);
        importedClient.hasPrivKeyEncrypted().should.equal(true);
        importedClient.unlock(password);
        importedClient.isPrivKeyEncrypted().should.equal(false);
        importedClient.hasPrivKeyEncrypted().should.equal(true);
        done();
      });
    });

    it('should not sign when locked', function(done) {
      c1.createAddress(function(err, x0) {
        should.not.exist(err);
        blockchainExplorerMock.setUtxo(x0, 1, 1);
        var opts = {
          amount: 10000000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello 1-1',
        };
        c1.sendTxProposal(opts, function(err, txp) {
          should.not.exist(err);
          c1.signTxProposal(txp, function(err) {
            err.message.should.contain('encrypted');
            done();
          });
        });
      });
    });
    it('should sign when unlocked', function(done) {
      c1.createAddress(function(err, x0) {
        should.not.exist(err);
        blockchainExplorerMock.setUtxo(x0, 1, 1);
        var opts = {
          amount: 10000000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello 1-1',
        };
        c1.sendTxProposal(opts, function(err, txp) {
          should.not.exist(err);
          c1.unlock(password);
          c1.signTxProposal(txp, function(err) {
            should.not.exist(err);
            c1.lock();
            c1.isPrivKeyEncrypted().should.equal(true);
            c1.hasPrivKeyEncrypted().should.equal(true);
            done();
          });
        });
      });
    });
  });

  describe('#addAccess', function() {
    describe('1-1 wallets', function() {
      var opts;

      beforeEach(function(done) {
        opts = {
          amount: 10000,
          toAddress: 'n2TBMPzPECGUfcT2EByiTJ12TPZkhN2mN5',
          message: 'hello',
        };

        helpers.createAndJoinWallet(clients, 1, 1, function() {
          clients[0].createAddress(function(err, x0) {
            should.not.exist(err);
            blockchainExplorerMock.setUtxo(x0, 10, 1);
            var c = clients[0].credentials;

            // Ggenerate a new priv key, not registered
            var k = new Bitcore.PrivateKey();
            c.requestPrivKey = k.toString();
            c.requestPubKey = k.toPublicKey().toString();
            done();
          });
        });
      });

      it('should deny access before registering it ', function(done) {
        clients[0].sendTxProposal(opts, function(err, x) {
          err.code.should.contain('NOT_AUTHORIZED');
          done();
        });
      });

      it('should grant access with current keys', function(done) {
        clients[0].addAccess({}, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            done();
          });
        });
      });

      it('should grant access with *new* keys then deny access with old keys', function(done) {
        clients[0].addAccess({
          generateNewKey: true
        }, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            err.code.should.contain('NOT_AUTHORIZED');
            done();
          });
        });
      });

      it('should grant access with new keys', function(done) {
        clients[0].addAccess({
          generateNewKey: true
        }, function(err, x, key) {
          var k = new Bitcore.PrivateKey(key);
          var c = clients[0].credentials;
          c.requestPrivKey = k.toString();
          c.requestPubKey = k.toPublicKey().toString();
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            done();
          });
        });
      });

      it('should verify tx proposals of added access', function(done) {
        clients[0].addAccess({}, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            clients[0].getTxProposals({}, function(err, txps) {
              should.not.exist(err);
              done();
            });
          });
        });
      });


      it('should detect tampered tx proposals of added access (case 1)', function(done) {
        clients[0].addAccess({}, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].proposalSignature = '304402206e4a1db06e00068582d3be41cfc795dcf702451c132581e661e7241ef34ca19202203e17598b4764913309897d56446b51bc1dcd41a25d90fdb5f87a6b58fe3a6920';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });

      it('should detect tampered tx proposals of added access (case 2)', function(done) {
        clients[0].addAccess({}, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].proposalSignaturePubKey = '02d368d7f03a57b2ad3ad9c2766739da83b85ab9c3718fb02ad36574f9391d6bf6';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });


      it('should detect tampered tx proposals of added access (case 3)', function(done) {
        clients[0].addAccess({}, function(err, x) {
          clients[0].sendTxProposal(opts, function(err, x) {
            should.not.exist(err);
            helpers.tamperResponse(clients[0], 'get', '/v1/txproposals/', {}, function(txps) {
              txps[0].proposalSignaturePubKeySig = '304402201528748eafc5083fe67c84cbf0eb996eba9a65584a73d8c07ed6e0dc490c195802204f340488266c804cf1033f8b852efd1d4e05d862707c119002dc3fbe7a805c35';
            }, function() {
              clients[0].getTxProposals({}, function(err, txps) {
                err.code.should.contain('SERVER_COMPROMISED');
                done();
              });
            });
          });
        });
      });
    });
  });

  describe('Sweep paper wallet', function() {
    it.skip('should decrypt bip38 encrypted private key', function(done) {
      this.timeout(60000);
      clients[0].decryptBIP38PrivateKey('6PfRh9ZnWtiHrGoPPSzXe6iafTXc6FSXDhSBuDvvDmGd1kpX2Gvy1CfTcA', 'passphrase', {}, function(err, result) {
        should.not.exist(err);
        result.should.equal('5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp');
        done();
      });
    });
    it.skip('should fail to decrypt bip38 encrypted private key with incorrect passphrase', function(done) {
      this.timeout(60000);
      clients[0].decryptBIP38PrivateKey('6PfRh9ZnWtiHrGoPPSzXe6iafTXc6FSXDhSBuDvvDmGd1kpX2Gvy1CfTcA', 'incorrect passphrase', {}, function(err, result) {
        should.exist(err);
        err.message.should.contain('passphrase');
        done();
      });
    });
    it('should get balance from single private key', function(done) {
      var address = {
        address: '1PuKMvRFfwbLXyEPXZzkGi111gMUCs6uE3',
        type: 'P2PKH',
      };
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        blockchainExplorerMock.setUtxo(address, 123, 1);
        clients[0].getBalanceFromPrivateKey('5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp', function(err, balance) {
          should.not.exist(err);
          balance.should.equal(123 * 1e8);
          done();
        });
      });
    });
    it('should build tx for single private key', function(done) {
      var address = {
        address: '1PuKMvRFfwbLXyEPXZzkGi111gMUCs6uE3',
        type: 'P2PKH',
      };
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        blockchainExplorerMock.setUtxo(address, 123, 1);
        clients[0].buildTxFromPrivateKey('5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp', '1GG3JQikGC7wxstyavUBDoCJ66bWLLENZC', {}, function(err, tx) {
          should.not.exist(err);
          should.exist(tx);
          tx.outputs.length.should.equal(1);
          var output = tx.outputs[0];
          output.satoshis.should.equal(123 * 1e8 - 10000);
          var script = new Bitcore.Script.buildPublicKeyHashOut(Bitcore.Address.fromString('1GG3JQikGC7wxstyavUBDoCJ66bWLLENZC'));
          output.script.toString('hex').should.equal(script.toString('hex'));
          done();
        });
      });
    });
    it('should fail to build tx for single private key if insufficient funds', function(done) {
      var address = {
        address: '1PuKMvRFfwbLXyEPXZzkGi111gMUCs6uE3',
        type: 'P2PKH',
      };
      helpers.createAndJoinWallet(clients, 1, 1, function() {
        blockchainExplorerMock.setUtxo(address, 123 / 1e8, 1);
        clients[0].buildTxFromPrivateKey('5KjBgBiadWGhjWmLN1v4kcEZqWSZFqzgv7cSUuZNJg4tD82c4xp', '1GG3JQikGC7wxstyavUBDoCJ66bWLLENZC', {
          fee: 500
        }, function(err, tx) {
          should.exist(err);
          err.code.should.equal('INSUFFICIENT_FUNDS');
          done();
        });
      });
    });
  });
  describe('#formatAmount', function() {
    it('should successfully format amount', function() {
      var cases = [{
        args: [1, 'bit'],
        expected: '0',
      }, {
        args: [1, 'btc'],
        expected: '0.00',
      }, {
        args: [0, 'bit'],
        expected: '0',
      }, {
        args: [12345678, 'bit'],
        expected: '123,457',
      }, {
        args: [12345678, 'btc'],
        expected: '0.123457',
      }, {
        args: [12345611, 'btc'],
        expected: '0.123456',
      }, {
        args: [1234, 'btc'],
        expected: '0.000012',
      }, {
        args: [1299, 'btc'],
        expected: '0.000013',
      }, {
        args: [1234567899999, 'btc'],
        expected: '12,345.679',
      }, {
        args: [12345678, 'bit', {
          thousandsSeparator: '.'
        }],
        expected: '123.457',
      }, {
        args: [12345678, 'btc', {
          decimalSeparator: ','
        }],
        expected: '0,123457',
      }, {
        args: [1234567899999, 'btc', {
          thousandsSeparator: ' ',
          decimalSeparator: ','
        }],
        expected: '12 345,679',
      }, ];

      _.each(cases, function(testCase) {
        Utils.formatAmount.apply(this, testCase.args).should.equal(testCase.expected);
      });
    });
  });
});
