// RpcClient.js
// MIT/X11-like license.  See LICENSE.txt.
// Copyright 2013 BitPay, Inc.
require('classtool');

function ClassSpec(b) {
  var http = b.http || require('http');
  var https = b.https || require('https');

  function RpcClient(opts) {
    opts = opts || {};
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 8332;
    this.user = opts.user || 'user';
    this.pass = opts.pass || 'pass';
    this.protocol = (opts.protocol == 'http') ? http : https;
  }

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
    getAccountAddress: '',
    getAddedNodeInfo: '',
    getAddressesByAccount: '',
    getBalance: '',
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
    importPrivKey: 'str str bool',
    keypoolRefill: '',
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
    sendMany: 'str str int str',  //not sure this is will work
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
    walletPassphrase: 'string int',
    walletPassphraseChange: '',
  };

  var slice = function(arr, start, end) {
    return Array.prototype.slice.call(arr, start, end);
  };

  function generateRPCMethods(constructor, apiCalls, rpc) {
    function createRPCMethod(methodName, argMap) {
      return function() {
        for (var i=0; i<arguments.length - 1; i++) {
          if(argMap[i]) arguments[i] = argMap[i](arguments[i]);
        };
        rpc.call(this, methodName, slice(arguments, 0, arguments.length - 1), arguments[arguments.length - 1]);
      };
    };

    var types = {
      str: function(arg) {return arg.toString();}, 
      int: function(arg) {return parseFloat(arg);},
      float: function(arg) {return parseFloat(arg);},
      bool: function(arg) {return (arg === true || arg == '1' || arg == 'true' || arg.toLowerCase() == 'true');},
    };

    for(var k in apiCalls) {
      var spec = apiCalls[k].split(' ');
      for (var i = 0; i < spec.length; i++) {
        if(types[spec[i]]) {
          spec[i] = types[spec[i]];
        } else {
          spec[i] = types.string;
        }
      };
      var methodName = k.toLowerCase();
      constructor.prototype[k] = createRPCMethod(methodName, spec);
      constructor.prototype[methodName] = constructor.prototype[k];
    }
  }

  function rpc(method, params, callback) {
    var self = this;
    var request;
    if(params) {
      request = {method: method, params: params};
    } else {
      request = {method: method};
    }
    request = JSON.stringify(request);
    var auth = Buffer(self.user + ':' + self.pass).toString('base64');

    var options = {
      host: self.host,
      path: '/',
      method: 'POST',
      port: self.port,
    };
    if(self.httpOptions) {
      for(var k in self.httpOptions) {
        options[k] = self.httpOptions[k];
      }
    }
    var req = this.protocol.request(options, function(res) {
      var buf = '';
      res.on('data', function(data) {
        buf += data; 
      });
      res.on('end', function() {
        try {
          var parsedBuf = JSON.parse(buf);
        } catch(e) {
          log.err(e.stack);
          log.err(buf);
          callback(e);
          return;
        }
        callback(parsedBuf.error, parsedBuf);
      });
    });
    req.on('error', function(e) {
      callback(e);
    });
    
    req.setHeader('Content-Length', request.length);
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('Authorization', 'Basic ' + auth);
    req.write(request);
    req.end();
  };

  generateRPCMethods(RpcClient, callspec, rpc);
  return RpcClient;
};
module.defineClass(ClassSpec);

