'use strict';

var http = require('http');
var https = require('https');

/**
 * A JSON RPC client for bitcoind. An instances of RPC connects to a bitcoind
 * server and enables simple and batch RPC calls.
 *
 * @example
 * ```javascript
 *
 * var client = new RPC('user', 'pass');
 * client.getInfo(function(err, info) {
 *   // do something with the info
 * });
 * ```
 *
 * @param {String} user - username used to connect bitcoind
 * @param {String} password - password used to connect bitcoind
 * @param {Object} opts - Connection options: host, port, secure, disableAgent, rejectUnauthorized
 * @returns {RPC}
 * @constructor
 */
function RPC(user, password, opts) {
  if (!(this instanceof RPC)) {
    return new RPC(user, password, opts);
  }

  this.user = user;
  this.pass = password;

  opts = opts || {};
  this.host = opts.host || '127.0.0.1';
  this.port = opts.port || 8332;

  this.secure = typeof opts.secure === 'undefined' ? true : opts.secure;
  this._client = opts.secure ? https : http;

  this.batchedCalls = null;
  this.disableAgent = opts.disableAgent || false;
  this.rejectUnauthorized = opts.rejectUnauthorized || false;
}

/**
 * Allows to excecute RPC calls in batch. 
 *
 * @param {Function} batchCallback - Function that makes all calls to be excecuted in bach
 * @param {Function} resultCallbak - Function to be called on result
 */
RPC.prototype.batch = function(batchCallback, resultCallback) {
  this.batchedCalls = [];
  batchCallback();
  this._request(this.batchedCalls, resultCallback);
  this.batchedCalls = null;
}

/**
 * Internal function to make an RPC call
 *
 * @param {Object} request - Object to be serialized and sent to bitcoind
 * @param {Function} callbak - Function to be called on result
 */
RPC.prototype._request = function(request, callback) {
  var self = this;

  var request = JSON.stringify(request);
  var auth = Buffer(self.user + ':' + self.pass).toString('base64');

  var options = {
    host: self.host,
    path: '/',
    method: 'POST',
    port: self.port,
    rejectUnauthorized: self.rejectUnauthorized,
    agent: self.disableAgent ? false : undefined
  };

  var req = this._client.request(options, function(res) {
    var buf = '';
    res.on('data', function(data) {
      buf += data;
    });

    res.on('end', function() {
      if (res.statusCode == 401) {
        var error = new Error('bitcoin JSON-RPC connection rejected: 401 unauthorized');
        return callback(error);
      }

      if (res.statusCode == 403) {
        var error = new Error('bitcoin JSON-RPC connection rejected: 403 forbidden');
        return callback(error);
      }

      try {
        var parsedBuf = JSON.parse(buf);
      } catch (e) {
        return callback(e);
      }

      callback(parsedBuf.error, parsedBuf);
    });
  });

  req.on('error', function(e) {
    var err = new Error('Could not connect to bitcoin via RPC at host: ' + self.host + ' port: ' + self.port + ' Error: ' + e.message);
    callback(err);
  });

  req.setHeader('Content-Length', request.length);
  req.setHeader('Content-Type', 'application/json');
  req.setHeader('Authorization', 'Basic ' + auth);
  req.write(request);
  req.end();
};

var callspec = {
  addMultiSigAddress: '',
  addNode: '',
  backupWallet: '',
  createMultiSig: '',
  createRawTransaction: '',
  decodeRawTransaction: '',
  dumpPrivKey: '',
  encryptWallet: '',
  getAccount: '',
  getAccountAddress: 'str',
  getAddedNodeInfo: '',
  getAddressesByAccount: '',
  getBalance: 'str int',
  getBestBlockHash: '',
  getBlock: '',
  getBlockCount: '',
  getBlockHash: 'int',
  getBlockNumber: '',
  getBlockTemplate: '',
  getConnectionCount: '',
  getDifficulty: '',
  getGenerate: '',
  getHashesPerSec: '',
  getInfo: '',
  getMemoryPool: '',
  getMiningInfo: '',
  getNewAddress: '',
  getPeerInfo: '',
  getRawMemPool: '',
  getRawTransaction: 'str int',
  getReceivedByAccount: 'str int',
  getReceivedByAddress: 'str int',
  getTransaction: '',
  getTxOut: 'str int bool',
  getTxOutSetInfo: '',
  getWork: '',
  help: '',
  importAddress: 'str str bool',
  importPrivKey: 'str str bool',
  keyPoolRefill: '',
  listAccounts: 'int',
  listAddressGroupings: '',
  listReceivedByAccount: 'int bool',
  listReceivedByAddress: 'int bool',
  listSinceBlock: 'str int',
  listTransactions: 'str int int',
  listUnspent: 'int int',
  listLockUnspent: 'bool',
  lockUnspent: '',
  move: 'str str float int str',
  sendFrom: 'str str float int str str',
  sendMany: 'str str int str', //not sure this is will work
  sendRawTransaction: '',
  sendToAddress: 'str float str str',
  setAccount: '',
  setGenerate: 'bool int',
  setTxFee: 'float',
  signMessage: '',
  signRawTransaction: '',
  stop: '',
  submitBlock: '',
  validateAddress: '',
  verifyMessage: '',
  walletLock: '',
  walletPassPhrase: 'string int',
  walletPassphraseChange: '',
};


var slice = function(arr, start, end) {
  return Array.prototype.slice.call(arr, start, end);
};

function generateRPCMethods(constructor, apiCalls) {
  function createRPCMethod(methodName, argMap) {
    return function() {
      var limit = arguments.length - 1;
      if (this.batchedCalls) var limit = arguments.length;
      for (var i = 0; i < limit; i++) {
        if (argMap[i]) arguments[i] = argMap[i](arguments[i]);
      };
      if (this.batchedCalls) {
        this.batchedCalls.push({
          jsonrpc: '2.0',
          method: methodName,
          params: slice(arguments)
        });
      } else {
        this._request({
          method: methodName,
          params: slice(arguments, 0, arguments.length - 1)
        }, arguments[arguments.length - 1]);
      }
    };
  };

  var types = {
    str: function(arg) {
      return arg.toString();
    },
    int: function(arg) {
      return parseFloat(arg);
    },
    float: function(arg) {
      return parseFloat(arg);
    },
    bool: function(arg) {
      return (arg === true || arg == '1' || arg == 'true' || arg.toString().toLowerCase() == 'true');
    },
  };

  for (var k in apiCalls) {
    if (apiCalls.hasOwnProperty(k)) {
      var spec = apiCalls[k].split(' ');
      for (var i = 0; i < spec.length; i++) {
        if (types[spec[i]]) {
          spec[i] = types[spec[i]];
        } else {
          spec[i] = types.string;
        }
      }
      var methodName = k.toLowerCase();
      constructor.prototype[k] = createRPCMethod(methodName, spec);
      constructor.prototype[methodName] = constructor.prototype[k];
    }
  }
}

generateRPCMethods(RPC, callspec);

module.exports = RPC;
